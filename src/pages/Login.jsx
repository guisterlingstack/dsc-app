import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const benefits = [
  { icon: 'target', title: 'Meta Clara', description: 'Construa 3x suas despesas em 90 dias' },
  { icon: 'shield', title: 'Proteção', description: 'Reserva de emergência para imprevistos' },
  { icon: 'trend', title: 'Progresso', description: 'Acompanhe sua evolução em tempo real' },
  { icon: 'check', title: 'Hábito', description: 'Rotinas semanais para manter o controle' },
];

function BenefitIcon({ type }) {
  const cls = "w-8 h-8 text-emerald-500";
  if (type === 'target') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
  if (type === 'shield') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  if (type === 'trend') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}

export default function Login() {
  const [view, setView] = useState('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const reset = () => { setError(''); setResetMsg(''); setEmail(''); setPassword(''); setFullName(''); setConfirm(''); };

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await signIn(email, password); navigate('/Dashboard'); }
    catch (err) { setError(err.message || 'Email ou senha incorretos.'); }
    finally { setLoading(false); }
  };

  const handleCadastro = async (e) => {
    e.preventDefault(); setError('');
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    if (password.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return; }
    setLoading(true);
    try { await signUp(email, password, fullName); navigate('/Dashboard'); }
    catch (err) { setError(err.message || 'Erro ao criar conta. Tente novamente.'); }
    finally { setLoading(false); }
  };

  const handleEsqueciSenha = async () => {
    if (!email) { setError('Digite seu email primeiro.'); return; }
    setLoading(true); setError(''); setResetMsg('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://dsc-app.pages.dev/ResetPassword',
    });
    if (error) setError('Erro ao enviar email. Tente novamente.');
    else setResetMsg('Email de recuperação enviado! Verifique sua caixa de entrada.');
    setLoading(false);
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">💰</div>
            <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-4">Dinheiro Sob<br/>Controle</h1>
            <p className="text-slate-500 text-base leading-relaxed">Construa sua reserva de emergência em 90 dias com um sistema simples, claro e orientado a ação.</p>
          </div>
          <div className="space-y-3 mb-10">
            <Button onClick={() => { reset(); setView('cadastro'); }} className="w-full h-14 text-base font-semibold bg-slate-900 hover:bg-slate-800 rounded-2xl">Começar Agora</Button>
            <Button onClick={() => { reset(); setView('login'); }} variant="outline" className="w-full h-14 text-base font-semibold rounded-2xl border-slate-300 text-slate-700">Já tenho conta</Button>
          </div>
          <div className="space-y-3 mb-10">
            {benefits.map((b) => (
              <div key={b.title} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center text-center">
                <div className="mb-3"><BenefitIcon type={b.icon} /></div>
                <h3 className="font-semibold text-slate-900 mb-1">{b.title}</h3>
                <p className="text-slate-500 text-sm">{b.description}</p>
              </div>
            ))}
          </div>
          <p className="text-slate-400 text-sm text-center">Plataforma de suporte para consultoria financeira</p>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">💰</div>
            <h1 className="text-2xl font-bold text-slate-900">Entrar na sua conta</h1>
            <p className="text-slate-500 text-sm mt-1">Dinheiro Sob Controle</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div><Label>Email</Label><Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 h-12" style={{fontSize:'16px'}} /></div>
              <div><Label>Senha</Label><Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 h-12" style={{fontSize:'16px'}} /></div>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
              {resetMsg && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">{resetMsg}</div>}
              <Button type="submit" className="w-full h-12 bg-slate-900 hover:bg-slate-800 rounded-xl text-base" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
              <button
                type="button"
                onClick={handleEsqueciSenha}
                disabled={loading}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Esqueci minha senha
              </button>
            </form>
            <div className="mt-4 text-center text-sm text-slate-500">
              Não tem conta?{' '}
              <button onClick={() => { reset(); setView('cadastro'); }} className="text-emerald-600 font-medium hover:underline">Criar conta</button>
            </div>
          </div>
          <button onClick={() => setView('landing')} className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-600">← Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">💰</div>
          <h1 className="text-2xl font-bold text-slate-900">Criar sua conta</h1>
          <p className="text-slate-500 text-sm mt-1">Dinheiro Sob Controle</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <form onSubmit={handleCadastro} className="space-y-4">
            <div><Label>Nome completo</Label><Input type="text" placeholder="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1 h-12" style={{fontSize:'16px'}} /></div>
            <div><Label>Email</Label><Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 h-12" style={{fontSize:'16px'}} /></div>
            <div><Label>Senha</Label><Input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 h-12" style={{fontSize:'16px'}} /></div>
            <div><Label>Confirmar senha</Label><Input type="password" placeholder="Repita a senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="mt-1 h-12" style={{fontSize:'16px'}} /></div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
            <Button type="submit" className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-base" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-slate-500">
            Já tem conta?{' '}
            <button onClick={() => { reset(); setView('login'); }} className="text-emerald-600 font-medium hover:underline">Entrar</button>
          </div>
        </div>
        <button onClick={() => setView('landing')} className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-600">← Voltar</button>
      </div>
    </div>
  );
}
