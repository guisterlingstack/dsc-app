import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export default function UserActionsDialog({ open, onOpenChange, action, user, onConfirm, isPending }) {
  const [expiryDate, setExpiryDate] = useState('');
  const handleQuickDate = (days) => { const d = new Date(); d.setDate(d.getDate() + days); setExpiryDate(d.toISOString().split('T')[0]); };
  const handleConfirm = () => { if (action === 'setExpiry') onConfirm({ acesso_ate: expiryDate }); else if (action === 'activate') onConfirm({ status_conta: 'ativa' }); else if (action === 'block') onConfirm({ status_conta: 'bloqueada' }); };
  if (!user) return null;
  const titles = { activate: 'Ativar Conta', block: 'Bloquear Conta', setExpiry: 'Definir Validade' };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{titles[action]}</DialogTitle></DialogHeader>
        {action === 'setExpiry' && (
          <div className="space-y-4">
            <div><Label>Data de Expiração</Label><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1" style={{fontSize:'16px'}} /></div>
            <div className="grid grid-cols-3 gap-2">{[30,90,180].map(d => <Button key={d} type="button" variant="outline" size="sm" onClick={() => handleQuickDate(d)}>+{d} dias</Button>)}</div>
          </div>
        )}
        {action === 'block' && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">Esta ação bloqueará o acesso imediatamente.</div>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
          <Button variant={action === 'block' ? 'destructive' : 'default'} onClick={handleConfirm} disabled={isPending || (action === 'setExpiry' && !expiryDate)}>{isPending ? 'Processando...' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
