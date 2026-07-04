import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { TrendingUp, ArrowRight, ArrowLeft, Check, AlertTriangle, Plus, Trash2, ChevronRight, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const ESSENCIAIS_GRUPOS = {
  'Moradia': ['Aluguel/Financiamento', 'Condomínio', 'IPTU', 'Seguro residencial'],
  'Utilidades': ['Água', 'Luz', 'Gás', 'Internet', 'Telefone fixo'],
  'Alimentação Básica': ['Mercado', 'Feira', 'Açougue'],
  'Transporte': ['Combustível', 'Transporte público', 'Seguro carro', 'IPVA', 'Manutenção preventiva'],
  'Saúde': ['Plano de saúde', 'Plano odontológico', 'Remédios contínuos'],
  'Educação': ['Mensalidade escola/faculdade', 'Material didático', 'Transporte escolar'],
  'Obrigações': ['Pensão alimentícia', 'Empréstimo consignado'],
};

const ESTILO_GRUPOS = {
  'Alimentação Fora': ['Delivery', 'Restaurantes', 'Lanchonetes', 'Cafeteria', 'Bares'],
  'Entretenimento': ['Streaming', 'Cinema', 'Shows/eventos', 'Hobbies', 'Jogos/apps'],
  'Bem-estar': ['Academia', 'Personal trainer', 'Salão/barbeiro', 'Estética/spa'],
  'Transporte Conveniência': ['Uber/99 evitável', 'Estacionamento conveniência'],
  'Compras': ['Roupas', 'Sapatos/acessórios', 'Eletrônicos/gadgets', 'Decoração'],
  'Outros': ['Viagens', 'Presentes', 'Pets extras'],
};

function GrupoGastos({ grupos, values, onChange }) {
  const [expanded, setExpanded] = useState({});
  return (
    <div className="space-y-3">
      {Object.entries(grupos).map(([grupo, itens]) => {
        const grupoTotal = itens.reduce((s, item) => s + (parseFloat(values[item]) || 0), 0);
        const isExpanded = expanded[grupo];
        return (
          <div key={grupo} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <button onClick={() => setExpanded(p => ({...p, [grupo]: !p[grupo]}))}
              className="w-full flex items-center justify-between p-3 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800 text-sm">{grupo}</span>
                {grupoTotal > 0 && <span className="text-xs text-emerald-600 font-semibold">{fmt(grupoTotal)}</span>}
              </div>
              {isExpanded ? <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {isExpanded && (
              <div className="p-3 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {itens.map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 flex-1 min-w-0 truncate">{item}</span>
                    <div className="relative flex-shrink-0 w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                      <Input type="number" value={values[item] || ''} onChange={(e) => onChange(item, e.target.value)}
                        placeholder="0" className="h-8 pl-7 text-xs w-full" style={{fontSize:'16px'}} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BudgetCalculator() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [tipoRenda, setTipoRenda] = useState('fixa');
  const [rendaFixa, setRendaFixa] = useState({ bruto: '', descontos: '' });
  const [rendaVariavel, setRendaVariavel] = useState(['', '', '', '', '', '']);
  const [rendaMista, setRendaMista] = useState({ fixo: '', variavelMedia: '' });
  const [rendaBase, setRendaBase] = useState(0);
  const [essenciaisValues, setEssenciaisValues] = useState({});
  const [estiloValues, setEstiloValues] = useState({});
  const [customEssential, setCustomEssential] = useState([]);
  const [customEstilo, setCustomEstilo] = useState([]);
  const [formula, setFormula] = useState({ ess: 50, est: 30, fut: 20 });
  const [planoAcoes, setPlanoAcoes] = useState(['', '', '']);
  const queryClient = useQueryClient();

  const updateEss = (item, val) => setEssenciaisValues(p => ({...p, [item]: val}));
  const updateEst = (item, val) => setEstiloValues(p => ({...p, [item]: val}));

  const totalEss = Object.values(essenciaisValues).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    + customEssential.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
  const totalEst = Object.values(estiloValues).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    + customEstilo.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);

  const limiteEss = rendaBase * formula.ess / 100;
  const limiteEst = rendaBase * formula.est / 100;
  const limiteFut = rendaBase * formula.fut / 100;

  const essPct = rendaBase > 0 ? (totalEss / rendaBase * 100).toFixed(1) : 0;
  const estPct = rendaBase > 0 ? (totalEst / rendaBase * 100).toFixed(1) : 0;
  const futReal = Math.max(0, rendaBase - totalEss - totalEst);
  const futPct = rendaBase > 0 ? (futReal / rendaBase * 100).toFixed(1) : 0;

  const calcRendaBase = () => {
    if (tipoRenda === 'fixa') return parseFloat(rendaFixa.bruto) - (parseFloat(rendaFixa.descontos) || 0);
    if (tipoRenda === 'variavel') {
      const vals = rendaVariavel.map(v => parseFloat(v) || 0).filter(v => v > 0);
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    }
    return parseFloat(rendaMista.fixo) || 0;
  };

  const handleRendaNext = () => { const r = calcRendaBase(); setRendaBase(r); setStep(2); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existing = await entities.BudgetFormula.list();
      const data = { monthly_income: rendaBase, essential_percentage: formula.ess, lifestyle_percentage: formula.est, future_percentage: formula.fut };
      if (existing[0]?.id) await entities.BudgetFormula.update(existing[0].id, data);
      else await entities.BudgetFormula.create(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget-formula'] }),
  });

  const steps = ['Renda', 'Essenciais', 'Estilo de Vida', 'Fórmula Final'];

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C9A84C]/15 rounded-lg flex-shrink-0"><Calculator className="w-5 h-5 text-[#C9A84C]" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Calculadora 50/30/20</h1>
              <p className="text-slate-500 text-sm mt-1">Calcule sua divisão ideal baseada na sua realidade</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all', step === i+1 ? 'bg-slate-900 text-white' : step > i+1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400')}>
                  {step > i+1 ? <Check className="w-3 h-3" /> : <span>{i+1}</span>}
                  <span className="hidden sm:inline">{s}</span>
                </div>
                {i < steps.length - 1 && <div className={cn('flex-1 h-0.5', step > i+1 ? 'bg-emerald-400' : 'bg-slate-200')} />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1 — Renda */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Qual seu tipo de renda?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {[['fixa','Renda Fixa','Salário fixo'], ['variavel','Renda Variável','Freelancer/autônomo'], ['mista','Renda Mista','Fixa + variável']].map(([val, label, sub]) => (
                    <button key={val} onClick={() => setTipoRenda(val)}
                      className={cn('p-4 rounded-xl border-2 text-left', tipoRenda === val ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300')}>
                      <p className="font-semibold text-slate-900 text-sm">{label}</p>
                      <p className="text-xs text-slate-500">{sub}</p>
                    </button>
                  ))}
                </div>

                {tipoRenda === 'fixa' && (
                  <div className="space-y-3">
                    <div><Label>Salário bruto</Label><div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={rendaFixa.bruto} onChange={(e) => setRendaFixa(p => ({...p, bruto: e.target.value}))} className="pl-9 h-12" style={{fontSize:'16px'}} /></div></div>
                    <div><Label>Descontos (INSS, IR, plano, etc)</Label><div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={rendaFixa.descontos} onChange={(e) => setRendaFixa(p => ({...p, descontos: e.target.value}))} className="pl-9 h-12" style={{fontSize:'16px'}} /></div></div>
                    {rendaFixa.bruto && <div className="bg-emerald-50 rounded-xl p-4 flex justify-between"><span className="text-slate-700 font-medium">Salário líquido:</span><span className="text-emerald-700 font-bold text-lg">{fmt(parseFloat(rendaFixa.bruto) - (parseFloat(rendaFixa.descontos) || 0))}</span></div>}
                  </div>
                )}

                {tipoRenda === 'variavel' && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">Informe os últimos 6 meses de renda:</p>
                    {rendaVariavel.map((v, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 w-16 flex-shrink-0">Mês -{6-i}</span>
                        <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={v} onChange={(e) => setRendaVariavel(p => p.map((x, j) => j === i ? e.target.value : x))} className="pl-9 h-11" style={{fontSize:'16px'}} /></div>
                      </div>
                    ))}
                    {rendaVariavel.some(v => v) && (
                      <div className="bg-emerald-50 rounded-xl p-4">
                        <div className="flex justify-between text-sm mb-1"><span>Média dos últimos 6 meses:</span><span className="font-bold text-emerald-700">{fmt(rendaVariavel.filter(v=>v).reduce((s,v)=>s+(parseFloat(v)||0),0)/rendaVariavel.filter(v=>v).length)}</span></div>
                        <p className="text-xs text-slate-500">Use esse valor como renda base, arredondando para baixo por segurança</p>
                      </div>
                    )}
                  </div>
                )}

                {tipoRenda === 'mista' && (
                  <div className="space-y-3">
                    <div><Label>Salário fixo líquido</Label><div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={rendaMista.fixo} onChange={(e) => setRendaMista(p => ({...p, fixo: e.target.value}))} className="pl-9 h-12" style={{fontSize:'16px'}} /></div></div>
                    <div><Label>Média variável (últimos 6 meses)</Label><div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" value={rendaMista.variavelMedia} onChange={(e) => setRendaMista(p => ({...p, variavelMedia: e.target.value}))} className="pl-9 h-12" style={{fontSize:'16px'}} /></div></div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">Para o cálculo 50/30/20, use APENAS a renda fixa. A variável vai 100% para o Futuro.</div>
                  </div>
                )}
              </div>
              <Button onClick={handleRendaNext} disabled={calcRendaBase() <= 0} className="w-full h-12 bg-slate-900 hover:bg-slate-800">
                Próximo: Gastos Essenciais <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2 — Essenciais */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex justify-between items-center mb-1">
                  <h2 className="font-bold text-slate-900">Seus Gastos Essenciais Reais</h2>
                  <span className="text-sm text-slate-500">Limite: {fmt(limiteEss)}</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">Pegue os extratos dos últimos 3 meses e preencha</p>
                <GrupoGastos grupos={ESSENCIAIS_GRUPOS} values={essenciaisValues} onChange={updateEss} />
                {/* Itens extras */}
                <div className="mt-3">
                  {customEssential.map((r, i) => (
                    <div key={r.id} className="flex items-center gap-2 mb-2">
                      <Input value={r.desc} onChange={(e) => setCustomEssential(p => p.map((x, j) => j === i ? {...x, desc: e.target.value} : x))} placeholder="Outro essencial..." className="h-9 text-sm flex-1" style={{fontSize:'16px'}} />
                      <div className="relative w-28"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span><Input type="number" value={r.value} onChange={(e) => setCustomEssential(p => p.map((x, j) => j === i ? {...x, value: e.target.value} : x))} className="h-9 pl-7 text-xs" style={{fontSize:'16px'}} /></div>
                      <button onClick={() => setCustomEssential(p => p.filter((_, j) => j !== i))} className="p-1.5 hover:bg-red-100 rounded text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setCustomEssential(p => [...p, {id: Date.now(), desc: '', value: ''}])} className="w-full h-8 border-dashed text-xs mt-1"><Plus className="w-3 h-3 mr-1" />Adicionar outro essencial</Button>
                </div>
                {/* Total */}
                <div className={cn('flex justify-between items-center mt-4 p-3 rounded-xl', totalEss > limiteEss ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200')}>
                  <span className="font-semibold text-sm">Total Essenciais</span>
                  <div className="text-right">
                    <p className={cn('text-lg font-bold', totalEss > limiteEss ? 'text-red-600' : 'text-emerald-600')}>{fmt(totalEss)}</p>
                    <p className="text-xs text-slate-500">{essPct}% da renda {totalEss > limiteEss ? '(acima de 50%!)' : '(dentro de 50% ✓)'}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setStep(1)} variant="outline" className="h-11"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
                <Button onClick={() => setStep(3)} className="flex-1 h-11 bg-slate-900 hover:bg-slate-800">Próximo: Estilo de Vida <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </div>
          )}

          {/* Step 3 — Estilo de Vida */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex justify-between items-center mb-1">
                  <h2 className="font-bold text-slate-900">Seus Gastos de Estilo de Vida</h2>
                  <span className="text-sm text-slate-500">Limite: {fmt(limiteEst)}</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">Pegue os extratos e preencha os gastos de conforto e prazer</p>
                <GrupoGastos grupos={ESTILO_GRUPOS} values={estiloValues} onChange={updateEst} />
                {customEstilo.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2 mb-2 mt-2">
                    <Input value={r.desc} onChange={(e) => setCustomEstilo(p => p.map((x, j) => j === i ? {...x, desc: e.target.value} : x))} placeholder="Outro gasto..." className="h-9 text-sm flex-1" style={{fontSize:'16px'}} />
                    <div className="relative w-28"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span><Input type="number" value={r.value} onChange={(e) => setCustomEstilo(p => p.map((x, j) => j === i ? {...x, value: e.target.value} : x))} className="h-9 pl-7 text-xs" style={{fontSize:'16px'}} /></div>
                    <button onClick={() => setCustomEstilo(p => p.filter((_, j) => j !== i))} className="p-1.5 hover:bg-red-100 rounded text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setCustomEstilo(p => [...p, {id: Date.now(), desc: '', value: ''}])} className="w-full h-8 border-dashed text-xs mt-2"><Plus className="w-3 h-3 mr-1" />Adicionar outro gasto</Button>
                <div className={cn('flex justify-between items-center mt-4 p-3 rounded-xl', totalEst > limiteEst ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200')}>
                  <span className="font-semibold text-sm">Total Estilo de Vida</span>
                  <div className="text-right">
                    <p className={cn('text-lg font-bold', totalEst > limiteEst ? 'text-red-600' : 'text-emerald-600')}>{fmt(totalEst)}</p>
                    <p className="text-xs text-slate-500">{estPct}% da renda {totalEst > limiteEst ? '(acima de 30%!)' : '(dentro de 30% ✓)'}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setStep(2)} variant="outline" className="h-11"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
                <Button onClick={() => setStep(4)} className="flex-1 h-11 bg-slate-900 hover:bg-slate-800">Ver Fórmula Final <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </div>
          )}

          {/* Step 4 — Fórmula Final */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Fórmula atual */}
              <div className="bg-slate-900 text-white rounded-2xl p-6">
                <h2 className="font-bold text-lg mb-2">Sua Renda Base</h2>
                <p className="text-3xl font-bold mb-5">{fmt(rendaBase)}</p>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Essenciais', real: totalEss, pct: essPct, target: 50, color: parseFloat(essPct) <= 50 ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'Estilo de Vida', real: totalEst, pct: estPct, target: 30, color: parseFloat(estPct) <= 30 ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'Futuro', real: futReal, pct: futPct, target: 20, color: parseFloat(futPct) >= 20 ? 'text-emerald-400' : 'text-amber-400' },
                  ].map(item => (
                    <div key={item.label} className="bg-white/10 rounded-xl p-4 text-center">
                      <p className="text-slate-400 text-xs mb-1">{item.label}</p>
                      <p className={cn('text-2xl font-bold', item.color)}>{item.pct}%</p>
                      <p className="text-slate-400 text-xs">{fmt(item.real)}</p>
                      <p className="text-slate-500 text-xs">meta: {item.target}%</p>
                    </div>
                  ))}
                </div>
                <p className="text-slate-400 text-sm text-center">Fórmula atual: {essPct}/{estPct}/{futPct}</p>
              </div>

              {/* Alertas */}
              {parseFloat(essPct) > 50 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900 text-sm">Essenciais acima de 50%</p>
                    <p className="text-red-700 text-xs mt-1">Diferença: {fmt(totalEss - limiteEss)}. Considere renegociar contratos, buscar moradia mais barata ou aumentar renda.</p>
                  </div>
                </div>
              )}
              {parseFloat(futPct) < 20 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">Futuro abaixo de 20%</p>
                    <p className="text-amber-700 text-xs mt-1">Você está poupando apenas {futPct}%. Meta: reduzir outros gastos para chegar em 20% ({fmt(limiteFut)}).</p>
                  </div>
                </div>
              )}

              {/* Fórmula objetivo */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Fórmula Objetivo (Meta 50/30/20)</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Essenciais', pct: 50, value: rendaBase * 0.5 },
                    { label: 'Estilo de Vida', pct: 30, value: rendaBase * 0.3 },
                    { label: 'Futuro', pct: 20, value: rendaBase * 0.2 },
                  ].map(item => (
                    <div key={item.label} className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-200">
                      <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                      <p className="text-2xl font-bold text-slate-900">{item.pct}%</p>
                      <p className="text-sm text-emerald-700 font-semibold">{fmt(item.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Ações para esse mês</h3>
                {planoAcoes.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs flex items-center justify-center font-semibold flex-shrink-0">{i+1}</span>
                    <Input value={v} onChange={(e) => setPlanoAcoes(p => p.map((x, j) => j === i ? e.target.value : x))}
                      placeholder={`Ação #${i+1}...`} className="h-9 text-sm" style={{fontSize:'16px'}} />
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setStep(3)} variant="outline" className="h-12"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                  className={cn('flex-1 h-12', saveMutation.isSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800')}>
                  {saveMutation.isSuccess ? <><Check className="w-4 h-4 mr-2" />Fórmula Salva!</> : saveMutation.isPending ? 'Salvando...' : 'Salvar Fórmula Personalizada'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AccessControl>
  );
}
