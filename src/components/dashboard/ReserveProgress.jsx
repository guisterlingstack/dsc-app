import React from 'react';
import { TrendingUp, Target } from 'lucide-react';

export default function ReserveProgress({ current, goal, monthlyContribution }) {
  const percentage = goal > 0 ? (current / goal) * 100 : 0;

  const fmt = (v) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(v || 0);

  // Prazo calculado dinamicamente
  const calcPrazo = () => {
    if (!monthlyContribution || monthlyContribution <= 0) {
      return { text: 'Defina seu aporte para calcular o prazo', icon: null };
    }
    if (current >= goal) {
      return { text: 'Meta atingida! 🎉', icon: '🎉' };
    }
    const mesesRestantes = Math.ceil((goal - current) / monthlyContribution);
    if (mesesRestantes <= 1) return { text: '~1 mês no ritmo atual', icon: '↑' };
    return { text: `~${mesesRestantes} meses no ritmo atual`, icon: '↑' };
  };

  const prazo = calcPrazo();

  return (
    <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-3xl p-6 lg:p-8 text-white">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-white/10 rounded-lg">
          <Target className="w-5 h-5" />
        </div>
        <h2 className="text-base lg:text-lg font-semibold">Sua Reserva de Emergência</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div>
          <p className="text-slate-400 text-xs lg:text-sm mb-1">Saldo Atual</p>
          <p className="text-2xl lg:text-3xl font-bold tracking-tight">{fmt(current)}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs lg:text-sm mb-1">Meta Mínima</p>
          <p className="text-2xl lg:text-3xl font-bold tracking-tight">{fmt(goal)}</p>
        </div>
      </div>

      <div className="mb-4 lg:mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs lg:text-sm text-slate-300">Progresso</span>
          <span className="text-xs lg:text-sm font-semibold text-emerald-400">
            {Math.min(percentage, 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3 lg:h-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs lg:text-sm">
        <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span className="text-slate-300">{prazo.text}</span>
      </div>
    </div>
  );
}
