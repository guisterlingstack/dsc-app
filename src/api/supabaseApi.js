/**
 * api/supabaseApi.js
 * Substitui completamente o @base44/sdk.
 * Cada função espelha a API anterior: list, create, update, delete, filter
 */
import { supabase } from '@/lib/supabaseClient';

// Helper para obter user_id atual
async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
}

// Factory que cria um objeto de acesso para cada tabela
function createEntity(tableName) {
  return {
    async list(orderBy = '-created_at', limit = null) {
      const userId = await getUserId();
      const col = orderBy.startsWith('-') ? orderBy.slice(1) : orderBy;
      const asc = !orderBy.startsWith('-');

      let query = supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .order(col, { ascending: asc });

      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async filter(filters = {}) {
      const userId = await getUserId();
      let query = supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId);

      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(payload) {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from(tableName)
        .insert({ ...payload, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    },

    async upsert(payload, conflictColumn = 'id') {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from(tableName)
        .upsert({ ...payload, user_id: userId }, { onConflict: conflictColumn })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  };
}

// Entidades — espelham exatamente as do Base44
export const entities = {
  AccelerationPlan:      createEntity('acceleration_plans'),
  BankChecklist:         createEntity('bank_checklists'),
  BudgetFormula:         createEntity('budget_formulas'),
  ExtraIncomeInitiative: createEntity('extra_income_initiatives'),
  FinancialProfile:      createEntity('financial_profiles'),
  IncomeProfile:         createEntity('income_profiles'),
  LeakageExpense:        createEntity('leakage_expenses'),
  MonthlyContribution:   createEntity('monthly_contributions'),
  MonthlyExpense:        createEntity('monthly_expenses'),
  MonthlyClosing:        createEntity('monthly_closings'),
  ReserveUsageRequest:   createEntity('reserve_usage_requests'),
  WeeklyCheckin:         createEntity('weekly_checkins'),
};

// Entidade User (somente admin)
export const adminEntities = {
  async listUsers(orderBy = '-created_at') {
    const col = orderBy.startsWith('-') ? orderBy.slice(1) : orderBy;
    const asc = !orderBy.startsWith('-');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order(col, { ascending: asc });
    if (error) throw error;
    return data || [];
  },

  async updateUser(userId, payload) {
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listClientesAutorizados() {
    const { data, error } = await supabase
      .from('clientes_autorizados')
      .select('*')
      .order('data_compra', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};

// Compatibilidade com import anterior: import { base44 } from '@/api/base44Client'
// Agora exportamos um objeto com a mesma interface
export const base44 = {
  entities,
  auth: {
    me: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return { ...profile, id: user.id, email: user.email };
    },
    logout: async (redirectUrl) => {
      await supabase.auth.signOut();
      if (redirectUrl) window.location.href = redirectUrl;
    },
    redirectToLogin: (redirectUrl) => {
      window.location.href = '/login' + (redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : '');
    },
  },
};
