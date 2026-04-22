import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { adminEntities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import { Users, UserCheck, Clock, UserX, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import UserStatusBadge from '@/components/admin/UserStatusBadge';

function StatsCard({ title, value, icon: Icon, variant = 'default' }) {
  const variants = { default: 'bg-white border-slate-200', active: 'bg-emerald-50 border-emerald-200', pending: 'bg-amber-50 border-amber-200', blocked: 'bg-red-50 border-red-200' };
  const iconColors = { default: 'bg-slate-100 text-slate-600', active: 'bg-emerald-100 text-emerald-600', pending: 'bg-amber-100 text-amber-600', blocked: 'bg-red-100 text-red-600' };
  return (
    <div className={`rounded-2xl border p-5 ${variants[variant]}`}>
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-medium text-slate-500 mb-1">{title}</p><p className="text-3xl font-bold text-slate-900">{value}</p></div>
        <div className={`p-2.5 rounded-xl ${iconColors[variant]}`}><Icon className="w-5 h-5" /></div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => adminEntities.listUsers('-created_at'),
    enabled: !!user && ['admin','admin_master'].includes(user.role),
  });

  if (!user || user.role !== 'admin') return null;

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status_conta === 'ativa').length;
  const pendingUsers = users.filter(u => u.status_conta === 'pendente').length;
  const blockedUsers = users.filter(u => u.status_conta === 'bloqueada').length;
  const recentUsers = users.slice(0, 5);

  return (
    <div className="p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1"><div className="p-2 bg-slate-900 rounded-lg"><Shield className="w-4 h-4 text-white" /></div><h1 className="text-2xl font-bold text-slate-900">Painel Administrativo</h1></div>
            <p className="text-slate-500 text-sm">Controle de acesso e gestão de usuários da mentoria</p>
          </div>
          <Button onClick={() => navigate(createPageUrl('AdminUsers'))} className="bg-slate-900 hover:bg-slate-800">
            Ver Todos <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatsCard title="Total de Usuários" value={totalUsers} icon={Users} />
            <StatsCard title="Usuários Ativos" value={activeUsers} icon={UserCheck} variant="active" />
            <StatsCard title="Pendentes" value={pendingUsers} icon={Clock} variant="pending" />
            <StatsCard title="Bloqueados" value={blockedUsers} icon={UserX} variant="blocked" />
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Últimos Cadastros</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('AdminUsers'))}>Ver todos</Button>
          </div>
          <div className="divide-y divide-slate-100">
            {isLoading ? <div className="p-4"><Skeleton className="h-12 w-full" /></div>
            : recentUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-500"><Users className="w-10 h-10 mx-auto mb-3 text-slate-300" /><p className="text-sm">Nenhum usuário cadastrado ainda</p></div>
            ) : recentUsers.map((u) => (
              <div key={u.id} className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-sm font-semibold text-slate-600 flex-shrink-0">{(u.full_name || u.email || 'U')[0].toUpperCase()}</div>
                <div className="flex-1 min-w-0"><p className="font-medium text-slate-900 text-sm truncate">{u.full_name || 'Sem nome'}</p><p className="text-xs text-slate-500 truncate">{u.email}</p></div>
                <UserStatusBadge status={u.status_conta || 'pendente'} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-100 rounded-2xl p-5">
          <h4 className="font-semibold text-slate-900 mb-3">Como funciona o controle de acesso</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-600">
            <div className="bg-white rounded-xl p-4"><div className="font-medium text-slate-900 mb-1">1. Pendente</div><p>Usuário cadastrado aguarda liberação manual pelo admin</p></div>
            <div className="bg-white rounded-xl p-4"><div className="font-medium text-slate-900 mb-1">2. Ativo</div><p>Usuário tem acesso completo até a data de validade</p></div>
            <div className="bg-white rounded-xl p-4"><div className="font-medium text-slate-900 mb-1">3. Bloqueado</div><p>Acesso negado, independente da data de validade</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
