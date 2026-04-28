import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, TrendingUp, PiggyBank, Calendar,
  BookOpen, CreditCard, Target, Zap, Settings,
  Users, BarChart2, ClipboardList, ChevronRight,
  LogOut, Menu, X, DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Itens do menu ──────────────────────────────────────────
const MENU_CLIENTE = [
  { label: 'Dashboard',          icon: LayoutDashboard, path: 'Dashboard' },
  { label: 'Detector de Vazamentos', icon: TrendingUp,  path: 'LeakageDetector' },
  { label: 'Calculadora de Orçamento', icon: BookOpen,  path: 'BudgetCalculator' },
  { label: 'Configuração das 3 Contas', icon: CreditCard, path: 'BankSetup' },
  { label: 'Pague-se Primeiro',  icon: DollarSign,      path: 'PayYourselfFirst' },
  { label: 'Meta de Reserva',    icon: Target,           path: 'ReserveGoal' },
  { label: 'Check Semanal',      icon: Calendar,         path: 'WeeklyRoutine' },
  { label: 'Fechamento Mensal',  icon: BookOpen,         path: 'MonthlyClosing' },
  { label: 'Usar a Reserva?',    icon: PiggyBank,        path: 'ReserveUsage' },
  { label: 'Plano de Aceleração', icon: Zap,             path: 'AccelerationPlan' },
  { label: 'Configurações',      icon: Settings,         path: 'UserSettings' },
  { label: 'Calendário',         icon: Calendar,         path: 'CalendarioCliente' },
];

const MENU_ADMIN = [
  { label: 'Gestão de Usuários', icon: Users,         path: 'AdminUsers' },
  { label: 'Analytics',          icon: BarChart2,      path: 'AdminAnalytics' },
  { label: 'Onboarding',         icon: ClipboardList,  path: 'AdminOnboarding' },
  { label: 'Calendário Admin',   icon: Calendar,      path: 'CalendarioAdmin' },
];

export default function Layout({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);

  const isAdmin = ['admin', 'admin_master'].includes(user?.role);
  const currentPath = location.pathname.replace('/', '');

  function navegar(path) {
    navigate(`/${path}`);
    setMenuAberto(false);
  }

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  // ── Item de menu ──────────────────────────────────────────
  function MenuItem({ item }) {
    const ativo = currentPath === item.path;
    return (
      <button
        onClick={() => navegar(item.path)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
          ativo
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        )}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
        {ativo && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0 text-emerald-400" />}
      </button>
    );
  }

  // ── Sidebar ───────────────────────────────────────────────
  function Sidebar({ mobile = false }) {
    return (
      <div className={cn(
        'flex flex-col h-full bg-slate-950 border-r border-slate-800',
        mobile ? 'w-full' : 'w-64'
      )}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-sm">Dinheiro Sob Controle</p>
            <p className="text-xs text-slate-500 mt-0.5">{user?.display_name || user?.email}</p>
          </div>
          {mobile && (
            <button onClick={() => setMenuAberto(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Menu principal */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {MENU_CLIENTE.map(item => (
            <MenuItem key={item.path} item={item} />
          ))}

          {/* Admin */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-2 px-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                  Administração
                </p>
              </div>
              {MENU_ADMIN.map(item => (
                <MenuItem key={item.path} item={item} />
              ))}
            </>
          )}
        </div>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">

      {/* Sidebar desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Overlay mobile */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMenuAberto(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 z-50">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar mobile */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
          <button
            onClick={() => setMenuAberto(true)}
            className="text-slate-400 hover:text-white p-1"
          >
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-sm font-bold text-white">Dinheiro Sob Controle</p>
          <div className="w-7" />
        </div>

        {/* Página */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </main>

      </div>
    </div>
  );
}
