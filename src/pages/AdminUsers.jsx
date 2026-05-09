import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminEntities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Shield, Plus, Search, UserCheck, UserX, Clock, Settings, Key, ChevronDown, ChevronUp, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import UserStatusBadge from '@/components/admin/UserStatusBadge';

const TRANSFER_PASSWORD = 'Estabilidade_n0t_exist3';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const PERMISSION_LABELS = {
  pode_ver_clientes: 'Ver clientes',
  pode_editar_clientes: 'Editar clientes',
  pode_criar_usuarios: 'Criar usuários',
  pode_deletar_usuarios: 'Deletar usuários',
  pode_gerenciar_permissoes: 'Gerenciar permissões',
  pode_ver_financeiro: 'Ver dados financeiros',
  pode_editar_financeiro: 'Editar dados financeiros',
};

const STERLING_STATUS_COR = {
  trial:         'bg-blue-100 text-blue-700',
  ativo:         'bg-emerald-100 text-emerald-700',
  implementacao: 'bg-purple-100 text-purple-700',
  expirado:      'bg-red-100 text-red-600',
  cancelado:     'bg-slate-100 text-slate-500',
};

export default function AdminUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdminMaster = user?.role === 'admin_master';

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('todos');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [transferPassword, setTransferPassword] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferTarget, setTransferTarget] = useState(null);
  const [createError, setCreateError] = useState('');

  const [newUser, setNewUser] = useState({
    full_name: '', email: '', password: '', role: 'cliente',
    status_conta: 'ativa', acesso_ate: '', has_main_mentorship: true,
    senha_temporaria: true,
  });
  const [permissions, setPermissions] = useState({
    pode_ver_clientes: true, pode_editar_clientes: false,
    pode_criar_usuarios: false, pode_deletar_usuarios: false,
    pode_gerenciar_permissoes: false, pode_ver_financeiro: false,
    pode_editar_financeiro: false,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => adminEntities.listUsers('-created_at'),
    enabled: !!user && ['admin', 'admin_master'].includes(user?.role),
  });

  const { data: suportePerms = [] } = useQuery({
    queryKey: ['suporte-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suporte_permissions').select('*');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdminMaster,
  });

  const { data: sterlingAssinaturas = [] } = useQuery({
    queryKey: ['admin-sterling-ass-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_assinaturas')
        .select('*, agent_planos(label, conversas_dia)');
      return data || [];
    },
    enabled: isAdminMaster,
  });

  const { data: sterlingPlanos = [] } = useQuery({
    queryKey: ['agent-planos'],
    queryFn: async () => {
      const { data } = await supabase.from('agent_planos').select('*').order('conversas_dia');
      return data || [];
    },
    enabled: isAdminMaster,
  });

  // Cria usuário via Edge Function
  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      setCreateError('');
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nome:             userData.full_name,
          email:            userData.email,
          senha:            userData.password,
          senha_temporaria: userData.senha_temporaria,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Erro ao criar usuário');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setCreateDialogOpen(false);
      setCreateError('');
      setNewUser({ full_name: '', email: '', password: '', role: 'cliente', status_conta: 'ativa', acesso_ate: '', has_main_mentorship: true, senha_temporaria: true });
    },
    onError: (e) => setCreateError(e.message),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => adminEntities.updateUser(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-users'] }),
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ userId, field, value }) => {
      const existing = suportePerms.find(p => p.user_id === userId);
      if (existing) {
        const { error } = await supabase.from('suporte_permissions').update({ [field]: value }).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('suporte_permissions').insert({ user_id: userId, [field]: value, criado_por: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suporte-permissions'] }),
  });

  const atualizarSterling = useMutation({
    mutationFn: async ({ userId, planoId, status, modo }) => {
      const ass = sterlingAssinaturas.find(a => a.user_id === userId);
      if (ass) {
        await supabase.from('agent_assinaturas').update({
          plano_id:    planoId || ass.plano_id,
          status:      status  || ass.status,
          modo:        modo    || ass.modo,
          ativo_desde: status === 'ativo' ? new Date().toISOString() : ass.ativo_desde,
          updated_at:  new Date().toISOString(),
        }).eq('id', ass.id);
      } else {
        await supabase.from('agent_assinaturas').insert({
          user_id:     userId,
          plano_id:    planoId,
          status:      status || 'ativo',
          modo:        modo   || 'manutencao',
          ativo_desde: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sterling-ass-users'] }),
  });

  const handleTransfer = () => {
    if (transferPassword !== TRANSFER_PASSWORD) { setTransferError('Senha incorreta!'); return; }
    if (!transferTarget) return;
    Promise.all([
      adminEntities.updateUser(user.id, { role: 'admin' }),
      adminEntities.updateUser(transferTarget.id, { role: 'admin_master' }),
      supabase.from('admin_transfer_log').insert({ de_user_id: user.id, para_user_id: transferTarget.id }),
    ]).then(() => { setTransferDialogOpen(false); window.location.reload(); });
  };

  const getUserPermissions = (userId) => suportePerms.find(p => p.user_id === userId) || {};
  const getUserSterling    = (userId) => sterlingAssinaturas.find(a => a.user_id === userId);

  const filteredUsers = users.filter(u => {
    const matchSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole   = filterRole === 'todos' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const fmt   = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
  const stats = {
    total:     users.length,
    ativos:    users.filter(u => u.status_conta === 'ativa').length,
    pendentes: users.filter(u => u.status_conta === 'pendente').length,
    suporte:   users.filter(u => u.role === 'suporte').length,
  };

  return (
    <div className="p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-slate-900 rounded-lg"><Shield className="w-4 h-4 text-white" /></div>
              <h1 className="text-2xl font-bold text-slate-900">Gestão de Usuários</h1>
              {isAdminMaster && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-semibold border border-amber-200">Admin Master</span>}
            </div>
            <p className="text-slate-500 text-sm">Controle total de acessos e permissões</p>
          </div>
          <div className="flex gap-2">
            {isAdminMaster && (
              <Button variant="outline" onClick={() => setTransferDialogOpen(true)} className="border-red-200 text-red-600 hover:bg-red-50">
                <Key className="w-4 h-4 mr-2" />Transferir Admin
              </Button>
            )}
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-slate-900 hover:bg-slate-800">
              <Plus className="w-4 h-4 mr-2" />Criar Usuário
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total',     value: stats.total,     cls: 'bg-white border-slate-200' },
            { label: 'Ativos',    value: stats.ativos,    cls: 'bg-emerald-50 border-emerald-200' },
            { label: 'Pendentes', value: stats.pendentes, cls: 'bg-amber-50 border-amber-200' },
            { label: 'Suporte',   value: stats.suporte,   cls: 'bg-blue-50 border-blue-200' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-2xl border p-4', s.cls)}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className="text-3xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Buscar por nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11" />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-full sm:w-40 h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="cliente">Clientes</SelectItem>
              <SelectItem value="suporte">Suporte</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="admin_master">Admin Master</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Carregando usuários...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Shield className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isExpanded = expandedUser === u.id;
                const isMe       = u.id === user?.id;
                const isSuport   = u.role === 'suporte';
                const userPerms  = getUserPermissions(u.id);
                const sterling   = getUserSterling(u.id);

                return (
                  <div key={u.id} className={cn('transition-colors', isMe && 'bg-slate-50')}>
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                        {(u.full_name || u.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">{u.full_name || 'Sem nome'}</p>
                          {isMe && <span className="text-xs text-slate-400">(você)</span>}
                          <UserStatusBadge status={u.status_conta || 'pendente'} />
                          <span className={cn('text-xs px-2 py-0.5 rounded-full',
                            u.role === 'admin_master' ? 'bg-amber-100 text-amber-800' :
                            u.role === 'suporte' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-600')}>{u.role}</span>
                          {sterling && (
                            <span className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1', STERLING_STATUS_COR[sterling.status] || 'bg-slate-100 text-slate-500')}>
                              <Bot className="w-3 h-3" />{sterling.agent_planos?.label} · {sterling.status}
                            </span>
                          )}
                          {u.senha_temporaria && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">🔑 Senha temp.</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                        {u.acesso_ate && <p className="text-xs text-slate-400">Expira: {fmt(u.acesso_ate)}</p>}
                      </div>
                      {!isMe && isAdminMaster && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button size="sm" variant="outline" className="h-8 text-xs"
                            onClick={() => updateUserMutation.mutate({ id: u.id, data: { status_conta: u.status_conta === 'ativa' ? 'bloqueada' : 'ativa' } })}>
                            {u.status_conta === 'ativa' ? <UserX className="w-3.5 h-3.5 text-red-500" /> : <UserCheck className="w-3.5 h-3.5 text-emerald-500" />}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs"
                            onClick={() => setExpandedUser(isExpanded ? null : u.id)}>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      )}
                    </div>

                    {isExpanded && isAdminMaster && (
                      <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4 bg-slate-50">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Role</Label>
                            <Select value={u.role} onValueChange={(v) => updateUserMutation.mutate({ id: u.id, data: { role: v } })}>
                              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cliente">Cliente</SelectItem>
                                <SelectItem value="suporte">Suporte</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Status</Label>
                            <Select value={u.status_conta} onValueChange={(v) => updateUserMutation.mutate({ id: u.id, data: { status_conta: v } })}>
                              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ativa">Ativa</SelectItem>
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="bloqueada">Bloqueada</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Acesso até</Label>
                            <Input type="date" className="h-9 mt-1" value={u.acesso_ate?.split('T')[0] || ''}
                              onChange={(e) => updateUserMutation.mutate({ id: u.id, data: { acesso_ate: e.target.value || null } })} />
                          </div>
                        </div>

                        {/* Controle Sterling */}
                        <div className="border border-slate-200 rounded-xl p-4 bg-white">
                          <div className="flex items-center gap-2 mb-3">
                            <Bot className="w-4 h-4 text-emerald-600" />
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Sterling Agent</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs">Plano</Label>
                              <Select value={sterling?.plano_id || ''}
                                onValueChange={(v) => atualizarSterling.mutate({ userId: u.id, planoId: v, status: sterling?.status || 'ativo' })}>
                                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Sem plano" /></SelectTrigger>
                                <SelectContent>
                                  {sterlingPlanos.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.label} — {p.conversas_dia} msgs/dia</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Status</Label>
                              <Select value={sterling?.status || ''}
                                onValueChange={(v) => atualizarSterling.mutate({ userId: u.id, status: v, planoId: sterling?.plano_id })}>
                                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Sem acesso" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="trial">Trial</SelectItem>
                                  <SelectItem value="ativo">Ativo</SelectItem>
                                  <SelectItem value="implementacao">Implementação</SelectItem>
                                  <SelectItem value="expirado">Expirado</SelectItem>
                                  <SelectItem value="cancelado">Cancelado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Modo</Label>
                              <Select value={sterling?.modo || ''}
                                onValueChange={(v) => atualizarSterling.mutate({ userId: u.id, modo: v, planoId: sterling?.plano_id, status: sterling?.status })}>
                                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="trial">Trial</SelectItem>
                                  <SelectItem value="implementacao">Implementação (90d)</SelectItem>
                                  <SelectItem value="manutencao">Manutenção</SelectItem>
                                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {sterling && (
                            <p className="text-xs text-slate-400 mt-2">
                              {sterling.status === 'trial' && `Trial até: ${fmt(sterling.trial_fim)}`}
                              {sterling.status === 'ativo' && `Ativo desde: ${fmt(sterling.ativo_desde)}`}
                              {sterling.modo === 'implementacao' && sterling.implementacao_fim && ` · Implementação até: ${fmt(sterling.implementacao_fim)}`}
                            </p>
                          )}
                        </div>

                        {isSuport && (
                          <div>
                            <p className="text-xs font-semibold text-slate-700 mb-2">Permissões de Suporte</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {Object.entries(PERMISSION_LABELS).map(([field, label]) => (
                                <label key={field} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                                  <input type="checkbox"
                                    checked={userPerms[field] ?? false}
                                    onChange={(e) => updatePermissionMutation.mutate({ userId: u.id, field, value: e.target.checked })}
                                    className="w-4 h-4 rounded" />
                                  <span className="text-xs text-slate-700">{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialog Criar */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Criar Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome completo</Label>
              <Input placeholder="Nome do usuário" value={newUser.full_name}
                onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                className="mt-1 h-11" style={{fontSize:'16px'}} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" placeholder="email@exemplo.com" value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                className="mt-1 h-11" style={{fontSize:'16px'}} />
            </div>
            <div>
              <Label>Senha temporária</Label>
              <Input type="password" placeholder="Mínimo 6 caracteres" value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                className="mt-1 h-11" style={{fontSize:'16px'}} />
              <p className="text-xs text-slate-400 mt-1">O cliente receberá aviso para trocar em 30 dias.</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-orange-800">Marcar como senha temporária</p>
                <p className="text-xs text-orange-600">Faixa vermelha de aviso no app do cliente</p>
              </div>
              <button
                onClick={() => setNewUser(p => ({ ...p, senha_temporaria: !p.senha_temporaria }))}
                className={cn('w-11 h-6 rounded-full transition-all relative flex-shrink-0',
                  newUser.senha_temporaria ? 'bg-orange-500' : 'bg-slate-200')}>
                <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all',
                  newUser.senha_temporaria ? 'left-5' : 'left-0.5')} />
              </button>
            </div>
            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{createError}</div>
            )}
            <Button onClick={() => createUserMutation.mutate(newUser)}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800"
              disabled={createUserMutation.isPending || !newUser.full_name || !newUser.email || !newUser.password}>
              {createUserMutation.isPending ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Transferir */}
      <Dialog open={transferDialogOpen} onOpenChange={(o) => { setTransferDialogOpen(o); setTransferError(''); setTransferPassword(''); setTransferTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-red-700">⚠️ Transferir Admin Master</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
              <strong>Atenção:</strong> Esta ação é irreversível sem a senha especial.
            </div>
            <div>
              <Label>Selecione o novo Admin Master</Label>
              <Select onValueChange={(id) => setTransferTarget(users.find(u => u.id === id))}>
                <SelectTrigger className="mt-1 h-11"><SelectValue placeholder="Selecionar usuário..." /></SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.id !== user?.id).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Senha de confirmação</Label>
              <Input type="password" placeholder="Digite a senha especial" value={transferPassword}
                onChange={(e) => { setTransferPassword(e.target.value); setTransferError(''); }}
                className="mt-1 h-11" style={{fontSize:'16px'}} />
              {transferError && <p className="text-red-600 text-xs mt-1">{transferError}</p>}
            </div>
            <Button onClick={handleTransfer} className="w-full h-12 bg-red-600 hover:bg-red-700"
              disabled={!transferTarget || !transferPassword}>
              Confirmar Transferência
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
