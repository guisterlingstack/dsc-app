import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { Landmark, Check, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const BANCOS_ESTILO = ['Nubank', 'Inter', 'PicPay', 'C6 Bank', 'Outro'];
const BANCOS_FUTURO = ['Nubank (100% CDI automático)', 'PicPay (102% CDI automático)', 'Inter (100% CDI automático)', 'Inter CDB (100-110% CDI)', 'Nubank CDB', 'Tesouro Selic', 'Outro'];

function CheckItem({ checked, onToggle, title, description, warning }) {
  return (
    <button onClick={onToggle}
      className={cn('w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4', checked ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300')}>
      <div className={cn('w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors', checked ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300')}>
        {checked && <Check className="w-3.5 h-3.5 text-white" />}
      </div>
      <div className="flex-1">
        <p className={cn('font-semibold text-sm', checked ? 'text-emerald-900' : 'text-slate-900')}>{title}</p>
        {description && <p className={cn('text-xs mt-0.5', checked ? 'text-emerald-700' : 'text-slate-500')}>{description}</p>}
        {warning && <div className="flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3 text-red-500" /><p className="text-xs text-red-600">{warning}</p></div>}
      </div>
    </button>
  );
}

export default function BankSetup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('visao'); // visao | conta2 | conta3 | automatizacao | validacao

  // Dados locais das contas
  const [conta2, setConta2] = useState({ banco: '', agencia: '', conta: '', pix: '' });
  const [conta3, setConta3] = useState({ banco: '', agencia: '', conta: '', pix: '', rendimento: '' });
  const [transferDay, setTransferDay] = useState('');
  const [checks2, setChecks2] = useState({});
  const [checks3, setChecks3] = useState({});
  const [checksAuto, setChecksAuto] = useState({});
  const [checksVal, setChecksVal] = useState({});

  const { data: profiles = [] } = useQuery({ queryKey: ['financial-profile'], queryFn: () => entities.FinancialProfile.list(), enabled: !!user });
  const { data: checklists = [] } = useQuery({ queryKey: ['bank-checklist'], queryFn: () => entities.BankChecklist.list(), enabled: !!user });
  const profile = profiles[0];
  const checklist = checklists[0] || {};

  useEffect(() => {
    if (checklist?.transfer_day) setTransferDay(checklist.transfer_day.toString());
  }, [checklist?.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => checklist?.id ? entities.BankChecklist.update(checklist.id, data) : entities.BankChecklist.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-checklist'] }),
  });

  const toggle2 = (key) => { const v = !checks2[key]; setChecks2(p => ({...p, [key]: v})); };
  const toggle3 = (key) => { const v = !checks3[key]; setChecks3(p => ({...p, [key]: v})); };
  const toggleAuto = (key) => { const v = !checksAuto[key]; setChecksAuto(p => ({...p, [key]: v})); if (key === 'automatizacao') saveMutation.mutate({ automatic_transfer_configured: v }); };
  const toggleVal = (key) => setChecksVal(p => ({...p, [key]: !p[key]}));

  const renda = profile?.monthly_income || 0;
  const val2 = renda * 0.3;
  const val3 = renda * 0.2;
  const val1 = renda * 0.5;

  const TABS = [
    { id: 'visao', label: '📊 Visão Geral' },
    { id: 'conta2', label: '💳 Conta 2' },
    { id: 'conta3', label: '🔒 Conta 3' },
    { id: 'automatizacao', label: '⚙️ Automação' },
    { id: 'validacao', label: '✅ Validação' },
  ];

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Configuração das 3 Contas</h1>
            <p className="text-slate-500 text-sm mt-1">Guia passo a passo para organizar sua vida financeira</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium transition-all flex-shrink-0', tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Visão Geral */}
          {tab === 'visao' && (
            <div className="space-y-5">
              <div className="bg-slate-900 text-white rounded-2xl p-6">
                <h2 className="font-bold text-lg mb-5 text-center">As 3 Contas Que Organizam Sua Vida Financeira</h2>
                <div className="flex flex-col items-center gap-3">
                  {/* Conta 1 */}
                  <div className="bg-white/10 rounded-xl p-4 w-full max-w-xs text-center">
                    <p className="text-slate-400 text-xs mb-1">CONTA 1</p>
                    <p className="font-bold">RECEBIMENTO</p>
                    <p className="text-slate-300 text-sm">Salário cai aqui</p>
                    {renda > 0 && <p className="text-emerald-400 font-semibold mt-1">{fmt(val1)} (50%)</p>}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <div className="flex flex-col items-center gap-1">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                      <div className="h-4 w-0.5 bg-slate-600" />
                    </div>
                    <span className="text-xs">Transferência automática no dia do salário</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4 text-center">
                      <p className="text-blue-300 text-xs mb-1">CONTA 2</p>
                      <p className="font-bold text-sm">ESTILO DE VIDA</p>
                      <p className="text-blue-200 text-xs">Com cartão · Pode gastar</p>
                      {renda > 0 && <p className="text-blue-300 font-semibold mt-1 text-sm">{fmt(val2)}<br/><span className="text-xs font-normal">30% da renda</span></p>}
                    </div>
                    <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-4 text-center">
                      <p className="text-emerald-300 text-xs mb-1">CONTA 3</p>
                      <p className="font-bold text-sm">FUTURO</p>
                      <p className="text-emerald-200 text-xs">Sem cartão · Intocável</p>
                      {renda > 0 && <p className="text-emerald-300 font-semibold mt-1 text-sm">{fmt(val3)}<br/><span className="text-xs font-normal">20% da renda</span></p>}
                    </div>
                  </div>
                </div>
                {renda === 0 && <p className="text-center text-slate-400 text-xs mt-4">Configure sua renda em "Pague-se Primeiro" para ver os valores</p>}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Como funciona na prática</p>
                  <p>O salário cai na Conta 1. No mesmo dia, transferências automáticas enviam 30% para a Conta 2 (seu dinheiro de estilo de vida) e 20% para a Conta 3 (sua reserva, intocável). Os 50% restantes pagam seus essenciais.</p>
                </div>
              </div>
              <Button onClick={() => setTab('conta2')} className="w-full h-12 bg-slate-900 hover:bg-slate-800">
                Começar Configuração <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Conta 2 */}
          {tab === 'conta2' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="font-semibold text-blue-900">Conta 2 — Estilo de Vida (30%)</p>
                <p className="text-blue-700 text-sm">Conta com cartão para gastos do dia a dia{renda > 0 ? ` — ${fmt(val2)}/mês` : ''}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="font-semibold text-slate-900">Passo 1 — Escolha o banco</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BANCOS_ESTILO.map(b => (
                    <button key={b} onClick={() => setConta2(p => ({...p, banco: b}))}
                      className={cn('p-3 rounded-xl border-2 text-sm font-medium transition-all', conta2.banco === b ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 hover:border-slate-300 text-slate-700')}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'baixouApp', title: 'Baixei o app e abri cadastro', desc: 'Disponível na App Store ou Google Play' },
                  { key: 'enviouDocs', title: 'Enviei os documentos necessários', desc: 'RG/CNH frente e verso + comprovante de residência + selfie' },
                  { key: 'contaAprovada', title: 'Conta aprovada', desc: 'Aguarde de 5 minutos a 24 horas' },
                  { key: 'solicitouCartao', title: 'Solicitei cartão físico', desc: 'Em "Cartões" → "Solicitar cartão físico" · Prazo 7-15 dias' },
                  { key: 'configurouSenha', title: 'Configurei senha e biometria', desc: 'Ajuste o limite para o valor mensal do Estilo de Vida' },
                ].map(item => (
                  <CheckItem key={item.key} checked={!!checks2[item.key]} onToggle={() => toggle2(item.key)} title={item.title} description={item.desc} />
                ))}
              </div>
              {checks2.contaAprovada && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                  <h3 className="font-semibold text-slate-900">Anote os dados da Conta 2</h3>
                  {[['banco', 'Banco'], ['agencia', 'Agência'], ['conta', 'Conta'], ['pix', 'Chave PIX']].map(([k, l]) => (
                    <div key={k}><Label className="text-xs">{l}</Label><Input value={conta2[k]} onChange={(e) => setConta2(p => ({...p, [k]: e.target.value}))} className="mt-1 h-10" style={{fontSize:'16px'}} /></div>
                  ))}
                </div>
              )}
              <Button onClick={() => setTab('conta3')} className="w-full h-12 bg-slate-900 hover:bg-slate-800">
                Próximo: Conta 3 (Futuro) <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Conta 3 */}
          {tab === 'conta3' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="font-semibold text-emerald-900">Conta 3 — Futuro / Reserva (20%)</p>
                <p className="text-emerald-700 text-sm">Conta SEM cartão, com rendimento automático{renda > 0 ? ` — ${fmt(val3)}/mês` : ''}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="font-semibold text-slate-900">Passo 1 — Escolha o tipo de conta</h3>
                <p className="text-xs text-slate-500">Recomendamos conta com rendimento automático para começar</p>
                <div className="space-y-2">
                  {BANCOS_FUTURO.map(b => (
                    <button key={b} onClick={() => setConta3(p => ({...p, banco: b}))}
                      className={cn('w-full p-3 rounded-xl border-2 text-sm text-left font-medium transition-all', conta3.banco === b ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 hover:border-slate-300 text-slate-700')}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'contaAberta', title: 'Conta aberta e aprovada', desc: 'Mesmos passos da Conta 2' },
                ].map(item => (
                  <CheckItem key={item.key} checked={!!checks3[item.key]} onToggle={() => toggle3(item.key)} title={item.title} description={item.desc} />
                ))}
                <CheckItem checked={!!checks3.semCartao} onToggle={() => { toggle3('semCartao'); saveMutation.mutate({ no_debit_card: !checks3.semCartao }); }}
                  title="NÃO solicitei cartão (físico nem virtual)"
                  description="Esta é a etapa mais importante! Sem cartão = sem tentação"
                  warning="Criar fricção é fundamental para proteger sua reserva" />
                <CheckItem checked={!!checks3.appSeparado} onToggle={() => toggle3('appSeparado')}
                  title="App instalado em dispositivo separado ou sem login salvo"
                  description="Estratégia anti-impulso: 3 passos para sacar mata 90% dos impulsos" />
                <CheckItem checked={!!checks3.rendimento} onToggle={() => toggle3('rendimento')}
                  title="Rendimento automático ativado"
                  description="Em 'Investimentos' → 'Ativar rendimento automático' → confirme 100% CDI" />
              </div>
              {checks3.contaAberta && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                  <h3 className="font-semibold text-slate-900">Anote os dados da Conta 3</h3>
                  {[['banco', 'Banco'], ['agencia', 'Agência'], ['conta', 'Conta'], ['pix', 'Chave PIX'], ['rendimento', 'Rendimento (ex: 100% CDI)']].map(([k, l]) => (
                    <div key={k}><Label className="text-xs">{l}</Label><Input value={conta3[k]} onChange={(e) => setConta3(p => ({...p, [k]: e.target.value}))} className="mt-1 h-10" style={{fontSize:'16px'}} /></div>
                  ))}
                </div>
              )}
              <Button onClick={() => setTab('automatizacao')} className="w-full h-12 bg-slate-900 hover:bg-slate-800">
                Próximo: Configurar Automação <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Automação */}
          {tab === 'automatizacao' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-semibold text-amber-900">⚙️ Transferências Automáticas</p>
                <p className="text-amber-700 text-sm">Configure no app da Conta 1 (seu banco principal)</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Qual dia cai seu salário?</h3>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">Dia</span>
                  <Input type="number" min="1" max="31" value={transferDay}
                    onChange={(e) => { setTransferDay(e.target.value); const n = parseInt(e.target.value); if (n >= 1 && n <= 31) saveMutation.mutate({ transfer_day: n, transfer_date_defined: true }); }}
                    className="w-20 text-center h-11 text-lg" style={{fontSize:'16px'}} />
                  <span className="text-slate-500">de cada mês</span>
                </div>
                {transferDay && <p className="text-xs text-slate-500 mt-2">Configure as transferências para o mesmo dia ou no dia seguinte ao recebimento</p>}
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">Conta 1 → Conta 2 (Estilo de Vida)</h3>
                {[
                  { key: 'abriuTransferencias', title: 'Abri menu "Transferências" no app da Conta 1', desc: 'Busque "Agendamento" ou "Transferência programada"' },
                  { key: 'configurouConta2', title: `Configurei transferência de ${fmt(val2)} para Conta 2`, desc: conta2.banco ? `Banco: ${conta2.banco} · Frequência: Mensal · Dia: ${transferDay || '___'}` : 'Preencha os dados da Conta 2 primeiro' },
                ].map(item => (
                  <CheckItem key={item.key} checked={!!checksAuto[item.key]} onToggle={() => toggleAuto(item.key)} title={item.title} description={item.desc} />
                ))}
                <h3 className="font-semibold text-slate-900 mt-2">Conta 1 → Conta 3 (Futuro)</h3>
                {[
                  { key: 'configurouConta3', title: `Configurei transferência de ${fmt(val3)} para Conta 3`, desc: conta3.banco ? `Banco: ${conta3.banco} · Frequência: Mensal · Dia: ${transferDay || '___'}` : 'Preencha os dados da Conta 3 primeiro' },
                  { key: 'automatizacao', title: 'Sistema de automação configurado ✓', desc: 'Agora tudo acontece automaticamente no dia do salário' },
                ].map(item => (
                  <CheckItem key={item.key} checked={!!checksAuto[item.key]} onToggle={() => toggleAuto(item.key)} title={item.title} description={item.desc} />
                ))}
              </div>
              <Button onClick={() => setTab('validacao')} className="w-full h-12 bg-slate-900 hover:bg-slate-800">
                Próximo: Validação Final <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Validação */}
          {tab === 'validacao' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white rounded-xl p-4 text-center">
                <p className="font-bold text-lg">Checklist de Validação Final</p>
                <p className="text-slate-400 text-sm">Confirme tudo antes de considerar o sistema configurado</p>
              </div>
              {[
                { key: 'c1ok', title: 'Conta 1 (Recebimento) ✓', desc: `Salário cai aqui · Tem as 2 transferências automáticas configuradas · Fica com ${fmt(val1)} (50%)` },
                { key: 'c2ok', title: 'Conta 2 (Estilo de Vida) ✓', desc: `Recebe ${fmt(val2)} automaticamente · Tem cartão para usar · Limite ajustado` },
                { key: 'c3ok', title: 'Conta 3 (Futuro) ✓', desc: `Recebe ${fmt(val3)} automaticamente · SEM cartão vinculado · Rendimento ativado` },
                { key: 'testou', title: 'Testei no primeiro mês', desc: 'As transferências aconteceram automaticamente na data certa' },
                { key: 'sistemaOk', title: 'Sistema 100% operacional ✓', desc: `Configurado em: ${new Date().toLocaleDateString('pt-BR')}` },
              ].map(item => (
                <CheckItem key={item.key} checked={!!checksVal[item.key]} onToggle={() => { toggleVal(item.key); if (item.key === 'c3ok') saveMutation.mutate({ separate_account_created: !checksVal[item.key] }); }} title={item.title} description={item.desc} />
              ))}
              {Object.values(checksVal).filter(Boolean).length === 5 && (
                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-6 text-center">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"><Check className="w-7 h-7 text-emerald-600" /></div>
                  <h3 className="font-bold text-emerald-900 text-lg mb-1">🎉 Sistema Configurado!</h3>
                  <p className="text-emerald-700 text-sm">Seu dinheiro agora se organiza automaticamente todo mês.</p>
                  <p className="text-emerald-600 text-xs mt-2">Próxima revisão em 30 dias</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AccessControl>
  );
}
