import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { Search, Plus, Trash2, Coffee, CreditCard, ShoppingBag, AlertTriangle, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// ─── Dados pré-preenchidos por categoria ─────────────────
const PEQUENOS_ITEMS = [
  'Cafézinho', 'Lanche rápido', 'Uber/99 curto', 'Delivery individual',
  'Cigarro/vape', 'Água/bebida comprada', 'Estacionamento evitável', 'Pedágio evitável',
];

const ASSINATURAS_ITEMS = [
  'Netflix', 'Prime Video', 'Spotify/Apple Music', 'Disney+', 'HBO Max',
  'Globoplay', 'YouTube Premium', 'Academia', 'Box de crossfit',
  'App meditação', 'App idiomas', 'Cloud storage extra', 'Antivírus', 'VPN',
];

// ─── Componente Tabela Interativa ─────────────────────────
function LeakageTable({ title, icon: Icon, color, items, rows, setRows, subtotalKey }) {
  const addRow = (description = '') => setRows(prev => [...prev, { id: Date.now(), description, frequency: '', value: '', total: 0 }]);
  const updateRow = (id, field, val) => setRows(prev => prev.map(r => {
    if (r.id !== id) return r;
    const updated = { ...r, [field]: val };
    updated.total = (parseFloat(updated.frequency) || 0) * (parseFloat(updated.value) || 0);
    return updated;
  }));
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));
  const subtotal = rows.reduce((s, r) => s + (r.total || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className={cn('p-4 flex items-center gap-3', color)}>
        <div className="p-2 bg-white/30 rounded-lg"><Icon className="w-5 h-5" /></div>
        <h3 className="font-bold text-base">{title}</h3>
      </div>
      <div className="p-4 space-y-2">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 font-medium px-1 hidden sm:grid">
          <div className="col-span-5">Item</div>
          <div className="col-span-2 text-center">Vezes/mês</div>
          <div className="col-span-2 text-center">Valor unit.</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-1" />
        </div>
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-12 sm:col-span-5">
              <Input value={row.description} onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                placeholder="Descrição..." className="h-9 text-sm" style={{fontSize:'16px'}} />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Input type="number" value={row.frequency} onChange={(e) => updateRow(row.id, 'frequency', e.target.value)}
                placeholder="Qtd" className="h-9 text-sm text-center" style={{fontSize:'16px'}} />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Input type="number" value={row.value} onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                placeholder="R$" className="h-9 text-sm text-center" style={{fontSize:'16px'}} />
            </div>
            <div className="col-span-3 sm:col-span-2 text-right">
              <span className={cn('text-sm font-semibold', row.total > 0 ? 'text-red-600' : 'text-slate-300')}>
                {row.total > 0 ? fmt(row.total) : '—'}
              </span>
            </div>
            <div className="col-span-1 flex justify-end">
              <button onClick={() => removeRow(row.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-slate-300 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {/* Add buttons */}
        {items && (
          <div className="flex flex-wrap gap-2 pt-2">
            {items.filter(i => !rows.find(r => r.description === i)).slice(0, 4).map(item => (
              <button key={item} onClick={() => addRow(item)}
                className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
                + {item}
              </button>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => addRow()} className="w-full h-9 mt-2 border-dashed">
          <Plus className="w-4 h-4 mr-1" /> Adicionar linha
        </Button>
        {/* Subtotal */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
          <span className="font-semibold text-slate-700">Subtotal {title.split(':')[0]}</span>
          <span className={cn('text-lg font-bold', subtotal > 0 ? 'text-red-600' : 'text-slate-300')}>
            {subtotal > 0 ? fmt(subtotal) : 'R$ 0,00'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Tabela Assinaturas ────────────────────────
function AssinaturasTable({ rows, setRows }) {
  const addRow = (name = '') => setRows(prev => [...prev, { id: Date.now(), name, value: '', used: null }]);
  const updateRow = (id, field, val) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));
  const subtotal = rows.filter(r => r.used === false).reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
  const total = rows.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-4 flex items-center gap-3 bg-blue-600 text-white">
        <div className="p-2 bg-white/30 rounded-lg"><CreditCard className="w-5 h-5" /></div>
        <h3 className="font-bold text-base">Vazamento 2: Assinaturas Esquecidas</h3>
      </div>
      <div className="p-4 space-y-2">
        <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 font-medium px-1 hidden sm:grid">
          <div className="col-span-5">Assinatura</div>
          <div className="col-span-3 text-center">Valor/mês</div>
          <div className="col-span-3 text-center">Usou esse mês?</div>
          <div className="col-span-1" />
        </div>
        {rows.map((row) => (
          <div key={row.id} className={cn('grid grid-cols-12 gap-2 items-center p-1 rounded-lg', row.used === false && 'bg-red-50')}>
            <div className="col-span-12 sm:col-span-5">
              <Input value={row.name} onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                placeholder="Nome da assinatura..." className="h-9 text-sm" style={{fontSize:'16px'}} />
            </div>
            <div className="col-span-5 sm:col-span-3">
              <Input type="number" value={row.value} onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                placeholder="R$" className="h-9 text-sm text-center" style={{fontSize:'16px'}} />
            </div>
            <div className="col-span-5 sm:col-span-3 flex gap-2 justify-center">
              <button onClick={() => updateRow(row.id, 'used', true)}
                className={cn('flex-1 h-9 rounded-lg text-xs font-medium transition-colors', row.used === true ? 'bg-emerald-500 text-white' : 'bg-slate-100 hover:bg-emerald-100 text-slate-600')}>
                Sim
              </button>
              <button onClick={() => updateRow(row.id, 'used', false)}
                className={cn('flex-1 h-9 rounded-lg text-xs font-medium transition-colors', row.used === false ? 'bg-red-500 text-white' : 'bg-slate-100 hover:bg-red-100 text-slate-600')}>
                Não
              </button>
            </div>
            <div className="col-span-2 sm:col-span-1 flex justify-end">
              <button onClick={() => removeRow(row.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-slate-300 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          {ASSINATURAS_ITEMS.filter(i => !rows.find(r => r.name === i)).slice(0, 5).map(item => (
            <button key={item} onClick={() => addRow(item)}
              className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
              + {item}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => addRow()} className="w-full h-9 mt-2 border-dashed">
          <Plus className="w-4 h-4 mr-1" /> Adicionar assinatura
        </Button>
        <div className="pt-3 border-t border-slate-100 space-y-1">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Total em assinaturas</span><span>{fmt(total)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-700">Assinaturas não usadas (cancelar!)</span>
            <span className={cn('text-lg font-bold', subtotal > 0 ? 'text-red-600' : 'text-slate-300')}>{fmt(subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Tabela Impulso ────────────────────────────
function ImpulsoTable({ rows, setRows }) {
  const addRow = () => setRows(prev => [...prev, { id: Date.now(), when: '', what: '', value: '', used: null }]);
  const updateRow = (id, field, val) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));
  const subtotal = rows.filter(r => r.used === false).reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
  const total = rows.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-4 flex items-center gap-3 bg-pink-600 text-white">
        <div className="p-2 bg-white/30 rounded-lg"><ShoppingBag className="w-5 h-5" /></div>
        <h3 className="font-bold text-base">Vazamento 3: Compras por Impulso</h3>
      </div>
      <div className="p-4 space-y-2">
        <p className="text-xs text-slate-500 mb-3">Revise os últimos 30 dias e liste compras não planejadas</p>
        <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 font-medium px-1 hidden sm:grid">
          <div className="col-span-3">Quando</div>
          <div className="col-span-4">O que comprou</div>
          <div className="col-span-2 text-center">Valor</div>
          <div className="col-span-2 text-center">Usa?</div>
          <div className="col-span-1" />
        </div>
        {rows.map((row) => (
          <div key={row.id} className={cn('grid grid-cols-12 gap-2 items-center p-1 rounded-lg', row.used === false && 'bg-red-50')}>
            <div className="col-span-12 sm:col-span-3">
              <Input type="date" value={row.when} onChange={(e) => updateRow(row.id, 'when', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="col-span-7 sm:col-span-4">
              <Input value={row.what} onChange={(e) => updateRow(row.id, 'what', e.target.value)}
                placeholder="O que comprou..." className="h-9 text-sm" style={{fontSize:'16px'}} />
            </div>
            <div className="col-span-5 sm:col-span-2">
              <Input type="number" value={row.value} onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                placeholder="R$" className="h-9 text-sm text-center" style={{fontSize:'16px'}} />
            </div>
            <div className="col-span-5 sm:col-span-2 flex gap-1">
              <button onClick={() => updateRow(row.id, 'used', true)}
                className={cn('flex-1 h-9 rounded-lg text-xs font-medium', row.used === true ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600')}>Sim</button>
              <button onClick={() => updateRow(row.id, 'used', false)}
                className={cn('flex-1 h-9 rounded-lg text-xs font-medium', row.used === false ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600')}>Não</button>
            </div>
            <div className="col-span-2 sm:col-span-1 flex justify-end">
              <button onClick={() => removeRow(row.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addRow} className="w-full h-9 mt-2 border-dashed">
          <Plus className="w-4 h-4 mr-1" /> Adicionar compra
        </Button>
        <div className="pt-3 border-t border-slate-100 space-y-1">
          <div className="flex justify-between text-sm text-slate-500"><span>Total identificado</span><span>{fmt(total)}</span></div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-700">Subtotal Impulso</span>
            <span className={cn('text-lg font-bold', subtotal > 0 ? 'text-red-600' : 'text-slate-300')}>{fmt(subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────
export default function LeakageDetector() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('detector'); // 'detector' | 'plano'

  // Rows para cada tabela
  const [pequenosRows, setPequenosRows] = useState(PEQUENOS_ITEMS.slice(0, 4).map((d, i) => ({ id: i + 1, description: d, frequency: '', value: '', total: 0 })));
  const [assinaturasRows, setAssinaturasRows] = useState(ASSINATURAS_ITEMS.slice(0, 5).map((d, i) => ({ id: i + 100, name: d, value: '', used: null })));
  const [impulsoRows, setImpulsoRows] = useState([]);

  // Cortes do plano de ação
  const [cortes1, setCortes1] = useState(['', '', '']);
  const [cancelamentos, setCancelamentos] = useState(['', '', '', '', '']);
  const [regra72, setRegra72] = useState({ wait: false, note: false, reavaluate: false, useEstilo: false });
  const [destinoReserva, setDestinoReserva] = useState('');

  // Totais
  const sub1 = pequenosRows.reduce((s, r) => s + (r.total || 0), 0);
  const sub2 = assinaturasRows.filter(r => r.used === false).reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
  const sub3 = impulsoRows.filter(r => r.used === false).reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
  const totalVazando = sub1 + sub2 + sub3;
  const economiaCort = (sub1 * 0.5).toFixed(2);
  const economiaCancel = sub2;
  const economiaRegra = (sub3 * 0.3).toFixed(2);
  const totalRecuperado = parseFloat(economiaCort) + economiaCancel + parseFloat(economiaRegra);

  const { data: savedLeakages = [] } = useQuery({ queryKey: ['leakages'], queryFn: () => entities.LeakageExpense.list('-date'), enabled: !!user });
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Salva os vazamentos principais como registros
      const toSave = [
        { description: 'Gastos Pequenos e Frequentes', amount: sub1, category: 'gastos_pequenos', date: new Date().toISOString().split('T')[0] },
        { description: 'Assinaturas não usadas', amount: sub2, category: 'assinaturas', date: new Date().toISOString().split('T')[0] },
        { description: 'Compras por Impulso', amount: sub3, category: 'compras_impulso', date: new Date().toISOString().split('T')[0] },
      ].filter(i => i.amount > 0);
      for (const item of toSave) await entities.LeakageExpense.create(item);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leakages'] }),
  });

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C9A84C]/15 rounded-lg flex-shrink-0"><Search className="w-5 h-5 text-[#C9A84C]" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Detector de Vazamentos</h1>
              <p className="text-slate-500 text-sm mt-1">Identifique R$400-800/mês desperdiçados sem perceber</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
            {[{ id: 'detector', label: '🔍 Detector' }, { id: 'plano', label: '✂️ Plano de Ação' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'detector' && (
            <div className="space-y-5">
              <LeakageTable title="Vazamento 1: Gastos Pequenos e Frequentes" icon={Coffee}
                color="bg-amber-500 text-white" items={PEQUENOS_ITEMS}
                rows={pequenosRows} setRows={setPequenosRows} subtotalKey="sub1" />
              <AssinaturasTable rows={assinaturasRows} setRows={setAssinaturasRows} />
              <ImpulsoTable rows={impulsoRows} setRows={setImpulsoRows} />

              {/* Resumo */}
              {totalVazando > 0 && (
                <div className="bg-slate-900 text-white rounded-2xl p-6">
                  <h3 className="font-bold text-lg mb-4">💸 Total Vazando por Mês</h3>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-slate-300 text-sm"><span>Vazamento 1 — Gastos pequenos</span><span>{fmt(sub1)}</span></div>
                    <div className="flex justify-between text-slate-300 text-sm"><span>Vazamento 2 — Assinaturas não usadas</span><span>{fmt(sub2)}</span></div>
                    <div className="flex justify-between text-slate-300 text-sm"><span>Vazamento 3 — Compras por impulso</span><span>{fmt(sub3)}</span></div>
                  </div>
                  <div className="border-t border-white/20 pt-4">
                    <div className="flex justify-between items-center mb-1"><span className="font-semibold">Total Geral</span><span className="text-2xl font-bold text-red-400">{fmt(totalVazando)}</span></div>
                    <div className="flex justify-between text-slate-400 text-sm"><span>Em 1 ano:</span><span>{fmt(totalVazando * 12)}</span></div>
                  </div>
                </div>
              )}

              {totalVazando > 0 && (
                <div className="flex gap-3">
                  <Button onClick={() => setTab('plano')} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700">
                    Ver Plano de Ação <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button onClick={() => saveMutation.mutate()} variant="outline" className="h-12" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === 'plano' && (
            <div className="space-y-5">
              {/* Resumo rápido */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Vazamento 1', value: sub1 },
                  { label: 'Vazamento 2', value: sub2 },
                  { label: 'Vazamento 3', value: sub3 },
                ].map(i => (
                  <div key={i.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                    <p className="text-xs text-slate-500">{i.label}</p>
                    <p className="font-bold text-red-600">{fmt(i.value)}</p>
                  </div>
                ))}
              </div>

              {/* Ação 1 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-amber-100 rounded-lg"><Coffee className="w-4 h-4 text-amber-600" /></div>
                  <h3 className="font-semibold text-slate-900">Do Vazamento 1 — Corte 50%</h3>
                  <span className="ml-auto text-emerald-600 font-semibold text-sm">Economia: {fmt(sub1 * 0.5)}/mês</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Liste 3 gastos pequenos que pode reduzir pela metade:</p>
                {cortes1.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs flex items-center justify-center font-semibold flex-shrink-0">{i+1}</span>
                    <Input value={v} onChange={(e) => setCortes1(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                      placeholder={`Gasto #${i+1} que vou reduzir...`} className="h-9 text-sm" style={{fontSize:'16px'}} />
                  </div>
                ))}
              </div>

              {/* Ação 2 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg"><CreditCard className="w-4 h-4 text-blue-600" /></div>
                  <h3 className="font-semibold text-slate-900">Do Vazamento 2 — Cancele o não usado</h3>
                  <span className="ml-auto text-emerald-600 font-semibold text-sm">Economia: {fmt(sub2)}/mês</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Liste as assinaturas que NÃO usou nos últimos 30 dias:</p>
                {cancelamentos.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs flex items-center justify-center font-semibold flex-shrink-0">{i+1}</span>
                    <Input value={v} onChange={(e) => setCancelamentos(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                      placeholder={`Assinatura #${i+1} para cancelar...`} className="h-9 text-sm" style={{fontSize:'16px'}} />
                  </div>
                ))}
              </div>

              {/* Ação 3 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-pink-100 rounded-lg"><ShoppingBag className="w-4 h-4 text-pink-600" /></div>
                  <h3 className="font-semibold text-slate-900">Do Vazamento 3 — Regra das 72 horas</h3>
                  <span className="ml-auto text-emerald-600 font-semibold text-sm">Economia estimada: {fmt(sub3 * 0.3)}/mês</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">A partir de hoje, toda compra não essencial:</p>
                <div className="space-y-2">
                  {[
                    { key: 'wait', label: 'Espere 3 dias antes de comprar' },
                    { key: 'note', label: 'Anote o que quer comprar + data' },
                    { key: 'reavaluate', label: 'Reavalie após 72 horas' },
                    { key: 'useEstilo', label: 'Se ainda quiser, use Estilo de Vida (nunca Futuro)' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                      <div onClick={() => setRegra72(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                        className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors', regra72[item.key] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300')}>
                        {regra72[item.key] && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Total Recuperado */}
              <div className="bg-emerald-600 rounded-2xl p-6 text-white">
                <h3 className="font-bold text-lg mb-4">💰 Total Recuperado por Mês</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-emerald-100 text-sm"><span>Cortar 50% gastos pequenos</span><span>+{fmt(sub1 * 0.5)}</span></div>
                  <div className="flex justify-between text-emerald-100 text-sm"><span>Cancelar assinaturas não usadas</span><span>+{fmt(sub2)}</span></div>
                  <div className="flex justify-between text-emerald-100 text-sm"><span>Regra 72h (estimativa 30%)</span><span>+{fmt(sub3 * 0.3)}</span></div>
                </div>
                <div className="border-t border-white/20 pt-4">
                  <div className="flex justify-between items-center mb-3"><span className="font-semibold text-lg">Total Recuperado</span><span className="text-2xl font-bold">{fmt(totalRecuperado)}/mês</span></div>
                  <p className="text-emerald-200 text-sm">Destino desse dinheiro:</p>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {[
                      { key: '100reserva', label: '100% para reserva de emergência' },
                      { key: '5050', label: '50% reserva + 50% estilo de vida consciente' },
                    ].map(opt => (
                      <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                        <div onClick={() => setDestinoReserva(opt.key)}
                          className={cn('w-4 h-4 rounded-full border-2 flex-shrink-0', destinoReserva === opt.key ? 'bg-white border-white' : 'border-white/50')}>
                          {destinoReserva === opt.key && <div className="w-2 h-2 rounded-full bg-emerald-600 m-auto" />}
                        </div>
                        <span className="text-sm text-emerald-100">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <Button onClick={() => saveMutation.mutate()} className="w-full h-12 bg-slate-900 hover:bg-slate-800" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : '✔ Salvar Análise Completa'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AccessControl>
  );
}
