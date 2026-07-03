// ── WebRTC via Supabase Realtime ──────────────────────────────
// Sinalização peer-to-peer para 2 participantes (admin + cliente)
// v2: handshake de presença + fila de ICE candidates

import { supabase } from '@/lib/supabaseClient';

export class WebRTCManager {
  constructor({ salaId, userId, isAdmin, onRemoteStream, onConnectionChange }) {
    this.salaId             = salaId;
    this.userId             = userId;
    this.isAdmin            = isAdmin;
    this.onRemoteStream     = onRemoteStream;
    this.onConnectionChange = onConnectionChange;

    this.pc                = null;
    this.localStream       = null;
    this.channel           = null;
    this.pendingCandidates = []; // ICE que chegam antes da remoteDescription
    this.remoteSet         = false;
    this.encerrado         = false;
  }

  // ── Inicializa conexão ──────────────────────────────────────
  async iniciar({ video = true, audio = true }) {
    this.localStream = await navigator.mediaDevices.getUserMedia({ video, audio });

    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.localStream.getTracks().forEach(track => {
      this.pc.addTrack(track, this.localStream);
    });

    this.pc.ontrack = (event) => {
      if (this.onRemoteStream) this.onRemoteStream(event.streams[0]);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.onConnectionChange) this.onConnectionChange(this.pc.connectionState);
    };

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this._enviar({ tipo: 'ice', candidate: candidate.toJSON(), de: this.userId });
      }
    };

    // Canal de sinalização
    this.channel = supabase.channel(`videochamada:${this.salaId}`, {
      config: { broadcast: { self: false } },
    });

    this.channel.on('broadcast', { event: 'sinal' }, ({ payload }) => {
      this._processarSinal(payload);
    });

    await this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Handshake de presença:
        // - cliente anuncia "entrei" → admin envia oferta
        // - admin anuncia "admin-pronto" → cliente (se já estava) reenvia "entrei"
        if (this.isAdmin) {
          this._enviar({ tipo: 'admin-pronto', de: this.userId });
        } else {
          this._enviar({ tipo: 'entrei', de: this.userId });
        }
      }
    });

    return this.localStream;
  }

  _enviar(payload) {
    try {
      this.channel?.send({ type: 'broadcast', event: 'sinal', payload });
    } catch (e) {
      console.warn('Falha ao enviar sinal:', e);
    }
  }

  // ── Admin cria/reenvia oferta ───────────────────────────────
  async _criarOferta() {
    // Não recria se já conectado
    if (['connected', 'connecting'].includes(this.pc.connectionState)) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.remoteSet = false;
    this._enviar({ tipo: 'oferta', sdp: offer, de: this.userId });
  }

  async _aplicarRemota(sdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.remoteSet = true;
    // Descarrega ICE candidates que chegaram cedo demais
    for (const c of this.pendingCandidates) {
      try { await this.pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    this.pendingCandidates = [];
  }

  // ── Processa sinais recebidos ───────────────────────────────
  async _processarSinal({ tipo, sdp, candidate, de }) {
    if (de === this.userId || this.encerrado) return;

    try {
      if (tipo === 'entrei' && this.isAdmin) {
        // Cliente entrou (agora ou reentrou) → admin envia a oferta
        await this._criarOferta();

      } else if (tipo === 'admin-pronto' && !this.isAdmin) {
        // Admin entrou depois do cliente → cliente se anuncia novamente
        this._enviar({ tipo: 'entrei', de: this.userId });

      } else if (tipo === 'oferta' && !this.isAdmin) {
        await this._aplicarRemota(sdp);
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this._enviar({ tipo: 'resposta', sdp: answer, de: this.userId });

      } else if (tipo === 'resposta' && this.isAdmin) {
        if (this.pc.signalingState === 'have-local-offer') {
          await this._aplicarRemota(sdp);
        }

      } else if (tipo === 'ice') {
        if (this.remoteSet) {
          try { await this.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
        } else {
          this.pendingCandidates.push(candidate); // guarda para depois
        }

      } else if (tipo === 'encerrar') {
        if (this.onConnectionChange) this.onConnectionChange('disconnected');
      }
    } catch (err) {
      console.error('Erro ao processar sinal:', err);
    }
  }

  // ── Encerra conexão ─────────────────────────────────────────
  async encerrar() {
    if (this.encerrado) return;
    this.encerrado = true;

    this._enviar({ tipo: 'encerrar', de: this.userId });

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  toggleMicrofone() {
    const audio = this.localStream?.getAudioTracks()[0];
    if (audio) { audio.enabled = !audio.enabled; return audio.enabled; }
    return false;
  }

  toggleCamera() {
    const video = this.localStream?.getVideoTracks()[0];
    if (video) { video.enabled = !video.enabled; return video.enabled; }
    return false;
  }
}
