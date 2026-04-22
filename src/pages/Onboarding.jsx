import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { entities } from '@/api/supabaseApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Dados dos passos ─────────────────────────────────────
const VAZAMENTOS = [
  { key: 'gastos_pequenos', label: 'Gastos pequenos e frequentes', example: 'Café, delivery, balas...', valor: 150 },
  { key: 'assinaturas', label: 'Assinaturas esquecidas', example: 'Streaming, apps, revistas...', valor: 90 },
  { key: 'compras_impulso', label: 'Compras por impulso', example: 'Promoções, tendências...', valor: 120 },
];

const CATEGORIAS_ESSENCIAIS = [
  { key: 'moradia', label: 'Moradia (aluguel, financiamento, condomínio)' },
  { key: 'utilidades', label: 'Utilidades (água, luz, internet, telefone)' },
  { key: 'mercado', label: 'Mercado e alimentação em casa' },
  { key: 'transporte', label: 'Transporte (combustível, ônibus, metrô)' },
  { key: 'saude', label: 'Saúde (plano, remédios, academia)' },
];

const CATEGORIAS_ESTILO = [
  { key: 'alimentacao_fora', label: 'Alimentação fora (restaurantes, delivery)' },
  { key: 'entretenimento', label: 'Entretenimento (cinemas, shows, lazer)' },
  { key: 'bem_estar', label: 'Bem-estar (salão, estética, roupas)' },
  { key: 'compras_gerais', label: 'Compras gerais (eletro, decoração, etc.)' },
];

// ─── Indicador de progresso ───────────────────────────────
function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
            i + 1 === current
              ? 'bg-emerald-600 text-white'
              : i + 1 < current
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-400'
          )}>
            {i + 1 < current ? '✓' : i + 1}
          </div>
          {i < total - 1 && (
            <div className={cn(
              'w-8 h-0.5',
              i + 1 < current ? 'bg-emerald-400' : 'bg-slate-200'
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Passo 1 — Detector de Vazamentos ────────────────────
function Passo1({ data, onChange, onNext }) {
  const total = VAZAMENTOS
    .filter(v => data[v.key])
    .reduce((sum, v) => sum + v.valor, 0);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Detector de Vazamentos</h2>
      <p className="text-slate-500 text-sm mb-6">
        Marque os tipos de gasto que se aplicam a você. Vamos calcular quanto você perde por mês.
      </p>

      <div className="space-y-3 mb-6">
        {VAZAMENTOS.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key, !data[item.key])}
            className={cn(
              'w-full p-4 rounded-2xl border-2 text-left transition-all',
              data[item.key]
                ? 'border-red-400 bg-red-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                data[item.key] ? 'bg-red-500 border-red-500' : 'border-slate-300'
              )}>
                {data[item.key] && <span className="text-white text-xs">✓</span>}
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-900">{item.label}</div>
                <div className="text-sm text-slate-500">{item.example}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-red-600">
                  ~R$ {item.valor}/mês
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {total > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-6 text-center">
          <div className="text-sm text-red-700 mb-1">Você desperdiça aproximadamente</div>
          <div className="text-3xl font-bold text-red-600">R$ {total}/mês</div>
          <div className="text-sm text-red-600 mt-1">
            = R$ {total * 12}/ano que poderiam estar na sua reserva
          </div>
        </div>
      )}

      <Button
        onClick={onNext}
        className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-base"
      >
        Próximo →
      </Button>
    </div>
  );
}

// ─── Passo 2 — Fórmula 50/30/20 ──────────────────────────
function Passo2({ renda, onChange, onNext, onBack }) {
  const r = parseFloat(renda) || 0;
  const essenciais = (r * 0.50).toFixed(2);
  const estilo = (r * 0.30).toFixed(2);
  const futuro = (r * 0.20).toFixed(2);

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Sua Fórmula Financeira</h2>
      <p className="text-slate-500 text-sm mb-6">
        Informe sua renda líquida mensal (após descontos) e veja como dividir seu dinheiro.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Renda líquida mensal (R$)
        </label>
        <Input
          type="number"
          placeholder="Ex: 3500"
          value={renda}
          onChange={(e) => onChange(e.target.value)}
          className="h-14 text-lg font-medium"
          style={{ fontSize: '16px' }}
        />
      </div>

      {r > 0 && (
        <div className="space-y-3 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-blue-900">50% — Essenciais</div>
              <div className="text-sm text-blue-700">Moradia, mercado, transporte, saúde</div>
            </div>
            <div className="text-xl font-bold text-blue-700">{fmt(essenciais)}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-purple-900">30% — Estilo de Vida</div>
              <div className="text-sm text-purple-700">Lazer, restaurantes, bem-estar</div>
            </div>
            <div className="text-xl font-bold text-purple-700">{fmt(estilo)}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-emerald-900">20% — Futuro</div>
              <div className="text-sm text-emerald-700">Reserva, investimentos, metas</div>
            </div>
            <div className="text-xl font-bold text-emerald-700">{fmt(futuro)}</div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12">← Voltar</Button>
        <Button
          onClick={onNext}
          disabled={!r || r <= 0}
          className="flex-2 h-12 bg-slate-900 hover:bg-slate-800 flex-1"
        >
          Próximo →
        </Button>
      </div>
    </div>
  );
}

// ─── Passo 3 — Mapeamento de gastos reais ────────────────
function Passo3({ gastos, onChange, onNext, onBack }) {
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v) || 0);

  const totalEssenciais = CATEGORIAS_ESSENCIAIS
    .reduce((s, c) => s + (parseFloat(gastos.essenciais?.[c.key]) || 0), 0);
  const totalEstilo = CATEGORIAS_ESTILO
    .reduce((s, c) => s + (parseFloat(gastos.estilo?.[c.key]) || 0), 0);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Seus Gastos Reais</h2>
      <p className="text-slate-500 text-sm mb-6">
        Preencha quanto você gasta em cada categoria por mês. Pode ser uma estimativa.
      </p>

      <div className="mb-5">
        <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center justify-between">
          <span>Essenciais</span>
          <span className="text-blue-600">{fmt(totalEssenciais)}</span>
        </div>
        <div className="space-y-2">
          {CATEGORIAS_ESSENCIAIS.map((cat) => (
            <div key={cat.key} className="flex items-center gap-3">
              <label className="text-sm text-slate-600 flex-1">{cat.label}</label>
              <Input
                type="number"
                placeholder="0"
                value={gastos.essenciais?.[cat.key] || ''}
                onChange={(e) => onChange('essenciais', cat.key, e.target.value)}
                className="w-28 h-10 text-right"
                style={{ fontSize: '16px' }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center justify-between">
          <span>Estilo de Vida</span>
          <span className="text-purple-600">{fmt(totalEstilo)}</span>
        </div>
        <div className="space-y-2">
          {CATEGORIAS_ESTILO.map((cat) => (
            <div key={cat.key} className="flex items-center gap-3">
              <label className="text-sm text-slate-600 flex-1">{cat.label}</label>
              <Input
                type="number"
                placeholder="0"
                value={gastos.estilo?.[cat.key] || ''}
                onChange={(e) => onChange('estilo', cat.key, e.target.value)}
                className="w-28 h-10 text-right"
                style={{ fontSize: '16px' }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12">← Voltar</Button>
        <Button onClick={onNext} className="flex-1 h-12 bg-slate-900 hover:bg-slate-800">
          Ver Diagnóstico →
        </Button>
      </div>
    </div>
  );
}

// ─── Passo 4 — Diagnóstico final ─────────────────────────
function Passo4({ renda, gastos, onConfirm, onBack, saving }) {
  const r = parseFloat(renda) || 0;

  const totalEssenciais = CATEGORIAS_ESSENCIAIS
    .reduce((s, c) => s + (parseFloat(gastos.essenciais?.[c.key]) || 0), 0);
  const totalEstilo = CATEGORIAS_ESTILO
    .reduce((s, c) => s + (parseFloat(gastos.estilo?.[c.key]) || 0), 0);

  const pctEssenciais = r > 0 ? (totalEssenciais / r) * 100 : 0;
  const pctEstilo = r > 0 ? (totalEstilo / r) * 100 : 0;
  const pctFuturo = Math.max(0, 100 - pctEssenciais - pctEstilo);

  const cenarioA = pctEssenciais <= 50;

  // Fórmula ajustada: arredonda para múltiplos de 5
  const round5 = (n) => Math.round(n / 5) * 5;
  const essAjustado = cenarioA ? 50 : round5(pctEssenciais);
  const futAjustado = cenarioA ? 20 : Math.max(5, round5(pctFuturo));
  const estiAjustado = 100 - essAjustado - futAjustado;

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Seu Diagnóstico</h2>
      <p className="text-slate-500 text-sm mb-6">
        Com base nos seus dados, definimos sua fórmula personalizada.
      </p>

      {/* Cenário */}
      <div className={cn(
        'rounded-2xl p-5 mb-5 border-2',
        cenarioA
          ? 'bg-emerald-50 border-emerald-300'
          : 'bg-amber-50 border-amber-300'
      )}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{cenarioA ? '✅' : '⚠️'}</span>
          <div>
            <div className="font-bold text-slate-900">
              {cenarioA ? 'Cenário A — Dentro do ideal' : 'Cenário B — Ajuste temporário'}
            </div>
            <div className="text-sm text-slate-600">
              Seus essenciais representam {pctEssenciais.toFixed(1)}% da renda
            </div>
          </div>
        </div>
        {!cenarioA && (
          <div className="bg-white rounded-xl p-3 text-sm text-amber-800 border border-amber-200">
            Seus gastos essenciais estão acima de 50%. Sua fórmula foi ajustada para refletir sua realidade atual.
            <strong> Meta: voltar ao 50/30/20 em 6 meses</strong> reduzindo despesas fixas gradualmente.
          </div>
        )}
      </div>

      {/* Fórmula resultante */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white mb-5">
        <div className="text-center mb-4">
          <div className="text-sm text-slate-400 mb-1">Sua fórmula personalizada</div>
          <div className="text-4xl font-bold">
            {essAjustado}/{estiAjustado}/{futAjustado}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-slate-300 mb-1">Essenciais</div>
            <div className="font-semibold">{fmt(r * essAjustado / 100)}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-slate-300 mb-1">Estilo de Vida</div>
            <div className="font-semibold">{fmt(r * estiAjustado / 100)}</div>
          </div>
          <div className="bg-emerald-500/30 rounded-xl p-3 border border-emerald-500/40">
            <div className="text-emerald-300 mb-1">Futuro 🎯</div>
            <div className="font-semibold text-emerald-300">{fmt(r * futAjustado / 100)}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12" disabled={saving}>
          ← Voltar
        </Button>
        <Button
          onClick={() => onConfirm({
            essential_percentage: essAjustado,
            lifestyle_percentage: estiAjustado,
            future_percentage: futAjustado,
            cenario: cenarioA ? 'A' : 'B',
            monthly_income: r,
          })}
          disabled={saving}
          className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? 'Salvando...' : 'Começar agora! 🚀'}
        </Button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────
export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Estado de cada passo
  const [vazamentos, setVazamentos] = useState({});
  const [renda, setRenda] = useState('');
  const [gastos, setGastos] = useState({ essenciais: {}, estilo: {} });

  const { user, updateProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const handleVazamentoChange = (key, value) => {
    setVazamentos(prev => ({ ...prev, [key]: value }));
  };

  const handleGastosChange = (grupo, key, value) => {
    setGastos(prev => ({
      ...prev,
      [grupo]: { ...prev[grupo], [key]: value }
    }));
  };

  const handleConfirm = async (formula) => {
    setSaving(true);
    try {
      // Salva BudgetFormula
      await entities.BudgetFormula.create({
        monthly_income: formula.monthly_income,
        essential_percentage: formula.essential_percentage,
        lifestyle_percentage: formula.lifestyle_percentage,
        future_percentage: formula.future_percentage,
        cenario: formula.cenario,
      });

      // Salva FinancialProfile com renda e aporte inicial
      const contribution = formula.monthly_income * formula.future_percentage / 100;
      await entities.FinancialProfile.create({
        monthly_income: formula.monthly_income,
        savings_percentage: formula.future_percentage,
        monthly_contribution: contribution,
        plan_start_date: new Date().toISOString().split('T')[0],
      });

      // Salva vazamentos como LeakageExpenses
      for (const v of VAZAMENTOS) {
        if (vazamentos[v.key]) {
          await entities.LeakageExpense.create({
            description: v.label,
            amount: v.valor,
            category: v.key,
            date: new Date().toISOString().split('T')[0],
          });
        }
      }

      // Marca onboarding como completo
      await updateProfile({ onboarding_completo: true });
      await refreshProfile();

      navigate('/');
    } catch (err) {
      console.error('Erro ao salvar onboarding:', err);
      alert('Erro ao salvar dados. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">💰</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900">Vamos configurar seu plano</h1>
          <p className="text-slate-500 text-sm">Apenas {4} passos rápidos</p>
        </div>

        <StepIndicator current={step} total={4} />

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          {step === 1 && (
            <Passo1
              data={vazamentos}
              onChange={handleVazamentoChange}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Passo2
              renda={renda}
              onChange={setRenda}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Passo3
              gastos={gastos}
              onChange={handleGastosChange}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <Passo4
              renda={renda}
              gastos={gastos}
              onConfirm={handleConfirm}
              onBack={() => setStep(3)}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
