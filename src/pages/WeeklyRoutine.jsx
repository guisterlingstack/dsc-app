import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { CalendarCheck, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addWeeks, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const SEMAFORO = {
  verde:    { dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', label: '🟢 Verde', desc: 'Dentro do ideal' },
  amarelo:  { dot: 'bg-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-400',   text: 'text-amber-700',   label: '🟡 Amarelo', desc: 'Atenção' },
  vermelho: { dot: 'bg-red-500',     bg: 'bg-red-50',     border: 'border-red-400',     text: 'text-red-700',     label: '🔴 Vermelho', desc: 'Acima do limite' },
};

function SemaforoSelector({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {Object.entries(SEMAFORO).map(([key, cfg]) => (
        <button key={key} onClick={() => onChange(key)}
          className={cn('flex-1 py-2 px-3 rounded-xl border-2 text-xs font-semibold transition-all', value === key ? `${cfg.bg} ${cfg.border} ${cfg.text}` : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300')}>
          {cfg.label}
        </button>
      ))}
    </div>
  );
}

export default function WeeklyRoutine() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [tab, setTab] = useState('checkin'); // checkin | historico | instrucoes

  const currentWeekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
  const weekLabel = `${format(currentWeekStart, 'dd/MM')} a ${format(addDays(currentWeekStart, 6), 'dd/MM')}`;
  const monthLabel = format(currentWeekStart, 'MMMM yyyy', { locale: ptBR });

  const { data: profiles = [] } = useQuery({ queryKey: ['financial-profile'], queryFn: () => entities.FinancialProfile.list(), enabled: !!user });
  const { data: formulas = [] } = useQuery({ queryKey: ['budget-formula'], queryFn: () => entities.BudgetFormula.list(), enabled: !!user });
  const { data: checkins = [] } = useQuery({ queryKey: ['weekly-checkins'], queryFn: () => entities.WeeklyCheckin.list('-week_start_date'), enabled: !!user });

  const profile = profiles[0];
  const formula = formulas[0];
  const currentCheckin = checkins.find(c => c.week_start_date === weekStartStr);

  // Usa dados do orçamento ou do profile
  const renda = formula?.monthly_income || profile?.monthly_income || 0;
  const limiteEss = renda * (formula?.essential_percentage || 50) / 100;
  const limiteEst = renda * (formula?.lifestyle_percentage || 30) / 100;
  const limiteFut = renda * (formula?.future_percentage || 20) / 100;

  // Número da semana no mês (1-4)
  const weekNum = Math.min(4, Math.ceil(currentWeekStart.getDate() / 7));
  const weekPct = weekNum * 25; // Porcentagem ideal acumulada

  const [form, setForm] = useState({
    gasto_essenciais: '', gasto_estilo_vida: '', futuro_depositado: '',
    semaforo_essenciais: '', semaforo_estilo_vida: '', semaforo_futuro: '',
    vilao_semana: '', acao_semana: '', aprendizado: '', notas: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (currentCheckin) {
      setForm({
        gasto_essenciais: currentCheckin.gasto_essenciais?.toString() || '',
        gasto_estilo_vida: currentCheckin.gasto_estilo_vida?.toString() || '',
        futuro_depositado: currentCheckin.futuro_depositado?.toString() || '',
        semaforo_essenciais: currentCheckin.semaforo_essenciais || '',
        semaforo_estilo_vida: currentCheckin.semaforo_estilo_vida || '',
        semaforo_futuro: currentCheckin.semaforo_futuro || '',
        vilao_semana: currentCheckin.vilao_semana || '',
        acao_semana: currentCheckin.acao_semana || '',
        aprendizado: currentCheckin.notas || '',
        notas: currentCheckin.notas || '',
      });
    } else {
      setForm({ gasto_essenciais: '', gasto_estilo_vida: '', futuro_depositado: '', semaforo_essenciais: '', semaforo_estilo_vida: '', semaforo_futuro: '', vilao_semana: '', acao_semana: '', aprendizado: '', notas: '' });
    }
    setSaved(false);
  }, [weekStartStr, currentCheckin?.id]);

  // Calcula semáforo automaticamente
  const calcSemaforo = (gasto, limite, weekPct) => {
    if (!gasto || !limite) return '';
    const pct = (parseFloat(gasto) / limite) * 100;
    const idealPct = weekPct;
    if (pct <= idealPct) return 'verde';
    if (pct <= idealPct * 1.2) return 'amarelo';
    return 'vermelho';
  };

  const autoSemaforoEss = calcSemaforo(form.gasto_essenciais, limiteEss, weekPct);
  const autoSemaforoEst = calcSemaforo(form.gasto_estilo_vida, limiteEst, weekPct);
  const autoSemaforoFut = form.futuro_depositado && parseFloat(form.futuro_depositado) > 0 ? 'verde' : form.futuro_depositado ? 'vermelho' : '';

  const saveMutation = useMutation({
    mutationFn: (data) => currentCheckin?.id
      ? entities.WeeklyCheckin.update(currentCheckin.id, data)
      : entities.WeeklyCheckin.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['weekly-checkins'] }); setSaved(true); },
  });

  const handleSave = () => {
    saveMutation.mutate({
      week_start_date: weekStartStr,
      month: format(currentWeekStart, 'yyyy-MM'),
      week_number: weekNum,
      gasto_essenciais: parseFloat(form.gasto_essenciais) || 0,
      gasto_estilo_vida: parseFloat(form.gasto_estilo_vida) || 0,
      futuro_depositado: parseFloat(form.futuro_depositado) || 0,
      semaforo_essenciais: form.semaforo_essenciais || autoSemaforoEss,
      semaforo_estilo_vida: form.semaforo_estilo_vida || autoSemaforoEst,
      semaforo_futuro: form.semaforo_futuro || autoSemaforoFut,
      vilao_semana: form.vilao_semana,
      acao_semana: form.acao_semana,
      notas: form.aprendizado,
    });
  };

  // Semáforo geral da semana
  const semaforoGeral = () => {
    const s = [form.semaforo_essenciais || autoSemaforoEss, form.semaforo_estilo_vida || autoSemaforoEst, form.semaforo_futuro || autoSemaforoFut];
    if (s.includes('vermelho')) return 'vermelho';
    if (s.includes('amarelo')) return 'amarelo';
    if (s.every(x => x === 'verde')) return 'verde';
    return null;
  };
  const geral = semaforoGeral();

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Controle Semanal</h1>
            <p className="text-slate-500 text-sm mt-1">10 minutos todo domingo para manter o controle</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5">
            {[['checkin','📋 Check-in'], ['historico','📊 Histórico'], ['instrucoes','ℹ️ Como usar']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn('px-3 py-2 rounded-lg text-xs font-medium transition-all', tab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {label}
              </button>
            ))}
          </div>

          {/* Check-in */}
          {tab === 'checkin' && (
            <div className="space-y-5">
              {/* Navegação de semanas */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <button onClick={() => { setWeekOffset(p => p - 1); setSaved(false); }} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                  <div className="text-center">
                    <p className="font-semibold text-slate-900">Semana {weekNum} — {weekLabel}</p>
                    <p className="text-xs text-slate-500 capitalize">{monthLabel}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Limite ideal acumulado: {weekPct}%</p>
                  </div>
                  <button onClick={() => { setWeekOffset(p => p + 1); setSaved(false); }} disabled={weekOffset >= 0} className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-30"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                </div>
                {geral && (
                  <div className={cn('mt-3 rounded-xl p-3 flex items-center gap-2', SEMAFORO[geral].bg, 'border', SEMAFORO[geral].border)}>
                    <div className={cn('w-3 h-3 rounded-full', SEMAFORO[geral].dot)} />
                    <span className={cn('text-sm font-semibold', SEMAFORO[geral].text)}>Semana no {geral} — {SEMAFORO[geral].desc}</span>
                  </div>
                )}
              </div>

              {/* Essenciais */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Essenciais (50%)</h3>
                  <span className="text-xs text-slate-500">Limite: {fmt(limiteEss)}</span>
                </div>
                <div className="mb-3">
                  <Label className="text-xs">Quanto gastou até agora esta semana?</Label>
                  <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={form.gasto_essenciais} onChange={(e) => setForm(p => ({...p, gasto_essenciais: e.target.value}))} className="pl-9 h-11" style={{fontSize:'16px'}} /></div>
                  {form.gasto_essenciais && limiteEss > 0 && (
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>Utilizado: {((parseFloat(form.gasto_essenciais)/limiteEss)*100).toFixed(0)}% do limite</span>
                      <span>Falta: {fmt(limiteEss - parseFloat(form.gasto_essenciais))}</span>
                    </div>
                  )}
                </div>
                <Label className="text-xs mb-1 block">Status da semana</Label>
                {autoSemaforoEss ? (
                  <div className={cn('rounded-xl p-3 flex items-center gap-2', SEMAFORO[autoSemaforoEss].bg, 'border', SEMAFORO[autoSemaforoEss].border)}>
                    <div className={cn('w-3 h-3 rounded-full', SEMAFORO[autoSemaforoEss].dot)} />
                    <span className={cn('text-sm font-semibold', SEMAFORO[autoSemaforoEss].text)}>{SEMAFORO[autoSemaforoEss].label} — {SEMAFORO[autoSemaforoEss].desc}</span>
                  </div>
                ) : <SemaforoSelector value={form.semaforo_essenciais} onChange={(v) => setForm(p => ({...p, semaforo_essenciais: v}))} />}
              </div>

              {/* Estilo de Vida */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Estilo de Vida (30%)</h3>
                  <span className="text-xs text-slate-500">Limite: {fmt(limiteEst)}</span>
                </div>
                <div className="mb-3">
                  <Label className="text-xs">Quanto gastou até agora esta semana?</Label>
                  <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={form.gasto_estilo_vida} onChange={(e) => setForm(p => ({...p, gasto_estilo_vida: e.target.value}))} className="pl-9 h-11" style={{fontSize:'16px'}} /></div>
                  {form.gasto_estilo_vida && limiteEst > 0 && (
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>Utilizado: {((parseFloat(form.gasto_estilo_vida)/limiteEst)*100).toFixed(0)}% do limite</span>
                      <span>Falta: {fmt(limiteEst - parseFloat(form.gasto_estilo_vida))}</span>
                    </div>
                  )}
                </div>
                <Label className="text-xs mb-1 block">Status da semana</Label>
                {autoSemaforoEst ? (
                  <div className={cn('rounded-xl p-3 flex items-center gap-2', SEMAFORO[autoSemaforoEst].bg, 'border', SEMAFORO[autoSemaforoEst].border)}>
                    <div className={cn('w-3 h-3 rounded-full', SEMAFORO[autoSemaforoEst].dot)} />
                    <span className={cn('text-sm font-semibold', SEMAFORO[autoSemaforoEst].text)}>{SEMAFORO[autoSemaforoEst].label} — {SEMAFORO[autoSemaforoEst].desc}</span>
                  </div>
                ) : <SemaforoSelector value={form.semaforo_estilo_vida} onChange={(v) => setForm(p => ({...p, semaforo_estilo_vida: v}))} />}
              </div>

              {/* Futuro */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Futuro / Reserva (20%)</h3>
                  <span className="text-xs text-slate-500">Meta: {fmt(limiteFut)}</span>
                </div>
                <Label className="text-xs">Depósito automático aconteceu?</Label>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => setForm(p => ({...p, futuro_depositado: limiteFut.toString(), semaforo_futuro: 'verde'}))}
                    className={cn('flex-1 h-11 rounded-xl border-2 text-sm font-medium transition-all', form.semaforo_futuro === 'verde' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 hover:border-emerald-300')}>
                    ✓ Sim, funcionou
                  </button>
                  <button onClick={() => setForm(p => ({...p, futuro_depositado: '0', semaforo_futuro: 'vermelho'}))}
                    className={cn('flex-1 h-11 rounded-xl border-2 text-sm font-medium transition-all', form.semaforo_futuro === 'vermelho' ? 'border-red-500 bg-red-50 text-red-900' : 'border-slate-200 hover:border-red-300')}>
                    ✗ Falhou / Saquei
                  </button>
                </div>
              </div>

              {/* Análise */}
              {(form.semaforo_essenciais === 'vermelho' || form.semaforo_estilo_vida === 'vermelho' || autoSemaforoEss === 'vermelho' || autoSemaforoEst === 'vermelho') && (
                <div className="bg-white rounded-2xl border border-red-200 p-5 space-y-3">
                  <h3 className="font-semibold text-red-900">🔴 Análise do Desvio</h3>
                  <div>
                    <Label className="text-xs">Principal vilão da semana</Label>
                    <Input value={form.vilao_semana} onChange={(e) => setForm(p => ({...p, vilao_semana: e.target.value}))} placeholder="Ex: Delivery, Uber..." className="mt-1 h-10" style={{fontSize:'16px'}} />
                  </div>
                  <div>
                    <Label className="text-xs">Ação para a próxima semana</Label>
                    <Input value={form.acao_semana} onChange={(e) => setForm(p => ({...p, acao_semana: e.target.value}))} placeholder="Ex: Cozinhar em casa 4x..." className="mt-1 h-10" style={{fontSize:'16px'}} />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Aprendizado da semana (opcional)</Label>
                <Textarea value={form.aprendizado} onChange={(e) => setForm(p => ({...p, aprendizado: e.target.value}))} placeholder="O que funcionou? O que pode melhorar?" rows={2} className="mt-1" style={{fontSize:'16px'}} />
              </div>

              <Button onClick={handleSave} disabled={saveMutation.isPending}
                className={cn('w-full h-12 text-base', saved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800')}>
                {saved ? <><Check className="w-5 h-5 mr-2" />Check-in salvo!</> : saveMutation.isPending ? 'Salvando...' : 'Salvar Check-in da Semana'}
              </Button>
            </div>
          )}

          {/* Histórico */}
          {tab === 'historico' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {['verde', 'amarelo', 'vermelho'].map(s => {
                  const count = checkins.filter(c => {
                    const pior = [c.semaforo_essenciais, c.semaforo_estilo_vida, c.semaforo_futuro];
                    if (s === 'vermelho') return pior.includes('vermelho');
                    if (s === 'amarelo') return !pior.includes('vermelho') && pior.includes('amarelo');
                    return pior.every(x => x === 'verde');
                  }).length;
                  return (
                    <div key={s} className={cn('rounded-xl p-4 text-center border', SEMAFORO[s].bg, SEMAFORO[s].border)}>
                      <div className={cn('w-3 h-3 rounded-full mx-auto mb-2', SEMAFORO[s].dot)} />
                      <p className={cn('text-2xl font-bold', SEMAFORO[s].text)}>{count}</p>
                      <p className="text-xs text-slate-500 capitalize">{s}s</p>
                    </div>
                  );
                })}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100"><h3 className="font-semibold text-slate-900">Histórico de Check-ins</h3></div>
                <div className="divide-y divide-slate-100">
                  {checkins.length === 0 ? (
                    <div className="p-8 text-center text-slate-500"><CalendarCheck className="w-10 h-10 mx-auto mb-3 text-slate-300" /><p className="text-sm">Nenhum check-in registrado ainda</p></div>
                  ) : checkins.slice(0, 12).map(c => {
                    const pior = [c.semaforo_essenciais, c.semaforo_estilo_vida, c.semaforo_futuro];
                    const s = pior.includes('vermelho') ? 'vermelho' : pior.includes('amarelo') ? 'amarelo' : 'verde';
                    return (
                      <div key={c.id} className="p-4 flex items-center gap-3">
                        <div className={cn('w-3 h-3 rounded-full flex-shrink-0', SEMAFORO[s].dot)} />
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 text-sm">Semana {c.week_number} — {c.week_start_date && new Date(c.week_start_date).toLocaleDateString('pt-BR')}</p>
                          <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                            <span>Ess: {fmt(c.gasto_essenciais)}</span>
                            <span>Est: {fmt(c.gasto_estilo_vida)}</span>
                            <span>Fut: {c.semaforo_futuro === 'verde' ? '✓' : '✗'}</span>
                          </div>
                        </div>
                        <span className={cn('text-xs font-semibold', SEMAFORO[s].text)}>{SEMAFORO[s].label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Instruções */}
          {tab === 'instrucoes' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white rounded-2xl p-5">
                <h3 className="font-bold text-lg mb-3">Como usar o Controle Semanal</h3>
                <div className="space-y-3">
                  {[
                    { n: '1', title: 'Todo domingo: 10 minutos', desc: 'Reserve 10 minutos no domingo para o check-in da semana' },
                    { n: '2', title: 'Abra os apps das contas', desc: 'Abra a Conta 2 e Conta 3 para ver os valores reais gastos' },
                    { n: '3', title: 'Preencha os valores', desc: 'Informe quanto gastou em Essenciais e Estilo de Vida esta semana' },
                    { n: '4', title: 'O semáforo é calculado', desc: 'O sistema identifica automaticamente a cor com base no progresso ideal' },
                    { n: '5', title: 'Ajuste se necessário', desc: 'Se estiver no vermelho, planeje como corrigir na semana seguinte' },
                  ].map(item => (
                    <div key={item.n} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">{item.n}</div>
                      <div><p className="font-medium text-sm">{item.title}</p><p className="text-slate-400 text-xs">{item.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(SEMAFORO).map(([key, cfg]) => (
                  <div key={key} className={cn('rounded-xl border-2 p-4 flex items-start gap-3', cfg.bg, cfg.border)}>
                    <div className={cn('w-4 h-4 rounded-full flex-shrink-0 mt-0.5', cfg.dot)} />
                    <div><p className={cn('font-semibold text-sm', cfg.text)}>{cfg.label} — {cfg.desc}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {key === 'verde' && 'Gastos dentro do esperado para a semana. Continue assim!'}
                        {key === 'amarelo' && 'Ligeiramente acima. Observe os próximos dias e controle.'}
                        {key === 'vermelho' && 'Acima do limite. Identifique o vilão e corrija na semana seguinte.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AccessControl>
  );
}
