'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { uploadImageToSupabase } from '@/lib/supabaseStorage';

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
  // Igor (15/05): renomeado de "Destaques (Banner)" pra "Destaques (Banner Hero)"
  // — match exato com o termo que Igor usa quando se refere ao banner do topo.
  featured: 'Destaques (Banner Hero)',
  all_movies: 'Todos os Filmes',
  all_series: 'Todas as Séries',
  category: 'Por Categoria',
  manual: 'Seleção Manual',
};

// Igor (15/05): carrosséis cujos conteúdos são curados manualmente pelo admin.
// Os outros (top10_films, releases, all_movies, all_series, category) são
// populados automaticamente por regras do backend e ignoram content_ids[].
// Antes só 'manual' tinha botão "Editar itens" — Igor não conseguia editar
// o Banner Hero (type=featured) porque o botão estava escondido pra ele.
const EDITABLE_CONTENT_TYPES = new Set(['featured', 'manual']);

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
  const [selectedContents, setSelectedContents] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);

  // Igor (12/05): modal 2 colunas — search e filtro de tipo na coluna direita
  // (Disponíveis). Selecionados ficam à esquerda com reordenação e remoção.
  const [availableSearch, setAvailableSearch] = useState('');
  const [availableTypeFilter, setAvailableTypeFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [selectedSearch, setSelectedSearch] = useState('');

  // Igor (21/05): banner OG editável da home (preview do link principal).
  const [ogBanner, setOgBanner] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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

  // Igor (21/05): carrega o banner OG atual (endpoint público).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/settings/homepage-banner`);
        if (res.ok) {
          const data = await res.json();
          setOgBanner(data.url || '');
        }
      } catch {
        /* ignora — fica sem preview até o admin subir um */
      }
    })();
  }, []);

  const saveBanner = async (url: string) => {
    const res = await fetch(`${API_URL}/api/v1/admin/settings/homepage-banner`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ url }),
    });
    return res.ok;
  };

  const handleBannerUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    setUploadingBanner(true);
    try {
      const result = await uploadImageToSupabase(file, 'cinevision-capas', 'og-banner');
      if (result.error || !result.publicUrl) {
        toast.error(`Falha ao enviar: ${result.error || 'erro desconhecido'}`);
        return;
      }
      if (await saveBanner(result.publicUrl)) {
        setOgBanner(result.publicUrl);
        toast.success('Banner salvo! Aparece no preview do link em alguns minutos.');
      } else {
        toast.error('Imagem enviada, mas falhou ao salvar. Tente de novo.');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || 'tente de novo'}`);
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleRemoveBanner = async () => {
    setUploadingBanner(true);
    try {
      if (await saveBanner('')) {
        setOgBanner('');
        toast.success('Banner removido — volta a usar o logo padrão.');
      }
    } finally {
      setUploadingBanner(false);
    }
  };

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
    setAvailableSearch('');
    setSelectedSearch('');
    setAvailableTypeFilter('all');
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
        // Pre-select preservando a ORDEM original do content_ids[] do carrossel
        // (Igor 12/05: ordem importa para a posição na home).
        const byId = new Map(items.map((item) => [item.id, item]));
        const ordered = (carousel.content_ids || [])
          .map((id) => byId.get(id))
          .filter((item): item is ContentItem => Boolean(item));
        setSelectedContents(ordered);
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

  const addContent = (item: ContentItem) => {
    setSelectedContents((prev) => {
      if (prev.some((c) => c.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeContent = (itemId: string) => {
    setSelectedContents((prev) => prev.filter((c) => c.id !== itemId));
  };

  const moveSelected = (index: number, direction: -1 | 1) => {
    setSelectedContents((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const selectedIds = new Set(selectedContents.map((c) => c.id));

  const availableContent = allContent.filter((item) => {
    if (selectedIds.has(item.id)) return false; // só os que NÃO estão selecionados
    if (availableTypeFilter !== 'all' && item.content_type !== availableTypeFilter) return false;
    if (availableSearch && !item.title.toLowerCase().includes(availableSearch.toLowerCase())) return false;
    return true;
  });

  const selectedFiltered = selectedSearch
    ? selectedContents.filter((c) => c.title.toLowerCase().includes(selectedSearch.toLowerCase()))
    : selectedContents;

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

        {/* Igor (21/05): banner OG editável — imagem do preview do link principal */}
        <div className="bg-[#161616] rounded-xl p-4 border border-white/8 mb-6">
          <h2 className="text-sm font-semibold text-white mb-1">
            Banner de Compartilhamento (link principal)
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Imagem que aparece ao compartilhar <strong>cinevisionapp.com.br</strong> no WhatsApp,
            Facebook, etc. Tamanho ideal: 1200×630. Sem banner, usa o logo padrão.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-full sm:w-72 aspect-[1200/630] rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center flex-shrink-0">
              {ogBanner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ogBanner} alt="Banner de compartilhamento" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-600 px-3 text-center">
                  Nenhum banner — usando o logo
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleBannerUpload(f);
                }}
              />
              <button
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploadingBanner}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingBanner ? 'Enviando...' : ogBanner ? 'Trocar banner' : 'Enviar banner'}
              </button>
              {ogBanner && (
                <button
                  onClick={handleRemoveBanner}
                  disabled={uploadingBanner}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm disabled:opacity-50"
                >
                  Remover (voltar ao logo)
                </button>
              )}
            </div>
          </div>
        </div>

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
                    {EDITABLE_CONTENT_TYPES.has(carousel.type) && (
                      <span className="text-[10px] text-gray-500">
                        {carousel.content_ids?.length || 0} item(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {EDITABLE_CONTENT_TYPES.has(carousel.type) && (
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

      {/* Content editor modal — 2 colunas (Igor 12/05) */}
      {editingContentFor && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-5xl border border-white/10 flex flex-col max-h-[90vh]">
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

            {contentLoading ? (
              <div className="flex-1 flex items-center justify-center py-16 text-gray-500 text-sm">
                Carregando conteúdo...
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
                {/* COLUNA ESQUERDA — Selecionados no carrossel */}
                <div className="flex flex-col border-b md:border-b-0 md:border-r border-white/8 overflow-hidden">
                  <div className="p-4 border-b border-white/8">
                    <p className="text-sm font-semibold text-gray-200 mb-2">
                      Selecionados ({selectedContents.length})
                    </p>
                    <input
                      value={selectedSearch}
                      onChange={(e) => setSelectedSearch(e.target.value)}
                      placeholder="Filtrar selecionados..."
                      className="w-full bg-[#252525] border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/35 placeholder-gray-600"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
                    {selectedFiltered.length === 0 ? (
                      <div className="text-center py-10 text-gray-500 text-xs">
                        {selectedContents.length === 0
                          ? 'Nenhum item no carrossel. Adicione da coluna direita →'
                          : 'Nenhum resultado com esse filtro.'}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {selectedFiltered.map((item) => {
                          const realIndex = selectedContents.findIndex((c) => c.id === item.id);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/[0.03] hover:bg-white/5 border border-white/5"
                            >
                              <div className="flex flex-col gap-0.5 flex-shrink-0">
                                <button
                                  onClick={() => moveSelected(realIndex, -1)}
                                  disabled={realIndex === 0}
                                  className="p-0.5 rounded hover:bg-white/8 disabled:opacity-20 disabled:cursor-not-allowed"
                                  title="Mover para cima"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => moveSelected(realIndex, 1)}
                                  disabled={realIndex === selectedContents.length - 1}
                                  className="p-0.5 rounded hover:bg-white/8 disabled:opacity-20 disabled:cursor-not-allowed"
                                  title="Mover para baixo"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                              {item.poster_url ? (
                                <img src={item.poster_url} alt="" className="w-7 h-10 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-7 h-10 rounded bg-gray-800 flex-shrink-0" />
                              )}
                              <span className="text-sm truncate flex-1">{item.title}</span>
                              <span className="text-[10px] text-gray-500 flex-shrink-0 capitalize">
                                {item.content_type === 'series' ? 'Série' : 'Filme'}
                              </span>
                              <button
                                onClick={() => removeContent(item.id)}
                                className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                                title="Remover do carrossel"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* COLUNA DIREITA — Disponíveis para adicionar */}
                <div className="flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-white/8 space-y-2">
                    <p className="text-sm font-semibold text-gray-200">
                      Disponíveis ({availableContent.length})
                    </p>
                    <input
                      ref={filterRef}
                      value={availableSearch}
                      onChange={(e) => setAvailableSearch(e.target.value)}
                      placeholder="Buscar por título..."
                      className="w-full bg-[#252525] border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/35 placeholder-gray-600"
                    />
                    <div className="flex gap-1">
                      {(['all', 'movie', 'series'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setAvailableTypeFilter(type)}
                          className={`px-3 py-1 text-xs rounded-full transition-colors ${
                            availableTypeFilter === type
                              ? 'bg-white text-black font-semibold'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {type === 'all' ? 'Todos' : type === 'movie' ? 'Filmes' : 'Séries'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
                    {availableContent.length === 0 ? (
                      <div className="text-center py-10 text-gray-500 text-xs">
                        Nenhum item disponível com esses filtros.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {availableContent.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => addContent(item)}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 border border-transparent transition-colors text-left"
                          >
                            {item.poster_url ? (
                              <img src={item.poster_url} alt="" className="w-7 h-10 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-7 h-10 rounded bg-gray-800 flex-shrink-0" />
                            )}
                            <span className="text-sm truncate flex-1">{item.title}</span>
                            <span className="text-[10px] text-gray-500 flex-shrink-0 capitalize">
                              {item.content_type === 'series' ? 'Série' : 'Filme'}
                            </span>
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-white/8 flex gap-2 justify-between items-center">
              <span className="text-xs text-gray-500">
                {selectedContents.length} no carrossel · {allContent.length - selectedContents.length} disponíveis
              </span>
              <div className="flex gap-2">
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
                  {saving === editingContentFor.id ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
