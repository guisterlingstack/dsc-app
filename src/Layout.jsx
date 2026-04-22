import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, Search, PiggyBank, Target, Landmark,
  CalendarCheck, HelpCircle, Rocket, Menu, X, LogOut,
  User, Shield, TrendingUp, MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Navegação principal ──────────────────────────────────
const MAIN_NAV = [
  { name: 'Início', href: 'Dashboard', icon: LayoutDashboard },
  { name: 'Orçamento', href: 'SmartBudgetSystem', icon: TrendingUp },
  { name: 'Check Semanal', href: 'WeeklyRoutine', icon: CalendarCheck },
  { name: 'Reserva', href: 'ReserveGoal', icon: Target },
  { name: 'Mais', href: '__more', icon: MoreHorizontal },
];

const MORE_NAV = [
  { name: 'Detector de Vazamentos', href: 'LeakageDetector', icon: Search },
  { name: 'Pague-se Primeiro', href: 'PayYourselfFirst', icon: PiggyBank },
  { name: 'Config. Bancária', href: 'BankSetup', icon: Landmark },
  { name: 'Usar a Reserva?', href: 'ReserveUsage', icon: HelpCircle },
  { name: 'Plano de Aceleração', href: 'AccelerationPlan', icon: Rocket },
  { name: 'Calculadora', href: 'BudgetCalculator', icon: TrendingUp },
  { name: 'Acelerador de Renda', href: 'IncomeAccelerator', icon: Rocket },
  { name: 'Configurações', href: 'UserSettings', icon: User },
];

const ADMIN_NAV = [
  { name: 'Painel Admin', href: 'AdminDashboard', icon: Shield },
  { name: 'Gestão de Usuários', href: 'AdminUsers', icon: User },
];

// ─── Bottom Navigation (mobile) ───────────────────────────
function BottomNav({ currentPage, onMoreClick }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 lg:hidden">
      <div className="flex items-stretch h-16">
        {MAIN_NAV.map((item) => {
          const isMore = item.href === '__more';
          const isActive = !isMore && currentPage === item.href;
          return (
            <div key={item.href} className="flex-1">
              {isMore ? (
                <button
                  onClick={onMoreClick}
                  className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500 active:bg-slate-50"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px]">{item.name}</span>
                </button>
              ) : (
                <Link
                  to={createPageUrl(item.href)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 h-full w-full transition-colors',
                    isActive ? 'text-emerald-600' : 'text-slate-500 active:bg-slate-50'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px]">{item.name}</span>
                  {isActive && <div className="absolute bottom-0 w-8 h-0.5 bg-emerald-600 rounded-t" />}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Drawer "Mais" (mobile) ───────────────────────────────
function MoreDrawer({ open, onClose, currentPage, user }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 pb-8">
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
        <div className="grid grid-cols-2 gap-2">
          {MORE_NAV.map((item) => (
            <Link
              key={item.href}
              to={createPageUrl(item.href)}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors',
                currentPage === item.href
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-700 active:bg-slate-100'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          ))}
          {['admin', 'admin_master'].includes(user?.role) && ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              to={createPageUrl(item.href)}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors',
                currentPage === item.href
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar (desktop) ────────────────────────────────────
function Sidebar({ currentPage, user, onLogout }) {
  return (
    <aside className="hidden lg:flex flex-col w-64 h-full bg-white border-r border-slate-200 fixed top-0 left-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 px-5 border-b border-slate-100">
        <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-xl">💰</span>
        </div>
        <div>
          <div className="text-xs font-bold text-slate-900 leading-tight">Dinheiro Sob</div>
          <div className="text-xs font-bold text-emerald-600 leading-tight">Controle</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {[...MAIN_NAV.filter(n => n.href !== '__more'), ...MORE_NAV].map((item) => {
          const isActive = currentPage === item.href;
          return (
            <Link
              key={item.href}
              to={createPageUrl(item.href)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}

        {['admin', 'admin_master'].includes(user?.role) && (
          <>
            <div className="px-3 py-2 mt-2">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3 h-3" /> Administração
              </div>
            </div>
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                to={createPageUrl(item.href)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  currentPage === item.href
                    ? 'bg-red-600 text-white'
                    : 'text-red-600 hover:bg-red-50'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      {user && (
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">
              {(user.display_name || user.full_name || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-900 truncate">
                {user.display_name || user.full_name || 'Usuário'}
              </div>
              <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

// ─── Layout principal ─────────────────────────────────────
export default function Layout({ children, currentPageName }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <Sidebar currentPage={currentPageName} user={user} onLogout={handleLogout} />

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-base">💰</span>
          </div>
          <span className="font-bold text-slate-900 text-sm">Dinheiro Sob Controle</span>
        </div>
        {user && (
          <button
            onClick={handleLogout}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Main content */}
      <main className={cn(
        'min-h-[calc(100vh-3.5rem)] lg:min-h-screen',
        'lg:pl-64',
        'pb-16 lg:pb-0' // espaço para bottom nav no mobile
      )}>
        {children}
      </main>

      {/* Bottom nav (mobile) */}
      <BottomNav currentPage={currentPageName} onMoreClick={() => setMoreOpen(true)} />

      {/* More drawer (mobile) */}
      <MoreDrawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        currentPage={currentPageName}
        user={user}
      />
    </div>
  );
}
