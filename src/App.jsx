import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { pagesConfig } from './pages.config';
import PageNotFound from './lib/PageNotFound';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Onboarding from './pages/Onboarding';
import MonthlyClosing from './pages/MonthlyClosing';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = Pages[mainPageKey];

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout
    ? <Layout currentPageName={currentPageName}>{children}</Layout>
    : <>{children}</>;

// ─── Guarda de rota autenticada ───────────────────────────
function ProtectedRoute({ children, pageName }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verifica acesso à conta
  if (user?.status_conta === 'pendente' && !['admin', 'admin_master'].includes(user?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-sm text-center bg-white rounded-2xl border p-8">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="text-xl font-bold mb-2">Acesso Pendente</h2>
          <p className="text-slate-600 text-sm mb-6">
            Sua conta está aguardando liberação. Se você já realizou a compra, aguarde a confirmação ou entre em contato.
          </p>
          <button
            onClick={() => useAuth().signOut()}
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  if (user?.status_conta === 'bloqueada' && !['admin', 'admin_master'].includes(user?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-sm text-center bg-white rounded-2xl border p-8">
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-xl font-bold mb-2">Acesso Bloqueado</h2>
          <p className="text-slate-600 text-sm">
            Sua conta foi bloqueada. Entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  // Redireciona para onboarding se não completou (admin_master nunca precisa)
  if (!user?.onboarding_completo && pageName !== 'Onboarding' && user?.role !== 'admin_master' && !['admin', 'admin_master'].includes(user?.role)) {
    return <Navigate to="/Onboarding" replace />;
  }

  // Verifica fechamento mensal pendente (dia 1 do mês)
  // (a lógica detalhada fica no MonthlyClosingGuard abaixo)

  return children;
}

// ─── Guard de fechamento mensal ───────────────────────────
function MonthlyClosingGuard({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [checked, setChecked] = React.useState(false);
  const [needsClosing, setNeedsClosing] = React.useState(false);

  React.useEffect(() => {
    const checkClosing = async () => {
      const now = new Date();
      const isFirst = now.getDate() === 1;
      if (!isFirst || !user?.id) {
        setChecked(true);
        return;
      }

      try {
        const { entities } = await import('@/api/supabaseApi');
        const { format, subMonths } = await import('date-fns');
        const mesAnterior = format(subMonths(now, 1), 'yyyy-MM');
        const closings = await entities.MonthlyClosing.filter({ mes_referencia: mesAnterior });
        const pending = !closings.some(c => c.fechamento_confirmado);
        setNeedsClosing(pending);
      } catch {
        // silently fail
      } finally {
        setChecked(true);
      }
    };
    if (user) checkClosing();
  }, [user?.id]);

  if (!checked) return null;

  if (needsClosing && location.pathname !== '/MonthlyClosing') {
    return <Navigate to="/MonthlyClosing" replace />;
  }

  return children;
}

// ─── App autenticado ──────────────────────────────────────
function AuthenticatedApp() {
  return (
    <MonthlyClosingGuard>
      <Routes>
        <Route path="/" element={
          <ProtectedRoute pageName={mainPageKey}>
            <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
          </ProtectedRoute>
        } />

        <Route path="/Onboarding" element={
          <ProtectedRoute pageName="Onboarding">
            <Onboarding />
          </ProtectedRoute>
        } />

        <Route path="/MonthlyClosing" element={
          <ProtectedRoute pageName="MonthlyClosing">
            <MonthlyClosing />
          </ProtectedRoute>
        } />

        {Object.entries(Pages).map(([path, Page]) => (
          <Route key={path} path={`/${path}`} element={
            <ProtectedRoute pageName={path}>
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            </ProtectedRoute>
          } />
        ))}

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </MonthlyClosingGuard>
  );
}

// ─── App principal ────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
