'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import AdminBackButton from '@/components/Admin/AdminBackButton';

type Status = 'pending' | 'approved' | 'rejected';

interface EditRequest {
  id: string;
  content_id: string;
  employee_id: string;
  changes: Record<string, any>;
  original_snapshot: Record<string, any>;
  status: Status;
  created_at: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  employee?: { id: string; name: string; email: string };
  content?: { id: string; title: string; content_type?: string; poster_url?: string };
  reviewer?: { id: string; name: string };
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

const formatValue = (v: any): string => {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
};

export default function EditRequestsPage() {
  const [tab, setTab] = useState<Status>('pending');
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EditRequest | null>(null);
  const [notes, setNotes] = useState('');
  const [working, setWorking] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get<EditRequest[]>(
        `/api/v1/admin/content-edit-requests?status=${tab}`,
      );
      setRequests(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  const approve = async () => {
    if (!selected) return;
    try {
      setWorking(true);
      await api.post(`/api/v1/admin/content-edit-requests/${selected.id}/approve`, {
        notes: notes || undefined,
      });
      toast.success('Edição aprovada e aplicada!');
      setSelected(null);
      setNotes('');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const reject = async () => {
    if (!selected) return;
    try {
      setWorking(true);
      await api.post(`/api/v1/admin/content-edit-requests/${selected.id}/reject`, {
        notes: notes || undefined,
      });
      toast.success('Edição rejeitada.');
      setSelected(null);
      setNotes('');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 text-white">
      <AdminBackButton />
      <h1 className="mb-6 text-3xl font-bold">Edições pendentes de aprovação</h1>

      <div className="mb-4 flex gap-2 border-b border-white/10">
        {(['pending', 'approved', 'rejected'] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setTab(s);
              setSelected(null);
            }}
            className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
              tab === s
                ? 'border-red-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            {s === 'pending' && 'Pendentes'}
            {s === 'approved' && 'Aprovadas'}
            {s === 'rejected' && 'Rejeitadas'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-2">
          {loading && (
            <div className="rounded-xl border border-white/10 bg-zinc-900 p-4 text-zinc-400">
              Carregando...
            </div>
          )}
          {!loading && requests.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-zinc-900 p-4 text-zinc-400">
              Nenhum pedido nesta aba.
            </div>
          )}
          {requests.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setSelected(r);
                setNotes('');
              }}
              className={`w-full rounded-xl border p-3 text-left transition ${
                selected?.id === r.id
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-white/10 bg-zinc-900 hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-3">
                {r.content?.poster_url && (
                  <img
                    src={r.content.poster_url}
                    alt=""
                    className="h-12 w-8 flex-shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {r.content?.title || r.content_id}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {r.employee?.name || r.employee_id}
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">
                    {fmtDate(r.created_at)} · {Object.keys(r.changes).length} campo(s)
                  </div>
                </div>
              </div>
            </button>
          ))}
        </aside>

        <section className="rounded-xl border border-white/10 bg-zinc-900 p-5">
          {!selected ? (
            <p className="py-12 text-center text-zinc-500">
              Selecione um pedido para revisar
            </p>
          ) : (
            <>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{selected.content?.title}</h2>
                  <p className="text-sm text-zinc-400">
                    Proposta por <strong>{selected.employee?.name}</strong> ·{' '}
                    {fmtDate(selected.created_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selected.status === 'pending'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : selected.status === 'approved'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {selected.status === 'pending' && 'Pendente'}
                  {selected.status === 'approved' && 'Aprovada'}
                  {selected.status === 'rejected' && 'Rejeitada'}
                </span>
              </div>

              <h3 className="mb-2 text-sm font-semibold text-zinc-300">Diff</h3>
              <div className="mb-5 space-y-3 rounded-lg border border-white/10 bg-zinc-950 p-3 max-h-[50vh] overflow-y-auto">
                {Object.keys(selected.changes).map((field) => {
                  const before = selected.original_snapshot?.[field];
                  const after = selected.changes[field];
                  return (
                    <div key={field} className="rounded border border-white/5 p-3">
                      <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                        {field}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <div className="text-[10px] text-zinc-500">Antes</div>
                          <pre className="whitespace-pre-wrap break-words rounded bg-red-500/10 p-2 text-xs text-red-300">
                            {formatValue(before)}
                          </pre>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500">Depois</div>
                          <pre className="whitespace-pre-wrap break-words rounded bg-green-500/10 p-2 text-xs text-green-300">
                            {formatValue(after)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selected.status === 'pending' ? (
                <>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Nota interna (opcional, vai ficar registrada)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Ex: ajustei a descrição porque tinha typo"
                    className="mb-3 w-full rounded-lg border border-white/10 bg-zinc-950 p-2 text-sm"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={approve}
                      disabled={working}
                      className="rounded-lg bg-green-600 px-5 py-2 font-semibold hover:bg-green-700 disabled:opacity-60"
                    >
                      {working ? 'Aplicando...' : '✅ Aprovar e aplicar'}
                    </button>
                    <button
                      onClick={reject}
                      disabled={working}
                      className="rounded-lg bg-red-600 px-5 py-2 font-semibold hover:bg-red-700 disabled:opacity-60"
                    >
                      {working ? 'Processando...' : '❌ Rejeitar'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm">
                  {selected.reviewer && (
                    <div>
                      Revisado por <strong>{selected.reviewer.name}</strong> ·{' '}
                      {fmtDate(selected.reviewed_at)}
                    </div>
                  )}
                  {selected.reviewer_notes && (
                    <div className="mt-2 text-zinc-400">
                      Notas: {selected.reviewer_notes}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
