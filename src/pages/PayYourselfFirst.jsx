import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { PiggyBank, Check, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const savingsOptions = [
  { percentage: 1, label: 'Conservador', description: 'Ideal para começar com segurança' },
  { percentage: 5, label: 'Moderado', description: 'Equilíbrio entre conforto e progresso' },
  { percentage: 10, label: 'Agressivo', description: 'Acelere sua reserva rapidamente' },
];

export default function PayYourselfFirst() {
  const { user } = useAuth();
  const [income, setIncome] = useState('');
  const [selectedPercentage, setSelectedPercentage] = useState(null);
  const [customPercentage, setCustomPercentage] = useState('');
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery({ queryKey: ['financial-profile'], queryFn: () => entities.FinancialProfile.list(), enabled: !!user });
  const profile = profiles[0];

  useEffect(() => {
    if (profile) { setIncome(profile.monthly_income?.toString() || ''); setSelectedPercentage(profile.savings_percentage || null); }
  }, [profile?.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => profile?.id ? entities.FinancialProfile.update(profile.id, data) : entities.FinancialProfile.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financial-profile'] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const handleSave = () => {
    const percentage = selectedPercentage || parseFloat(customPercentage);
    const incomeValue = parseFloat(income);
    if (!incomeValue || !percentage) return;
    saveMutation.mutate({ monthly_income: incomeValue, savings_percentage: percentage, monthly_contribution: (incomeValue * percentage) / 100, plan_start_date: profile?.plan_start_date || new Date().toISOString().split('T')[0] });
  };

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const incomeValue = parseFloat(income) || 0;
  const contribution = incomeValue * (selectedPercentage || parseFloat(customPercentage) || 0) / 100;

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C9A84C]/15 rounded-lg flex-shrink-0"><PiggyBank className="w-5 h-5 text-[#C9A84C]" /></div>
            <div><h1 className="text-2xl font-bold text-slate-900">Pague-se Primeiro</h1><p className="text-slate-500 text-sm mt-1">Defina quanto você vai poupar todo mês antes de qualquer outro gasto</p></div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <Label className="text-base font-semibold">Qual é sua renda mensal líquida?</Label>
            <p className="text-sm text-slate-500 mb-4">O valor que cai na sua conta após todos os descontos</p>
            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">R$</span><Input type="number" placeholder="0,00" value={income} onChange={(e) => setIncome(e.target.value)} className="pl-12 h-14 text-lg" style={{fontSize:'16px'}} /></div>
          </div>
          {incomeValue > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <Label className="text-base font-semibold">Quanto você quer poupar?</Label>
              <p className="text-sm text-slate-500 mb-4">Escolha o percentual que se encaixa na sua realidade</p>
              <div className="space-y-3 mb-4">
                {savingsOptions.map((opt) => {
                  const val = (incomeValue * opt.percentage) / 100;
                  const isSelected = selectedPercentage === opt.percentage;
                  return (
                    <button key={opt.percentage} onClick={() => { setSelectedPercentage(opt.percentage); setCustomPercentage(''); }}
                      className={cn('w-full p-4 rounded-xl border-2 text-left transition-all', isSelected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300')}>
                      <div className="flex items-center justify-between">
                        <div><div className="flex items-center gap-2"><span className="text-2xl font-bold text-slate-900">{opt.percentage}%</span><span className="text-sm text-slate-500">{opt.label}</span></div><p className="text-xs text-slate-400">{opt.description}</p></div>
                        <div className="text-right"><p className="text-lg font-semibold text-slate-900">{fmt(val)}</p><p className="text-xs text-slate-400">por mês</p></div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <Label className="text-sm text-slate-600">Ou defina um percentual personalizado</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Input type="number" placeholder="Ex: 7" value={customPercentage} onChange={(e) => { setCustomPercentage(e.target.value); setSelectedPercentage(null); }} className="w-24 text-center" style={{fontSize:'16px'}} />
                  <span className="text-slate-500">%</span>
                  {customPercentage && <span className="text-slate-600 text-sm">= {fmt(incomeValue * parseFloat(customPercentage) / 100)}/mês</span>}
                </div>
              </div>
            </div>
          )}
          {(selectedPercentage || customPercentage) && (
            <div className="bg-emerald-600 rounded-2xl p-6 text-white flex gap-4">
              <div className="p-3 bg-white/20 rounded-xl flex-shrink-0"><Sparkles className="w-5 h-5" /></div>
              <div><h3 className="font-semibold mb-1">Seu Aporte Mensal</h3><p className="text-3xl font-bold mb-1">{fmt(contribution)}</p><p className="text-emerald-100 text-sm">{selectedPercentage || customPercentage}% da sua renda</p></div>
            </div>
          )}
          {(selectedPercentage || customPercentage) && income && (
            <Button onClick={handleSave} disabled={saveMutation.isPending} className={cn('w-full h-14 text-base', saved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800')}>
              {saved ? <><Check className="w-5 h-5 mr-2" />Salvo!</> : saveMutation.isPending ? 'Salvando...' : <>Confirmar Aporte <ArrowRight className="w-5 h-5 ml-2" /></>}
            </Button>
          )}
          <div className="bg-slate-100 rounded-2xl p-5 flex gap-3"><div className="p-2 bg-slate-200 rounded-lg flex-shrink-0"><PiggyBank className="w-5 h-5 text-slate-600" /></div><div><h4 className="font-semibold text-slate-900 mb-1">Como funciona?</h4><p className="text-slate-600 text-sm">Assim que receber seu salário, transfira esse valor para uma conta separada antes de pagar qualquer outra coisa.</p></div></div>
        </div>
      </div>
    </AccessControl>
  );
}
