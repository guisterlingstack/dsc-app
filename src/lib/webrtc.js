// ── WebRTC via Supabase Realtime ──────────────────────────────
// Sinalização peer-to-peer sem servidor de mídia externo
// Funciona para 2 participantes (admin + cliente)

import { supabase } from '@/lib/supabaseClient';

export class WebRTCManager {
  constructor({ salaId, userId, isAdmin, onRemoteStream, onConnectionChange }) {
    this.salaId        = salaId;
    this.userId        = userId;
    this.isAdmin       = isAdmin;
    this.onRemoteStream    = onRemoteStream;
    this.onConnectionChange = onConnectionChange;

    this.pc          = null; // RTCPeerConnection
    this.localStream = null;
    this.channel     = null; // Supabase Realtime channel
  }

  // ── Inicializa conexão ──────────────────────────────────────
  async iniciar({ video = true, audio = true, tela = false }) {
    try {
      // Pede permissões de mídia
      if (tela) {
        const telaStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const micStream  = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const tracks     = [...telaStream.getTracks(), ...micStream.getAudioTracks()];
        this.localStream = new MediaStream(tracks);
      } else {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video, audio });
      }

      // Cria peer connection
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Adiciona tracks locais
      this.localStream.getTracks().forEach(track => {
        this.pc.addTrack(track, this.localStream);
      });

      // Quando receber stream remoto
      this.pc.ontrack = (event) => {
        if (this.onRemoteStream) {
          this.onRemoteStream(event.streams[0]);
        }
      };

      // Monitora estado da conexão
      this.pc.onconnectionstatechange = () => {
        if (this.onConnectionChange) {
          this.onConnectionChange(this.pc.connectionState);
        }
      };

      // Inscreve no canal de sinalização via Supabase Realtime
      this.channel = supabase.channel(`videochamada:${this.salaId}`, {
        config: { broadcast: { self: false } },
      });

      this.channel.on('broadcast', { event: 'sinal' }, ({ payload }) => {
        this._processarSinal(payload);
      });

      await this.channel.subscribe();

      // ICE candidates — envia para o outro participante
      this.pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.channel.send({
            type: 'broadcast',
            event: 'sinal',
            payload: { tipo: 'ice', candidate: candidate.toJSON(), de: this.userId },
          });
        }
      };

      // Admin cria a oferta, cliente aguarda
      if (this.isAdmin) {
        await this._criarOferta();
      }

      return this.localStream;
    } catch (err) {
      console.error('Erro ao iniciar WebRTC:', err);
      throw err;
    }
  }

  // ── Admin cria oferta ───────────────────────────────────────
  async _criarOferta() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.channel.send({
      type: 'broadcast',
      event: 'sinal',
      payload: { tipo: 'oferta', sdp: offer, de: this.userId },
    });
  }

  // ── Processa sinais recebidos ───────────────────────────────
  async _processarSinal({ tipo, sdp, candidate, de }) {
    if (de === this.userId) return; // ignora próprios sinais

    try {
      if (tipo === 'oferta') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.channel.send({
          type: 'broadcast',
          event: 'sinal',
          payload: { tipo: 'resposta', sdp: answer, de: this.userId },
        });
      } else if (tipo === 'resposta') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } else if (tipo === 'ice') {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else if (tipo === 'encerrar') {
        this.encerrar();
      }
    } catch (err) {
      console.error('Erro ao processar sinal:', err);
    }
  }

  // ── Encerra conexão ─────────────────────────────────────────
  async encerrar() {
    // Avisa o outro participante
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'sinal',
        payload: { tipo: 'encerrar', de: this.userId },
      });
    }

    // Para tracks locais
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    // Fecha peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Remove canal
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  // ── Ativa/desativa microfone ────────────────────────────────
  toggleMicrofone() {
    if (!this.localStream) return false;
    const audio = this.localStream.getAudioTracks()[0];
    if (audio) { audio.enabled = !audio.enabled; return audio.enabled; }
    return false;
  }

  // ── Ativa/desativa câmera ───────────────────────────────────
  toggleCamera() {
    if (!this.localStream) return false;
    const video = this.localStream.getVideoTracks()[0];
    if (video) { video.enabled = !video.enabled; return video.enabled; }
    return false;
  }
}
