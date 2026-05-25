import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Calendar, Clock, MapPin, History, Settings, ChevronLeft, ChevronRight, Check, AlertCircle, Phone, User, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const DIAS_COMPLETO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const STATUS_LABEL = { agendado: 'Agendado', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado', reagendado: 'Reagendado' };
const STATUS_COR = { agendado: 'bg-blue-100 text-blue-700', confirmado: 'bg-emerald-100 text-emerald-700', realizado: 'bg-slate-100 text-slate-600', cancelado: 'bg-red-100 text-red-600', reagendado: 'bg-amber-100 text-amber-700' };

function formatHora(h) { return h.slice(0, 5); }
function formatDataHora(d) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export default function CalendarioCliente() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [aba, setAba] = useState('agendar');
  const [eventoSel, setEventoSel] = useState(null);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [diaSel, setDiaSel] = useState(null);
  const [horarioSel, setHorarioSel] = useState(null);
  const [modalOculto, setModalOculto] = useState(null);
  const [contato, setContato] = useState({ nome: '', whatsapp: '' });
  const [editContato, setEditContato] = useState(false);

  const { data: eventos = [] } = useQuery({
    queryKey: ['cal-eventos-cliente'],
    queryFn: async () => { const { data } = await supabase.from('calendario_eventos').select('*').eq('visivel', true).order('nome'); return data || []; },
  });

  const { data: contatoSalvo } = useQuery({
    queryKey: ['cal-contato', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('calendario_contatos').select('*').eq('user_id', user.id).maybeSingle();
      if (data) setContato({ nome: data.nome, whatsapp: data.whatsapp });
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['cal-historico', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('calendario_agendamentos')
        .select('*, calendario_eventos(nome)')
        .eq('user_id', user.id)
        .order('data_hora', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: disponibilidade = [] } = useQuery({
    queryKey: ['cal-disponibilidade'],
    queryFn: async () => { const { data } = await supabase.from('calendario_disponibilidade').select('*').eq('ativo', true).order('dia_semana').order('horario'); return data || []; },
  });

  const hoje = new Date();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay() + semanaOffset * 7);

  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(inicioSemana.getDate() + i);
    return d;
  });

  const horariosDia = diaSel !== null
    ? disponibilidade.filter(d => d.dia_semana === diaSel.getDay()).map(d => d.horario)
    : [];

  const { data: agendamentosDia = [] } = useQuery({
    queryKey: ['cal-ag-dia', diaSel?.toDateString()],
    queryFn: async () => {
      if (!diaSel) return [];
      const inicio = new Date(diaSel); inicio.setHours(0, 0, 0, 0);
      const fim = new Date(diaSel); fim.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from('calendario_agendamentos')
        .select('data_hora, duracao_min')
        .gte('data_hora', inicio.toISOString())
        .lte('data_hora', fim.toISOString())
        .not('status', 'eq', 'cancelado');
      return data || [];
    },
    enabled: !!diaSel,
  });

  function horarioOcupado(hora) {
    if (!eventoSel) return false;
    const [h, m] = hora.split(':').map(Number);
    const inicio = new Date(diaSel); inicio.setHours(h, m, 0, 0);
    const fim = new Date(inicio.getTime() + eventoSel.duracao_min * 60000);
    return agendamentosDia.some(ag => {
      const agInicio = new Date(ag.data_hora);
      const agFim = new Date(agInicio.getTime() + ag.duracao_min * 60000);
      return inicio < agFim && fim > agInicio;
    });
  }

  const reuniaoAtiva = historico.find(h => ['agendado', 'confirmado', 'reagendado'].includes(h.status) && new Date(h.data_hora) > new Date());
  const jaTeveConsultoria = historico.some(h => h.status === 'realizado');

  const { data: eventosOcultos = [] } = useQuery({
    queryKey: ['cal-eventos-ocultos'],
    queryFn: async () => { const { data } = await supabase.from('calendario_eventos').select('*').eq('visivel', false).eq('permite_interesse', true); return data || []; },
  });

  const salvarContato = useMutation({
    mutationFn: async () => {
      if (!contato.nome.trim() || !contato.whatsapp.trim()) throw new Error('Preencha todos os campos');
      const wpp = contato.whatsapp.replace(/\D/g, '');
      if (wpp.length < 10) throw new Error('WhatsApp inválido');
      await supabase.from('calendario_contatos').upsert({ user_id: user.id, ...contato, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    },
    onSuccess: () => { toast.success('Contato salvo!'); qc.invalidateQueries(['cal-contato']); setEditContato(false); },
    onError: (e) => toast.error(e.message),
  });

  const agendar = useMutation({
    mutationFn: async () => {
      if (!contatoSalvo) throw new Error('Preencha seus dados de contato primeiro');
      if (reuniaoAtiva) throw new Error('Você já possui uma reunião ativa');
      if (!eventoSel || !diaSel || !horarioSel) throw new Error('Selecione evento, data e horário');
      const [h, m] = horarioSel.split(':').map(Number);
      const dataHora = new Date(diaSel); dataHora.setHours(h, m, 0, 0);
      if (!jaTeveConsultoria) {
        const minData = new Date(); minData.setDate(minData.getDate() + 7);
        if (dataHora < minData) throw new Error('Sua primeira consultoria deve ser agendada com pelo menos 7 dias de antecedência');
      }
      await supabase.from('calendario_agendamentos').insert({
        user_id: user.id, evento_id: eventoSel.id,
        data_hora: dataHora.toISOString(), duracao_min: eventoSel.duracao_min,
        local_tipo: eventoSel.local_tipo, local_link: eventoSel.local_link, status: 'agendado',
      });
    },
    onSuccess: () => {
      toast.success('Agendamento realizado!');
      qc.invalidateQueries(['cal-historico']); qc.invalidateQueries(['cal-ag-dia']);
      setEventoSel(null); setDiaSel(null); setHorarioSel(null);
      setAba('historico');
    },
    onError: (e) => toast.error(e.message),
  });

  const solicitarOculto = useMutation({
    mutationFn: async (eventoId) => {
      if (!contato.nome || !contato.whatsapp) throw new Error('Preencha seus dados primeiro');
      await supabase.from('calendario_solicitacoes').insert({
        user_id: user.id, evento_id: eventoId,
        nome: contatoSalvo?.nome || contato.nome,
        whatsapp: contatoSalvo?.whatsapp || contato.whatsapp,
        status: 'pendente',
      });
    },
    onSuccess: () => { toast.success('Solicitação enviada!'); setModalOculto(null); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-4 lg:p-8 pb-24 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-blue-100 rounded-lg"><Calendar className="w-5 h-5 text-blue-600" /></div>
          <h1 className="text-2xl font-bold text-slate-900">Calendário Sob Controle</h1>
        </div>
        <p className="text-slate-500 text-sm">Agende sua consultoria financeira</p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
        {[
          { id: 'agendar', label: 'Agendar', icon: Calendar },
          { id: 'historico', label: 'Histórico', icon: History },
          { id: 'configuracoes', label: 'Configurações', icon: Settings },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setAba(id)}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              aba === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ABA AGENDAR */}
      {aba === 'agendar' && (
        <div className="space-y-6">
          {!contatoSalvo && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Complete seu perfil primeiro</p>
                <p className="text-xs text-amber-600 mt-1">Acesse a aba Configurações e informe seu nome e WhatsApp antes de agendar.</p>
                <button onClick={() => setAba('configuracoes')} className="text-xs font-semibold text-amber-700 underline mt-1">Ir para Configurações</button>
              </div>
            </div>
          )}

          {reuniaoAtiva && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <Clock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Você já possui uma reunião agendada</p>
                <p className="text-xs text-blue-600 mt-1">{reuniaoAtiva.calendario_eventos?.nome} — {formatDataHora(reuniaoAtiva.data_hora)}</p>
              </div>
            </div>
          )}

          {/* Passo 1: Evento */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">1. Escolha o tipo de consultoria</p>
            <div className="grid gap-2">
              {eventos.map(ev => (
                <button key={ev.id} onClick={() => { setEventoSel(ev); setDiaSel(null); setHorarioSel(null); }}
                  className={cn('w-full text-left p-4 rounded-xl border transition-all',
                    eventoSel?.id === ev.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{ev.nome}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />{ev.duracao_min} min &nbsp;·&nbsp;
                        <MapPin className="w-3 h-3 inline mr-1" />{ev.local_tipo === 'zoom' ? 'Zoom' : ev.local_tipo === 'meet' ? 'Google Meet' : ev.local_tipo}
                      </p>
                    </div>
                    {eventoSel?.id === ev.id && <Check className="w-5 h-5 text-blue-500" />}
                  </div>
                </button>
              ))}
              {eventosOcultos.map(ev => (
                <button key={ev.id} onClick={() => setModalOculto(ev)}
                  className="w-full text-left p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-all">
                  <p className="font-semibold text-slate-600 text-sm">{ev.nome}</p>
                  <p className="text-xs text-slate-400 mt-1">Clique para solicitar interesse</p>
                </button>
              ))}
            </div>
          </div>

          {/* Passo 2: Data */}
          {eventoSel && !reuniaoAtiva && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">2. Escolha a data</p>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setSemanaOffset(s => s - 1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-sm font-semibold text-slate-700">
                    {diasSemana[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – {diasSemana[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <button onClick={() => setSemanaOffset(s => s + 1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {diasSemana.map((dia, i) => {
                    const temHorarios = disponibilidade.some(d => d.dia_semana === dia.getDay());
                    const passado = dia < new Date(hoje.setHours(0,0,0,0));
                    const selecionado = diaSel?.toDateString() === dia.toDateString();
                    return (
                      <button key={i} disabled={!temHorarios || passado} onClick={() => { setDiaSel(dia); setHorarioSel(null); }}
                        className={cn('flex flex-col items-center py-2 px-1 rounded-lg text-xs transition-all',
                          selecionado ? 'bg-blue-500 text-white' :
                          !temHorarios || passado ? 'opacity-30 cursor-not-allowed text-slate-400' :
                          'hover:bg-blue-50 text-slate-700 cursor-pointer')}>
                        <span className="font-medium mb-1">{DIAS_SEMANA[dia.getDay()]}</span>
                        <span className="font-bold text-sm">{dia.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Passo 3: Horário */}
          {diaSel && !reuniaoAtiva && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                3. Escolha o horário — {DIAS_COMPLETO[diaSel.getDay()]}, {diaSel.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </p>
              {horariosDia.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">Sem horários disponíveis neste dia.</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {horariosDia.map(hora => {
                    const ocupado = horarioOcupado(hora);
                    const sel = horarioSel === hora;
                    return (
                      <button key={hora} disabled={ocupado} onClick={() => setHorarioSel(hora)}
                        className={cn('py-2 rounded-lg text-xs font-semibold transition-all border',
                          sel ? 'bg-blue-500 text-white border-blue-500' :
                          ocupado ? 'bg-slate-100 text-slate-300 cursor-not-allowed border-slate-100' :
                          'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50')}>
                        {formatHora(hora)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Confirmar */}
          {horarioSel && contatoSalvo && !reuniaoAtiva && (
            <button onClick={() => agendar.mutate()} disabled={agendar.isPending}
              className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all text-sm disabled:opacity-60">
              {agendar.isPending ? 'Agendando...' : `Confirmar — ${formatHora(horarioSel)} de ${diaSel?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
            </button>
          )}
        </div>
      )}

      {/* ABA HISTÓRICO */}
      {aba === 'historico' && (
        <div className="space-y-3">
          {historico.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum agendamento ainda.</p>
            </div>
          ) : historico.map(ag => (
            <div key={ag.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{ag.calendario_eventos?.nome}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatDataHora(ag.data_hora)}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />{ag.duracao_min} min &nbsp;·&nbsp;
                    <MapPin className="w-3 h-3 inline mr-1" />{ag.local_tipo}
                  </p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0', STATUS_COR[ag.status])}>
                  {STATUS_LABEL[ag.status]}
                </span>
              </div>

              {/* Botão de videochamada — aparece só quando admin ativou */}
              {ag.chamada_ativa && ag.chamada_sala_id && (
                <button
                  onClick={() => navigate(`/Videochamada/${ag.chamada_sala_id}`)}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-all">
                  <Video className="w-4 h-4" />
                  Entrar na videochamada
                </button>
              )}

              {ag.local_link && !ag.chamada_ativa && (
                <a href={ag.local_link} target="_blank" rel="noopener noreferrer"
                  className="mt-3 block text-center py-2 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-all">
                  Acessar link da reunião
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ABA CONFIGURAÇÕES */}
      {aba === 'configuracoes' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="font-bold text-slate-800 mb-1">Dados de contato</h3>
            <p className="text-xs text-slate-500">Obrigatório para realizar agendamentos.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5"><User className="w-3 h-3 inline mr-1" />Nome completo</label>
              <input value={contato.nome} onChange={e => setContato(p => ({ ...p, nome: e.target.value }))}
                disabled={!!contatoSalvo && !editContato} placeholder="Seu nome completo"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5"><Phone className="w-3 h-3 inline mr-1" />WhatsApp</label>
              <input value={contato.whatsapp} onChange={e => setContato(p => ({ ...p, whatsapp: e.target.value }))}
                disabled={!!contatoSalvo && !editContato} placeholder="+55 12 999999999"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500" />
              <p className="text-xs text-slate-400 mt-1">Formato: +DDI DDD Número</p>
            </div>
          </div>
          {contatoSalvo && !editContato ? (
            <button onClick={() => setEditContato(true)} className="w-full py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">Editar dados</button>
          ) : (
            <button onClick={() => salvarContato.mutate()} disabled={salvarContato.isPending}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60">
              {salvarContato.isPending ? 'Salvando...' : 'Salvar dados'}
            </button>
          )}
        </div>
      )}

      {/* Modal reunião oculta */}
      {modalOculto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-slate-800 mb-2">{modalOculto.nome}</h3>
            <p className="text-sm text-slate-600 mb-6">O consultor entrará em contato via WhatsApp para alinhar os detalhes.</p>
            <div className="flex gap-3">
              <button onClick={() => setModalOculto(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Cancelar</button>
              <button onClick={() => solicitarOculto.mutate(modalOculto.id)} disabled={solicitarOculto.isPending}
                className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-all disabled:opacity-60">
                {solicitarOculto.isPending ? 'Enviando...' : 'Confirmar interesse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
