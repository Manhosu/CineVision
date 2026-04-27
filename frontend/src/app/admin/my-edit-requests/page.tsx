'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';

interface EditRequest {
  id: string;
  changes: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  content?: { id: string; title: string; poster_url?: string };
}

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

export default function MyEditRequestsPage() {
  const [items, setItems] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<EditRequest[]>('/api/v1/admin/content-edit-requests/me/list')
      .then((d) => setItems(d || []))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6 text-white">
      <h1 className="mb-2 text-3xl font-bold">Minhas edições enviadas</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Edições feitas após a janela de tempo permitida ficam aqui aguardando aprovação do
        administrador.
      </p>

      {loading ? (
        <p className="text-zinc-400">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900 p-8 text-center text-zinc-400">
          Você ainda não tem edições aguardando aprovação.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/10 bg-zinc-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {r.content?.poster_url && (
                    <img
                      src={r.content.poster_url}
                      alt=""
                      className="h-16 w-12 rounded object-cover"
                    />
                  )}
                  <div>
                    <div className="font-semibold">{r.content?.title}</div>
                    <div className="text-xs text-zinc-500">
                      Enviado em {fmt(r.created_at)} · {Object.keys(r.changes).length}{' '}
                      campo(s)
                    </div>
                    {r.reviewed_at && (
                      <div className="text-xs text-zinc-500">
                        Revisado em {fmt(r.reviewed_at)}
                      </div>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    r.status === 'pending'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : r.status === 'approved'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {r.status === 'pending' && '⏳ Pendente'}
                  {r.status === 'approved' && '✅ Aprovada'}
                  {r.status === 'rejected' && '❌ Rejeitada'}
                </span>
              </div>
              {r.reviewer_notes && (
                <div className="mt-3 rounded border border-white/5 bg-zinc-950 p-2 text-xs text-zinc-400">
                  <strong>Nota do admin:</strong> {r.reviewer_notes}
                </div>
              )}
              <div className="mt-3 text-xs text-zinc-500">
                Campos: {Object.keys(r.changes).join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
