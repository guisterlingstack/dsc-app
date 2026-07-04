import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Send, Bot, User, Lock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import AccessControl from '@/components/AccessControl';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function SterlingAgentInner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [mensagens, setMensagens] = useState([
    { role: 'assistant', content: 'Olá! Sou o Sterling, seu assistente financeiro do Método Sterling. Como posso te ajudar hoje?' }
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const { data: assinatura, isLoading: loadingAss } = useQuery({
    queryKey: ['agent-assinatura', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_assinaturas')
        .select('*, agent_planos(*)')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: usoDia = 0 } = useQuery({
    queryKey: ['agent-uso', user?.id],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('agent_uso_diario')
        .select('conversas')
        .eq('user_id', user.id)
        .eq('data', hoje)
        .maybeSingle();
      return data?.conversas || 0;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, loading]);

  const ativarTrial = useMutation({
    mutationFn: async () => {
      const { data: plano } = await supabase
        .from('agent_planos')
        .select('id')
        .eq('nome', 'basic')
        .single();
      await supabase.from('agent_assinaturas').insert({
        user_id: user.id,
        plano_id: plano.id,
        status: 'trial',
      });
    },
    onSuccess: () => qc.invalidateQueries(['agent-assinatura']),
  });

  const enviarMensagem = useMutation({
    mutationFn: async (pergunta) => {
      // A2/A3: chamada via Edge Function — chave Anthropic fica no servidor
      const historico = mensagens.slice(-10).map(m => ({ role: m.role, content: m.content }));

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sterling-agent`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pergunta, historico }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'limite_atingido') throw new Error(data.mensagem);
        if (data.error === 'trial_expirado')  throw new Error(data.mensagem);
        if (data.error === 'sem_assinatura')  throw new Error(data.mensagem);
        throw new Error('Erro ao processar. Tente novamente.');
      }

      return data.resposta;
    },
    onSuccess: (resposta) => {
      setMensagens(prev => [...prev, { role: 'assistant', content: resposta }]);
      qc.invalidateQueries(['agent-uso']);
      setLoading(false);
    },
    onError: () => {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro ao processar. Tente novamente.' }]);
      setLoading(false);
    },
  });

  async function handleEnviar(e) {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    const pergunta = input.trim();
    setInput('');
    setMensagens(prev => [...prev, { role: 'user', content: pergunta }]);
    setLoading(true);
    enviarMensagem.mutate(pergunta);
  }

  const limitesDia = assinatura?.agent_planos?.conversas_dia || 3;
  const conversasRestantes = Math.max(0, limitesDia - usoDia);
  const limiteBloqueado = conversasRestantes === 0;
  const temAcesso = assinatura && (
    assinatura.status === 'ativo' ||
    (assinatura.status === 'trial' && new Date(assinatura.trial_fim) > new Date())
  );

  if (loadingAss) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!assinatura) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-[#C9A84C]/15 rounded-lg"><Bot className="w-5 h-5 text-[#C9A84C]" /></div>
            <h1 className="text-2xl font-bold text-slate-900">Sterling Agent</h1>
          </div>
          <p className="text-slate-500 text-sm">Seu assistente financeiro do Método Sterling</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center px-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-5">
            <Zap className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-xl mb-2">Conheça o Sterling</h3>
          <p className="text-slate-500 text-sm mb-2 max-w-sm">Seu assistente financeiro pessoal, treinado no Método Sterling. Tire dúvidas sobre gastos, reserva e muito mais.</p>
          <p className="text-emerald-600 font-semibold text-sm mb-8">7 dias grátis · 3 conversas por dia · Sem cartão</p>
          <button
            onClick={() => ativarTrial.mutate()}
            disabled={ativarTrial.isPending}
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-60"
          >
            {ativarTrial.isPending ? 'Ativando...' : 'Ativar 7 dias grátis'}
          </button>
        </div>
      </div>
    );
  }

  if (!temAcesso) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-[#C9A84C]/15 rounded-lg"><Bot className="w-5 h-5 text-[#C9A84C]" /></div>
            <h1 className="text-2xl font-bold text-slate-900">Sterling Agent</h1>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center px-8">
          <Lock className="w-10 h-10 text-slate-400 mb-4" />
          <h3 className="font-bold text-slate-800 mb-2">Período de teste encerrado</h3>
          <p className="text-sm text-slate-500">Entre em contato com o consultor para ativar um plano e continuar usando o Sterling.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 pb-24 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-[#C9A84C]/15 rounded-lg"><Bot className="w-5 h-5 text-[#C9A84C]" /></div>
          <h1 className="text-2xl font-bold text-slate-900">Sterling Agent</h1>
        </div>
        <p className="text-slate-500 text-sm">Seu assistente financeiro do Método Sterling</p>
      </div>

      <div className="flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ height: '560px' }}>

        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">Sterling</p>
              <p className="text-xs text-slate-400">Assistente do Método Sterling</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-600">
              {conversasRestantes} conversa{conversasRestantes !== 1 ? 's' : ''} restante{conversasRestantes !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-slate-400">Plano {assinatura.agent_planos?.label}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensagens.map((msg, i) => (
            <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                msg.role === 'user' ? 'bg-slate-800' : 'bg-emerald-500')}>
                {msg.role === 'user'
                  ? <User className="w-3.5 h-3.5 text-white" />
                  : <Bot className="w-3.5 h-3.5 text-white" />}
              </div>
              <div className={cn('max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-slate-800 text-white rounded-tr-sm'
                  : 'bg-slate-100 text-slate-800 rounded-tl-sm')}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {limiteBloqueado && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Limite diário atingido</p>
              <p>Você usou todas as conversas de hoje. Volte amanhã ou fale com o consultor para fazer upgrade do plano.</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-100 p-3 flex-shrink-0">
          <form onSubmit={handleEnviar} className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={limiteBloqueado || loading}
              placeholder={limiteBloqueado ? 'Limite diário atingido' : 'Pergunte sobre o Método Sterling...'}
              className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || limiteBloqueado || loading}
              className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SterlingAgent() {
  return (
    <AccessControl>
      <SterlingAgentInner />
    </AccessControl>
  );
}
