import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Calendar, Users, BarChart2, Settings, Inbox, Clock, MapPin, Edit2, Trash2, Phone, ChevronDown, Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { connectGoogle, isGoogleConnected, handleGoogleCallback, criarEventoGoogle, cancelarEventoGoogle } from '@/lib/googleCalendar';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const STATUS_LABEL = { agendado: 'Agendado', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado', reagendado: 'Reagendado' };
const STATUS_COR = { agendado: 'bg-blue-100 text-blue-700', confirmado: 'bg-emerald-100 text-emerald-700', realizado: 'bg-slate-100 text-slate-600', cancelado: 'bg-red-100 text-red-600', reagendado: 'bg-amber-100 text-amber-700' };
const STATUS_SOL = { pendente: 'bg-amber-100 text-amber-700', atendida: 'bg-emerald-100 text-emerald-700', cancelada: 'bg-red-100 text-red-600' };
const DURACOES = [15, 30, 45, 60, 75, 90, 105, 120];

function formatDataHora(d) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function formatHora(h) { return typeof h === 'string' ? h.slice(0, 5) : ''; }

function gerarHorarios() {
  const slots = [];
  for (let h = 7; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots.filter(s => s <= '22:30');
}
const TODOS_HORARIOS = gerarHorarios();

export default function CalendarioAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [aba, setAba] = useState('reunioes');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroEvento, setFiltroEvento] = useState('');
  const [modalEvento, setModalEvento] = useState(null);
  const [formEvento, setFormEvento] = useState({ nome: '', duracao_min: 60, local_tipo: 'zoom', local_link: '', limite_dia: 3, visivel: true, permite_interesse: false });
  const [googleConectado, setGoogleConectado] = useState(isGoogleConnected());

  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      const ok = handleGoogleCallback();
      if (ok) { setGoogleConectado(true); toast.success('Google Agenda conectado!'); }
    }
  }, []);

  if (!['admin', 'admin_master'].includes(user?.role)) return null;

  const { data: agendamentos = [] } = useQuery({
    queryKey: ['cal-admin-ag', filtroStatus, filtroEvento],
    queryFn: async () => {
      let q = supabase.from('calendario_agendamentos')
        .select('*, calendario_eventos(nome), calendario_contatos(nome, whatsapp)')
        .order('data_hora', { ascending: true });
      if (filtroStatus) q = q.eq('status', filtroStatus);
      if (filtroEvento) q = q.eq('evento_id', filtroEvento);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: eventos = [] } = useQuery({
    queryKey: ['cal-admin-eventos'],
    queryFn: async () => { const { data } = await supabase.from('calendario_eventos').select('*').order('nome'); return data || []; },
  });

  const { data: disponibilidade = [] } = useQuery({
    queryKey: ['cal-admin-disp'],
    queryFn: async () => { const { data } = await supabase.from('calendario_disponibilidade').select('*').order('dia_semana').order('horario'); return data || []; },
  });

  const { data: contatos = [] } = useQuery({
    queryKey: ['cal-admin-contatos'],
    queryFn: async () => { const { data } = await supabase.from('calendario_contatos').select('*, calendario_agendamentos(status)').order('nome'); return data || []; },
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['cal-admin-sol'],
    queryFn: async () => { const { data } = await supabase.from('calendario_solicitacoes').select('*, calendario_eventos(nome)').order('created_at', { ascending: false }); return data || []; },
  });

  const stats = {
    total: agendamentos.length,
    concluidos: agendamentos.filter(a => a.status === 'realizado').length,
    cancelados: agendamentos.filter(a => a.status === 'cancelado').length,
    reagendados: agendamentos.filter(a => a.status === 'reagendado').length,
  };

  const contagemDias = {};
  agendamentos.forEach(a => { const d = new Date(a.data_hora).getDay(); contagemDias[d] = (contagemDias[d] || 0) + 1; });
  const topDias = Object.entries(contagemDias).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d, c]) => ({ dia: DIAS_SEMANA[d], count: c }));

  const contagemHoras = {};
  agendamentos.forEach(a => { const h = new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); contagemHoras[h] = (contagemHoras[h] || 0) + 1; });
  const topHoras = Object.entries(contagemHoras).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, c]) => ({ hora: h, count: c }));

  const agora = new Date();
  const proximos  = agendamentos.filter(a => new Date(a.data_hora) >= agora && a.status !== 'cancelado');
  const anteriores = agendamentos.filter(a => new Date(a.data_hora) < agora || a.status === 'cancelado');

  const toggleDisp = useMutation({
    mutationFn: async ({ dia_semana, horario, ativo }) => {
      if (ativo) { await supabase.from('calendario_disponibilidade').update({ ativo: false }).match({ dia_semana, horario }); }
      else { await supabase.from('calendario_disponibilidade').upsert({ dia_semana, horario, ativo: true }, { onConflict: 'dia_semana,horario' }); }
    },
    onSuccess: () => qc.invalidateQueries(['cal-admin-disp']),
    onError: () => toast.error('Erro ao atualizar disponibilidade'),
  });

  const salvarEvento = useMutation({
    mutationFn: async () => {
      if (!formEvento.nome.trim()) throw new Error('Informe o nome do evento');
      if (modalEvento === 'novo') { await supabase.from('calendario_eventos').insert({ ...formEvento, created_by: user.id }); }
      else { await supabase.from('calendario_eventos').update({ ...formEvento, updated_at: new Date().toISOString() }).eq('id', modalEvento.id); }
    },
    onSuccess: () => { toast.success(modalEvento === 'novo' ? 'Evento criado!' : 'Evento atualizado!'); qc.invalidateQueries(['cal-admin-eventos']); setModalEvento(null); },
    onError: (e) => toast.error(e.message),
  });

  const excluirEvento = useMutation({
    mutationFn: async (id) => { await supabase.from('calendario_eventos').delete().eq('id', id); },
    onSuccess: () => { toast.success('Evento excluído'); qc.invalidateQueries(['cal-admin-eventos']); },
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status, ag }) => {
      await supabase.from('calendario_agendamentos').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (status === 'confirmado' && googleConectado && ag) {
        try {
          const googleId = await criarEventoGoogle({
            titulo: `${ag.calendario_eventos?.nome} — ${ag.calendario_contatos?.nome}`,
            dataHora: ag.data_hora, duracaoMin: ag.duracao_min,
            localLink: ag.local_link,
            descricao: `WhatsApp: ${ag.calendario_contatos?.whatsapp || ''}`,
          });
          if (googleId) await supabase.from('calendario_agendamentos').update({ google_event_id: googleId }).eq('id', id);
        } catch (err) { toast.error('Atualizado, mas erro no Google: ' + err.message); }
      }
      if (status === 'cancelado' && ag?.google_event_id) {
        try { await cancelarEventoGoogle(ag.google_event_id); } catch {}
      }
    },
    onSuccess: () => qc.invalidateQueries(['cal-admin-ag']),
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const ativarChamada = useMutation({
    mutationFn: async ({ agId, ativar }) => {
      const salaId = ativar ? `sala-${agId}-${Date.now()}` : null;
      await supabase.from('calendario_agendamentos').update({
        chamada_ativa:   ativar,
        chamada_sala_id: salaId,
      }).eq('id', agId);
      return salaId;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries(['cal-admin-ag']);
      toast.success(vars.ativar ? 'Sala de vídeo ativada!' : 'Sala desativada');
    },
    onError: () => toast.error('Erro ao atualizar chamada'),
  });

  const atualizarStatusSol = useMutation({
    mutationFn: async ({ id, status }) => { await supabase.from('calendario_solicitacoes').update({ status, updated_at: new Date().toISOString() }).eq('id', id); },
    onSuccess: () => qc.invalidateQueries(['cal-admin-sol']),
  });

  const excluirContato = useMutation({
    mutationFn: async (id) => { await supabase.from('calendario_contatos').delete().eq('id', id); },
    onSuccess: () => { toast.success('Contato excluído'); qc.invalidateQueries(['cal-admin-contatos']); },
  });

  function abrirNovoEvento() {
    setFormEvento({ nome: '', duracao_min: 60, local_tipo: 'zoom', local_link: '', limite_dia: 3, visivel: true, permite_interesse: false });
    setModalEvento('novo');
  }

  function abrirEditarEvento(ev) {
    setFormEvento({ nome: ev.nome, duracao_min: ev.duracao_min, local_tipo: ev.local_tipo, local_link: ev.local_link || '', limite_dia: ev.limite_dia, visivel: ev.visivel, permite_interesse: ev.permite_interesse });
    setModalEvento(ev);
  }

  function slotAtivo(dia, hora) {
    return disponibilidade.some(d => d.dia_semana === dia && formatHora(d.horario) === hora && d.ativo);
  }

  return (
    <div className="p-4 lg:p-8 pb-24 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-blue-100 rounded-lg"><Calendar className="w-5 h-5 text-blue-600" /></div>
          <h1 className="text-2xl font-bold text-slate-900">Calendário — Admin</h1>
        </div>
        <p className="text-slate-500 text-sm">Gestão completa de agendamentos</p>
        <div className="flex items-center gap-3 mt-3">
          {googleConectado ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">Google Agenda conectado</span>
            </div>
          ) : (
            <button onClick={connectGoogle}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              Conectar Google Agenda
            </button>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {[
          { id: 'reunioes', label: 'Reuniões', icon: Calendar },
          { id: 'eventos', label: 'Tipos de Evento', icon: Settings },
          { id: 'disponibilidade', label: 'Disponibilidade', icon: Clock },
          { id: 'estatisticas', label: 'Estatísticas', icon: BarChart2 },
          { id: 'contatos', label: 'Contatos', icon: Users },
          { id: 'solicitacoes', label: 'Solicitações', icon: Inbox },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setAba(id)}
            className={cn('flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              aba === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ABA REUNIÕES */}
      {aba === 'reunioes' && (
        <div className="space-y-6">
          <div className="flex gap-3 flex-wrap">
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
              <option value="">Todos os eventos</option>
              {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
            </select>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Próximos ({proximos.length})</p>
            {proximos.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Nenhum agendamento futuro.</p>
              : proximos.map(ag => (
                <AgendamentoCard key={ag.id} ag={ag}
                  onStatus={(status) => atualizarStatus.mutate({ id: ag.id, status, ag })}
                  onChamada={(ativar) => ativarChamada.mutate({ agId: ag.id, ativar })}
                  onEntrarChamada={() => navigate(`/Videochamada/${ag.chamada_sala_id}`)}
                />
              ))}
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Anteriores ({anteriores.length})</p>
            {anteriores.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Nenhum agendamento anterior.</p>
              : anteriores.map(ag => (
                <AgendamentoCard key={ag.id} ag={ag}
                  onStatus={(status) => atualizarStatus.mutate({ id: ag.id, status, ag })}
                  onChamada={(ativar) => ativarChamada.mutate({ agId: ag.id, ativar })}
                  onEntrarChamada={() => navigate(`/Videochamada/${ag.chamada_sala_id}`)}
                />
              ))}
          </div>
        </div>
      )}

      {/* ABA TIPOS DE EVENTO */}
      {aba === 'eventos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={abrirNovoEvento} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-all">+ Novo Evento</button>
          </div>
          {eventos.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">Nenhum evento criado ainda.</p>
            : eventos.map(ev => (
              <div key={ev.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-800 text-sm">{ev.nome}</p>
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', ev.visivel ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                      {ev.visivel ? 'Visível' : 'Oculto'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{ev.duracao_min} min · {ev.local_tipo === 'zoom' ? 'Zoom' : ev.local_tipo === 'meet' ? 'Google Meet' : ev.local_tipo} · Limite: {ev.limite_dia}/dia</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => abrirEditarEvento(ev)} className="p-2 hover:bg-slate-100 rounded-lg transition-all"><Edit2 className="w-4 h-4 text-slate-500" /></button>
                  <button onClick={() => { if (confirm('Excluir este evento?')) excluirEvento.mutate(ev.id); }} className="p-2 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ABA DISPONIBILIDADE */}
      {aba === 'disponibilidade' && (
        <div>
          <p className="text-sm text-slate-500 mb-4">Clique em um horário para ativar ou desativar. <span className="text-emerald-600 font-semibold">Verde = disponível</span>.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-3 text-slate-500 font-semibold w-16">Horário</th>
                  {DIAS_SEMANA.map(d => <th key={d} className="text-center py-2 px-1 text-slate-500 font-semibold">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {TODOS_HORARIOS.map(hora => (
                  <tr key={hora} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 text-slate-400 font-mono">{hora}</td>
                    {[0,1,2,3,4,5,6].map(dia => {
                      const ativo = slotAtivo(dia, hora);
                      return (
                        <td key={dia} className="text-center py-1.5 px-1">
                          <button onClick={() => toggleDisp.mutate({ dia_semana: dia, horario: hora, ativo })}
                            className={cn('w-8 h-6 rounded transition-all text-xs font-bold',
                              ativo ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-300 hover:bg-slate-200')}>
                            {ativo ? '✓' : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA ESTATÍSTICAS */}
      {aba === 'estatisticas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: stats.total, cor: 'text-blue-600' },
              { label: 'Concluídos', value: stats.concluidos, cor: 'text-emerald-600', pct: stats.total > 0 ? ((stats.concluidos/stats.total)*100).toFixed(0)+'%' : '–' },
              { label: 'Cancelados', value: stats.cancelados, cor: 'text-red-500', pct: stats.total > 0 ? ((stats.cancelados/stats.total)*100).toFixed(0)+'%' : '–' },
              { label: 'Reagendados', value: stats.reagendados, cor: 'text-amber-600', pct: stats.total > 0 ? ((stats.reagendados/stats.total)*100).toFixed(0)+'%' : '–' },
            ].map(({ label, value, cor, pct }) => (
              <div key={label} className="rounded-2xl p-5 border border-slate-200 bg-white">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={cn('text-3xl font-bold', cor)}>{value}</p>
                {pct && <p className="text-xs text-slate-400 mt-1">{pct} do total</p>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-sm font-bold text-slate-700 mb-4">📅 Top 3 dias mais populares</p>
              {topDias.length === 0 ? <p className="text-sm text-slate-400">Sem dados ainda</p>
                : topDias.map((d, i) => (
                  <div key={i} className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">{d.dia}</span>
                    <span className="text-sm font-bold text-blue-600">{d.count} agendamentos</span>
                  </div>
                ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-sm font-bold text-slate-700 mb-4">⏰ Top 3 horários mais populares</p>
              {topHoras.length === 0 ? <p className="text-sm text-slate-400">Sem dados ainda</p>
                : topHoras.map((h, i) => (
                  <div key={i} className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">{h.hora}</span>
                    <span className="text-sm font-bold text-blue-600">{h.count} agendamentos</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA CONTATOS */}
      {aba === 'contatos' && (
        <div className="space-y-3">
          {contatos.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">Nenhum contato ainda.</p>
            : contatos.map(ct => (
              <div key={ct.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{ct.nome}</p>
                  <p className="text-xs text-slate-500 mt-1"><Phone className="w-3 h-3 inline mr-1" />{ct.whatsapp}</p>
                  <p className="text-xs text-slate-400 mt-1">{ct.calendario_agendamentos?.length || 0} agendamento(s)</p>
                </div>
                <button onClick={() => { if (confirm('Excluir contato?')) excluirContato.mutate(ct.id); }} className="p-2 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))}
        </div>
      )}

      {/* ABA SOLICITAÇÕES */}
      {aba === 'solicitacoes' && (
        <div className="space-y-3">
          {solicitacoes.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">Nenhuma solicitação ainda.</p>
            : solicitacoes.map(sol => (
              <div key={sol.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{sol.nome}</p>
                    <p className="text-xs text-slate-500 mt-1"><Phone className="w-3 h-3 inline mr-1" />{sol.whatsapp}</p>
                    <p className="text-xs text-slate-400 mt-1">{sol.calendario_eventos?.nome} · {new Date(sol.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', STATUS_SOL[sol.status])}>
                    {sol.status.charAt(0).toUpperCase() + sol.status.slice(1)}
                  </span>
                </div>
                {sol.status === 'pendente' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => atualizarStatusSol.mutate({ id: sol.id, status: 'atendida' })} className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-all">Marcar como atendida</button>
                    <button onClick={() => atualizarStatusSol.mutate({ id: sol.id, status: 'cancelada' })} className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-all">Cancelar</button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Modal Evento */}
      {modalEvento && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 text-lg mb-5">{modalEvento === 'novo' ? 'Novo Evento' : 'Editar Evento'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome do evento</label>
                <input value={formEvento.nome} onChange={e => setFormEvento(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Consultoria Inicial" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Duração</label>
                <div className="grid grid-cols-4 gap-2">
                  {DURACOES.map(d => (
                    <button key={d} onClick={() => setFormEvento(p => ({ ...p, duracao_min: d }))}
                      className={cn('py-2 rounded-lg text-xs font-semibold border transition-all', formEvento.duracao_min === d ? 'bg-blue-500 text-white border-blue-500' : 'border-slate-200 text-slate-600 hover:border-blue-300')}>
                      {d < 60 ? `${d}min` : d === 60 ? '1h' : `${Math.floor(d/60)}h${d%60 ? d%60+'min' : ''}`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Local</label>
                <div className="flex gap-2">
                  {['zoom', 'meet', 'personalizado'].map(t => (
                    <button key={t} onClick={() => setFormEvento(p => ({ ...p, local_tipo: t }))}
                      className={cn('flex-1 py-2 rounded-lg text-xs font-semibold border transition-all', formEvento.local_tipo === t ? 'bg-blue-500 text-white border-blue-500' : 'border-slate-200 text-slate-600')}>
                      {t === 'zoom' ? 'Zoom' : t === 'meet' ? 'Google Meet' : 'Personalizado'}
                    </button>
                  ))}
                </div>
                {(formEvento.local_tipo === 'zoom' || formEvento.local_tipo === 'personalizado') && (
                  <input value={formEvento.local_link} onChange={e => setFormEvento(p => ({ ...p, local_link: e.target.value }))} placeholder="Link ou descrição" className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Limite por dia</label>
                <div className="grid grid-cols-5 gap-2">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setFormEvento(p => ({ ...p, limite_dia: n }))}
                      className={cn('py-2 rounded-lg text-xs font-semibold border transition-all', formEvento.limite_dia === n ? 'bg-blue-500 text-white border-blue-500' : 'border-slate-200 text-slate-600')}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-t border-slate-100">
                <div><p className="text-sm font-semibold text-slate-700">Visível</p><p className="text-xs text-slate-400">Aparecer para clientes</p></div>
                <button onClick={() => setFormEvento(p => ({ ...p, visivel: !p.visivel }))}
                  className={cn('w-11 h-6 rounded-full transition-all relative', formEvento.visivel ? 'bg-blue-500' : 'bg-slate-200')}>
                  <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all', formEvento.visivel ? 'left-5' : 'left-0.5')} />
                </button>
              </div>
              {!formEvento.visivel && (
                <div className="flex items-center justify-between py-3 border-t border-slate-100">
                  <div><p className="text-sm font-semibold text-slate-700">Permitir interesse</p><p className="text-xs text-slate-400">Cliente pode solicitar esse evento</p></div>
                  <button onClick={() => setFormEvento(p => ({ ...p, permite_interesse: !p.permite_interesse }))}
                    className={cn('w-11 h-6 rounded-full transition-all relative', formEvento.permite_interesse ? 'bg-blue-500' : 'bg-slate-200')}>
                    <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all', formEvento.permite_interesse ? 'left-5' : 'left-0.5')} />
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalEvento(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Cancelar</button>
              <button onClick={() => salvarEvento.mutate()} disabled={salvarEvento.isPending}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60">
                {salvarEvento.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card de agendamento ────────────────────────────────────
function AgendamentoCard({ ag, onStatus, onChamada, onEntrarChamada }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-xl mb-3 overflow-hidden">
      <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={() => setAberto(a => !a)}>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-800 text-sm">{ag.calendario_contatos?.nome || 'Cliente'}</p>
            {ag.chamada_ativa && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                <Video className="w-3 h-3" /> Sala ativa
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{ag.calendario_eventos?.nome} · {new Date(ag.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', STATUS_COR[ag.status])}>{STATUS_LABEL[ag.status]}</span>
          <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', aberto && 'rotate-180')} />
        </div>
      </div>
      {aberto && (
        <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">

          {/* Controle de Videochamada */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <Video className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-800">Videochamada</p>
              <p className="text-xs text-blue-600">{ag.chamada_ativa ? 'Sala ativa — cliente pode entrar' : 'Sala inativa'}</p>
            </div>
            <div className="flex items-center gap-2">
              {ag.chamada_ativa && (
                <button onClick={onEntrarChamada}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-all">
                  Entrar
                </button>
              )}
              <button onClick={() => onChamada(!ag.chamada_ativa)}
                className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border',
                  ag.chamada_ativa ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50')}>
                {ag.chamada_ativa ? 'Desativar' : 'Ativar sala'}
              </button>
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-slate-500">
            <Phone className="w-3 h-3 inline mr-1" />{ag.calendario_contatos?.whatsapp} &nbsp;·&nbsp;
            <Clock className="w-3 h-3 inline mr-1" />{ag.duracao_min} min &nbsp;·&nbsp;
            <MapPin className="w-3 h-3 inline mr-1" />{ag.local_tipo}
            {ag.google_event_id && <span className="ml-2 text-emerald-600 font-semibold">· ✓ Google Agenda</span>}
          </p>
          {ag.local_link && <a href={ag.local_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline block">{ag.local_link}</a>}

          {/* Botões de status */}
          <div className="flex gap-2 flex-wrap">
            {['confirmado', 'realizado', 'reagendado', 'cancelado'].map(s => (
              <button key={s} onClick={() => onStatus(s)} disabled={ag.status === s}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                  ag.status === s ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400' :
                  s === 'cancelado' ? 'border-red-200 text-red-600 hover:bg-red-50' :
                  s === 'realizado' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' :
                  'border-blue-200 text-blue-600 hover:bg-blue-50')}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
