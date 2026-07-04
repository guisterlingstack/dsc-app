import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import AccessControl from '@/components/AccessControl';
import { User, Save, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function UserSettings() {
  const { user, updateProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName });
      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <AccessControl>
      <div className="p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C9A84C]/15 rounded-lg"><User className="w-5 h-5 text-[#C9A84C]" /></div>
            <div><h1 className="text-2xl font-bold text-slate-900">Configurações</h1><p className="text-slate-500 text-sm">Personalize sua experiência</p></div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <h2 className="font-semibold text-slate-900">Informações Pessoais</h2>
            <div>
              <Label>Email</Label>
              <Input type="email" value={user.email} disabled className="mt-1 bg-slate-50 h-11" />
              <p className="text-xs text-slate-500 mt-1">Não é possível alterar o email</p>
            </div>
            <div>
              <Label>Nome Completo</Label>
              <Input type="text" value={user.full_name || ''} disabled className="mt-1 bg-slate-50 h-11" />
            </div>
            <div>
              <Label>Nome Exibido no Dashboard</Label>
              <Input type="text" placeholder="Como você gostaria de ser chamado?" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 h-11" style={{fontSize:'16px'}} />
              <p className="text-xs text-slate-500 mt-1">Este nome aparecerá na saudação "Olá, [Nome]"</p>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 h-11">
                <Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Conta</h2>
            <Button onClick={signOut} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-11">
              <LogOut className="w-4 h-4 mr-2" />Sair da Conta
            </Button>
          </div>
        </div>
      </div>
    </AccessControl>
  );
}
