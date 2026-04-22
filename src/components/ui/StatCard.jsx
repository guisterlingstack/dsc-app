import React from 'react';
import { cn } from '@/lib/utils';
export default function StatCard({ title, value, subtitle, icon: Icon, variant = 'default', className }) {
  const variants = { default: 'bg-white border-slate-200', warning: 'bg-amber-50 border-amber-200', success: 'bg-emerald-50 border-emerald-200' };
  return (
    <div className={cn("rounded-2xl border p-5 transition-all", variants[variant], className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">{title}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && <div className="p-2 bg-slate-100 rounded-xl"><Icon className="w-4 h-4 text-slate-600" /></div>}
      </div>
    </div>
  );
}
