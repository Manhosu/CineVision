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
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserHit[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserHit | null>(null);

  const [contentQuery, setContentQuery] = useState('');
  const [contentResults, setContentResults] = useState<ContentHit[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentHit | null>(null);

  const [granting, setGranting] = useState(false);

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
        const data = await api.get<any>(`/api/v1/content/movies?search=${encodeURIComponent(contentQuery)}&limit=10`);
        const hits: ContentHit[] = (data.items || data.data || []).map((m: any) => ({
          id: m.id,
          title: m.title,
          type: m.content_type || m.type,
          poster_url: m.poster_url,
        }));
        setContentResults(hits);
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

  return (
    <div className="mx-auto max-w-3xl p-6 text-white">
      <AdminBackButton />
      <h1 className="mb-6 text-3xl font-bold">Liberar conteúdo manualmente</h1>

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

      <button
        onClick={grant}
        disabled={granting || !selectedUser || !selectedContent}
        className="w-full rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-60"
      >
        {granting ? 'Liberando...' : 'Liberar acesso'}
      </button>
    </div>
  );
}
