import React from 'react';
import { ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
export default function NextAction({ action }) {
  if (!action) return null;
  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-amber-100 rounded-xl flex-shrink-0"><Zap className="w-5 h-5 text-amber-600" /></div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 text-sm mb-1">Próxima Ação Recomendada</h3>
          <p className="text-slate-600 text-sm mb-3">{action.description}</p>
          <Link to={createPageUrl(action.page)}>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white h-10">{action.buttonText}<ArrowRight className="w-4 h-4 ml-2" /></Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
