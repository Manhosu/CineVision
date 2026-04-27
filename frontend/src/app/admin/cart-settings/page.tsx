'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';

interface Tier {
  min_items: number;
  percent: number;
}

export default function CartSettingsPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ tiers: Tier[] }>('/api/v1/admin/cart/discount-tiers');
      setTiers(data.tiers || []);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar faixas');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const clean = tiers
        .map((t) => ({
          min_items: Math.max(1, Math.floor(Number(t.min_items))),
          percent: Math.max(0, Math.min(100, Number(t.percent))),
        }))
        .filter((t) => !Number.isNaN(t.min_items) && !Number.isNaN(t.percent));
      await api.put('/api/v1/admin/cart/discount-tiers', { tiers: clean });
      toast.success('Faixas salvas!');
      await loadTiers();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const addTier = () =>
    setTiers((prev) => [...prev, { min_items: 1, percent: 5 }]);

  const removeTier = (idx: number) =>
    setTiers((prev) => prev.filter((_, i) => i !== idx));

  const updateTier = (idx: number, key: keyof Tier, value: number) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [key]: value } : t)));
  };

  if (loading) return <div className="p-8 text-white">Carregando...</div>;

  return (
    <div className="mx-auto max-w-2xl p-6 text-white">
      <h1 className="mb-2 text-3xl font-bold">Desconto progressivo do carrinho</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Configure as faixas de desconto aplicadas automaticamente conforme o cliente adiciona
        itens ao carrinho. Exemplo: 3 itens = 10%, 5 itens = 25%.
      </p>

      <div className="space-y-3">
        {tiers.map((t, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900 p-3"
          >
            <div className="flex-1">
              <label className="text-xs text-zinc-400">Mínimo de itens</label>
              <input
                type="number"
                min={1}
                value={t.min_items}
                onChange={(e) => updateTier(idx, 'min_items', Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-400">Desconto (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={t.percent}
                onChange={(e) => updateTier(idx, 'percent', Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
              />
            </div>
            <button
              onClick={() => removeTier(idx)}
              className="self-end rounded-lg bg-red-600/20 px-3 py-2 text-sm text-red-400 hover:bg-red-600/30"
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={addTier}
          className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 hover:bg-zinc-800"
        >
          + Nova faixa
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-red-600 px-5 py-2 font-semibold hover:bg-red-700 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
