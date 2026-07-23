'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PresaleItem {
  id: string;
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  price_cents: number;
  presale_price_cents: number | null;
  presale_release_at: string | null;
  days_until_release: number | null;
  paid_count: number;
  pending_count: number;
  revenue_cents: number;
  conversion_pct: number;
  cached_count: number;
}

interface DashboardResponse {
  items: PresaleItem[];
  totals: { titles: number; paid: number; pending: number; revenueCents: number };
  generatedAt: string;
}

function getHeaders() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PresaleDashboardPage() {
  // Igor (22/07 fix): antes checava user.role !== 'ADMIN'/'MODERATOR' maiúsculo,
  // mas o useAuth do projeto retorna role em minúsculo ('admin', 'moderator').
  // Isso derrubava até o admin master pra /login. Padrão das outras páginas
  // admin (bots, broadcast) é confiar no Bearer token: só usa isLoading pra
  // esperar a hidratação e deixa o backend validar via token nos requests.
  const { isLoading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/admin/content/presale/dashboard`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        toast.error(`Erro ao carregar dashboard: ${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    fetchDashboard();
  }, [authLoading, fetchDashboard]);

  const handleRelease = async (item: PresaleItem) => {
    if (!confirm(
      `Liberar "${item.title}" agora?\n\n` +
      `${item.paid_count} cliente(s) pago(s) vão receber notificação automática no Telegram. ` +
      `O filme sai do modo pré-venda.\n\nSem volta.`
    )) return;

    try {
      setReleasingId(item.id);
      const res = await fetch(
        `${API_URL}/api/v1/admin/content/${item.id}/release-presale`,
        { method: 'POST', headers: getHeaders() },
      );
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(
          `"${item.title}" liberado! ${result.notified || 0} cliente(s) notificado(s).`,
          { duration: 6000 },
        );
        await fetchDashboard();
      } else {
        toast.error(result?.message || `Erro ao liberar: ${res.status}`);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setReleasingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-dark-900 text-white p-8">
        <p>Falha ao carregar dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">🎟 Pré-vendas</h1>
            <p className="text-sm text-gray-400 mt-1">
              {data.totals.titles} título{data.totals.titles === 1 ? '' : 's'} em pré-venda.
              Última atualização: {new Date(data.generatedAt).toLocaleTimeString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboard}
              className="px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              🔄 Atualizar
            </button>
            <a
              href="/admin/content/manage"
              className="px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              ← Todos os filmes
            </a>
          </div>
        </div>

        {/* Cards agregados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-dark-800 rounded-lg p-4 border border-white/10">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Títulos</div>
            <div className="text-2xl font-bold text-white mt-1">{data.totals.titles}</div>
          </div>
          <div className="bg-emerald-500/5 rounded-lg p-4 border border-emerald-500/20">
            <div className="text-xs text-emerald-400 uppercase tracking-wide">Pagas</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{data.totals.paid}</div>
          </div>
          <div className="bg-amber-500/5 rounded-lg p-4 border border-amber-500/20">
            <div className="text-xs text-amber-400 uppercase tracking-wide">Pendentes</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{data.totals.pending}</div>
          </div>
          <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/20">
            <div className="text-xs text-blue-400 uppercase tracking-wide">Faturamento</div>
            <div className="text-xl font-bold text-blue-400 mt-1">{fmtBRL(data.totals.revenueCents)}</div>
          </div>
        </div>

        {data.items.length === 0 ? (
          <div className="bg-dark-800 rounded-xl p-12 text-center border border-white/5">
            <div className="text-4xl mb-3">🎬</div>
            <p className="text-gray-400">Nenhum filme em pré-venda no momento.</p>
            <p className="text-xs text-gray-600 mt-2">Ative o modo pré-venda em qualquer filme para vê-lo aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="bg-dark-800 rounded-xl p-4 border border-white/10 flex gap-4 items-center flex-wrap sm:flex-nowrap"
              >
                {item.poster_url && (
                  <img
                    src={item.poster_url}
                    alt={item.title}
                    className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-white truncate">{item.title}</h2>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        <span>💰 {fmtBRL(item.presale_price_cents || item.price_cents)}</span>
                        <span className="text-gray-600">·</span>
                        <span>de <span className="line-through">{fmtBRL(item.price_cents)}</span></span>
                        {item.presale_release_at && (
                          <>
                            <span className="text-gray-600">·</span>
                            <span>
                              🗓 {new Date(item.presale_release_at).toLocaleDateString('pt-BR')}
                              {item.days_until_release !== null && item.days_until_release >= 0
                                ? ` (${item.days_until_release}d)`
                                : ' (atrasado)'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    <div className="bg-emerald-500/10 rounded p-2 border border-emerald-500/20 text-center">
                      <div className="text-xs text-emerald-400">Pagas</div>
                      <div className="text-lg font-bold text-emerald-400">{item.paid_count}</div>
                    </div>
                    <div className="bg-amber-500/10 rounded p-2 border border-amber-500/20 text-center">
                      <div className="text-xs text-amber-400">Pendentes</div>
                      <div className="text-lg font-bold text-amber-400">{item.pending_count}</div>
                    </div>
                    <div className="bg-blue-500/10 rounded p-2 border border-blue-500/20 text-center">
                      <div className="text-xs text-blue-400">Faturamento</div>
                      <div className="text-lg font-bold text-blue-400">{fmtBRL(item.revenue_cents)}</div>
                    </div>
                    <div className="bg-white/5 rounded p-2 border border-white/10 text-center">
                      <div className="text-xs text-gray-400">Conversão</div>
                      <div className="text-lg font-bold text-white">{item.conversion_pct}%</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => handleRelease(item)}
                    disabled={releasingId === item.id || item.paid_count === 0}
                    className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-semibold flex items-center gap-2 justify-center"
                    title={item.paid_count === 0
                      ? 'Nenhum cliente pago ainda — nada pra notificar'
                      : `Notifica ${item.paid_count} cliente(s) pago(s) no Telegram`}
                  >
                    {releasingId === item.id ? (
                      <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>🚀</>
                    )}
                    Liberar ({item.paid_count})
                  </button>
                  <a
                    href={`/admin/content/${item.id}/edit`}
                    className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 text-xs text-center transition-colors"
                  >
                    Editar
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
