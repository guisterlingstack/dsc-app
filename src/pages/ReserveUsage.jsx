import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { Shield, AlertTriangle, XCircle, AlertCircle, Check, ChevronRight, ChevronLeft, HelpCircle, Phone, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const EMERGENCIA_TIPOS = {
  pequena: {
    label: 'Emergência Pequena', range: 'até R$500',
    icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300',
    regras: [
      'Não use a reserva ainda — tente outras alternativas',
      'Opção 1: Tem sobra nos Essenciais? Use essa sobra',
      'Opção 2: Parcele em 2-3x no cartão',
      'Opção 3: Reduza Estilo de Vida esse mês',
    ],
    aviso: 'Pequenas emergências não justificam quebrar o processo. Reserve a reserva para emergências maiores.'
  },
  media: {
    label: 'Emergência Média', range: 'R$500 a R$2.000',
    icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-300',
    regras: [
      'Avalie se existe alternativa antes de usar a reserva',
      'Empréstimo familiar sem juros? Parcelamento direto com prestador?',
      'Vender algo que não usa? Renda extra rápida?',
      'Se não houver alternativa: use a reserva SEM culpa',
      'No mês seguinte: deposite o dobro para repor em 1 mês',
    ],
    aviso: 'Se usar, no próximo mês: depósito normal + reposição = total dobrado.'
  },
  grande: {
    label: 'Emergência Grande', range: 'acima de R$2.000',
    icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300',
    regras: [
      'Use a reserva — é EXATAMENTE para isso',
      'Priorize sua saúde, segurança e sobrevivência',
      'Após resolver: PAUSE o aumento da reserva',
      'Foque em repor o que sacou antes de aumentar',
      'Só após repor completamente, volte a crescer',
    ],
    aviso: 'Regra de ouro: Resolver > Repor > Crescer'
  },
};

const VALIDACAO_QUESTIONS = [
  { key: 'inesperado', label: 'É um evento inesperado? (não planejei)', goodAnswer: 'sim' },
  { key: 'critico', label: 'Compromete saúde, segurança ou sobrevivência?', goodAnswer: 'sim' },
  { key: 'podeEsperar', label: 'Pode esperar 7 dias?', goodAnswer: 'nao' },
  { key: 'temAlternativa', label: 'Existe alternativa mais barata?', goodAnswer: 'nao' },
  { key: 'usariaCartao', label: 'Usaria cartão parcelado se não tivesse reserva?', goodAnswer: 'sim' },
  { key: 'temVergonha', label: 'Teria vergonha de contar para alguém próximo?', goodAnswer: 'nao' },
];

export default function ReserveUsage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('validacao'); // validacao | arvore | reposicao | prevencao
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [validacao, setValidacao] = useState({});
  const [reposicao, setReposicao] = useState({ valorSacado: '', meses: '1', motivo: '', data: new Date().toISOString().split('T')[0] });
  const [saved, setSaved] = useState(false);

  const { data: profiles = [] } = useQuery({ queryKey: ['financial-profile'], queryFn: () => entities.FinancialProfile.list(), enabled: !!user });
  const { data: contributions = [] } = useQuery({ queryKey: ['contributions'], queryFn: () => entities.MonthlyContribution.list(), enabled: !!user });
  const profile = profiles[0];
  const totalReserva = contributions.reduce((s, c) => s + (c.amount || 0), 0);

  const createMutation = useMutation({
    mutationFn: (data) => entities.ReserveUsageRequest.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reserve-usage'] }); setSaved(true); },
  });

  const valor = parseFloat(amount) || 0;
  const tipoEmergencia = valor <= 500 ? 'pequena' : valor <= 2000 ? 'media' : 'grande';
  const cfg = EMERGENCIA_TIPOS[tipoEmergencia];

  // Resultado da validação
  const validacaoOk = VALIDACAO_QUESTIONS.every(q => {
    const resp = validacao[q.key];
    if (!resp) return false;
    return resp === q.goodAnswer;
  });
  const allAnswered = VALIDACAO_QUESTIONS.every(q => validacao[q.key]);

  const handleSave = () => {
    createMutation.mutate({
      amount_needed: valor,
      reason,
      emergency_level: tipoEmergencia,
      recommendation: cfg.regras.join(' | '),
      request_date: new Date().toISOString().split('T')[0],
    });
  };

  const TABS = [
    { id: 'validacao', label: '✅ Validar Emergência' },
    { id: 'arvore', label: '🌳 Árvore de Decisão' },
    { id: 'reposicao', label: '🔄 Protocolo de Reposição' },
    { id: 'prevencao', label: '🛡️ Prevenção' },
  ];

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C9A84C]/15 rounded-lg flex-shrink-0"><Wallet className="w-5 h-5 text-[#C9A84C]" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Usar a Reserva?</h1>
              <p className="text-slate-500 text-sm mt-1">Guia completo para tomar a decisão certa</p>
            </div>
          </div>

          {/* Saldo */}
          {totalReserva > 0 && (
            <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /><span className="text-sm text-slate-300">Sua reserva atual</span></div>
              <span className="font-bold text-lg">{fmt(totalReserva)}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setStep(1); setSaved(false); }}
                className={cn('whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium transition-all flex-shrink-0', tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Validar Emergência */}
          {tab === 'validacao' && (
            <div className="space-y-5">
              {step === 1 && (
                <>
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"><HelpCircle className="w-8 h-8 text-amber-600" /></div>
                    <h2 className="text-lg font-bold text-slate-900 mb-3">Antes de sacar, vamos validar</h2>
                    <p className="text-slate-600 text-sm mb-5">Responda 6 perguntas rápidas para saber se é realmente uma emergência</p>
                    <Button onClick={() => setStep(2)} className="bg-slate-900 hover:bg-slate-800 px-8 h-12">Começar Validação</Button>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900 mb-3">Isso É emergência ✅</h3>
                    <div className="space-y-1">
                      {['Carro quebrou e precisa para trabalhar', 'Remédio urgente não coberto pelo plano', 'Conserto emergencial da casa', 'Dentista de urgência (dor, canal)', 'Perda parcial/total de renda', 'Eletrodoméstico essencial quebrou'].map(i => <p key={i} className="text-sm text-slate-600 flex items-center gap-2"><span className="text-emerald-500">✓</span>{i}</p>)}
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-3 mt-5">Isso NÃO é emergência ❌</h3>
                    <div className="space-y-1">
                      {['Promoção "imperdível"', 'Viagem "oportunidade única"', 'Celular novo (se o atual funciona)', 'Presente caro', 'Upgrade de vida', '"Preciso daquele produto"'].map(i => <p key={i} className="text-sm text-slate-600 flex items-center gap-2"><span className="text-red-500">✗</span>{i}</p>)}
                    </div>
                  </div>
                </>
              )}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="mb-4">
                      <Label>Quanto precisa sacar? (R$)</Label>
                      <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-9 h-12" style={{fontSize:'16px'}} /></div>
                    </div>
                    <div>
                      <Label>Qual é o motivo?</Label>
                      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva a situação..." rows={3} className="mt-1" style={{fontSize:'16px'}} />
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h3 className="font-semibold text-slate-900">Responda honestamente:</h3>
                    {VALIDACAO_QUESTIONS.map(q => (
                      <div key={q.key} className="border border-slate-200 rounded-xl p-3">
                        <p className="text-sm font-medium text-slate-800 mb-2">{q.label}</p>
                        <div className="flex gap-2">
                          {['sim', 'nao'].map(resp => (
                            <button key={resp} onClick={() => setValidacao(p => ({...p, [q.key]: resp}))}
                              className={cn('flex-1 h-9 rounded-lg text-sm font-medium transition-all', validacao[q.key] === resp ? (resp === q.goodAnswer ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                              {resp === 'sim' ? 'Sim' : 'Não'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {allAnswered && (
                    <div className={cn('rounded-2xl p-6 text-center border-2', validacaoOk ? 'bg-emerald-50 border-emerald-400' : 'bg-red-50 border-red-400')}>
                      {validacaoOk ? (
                        <>
                          <Check className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                          <h3 className="font-bold text-emerald-900 text-lg">✅ É uma Emergência Real</h3>
                          <p className="text-emerald-700 text-sm mt-1">Pode usar a reserva sem culpa. É para isso que ela existe.</p>
                          {amount && <p className="text-emerald-800 font-bold mt-2 text-lg">{fmt(valor)} — {cfg.label}</p>}
                        </>
                      ) : (
                        <>
                          <XCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
                          <h3 className="font-bold text-red-900 text-lg">❌ Não é uma Emergência</h3>
                          <p className="text-red-700 text-sm mt-1">Busque alternativas. Sua segurança financeira é mais importante.</p>
                        </>
                      )}
                    </div>
                  )}
                  {validacaoOk && amount && (
                    <div className={cn('rounded-2xl border-2 p-5', cfg.bg, cfg.border)}>
                      <div className="flex items-center gap-3 mb-3">
                        <cfg.icon className={cn('w-6 h-6', cfg.color)} />
                        <div>
                          <p className={cn('font-bold', cfg.color)}>{cfg.label} ({cfg.range})</p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-3">
                        {cfg.regras.map((r, i) => <p key={i} className="text-sm text-slate-700 flex items-start gap-2"><span className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-xs flex items-center justify-center font-bold mt-0.5">{i+1}</span>{r}</p>)}
                      </div>
                      <div className="bg-white/60 rounded-lg p-3 text-xs text-slate-600"><AlertTriangle className="w-3 h-3 inline mr-1 text-amber-600" />{cfg.aviso}</div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button onClick={() => setStep(1)} variant="outline" className="h-11"><ChevronLeft className="w-4 h-4 mr-2" />Voltar</Button>
                    {validacaoOk && amount && !saved && (
                      <Button onClick={handleSave} disabled={createMutation.isPending} className="flex-1 h-11 bg-slate-900 hover:bg-slate-800">
                        {createMutation.isPending ? 'Salvando...' : 'Registrar Consulta'}
                      </Button>
                    )}
                    {saved && <div className="flex-1 h-11 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center text-sm font-medium"><Check className="w-4 h-4 mr-2" />Registrado!</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Árvore de Decisão */}
          {tab === 'arvore' && (
            <div className="space-y-4">
              {Object.entries(EMERGENCIA_TIPOS).map(([key, e]) => (
                <div key={key} className={cn('rounded-2xl border-2 p-5', e.bg, e.border)}>
                  <div className="flex items-center gap-3 mb-3">
                    <e.icon className={cn('w-6 h-6', e.color)} />
                    <div><p className={cn('font-bold', e.color)}>{e.label}</p><p className="text-xs text-slate-500">{e.range}</p></div>
                  </div>
                  <div className="space-y-2">
                    {e.regras.map((r, i) => <p key={i} className="text-sm text-slate-700 flex items-start gap-2"><span className="flex-shrink-0 w-4 h-4 rounded-full bg-white/60 text-slate-600 text-xs flex items-center justify-center font-bold mt-0.5">{i+1}</span>{r}</p>)}
                  </div>
                  <div className="mt-3 bg-white/60 rounded-lg p-3 text-xs text-slate-600"><AlertTriangle className="w-3 h-3 inline mr-1 text-amber-600" />{e.aviso}</div>
                </div>
              ))}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">🛡️ Estratégias Anti-Saque Impulsivo</h3>
                <div className="space-y-3">
                  {[
                    { title: 'Regra das 24 horas', desc: 'Espere 24h antes de sacar. 70% dos impulsos morrem nesse prazo.' },
                    { title: 'Calcule o custo real', desc: 'Sacar R$800 = atrasar a meta em X meses + perder rendimento. Vale a pena?' },
                    { title: 'Ligue para alguém de confiança', desc: 'Explique o motivo antes de sacar. Se tiver vergonha, não é emergência.' },
                  ].map(s => (
                    <div key={s.title} className="bg-slate-50 rounded-xl p-3">
                      <p className="font-semibold text-slate-900 text-sm">{s.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Reposição */}
          {tab === 'reposicao' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-semibold text-amber-900">Protocolo de Reposição</p>
                <p className="text-amber-700 text-sm">Use após sacar da reserva para repor o valor rapidamente</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <h3 className="font-semibold text-slate-900">Passo 1 — Anote o saque</h3>
                <div>
                  <Label className="text-xs">Valor sacado (R$)</Label>
                  <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={reposicao.valorSacado} onChange={(e) => setReposicao(p => ({...p, valorSacado: e.target.value}))} className="pl-9 h-11" style={{fontSize:'16px'}} /></div>
                </div>
                <div>
                  <Label className="text-xs">Data do saque</Label>
                  <Input type="date" value={reposicao.data} onChange={(e) => setReposicao(p => ({...p, data: e.target.value}))} className="mt-1 h-11" />
                </div>
                <div>
                  <Label className="text-xs">Motivo</Label>
                  <Input value={reposicao.motivo} onChange={(e) => setReposicao(p => ({...p, motivo: e.target.value}))} placeholder="Ex: Carro quebrou" className="mt-1 h-11" style={{fontSize:'16px'}} />
                </div>
              </div>
              {reposicao.valorSacado && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                  <h3 className="font-semibold text-slate-900">Passo 2 — Plano de reposição</h3>
                  <div className="flex gap-2">
                    {['1','2','3'].map(m => (
                      <button key={m} onClick={() => setReposicao(p => ({...p, meses: m}))}
                        className={cn('flex-1 h-11 rounded-xl border-2 text-sm font-medium transition-all', reposicao.meses === m ? 'border-slate-900 bg-slate-100' : 'border-slate-200 hover:border-slate-300')}>
                        {m} {m === '1' ? 'mês' : 'meses'}
                      </button>
                    ))}
                  </div>
                  {reposicao.meses && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <p className="text-sm text-slate-600">Repor <span className="font-bold text-slate-900">{fmt(parseFloat(reposicao.valorSacado))}</span> em <span className="font-bold">{reposicao.meses} mês(es)</span>:</p>
                      <p className="text-lg font-bold text-emerald-700 mt-1">{fmt(parseFloat(reposicao.valorSacado) / parseInt(reposicao.meses))}/mês extra</p>
                      <p className="text-xs text-slate-500 mt-1">= Depósito normal + {fmt(parseFloat(reposicao.valorSacado) / parseInt(reposicao.meses))} de reposição</p>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="font-semibold text-slate-900">Passo 3 — Regras durante a reposição</h3>
                {['Não vou sacar mais nada durante a reposição', 'Novas emergências: busco alternativas primeiro', 'Foco total: repor antes de qualquer outra meta'].map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">{i+1}</div>
                    <p className="text-sm text-slate-700">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prevenção */}
          {tab === 'prevencao' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white rounded-2xl p-5">
                <h3 className="font-bold text-lg mb-3">Falsas Emergências — As Mais Comuns</h3>
                <p className="text-slate-400 text-sm">Situações que parecem emergência mas não são. Fique atento!</p>
              </div>
              {[
                { title: 'FOMO (medo de perder)', sub: '"Essa oportunidade não vai voltar!"', truth: 'Oportunidades voltam. Reserva destruída não.', action: 'Espere 72 horas. Se voltou, não era única. Se não voltou, aparecerá algo similar.' },
                { title: 'Pressão social', sub: '"Todo mundo vai, só eu que não?"', truth: 'Sua segurança financeira vale mais que a opinião alheia.', action: 'Seja honesto: "Não cabe no orçamento esse mês." Amigos verdadeiros entendem.' },
                { title: '"Emergência" recorrente', sub: 'O mesmo problema aparece todo mês', truth: 'Se repete, não é emergência. É gasto recorrente mal planejado.', action: 'Crie uma categoria "Imprevistos Previsíveis" com R$100-200/mês separado.' },
                { title: 'Emergência de terceiros', sub: '"Meu amigo precisa de R$X urgente!"', truth: 'A emergência dele não é sua responsabilidade direta.', action: 'Só empreste se tem SOBRA (não reserva). Só se pode perder sem cobrar.' },
              ].map(item => (
                <div key={item.title} className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="font-bold text-slate-900 mb-0.5">{item.title}</p>
                  <p className="text-slate-500 text-sm italic mb-3">{item.sub}</p>
                  <div className="space-y-2">
                    <div className="bg-amber-50 rounded-lg p-3"><p className="text-xs font-semibold text-amber-800 mb-0.5">A verdade:</p><p className="text-sm text-amber-700">{item.truth}</p></div>
                    <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs font-semibold text-emerald-800 mb-0.5">O que fazer:</p><p className="text-sm text-emerald-700">{item.action}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AccessControl>
  );
}
