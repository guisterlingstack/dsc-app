// ── Google Calendar Integration v2 ──────────────────────────
// Authorization code flow: refresh token fica no servidor
// (Edge Function google-oauth). O navegador só recebe access
// tokens curtos, renovados automaticamente.

import { supabase } from '@/lib/supabaseClient';

const CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SCOPES       = 'https://www.googleapis.com/auth/calendar.events';
const CACHE_KEY    = 'dsc_google_access';    // cache do access token curto
const FLAG_KEY     = 'dsc_google_connected'; // flag de UI

export class GoogleRevokedError extends Error {}

// ── Chama a Edge Function google-oauth ─────────────────────
async function chamarOAuth(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ── Estado de conexão (síncrono, para UI) ───────────────────
export function isGoogleConnected() {
  return localStorage.getItem(FLAG_KEY) === 'true';
}

// ── Inicia o fluxo OAuth (authorization code) ───────────────
export function connectGoogle() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  window.location.origin + '/CalendarioAdmin',
    response_type: 'code',
    access_type:   'offline',   // garante refresh_token
    prompt:        'consent',   // garante refresh_token mesmo em reconexão
    scope:         SCOPES,
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ── Processa o ?code= do redirect (assíncrono) ──────────────
export async function handleGoogleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return false;

  // Limpa a URL imediatamente (evita reprocessar o código)
  window.history.replaceState({}, document.title, window.location.pathname);

  const r = await chamarOAuth({
    action:       'exchange',
    code,
    redirect_uri: window.location.origin + '/CalendarioAdmin',
  });

  if (!r.success) throw new Error(r.error || 'Falha ao conectar o Google');

  localStorage.setItem(FLAG_KEY, 'true');
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    access_token: r.access_token,
    expires_at:   r.expires_at,
  }));
  return true;
}

// ── Desconecta (revoga no Google + apaga do banco) ──────────
export async function disconnectGoogle() {
  try { await chamarOAuth({ action: 'disconnect' }); } finally {
    localStorage.removeItem(FLAG_KEY);
    localStorage.removeItem(CACHE_KEY);
  }
}

// ── Obtém access token válido (renova se preciso) ───────────
async function getValidAccessToken() {
  // 1. Cache local ainda válido? (margem de 30s)
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cache && new Date(cache.expires_at) > new Date(Date.now() + 30000)) {
      return cache.access_token;
    }
  } catch {}

  // 2. Pede à Edge Function (que renova com o refresh token)
  const r = await chamarOAuth({ action: 'refresh' });

  if (!r.success) {
    localStorage.removeItem(FLAG_KEY);
    localStorage.removeItem(CACHE_KEY);
    if (r.error === 'revoked') {
      throw new GoogleRevokedError('A permissão foi revogada na conta Google. Reconecte a agenda.');
    }
    throw new Error('Google Agenda não conectado');
  }

  localStorage.setItem(FLAG_KEY, 'true');
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    access_token: r.access_token,
    expires_at:   r.expires_at,
  }));
  return r.access_token;
}

// ── Fetch autenticado com retry após 401 ────────────────────
async function googleFetch(url, options = {}, tentativa = 0) {
  const token = await getValidAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
  });

  // Token invalidado no meio do caminho → força renovação e tenta 1x
  if (res.status === 401 && tentativa === 0) {
    localStorage.removeItem(CACHE_KEY);
    return googleFetch(url, options, 1);
  }
  return res;
}

// ── Cria evento no Google Agenda ─────────────────────────────
export async function criarEventoGoogle({ titulo, dataHora, duracaoMin, localLink, descricao }) {
  const inicio = new Date(dataHora);
  const fim    = new Date(inicio.getTime() + duracaoMin * 60000);

  const evento = {
    summary:     titulo,
    description: descricao || '',
    start: { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: fim.toISOString(),    timeZone: 'America/Sao_Paulo' },
    ...(localLink ? { location: localLink } : {}),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
  };

  const res = await googleFetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    { method: 'POST', body: JSON.stringify(evento) }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Erro ao criar evento no Google Agenda');
  }

  const data = await res.json();
  return data.id;
}

// ── Atualiza evento (para futuras edições de data/hora) ──────
export async function atualizarEventoGoogle(googleEventId, { titulo, dataHora, duracaoMin, localLink, descricao }) {
  if (!googleEventId) return;

  const patch = {};
  if (titulo)    patch.summary     = titulo;
  if (descricao !== undefined) patch.description = descricao;
  if (localLink) patch.location    = localLink;
  if (dataHora && duracaoMin) {
    const inicio = new Date(dataHora);
    const fim    = new Date(inicio.getTime() + duracaoMin * 60000);
    patch.start = { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' };
    patch.end   = { dateTime: fim.toISOString(),    timeZone: 'America/Sao_Paulo' };
  }

  const res = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Erro ao atualizar evento no Google Agenda');
  }
}

// ── Cancela evento no Google Agenda ──────────────────────────
export async function cancelarEventoGoogle(googleEventId) {
  if (!googleEventId) return;

  const res = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }
  );

  // 404/410 = evento já não existe no Google — ignora
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Erro ao cancelar evento no Google Agenda');
  }
}
