import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // ── 1. Tenta recuperar sessão existente ──────────────────
    const init = async () => {
      try {
        // Primeiro tenta getSession (usa storage local)
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          await loadProfile(session.user);
          return;
        }

        // Se não achou sessão local, tenta refresh explícito
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData?.session?.user && mounted) {
          await loadProfile(refreshData.session.user);
          return;
        }
      } catch (err) {
        console.error('Erro ao recuperar sessão:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    init();

    // ── 2. Listener de eventos de auth ───────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.email || 'nenhum');

        if (!mounted) return;

        if (
          event === 'SIGNED_IN'      ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED'
        ) {
          if (session?.user) {
            await loadProfile(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        } else if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            await loadProfile(session.user);
          } else {
            setIsLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Carrega o perfil do Supabase ───────────────────────────
  const loadProfile = async (authUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) throw error;

      const enriched = {
        id:                    authUser.id,
        email:                 authUser.email,
        full_name:             data?.full_name             || authUser.user_metadata?.full_name || '',
        display_name:          data?.display_name          || '',
        role:                  data?.role                  || 'user',
        status_conta:          data?.status_conta          || 'ativa',
        has_main_mentorship:   data?.has_main_mentorship   ?? true,
        has_smart_budget_system: data?.has_smart_budget_system ?? false,
        has_income_accelerator: data?.has_income_accelerator  ?? false,
        acesso_ate:            data?.acesso_ate            || null,
        onboarding_completo:   data?.onboarding_completo   ?? false,
        plan_start_date:       data?.plan_start_date       || null,
      };

      setUser(enriched);
      setProfile(data);
    } catch (err) {
      console.error('Erro no loadProfile:', err);
      // Fallback: define usuário básico para não travar
      setUser({
        id:                  authUser.id,
        email:               authUser.email,
        full_name:           authUser.user_metadata?.full_name || '',
        role:                authUser.user_metadata?.role || 'user',
        status_conta:        'ativa',
        has_main_mentorship: true,
        onboarding_completo: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Recarrega perfil manualmente ───────────────────────────
  const refreshProfile = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) await loadProfile(authUser);
    } catch (err) {
      console.error('Erro no refreshProfile:', err);
    }
  };

  // ── Login ──────────────────────────────────────────────────
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    return data;
  };

  // ── Cadastro ───────────────────────────────────────────────
  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;

    await supabase
      .from('clientes_autorizados')
      .update({ usuario_criado: true })
      .eq('email', email.trim().toLowerCase());

    return data;
  };

  // ── Logout ─────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  // ── Atualiza perfil ────────────────────────────────────────
  const updateProfile = async (updates) => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
    setUser(prev => ({ ...prev, ...updates }));
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isAuthenticated:           !!user,
      isLoading,
      isLoadingAuth:             isLoading,
      isLoadingPublicSettings:   false,
      signIn,
      signUp,
      signOut,
      logout:                    signOut,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
