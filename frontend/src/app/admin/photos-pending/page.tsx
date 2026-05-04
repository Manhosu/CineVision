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

export default function PhotosPendingPage() {
  const [items, setItems] = useState<PendingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get<PendingPhoto[]>('/api/v1/admin/people/photos/pending');
      setItems(data);
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

      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900 p-8 text-center text-zinc-500">
          Nenhuma foto pendente no momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-xl border border-amber-500/30 bg-zinc-900"
            >
              <div className="relative aspect-square bg-zinc-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.photo_pending_url}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
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
          ))}
        </div>
      )}
    </div>
  );
}
