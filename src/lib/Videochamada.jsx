import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { WebRTCManager } from '@/lib/webrtc';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Videochamada() {
  const { salaId }  = useParams();
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const isAdmin     = ['admin', 'admin_master'].includes(user?.role);

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const managerRef     = useRef(null);

  const [estado, setEstado]   = useState('aguardando'); // aguardando | conectando | conectado | encerrado | erro
  const [micAtivo, setMicAtivo]     = useState(true);
  const [camAtiva, setCamAtiva]     = useState(true);
  const [telaAtiva, setTelaAtiva]   = useState(false);
  const [erro, setErro]             = useState('');
  const [agendamento, setAgendamento] = useState(null);

  // Busca dados do agendamento
  useEffect(() => {
    if (!salaId) return;
    supabase
      .from('calendario_agendamentos')
      .select('*, calendario_eventos(nome), calendario_contatos(nome)')
      .eq('chamada_sala_id', salaId)
      .maybeSingle()
      .then(({ data }) => setAgendamento(data));
  }, [salaId]);

  // Inicia WebRTC ao montar
  useEffect(() => {
    if (!salaId || !user) return;

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
        if (state === 'connected')     setEstado('conectado');
        if (state === 'disconnected')  setEstado('encerrado');
        if (state === 'failed')        setEstado('erro');
      },
    });

    managerRef.current = manager;

    const iniciar = async () => {
      try {
        setEstado('conectando');
        const stream = await manager.iniciar({
          video: true,
          audio: true,
          tela:  isAdmin, // admin compartilha tela por padrão
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error(err);
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

    return () => {
      manager.encerrar();
    };
  }, [salaId, user, isAdmin]);

  // Encerra chamada
  async function encerrar() {
    if (managerRef.current) await managerRef.current.encerrar();

    // Admin desativa a chamada no banco
    if (isAdmin && agendamento?.id) {
      await supabase.from('calendario_agendamentos').update({
        chamada_ativa:   false,
        chamada_sala_id: null,
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

  // ── Tela de erro ────────────────────────────────────────────
  if (estado === 'erro') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 bg-red-900 rounded-2xl flex items-center justify-center mb-4">
          <VideoOff className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">Erro na videochamada</h2>
        <p className="text-slate-400 text-sm max-w-sm mb-6">{erro}</p>
        <button onClick={() => navigate(-1)}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all">
          Voltar
        </button>
      </div>
    );
  }

  // ── Sala de chamada ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div>
          <p className="text-white font-bold text-sm">
            {agendamento?.calendario_eventos?.nome || 'Videochamada'}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {agendamento?.calendario_contatos?.nome || ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {estado === 'conectando' && (
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Conectando...
            </div>
          )}
          {estado === 'conectado' && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Conectado
            </div>
          )}
          {estado === 'aguardando' && (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Aguardando outro participante...
            </div>
          )}
        </div>
      </div>

      {/* Vídeos */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden">

        {/* Vídeo remoto (tela cheia) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Placeholder quando aguardando */}
        {estado !== 'conectado' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Video className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">
              {estado === 'conectando' ? 'Iniciando câmera...' : 'Aguardando conexão...'}
            </p>
          </div>
        )}

        {/* Vídeo local (miniatura) */}
        <div className="absolute bottom-4 right-4 w-36 h-28 lg:w-48 lg:h-36 rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl bg-slate-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!camAtiva && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
              <VideoOff className="w-6 h-6 text-slate-500" />
            </div>
          )}
          <div className="absolute bottom-1.5 left-1.5">
            <span className="text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
              {isAdmin ? 'Você (Admin)' : 'Você'}
            </span>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center justify-center gap-4 py-6 bg-slate-950 border-t border-slate-800">

        {/* Microfone */}
        <button
          onClick={toggleMic}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all',
            micAtivo ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
          )}>
          {micAtivo ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Câmera */}
        <button
          onClick={toggleCam}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all',
            camAtiva ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
          )}>
          {camAtiva ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Encerrar */}
        <button
          onClick={encerrar}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg">
          <PhoneOff className="w-6 h-6" />
        </button>

        {/* Info tela compartilhada (só admin) */}
        {isAdmin && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-xl text-xs text-slate-400">
            <Monitor className="w-4 h-4 text-emerald-400" />
            Tela compartilhada
          </div>
        )}
      </div>
    </div>
  );
}
