import { supabase } from '@/lib/supabaseClient';

// Gera session ID único por sessão do navegador
const getSessionId = () => {
  let sid = sessionStorage.getItem('dsc_session_id');
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('dsc_session_id', sid);
  }
  return sid;
};

// Detecta tipo de dispositivo
const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
};

// Envia evento para o Supabase
const trackSupabase = async (eventName, page, properties = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('analytics_events').insert({
      user_id: user?.id || null,
      session_id: getSessionId(),
      event_name: eventName,
      page,
      properties,
      device_type: getDeviceType(),
    });
  } catch (err) {
    // Silencioso — não deve quebrar o app
  }
};

// Envia evento para o Google Analytics
const trackGA = (eventName, properties = {}) => {
  try {
    if (window.gtag) {
      window.gtag('event', eventName, properties);
    }
  } catch (err) {
    // Silencioso
  }
};

// ─── Função principal de tracking ────────────────────────
export const track = (eventName, page, properties = {}) => {
  trackSupabase(eventName, page, properties);
  trackGA(eventName, { page, ...properties });
};

// ─── Tracking de páginas ──────────────────────────────────
export const trackPage = (pageName) => {
  track('page_view', pageName, { page_name: pageName });
  if (window.gtag) {
    window.gtag('config', 'G-R2FQDKS2P4', { page_title: pageName });
  }
};

// ─── Eventos pré-definidos ────────────────────────────────
export const Analytics = {
  // Autenticação
  login: () => track('login', 'Login'),
  logout: () => track('logout', 'App'),
  signup: () => track('signup', 'Login'),
  onboardingCompleto: () => track('onboarding_completo', 'Onboarding'),

  // Dashboard
  registrarAporte: (valor) => track('registrar_aporte', 'Dashboard', { valor }),

  // Detector de Vazamentos
  vazamentoSalvo: (total) => track('vazamento_salvo', 'LeakageDetector', { total }),
  planoAcaoVisto: () => track('plano_acao_visto', 'LeakageDetector'),

  // Calculadora
  formulaCalculada: (formula) => track('formula_calculada', 'BudgetCalculator', { formula }),
  formulaSalva: () => track('formula_salva', 'BudgetCalculator'),

  // Pague-se Primeiro
  aporteDefinido: (valor, percentual) => track('aporte_definido', 'PayYourselfFirst', { valor, percentual }),

  // Meta de Reserva
  metaDefinida: (meta) => track('meta_definida', 'ReserveGoal', { meta }),

  // Configuração Bancária
  checklistBancario: (etapa) => track('checklist_bancario', 'BankSetup', { etapa }),

  // Check Semanal
  checkinSemanal: (semaforo) => track('checkin_semanal', 'WeeklyRoutine', { semaforo }),

  // Fechamento Mensal
  fechamentoMensal: (mes) => track('fechamento_mensal', 'MonthlyClosing', { mes }),

  // Plano de Aceleração
  aceleracaoRegistrada: (valor) => track('aceleracao_registrada', 'AccelerationPlan', { valor }),

  // Usar a Reserva
  validacaoEmergencia: (resultado) => track('validacao_emergencia', 'ReserveUsage', { resultado }),

  // Acelerador de Renda
  iniciativaAdicionada: (categoria) => track('iniciativa_adicionada', 'IncomeAccelerator', { categoria }),

  // Admin
  usuarioCriado: (role) => track('usuario_criado', 'AdminUsers', { role }),
  usuarioBloqueado: () => track('usuario_bloqueado', 'AdminUsers'),
};
