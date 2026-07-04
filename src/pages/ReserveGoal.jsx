import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { Target, Shield, Zap, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function ReserveGoal() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState('');
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery({ queryKey: ['financial-profile'], queryFn: () => entities.FinancialProfile.list(), enabled: !!user });
  const { data: contributions = [] } = useQuery({ queryKey: ['contributions'], queryFn: () => entities.MonthlyContribution.list(), enabled: !!user });

  const profile = profiles[0];
  const totalContributions = contributions.reduce((s, c) => s + (c.amount || 0), 0);
  const currentReserve = profile?.current_reserve || totalContributions;

  useEffect(() => { if (profile?.fixed_expenses) setExpenses(profile.fixed_expenses.toString()); }, [profile?.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => profile?.id ? entities.FinancialProfile.update(profile.id, data) : entities.FinancialProfile.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financial-profile'] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const expensesValue = parseFloat(expenses) || 0;
  const minimumGoal = expensesValue * 3;
  const idealGoal = expensesValue * 6;
  const progressPercentage = minimumGoal > 0 ? (currentReserve / minimumGoal) * 100 : 0;
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const handleSave = () => {
    if (!expensesValue) return;
    saveMutation.mutate({ fixed_expenses: expensesValue, minimum_reserve_goal: minimumGoal, ideal_reserve_goal: idealGoal, current_reserve: currentReserve });
  };

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C9A84C]/15 rounded-lg flex-shrink-0"><Target className="w-5 h-5 text-[#C9A84C]" /></div>
            <div><h1 className="text-2xl font-bold text-slate-900">Meta de Reserva</h1><p className="text-slate-500 text-sm mt-1">Calcule sua meta personalizada baseada nas suas despesas fixas</p></div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <Label className="text-base font-semibold">Total das suas despesas fixas mensais</Label>
            <p className="text-sm text-slate-500 mb-4">Aluguel, contas, alimentação, transporte e outros gastos essenciais</p>
            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">R$</span><Input type="number" placeholder="0,00" value={expenses} onChange={(e) => setExpenses(e.target.value)} className="pl-12 h-14 text-lg" style={{fontSize:'16px'}} /></div>
          </div>

          {expensesValue > 0 && (
            <>
              <div className="bg-slate-900 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-white/10 rounded-lg"><Shield className="w-5 h-5" /></div><div><p className="text-slate-400 text-xs">Meta Mínima (3x despesas)</p><p className="text-3xl font-bold">{fmt(minimumGoal)}</p><p className="text-slate-400 text-xs mt-1">Protege você por 3 meses sem renda</p></div></div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="flex justify-between text-xs text-slate-400 mb-2"><span>Seu progresso</span><span className="text-emerald-400 font-semibold">{Math.min(progressPercentage, 100).toFixed(0)}%</span></div>
                  <div className="h-2.5 bg-white/10 rounded-full overflow-hidden mb-2"><div className="h-full bg-emerald-400 rounded-full transition-all" style={{width:`${Math.min(progressPercentage, 100)}%`}} /></div>
                  <div className="flex justify-between text-xs text-slate-400"><span>Atual: {fmt(currentReserve)}</span><span>Faltam: {fmt(Math.max(0, minimumGoal - currentReserve))}</span></div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex gap-4">
                <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0"><Zap className="w-5 h-5 text-emerald-600" /></div>
                <div><p className="text-xs text-slate-500 mb-1">Meta Ideal (6x despesas)</p><p className="text-2xl font-bold text-slate-900">{fmt(idealGoal)}</p><p className="text-emerald-700 text-xs mt-1">Segurança total por 6 meses</p></div>
              </div>

              {profile?.monthly_contribution > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-sm text-slate-500">Com seu aporte de {fmt(profile.monthly_contribution)}/mês você alcança a meta mínima em aproximadamente</p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">~{Math.ceil((minimumGoal - currentReserve) / profile.monthly_contribution)} meses <span className="text-emerald-600 text-sm font-normal">no ritmo atual</span></p>
                </div>
              )}

              <Button onClick={handleSave} disabled={saveMutation.isPending} className={cn('w-full h-14 text-base', saved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800')}>
                {saved ? <><Check className="w-5 h-5 mr-2" />Meta salva!</> : saveMutation.isPending ? 'Salvando...' : <>Definir como Meta <ArrowRight className="w-5 h-5 ml-2" /></>}
              </Button>
            </>
          )}

          <div className="bg-slate-100 rounded-2xl p-5 flex gap-3"><div className="p-2 bg-slate-200 rounded-lg flex-shrink-0"><Target className="w-5 h-5 text-slate-600" /></div><div><h4 className="font-semibold text-slate-900 mb-1">Por que 3 meses?</h4><p className="text-slate-600 text-sm">Uma reserva de 3 meses cobre a maioria das emergências: perda de emprego, problemas de saúde ou reparos urgentes.</p></div></div>
        </div>
      </div>
    </AccessControl>
  );
}
