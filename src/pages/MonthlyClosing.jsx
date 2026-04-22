import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { CalendarCheck, Check, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function MonthlyClosing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [monthOffset, setMonthOffset] = useState(-1);
  const [step, setStep] = useState(1); // 1=fechar, 2=analisar, 3=planejar

  const refDate = addMonths(new Date(), monthOffset);
  const monthStr = format(refDate, 'yyyy-MM');
  const monthLabel = format(refDate, 'MMMM yyyy', { locale: ptBR });
  const nextMonthLabel = format(addMonths(refDate, 1), 'MMMM yyyy', { locale: ptBR });

  const { data: profiles = [] } = useQuery({ queryKey: ['financial-profile'], queryFn: () => entities.FinancialProfile.list(), enabled: !!user });
  const { data: formulas = [] } = useQuery({ queryKey: ['budget-formula'], queryFn: () => entities.BudgetFormula.list(), enabled: !!user });
  const { data: closings = [] } = useQuery({ queryKey: ['monthly-closings'], queryFn: () => entities.MonthlyClosing.list('-month'), enabled: !!user });
  const { data: contributions = [] } = useQuery({ queryKey: ['contributions'], queryFn: () => entities.MonthlyContribution.list(), enabled: !!user });
  const { data: checkins = [] } = useQuery({ queryKey: ['weekly-checkins'], queryFn: () => entities.WeeklyCheckin.list('-week_start_date'), enabled: !!user });

  const profile = profiles[0];
  const formula = formulas[0];
  const currentClosing = closings.find(c => c.month === monthStr);

  const renda = formula?.monthly_income || profile?.monthly_income || 0;
  const limiteEss = renda * (formula?.essential_percentage || 50) / 100;
  const limiteEst = renda * (formula?.lifestyle_percentage || 30) / 100;
  const metaFut = renda * (formula?.future_percentage || 20) / 100;

  const monthCheckins = checkins.filter(c => c.month === monthStr);
  const totalEss = monthCheckins.reduce((s, c) => s + (c.gasto_essenciais || 0), 0);
  const totalEst = monthCheckins.reduce((s, c) => s + (c.gasto_estilo_vida || 0), 0);
  const monthContributions = contributions.filter(c => c.month === monthStr);
  const totalFut = monthContributions.reduce((s, c) => s + (c.amount || 0), 0);
  const totalReserva = contributions.reduce((s, c) => s + (c.amount || 0), 0);

  const [form, setForm] = useState({
    // Etapa 1
    essenciais_gasto: '', estilo_gasto: '', futuro_depositado: '',
    // Etapa 2
    essenciais_causa: '', estilo_vilao: '', futuro_motivo: '',
    aprendizado1: '', aprendizado2: '', aprendizado3: '',
    // Etapa 3
    renda_mudou: 'nao', nova_renda: '',
    gasto_extra: '', gasto_extra_tipo: '', gasto_extra_como_cobrir: '',
    ajustar_formula: 'nao', nova_formula: '',
    meta_mes: '',
    saved: false,
  });

  useEffect(() => {
    if (currentClosing) {
      setForm(p => ({ ...p,
        essenciais_gasto: currentClosing.total_essenciais?.toString() || '',
        estilo_gasto: currentClosing.total_estilo_vida?.toString() || '',
        futuro_depositado: currentClosing.total_futuro?.toString() || '',
        aprendizado1: currentClosing.aprendizados?.split('|')[0] || '',
        aprendizado2: currentClosing.aprendizados?.split('|')[1] || '',
        meta_mes: currentClosing.meta_mes || '',
      }));
    } else if (monthCheckins.length > 0) {
      setForm(p => ({ ...p,
        essenciais_gasto: totalEss.toString(),
        estilo_gasto: totalEst.toString(),
        futuro_depositado: totalFut.toString(),
      }));
    }
  }, [monthStr, currentClosing?.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => currentClosing?.id
      ? entities.MonthlyClosing.update(currentClosing.id, data)
      : entities.MonthlyClosing.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['monthly-closings'] }); setForm(p => ({...p, saved: true})); },
  });

  const handleSave = () => {
    saveMutation.mutate({
      month: monthStr,
      total_essenciais: parseFloat(form.essenciais_gasto) || 0,
      total_estilo_vida: parseFloat(form.estilo_gasto) || 0,
      total_futuro: parseFloat(form.futuro_depositado) || 0,
      limite_essenciais: limiteEss,
      limite_estilo_vida: limiteEst,
      meta_futuro: metaFut,
      aprendizados: [form.aprendizado1, form.aprendizado2, form.aprendizado3].filter(Boolean).join('|'),
      meta_mes: form.meta_mes,
      status: 'fechado',
    });
  };

  const essGasto = parseFloat(form.essenciais_gasto) || 0;
  const estGasto = parseFloat(form.estilo_gasto) || 0;
  const futGasto = parseFloat(form.futuro_depositado) || 0;
  const essOk = essGasto <= limiteEss;
  const estOk = estGasto <= limiteEst;
  const futOk = futGasto >= metaFut;

  const steps = ['Fechar Mês (5 min)', 'Analisar Desvios (5 min)', 'Planejar Próximo (5 min)'];

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Checklist Mensal</h1>
            <p className="text-slate-500 text-sm mt-1">Revisão completa em 15 minutos · Todo dia 1º do mês</p>
          </div>

          {/* Navegação de mês */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <button onClick={() => { setMonthOffset(p => p - 1); setStep(1); }} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
            <div className="text-center">
              <p className="font-semibold text-slate-900 capitalize">{monthLabel}</p>
              <p className="text-xs text-slate-500">{currentClosing ? '✓ Fechamento salvo' : 'Pendente'}</p>
            </div>
            <button onClick={() => { setMonthOffset(p => Math.min(p + 1, -1)); setStep(1); }} disabled={monthOffset >= -1} className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <button onClick={() => setStep(i+1)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0', step === i+1 ? 'bg-slate-900 text-white' : step > i+1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400')}>
                  {step > i+1 ? <Check className="w-3 h-3" /> : <span>{i+1}</span>}
                  <span className="hidden sm:inline">{s.split(' (')[0]}</span>
                </button>
                {i < 2 && <div className={cn('flex-1 h-0.5', step > i+1 ? 'bg-emerald-400' : 'bg-slate-200')} />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1 — Fechar mês */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-700 mb-1">Material necessário</p>
                <p className="text-xs text-slate-500">Abra os apps das 3 contas e este checklist</p>
              </div>
              {/* Essenciais */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-900">Essenciais (50%)</h3>
                  <span className="text-xs text-slate-500">Limite: {fmt(limiteEss)}</span>
                </div>
                <div className="relative mb-3"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={form.essenciais_gasto} onChange={(e) => setForm(p => ({...p, essenciais_gasto: e.target.value}))} placeholder="Total gasto no mês" className="pl-9 h-12" style={{fontSize:'16px'}} /></div>
                {form.essenciais_gasto && (
                  <div className={cn('rounded-xl p-3 flex items-center justify-between', essOk ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200')}>
                    <span className={cn('text-sm font-semibold', essOk ? 'text-emerald-700' : 'text-red-700')}>{essOk ? '🟢 Dentro do limite' : '🔴 Estourou'}</span>
                    <span className={cn('text-sm font-bold', essOk ? 'text-emerald-700' : 'text-red-700')}>{essOk ? `Sobrou ${fmt(limiteEss - essGasto)}` : `Faltou ${fmt(essGasto - limiteEss)}`}</span>
                  </div>
                )}
              </div>
              {/* Estilo */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-900">Estilo de Vida (30%)</h3>
                  <span className="text-xs text-slate-500">Limite: {fmt(limiteEst)}</span>
                </div>
                <div className="relative mb-3"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={form.estilo_gasto} onChange={(e) => setForm(p => ({...p, estilo_gasto: e.target.value}))} placeholder="Total gasto no mês" className="pl-9 h-12" style={{fontSize:'16px'}} /></div>
                {form.estilo_gasto && (
                  <div className={cn('rounded-xl p-3 flex items-center justify-between', estOk ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200')}>
                    <span className={cn('text-sm font-semibold', estOk ? 'text-emerald-700' : 'text-red-700')}>{estOk ? '🟢 Dentro do limite' : '🔴 Estourou'}</span>
                    <span className={cn('text-sm font-bold', estOk ? 'text-emerald-700' : 'text-red-700')}>{estOk ? `Sobrou ${fmt(limiteEst - estGasto)}` : `Faltou ${fmt(estGasto - limiteEst)}`}</span>
                  </div>
                )}
              </div>
              {/* Futuro */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-900">Futuro / Reserva (20%)</h3>
                  <span className="text-xs text-slate-500">Meta: {fmt(metaFut)}</span>
                </div>
                <div className="relative mb-3"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={form.futuro_depositado} onChange={(e) => setForm(p => ({...p, futuro_depositado: e.target.value}))} placeholder="Total depositado no mês" className="pl-9 h-12" style={{fontSize:'16px'}} /></div>
                {form.futuro_depositado && (
                  <div className={cn('rounded-xl p-3 flex items-center justify-between', futOk ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200')}>
                    <span className={cn('text-sm font-semibold', futOk ? 'text-emerald-700' : 'text-red-700')}>{futOk ? '🟢 100% depositado' : '🔴 Abaixo da meta'}</span>
                    <span className={cn('text-sm font-bold', futOk ? 'text-emerald-700' : 'text-red-700')}>{futOk ? `+${fmt(futGasto - metaFut)}` : `Faltou ${fmt(metaFut - futGasto)}`}</span>
                  </div>
                )}
                {/* Saldo reserva */}
                <div className="mt-3 bg-slate-50 rounded-xl p-3">
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">Reserva total acumulada</span><span className="font-bold text-slate-900">{fmt(totalReserva)}</span></div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Meta mínima ({fmt(profile?.minimum_reserve_goal || 0)})</span>
                    <span>{profile?.minimum_reserve_goal ? `Faltam ${fmt(Math.max(0, profile.minimum_reserve_goal - totalReserva))}` : 'Configure em Meta de Reserva'}</span>
                  </div>
                  {profile?.minimum_reserve_goal && profile.monthly_contribution > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">~{Math.ceil((profile.minimum_reserve_goal - totalReserva) / profile.monthly_contribution)} meses para a meta</p>
                  )}
                </div>
              </div>
              <Button onClick={() => setStep(2)} className="w-full h-12 bg-slate-900 hover:bg-slate-800">
                Próximo: Analisar Desvios <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2 — Analisar */}
          {step === 2 && (
            <div className="space-y-4">
              {!essOk && (
                <div className="bg-white rounded-2xl border border-red-200 p-5 space-y-3">
                  <h3 className="font-semibold text-red-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Essenciais estouraram</h3>
                  <div>
                    <Label className="text-xs">Qual foi a causa?</Label>
                    <Select value={form.essenciais_causa} onValueChange={(v) => setForm(p => ({...p, essenciais_causa: v}))}>
                      <SelectTrigger className="mt-1 h-10"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {['Conta de luz/água alta', 'Remédio inesperado', 'Conserto casa/carro', 'Mercado mais caro', 'Outro'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {!estOk && (
                <div className="bg-white rounded-2xl border border-red-200 p-5 space-y-3">
                  <h3 className="font-semibold text-red-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Estilo de Vida estourou</h3>
                  <div>
                    <Label className="text-xs">Qual foi o vilão principal?</Label>
                    <Select value={form.estilo_vilao} onValueChange={(v) => setForm(p => ({...p, estilo_vilao: v}))}>
                      <SelectTrigger className="mt-1 h-10"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {['Delivery', 'Uber/99', 'Compras por impulso', 'Saídas (bares/restaurantes)', 'Roupas/eletrônicos', 'Outro'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {!futOk && (
                <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-3">
                  <h3 className="font-semibold text-amber-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Futuro foi comprometido</h3>
                  <div>
                    <Label className="text-xs">O que aconteceu?</Label>
                    <Input value={form.futuro_motivo} onChange={(e) => setForm(p => ({...p, futuro_motivo: e.target.value}))} placeholder="Explique o motivo..." className="mt-1 h-10" style={{fontSize:'16px'}} />
                  </div>
                </div>
              )}
              {essOk && estOk && futOk && (
                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-6 text-center">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"><Check className="w-7 h-7 text-emerald-600" /></div>
                  <h3 className="font-bold text-emerald-900 text-lg">Mês perfeito! 🎉</h3>
                  <p className="text-emerald-700 text-sm mt-1">Todas as categorias dentro do limite. Continue assim!</p>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="font-semibold text-slate-900">Principais aprendizados do mês</h3>
                {[['aprendizado1', 'Onde gastei mais que esperava'], ['aprendizado2', 'Onde economizei e sobrou'], ['aprendizado3', 'Ajustar para o próximo mês']].map(([k, ph]) => (
                  <div key={k}>
                    <Label className="text-xs">{ph}</Label>
                    <Input value={form[k]} onChange={(e) => setForm(p => ({...p, [k]: e.target.value}))} placeholder={ph + '...'} className="mt-1 h-10" style={{fontSize:'16px'}} />
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setStep(1)} variant="outline" className="h-11"><ChevronLeft className="w-4 h-4 mr-2" />Voltar</Button>
                <Button onClick={() => setStep(3)} className="flex-1 h-11 bg-slate-900 hover:bg-slate-800">Planejar Próximo Mês <ChevronRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </div>
          )}

          {/* Step 3 — Planejar */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white rounded-xl p-4">
                <p className="text-slate-400 text-xs mb-1">Planejando</p>
                <p className="font-bold text-lg capitalize">{nextMonthLabel}</p>
              </div>

              {/* Renda */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="font-semibold text-slate-900">Sua renda mudou?</h3>
                <div className="flex gap-2">
                  {[['nao', 'Mesma renda'], ['aumentou', 'Aumentou'], ['diminuiu', 'Diminuiu']].map(([v, l]) => (
                    <button key={v} onClick={() => setForm(p => ({...p, renda_mudou: v}))}
                      className={cn('flex-1 h-10 rounded-lg border-2 text-xs font-medium transition-all', form.renda_mudou === v ? 'border-slate-900 bg-slate-100 text-slate-900' : 'border-slate-200 text-slate-600')}>
                      {l}
                    </button>
                  ))}
                </div>
                {form.renda_mudou !== 'nao' && (
                  <div>
                    <Label className="text-xs">Nova renda (R$)</Label>
                    <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={form.nova_renda} onChange={(e) => setForm(p => ({...p, nova_renda: e.target.value}))} className="pl-9 h-11" style={{fontSize:'16px'}} /></div>
                    {form.nova_renda && (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        {[['Essenciais 50%', 0.5], ['Estilo 30%', 0.3], ['Futuro 20%', 0.2]].map(([l, p]) => (
                          <div key={l} className="bg-emerald-50 rounded-lg p-2"><p className="text-slate-500">{l}</p><p className="font-bold text-slate-900">{fmt(parseFloat(form.nova_renda) * p)}</p></div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Gastos extras */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="font-semibold text-slate-900">Tem gasto extra previsto?</h3>
                <div>
                  <Label className="text-xs">Tipo de gasto extra</Label>
                  <Select value={form.gasto_extra_tipo} onValueChange={(v) => setForm(p => ({...p, gasto_extra_tipo: v}))}>
                    <SelectTrigger className="mt-1 h-10"><SelectValue placeholder="Selecione ou deixe em branco" /></SelectTrigger>
                    <SelectContent>
                      {['Nenhum (mês normal)', 'Aniversário', 'Viagem', 'Matrícula/material', 'Manutenção', 'Presente', 'Outro'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.gasto_extra_tipo && form.gasto_extra_tipo !== 'Nenhum (mês normal)' && (
                  <div>
                    <Label className="text-xs">Valor estimado (R$)</Label>
                    <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={form.gasto_extra} onChange={(e) => setForm(p => ({...p, gasto_extra: e.target.value}))} className="pl-9 h-11" style={{fontSize:'16px'}} /></div>
                    <Label className="text-xs mt-3 block">Como vai cobrir?</Label>
                    <Select value={form.gasto_extra_como_cobrir} onValueChange={(v) => setForm(p => ({...p, gasto_extra_como_cobrir: v}))}>
                      <SelectTrigger className="mt-1 h-10"><SelectValue placeholder="Como vai cobrir?" /></SelectTrigger>
                      <SelectContent>
                        {['Já está no Estilo de Vida (30%)', 'Vou usar sobra dos Essenciais', 'Vou reduzir outro gasto', 'Vou parcelar em 2-3x', 'Reserva (emergência real)'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Meta do mês */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Minha meta para {nextMonthLabel.split(' ')[0]}</h3>
                <div className="space-y-2">
                  {[
                    'Ficar dentro dos 3 limites',
                    'Depositar 100% do Futuro',
                    `Cortar gastos do Estilo de Vida`,
                    `Aumentar depósito na reserva`,
                    'Personalizada...',
                  ].map(opt => (
                    <label key={opt} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <div onClick={() => setForm(p => ({...p, meta_mes: opt}))}
                        className={cn('w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center', form.meta_mes === opt ? 'border-slate-900 bg-slate-900' : 'border-slate-300')}>
                        {form.meta_mes === opt && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="text-sm text-slate-700">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setStep(2)} variant="outline" className="h-12"><ChevronLeft className="w-4 h-4 mr-2" />Voltar</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}
                  className={cn('flex-1 h-12', form.saved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800')}>
                  {form.saved ? <><Check className="w-4 h-4 mr-2" />Checklist Salvo!</> : saveMutation.isPending ? 'Salvando...' : '✔ Concluir Checklist Mensal'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AccessControl>
  );
}
