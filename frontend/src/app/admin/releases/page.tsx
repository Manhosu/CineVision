'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  poster_url?: string;
  status: string;
  is_release?: boolean;
  is_new_season?: boolean;
}

type FilterTab = 'active' | 'all';

function getHeaders() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export default function ReleasesPage() {
  const router = useRouter();
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('active');
  // Igor (12/05): pills clicáveis pra filtrar por tipo de badge.
  const [typeFilter, setTypeFilter] = useState<'all' | 'release' | 'new_season'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchContents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/admin/content?limit=999`, {
        headers: getHeaders(),
      });
      if (res.status === 401) { router.push('/admin/login'); return; }
      if (!res.ok) throw new Error('Falha ao buscar conteúdo');
      const data = await res.json();
      setContents(data.contents || data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchContents(); }, [fetchContents]);

  const toggle = async (item: ContentItem, field: 'is_release' | 'is_new_season') => {
    setTogglingId(`${item.id}-${field}`);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/content/${item.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ [field]: !item[field] }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar');
      setContents(prev =>
        prev.map(c => c.id === item.id ? { ...c, [field]: !item[field] } : c)
      );
    } catch (err) {
      alert('Erro ao atualizar. Tente novamente.');
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = contents
    .filter(c => {
      if (tab === 'active') return c.is_release || c.is_new_season;
      return true;
    })
    .filter(c => {
      if (typeFilter === 'release') return c.is_release;
      if (typeFilter === 'new_season') return c.is_new_season;
      return true;
    })
    .filter(c => {
      if (!search.trim()) return true;
      return c.title.toLowerCase().includes(search.toLowerCase());
    });

  const activeCount = contents.filter(c => c.is_release || c.is_new_season).length;
  const novidades = contents.filter(c => c.is_release).length;
  const novaTemp = contents.filter(c => c.is_new_season).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar para Admin
          </button>

          <h1 className="text-3xl font-bold text-white mb-1">Novidades & Nova Temporada</h1>
          <p className="text-gray-400">Gerencie quais títulos exibem o badge nos cards</p>

          {/* Counters */}
          <div className="flex gap-4 mt-4">
            <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-2.5">
              <p className="text-xs text-red-400 font-medium uppercase tracking-wide">Novidade</p>
              <p className="text-2xl font-bold text-white">{novidades}</p>
            </div>
            <div className="bg-blue-500/15 border border-blue-500/30 rounded-xl px-4 py-2.5">
              <p className="text-xs text-blue-400 font-medium uppercase tracking-wide">Nova Temporada</p>
              <p className="text-2xl font-bold text-white">{novaTemp}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total ativos</p>
              <p className="text-2xl font-bold text-white">{activeCount}</p>
            </div>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <div className="flex rounded-lg overflow-hidden border border-gray-700/50 shrink-0">
            <button
              onClick={() => setTab('active')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'active' ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Ativos ({activeCount})
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'all' ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Todo catálogo ({contents.length})
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar título..."
            className="flex-1 bg-white/5 border border-gray-700/50 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500/50"
          />
        </div>

        {/* Igor (12/05): pills filtro por tipo. Clicar no pill ativo volta para "Todos". */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              typeFilter === 'all'
                ? 'bg-white text-black'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'release' ? 'all' : 'release')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 ${
              typeFilter === 'release'
                ? 'bg-red-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${typeFilter === 'release' ? 'bg-white' : 'bg-red-500'}`} />
            Novidade ({novidades})
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'new_season' ? 'all' : 'new_season')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 ${
              typeFilter === 'new_season'
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${typeFilter === 'new_season' ? 'bg-white' : 'bg-blue-500'}`} />
            Nova Temp. ({novaTemp})
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            {tab === 'active' ? 'Nenhum título marcado ainda.' : 'Nenhum resultado.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-4 bg-white/5 hover:bg-white/8 border border-white/5 rounded-xl p-3 transition-colors"
              >
                {/* Poster */}
                <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-800">
                  {item.poster_url ? (
                    <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">?</div>
                  )}
                </div>

                {/* Title + type */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{item.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {item.content_type === 'series' ? 'Série' : 'Filme'} · {item.status}
                  </p>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Novidade */}
                  <button
                    onClick={() => toggle(item, 'is_release')}
                    disabled={togglingId === `${item.id}-is_release`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                      item.is_release
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-white/8 text-gray-400 hover:bg-white/15 border border-white/10'
                    }`}
                  >
                    {togglingId === `${item.id}-is_release` ? (
                      <div className="w-3 h-3 animate-spin rounded-full border border-current border-t-transparent" />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full ${item.is_release ? 'bg-white' : 'bg-gray-600'}`} />
                    )}
                    Novidade
                  </button>

                  {/* Nova Temporada — só para séries */}
                  <button
                    onClick={() => toggle(item, 'is_new_season')}
                    disabled={togglingId === `${item.id}-is_new_season` || item.content_type !== 'series'}
                    title={item.content_type !== 'series' ? 'Apenas para séries' : undefined}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      item.is_new_season
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-white/8 text-gray-400 hover:bg-white/15 border border-white/10'
                    }`}
                  >
                    {togglingId === `${item.id}-is_new_season` ? (
                      <div className="w-3 h-3 animate-spin rounded-full border border-current border-t-transparent" />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full ${item.is_new_season ? 'bg-white' : 'bg-gray-600'}`} />
                    )}
                    Nova Temp.
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
