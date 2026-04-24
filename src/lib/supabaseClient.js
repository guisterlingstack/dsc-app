import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas no .env');
}

// Storage customizado que usa localStorage + cookie como backup
const customStorage = {
  getItem: (key) => {
    try {
      // Tenta localStorage primeiro
      const value = localStorage.getItem(key);
      if (value) return value;
      // Fallback: tenta cookie
      const cookies = document.cookie.split(';');
      const cookie = cookies.find(c => c.trim().startsWith(`${key}=`));
      return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
    } catch { return null; }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      // Salva também como cookie (365 dias)
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `${key}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
    } catch {}
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    } catch {}
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: customStorage,
    storageKey: 'dsc-auth',
    flowType: 'pkce',
  },
});
