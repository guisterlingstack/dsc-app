import React from 'react';
import { cn } from '@/lib/utils';
export default function UserStatusBadge({ status }) {
  const cfg = { pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 border-amber-200' }, ativa: { label: 'Ativa', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' }, bloqueada: { label: 'Bloqueada', cls: 'bg-red-100 text-red-800 border-red-200' } };
  const c = cfg[status] || cfg.pendente;
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", c.cls)}>{c.label}</span>;
}
