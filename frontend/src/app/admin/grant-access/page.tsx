'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import AdminBackButton from '@/components/Admin/AdminBackButton';

interface UserHit {
  id: string;
  name: string;
  email?: string;
  telegram_id?: string;
  telegram_username?: string;
}

interface ContentHit {
  id: string;
  title: string;
  type?: string;
  poster_url?: string;
}

export default function GrantAccessPage() {
  const [tab, setTab] = useState<'user' | 'pix_manual'>('user');

  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserHit[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserHit | null>(null);

  const [contentQuery, setContentQuery] = useState('');
  const [contentResults, setContentResults] = useState<ContentHit[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentHit | null>(null);

  const [granting, setGranting] = useState(false);

  // Igor (25/06): aba "PIX manual" — gera link rotativo single-use sem
  // precisar de usuário cadastrado. Cliente paga PIX manual, manda
  // comprovante por WhatsApp, admin escolhe conteúdo e copia URL.
  const [pixManualResult, setPixManualResult] = useState<{
    access_url: string;
    whatsapp_message: string;
    purchase_id: string;
  } | null>(null);

  useEffect(() => {
    if (!userQuery) {
      setUserResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await api.get<UserHit[]>(`/api/v1/admin/grant-access/user-search?q=${encodeURIComponent(userQuery)}`);
        setUserResults(data);
      } catch {
        /* no-op */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [userQuery]);

  useEffect(() => {
    if (!contentQuery) {
      setContentResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        // Backend retorna { movies: [...], pagination: {...} } — não
        // { items } nem { data }. O bug de "Demon Slayer não aparece"
        // que o Igor reportou era esse projection errado. Também
        // buscamos em séries em paralelo (sagas/séries não apareciam
        // mesmo no antes-do-fix).
        const [moviesRes, seriesRes] = await Promise.all([
          api.get<any>(`/api/v1/content/movies?search=${encodeURIComponent(contentQuery)}&limit=10`),
          api.get<any>(`/api/v1/content/series?search=${encodeURIComponent(contentQuery)}&limit=10`),
        ]);
        const moviesList = moviesRes?.movies || [];
        const seriesList = seriesRes?.movies || [];
        const hits: ContentHit[] = [...moviesList, ...seriesList].map((m: any) => ({
          id: m.id,
          title: m.title,
          type: m.content_type || m.type,
          poster_url: m.poster_url,
        }));
        setContentResults(hits.slice(0, 20));
      } catch {
        /* no-op */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [contentQuery]);

  const grant = async () => {
    if (!selectedUser || !selectedContent) {
      toast.error('Selecione usuário e conteúdo');
      return;
    }
    try {
      setGranting(true);
      const result = await api.post<any>('/api/v1/admin/grant-access', {
        user_identifier: selectedUser.id,
        content_id: selectedContent.id,
      });
      if (result.already_owned) {
        toast('Usuário já possuía esse conteúdo', { icon: 'ℹ️' });
      } else {
        toast.success('Acesso liberado!');
      }
      setSelectedUser(null);
      setSelectedContent(null);
      setUserQuery('');
      setContentQuery('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGranting(false);
    }
  };

  const generatePixManualLink = async () => {
    if (!selectedContent) {
      toast.error('Selecione um conteúdo');
      return;
    }
    try {
      setGranting(true);
      setPixManualResult(null);
      const result = await api.post<any>('/api/v1/admin/grant-access/manual-pix-link', {
        content_id: selectedContent.id,
      });
      setPixManualResult({
        access_url: result.access_url,
        whatsapp_message: result.whatsapp_message,
        purchase_id: result.purchase_id,
      });
      toast.success('Link gerado!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGranting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="mx-auto max-w-3xl p-6 text-white">
      <AdminBackButton />
      <h1 className="mb-2 text-3xl font-bold">Liberar conteúdo manualmente</h1>

      <div className="mb-6 inline-flex rounded-xl border border-white/10 bg-zinc-900 p-1">
        <button
          onClick={() => { setTab('user'); setPixManualResult(null); }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'user' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Liberar pra usuário cadastrado
        </button>
        <button
          onClick={() => { setTab('pix_manual'); setSelectedUser(null); setUserQuery(''); }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'pix_manual' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          PIX manual (link rotativo)
        </button>
      </div>

      {tab === 'pix_manual' && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          Use quando cliente pagou PIX manual (chave direta) e mandou comprovante no WhatsApp.
          Selecione o conteúdo, gere o link, e cole pra ele. Ele clica → cai num dos bots
          ativos sorteado → bot reconhece a compra e entrega o filme.
        </div>
      )}

      {tab === 'user' && (
      <section className="mb-4 rounded-xl border border-white/10 bg-zinc-900 p-5">
        <label className="mb-1 block text-sm font-semibold">Usuário</label>
        <input
          placeholder="Buscar por nome, email, telegram..."
          value={userQuery}
          onChange={(e) => {
            setUserQuery(e.target.value);
            setSelectedUser(null);
          }}
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
        />
        {userResults.length > 0 && !selectedUser && (
          <div className="mt-2 divide-y divide-white/5 rounded-lg border border-white/10 bg-zinc-950">
            {userResults.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setSelectedUser(u);
                  setUserQuery(u.name);
                }}
                className="w-full p-3 text-left hover:bg-white/5"
              >
                <div className="font-semibold">{u.name}</div>
                <div className="text-xs text-zinc-500">
                  {u.email} {u.telegram_username ? `· @${u.telegram_username}` : ''}{' '}
                  {u.telegram_id ? `· TG:${u.telegram_id}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
        {selectedUser && (
          <div className="mt-2 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm">
            ✅ <strong>{selectedUser.name}</strong> — {selectedUser.email}
          </div>
        )}
      </section>
      )}

      <section className="mb-4 rounded-xl border border-white/10 bg-zinc-900 p-5">
        <label className="mb-1 block text-sm font-semibold">Conteúdo</label>
        <input
          placeholder="Buscar filme/série..."
          value={contentQuery}
          onChange={(e) => {
            setContentQuery(e.target.value);
            setSelectedContent(null);
          }}
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
        />
        {contentResults.length > 0 && !selectedContent && (
          <div className="mt-2 divide-y divide-white/5 rounded-lg border border-white/10 bg-zinc-950">
            {contentResults.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedContent(c);
                  setContentQuery(c.title);
                }}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/5"
              >
                {c.poster_url && <img src={c.poster_url} alt="" className="h-10 w-7 rounded object-cover" />}
                <div>
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-zinc-500">{c.type || 'filme'}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {selectedContent && (
          <div className="mt-2 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm">
            ✅ <strong>{selectedContent.title}</strong>
          </div>
        )}
      </section>

      {tab === 'user' ? (
        <button
          onClick={grant}
          disabled={granting || !selectedUser || !selectedContent}
          className="w-full rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-60"
        >
          {granting ? 'Liberando...' : 'Liberar acesso'}
        </button>
      ) : (
        <button
          onClick={generatePixManualLink}
          disabled={granting || !selectedContent}
          className="w-full rounded-xl bg-amber-600 py-3 font-bold text-white disabled:opacity-60"
        >
          {granting ? 'Gerando...' : 'Gerar link rotativo'}
        </button>
      )}

      {pixManualResult && (
        <section className="mt-6 rounded-xl border border-green-500/30 bg-green-500/5 p-5">
          <h2 className="mb-3 text-lg font-bold text-green-300">Link gerado</h2>
          <div className="mb-4">
            <label className="mb-1 block text-xs uppercase text-zinc-400">Link de acesso (single-use, rotativo)</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={pixManualResult.access_url}
                className="flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => copyToClipboard(pixManualResult.access_url, 'Link')}
                className="rounded-lg bg-green-600 px-4 text-sm font-semibold hover:bg-green-700"
              >
                Copiar link
              </button>
            </div>
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-xs uppercase text-zinc-400">Mensagem pronta pro WhatsApp</label>
            <textarea
              readOnly
              value={pixManualResult.whatsapp_message}
              rows={5}
              className="w-full rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button
              onClick={() => copyToClipboard(pixManualResult.whatsapp_message, 'Mensagem')}
              className="mt-2 w-full rounded-lg bg-green-600 py-2 text-sm font-semibold hover:bg-green-700"
            >
              Copiar mensagem
            </button>
          </div>
          <p className="text-xs text-zinc-400">
            Purchase ID: <code>{pixManualResult.purchase_id}</code>. Cliente clica no link → cai num bot ativo
            sorteado → bot reconhece a compra → entrega o filme. Link single-use por chat (anti-cross-claim).
          </p>
        </section>
      )}
    </div>
  );
}
