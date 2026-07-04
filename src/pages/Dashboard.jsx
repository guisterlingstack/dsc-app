import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import {
  Search, PiggyBank, Target, Landmark, CalendarCheck,
  Rocket, AlertCircle, Plus, Zap, Pencil, Trash2,
  Calculator, ClipboardCheck, Wallet
} from 'lucide-react';
import ReserveProgress from '@/components/dashboard/ReserveProgress';
import NextAction from '@/components/dashboard/NextAction';
import ActionCard from '@/components/ui/ActionCard';
import StatCard from '@/components/ui/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { format, startOfWeek } from 'date-fns';

// ─── Semáforo resumido ────────────────────────────────────
const SEMAFORO_CFG = {
  verde:    { dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  amarelo:  { dot: 'bg-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700' },
  vermelho: { dot: 'bg-red-500',     bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700' },
};

function SemaforoResumo({ checkin }) {
  if (!checkin) return null;
  const ess = checkin.semaforo_essenciais || 'verde';
  const est = checkin.semaforo_estilo_vida || 'verde';
  const worst = ess === 'vermelho' || est === 'vermelho' ? 'vermelho'
    : ess === 'amarelo' || est === 'amarelo' ? 'amarelo' : 'verde';
  const cfg = SEMAFORO_CFG[worst];

  return (
    <div className={cn('rounded-2xl border p-4 flex items-center gap-3', cfg.bg, cfg.border)}>
      <div className={cn('w-3 h-3 rounded-full flex-shrink-0', cfg.dot)} />
      <div>
        <div className={cn('text-sm font-medium', cfg.text)}>
          {worst === 'verde' ? 'Semana no verde ✓' : worst === 'amarelo' ? 'Atenção nesta semana' : 'Alerta — veja o Check Semanal'}
        </div>
        <div className="text-xs text-slate-500 flex gap-3 mt-0.5">
          <span>Essenciais: <span className={cn('font-medium', SEMAFORO_CFG[ess].text)}>{ess}</span></span>
          <span>Estilo de Vida: <span className={cn('font-medium', SEMAFORO_CFG[est].text)}>{est}</span></span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [newContribution, setNewContribution] = useState({
    amount: '', date: new Date().toISOString().split('T')[0], notes: ''
  });
  const [editContribution, setEditContribution] = useState({ amount: '', date: '', notes: '' });

  const { data: profiles = [], isLoading: profileLoading } = useQuery({
    queryKey: ['financial-profile'],
    queryFn: () => entities.FinancialProfile.list(),
    enabled: !!user,
  });

  const { data: bankChecklist = [] } = useQuery({
    queryKey: ['bank-checklist'],
    queryFn: () => entities.BankChecklist.list(),
    enabled: !!user,
  });

  const { data: leakages = [] } = useQuery({
    queryKey: ['leakages'],
    queryFn: () => entities.LeakageExpense.list(),
    enabled: !!user,
  });

  const { data: contributions = [] } = useQuery({
    queryKey: ['contributions'],
    queryFn: () => entities.MonthlyContribution.list(),
    enabled: !!user,
  });

  const { data: weeklyCheckins = [] } = useQuery({
    queryKey: ['weekly-checkins'],
    queryFn: () => entities.WeeklyCheckin.list('-week_start_date'),
    enabled: !!user,
  });

  const createContributionMutation = useMutation({
    mutationFn: (data) => entities.MonthlyContribution.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
      setContributionDialogOpen(false);
      setNewContribution({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
    },
  });

  const updateContributionMutation = useMutation({
    mutationFn: ({ id, data }) => entities.MonthlyContribution.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
      setEditDialogOpen(false);
      setSelectedContribution(null);
    },
  });

  const deleteContributionMutation = useMutation({
    mutationFn: (id) => entities.MonthlyContribution.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
      setDeleteDialogOpen(false);
      setSelectedContribution(null);
    },
  });

  const financialProfile = profiles[0];
  const userBankChecklist = bankChecklist[0];
  const totalLeakages = leakages.reduce((s, l) => s + (l.amount || 0), 0);
  const totalContributions = contributions.reduce((s, c) => s + (c.amount || 0), 0);

  // Checkin da semana atual
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const currentCheckin = weeklyCheckins.find(c => c.week_start_date === weekStart);

  // Prazo dinâmico — calculado aqui também para passar ao ReserveProgress
  const currentReserve = financialProfile?.current_reserve || totalContributions;
  const reserveGoal = financialProfile?.minimum_reserve_goal || 0;
  const monthlyContribution = financialProfile?.monthly_contribution || 0;

  const getNextAction = () => {
    if (!financialProfile?.monthly_income) return { description: 'Defina sua renda mensal e quanto vai poupar.', page: 'PayYourselfFirst', buttonText: 'Definir Poupança' };
    if (!financialProfile?.fixed_expenses) return { description: 'Calcule sua meta de reserva baseada nas suas despesas fixas.', page: 'ReserveGoal', buttonText: 'Calcular Meta' };
    if (!leakages.length) return { description: 'Identifique os vazamentos financeiros que drenam seu dinheiro.', page: 'LeakageDetector', buttonText: 'Detectar Vazamentos' };
    if (!userBankChecklist?.separate_account_created || !userBankChecklist?.automatic_transfer_configured) {
      return { description: 'Configure sua conta bancária para automatizar as transferências.', page: 'BankSetup', buttonText: 'Configurar Conta' };
    }
    if (!currentCheckin) return { description: 'Faça seu check-in semanal para monitorar seus gastos.', page: 'WeeklyRoutine', buttonText: 'Fazer Check-in' };
    return { description: 'Acelere sua reserva com estratégias extras de economia.', page: 'AccelerationPlan', buttonText: 'Acelerar Reserva' };
  };

  const getChecklistProgress = () => {
    if (!userBankChecklist) return { completed: 0, total: 4 };
    const items = [
      userBankChecklist.separate_account_created,
      userBankChecklist.no_debit_card,
      userBankChecklist.automatic_transfer_configured,
      userBankChecklist.transfer_date_defined
    ];
    return { completed: items.filter(Boolean).length, total: 4 };
  };

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const handleContributionSubmit = (e) => {
    e.preventDefault();
    createContributionMutation.mutate({
      amount: parseFloat(newContribution.amount),
      date: newContribution.date,
      month: newContribution.date.substring(0, 7),
      source: 'aporte_mensal',
      notes: newContribution.notes,
    });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateContributionMutation.mutate({
      id: selectedContribution.id,
      data: {
        amount: parseFloat(editContribution.amount),
        date: editContribution.date,
        month: editContribution.date.substring(0, 7),
        notes: editContribution.notes,
      },
    });
  };

  if (!user) return null;

  const checklistProgress = getChecklistProgress();
  const lastContribution = contributions[0];
  const largestContribution = contributions.length > 0
    ? Math.max(...contributions.map(c => c.amount || 0)) : 0;

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Olá, {user.display_name || user.full_name?.split(' ')[0] || 'Usuário'}!
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Acompanhe seu progresso na construção da reserva de emergência.
            </p>
          </div>

          {/* Reserve Progress */}
          <div className="space-y-3">
            <ReserveProgress
              current={currentReserve}
              goal={reserveGoal}
              monthlyContribution={monthlyContribution}
            />
            <div className="flex justify-center">
              <Button
                onClick={() => setContributionDialogOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 h-12 px-6"
              >
                <Plus className="w-5 h-5 mr-2" />
                Registrar Aporte
              </Button>
            </div>
          </div>

          {/* Semáforo da semana */}
          <SemaforoResumo checkin={currentCheckin} />

          {/* Next Action */}
          <NextAction action={getNextAction()} />

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard title="Aporte Mensal" value={fmt(financialProfile?.monthly_contribution)}
              subtitle={financialProfile?.savings_percentage ? `${financialProfile.savings_percentage}% da renda` : 'Não definido'}
              icon={PiggyBank} />
            <StatCard title="Vazamentos" value={fmt(totalLeakages)}
              subtitle={`${leakages.length} gastos registrados`}
              icon={AlertCircle} variant={totalLeakages > 0 ? 'warning' : 'default'} />
            <StatCard title="Check-ins" value={`${weeklyCheckins.length}/12`}
              subtitle="Semanas completas" icon={CalendarCheck} />
          </div>

          {/* Histórico de aportes */}
          {contributions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Histórico da Reserva</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-xs text-emerald-700 mb-1">Total Acumulado</p>
                  <p className="text-xl font-bold text-emerald-900">{fmt(totalContributions)}</p>
                </div>
                {lastContribution && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Último Aporte</p>
                    <p className="text-xl font-bold text-slate-900">{fmt(lastContribution.amount)}</p>
                    <p className="text-xs text-slate-500">{new Date(lastContribution.date).toLocaleDateString('pt-BR')}</p>
                  </div>
                )}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-600 mb-1">Maior Aporte</p>
                  <p className="text-xl font-bold text-slate-900">{fmt(largestContribution)}</p>
                </div>
              </div>
              <div className="space-y-2">
                {contributions.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">{fmt(c.amount)}</p>
                      {c.notes && <p className="text-xs text-slate-500 truncate">{c.notes}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-600">{new Date(c.date).toLocaleDateString('pt-BR')}</p>
                      {c.source === 'aceleracao' && <span className="text-xs text-emerald-600">⚡ Aceleração</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => {
                        setSelectedContribution(c);
                        setEditContribution({ amount: c.amount.toString(), date: c.date, notes: c.notes || '' });
                        setEditDialogOpen(true);
                      }} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => {
                        setSelectedContribution(c);
                        setDeleteDialogOpen(true);
                      }} className="p-2 hover:bg-red-100 rounded-lg text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Módulos */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-3">Módulos do Plano</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ActionCard title="Detector de Vazamentos" description={leakages.length ? `${leakages.length} vazamentos registrados` : 'Identifique seus gastos invisíveis'} icon={Search} href="LeakageDetector" completed={leakages.length > 0} />
              <ActionCard title="Pague-se Primeiro" description={financialProfile?.monthly_contribution ? fmt(financialProfile.monthly_contribution) + '/mês' : 'Defina seu aporte mensal'} icon={PiggyBank} href="PayYourselfFirst" completed={!!financialProfile?.monthly_contribution} />
              <ActionCard title="Meta de Reserva" description={financialProfile?.minimum_reserve_goal ? `Meta: ${fmt(financialProfile.minimum_reserve_goal)}` : 'Calcule sua meta'} icon={Target} href="ReserveGoal" completed={!!financialProfile?.minimum_reserve_goal} />
              <ActionCard title="Config. das 3 Contas" description={`${checklistProgress.completed}/${checklistProgress.total} itens concluídos`} icon={Landmark} href="BankSetup" completed={checklistProgress.completed === checklistProgress.total} />
              <ActionCard title="Calculadora 50/30/20" description="Calcule sua divisão ideal de renda" icon={Calculator} href="BudgetCalculator" completed={!!financialProfile?.savings_percentage} />
              <ActionCard title="Check Semanal" description="Monitore seus gastos com semáforo" icon={CalendarCheck} href="WeeklyRoutine" />
              <ActionCard title="Fechamento Mensal" description="Feche o mês e avalie seu progresso" icon={ClipboardCheck} href="MonthlyClosing" />
              <ActionCard title="Usar a Reserva?" description="Decida com clareza quando usar" icon={Wallet} href="ReserveUsage" />
              <ActionCard title="Plano de Aceleração" description="Acelere sua reserva em 90 dias" icon={Rocket} href="AccelerationPlan" />
            </div>
          </div>
        </div>
      </div>

      {/* Dialog — Novo Aporte */}
      <Dialog open={contributionDialogOpen} onOpenChange={setContributionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Aporte na Reserva</DialogTitle></DialogHeader>
          <form onSubmit={handleContributionSubmit} className="space-y-4 mt-2">
            <div>
              <Label>Valor do aporte (R$) *</Label>
              <Input type="number" step="0.01" placeholder="0,00" value={newContribution.amount}
                onChange={(e) => setNewContribution({ ...newContribution, amount: e.target.value })}
                required className="mt-1 h-12" style={{ fontSize: '16px' }} />
            </div>
            <div>
              <Label>Data do aporte</Label>
              <Input type="date" value={newContribution.date}
                onChange={(e) => setNewContribution({ ...newContribution, date: e.target.value })}
                required className="mt-1 h-12" style={{ fontSize: '16px' }} />
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea placeholder="Ex: 13º salário, freela..." value={newContribution.notes}
                onChange={(e) => setNewContribution({ ...newContribution, notes: e.target.value })} rows={2} />
            </div>
            <Button type="submit" className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
              disabled={createContributionMutation.isPending}>
              {createContributionMutation.isPending ? 'Salvando...' : '✔ Confirmar Aporte'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog — Editar Aporte */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Aporte</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div>
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" value={editContribution.amount}
                onChange={(e) => setEditContribution({ ...editContribution, amount: e.target.value })}
                required className="mt-1 h-12" style={{ fontSize: '16px' }} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={editContribution.date}
                onChange={(e) => setEditContribution({ ...editContribution, date: e.target.value })}
                required className="mt-1 h-12" />
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={editContribution.notes}
                onChange={(e) => setEditContribution({ ...editContribution, notes: e.target.value })} rows={2} />
            </div>
            <Button type="submit" className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
              disabled={updateContributionMutation.isPending}>
              {updateContributionMutation.isPending ? 'Salvando...' : '✔ Salvar Alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog — Excluir */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aporte</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o aporte de <strong>{selectedContribution && fmt(selectedContribution.amount)}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteContributionMutation.mutate(selectedContribution?.id)}
              className="bg-red-600 hover:bg-red-700" disabled={deleteContributionMutation.isPending}>
              {deleteContributionMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccessControl>
  );
}
