import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Lock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const SYSTEM_PROMPT = `Você é Sterling, o assistente financeiro oficial do Dinheiro Sob Controle — o sistema criado pelo Método Sterling para ajudar profissionais a organizarem suas finanças e construírem sua reserva de emergência.

Seu papel é responder dúvidas dos clientes sobre o Método Sterling e o sistema DSC. Você combina precisão técnica com linguagem acessível — fala como um consultor experiente mas próximo, sem enrolação.

VOCÊ RESPONDE APENAS sobre:
- O Método Sterling e seus 3 módulos (Diagnóstico, Automação, Controle)
- A fórmula 50/30/20 e como aplicá-la
- O sistema de 3 contas bancárias
- Categorização de gastos (essencial vs estilo de vida)
- Quando usar ou não a reserva de emergência
- Check semanal e fechamento mensal
- Os módulos do app DSC
- Dúvidas sobre os conceitos ensinados no sistema

VOCÊ NÃO RESPONDE sobre:
- Investimentos em renda variável, ações, cripto
- Indicações de produtos financeiros específicos
- Assuntos fora do escopo do Método Sterling

Quando não souber ou a pergunta estiver fora do escopo, diga de forma direta e sugira que o cliente fale com o consultor.

Seja direto, claro e objetivo. Respostas curtas quando possível. Use exemplos práticos com valores em reais quando ajudar na compreensão.`;

function getMensagemLimite(plano) {
  const proximo = plano === 'basic' ? 'Pro (R$37,90/mês — 7 conversas/dia)' : 'Ultra (R$67,90/mês — 15 conversas/dia)';
  return `Você atingiu o limite de conversas de hoje do plano ${plano === 'basic' ? 'Basic' : 'Pro'}. Para continuar, fale com o consultor e faça upgrade para o plano ${proximo}.`;
}

export default function SterlingAgent({ modulo }) {
  const { user } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [mensagens, setMensagens] = useState([
    { role: 'assistant', content: 'Olá! Sou o Sterling, seu assistente financeiro do Método Sterling. Como posso te ajudar hoje?' }
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const moduloAtual = modulo || location.pathname.replace('/', '') || 'Dashboard';

  // Busca assinatura do usuário
  const { data: assinatura } = useQuery({
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

  // Busca uso do dia
  const { data: usoDia } = useQuery({
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
  }, [mensagens]);

  // Verifica acesso
  const temAcesso = assinatura && (
    assinatura.status === 'ativo' ||
    (assinatura.status === 'trial' && new Date(assinatura.trial_fim) > new Date())
  );

  const limitesDia = assinatura?.agent_planos?.conversas_dia || 3;
  const conversasRestantes = Math.max(0, limitesDia - (usoDia || 0));
  const limiteBloqueado = conversasRestantes === 0;
  const planoNome = assinatura?.agent_planos?.nome || 'basic';

  const enviar = useMutation({
    mutationFn: async (pergunta) => {
      // Monta histórico para a API
      const historico = mensagens
        .slice(-10) // últimas 10 mensagens para contexto
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [...historico, { role: 'user', content: pergunta }],
        }),
      });

      const data = await res.json();
      const resposta = data.content?.[0]?.text || 'Não consegui processar sua pergunta. Tente novamente.';
      const tokensInput = data.usage?.input_tokens || 0;
      const tokensOutput = data.usage?.output_tokens || 0;

      // Salva conversa no Supabase (anonimizada — sem nome do usuário)
      await supabase.from('agent_conversas').insert({
        user_id: user.id,
        modulo: moduloAtual,
        pergunta,
        resposta,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
      });

      // Atualiza uso diário
      const hoje = new Date().toISOString().split('T')[0];
      await supabase.from('agent_uso_diario').upsert({
        user_id: user.id,
        data: hoje,
        conversas: (usoDia || 0) + 1,
      }, { onConflict: 'user_id,data' });

      return resposta;
    },
    onSuccess: (resposta) => {
      setMensagens(prev => [...prev, { role: 'assistant', content: resposta }]);
      qc.invalidateQueries(['agent-uso']);
    },
    onError: () => {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro ao processar. Tente novamente em instantes.' }]);
    },
  });

  async function handleEnviar(e) {
    e?.preventDefault();
    if (!input.trim() || loading || limiteBloqueado) return;

    const pergunta = input.trim();
    setInput('');
    setMensagens(prev => [...prev, { role: 'user', content: pergunta }]);
    setLoading(true);
    await enviar.mutateAsync(pergunta);
    setLoading(false);
  }

  // Sem assinatura — mostra ativação do trial
  if (!assinatura) {
    return <ativacaoTrial userId={user?.id} qc={qc} />;
  }

  // Trial expirado ou cancelado
  if (!temAcesso) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Lock className="w-10 h-10 text-slate-400 mb-4" />
        <h3 className="font-bold text-slate-800 mb-2">Acesso expirado</h3>
        <p className="text-sm text-slate-500">Seu período de teste terminou. Entre em contato com o consultor para ativar o plano.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[600px] bg-white rounded-2xl border border-slate-200 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
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

      {/* Mensagens */}
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
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {limiteBloqueado && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">⚠️ Limite diário atingido</p>
            <p>{getMensagemLimite(planoNome)}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-3">
        <form onSubmit={handleEnviar} className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={limiteBloqueado || loading}
            placeholder={limiteBloqueado ? 'Limite diário atingido' : 'Pergunte algo sobre o Método Sterling...'}
            className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || limiteBloqueado || loading}
            className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

// Componente de ativação do trial
function ativacaoTrial({ userId, qc }) {
  const [loading, setLoading] = useState(false);

  async function ativarTrial() {
    setLoading(true);
    const { data: plano } = await supabase
      .from('agent_planos')
      .select('id')
      .eq('nome', 'basic')
      .single();

    await supabase.from('agent_assinaturas').insert({
      user_id: userId,
      plano_id: plano.id,
      status: 'trial',
    });

    qc.invalidateQueries(['agent-assinatura']);
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white rounded-2xl border border-slate-200">
      <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
        <Zap className="w-7 h-7 text-emerald-600" />
      </div>
      <h3 className="font-bold text-slate-800 text-lg mb-2">Conheça o Sterling</h3>
      <p className="text-sm text-slate-500 mb-2">Seu assistente financeiro pessoal, treinado no Método Sterling.</p>
      <p className="text-xs text-emerald-600 font-semibold mb-6">7 dias grátis · 3 conversas por dia · Sem cartão</p>
      <button
        onClick={ativarTrial}
        disabled={loading}
        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-60"
      >
        {loading ? 'Ativando...' : 'Ativar 7 dias grátis'}
      </button>
    </div>
  );
}
