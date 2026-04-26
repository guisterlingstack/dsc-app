import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Users, MessageSquare, BarChart2, RefreshCw } from 'lucide-react';

// ── Cores para os gráficos ──────────────────────────────────
const CORES = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444'];

// ── Conta ocorrências de cada opção ────────────────────────
function contarOpcoes(dados, campo) {
  const contagem = {};
  dados.forEach(row => {
    const val = row[campo];
    if (val) contagem[val] = (contagem[val] || 0) + 1;
  });
  return Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], i) => ({ label, count, cor: CORES[i % CORES.length] }));
}

// ── Gráfico de barras horizontal ────────────────────────────
function GraficoBarras({ titulo, campo, dados }) {
  const itens = contarOpcoes(dados, campo);
  const max = itens[0]?.count || 1;
  const total = itens.reduce((s, i) => s + i.count, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="font-bold text-slate-800 text-sm mb-5 leading-snug">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-4">Sem respostas ainda</p>
      ) : (
        <div className="space-y-3">
          {itens.map(({ label, count, cor }) => {
            const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
            return (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 leading-tight max-w-[75%]">{label}</span>
                  <span className="font-bold text-slate-700 ml-2 flex-shrink-0">{count} <span className="font-normal text-slate-400">({pct}%)</span></span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(count / max) * 100}%`, background: cor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Card de respostas abertas ────────────────────────────────
function RespostasAbertas({ dados }) {
  const respostas = dados
    .filter(r => r.q7_expectativa)
    .map(r => ({ texto: r.q7_expectativa, data: r.created_at }))
    .reverse();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="font-bold text-slate-800 text-sm mb-5">
        💬 Pergunta 7 — O que esperam do sistema
      </h3>
      {respostas.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-4">Sem respostas ainda</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {respostas.map((r, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-slate-700 text-sm leading-relaxed italic">"{r.texto}"</p>
              <p className="text-slate-400 text-xs mt-2">
                {new Date(r.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminOnboarding() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState(30);

  const since = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString();

  const { data: respostas = [], isLoading, refetch } = useQuery({
    queryKey: ['onboarding-respostas', periodo],
    queryFn: async () => {
      const { data } = await supabase
        .from('onboarding_respostas')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user && ['admin', 'admin_master'].includes(user?.role),
  });

  const { data: totalUsuarios = 0 } = useQuery({
    queryKey: ['total-usuarios'],
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
    enabled: !!user,
  });

  if (!['admin', 'admin_master'].includes(user?.role)) return null;

  const taxaConclusao = totalUsuarios > 0
    ? ((respostas.length / totalUsuarios) * 100).toFixed(0)
    : 0;

  return (
    <div className="p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <BarChart2 className="w-5 h-5 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Onboarding</h1>
            </div>
            <p className="text-slate-500 text-sm">Lead scoring — respostas dos clientes</p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setPeriodo(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  periodo === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d}d
              </button>
            ))}
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Total de Usuários</p>
                <p className="text-2xl font-bold text-slate-900">{totalUsuarios}</p>
              </div>
              <div className="p-2 bg-slate-100 rounded-xl">
                <Users className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Onboardings</p>
                <p className="text-2xl font-bold text-slate-900">{respostas.length}</p>
                <p className="text-xs text-slate-400 mt-1">últimos {periodo} dias</p>
              </div>
              <div className="p-2 bg-emerald-100 rounded-xl">
                <BarChart2 className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Taxa de Conclusão</p>
                <p className="text-2xl font-bold text-slate-900">{taxaConclusao}%</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-xl">
                <MessageSquare className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-400 text-sm">Carregando respostas...</div>
        ) : respostas.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm">Nenhuma resposta neste período ainda.</div>
        ) : (
          <>
            {/* Gráficos — perguntas 1 a 6 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <GraficoBarras
                titulo="P1 — Faixa de renda mensal"
                campo="q1_renda"
                dados={respostas}
              />
              <GraficoBarras
                titulo="P2 — Maior dor financeira"
                campo="q2_dor"
                dados={respostas}
              />
              <GraficoBarras
                titulo="P3 — O que já tentaram antes"
                campo="q3_tentativas"
                dados={respostas}
              />
              <GraficoBarras
                titulo="P4 — Desejo principal (6 meses)"
                campo="q4_desejo"
                dados={respostas}
              />
              <GraficoBarras
                titulo="P5 — Maior obstáculo percebido"
                campo="q5_obstaculo"
                dados={respostas}
              />
              <GraficoBarras
                titulo="P6 — Perfil comportamental"
                campo="q6_perfil"
                dados={respostas}
              />
            </div>

            {/* Respostas abertas — pergunta 7 */}
            <RespostasAbertas dados={respostas} />
          </>
        )}

      </div>
    </div>
  );
}
