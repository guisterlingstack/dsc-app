import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { queryClientInstance } from '@/lib/query-client';
import { usePageTracking } from '@/hooks/usePageTracking';
import ResetPassword from './pages/ResetPassword';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import AdminOnboarding from './pages/AdminOnboarding';
import AdminAnalytics from './pages/AdminAnalytics';
import { pagesConfig } from './pages.config';

function FaixaSenhaTemporaria() {
  const { user } = useAuth();
  const navigate = useNavigate();
 
  if (!user?.senha_temporaria) return null;
 
  const expira = user.senha_expira_em
    ? new Date(user.senha_expira_em).toLocaleDateString('pt-BR')
    : null;
 
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white text-center py-2 px-4 text-xs font-semibold flex items-center justify-center gap-3">
      <span>
        🔑 Você está usando uma senha temporária
        {expira ? ` — expira em ${expira}` : ''}. Troque agora para garantir o acesso.
      </span>
      <button
        onClick={() => navigate('/UserSettings')}
        className="underline font-bold hover:opacity-80"
      >
        Trocar senha
      </button>
    </div>
  );
}

const { Pages, Layout } = pagesConfig;

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 text-sm">Carregando...</p>
    </div>
  );
}

function AuthenticatedApp() {
  usePageTracking();
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const pageName = location.pathname.replace('/', '') || 'Dashboard';

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  const isAdmin = ['admin', 'admin_master'].includes(user?.role);

  if (!user?.onboarding_completo && !isAdmin && pageName !== 'Onboarding') {
    return <Navigate to="/Onboarding" replace />;
  }

  return (
    <Layout>
      <Routes>
        {Object.entries(Pages).map(([name, Component]) => (
          <Route key={name} path={`/${name}`} element={<Component />} />
        ))}
        <Route path="/Onboarding"       element={<Onboarding />} />
        <Route path="/AdminOnboarding"  element={<AdminOnboarding />} />
        <Route path="/AdminAnalytics"   element={<AdminAnalytics />} />
        <Route path="/ResetPassword" element={<ResetPassword />} />
        <Route path="/"                 element={<Navigate to="/Dashboard" replace />} />
        <Route path="*"                 element={<Navigate to="/Dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

function LoginGuard() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to="/Dashboard" replace />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/login"    element={<LoginGuard />} />
            <Route path="/cadastro" element={<LoginGuard />} />
            <Route path="/"         element={<Navigate to="/login" replace />} />
            <Route path="/*"        element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </QueryClientProvider>
    </AuthProvider>
  );
}
