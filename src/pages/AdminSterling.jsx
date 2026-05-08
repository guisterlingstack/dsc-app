import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Bot, Download, Users, MessageSquare, BarChart2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const STATUS_COR = {
  trial:    'bg-blue-100 text-blue-700',
  ativo:    'bg-emerald-100 text-emerald-700',
  expirado: 'bg-red-100 text-red-600',
  cancelado:'bg-slate-100 text-slate-500',
};

export default function AdminSterling() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState(30);
  const [aba, setAba] = useState('conversas');

  const since = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString();

  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ['admin-sterling-conv', periodo],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_conversas')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user && ['admin', 'admin_master'].includes(user?.role),
  });

  const { data: assinaturas = [] } = useQuery({
    queryKey: ['admin-sterling-ass'],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_assinaturas')
        .select('*, agent_planos(*)')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user && ['admin', 'admin_master'].includes(user?.role),
  });

  const atualizarPlano = useMutation({
    mutationFn: async ({ assinaturaId, planoNome, status }) => {
      const { data: plano } = await supabase
        .from('agent_planos')
        .select('id')
        .eq('nome', planoNome)
        .single();

      await supabase.from('agent_assinaturas').update({
        plano_id:    plano.id,
        status,
        ativo_desde: status === 'ativo' ? new Date().toISOString() : null,
        updated_at:  new Date().toISOString(),
      }).eq('id', assinaturaId);
    },
    onSuccess: () => { toast.success('Plano atualizado!'); qc.invalidateQueries(['admin-sterling-ass']); },
    onError:   () => toast.error('Erro ao atualizar plano'),
  });

  if (!['admin', 'admin_master'].includes(user?.role)) return null;

  // Métricas
  const totalConversas    = conversas.length;
  const totalAssinaturas  = assinaturas.length;
  const trialsAtivos      = assinaturas.filter(a => a.status === 'trial').length;
  const pagantes          = assinaturas.filter(a => a.status === 'ativo').length;

  // Top módulos
  const porModulo = {};
  conversas.forEach(c => { porModulo[c.modulo || 'Geral'] = (porModulo[c.modulo || 'Geral'] || 0) + 1; });
  const topModulos = Object.entries(porModulo).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Exportar para Obsidian
  function exportarObsidian() {
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    let md = `# Sterling Agent — Conversas Exportadas\n`;
    md += `**Data de exportação:** ${new Date().toLocaleDateString('pt-BR')}\n`;
    md += `**Período:** últimos ${periodo} dias\n`;
    md += `**Total de conversas:** ${totalConversas}\n\n---\n\n`;

    conversas.forEach((c, i) => {
      md += `## Conversa ${i + 1}\n`;
      md += `**Data:** ${new Date(c.created_at).toLocaleString('pt-BR')}\n`;
      md += `**Módulo:** ${c.modulo || 'Não identificado'}\n\n`;
      md += `**Pergunta:**\n${c.pergunta}\n\n`;
      md += `**Resposta:**\n${c.resposta}\n\n`;
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `sterling-agent-${hoje}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo exportado para Obsidian!');
  }

  return (
    <div className="p-4 lg:p-10 pb-24 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-emerald-100 rounded-lg"><Bot className="w-5 h-5 text-emerald-600" /></div>
            <h1 className="text-2xl font-bold text-slate-900">Sterling Agent — Admin</h1>
          </div>
          <p className="text-slate-500 text-sm">Gestão do assistente e conversas para pesquisa</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setPeriodo(d)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                periodo === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {d}d
            </button>
          ))}
          <button onClick={() => qc.invalidateQueries()}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
            <RefreshCw className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Conversas',    value: totalConversas,   icon: MessageSquare, cor: 'bg-blue-50 border-blue-200' },
          { label: 'Assinaturas',  value: totalAssinaturas, icon: Users,         cor: 'bg-slate-50 border-slate-200' },
          { label: 'Trials ativos',value: trialsAtivos,     icon: Bot,           cor: 'bg-amber-50 border-amber-200' },
          { label: 'Pagantes',     value: pagantes,         icon: BarChart2,     cor: 'bg-emerald-50 border-emerald-200' },
        ].map(({ label, value, icon: Icon, cor }) => (
          <div key={label} className={cn('rounded-2xl border p-5', cor)}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-100">
                <Icon className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
        {[
          { id: 'conversas',   label: 'Conversas' },
          { id: 'assinaturas', label: 'Assinaturas' },
          { id: 'modulos',     label: 'Por Módulo' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setAba(id)}
            className={cn('flex-1 py-2 rounded-lg text-xs font-medium transition-all',
              aba === id ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {label}
          </button>
        ))}
      </div>

      {/* ABA CONVERSAS */}
      {aba === 'conversas' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={exportarObsidian}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all">
              <Download className="w-4 h-4" />
              Exportar para Obsidian (.md)
            </button>
          </div>

          {isLoading ? (
            <p className="text-center text-slate-400 text-sm py-10">Carregando...</p>
          ) : conversas.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">Nenhuma conversa neste período.</p>
          ) : conversas.map(c => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                  {c.modulo || 'Geral'}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Pergunta</p>
                  <p className="text-sm text-slate-700">{c.pergunta}</p>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Resposta</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{c.resposta}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ABA ASSINATURAS */}
      {aba === 'assinaturas' && (
        <div className="space-y-3">
          {assinaturas.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">Nenhuma assinatura ainda.</p>
          ) : assinaturas.map(a => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{a.user_id}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Plano: <strong>{a.agent_planos?.label}</strong> &nbsp;·&nbsp;
                    {a.status === 'trial'
                      ? `Trial até ${new Date(a.trial_fim).toLocaleDateString('pt-BR')}`
                      : `Ativo desde ${new Date(a.ativo_desde).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', STATUS_COR[a.status])}>
                    {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                  </span>
                  {/* Upgrade manual */}
                  <select
                    defaultValue=""
                    onChange={e => {
                      if (!e.target.value) return;
                      const [plano, status] = e.target.value.split('|');
                      atualizarPlano.mutate({ assinaturaId: a.id, planoNome: plano, status });
                      e.target.value = '';
                    }}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none">
                    <option value="">Alterar plano</option>
                    <option value="basic|ativo">Basic — Ativo</option>
                    <option value="pro|ativo">Pro — Ativo</option>
                    <option value="ultra|ativo">Ultra — Ativo</option>
                    <option value="basic|cancelado">Cancelar</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ABA POR MÓDULO */}
      {aba === 'modulos' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-800 mb-5">Perguntas por módulo</h3>
          {topModulos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Sem dados ainda.</p>
          ) : (
            <div className="space-y-3">
              {topModulos.map(([modulo, count]) => {
                const max = topModulos[0][1];
                return (
                  <div key={modulo}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{modulo}</span>
                      <span className="text-slate-500">{count} perguntas</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full"
                        style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
