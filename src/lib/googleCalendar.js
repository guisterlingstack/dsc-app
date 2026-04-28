// ── Google Calendar Integration ────────────────────────────
const CLIENT_ID     = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES        = 'https://www.googleapis.com/auth/calendar.events';
const STORAGE_KEY   = 'dsc_google_token';

// ── Salva token no localStorage ────────────────────────────
export function saveGoogleToken(token) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
}

export function getGoogleToken() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch { return null; }
}

export function clearGoogleToken() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isGoogleConnected() {
  const token = getGoogleToken();
  if (!token) return false;
  // Verifica se não expirou
  return token.expires_at > Date.now();
}

// ── Inicia fluxo OAuth Google ──────────────────────────────
export function connectGoogle() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  window.location.origin + '/CalendarioAdmin',
    response_type: 'token',
    scope:         SCOPES,
    prompt:        'consent',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ── Processa token do redirect OAuth ──────────────────────
export function handleGoogleCallback() {
  const hash = window.location.hash.substring(1);
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const expiresIn   = params.get('expires_in');
  if (!accessToken) return false;

  saveGoogleToken({
    access_token: accessToken,
    expires_at:   Date.now() + parseInt(expiresIn) * 1000,
  });

  // Limpa o hash da URL
  window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}

// ── Cria evento no Google Agenda ───────────────────────────
export async function criarEventoGoogle({ titulo, dataHora, duracaoMin, localLink, descricao }) {
  const token = getGoogleToken();
  if (!token) throw new Error('Google não conectado');

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
        { method: 'email',  minutes: 60 },
        { method: 'popup',  minutes: 15 },
      ],
    },
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(evento),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    if (err.error?.code === 401) {
      clearGoogleToken();
      throw new Error('Token expirado. Reconecte o Google.');
    }
    throw new Error('Erro ao criar evento no Google Agenda');
  }

  const data = await res.json();
  return data.id; // retorna o ID do evento criado
}

// ── Atualiza evento no Google Agenda ──────────────────────
export async function atualizarEventoGoogle(googleEventId, updates) {
  const token = getGoogleToken();
  if (!token || !googleEventId) return;

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method:  'PATCH',
      headers: {
        Authorization:  `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );
}

// ── Cancela evento no Google Agenda ───────────────────────
export async function cancelarEventoGoogle(googleEventId) {
  const token = getGoogleToken();
  if (!token || !googleEventId) return;

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method:  'PATCH',
      headers: {
        Authorization:  `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelled' }),
    }
  );
}
