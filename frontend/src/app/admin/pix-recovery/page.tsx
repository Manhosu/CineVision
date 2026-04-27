'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';

interface Stats {
  totalOffered: number;
  totalConverted: number;
  conversionRate: number;
  revenueCentsRecovered: number;
  settings: {
    enabled: boolean;
    delayMinutes: number;
    discountPercent: number;
    blockDaysMin: number;
    blockDaysMax: number;
    maxItems: number;
  };
}

const fmtMoney = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PixRecoveryPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Stats['settings'] | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [s, h] = await Promise.all([
        api.get<Stats>('/api/v1/admin/pix-recovery/stats'),
        api.get<any[]>('/api/v1/admin/pix-recovery/history?limit=50'),
      ]);
      setStats(s);
      setSettings(s.settings);
      setHistory(h);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveSettings = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      if (settings.blockDaysMax < settings.blockDaysMin) {
        toast.error('Bloqueio máximo precisa ser ≥ mínimo');
        setSaving(false);
        return;
      }
      await api.put('/api/v1/admin/pix-recovery/settings', {
        enabled: settings.enabled,
        delayMinutes: settings.delayMinutes,
        discountPercent: settings.discountPercent,
        blockDaysMin: settings.blockDaysMin,
        blockDaysMax: settings.blockDaysMax,
        maxItems: settings.maxItems,
      });
      toast.success('Configurações salvas!');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !stats) return <div className="p-8 text-white">Carregando...</div>;

  return (
    <div className="mx-auto max-w-5xl p-6 text-white">
      <h1 className="mb-6 text-3xl font-bold">Recuperação de vendas PIX</h1>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Ofertas enviadas" value={stats.totalOffered} />
        <StatCard title="Convertidas" value={stats.totalConverted} color="text-green-400" />
        <StatCard title="Conversão" value={`${(stats.conversionRate * 100).toFixed(1)}%`} color="text-yellow-400" />
        <StatCard title="Receita recuperada" value={fmtMoney(stats.revenueCentsRecovered)} color="text-emerald-400" />
      </div>

      {/* Settings */}
      {settings && (
        <div className="mb-8 rounded-xl border border-white/10 bg-zinc-900 p-6">
          <h2 className="mb-4 text-xl font-bold">Configurações</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Ativo">
              <select
                value={settings.enabled ? '1' : '0'}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.value === '1' })}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
              >
                <option value="1">Sim</option>
                <option value="0">Não</option>
              </select>
            </Field>
            <Field label="Tempo até disparar (min)">
              <input
                type="number"
                value={settings.delayMinutes}
                onChange={(e) => setSettings({ ...settings, delayMinutes: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
              />
            </Field>
            <Field label="Desconto oferecido (%)">
              <input
                type="number"
                value={settings.discountPercent}
                onChange={(e) => setSettings({ ...settings, discountPercent: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
              />
            </Field>
            <Field label="Bloqueio mínimo após oferta (dias)">
              <input
                type="number"
                min={1}
                value={settings.blockDaysMin}
                onChange={(e) => setSettings({ ...settings, blockDaysMin: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
              />
            </Field>
            <Field label="Bloqueio máximo após oferta (dias)">
              <input
                type="number"
                min={1}
                value={settings.blockDaysMax}
                onChange={(e) => setSettings({ ...settings, blockDaysMax: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
              />
            </Field>
            <Field label="Máximo de itens elegíveis">
              <input
                type="number"
                value={settings.maxItems}
                onChange={(e) => setSettings({ ...settings, maxItems: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            🛡️ Anti-fraude: depois que um cliente recebe a oferta, ele fica bloqueado
            por um número aleatório de dias entre o mínimo e o máximo. Como o cliente
            não consegue prever quando volta a ser elegível, ele não tem como
            "esperar pra ganhar desconto sempre".
          </p>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="mt-4 rounded-lg bg-red-600 px-5 py-2 font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border border-white/10 bg-zinc-900 p-6">
        <h2 className="mb-4 text-xl font-bold">Histórico recente</h2>
        {history.length === 0 ? (
          <p className="text-zinc-400">Nenhuma oferta de recuperação enviada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left">
                <tr>
                  <th className="py-2">Data</th>
                  <th>Usuário</th>
                  <th>Desconto</th>
                  <th>Bloqueado até</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const blockedUntil = h.next_eligible_at
                    ? new Date(h.next_eligible_at)
                    : null;
                  const stillBlocked = blockedUntil && blockedUntil > new Date();
                  return (
                    <tr key={h.id} className="border-b border-white/5">
                      <td className="py-2 text-zinc-400">
                        {new Date(h.offered_at).toLocaleString('pt-BR')}
                      </td>
                      <td>{h.user_id || h.telegram_chat_id || '-'}</td>
                      <td>{h.discount_percent}%</td>
                      <td className={stillBlocked ? 'text-yellow-400' : 'text-zinc-500'}>
                        {blockedUntil
                          ? blockedUntil.toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td>
                        {h.converted ? (
                          <span className="text-green-400">Convertido</span>
                        ) : (
                          <span className="text-zinc-400">Pendente</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, color = 'text-white' }: { title: string; value: any; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-xs text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
