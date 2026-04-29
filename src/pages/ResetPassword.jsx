import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPassword() {
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  async function handleReset() {
    if (senha.length < 6) { setMsg('Senha deve ter pelo menos 6 caracteres.'); return; }
    if (senha !== confirmSenha) { setMsg('Senhas não coincidem.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) setMsg('Erro ao redefinir senha. Tente novamente.');
    else { setMsg('Senha redefinida com sucesso!'); setTimeout(() => navigate('/Dashboard'), 2000); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl p-8 border border-slate-800">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">💰</div>
          <h2 className="text-xl font-bold text-white">Redefinir senha</h2>
          <p className="text-slate-400 text-sm mt-1">Dinheiro Sob Controle</p>
        </div>
        <div className="space-y-4">
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
            placeholder="Nova senha" style={{fontSize:'16px'}}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" />
          <input type="password" value={confirmSenha} onChange={e => setConfirmSenha(e.target.value)}
            placeholder="Confirmar nova senha" style={{fontSize:'16px'}}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" />
          {msg && (
            <div className={`rounded-xl p-3 text-sm ${msg.includes('sucesso') ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
              {msg}
            </div>
          )}
          <button onClick={handleReset} disabled={loading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl text-sm disabled:opacity-60 transition-all">
            {loading ? 'Salvando...' : 'Redefinir senha'}
          </button>
        </div>
      </div>
    </div>
  );
}
