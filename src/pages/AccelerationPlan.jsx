// AccelerationPlan.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { Rocket, Scissors, ShoppingBag, Briefcase, Plus, Trash2, TrendingUp, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const strategies = [
  { value: 'corte_vazamentos', label: 'Corte de Vazamentos', icon: Scissors, color: 'text-red-600 bg-red-100', description: 'Elimine gastos identificados no detector de vazamentos' },
  { value: 'venda_itens', label: 'Venda de Itens', icon: ShoppingBag, color: 'text-purple-600 bg-purple-100', description: 'Venda itens que você não usa mais' },
  { value: 'renda_extra', label: 'Renda Extra Temporária', icon: Briefcase, color: 'text-blue-600 bg-blue-100', description: 'Trabalhos extras ou freelance durante os 90 dias' },
];

export default function AccelerationPlan() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({ strategy: 'corte_vazamentos', description: '', amount: '', date: new Date().toISOString().split('T')[0] });
  const [simuladorAberto, setSimuladorAberto] = useState(false);
  const [rendaExtra, setRendaExtra] = useState('');
  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({ queryKey: ['acceleration-entries'], queryFn: () => entities.AccelerationPlan.list('-date'), enabled: !!user });
  const { data: profiles = [] } = useQuery({ queryKey: ['financial-profile'], queryFn: () => entities.FinancialProfile.list(), enabled: !!user });
  const profile = profiles[0];

  const createMutation = useMutation({
    mutationFn: (data) => entities.AccelerationPlan.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['acceleration-entries'] }); setDialogOpen(false); setNewEntry({ strategy: 'corte_vazamentos', description: '', amount: '', date: new Date().toISOString().split('T')[0] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => entities.AccelerationPlan.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['acceleration-entries'] }),
  });

  const handleSubmit = (e) => { e.preventDefault(); createMutation.mutate({ ...newEntry, amount: parseFloat(newEntry.amount) }); };
  const getStrategyInfo = (value) => strategies.find(s => s.value === value);
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const totalAcceleration = entries.reduce((s, e) => s + (e.amount || 0), 0);

  // ── Simulador de Impacto ──────────────────────────────────
  const extra          = parseFloat(rendaExtra) || 0;
  const aporteAtual    = profile?.monthly_contribution || 0;
  const metaReserva    = profile?.minimum_reserve_goal || 0;
  const reservaAtual   = profile?.current_reserve || 0;
  const faltaReserva   = Math.max(metaReserva - reservaAtual, 0);
  const mesesAtual     = aporteAtual > 0 ? Math.ceil(faltaReserva / aporteAtual) : 0;
  const mesesComExtra  = (aporteAtual + extra) > 0 ? Math.ceil(faltaReserva / (aporteAtual + extra)) : 0;
  const mesesEconomizados = Math.max(mesesAtual - mesesComExtra, 0);

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#C9A84C]/15 rounded-lg"><Rocket className="w-5 h-5 text-[#C9A84C]" /></div>
              <div><h1 className="text-2xl font-bold text-slate-900">Plano de Aceleração</h1><p className="text-slate-500 text-sm mt-1">Acelere sua reserva com estratégias extras em 90 dias</p></div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button className="bg-slate-900 hover:bg-slate-800"><Plus className="w-4 h-4 mr-2" />Registrar Valor</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar Aceleração</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div><Label>Estratégia</Label><Select value={newEntry.strategy} onValueChange={(v) => setNewEntry({...newEntry, strategy: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{strategies.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Descrição</Label><Textarea value={newEntry.description} onChange={(e) => setNewEntry({...newEntry, description: e.target.value})} rows={2} style={{fontSize:'16px'}} /></div>
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={newEntry.amount} onChange={(e) => setNewEntry({...newEntry, amount: e.target.value})} required style={{fontSize:'16px'}} /></div>
                  <div><Label>Data</Label><Input type="date" value={newEntry.date} onChange={(e) => setNewEntry({...newEntry, date: e.target.value})} required style={{fontSize:'16px'}} /></div>
                  <Button type="submit" className="w-full h-12 bg-slate-900 hover:bg-slate-800" disabled={createMutation.isPending}>{createMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {totalAcceleration > 0 && (
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-6 text-white">
              <div className="flex items-start gap-4"><div className="p-3 bg-white/20 rounded-2xl"><TrendingUp className="w-6 h-6" /></div><div><p className="text-emerald-100 mb-1">Total Acelerado</p><p className="text-3xl font-bold">{fmt(totalAcceleration)}</p><p className="text-emerald-100 mt-1">{entries.length} {entries.length === 1 ? 'ação registrada' : 'ações registradas'}</p></div></div>
            </div>
          )}

          {/* ── Simulador de Impacto ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#C9A84C]" />
                <h2 className="font-semibold text-slate-900">Simulador de Impacto</h2>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSimuladorAberto(!simuladorAberto)}>{simuladorAberto ? 'Fechar' : 'Abrir'}</Button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Veja quantos meses você economiza somando uma renda extra ao seu aporte mensal.</p>

            {simuladorAberto && (
              <div className="space-y-4">
                {!profile ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                    Configure primeiro seu aporte mensal e sua meta de reserva (em "Pague-se Primeiro" e "Meta de Reserva") para usar o simulador.
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Quanto deseja ganhar a mais por mês? (R$)</Label>
                      <Input type="number" placeholder="0,00" value={rendaExtra} onChange={(e) => setRendaExtra(e.target.value)} className="mt-1 h-11" style={{fontSize:'16px'}} />
                    </div>
                    {extra > 0 && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 rounded-xl p-4">
                            <h3 className="font-semibold text-slate-900 text-sm mb-3">Sem renda extra</h3>
                            <p className="text-xs text-slate-500">Aporte mensal</p>
                            <p className="text-xl font-bold text-slate-900">{fmt(aporteAtual)}</p>
                            <p className="text-xs text-slate-500 mt-2">Tempo até a meta</p>
                            <p className="text-xl font-bold text-slate-900">{mesesAtual} {mesesAtual === 1 ? 'mês' : 'meses'}</p>
                          </div>
                          <div className="bg-[#C9A84C]/10 rounded-xl p-4 border-2 border-[#C9A84C]/30">
                            <h3 className="font-semibold text-slate-900 text-sm mb-3">Com renda extra</h3>
                            <p className="text-xs text-slate-600">Aporte mensal</p>
                            <p className="text-xl font-bold text-slate-900">{fmt(aporteAtual + extra)}</p>
                            <p className="text-xs text-slate-600 mt-2">Tempo até a meta</p>
                            <p className="text-xl font-bold text-slate-900">{mesesComExtra} {mesesComExtra === 1 ? 'mês' : 'meses'}</p>
                          </div>
                        </div>
                        {mesesEconomizados > 0 && (
                          <div className="bg-slate-900 rounded-xl p-4 text-center">
                            <p className="text-slate-300 text-sm mb-1">Impacto total</p>
                            <p className="text-2xl font-bold text-[#C9A84C]">{mesesEconomizados} {mesesEconomizados === 1 ? 'mês' : 'meses'} mais rápido!</p>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {strategies.map(s => {
              const total = entries.filter(e => e.strategy === s.value).reduce((sum, e) => sum + (e.amount || 0), 0);
              return <div key={s.value} className="bg-white rounded-2xl border border-slate-200 p-5"><div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", s.color)}><s.icon className="w-5 h-5" /></div><p className="text-xs text-slate-500 mb-1">{s.label}</p><p className="text-xl font-bold text-slate-900">{fmt(total)}</p></div>;
            })}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-100"><h3 className="font-semibold text-slate-900">Histórico de Acelerações</h3></div>
            <div className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <div className="p-8 text-center text-slate-500"><Rocket className="w-10 h-10 mx-auto mb-3 text-slate-300" /><p className="text-sm">Nenhuma aceleração registrada ainda.</p></div>
              ) : entries.map((entry) => {
                const info = getStrategyInfo(entry.strategy);
                return (
                  <div key={entry.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", info?.color)}>{info && <info.icon className="w-4 h-4" />}</div>
                    <div className="flex-1 min-w-0"><p className="font-medium text-slate-900 text-sm truncate">{entry.description || info?.label}</p><p className="text-xs text-slate-500">{info?.label}</p></div>
                    <div className="text-right flex-shrink-0"><p className="font-semibold text-emerald-600 text-sm">+{fmt(entry.amount)}</p><p className="text-xs text-slate-400">{entry.date && new Date(entry.date).toLocaleDateString('pt-BR')}</p></div>
                    <button onClick={() => deleteMutation.mutate(entry.id)} className="p-2 hover:bg-red-100 rounded-lg text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AccessControl>
  );
}
