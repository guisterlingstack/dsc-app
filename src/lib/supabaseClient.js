import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas no .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,           // Salva sessão no localStorage
    autoRefreshToken: true,         // Renova token automaticamente
    detectSessionInUrl: true,       // Detecta sessão na URL
    storage: window.localStorage,  // Usa localStorage do dispositivo
    storageKey: 'dsc-auth',        // Chave única do app
    flowType: 'pkce',              // Mais seguro para SPAs
  },
});
