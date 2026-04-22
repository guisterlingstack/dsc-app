import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
export default function ActionCard({ title, description, icon: Icon, href, completed, className }) {
  return (
    <Link to={createPageUrl(href)} className={cn("group block rounded-2xl border p-4 transition-all duration-300 hover:shadow-md hover:border-slate-300", completed ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200", className)}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2.5 rounded-xl transition-colors", completed ? "bg-emerald-100" : "bg-slate-100 group-hover:bg-slate-200")}>
          <Icon className={cn("w-5 h-5", completed ? "text-emerald-600" : "text-slate-600")} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn("font-semibold text-sm mb-0.5", completed ? "text-emerald-900" : "text-slate-900")}>{title}</h3>
          <p className={cn("text-xs truncate", completed ? "text-emerald-600" : "text-slate-500")}>{description}</p>
        </div>
        <ChevronRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-1", completed ? "text-emerald-400" : "text-slate-400")} />
      </div>
    </Link>
  );
}
