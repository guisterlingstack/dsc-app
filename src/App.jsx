import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { queryClient } from '@/lib/query-client';
import { usePageTracking } from '@/hooks/usePageTracking';

import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import AdminOnboarding from './pages/AdminOnboarding';
import AdminAnalytics from './pages/AdminAnalytics';
import { pagesConfig } from './pages.config';

const { Pages, Layout } = pagesConfig;

// ── Rotas autenticadas ─────────────────────────────────────
function AuthenticatedApp() {
  usePageTracking();
  const { user, loading } = useAuth();
  const location = useLocation();
  const pageName = location.pathname.replace('/', '') || 'Dashboard';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Redireciona para onboarding se não completou
  // (admin_master e admin pulam o onboarding)
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
        <Route path="/Onboarding"      element={<Onboarding />} />
        <Route path="/AdminOnboarding" element={<AdminOnboarding />} />
        <Route path="/AdminAnalytics"  element={<AdminAnalytics />} />
        <Route path="/"                element={<Navigate to="/Dashboard" replace />} />
        <Route path="*"                element={<Navigate to="/Dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

// ── App raiz ────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/login"    element={<Login />} />
            <Route path="/cadastro" element={<Login />} />
            <Route path="/"         element={<Navigate to="/login" replace />} />
            <Route path="/*"        element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </QueryClientProvider>
    </AuthProvider>
  );
}
