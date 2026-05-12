'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Carousel {
  id: string;
  slug: string;
  title: string;
  type: string;
  category_id: string | null;
  content_ids: string[];
  is_visible: boolean;
  display_order: number;
}

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  poster_url?: string;
}

const TYPE_LABELS: Record<string, string> = {
  top10_films: 'Top 10 Filmes',
  top10_series: 'Top 10 Séries',
  releases: 'Lançamentos',
  featured: 'Destaques (Banner)',
  all_movies: 'Todos os Filmes',
  all_series: 'Todas as Séries',
  category: 'Por Categoria',
  manual: 'Seleção Manual',
};

const TYPE_COLORS: Record<string, string> = {
  top10_films: 'bg-orange-500/20 text-orange-400',
  top10_series: 'bg-purple-500/20 text-purple-400',
  releases: 'bg-green-500/20 text-green-400',
  featured: 'bg-yellow-500/20 text-yellow-400',
  all_movies: 'bg-blue-500/20 text-blue-400',
  all_series: 'bg-indigo-500/20 text-indigo-400',
  category: 'bg-teal-500/20 text-teal-400',
  manual: 'bg-pink-500/20 text-pink-400',
};

export default function AdminHomepagePage() {
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingContentFor, setEditingContentFor] = useState<Carousel | null>(null);
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [contentFilter, setContentFilter] = useState('');
  const [selectedContents, setSelectedContents] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);

  const getToken = () =>
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') || localStorage.getItem('auth_token') || ''
      : '';

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    }),
    [],
  );

  const fetchCarousels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/homepage/carousels`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCarousels(data);
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchCarousels();
  }, [fetchCarousels]);

  const toggleVisible = async (carousel: Carousel) => {
    setSaving(carousel.id);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/admin/homepage/carousels/${carousel.id}`,
        {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ is_visible: !carousel.is_visible }),
        },
      );
      if (res.ok) {
        setCarousels((prev) =>
          prev.map((c) =>
            c.id === carousel.id ? { ...c, is_visible: !c.is_visible } : c,
          ),
        );
      }
    } finally {
      setSaving(null);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const newList = [...carousels];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    const updated = newList.map((c, i) => ({ ...c, display_order: i + 1 }));
    setCarousels(updated);

    setSaving('reorder');
    try {
      await fetch(`${API_URL}/api/v1/admin/homepage/carousels/reorder`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          items: updated.map((c) => ({ id: c.id, display_order: c.display_order })),
        }),
      });
    } finally {
      setSaving(null);
    }
  };

  const saveTitle = async (carousel: Carousel) => {
    if (!titleDraft.trim() || titleDraft === carousel.title) {
      setEditingTitle(null);
      return;
    }
    setSaving(carousel.id);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/admin/homepage/carousels/${carousel.id}`,
        {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ title: titleDraft.trim() }),
        },
      );
      if (res.ok) {
        setCarousels((prev) =>
          prev.map((c) =>
            c.id === carousel.id ? { ...c, title: titleDraft.trim() } : c,
          ),
        );
      }
    } finally {
      setSaving(null);
      setEditingTitle(null);
    }
  };

  const openContentEditor = async (carousel: Carousel) => {
    setEditingContentFor(carousel);
    setContentFilter('');
    setContentLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/content`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const items: ContentItem[] = (Array.isArray(data) ? data : data.content || []).map(
          (item: any) => ({
            id: item.id,
            title: item.title,
            content_type: item.content_type || 'movie',
            poster_url: item.poster_url,
          }),
        );
        setAllContent(items);
        // Pre-select existing content_ids
        const existingIds = new Set(carousel.content_ids || []);
        setSelectedContents(items.filter((item) => existingIds.has(item.id)));
      }
    } finally {
      setContentLoading(false);
      setTimeout(() => filterRef.current?.focus(), 100);
    }
  };

  const saveContentIds = async () => {
    if (!editingContentFor) return;
    setSaving(editingContentFor.id);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/admin/homepage/carousels/${editingContentFor.id}`,
        {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            content_ids: selectedContents.map((c) => c.id),
          }),
        },
      );
      if (res.ok) {
        setCarousels((prev) =>
          prev.map((c) =>
            c.id === editingContentFor.id
              ? { ...c, content_ids: selectedContents.map((ci) => ci.id) }
              : c,
          ),
        );
      }
    } finally {
      setSaving(null);
      setEditingContentFor(null);
      setSelectedContents([]);
      setAllContent([]);
    }
  };

  const toggleContentItem = (item: ContentItem) => {
    setSelectedContents((prev) => {
      const exists = prev.find((c) => c.id === item.id);
      if (exists) return prev.filter((c) => c.id !== item.id);
      return [...prev, item];
    });
  };

  const filteredContent = allContent.filter((item) => {
    if (!contentFilter) return true;
    return item.title.toLowerCase().includes(contentFilter.toLowerCase());
  });

  const selectedIds = new Set(selectedContents.map((c) => c.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-white text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">
            ← Painel
          </Link>
          <span className="text-gray-600">/</span>
          <h1 className="text-xl font-bold">Página Inicial</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Ative, reordene e renomeie os carrosséis da home. Alterações são aplicadas na hora.
        </p>

        <div className="space-y-2">
          {carousels.map((carousel, index) => (
            <div
              key={carousel.id}
              className={`bg-[#161616] rounded-xl p-4 border transition-all duration-200 ${
                carousel.is_visible ? 'border-white/8' : 'border-white/4 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Up/Down arrows */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || saving === 'reorder'}
                    className="p-1 rounded hover:bg-white/8 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Mover para cima"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === carousels.length - 1 || saving === 'reorder'}
                    className="p-1 rounded hover:bg-white/8 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Mover para baixo"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {editingTitle === carousel.id ? (
                    <div className="flex gap-2 items-center">
                      <input
                        autoFocus
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveTitle(carousel);
                          if (e.key === 'Escape') setEditingTitle(null);
                        }}
                        className="flex-1 bg-[#252525] border border-white/20 rounded-lg px-2.5 py-1 text-sm text-white outline-none focus:border-white/40 min-w-0"
                      />
                      <button
                        onClick={() => saveTitle(carousel)}
                        disabled={saving === carousel.id}
                        className="text-xs px-2.5 py-1 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditingTitle(null)}
                        className="text-xs text-gray-400 hover:text-white transition-colors flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{carousel.title}</span>
                      <button
                        onClick={() => {
                          setEditingTitle(carousel.id);
                          setTitleDraft(carousel.title);
                        }}
                        className="text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
                        title="Editar título"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        TYPE_COLORS[carousel.type] || 'bg-white/5 text-gray-400'
                      }`}
                    >
                      {TYPE_LABELS[carousel.type] || carousel.type}
                    </span>
                    {carousel.type === 'manual' && (
                      <span className="text-[10px] text-gray-500">
                        {carousel.content_ids?.length || 0} item(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {carousel.type === 'manual' && (
                    <button
                      onClick={() => openContentEditor(carousel)}
                      className="text-xs px-2.5 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition-colors border border-blue-600/20"
                    >
                      Editar itens
                    </button>
                  )}

                  {/* Toggle switch */}
                  <button
                    onClick={() => toggleVisible(carousel)}
                    disabled={saving === carousel.id}
                    className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                      carousel.is_visible ? 'bg-green-500' : 'bg-white/10'
                    }`}
                    title={carousel.is_visible ? 'Ocultar' : 'Exibir'}
                  >
                    <span
                      className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow-md transition-all duration-200 ${
                        carousel.is_visible ? 'left-[22px]' : 'left-[3px]'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {carousels.length === 0 && (
          <div className="text-center py-16 text-gray-500 text-sm">
            Nenhum carrossel configurado. Verifique se a tabela <code>homepage_carousels</code> foi criada no banco de dados.
          </div>
        )}
      </div>

      {/* Content editor modal */}
      {editingContentFor && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-lg border border-white/10 flex flex-col max-h-[85vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-white/8">
              <div>
                <h2 className="font-bold">Itens do carrossel</h2>
                <p className="text-xs text-gray-500 mt-0.5">{editingContentFor.title}</p>
              </div>
              <button
                onClick={() => {
                  setEditingContentFor(null);
                  setSelectedContents([]);
                  setAllContent([]);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-white/8">
              <input
                ref={filterRef}
                value={contentFilter}
                onChange={(e) => setContentFilter(e.target.value)}
                placeholder="Filtrar por título..."
                className="w-full bg-[#252525] border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/35 placeholder-gray-600"
              />
              <p className="text-xs text-gray-500 mt-2">
                {selectedContents.length} selecionado(s) · {filteredContent.length} exibido(s)
              </p>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto p-2">
              {contentLoading ? (
                <div className="text-center py-8 text-gray-500 text-sm">Carregando conteúdo...</div>
              ) : filteredContent.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">Nenhum item encontrado</div>
              ) : (
                <div className="space-y-1">
                  {/* Show selected items first */}
                  {filteredContent
                    .sort((a, b) => {
                      const aSelected = selectedIds.has(a.id) ? 0 : 1;
                      const bSelected = selectedIds.has(b.id) ? 0 : 1;
                      return aSelected - bSelected || a.title.localeCompare(b.title);
                    })
                    .map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleContentItem(item)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                            isSelected
                              ? 'bg-green-600/15 border border-green-600/25'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-green-500 border-green-500'
                                : 'border-white/25 bg-transparent'
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm truncate flex-1">{item.title}</span>
                          <span className="text-[10px] text-gray-500 flex-shrink-0 capitalize">
                            {item.content_type === 'series' ? 'Série' : 'Filme'}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/8 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setEditingContentFor(null);
                  setSelectedContents([]);
                  setAllContent([]);
                }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveContentIds}
                disabled={saving === editingContentFor.id}
                className="px-4 py-2 text-sm bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {saving === editingContentFor.id ? 'Salvando...' : `Salvar (${selectedContents.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
