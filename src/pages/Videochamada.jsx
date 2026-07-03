import React, { useState, useEffect, useRef } from 'react';
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
  'top-right':    'top-16 right-4',
  'top-left':     'top-16 left-4',
};

export default function Videochamada() {
  const { salaId }          = useParams();
  const { user, isLoading } = useAuth();
  const navigate            = useNavigate();
  const isAdmin             = ['admin', 'admin_master'].includes(user?.role);

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const telaVideoRef   = useRef(null);
  const managerRef     = useRef(null);
  const telaStreamRef  = useRef(null);
  const iniciadoRef    = useRef(false);

  const [estado, setEstado]           = useState('aguardando');
  const [micAtivo, setMicAtivo]       = useState(true);
  const [camAtiva, setCamAtiva]       = useState(true);
  const [telaAtiva, setTelaAtiva]     = useState(false);
  const [erro, setErro]               = useState('');
  const [agendamento, setAgendamento] = useState(null);
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
    if (!salaId || !user?.id || isLoading || iniciadoRef.current) return;
    iniciadoRef.current = true;

    const manager = new WebRTCManager({
      salaId,
      userId: user.id,
      isAdmin,
      onRemoteStream: (stream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
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
        const stream = await manager.iniciar({ video: true, audio: true });
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setEstado('aguardando');
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
    // deps estáveis: user?.id (string) em vez do objeto user, sem state no array —
    // evita re-execução do efeito que disparava o cleanup e matava a conexão
  }, [salaId, user?.id, isLoading]);

  // ── Compartilhar tela (só admin) ────────────────────────────
  async function toggleTela() {
    if (!isAdmin) return;

    // Desativar
    if (telaAtiva) {
      pararTela();
      return;
    }

    // Ativar
    try {
      const telaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });

      telaStreamRef.current = telaStream;
      if (telaVideoRef.current) telaVideoRef.current.srcObject = telaStream;

      // Envia a tela no lugar da câmera para o cliente
      const sender = managerRef.current?.pc?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(telaStream.getVideoTracks()[0]);

      // Se o usuário parar pelo botão nativo do navegador
      telaStream.getVideoTracks()[0].onended = () => pararTela();

      setTelaAtiva(true);
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setErro('Erro ao compartilhar tela: ' + err.message);
        setEstado('erro');
      }
    }
  }

  function pararTela() {
    if (telaStreamRef.current) {
      telaStreamRef.current.getTracks().forEach(t => t.stop());
      telaStreamRef.current = null;
    }
    if (telaVideoRef.current) telaVideoRef.current.srcObject = null;

    // Volta a enviar a câmera para o cliente
    const camTrack = managerRef.current?.localStream?.getVideoTracks()[0];
    const sender   = managerRef.current?.pc?.getSenders().find(s => s.track?.kind === 'video');
    if (sender && camTrack) sender.replaceTrack(camTrack);

    setTelaAtiva(false);
  }

  // ── Move miniatura pulando o canto ocupado pela outra ──────
  function proximoCanto(cantoAtual, cantoOcupado, setCanto) {
    const idx = CANTOS.indexOf(cantoAtual);
    for (let i = 1; i <= CANTOS.length; i++) {
      const prox = CANTOS[(idx + i) % CANTOS.length];
      if (prox !== cantoOcupado) { setCanto(prox); return; }
    }
  }

  async function encerrar() {
    if (telaStreamRef.current) telaStreamRef.current.getTracks().forEach(t => t.stop());
    if (managerRef.current) await managerRef.current.encerrar();
    if (isAdmin && agendamento?.id) {
      await supabase.from('calendario_agendamentos').update({
        chamada_ativa: false, chamada_sala_id: null,
      }).eq('id', agendamento.id);
    }
    navigate(isAdmin ? '/CalendarioAdmin' : '/CalendarioCliente');
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
        <button onClick={() => navigate(isAdmin ? '/CalendarioAdmin' : '/CalendarioCliente')}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all">
          Voltar
        </button>
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
          {estado === 'aguardando' && <div className="flex items-center gap-1.5 text-slate-400 text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" />Aguardando outro participante...</div>}
          {estado === 'encerrado'  && <div className="text-slate-400 text-xs">Chamada encerrada</div>}
        </div>
      </div>

      {/* Área de vídeos — TODOS os elementos permanecem montados,
          apenas as classes mudam. Isso evita perder o srcObject. */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden">

        {/* Tela compartilhada (sempre montada, oculta quando inativa) */}
        <video
          ref={telaVideoRef}
          autoPlay
          playsInline
          muted
          className={cn('absolute inset-0 w-full h-full object-contain bg-black', !telaAtiva && 'hidden')}
        />

        {/* Badge tela ativa */}
        {telaAtiva && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-blue-500/90 rounded-full text-xs text-white font-semibold z-30">
            <Monitor className="w-3.5 h-3.5" />
            Compartilhando tela
          </div>
        )}

        {/* Vídeo remoto — tela cheia OU miniatura flutuante */}
        <div className={cn(
          'overflow-hidden bg-slate-800 group',
          telaAtiva
            ? cn('absolute z-20 w-36 h-28 lg:w-44 lg:h-32 rounded-xl border-2 border-blue-500 shadow-2xl', CANTO_CLASSES[cantoRemoto])
            : 'absolute inset-0'
        )}>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          {telaAtiva && (
            <>
              <div className="absolute bottom-1 left-1">
                <span className="text-xs text-white bg-black/60 px-1.5 py-0.5 rounded">Cliente</span>
              </div>
              <button
                onClick={() => proximoCanto(cantoRemoto, cantoLocal, setCantoRemoto)}
                title="Mover para outro canto"
                className="absolute top-1 right-1 p-1.5 bg-black/60 hover:bg-black/85 rounded-lg transition-colors">
                <Move className="w-3.5 h-3.5 text-white" />
              </button>
            </>
          )}
        </div>

        {/* Placeholder aguardando (só no modo câmeras) */}
        {!telaAtiva && estado !== 'conectado' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Video className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">
              {estado === 'conectando' ? 'Iniciando câmera...' : 'Aguardando o outro participante entrar...'}
            </p>
          </div>
        )}

        {/* Vídeo local — sempre miniatura, posição varia com o modo */}
        <div className={cn(
          'absolute z-20 rounded-xl overflow-hidden border-2 shadow-xl bg-slate-800 group',
          telaAtiva
            ? cn('w-36 h-28 lg:w-44 lg:h-32 border-slate-600', CANTO_CLASSES[cantoLocal])
            : 'w-36 h-28 lg:w-48 lg:h-36 border-slate-700 bottom-4 right-4'
        )}>
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!camAtiva && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
              <VideoOff className="w-5 h-5 text-slate-500" />
            </div>
          )}
          <div className="absolute bottom-1 left-1">
            <span className="text-xs text-white bg-black/60 px-1.5 py-0.5 rounded">
              {isAdmin ? 'Você (Admin)' : 'Você'}
            </span>
          </div>
          {telaAtiva && (
            <button
              onClick={() => proximoCanto(cantoLocal, cantoRemoto, setCantoLocal)}
              title="Mover para outro canto"
              className="absolute top-1 right-1 p-1.5 bg-black/60 hover:bg-black/85 rounded-lg transition-colors">
              <Move className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center justify-center gap-3 py-5 bg-slate-950 border-t border-slate-800 flex-shrink-0">

        <button onClick={toggleMic}
          title={micAtivo ? 'Desativar microfone' : 'Ativar microfone'}
          className={cn('w-12 h-12 rounded-full flex items-center justify-center transition-all',
            micAtivo ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white')}>
          {micAtivo ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button onClick={toggleCam}
          title={camAtiva ? 'Desativar câmera' : 'Ativar câmera'}
          className={cn('w-12 h-12 rounded-full flex items-center justify-center transition-all',
            camAtiva ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white')}>
          {camAtiva ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button onClick={encerrar}
          title="Encerrar chamada"
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg">
          <PhoneOff className="w-6 h-6" />
        </button>

        {isAdmin && (
          <button onClick={toggleTela}
            title={telaAtiva ? 'Parar compartilhamento' : 'Compartilhar tela'}
            className={cn('w-12 h-12 rounded-full flex items-center justify-center transition-all',
              telaAtiva ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white')}>
            {telaAtiva ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
