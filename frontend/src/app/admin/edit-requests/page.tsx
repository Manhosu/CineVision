'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import AdminBackButton from '@/components/Admin/AdminBackButton';

type Status = 'pending' | 'approved' | 'rejected';

type RequestType = 'update' | 'delete' | 'photo_replace';

interface EditRequest {
  id: string;
  content_id: string | null;
  person_id?: string | null;
  employee_id: string;
  changes: Record<string, any>;
  original_snapshot: Record<string, any>;
  status: Status;
  request_type?: RequestType;
  created_at: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  employee?: { id: string; name: string; email: string };
  content?: { id: string; title: string; content_type?: string; poster_url?: string };
  person?: { id: string; name: string; role?: string; photo_url?: string };
  reviewer?: { id: string; name: string };
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

// N25 (Igor 08/05): foto nova nao carregava no painel quando URL e
// invalida (404, hotlink bloqueado, etc). Componente robusto com
// fallback visual + URL exposta pra debug.
function PhotoPreview({ label, url, ringColor }: { label: string; url?: string | null; ringColor: string }) {
  const [errored, setErrored] = useState(false);
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      {url && !errored ? (
        <img
          src={url}
          alt={label}
          className={`aspect-square w-full rounded-lg object-cover ring-1 ${ringColor}`}
          onError={() => setErrored(true)}
        />
      ) : (
        <div className={`aspect-square w-full rounded-lg bg-zinc-800 flex flex-col items-center justify-center text-xs text-zinc-400 p-3 text-center gap-1 ring-1 ${ringColor}`}>
          {!url && <span>sem foto</span>}
          {url && errored && (
            <>
              <span className="text-amber-300">⚠ falha ao carregar</span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-[10px] text-blue-400 underline"
              >
                {url.length > 80 ? url.slice(0, 80) + '...' : url}
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const formatValue = (v: any): string => {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
};

// N2 — detecta se um valor é um link/ID do Telegram que vale a pena
// expor com botão "Abrir grupo" antes do admin aprovar.
const isTelegramRef = (v: any): boolean => {
  if (typeof v !== 'string' || !v.trim()) return false;
  const s = v.trim();
  // URL t.me em qualquer formato
  if (/^https?:\/\/t\.me\//i.test(s)) return true;
  // @username
  if (/^@[a-zA-Z0-9_]{4,}$/.test(s)) return true;
  // Chat ID numérico (-100XXX...)
  if (/^-?\d{6,}$/.test(s)) return true;
  return false;
};

const telegramHref = (v: string): string => {
  const s = v.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('@')) return `https://t.me/${s.slice(1)}`;
  if (/^-?\d+$/.test(s)) {
    // Chat ID puro não dá pra abrir direto pelo browser; abre busca
    // generic do app web do Telegram pra Igor copiar/conferir.
    return `https://web.telegram.org/`;
  }
  return s;
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
                {r.request_type === 'photo_replace' ? (
                  r.person?.photo_url ? (
                    <img
                      src={r.person.photo_url}
                      alt=""
                      className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 flex-shrink-0 rounded-full bg-zinc-800" />
                  )
                ) : (
                  r.content?.poster_url && (
                    <img
                      src={r.content.poster_url}
                      alt=""
                      className="h-12 w-8 flex-shrink-0 rounded object-cover"
                    />
                  )
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {r.request_type === 'photo_replace'
                        ? r.person?.name || r.original_snapshot?.name || r.person_id
                        : r.content?.title || r.content_id}
                    </span>
                    {r.request_type === 'delete' && (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                        EXCLUIR
                      </span>
                    )}
                    {r.request_type === 'photo_replace' && (
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                        FOTO
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {r.employee?.name || r.employee_id}
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">
                    {fmtDate(r.created_at)} ·{' '}
                    {r.request_type === 'delete'
                      ? 'pedido de exclusão'
                      : r.request_type === 'photo_replace'
                      ? 'troca de foto'
                      : `${Object.keys(r.changes).length} campo(s)`}
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
                  <h2 className="text-xl font-bold">
                    {selected.request_type === 'photo_replace'
                      ? (selected.person?.name || selected.original_snapshot?.name || selected.person_id)
                      : selected.content?.title}
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {selected.request_type === 'photo_replace' && (selected.person?.role || selected.original_snapshot?.role) && (
                      <span className="mr-2 text-zinc-500">{selected.person?.role || selected.original_snapshot?.role}</span>
                    )}
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

              {selected.request_type === 'delete' && (
                <div className="mb-5 rounded-lg border border-red-500/40 bg-red-600/10 p-4 text-sm text-red-200">
                  <strong>⚠ Pedido de exclusão</strong> — ao aprovar, o conteúdo
                  <em> "{selected.content?.title}" </em>
                  será removido permanentemente da plataforma. Esta ação não
                  pode ser desfeita.
                </div>
              )}

              {selected.request_type === 'photo_replace' && (
                <div className="mb-5 rounded-lg border border-purple-500/40 bg-purple-600/10 p-4 text-sm text-purple-200">
                  <strong>📷 Troca de foto</strong> — funcionário quer substituir a
                  foto atual de <em>{selected.person?.name || selected.original_snapshot?.name}</em>. Aprovação aplica
                  a nova foto direto na pessoa.
                </div>
              )}

              {selected.request_type === 'photo_replace' && (
                <div className="mb-5 grid gap-3 md:grid-cols-2">
                  <PhotoPreview
                    label="Foto atual"
                    url={selected.original_snapshot?.photo_url}
                    ringColor="ring-red-500/40"
                  />
                  <PhotoPreview
                    label="Nova foto proposta"
                    url={selected.changes?.photo_url}
                    ringColor="ring-green-500/40"
                  />
                </div>
              )}

              {selected.request_type !== 'photo_replace' && (
                <h3 className="mb-2 text-sm font-semibold text-zinc-300">
                  {selected.request_type === 'delete' ? 'Resumo' : 'Diff'}
                </h3>
              )}
              {selected.request_type !== 'photo_replace' && (
              <div className="mb-5 space-y-3 rounded-lg border border-white/10 bg-zinc-950 p-3 max-h-[50vh] overflow-y-auto">
                {Object.keys(selected.changes).map((field) => {
                  const before = selected.original_snapshot?.[field];
                  const after = selected.changes[field];
                  const isTelegramField =
                    field === 'telegram_group_link' ||
                    isTelegramRef(after) ||
                    isTelegramRef(before);
                  return (
                    <div key={field} className="rounded border border-white/5 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500">
                        <span>{field}</span>
                        {/* N2 — botão pra abrir o grupo Telegram antes
                            de aprovar. Igor pediu pra super-visionar
                            o que o funcionário pôs antes de validar. */}
                        {isTelegramField && isTelegramRef(after) && /^https?:\/\//i.test(String(after)) && (
                          <a
                            href={telegramHref(String(after))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded bg-blue-600/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300 hover:bg-blue-600/30"
                          >
                            🔗 Abrir grupo
                          </a>
                        )}
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
              )}

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
