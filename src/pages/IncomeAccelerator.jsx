import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { Rocket, Plus, Trash2, TrendingUp, Clock, Target, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const categoryLabels = { freelance: 'Freelance', venda_produtos: 'Venda de Produtos', servicos: 'Serviços', investimento_tempo: 'Investimento de Tempo', outros: 'Outros' };
const statusConfig = { planejando: { label: 'Planejando', cls: 'bg-slate-100 text-slate-700' }, em_andamento: { label: 'Em Andamento', cls: 'bg-blue-100 text-blue-700' }, pausada: { label: 'Pausada', cls: 'bg-amber-100 text-amber-700' }, concluida: { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-700' } };

export default function IncomeAccelerator() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [extraIncome, setExtraIncome] = useState('');
  const [form, setForm] = useState({ title: '', description: '', category: 'freelance', expected_monthly_income: '', actual_monthly_income: '', status: 'planejando', started_date: new Date().toISOString().split('T')[0] });
  const queryClient = useQueryClient();

  const { data: initiatives = [] } = useQuery({ queryKey: ['extra-income-initiatives'], queryFn: () => entities.ExtraIncomeInitiative.list('-created_at'), enabled: !!user });
  const { data: financialProfiles = [] } = useQuery({ queryKey: ['financial-profile'], queryFn: () => entities.FinancialProfile.list(), enabled: !!user });
  const financialProfile = financialProfiles[0];

  const createMutation = useMutation({ mutationFn: (data) => entities.ExtraIncomeInitiative.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['extra-income-initiatives'] }); setDialogOpen(false); setForm({ title: '', description: '', category: 'freelance', expected_monthly_income: '', actual_monthly_income: '', status: 'planejando', started_date: new Date().toISOString().split('T')[0] }); } });
  const deleteMutation = useMutation({ mutationFn: (id) => entities.ExtraIncomeInitiative.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['extra-income-initiatives'] }) });

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const totalActualIncome = initiatives.reduce((s, i) => s + (i.actual_monthly_income || 0), 0);
  const extra = parseFloat(extraIncome) || 0;
  const currentContrib = financialProfile?.monthly_contribution || 0;
  const reserveGoal = financialProfile?.minimum_reserve_goal || 0;
  const currentReserve = financialProfile?.current_reserve || 0;
  const monthsCurrent = currentContrib > 0 ? Math.ceil((reserveGoal - currentReserve) / currentContrib) : 0;
  const monthsNew = (currentContrib + extra) > 0 ? Math.ceil((reserveGoal - currentReserve) / (currentContrib + extra)) : 0;

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div><div className="flex items-center gap-3 mb-1"><div className="p-2 bg-indigo-100 rounded-lg"><Rocket className="w-5 h-5 text-indigo-600" /></div><h1 className="text-2xl font-bold text-slate-900">Acelerador de Renda</h1></div><p className="text-slate-500 text-sm">Acelere seus objetivos com renda adicional</p></div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" />Nova Iniciativa</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Registrar Iniciativa</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div><Label>Título</Label><Input placeholder="Ex: Freelance de design" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} style={{fontSize:'16px'}} /></div>
                  <div><Label>Descrição</Label><Textarea placeholder="Descreva sua iniciativa..." value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={2} style={{fontSize:'16px'}} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Categoria</Label><Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusConfig).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Renda Esperada (R$/mês)</Label><Input type="number" value={form.expected_monthly_income} onChange={(e) => setForm({...form, expected_monthly_income: e.target.value})} style={{fontSize:'16px'}} /></div>
                    <div><Label>Renda Real (R$/mês)</Label><Input type="number" value={form.actual_monthly_income} onChange={(e) => setForm({...form, actual_monthly_income: e.target.value})} style={{fontSize:'16px'}} /></div>
                  </div>
                  <Button onClick={() => createMutation.mutate({ ...form, expected_monthly_income: parseFloat(form.expected_monthly_income) || 0, actual_monthly_income: parseFloat(form.actual_monthly_income) || 0 })} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700" disabled={createMutation.isPending || !form.title}>{createMutation.isPending ? 'Salvando...' : 'Salvar Iniciativa'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-slate-900">Simulador de Impacto</h2><Button variant="outline" size="sm" onClick={() => setSimulatorOpen(!simulatorOpen)}>{simulatorOpen ? 'Fechar' : 'Abrir'}</Button></div>
            {simulatorOpen && (
              <div className="space-y-4">
                <div><Label>Quanto deseja ganhar a mais por mês? (R$)</Label><Input type="number" placeholder="0,00" value={extraIncome} onChange={(e) => setExtraIncome(e.target.value)} className="mt-1 h-11" style={{fontSize:'16px'}} /></div>
                {extra > 0 && financialProfile && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4"><h3 className="font-semibold text-slate-900 text-sm mb-3">Sem Renda Extra</h3><div><p className="text-xs text-slate-500">Aporte mensal</p><p className="text-xl font-bold text-slate-900">{fmt(currentContrib)}</p></div><div className="mt-2"><p className="text-xs text-slate-500">Tempo até meta</p><p className="text-xl font-bold text-slate-900">{monthsCurrent} meses</p></div></div>
                    <div className="bg-emerald-50 rounded-xl p-4 border-2 border-emerald-200"><h3 className="font-semibold text-emerald-900 text-sm mb-3">Com Renda Extra</h3><div><p className="text-xs text-emerald-700">Aporte mensal</p><p className="text-xl font-bold text-emerald-900">{fmt(currentContrib + extra)}</p></div><div className="mt-2"><p className="text-xs text-emerald-700">Tempo até meta</p><p className="text-xl font-bold text-emerald-900">{monthsNew} meses</p></div></div>
                  </div>
                )}
                {monthsCurrent - monthsNew > 0 && <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 text-center"><p className="font-semibold text-indigo-900 text-sm mb-1">Impacto Total</p><p className="text-2xl font-bold text-indigo-900">{monthsCurrent - monthsNew} meses mais rápido!</p></div>}
              </div>
            )}
          </div>

          {initiatives.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center justify-between">
                <div><p className="text-xs text-emerald-700 mb-1">Renda Extra Total Atual</p><p className="text-2xl font-bold text-emerald-900">{fmt(totalActualIncome)}</p></div>
                <TrendingUp className="w-10 h-10 text-emerald-500" />
              </div>
              {initiatives.map((init) => (
                <div key={init.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold text-slate-900">{init.title}</h3><span className={cn('text-xs px-2 py-0.5 rounded-full', statusConfig[init.status]?.cls)}>{statusConfig[init.status]?.label}</span><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{categoryLabels[init.category]}</span></div>
                    <button onClick={() => deleteMutation.mutate(init.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-red-500 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {init.description && <p className="text-sm text-slate-600 mb-3">{init.description}</p>}
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-slate-500 mb-1">Renda Esperada</p><p className="font-semibold text-slate-900">{fmt(init.expected_monthly_income)}</p></div>
                    <div><p className="text-xs text-slate-500 mb-1">Renda Real</p><p className="font-semibold text-emerald-600">{fmt(init.actual_monthly_income)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center">
              <Rocket className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Nenhuma iniciativa cadastrada</h3>
              <p className="text-slate-600 text-sm mb-5">Comece registrando suas ideias e projetos de renda extra</p>
              <Button onClick={() => setDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" />Criar Primeira Iniciativa</Button>
            </div>
          )}
        </div>
      </div>
    </AccessControl>
  );
}
