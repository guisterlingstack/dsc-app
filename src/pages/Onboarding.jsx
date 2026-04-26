import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const PERGUNTAS = [
  {
    id: 'q1_renda',
    numero: 1,
    titulo: 'Qual é a sua renda mensal líquida aproximada?',
    subtitulo: 'O valor que cai na sua conta todo mês.',
    tipo: 'opcao',
    opcoes: [
      'Até R$3.000',
      'Entre R$3.000 e R$5.000',
      'Entre R$5.000 e R$8.000',
      'Entre R$8.000 e R$12.000',
      'Acima de R$12.000',
    ],
  },
  {
    id: 'q2_dor',
    numero: 2,
    titulo: 'O que mais te incomoda na sua situação financeira hoje?',
    subtitulo: 'Escolha a opção que mais se identifica.',
    tipo: 'opcao',
    opcoes: [
      'Chego no fim do mês sem saber para onde o dinheiro foi',
      'Tenho vergonha de olhar meu extrato bancário',
      'Gasto por impulso e me arrependo depois',
      'Não consigo poupar nada, mesmo querendo',
      'Tenho dívidas que parecem não diminuir',
    ],
  },
  {
    id: 'q3_tentativas',
    numero: 3,
    titulo: 'O que você já tentou para organizar suas finanças?',
    subtitulo: 'Seja honesto — isso nos ajuda a personalizar sua experiência.',
    tipo: 'opcao',
    opcoes: [
      'Planilha (funcionou por pouco tempo ou não funcionou)',
      'Aplicativo de controle financeiro',
      'Tentei cortar gastos, mas não sustentei',
      'Nunca tentei nada de forma estruturada',
      'Já fiz cursos ou mentorias de finanças',
    ],
  },
  {
    id: 'q4_desejo',
    numero: 4,
    titulo: 'O que você mais quer conquistar nos próximos 6 meses?',
    subtitulo: 'Seu objetivo principal aqui.',
    tipo: 'opcao',
    opcoes: [
      'Ter uma reserva de emergência finalmente',
      'Parar de sentir culpa quando gasto com lazer',
      'Sair do cheque especial ou das dívidas',
      'Investir todo mês, mesmo que pouco',
      'Ter controle real sobre para onde meu dinheiro vai',
    ],
  },
  {
    id: 'q5_obstaculo',
    numero: 5,
    titulo: 'O que você acredita que te impede de organizar suas finanças?',
    subtitulo: 'Escolha o maior obstáculo.',
    tipo: 'opcao',
    opcoes: [
      'Minha renda é irregular ou variável',
      'Não tenho disciplina para manter qualquer método',
      'Meus gastos essenciais já consomem tudo',
      'Meu parceiro(a) não colabora com o controle',
      'Não sei por onde começar',
    ],
  },
  {
    id: 'q6_perfil',
    numero: 6,
    titulo: 'Como você se descreveria em relação ao dinheiro?',
    subtitulo: 'Escolha a frase que mais combina com você.',
    tipo: 'opcao',
    opcoes: [
      'Sei que ganho bem mas não tenho nada guardado',
      'Gasto antes de pensar e me arrependo depois',
      'Fico ansioso quando olho para minha situação financeira',
      'Já tive controle antes e perdi com o tempo',
      'Nunca tive controle, desde sempre é assim',
    ],
  },
  {
    id: 'q7_expectativa',
    numero: 7,
    titulo: 'Em uma frase, o que você espera que o Dinheiro Sob Controle faça pela sua vida financeira?',
    subtitulo: 'Escreva com suas próprias palavras — não existe resposta errada.',
    tipo: 'aberta',
  },
];

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [loading, setLoading] = useState(false);
  const [textoAberto, setTextoAberto] = useState('');

  const pergunta = PERGUNTAS[step];
  const total = PERGUNTAS.length;
  const progresso = (step / total) * 100;
  const podeProsseguir = pergunta.tipo === 'aberta'
    ? textoAberto.trim().length > 3
    : !!respostas[pergunta.id];

  function selecionarOpcao(opcao) {
    setRespostas(prev => ({ ...prev, [pergunta.id]: opcao }));
  }

  function voltar() {
    if (step > 0) setStep(s => s - 1);
  }

  async function avancar() {
    if (!podeProsseguir) return;

    const novasRespostas = { ...respostas };
    if (pergunta.tipo === 'aberta') novasRespostas[pergunta.id] = textoAberto;

    if (step < total - 1) {
      setRespostas(novasRespostas);
      setStep(s => s + 1);
      return;
    }

    // Última pergunta — salva no Supabase
    setLoading(true);
    try {
      await supabase.from('onboarding_respostas').upsert({
        user_id: user.id,
        ...novasRespostas,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      await supabase.from('profiles').update({
        onboarding_completo: true,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      if (refreshProfile) await refreshProfile();
      navigate('/Dashboard');
    } catch (err) {
      console.error('Erro ao salvar onboarding:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <span className="text-sm font-semibold text-emerald-400 tracking-wide">
            Dinheiro Sob Controle
          </span>
          <span className="text-xs text-slate-500">
            {step + 1} de {total}
          </span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="h-1 bg-slate-800">
        <div
          className="h-1 bg-emerald-500 transition-all duration-500"
          style={{ width: `${progresso}%` }}
        />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">

          <div className="text-xs font-bold text-emerald-400 tracking-widest uppercase mb-4">
            Pergunta {pergunta.numero} de {total}
          </div>

          <h2 className="text-2xl font-bold text-white leading-snug mb-2">
            {pergunta.titulo}
          </h2>
          <p className="text-slate-400 text-sm mb-8">{pergunta.subtitulo}</p>

          {/* Opções */}
          {pergunta.tipo === 'opcao' && (
            <div className="space-y-3">
              {pergunta.opcoes.map(opcao => {
                const sel = respostas[pergunta.id] === opcao;
                return (
                  <button
                    key={opcao}
                    onClick={() => selecionarOpcao(opcao)}
                    className={`w-full text-left px-5 py-4 rounded-xl border text-sm font-medium transition-all flex items-center gap-3 ${
                      sel
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      sel ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'
                    }`}>
                      {sel && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    {opcao}
                  </button>
                );
              })}
            </div>
          )}

          {/* Aberta */}
          {pergunta.tipo === 'aberta' && (
            <textarea
              value={textoAberto}
              onChange={e => setTextoAberto(e.target.value)}
              placeholder="Escreva aqui..."
              rows={5}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none transition-colors"
            />
          )}

          {/* Botões */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button
                onClick={voltar}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm hover:border-slate-500 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            )}
            <button
              onClick={avancar}
              disabled={!podeProsseguir || loading}
              className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                podeProsseguir && !loading
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Salvando...' : step < total - 1 ? 'Continuar' : 'Concluir'}
              {!loading && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
