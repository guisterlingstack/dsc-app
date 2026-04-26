import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [isLoading, setIsLoading] = useState(true); // começa true — só vira false após confirmar sessão
  const initialized = useRef(false);

  useEffect(() => {
    // Listener primeiro — garante que nenhum evento seja perdido
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.email || 'nenhum');

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) await loadProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        } else if (event === 'INITIAL_SESSION') {
          // INITIAL_SESSION é disparado uma vez na inicialização
          // Se tem sessão, carrega perfil. Se não tem, libera loading.
          if (session?.user) {
            await loadProfile(session.user);
          } else {
            setIsLoading(false);
          }
          initialized.current = true;
        }
      }
    );

    // Fallback: se INITIAL_SESSION não disparar em 3s, tenta getSession manualmente
    const fallbackTimer = setTimeout(async () => {
      if (!initialized.current) {
        console.log('Fallback: buscando sessão manualmente...');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadProfile(session.user);
        } else {
          setIsLoading(false);
        }
        initialized.current = true;
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  const loadProfile = async (authUser) => {
    console.log('Carregando profile para:', authUser.email);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      console.log('Profile carregado:', data, 'erro:', error);

      setUser({
        id:                      authUser.id,
        email:                   authUser.email,
        full_name:               data?.full_name               || authUser.user_metadata?.full_name || '',
        display_name:            data?.display_name            || '',
        role:                    data?.role                    || authUser.user_metadata?.role || 'user',
        status_conta:            data?.status_conta            || 'ativa',
        has_main_mentorship:     data?.has_main_mentorship     ?? true,
        has_smart_budget_system: data?.has_smart_budget_system ?? false,
        has_income_accelerator:  data?.has_income_accelerator  ?? false,
        acesso_ate:              data?.acesso_ate              || null,
        onboarding_completo:     data?.onboarding_completo     ?? false,
        plan_start_date:         data?.plan_start_date         || null,
      });
      setProfile(data);
    } catch (err) {
      console.error('Erro no loadProfile:', err);
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

  const refreshProfile = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) await loadProfile(authUser);
    } catch (err) {
      console.error('Erro no refreshProfile:', err);
    }
  };

  const signIn = async (email, password) => {
    console.log('Tentando login:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    console.log('Login resultado:', { user: data?.user?.email, error });
    if (error) throw error;
    return data;
  };

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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

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
      isAuthenticated:         !!user,
      isLoading,
      isLoadingAuth:           isLoading,
      isLoadingPublicSettings: false,
      signIn,
      signUp,
      signOut,
      logout:                  signOut,
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
