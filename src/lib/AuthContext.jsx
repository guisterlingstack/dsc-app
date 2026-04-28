import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Busca sessão diretamente — mais confiável que esperar evento
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) loadProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (authUser) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

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
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) await loadProfile(authUser);
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    await supabase.from('clientes_autorizados')
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
      .from('profiles').update(updates).eq('id', user.id).select().single();
    if (error) throw error;
    setProfile(data);
    setUser(prev => ({ ...prev, ...updates }));
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user, profile,
      isAuthenticated:         !!user,
      isLoading,
      isLoadingAuth:           isLoading,
      isLoadingPublicSettings: false,
      signIn, signUp, signOut,
      logout: signOut,
      updateProfile, refreshProfile,
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
