import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { TrendingUp, Settings, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function ProgressBar({ title, spent, limit }) {
  const percentage = limit > 0 ? (spent / limit) * 100 : 0;
  const status = percentage <= 80 ? 'ok' : percentage <= 100 ? 'warning' : 'danger';
  const cfg = { ok: { border: 'border-emerald-200', bg: 'bg-emerald-500', text: 'text-emerald-600', label: 'Dentro do limite' }, warning: { border: 'border-amber-200', bg: 'bg-amber-500', text: 'text-amber-600', label: 'Atenção' }, danger: { border: 'border-red-200', bg: 'bg-red-500', text: 'text-red-600', label: 'Estourado' } }[status];
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  return (
    <div className={cn('bg-white rounded-2xl border-2 p-5', cfg.border)}>
      <div className="flex items-center justify-between mb-3"><div><h3 className="font-semibold text-slate-900 text-sm">{title}</h3><p className="text-xs text-slate-500">{fmt(spent)} / {fmt(limit)}</p></div><span className={cn('text-sm font-semibold', cfg.text)}>{percentage.toFixed(0)}%</span></div>
      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden mb-1"><div className={cn('h-full rounded-full transition-all', cfg.bg)} style={{width:`${Math.min(percentage,100)}%`}} /></div>
      <span className={cn('text-xs font-medium', cfg.text)}>{cfg.label}</span>
    </div>
  );
}

export default function SmartBudgetSystem() {
  const { user } = useAuth();
  const [formulaDialogOpen, setFormulaDialogOpen] = useState(false);
  const [formulaData, setFormulaData] = useState({ monthly_income: '', essential_percentage: 50, lifestyle_percentage: 30, future_percentage: 20 });
  const queryClient = useQueryClient();

  const { data: formulas = [] } = useQuery({ queryKey: ['budget-formula'], queryFn: () => entities.BudgetFormula.list(), enabled: !!user });
  const formula = formulas[0];
  const currentMonth = new Date().toISOString().substring(0, 7);
  const { data: expenses = [] } = useQuery({ queryKey: ['monthly-expenses', currentMonth], queryFn: () => entities.MonthlyExpense.filter({ month: currentMonth }), enabled: !!user });

  useEffect(() => {
    if (formula) setFormulaData({ monthly_income: formula.monthly_income?.toString() || '', essential_percentage: formula.essential_percentage || 50, lifestyle_percentage: formula.lifestyle_percentage || 30, future_percentage: formula.future_percentage || 20 });
  }, [formula?.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => formula?.id ? entities.BudgetFormula.update(formula.id, data) : entities.BudgetFormula.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budget-formula'] }); setFormulaDialogOpen(false); },
  });

  const handleSave = () => saveMutation.mutate({ monthly_income: parseFloat(formulaData.monthly_income), essential_percentage: parseInt(formulaData.essential_percentage), lifestyle_percentage: parseInt(formulaData.lifestyle_percentage), future_percentage: parseInt(formulaData.future_percentage) });

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const renda = formula?.monthly_income || 0;
  const essLimit = renda * (formula?.essential_percentage || 50) / 100;
  const estLimit = renda * (formula?.lifestyle_percentage || 30) / 100;
  const futLimit = renda * (formula?.future_percentage || 20) / 100;
  const essSpent = expenses.filter(e => e.category === 'essenciais').reduce((s, e) => s + e.amount, 0);
  const estSpent = expenses.filter(e => e.category === 'estilo_vida').reduce((s, e) => s + e.amount, 0);
  const futSpent = expenses.filter(e => e.category === 'futuro').reduce((s, e) => s + e.amount, 0);

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div><div className="flex items-center gap-3 mb-1"><div className="p-2 bg-purple-100 rounded-lg"><TrendingUp className="w-5 h-5 text-purple-600" /></div><h1 className="text-2xl font-bold text-slate-900">Sistema de Orçamento</h1></div><p className="text-slate-500 text-sm">Gerencie seu orçamento mensal de forma inteligente</p></div>
            <Dialog open={formulaDialogOpen} onOpenChange={setFormulaDialogOpen}>
              <DialogTrigger asChild><Button variant="outline"><Settings className="w-4 h-4 mr-2" />Configurar</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Configurar Orçamento</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div><Label>Renda Mensal (R$)</Label><Input type="number" placeholder="0,00" value={formulaData.monthly_income} onChange={(e) => setFormulaData({...formulaData, monthly_income: e.target.value})} style={{fontSize:'16px'}} /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Essenciais (%)</Label><Input type="number" value={formulaData.essential_percentage} onChange={(e) => setFormulaData({...formulaData, essential_percentage: e.target.value})} style={{fontSize:'16px'}} /></div>
                    <div><Label>Estilo de Vida (%)</Label><Input type="number" value={formulaData.lifestyle_percentage} onChange={(e) => setFormulaData({...formulaData, lifestyle_percentage: e.target.value})} style={{fontSize:'16px'}} /></div>
                    <div><Label>Futuro (%)</Label><Input type="number" value={formulaData.future_percentage} onChange={(e) => setFormulaData({...formulaData, future_percentage: e.target.value})} style={{fontSize:'16px'}} /></div>
                  </div>
                  <Button onClick={handleSave} className="w-full bg-purple-600 hover:bg-purple-700 h-12" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {formula ? (
            <>
              <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between">
                <div><p className="text-slate-400 text-xs mb-1">Renda Mensal</p><p className="text-2xl font-bold">{fmt(renda)}</p></div>
                <div className="flex items-center gap-4">
                  <div className="text-center"><p className="text-2xl font-bold">{formula.essential_percentage}</p><p className="text-xs text-slate-400">Essenciais</p></div>
                  <span className="text-slate-600 text-xl">/</span>
                  <div className="text-center"><p className="text-2xl font-bold">{formula.lifestyle_percentage}</p><p className="text-xs text-slate-400">Estilo de Vida</p></div>
                  <span className="text-slate-600 text-xl">/</span>
                  <div className="text-center"><p className="text-2xl font-bold">{formula.future_percentage}</p><p className="text-xs text-slate-400">Futuro</p></div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ProgressBar title="Essenciais" spent={essSpent} limit={essLimit} />
                <ProgressBar title="Estilo de Vida" spent={estSpent} limit={estLimit} />
                <ProgressBar title="Futuro" spent={futSpent} limit={futLimit} />
              </div>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
              <Settings className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <h3 className="font-semibold text-amber-900 mb-2">Configure seu orçamento</h3>
              <p className="text-amber-700 text-sm mb-4">Defina sua renda mensal e a fórmula de distribuição para começar</p>
              <Button onClick={() => setFormulaDialogOpen(true)} className="bg-amber-600 hover:bg-amber-700">Configurar Agora</Button>
            </div>
          )}
        </div>
      </div>
    </AccessControl>
  );
}
