import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { BarChart2, Users, MousePointer, TrendingUp, Calendar, Smartphone, Monitor, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (n) => new Intl.NumberFormat('pt-BR').format(n || 0);

function StatCard({ title, value, icon: Icon, sub, color = 'bg-white border-slate-200' }) {
  return (
    <div className={cn('rounded-2xl border p-5', color)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className="p-2 bg-slate-100 rounded-xl"><Icon className="w-4 h-4 text-slate-600" /></div>
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(7); // dias

  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

  const { data: events = [] } = useQuery({
    queryKey: ['analytics-events', period],
    queryFn: async () => {
      const { data } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user && ['admin', 'admin_master'].includes(user?.role),
  });

  const { data: totalUsers = 0 } = useQuery({
    queryKey: ['total-users'],
    queryFn: async () => {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      return count || 0;
    },
    enabled: !!user,
  });

  // Métricas
  const uniqueUsers = new Set(events.filter(e => e.user_id).map(e => e.user_id)).size;
  const uniqueSessions = new Set(events.map(e => e.session_id)).size;
  const pageViews = events.filter(e => e.event_name === 'page_view').length;

  // Páginas mais visitadas
  const pageCount = {};
  events.filter(e => e.event_name === 'page_view').forEach(e => {
    const p = e.page || 'Home';
    pageCount[p] = (pageCount[p] || 0) + 1;
  });
  const topPages = Object.entries(pageCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Eventos mais comuns
  const eventCount = {};
  events.filter(e => e.event_name !== 'page_view').forEach(e => {
    eventCount[e.event_name] = (eventCount[e.event_name] || 0) + 1;
  });
  const topEvents = Object.entries(eventCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Dispositivos
  const devices = { mobile: 0, desktop: 0, tablet: 0 };
  events.forEach(e => { if (e.device_type) devices[e.device_type] = (devices[e.device_type] || 0) + 1; });
  const totalDevices = Object.values(devices).reduce((s, v) => s + v, 0);

  // Usuários ativos por dia
  const byDay = {};
  events.forEach(e => {
    const day = e.created_at?.split('T')[0];
    if (day) {
      if (!byDay[day]) byDay[day] = new Set();
      if (e.user_id) byDay[day].add(e.user_id);
    }
  });
  const dailyActive = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-7);

  const maxDaily = Math.max(...dailyActive.map(([, s]) => s.size), 1);

  if (!['admin', 'admin_master'].includes(user?.role)) return null;

  return (
    <div className="p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-purple-100 rounded-lg"><BarChart2 className="w-5 h-5 text-purple-600" /></div>
              <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
            </div>
            <p className="text-slate-500 text-sm">Monitoramento de uso e comportamento dos usuários</p>
          </div>
          {/* Período */}
          <div className="flex gap-2">
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', period === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Stats principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total de Usuários" value={fmt(totalUsers)} icon={Users} sub="cadastrados" />
          <StatCard title="Usuários Ativos" value={fmt(uniqueUsers)} icon={TrendingUp} sub={`últimos ${period} dias`} color="bg-emerald-50 border-emerald-200" />
          <StatCard title="Sessões" value={fmt(uniqueSessions)} icon={MousePointer} sub={`últimos ${period} dias`} color="bg-blue-50 border-blue-200" />
          <StatCard title="Page Views" value={fmt(pageViews)} icon={BarChart2} sub={`últimos ${period} dias`} color="bg-purple-50 border-purple-200" />
        </div>

        {/* Usuários ativos por dia */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-5">Usuários Ativos por Dia</h3>
          {dailyActive.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Nenhum dado ainda</p>
          ) : (
            <div className="flex items-end gap-2 h-28">
              {dailyActive.map(([day, usersSet]) => {
                const count = usersSet.size;
                const pct = (count / maxDaily) * 100;
                const label = new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-slate-600">{count}</span>
                    <div className="w-full bg-slate-100 rounded-t-lg overflow-hidden" style={{ height: '80px' }}>
                      <div className="w-full bg-purple-500 rounded-t-lg transition-all"
                        style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Páginas mais visitadas */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Páginas Mais Visitadas</h3>
            {topPages.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">Nenhum dado ainda</p>
            : (
              <div className="space-y-3">
                {topPages.map(([page, count]) => {
                  const max = topPages[0][1];
                  return (
                    <div key={page}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{page}</span>
                        <span className="text-slate-500">{fmt(count)} views</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Eventos mais comuns */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Ações Mais Realizadas</h3>
            {topEvents.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">Nenhum dado ainda</p>
            : (
              <div className="space-y-3">
                {topEvents.map(([event, count]) => {
                  const max = topEvents[0][1];
                  const label = event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  return (
                    <div key={event}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{label}</span>
                        <span className="text-slate-500">{fmt(count)}x</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Dispositivos */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Dispositivos</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'mobile', label: 'Mobile', icon: Smartphone, color: 'text-blue-600 bg-blue-50' },
              { key: 'desktop', label: 'Desktop', icon: Monitor, color: 'text-slate-600 bg-slate-100' },
              { key: 'tablet', label: 'Tablet', icon: Tablet, color: 'text-purple-600 bg-purple-50' },
            ].map(({ key, label, icon: Icon, color }) => {
              const count = devices[key] || 0;
              const pct = totalDevices > 0 ? ((count / totalDevices) * 100).toFixed(0) : 0;
              return (
                <div key={key} className="text-center">
                  <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2', color)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{pct}%</p>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xs text-slate-400">{fmt(count)} sessões</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feed de eventos recentes */}
        <div className="bg-white rounded-2xl border border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Eventos Recentes</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {events.slice(0, 20).length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Nenhum evento registrado ainda</div>
            ) : events.slice(0, 20).map(e => (
              <div key={e.id} className="p-3 flex items-center gap-3 hover:bg-slate-50">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-700">{e.event_name.replace(/_/g, ' ')}</span>
                  {e.page && <span className="text-xs text-slate-400 ml-2">· {e.page}</span>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">{e.device_type}</p>
                  <p className="text-xs text-slate-300">{new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
