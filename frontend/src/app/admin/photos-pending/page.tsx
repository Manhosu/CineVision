'use client';

// IMG_8846 — Página admin para aprovar/rejeitar fotos enviadas por
// funcionários com permissão `can_add_people_photos`. Workflow espelha
// content_edit_requests: foto fica em `photo_pending_url` até admin
// validar.

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import AdminBackButton from '@/components/Admin/AdminBackButton';

interface PendingPhoto {
  id: string;
  name: string;
  role: string;
  photo_pending_url: string;
  photo_pending_at: string;
  photo_pending_by_user_id: string | null;
  submitted_by: { id: string; name: string; email: string } | null;
}

interface PhotoStats {
  pending: number;
  missing: number;
  rejected_last_7d: number;
  employees_with_perm: { id: string; name: string; email: string; status: string }[];
}

export default function PhotosPendingPage() {
  const [items, setItems] = useState<PendingPhoto[]>([]);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Igor (07/05): seleção em batch pra aprovar várias de uma vez.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchApproving, setBatchApproving] = useState(false);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const approveBatch = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Aprovar ${selectedIds.size} foto(s) selecionada(s)?`)) return;
    setBatchApproving(true);
    try {
      const result = await api.post<{
        approved_count: number;
        failed_count: number;
        failed: Array<{ id: string; error: string }>;
      }>('/api/v1/admin/people/photos/approve-batch', {
        person_ids: Array.from(selectedIds),
      });
      if (result.failed_count > 0) {
        toast.error(
          `${result.approved_count} aprovada(s), ${result.failed_count} falharam.`,
          { duration: 6000 },
        );
      } else {
        toast.success(`${result.approved_count} foto(s) aprovada(s)!`);
      }
      clearSelection();
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao aprovar em batch');
    } finally {
      setBatchApproving(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      // Carrega pending + stats em paralelo. Stats é informativo —
      // ajuda admin a entender se "vazio" é legítimo (ninguém submeteu)
      // ou se ninguém tem permissão pra submeter.
      const [data, statsData] = await Promise.all([
        api.get<PendingPhoto[]>('/api/v1/admin/people/photos/pending'),
        api.get<PhotoStats>('/api/v1/admin/people/photos/stats').catch(() => null),
      ]);
      setItems(data);
      setStats(statsData);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao carregar pendentes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id: string) => {
    try {
      setBusyId(id);
      await api.post(`/api/v1/admin/people/${id}/photo/approve`, {});
      toast.success('Foto aprovada');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt('Motivo da rejeição (opcional):') ?? undefined;
    try {
      setBusyId(id);
      await api.post(`/api/v1/admin/people/${id}/photo/reject`, { reason });
      toast.success('Foto rejeitada');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 text-white">
      <AdminBackButton />
      <h1 className="mb-2 text-3xl font-bold">Fotos pendentes de aprovação</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Funcionários com permissão <code className="rounded bg-zinc-800 px-1">can_add_people_photos</code>{' '}
        podem submeter fotos para pessoas sem foto. Aqui você aprova ou rejeita.
      </p>

      {/* Stats banner — ajuda admin a entender o estado do workflow */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-600/5 p-3">
            <div className="text-2xl font-bold text-amber-300">{stats.pending}</div>
            <div className="text-xs text-zinc-400">pendentes agora</div>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
            <div className="text-2xl font-bold text-zinc-300">{stats.missing}</div>
            <div className="text-xs text-zinc-500">pessoas sem foto</div>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
            <div className="text-2xl font-bold text-zinc-300">{stats.rejected_last_7d}</div>
            <div className="text-xs text-zinc-500">rejeitadas (7d)</div>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
            <div className="text-2xl font-bold text-zinc-300">{stats.employees_with_perm.length}</div>
            <div className="text-xs text-zinc-500">funcionários c/ permissão</div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900 p-8 text-center">
          <p className="mb-3 text-zinc-300">Nenhuma foto pendente no momento.</p>
          {stats && stats.employees_with_perm.length === 0 ? (
            <p className="text-xs text-amber-400">
              ⚠️ Nenhum funcionário tem a permissão <code className="rounded bg-zinc-800 px-1">can_add_people_photos</code>.
              Habilite em <a href="/admin/employees" className="text-amber-300 underline">Funcionários</a> pra alguém poder enviar fotos.
            </p>
          ) : stats && stats.missing === 0 ? (
            <p className="text-xs text-emerald-400">
              ✅ Todas as {stats ? '739+' : ''} pessoas do catálogo já têm foto. Não há nada a aprovar.
            </p>
          ) : (
            <div className="space-y-1 text-xs text-zinc-500">
              <p>
                Existem <strong className="text-zinc-300">{stats?.missing}</strong> pessoas sem foto no catálogo. Os{' '}
                <strong className="text-zinc-300">{stats?.employees_with_perm.length}</strong> funcionário(s) com
                permissão ({stats?.employees_with_perm.map((e) => e.name).join(', ')}) podem enviar fotos pelo painel{' '}
                <a href="/employee/photos" className="text-zinc-300 underline">Pessoas sem foto</a>.
              </p>
              <p>
                Quando alguém submeter uma foto, ela aparece aqui pra aprovação.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Igor (07/05): barra de batch — marca várias fotos via
              checkbox e aprova todas de uma vez. Acelera supervisão
              quando tem muitos cards pra revisar (ele verifica cada
              grupo em segundo monitor antes de marcar). */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3">
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <span>
                <strong className="text-white">{selectedIds.size}</strong> de{' '}
                <strong className="text-white">{items.length}</strong> selecionadas
              </span>
              <button
                onClick={selectAll}
                disabled={selectedIds.size === items.length}
                className="rounded border border-white/10 px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-40"
              >
                Marcar todas
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={clearSelection}
                  className="rounded border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
                >
                  Limpar seleção
                </button>
              )}
            </div>
            <button
              onClick={approveBatch}
              disabled={selectedIds.size === 0 || batchApproving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900 disabled:text-zinc-500"
            >
              {batchApproving
                ? 'Aprovando…'
                : `Aprovar ${selectedIds.size > 0 ? `${selectedIds.size} ` : ''}selecionada${selectedIds.size === 1 ? '' : 's'}`}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => {
              const checked = selectedIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`overflow-hidden rounded-xl border bg-zinc-900 transition ${
                    checked ? 'border-emerald-500/60 ring-2 ring-emerald-500/30' : 'border-amber-500/30'
                  }`}
                >
                  <div className="relative aspect-square bg-zinc-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.photo_pending_url}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                    <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelected(p.id)}
                        className="h-4 w-4 rounded border-white/30 bg-transparent accent-emerald-500"
                      />
                      <span>Selecionar</span>
                    </label>
                    <span className="absolute right-2 top-2 rounded-full bg-amber-600/90 px-2 py-0.5 text-xs font-semibold">
                      Pendente
                    </span>
                  </div>
                  <div className="space-y-1 p-3">
                    <div className="font-semibold text-white">{p.name}</div>
                    <div className="text-xs text-zinc-500">
                      {p.role === 'director' ? 'Diretor' : 'Ator'}
                    </div>
                    <div className="pt-2 text-xs text-zinc-400">
                      Por: {p.submitted_by?.name || p.submitted_by?.email || '—'}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(p.photo_pending_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex gap-2 border-t border-white/10 p-3">
                    <button
                      onClick={() => approve(p.id)}
                      disabled={busyId === p.id}
                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold transition hover:bg-emerald-500 disabled:opacity-60"
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => reject(p.id)}
                      disabled={busyId === p.id}
                      className="flex-1 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-600/10 disabled:opacity-60"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
