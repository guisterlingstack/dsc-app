import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccessControl({ children }) {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Admin sempre tem acesso
  if (user.role === 'admin') return children;

  // Verifica produto principal
  if (!user.has_main_mentorship) {
    return <BlockedScreen icon={XCircle} title="Produto Não Contratado"
      description="Você não possui acesso ao Dinheiro Sob Controle. Entre em contato com o administrador."
      color="text-red-600 bg-red-100" onLogout={signOut} />;
  }

  // Verifica status da conta
  if (!user.status_conta || user.status_conta === 'pendente') {
    return <BlockedScreen icon={Clock} title="Acesso Pendente"
      description="Sua conta está aguardando liberação pelo administrador."
      color="text-amber-600 bg-amber-100" onLogout={signOut} />;
  }

  if (user.status_conta === 'bloqueada') {
    return <BlockedScreen icon={XCircle} title="Acesso Bloqueado"
      description="Sua conta foi bloqueada. Entre em contato com o administrador."
      color="text-red-600 bg-red-100" onLogout={signOut} />;
  }

  // Verifica validade
  if (user.acesso_ate) {
    const expiry = new Date(user.acesso_ate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiry < today) {
      return <BlockedScreen icon={AlertTriangle} title="Acesso Expirado"
        description="Seu período de acesso foi encerrado. Entre em contato para renovar."
        color="text-orange-600 bg-orange-100" onLogout={signOut} />;
    }
  }

  return children;
}

function BlockedScreen({ icon: Icon, title, description, color, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white rounded-3xl border border-slate-200 p-8 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${color}`}>
          <Icon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
        <p className="text-slate-600 text-sm mb-6">{description}</p>
        <Button onClick={onLogout} variant="outline" className="w-full">Sair da Conta</Button>
      </div>
    </div>
  );
}
