import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { WebRTCManager } from '@/lib/webrtc';
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff, Loader2, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

const CANTOS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
const CANTO_CLASSES = {
  'bottom-right': 'bottom-4 right-4',
  'bottom-left':  'bottom-4 left-4',
  'top-right':    'top-4 right-4',
  'top-left':     'top-4 left-4',
};

export default function Videochamada() {
  const { salaId }          = useParams();
  const { user, isLoading } = useAuth();
  const navigate            = useNavigate();
  const isAdmin             = ['admin', 'admin_master'].includes(user?.role);

  const localVideoRef       = useRef(null);
  const remoteVideoRef      = useRef(null);
  const telaVideoRef        = useRef(null);
  const managerRef          = useRef(null);
  const telaStreamRef       = useRef(null);

  const [estado, setEstado]           = useState('aguardando');
  const [micAtivo, setMicAtivo]       = useState(true);
  const [camAtiva, setCamAtiva]       = useState(true);
  const [telaAtiva, setTelaAtiva]     = useState(false);
  const [erro, setErro]               = useState('');
  const [agendamento, setAgendamento] = useState(null);
  const [iniciado, setIniciado]       = useState(false);
  const [cantoLocal, setCantoLocal]   = useState('bottom-right');
  const [cantoRemoto, setCantoRemoto] = useState('bottom-left');

  // Busca agendamento
  useEffect(() => {
    if (!salaId) return;
    supabase
      .from('calendario_agendamentos')
      .select('*, calendario_eventos(nome), calendario_contatos(nome)')
      .eq('chamada_sala_id', salaId)
      .maybeSingle()
      .then(({ data }) => setAgendamento(data));
  }, [salaId]);

  // Inicia WebRTC
  useEffect(() => {
    if (!salaId || !user || isLoading || iniciado) return;
    setIniciado(true);

    const manager = new WebRTCManager({
      salaId,
      userId: user.id,
      isAdmin,
      onRemoteStream: (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
        setEstado('conectado');
      },
      onConnectionChange: (state) => {
        if (state === 'connected')    setEstado('conectado');
        if (state === 'disconnected') setEstado('encerrado');
        if (state === 'failed')       setEstado('erro');
      },
    });

    managerRef.current = manager;

    const iniciar = async () => {
      try {
        setEstado('conectando');
        // Inicia apenas com câmera e microfone — sem tela automática
        const stream = await manager.iniciar({ video: true, audio: true, tela: false });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setErro('Permissão de câmera/microfone negada. Verifique as configurações do navegador.');
        } else if (err.name === 'NotFoundError') {
          setErro('Câmera ou microfone não encontrado.');
        } else {
          setErro('Erro ao iniciar videochamada: ' + err.message);
        }
        setEstado('erro');
      }
    };

    iniciar();
    return () => { manager.encerrar(); };
  }, [salaId, user, isLoading, isAdmin, iniciado]);

  // Compartilhar tela (só admin)
  async function toggleTela() {
    if (!isAdmin) return;

    if (telaAtiva) {
      // Para o compartilhamento
      if (telaStreamRef.current) {
        telaStreamRef.current.getTracks().forEach(t => t.stop());
        telaStreamRef.current = null;
      }
      if (telaVideoRef.current) telaVideoRef.current.srcObject = null;
      setTelaAtiva(false);
      return;
    }

    try {
      const telaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });

      telaStreamRef.current = telaStream;
      if (telaVideoRef.current) {
        telaVideoRef.current.srcObject = telaStream;
      }
      setTelaAtiva(true);

      // Quando o usuário parar pelo botão nativo do navegador
      telaStream.getVideoTracks()[0].onended = () => {
        telaStreamRef.current = null;
        if (telaVideoRef.current) telaVideoRef.current.srcObject = null;
        setTelaAtiva(false);
      };

      // Adiciona a track de tela na conexão WebRTC
      if (managerRef.current?.pc && managerRef.current?.localStream) {
        const sender = managerRef.current.pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(telaStream.getVideoTracks()[0]);
        }
      }
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setErro('Erro ao compartilhar tela: ' + err.message);
      }
    }
  }

  // Volta para câmera após parar tela
  useEffect(() => {
    if (!telaAtiva && managerRef.current?.pc && managerRef.current?.localStream) {
      const camTrack = managerRef.current.localStream.getVideoTracks()[0];
      const sender = managerRef.current.pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && camTrack) sender.replaceTrack(camTrack);
    }
  }, [telaAtiva]);

  // Alterna canto das câmeras flutuantes
  function proximoCanto(cantoAtual, setCanto) {
    const idx = CANTOS.indexOf(cantoAtual);
    setCanto(CANTOS[(idx + 1) % CANTOS.length]);
  }

  async function encerrar() {
    if (telaStreamRef.current) telaStreamRef.current.getTracks().forEach(t => t.stop());
    if (managerRef.current) await managerRef.current.encerrar();
    if (isAdmin && agendamento?.id) {
      await supabase.from('calendario_agendamentos').update({
        chamada_ativa: false, chamada_sala_id: null,
      }).eq('id', agendamento.id);
    }
    navigate(-1);
  }

  function toggleMic() {
    const ativo = managerRef.current?.toggleMicrofone();
    if (ativo !== undefined) setMicAtivo(ativo);
  }

  function toggleCam() {
    const ativo = managerRef.current?.toggleCamera();
    if (ativo !== undefined) setCamAtiva(ativo);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) { navigate('/login'); return null; }

  if (estado === 'erro') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 bg-red-900 rounded-2xl flex items-center justify-center mb-4">
          <VideoOff className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">Erro na videochamada</h2>
        <p className="text-slate-400 text-sm max-w-sm mb-6">{erro}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all">Voltar</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 flex-shrink-0">
        <div>
          <p className="text-white font-bold text-sm">{agendamento?.calendario_eventos?.nome || 'Videochamada'}</p>
          <p className="text-slate-400 text-xs mt-0.5">{agendamento?.calendario_contatos?.nome || ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {estado === 'conectando' && <div className="flex items-center gap-2 text-amber-400 text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" />Conectando...</div>}
          {estado === 'conectado'  && <div className="flex items-center gap-1.5 text-emerald-400 text-xs"><div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />Conectado</div>}
          {estado === 'aguardando' && <div className="flex items-center gap-1.5 text-slate-400 text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" />Aguardando...</div>}
        </div>
      </div>

      {/* Área principal */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden">

        {/* ── MODO TELA COMPARTILHADA (admin) ── */}
        {telaAtiva && (
          <>
            {/* Tela em tela cheia */}
            <video ref={telaVideoRef} autoPlay playsInline className="w-full h-full object-contain bg-black" />

            {/* Câmera local flutuante */}
            <div className={cn('absolute z-20 w-36 h-28 lg:w-44 lg:h-32 rounded-xl overflow-hidden border-2 border-slate-600 shadow-2xl bg-slate-800 group', CANTO_CLASSES[cantoLocal])}>
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!camAtiva && <div className="absolute inset-0 bg-slate-800 flex items-center justify-center"><VideoOff className="w-5 h-5 text-slate-500" /></div>}
              <div className="absolute bottom-1 left-1"><span className="text-xs text-white bg-black/60 px-1.5 py-0.5 rounded">Você</span></div>
              <button onClick={() => proximoCanto(cantoLocal, setCantoLocal)}
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Move className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* Câmera remota flutuante */}
            <div className={cn('absolute z-20 w-36 h-28 lg:w-44 lg:h-32 rounded-xl overflow-hidden border-2 border-blue-500 shadow-2xl bg-slate-800 group', CANTO_CLASSES[cantoRemoto])}>
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-1 left-1"><span className="text-xs text-white bg-black/60 px-1.5 py-0.5 rounded">Cliente</span></div>
              <button onClick={() => proximoCanto(cantoRemoto, setCantoRemoto)}
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Move className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* Badge tela ativa */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-blue-500/90 rounded-full text-xs text-white font-semibold z-30">
              <Monitor className="w-3.5 h-3.5" />
              Compartilhando tela
            </div>
          </>
        )}

        {/* ── MODO CÂMERAS (sem tela compartilhada) ── */}
        {!telaAtiva && (
          <>
            {/* Câmera remota em tela cheia */}
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

            {/* Placeholder aguardando */}
            {estado !== 'conectado' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Video className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm">{estado === 'conectando' ? 'Iniciando câmera...' : 'Aguardando conexão...'}</p>
              </div>
            )}

            {/* Câmera local miniatura */}
            <div className="absolute bottom-4 right-4 w-36 h-28 lg:w-48 lg:h-36 rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl bg-slate-800">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!camAtiva && <div className="absolute inset-0 bg-slate-800 flex items-center justify-center"><VideoOff className="w-6 h-6 text-slate-500" /></div>}
              <div className="absolute bottom-1.5 left-1.5"><span className="text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">{isAdmin ? 'Você (Admin)' : 'Você'}</span></div>
            </div>
          </>
        )}
      </div>

      {/* Controles */}
      <div className="flex items-center justify-center gap-3 py-5 bg-slate-950 border-t border-slate-800 flex-shrink-0">

        {/* Microfone */}
        <button onClick={toggleMic}
          className={cn('w-12 h-12 rounded-full flex items-center justify-center transition-all',
            micAtivo ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white')}>
          {micAtivo ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Câmera */}
        <button onClick={toggleCam}
          className={cn('w-12 h-12 rounded-full flex items-center justify-center transition-all',
            camAtiva ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white')}>
          {camAtiva ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Encerrar */}
        <button onClick={encerrar}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg">
          <PhoneOff className="w-6 h-6" />
        </button>

        {/* Compartilhar tela — só admin */}
        {isAdmin && (
          <button onClick={toggleTela}
            className={cn('w-12 h-12 rounded-full flex items-center justify-center transition-all',
              telaAtiva ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white')}>
            {telaAtiva ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
