-- ============================================================
-- Dinheiro Sob Controle — Schema Supabase
-- Execute no SQL Editor do painel Supabase
-- ============================================================

-- PROFILES (extensão do auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  display_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status_conta TEXT DEFAULT 'pendente' CHECK (status_conta IN ('pendente', 'ativa', 'bloqueada')),
  has_main_mentorship BOOLEAN DEFAULT false,
  has_smart_budget_system BOOLEAN DEFAULT false,
  has_income_accelerator BOOLEAN DEFAULT false,
  acesso_ate DATE,
  onboarding_completo BOOLEAN DEFAULT false,
  plan_start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê próprio perfil" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Admin vê todos os perfis" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Trigger: criar profile automaticamente ao registrar usuário
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- CLIENTES AUTORIZADOS (controle de acesso via Eduzz)
CREATE TABLE IF NOT EXISTS clientes_autorizados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  id_transacao TEXT,
  status_pagamento TEXT CHECK (status_pagamento IN ('aprovado', 'reembolsado', 'chargeback')),
  acesso_liberado BOOLEAN DEFAULT false,
  usuario_criado BOOLEAN DEFAULT false,
  data_compra TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clientes_autorizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Somente admin gerencia clientes autorizados" ON clientes_autorizados
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Permite leitura própria para verificação no signup
CREATE POLICY "Usuário verifica próprio acesso" ON clientes_autorizados
  FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- FINANCIAL PROFILES
CREATE TABLE IF NOT EXISTS financial_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monthly_income NUMERIC DEFAULT 0,
  fixed_expenses NUMERIC DEFAULT 0,
  savings_percentage NUMERIC DEFAULT 0,
  monthly_contribution NUMERIC DEFAULT 0,
  minimum_reserve_goal NUMERIC DEFAULT 0,
  ideal_reserve_goal NUMERIC DEFAULT 0,
  current_reserve NUMERIC DEFAULT 0,
  plan_start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE financial_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON financial_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin all" ON financial_profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- BUDGET FORMULAS
CREATE TABLE IF NOT EXISTS budget_formulas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monthly_income NUMERIC DEFAULT 0,
  essential_percentage NUMERIC DEFAULT 50,
  lifestyle_percentage NUMERIC DEFAULT 30,
  future_percentage NUMERIC DEFAULT 20,
  cenario TEXT DEFAULT 'A' CHECK (cenario IN ('A', 'B')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE budget_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON budget_formulas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin all" ON budget_formulas FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- LEAKAGE EXPENSES
CREATE TABLE IF NOT EXISTS leakage_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT CHECK (category IN ('gastos_pequenos', 'assinaturas', 'compras_impulso')) NOT NULL,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leakage_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON leakage_expenses FOR ALL USING (auth.uid() = user_id);

-- MONTHLY CONTRIBUTIONS
CREATE TABLE IF NOT EXISTS monthly_contributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  month TEXT,
  date DATE NOT NULL,
  source TEXT CHECK (source IN ('aporte_mensal', 'aceleracao')) DEFAULT 'aporte_mensal',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE monthly_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON monthly_contributions FOR ALL USING (auth.uid() = user_id);

-- MONTHLY EXPENSES
CREATE TABLE IF NOT EXISTS monthly_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT CHECK (category IN ('essenciais', 'estilo_vida', 'futuro')) NOT NULL,
  date DATE NOT NULL,
  month TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE monthly_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON monthly_expenses FOR ALL USING (auth.uid() = user_id);

-- WEEKLY CHECKINS (semáforo semanal — novo schema)
CREATE TABLE IF NOT EXISTS weekly_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start_date DATE NOT NULL,
  gasto_essenciais_semana NUMERIC DEFAULT 0,
  gasto_estilo_vida_semana NUMERIC DEFAULT 0,
  futuro_depositado BOOLEAN DEFAULT false,
  current_balance NUMERIC,
  notes TEXT,
  -- Status semáforo calculado
  semaforo_essenciais TEXT DEFAULT 'verde' CHECK (semaforo_essenciais IN ('verde', 'amarelo', 'vermelho')),
  semaforo_estilo_vida TEXT DEFAULT 'verde' CHECK (semaforo_estilo_vida IN ('verde', 'amarelo', 'vermelho')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON weekly_checkins FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin all" ON weekly_checkins FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- MONTHLY CLOSINGS (fechamento mensal — nova tabela)
CREATE TABLE IF NOT EXISTS monthly_closings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mes_referencia TEXT NOT NULL,
  gasto_essenciais NUMERIC DEFAULT 0,
  gasto_estilo_vida NUMERIC DEFAULT 0,
  gasto_futuro NUMERIC DEFAULT 0,
  limite_essenciais NUMERIC DEFAULT 0,
  limite_estilo_vida NUMERIC DEFAULT 0,
  limite_futuro NUMERIC DEFAULT 0,
  economia_vs_mes_anterior NUMERIC DEFAULT 0,
  maior_gasto_inesperado TEXT,
  gasto_extra_previsto TEXT,
  transferencias_ativas BOOLEAN DEFAULT true,
  fechamento_confirmado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE monthly_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON monthly_closings FOR ALL USING (auth.uid() = user_id);

-- ACCELERATION PLANS
CREATE TABLE IF NOT EXISTS acceleration_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  strategy TEXT CHECK (strategy IN ('corte_vazamentos', 'venda_itens', 'renda_extra')) NOT NULL,
  description TEXT,
  amount NUMERIC,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE acceleration_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON acceleration_plans FOR ALL USING (auth.uid() = user_id);

-- RESERVE USAGE REQUESTS
CREATE TABLE IF NOT EXISTS reserve_usage_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount_needed NUMERIC NOT NULL,
  reason TEXT,
  emergency_level TEXT CHECK (emergency_level IN ('pequena', 'media', 'grande')),
  recommendation TEXT,
  request_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reserve_usage_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON reserve_usage_requests FOR ALL USING (auth.uid() = user_id);

-- BANK CHECKLISTS
CREATE TABLE IF NOT EXISTS bank_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  separate_account_created BOOLEAN DEFAULT false,
  no_debit_card BOOLEAN DEFAULT false,
  automatic_transfer_configured BOOLEAN DEFAULT false,
  transfer_date_defined BOOLEAN DEFAULT false,
  transfer_day INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bank_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON bank_checklists FOR ALL USING (auth.uid() = user_id);

-- EXTRA INCOME INITIATIVES
CREATE TABLE IF NOT EXISTS extra_income_initiatives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('freelance', 'venda_produtos', 'servicos', 'investimento_tempo', 'outros')) NOT NULL,
  expected_monthly_income NUMERIC DEFAULT 0,
  actual_monthly_income NUMERIC DEFAULT 0,
  status TEXT CHECK (status IN ('planejando', 'em_andamento', 'pausada', 'concluida')) DEFAULT 'planejando',
  started_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE extra_income_initiatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON extra_income_initiatives FOR ALL USING (auth.uid() = user_id);

-- INCOME PROFILES
CREATE TABLE IF NOT EXISTS income_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  available_time TEXT CHECK (available_time IN ('pouquissimo', 'algumas_horas', 'meio_periodo', 'periodo_integral')),
  primary_skill TEXT,
  secondary_skills TEXT[],
  monthly_goal NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE income_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own data" ON income_profiles FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_financial_profiles_user ON financial_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_formulas_user ON budget_formulas(user_id);
CREATE INDEX IF NOT EXISTS idx_leakage_expenses_user ON leakage_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_contributions_user ON monthly_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_expenses_user_month ON monthly_expenses(user_id, month);
CREATE INDEX IF NOT EXISTS idx_weekly_checkins_user_date ON weekly_checkins(user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_monthly_closings_user_mes ON monthly_closings(user_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_acceleration_plans_user ON acceleration_plans(user_id);

-- ============================================================
-- Comentário final
-- ============================================================
-- Execute este SQL completo no Supabase SQL Editor.
-- Após executar, vá em Authentication > Providers e verifique
-- que Email está habilitado (padrão).
