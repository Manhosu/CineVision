'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Film,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Upload,
  Pencil,
  Send,
  Bot,
  RotateCcw,
  Archive,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Content {
  id: string;
  title: string;
  content_type: string;
  poster_url: string;
  total_seasons?: number;
  total_episodes?: number;
  created_at: string;
  status: string;
  // N14 — backend agora retorna createdBy populado via JOIN em memória.
  createdById?: string | null;
  createdBy?: { id: string; name: string; email: string; role: string } | null;
  telegram_group_link?: string | null;
  // Igor (15/05): distinção bot ID vs link de convite no botão Testar.
  telegram_chat_id?: string | null;
  // Igor (12/05): badges para filtros clicáveis
  is_release?: boolean;
  is_new_season?: boolean;
}

type ContentTypeFilter = 'all' | 'movie' | 'series' | 'novelinha' | 'release' | 'new_season';

export default function ContentManagePage() {
  const router = useRouter();

  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // Igor (12/05): filtro clicável por tipo + flag (toggle).
  const [typeFilter, setTypeFilter] = useState<ContentTypeFilter>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Content | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  // Igor (08/05): aprovacao em batch dos DRAFTs (conteudos do funcionario).
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [batchPublishing, setBatchPublishing] = useState(false);
  // Igor (18/05): confirmação de publicar via modal in-app. Antes usava
  // window.confirm(), que estava sendo bloqueado no navegador do Igor →
  // clicar em publicar não fazia nada ("botão morto").
  const [pendingPublish, setPendingPublish] = useState<
    { type: 'single'; content: Content } | { type: 'batch' } | null
  >(null);
  // Igor (26/05): aba "Histórico" mostra conteúdos arquivados pra ele
  // poder restaurar se deletou errado.
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    fetchContents();
  }, [viewMode]);

  const fetchContents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const url =
        viewMode === 'archived'
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/archived`
          : `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setContents(data);
      }
    } catch (error) {
      console.error('Error fetching contents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (content: Content) => {
    try {
      setRestoringId(content.id);
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${content.id}/restore`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );
      if (response.ok) {
        toast.success(`"${content.title}" restaurado — voltou pro site.`);
        await fetchContents();
      } else {
        const errorText = await response.text();
        let msg = errorText;
        try { msg = JSON.parse(errorText).message || errorText; } catch { /* texto cru */ }
        toast.error(`Erro ao restaurar: ${msg}`);
      }
    } catch (err: any) {
      toast.error(`Erro de rede: ${err?.message || 'desconhecido'}`);
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (content: Content) => {
    setDeleteTarget(content);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      console.log('[Delete Content] Deleting content:', deleteTarget.id, deleteTarget.title);
      console.log('[Delete Content] API URL:', process.env.NEXT_PUBLIC_API_URL);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${deleteTarget.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      console.log('[Delete Content] Response status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('[Delete Content] Success:', result);
        alert(`✅ ${deleteTarget.title} deletado com sucesso!`);
        await fetchContents();
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
      } else {
        const errorText = await response.text();
        console.error('[Delete Content] Error response:', errorText);

        try {
          const errorJson = JSON.parse(errorText);
          alert(`❌ Erro ao deletar: ${errorJson.message || errorText}`);
        } catch {
          alert(`❌ Erro ao deletar: ${response.status} ${response.statusText}\n\n${errorText}`);
        }
      }
    } catch (error) {
      console.error('[Delete Content] Network error:', error);
      alert(`❌ Erro de rede ao deletar conteúdo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  // Publica um conteúdo. Chamado pelo modal de confirmação (não mais por
  // window.confirm). Feedback via toast (window.alert também era bloqueado).
  const runPublish = async (content: Content) => {
    try {
      setPublishingId(content.id);
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${content.id}/publish`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        toast.success('Conteúdo publicado! Já está visível no site.');
        await fetchContents();
      } else {
        const errorText = await response.text();
        console.error('Erro ao publicar:', errorText);
        let msg = errorText;
        try { msg = JSON.parse(errorText).message || errorText; } catch { /* texto cru */ }
        toast.error(`Erro ao publicar: ${msg}`);
      }
    } catch (error) {
      console.error('Error publishing content:', error);
      toast.error('Erro ao publicar conteúdo');
    } finally {
      setPublishingId(null);
    }
  };

  // Igor (08/05): batch publish — toggle checkbox + acao em massa.
  const toggleDraftSelection = (contentId: string) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });
  };

  const selectAllVisibleDrafts = () => {
    const draftIds = filteredContents
      .filter((c) => c.status === 'DRAFT' || c.status === 'draft')
      .map((c) => c.id);
    setSelectedDraftIds(new Set(draftIds));
  };

  const clearDraftSelection = () => setSelectedDraftIds(new Set());

  const runPublishBatch = async () => {
    if (selectedDraftIds.size === 0) return;
    try {
      setBatchPublishing(true);
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/publish-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content_ids: Array.from(selectedDraftIds) }),
        },
      );
      if (response.ok) {
        const r = await response.json();
        if (r.failed_count) {
          toast.error(`${r.published_count} publicado(s), ${r.failed_count} falhou(falharam).`);
        } else {
          toast.success(`${r.published_count} conteúdo(s) publicado(s)!`);
        }
        clearDraftSelection();
        await fetchContents();
      } else {
        const errorText = await response.text();
        toast.error(`Erro no batch: ${errorText}`);
      }
    } catch (err: any) {
      toast.error(`Erro de rede: ${err?.message || 'desconhecido'}`);
    } finally {
      setBatchPublishing(false);
    }
  };

  // Confirmação do modal de publicar (substitui window.confirm).
  const confirmPublish = async () => {
    const p = pendingPublish;
    setPendingPublish(null);
    if (!p) return;
    if (p.type === 'single') await runPublish(p.content);
    else await runPublishBatch();
  };

  // Igor (12/05): clicar em "Testar grupo Telegram" agora chama o endpoint
  // admin que tenta gerar invite link de verdade e retorna erro estruturado.
  // Igor (15/05): aceita 'type' pra distinguir teste por bot ID vs link de
  // convite — o Matheus configura com bot, a esposa do Igor com link, e
  // antes o botão único dava erro confuso pro caso do link.
  const testTelegramGroup = async (content: Content, type: 'bot' | 'link') => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('access_token') || localStorage.getItem('auth_token') || ''
        : '';
    const loadingToast = toast.loading(
      type === 'bot' ? 'Testando bot...' : 'Testando link de convite...',
    );
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${content.id}/test-telegram-group?type=${type}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      const data = await res.json();
      toast.dismiss(loadingToast);

      if (data.success && data.inviteLink) {
        toast.success(`Grupo "${data.chatTitle || content.title}" acessível! Abrindo...`);
        window.open(data.inviteLink, '_blank', 'noopener,noreferrer');
        return;
      }

      // Erros estruturados
      switch (data.error) {
        case 'link_missing':
          toast.error('Conteúdo sem grupo Telegram configurado. Edite e adicione o telegram_chat_id ou telegram_group_link.', { duration: 6000 });
          break;
        case 'bot_not_admin':
          toast.error(
            `Bot não é admin do grupo com permissão de convite.\n${data.detail || ''}`.trim(),
            { duration: 8000 },
          );
          break;
        case 'chat_id_invalid':
          toast.error(`Chat ID inválido.\n${data.detail || ''}`.trim(), { duration: 6000 });
          break;
        default:
          toast.error(`Falha ao testar: ${data.detail || 'erro desconhecido'}`, { duration: 6000 });
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(`Erro de rede: ${err?.message || 'desconhecido'}`);
    }
  };

  const filteredContents = contents.filter(content => {
    // search por título
    if (searchTerm && !content.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    // filtro de tipo/flag (Igor 12/05)
    switch (typeFilter) {
      case 'movie':
        return content.content_type === 'movie';
      case 'series':
        return content.content_type === 'series';
      case 'novelinha':
        return content.content_type === 'novelinha';
      case 'release':
        return !!content.is_release;
      case 'new_season':
        return !!content.is_new_season;
      default:
        return true;
    }
  });

  const movieCount = contents.filter(c => c.content_type === 'movie').length;
  const seriesCount = contents.filter(c => c.content_type === 'series').length;
  const novelinhaCount = contents.filter(c => c.content_type === 'novelinha').length;
  const releaseCount = contents.filter(c => c.is_release).length;
  const newSeasonCount = contents.filter(c => c.is_new_season).length;

  const draftsVisible = filteredContents.filter(
    (c) => c.status === 'DRAFT' || c.status === 'draft',
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar para Admin
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              Gerenciar Conteúdos
            </h1>
            <p className="text-gray-400 mt-2">
              Gerencie filmes e séries do catálogo
            </p>
          </div>
        </div>

        {/* Igor (26/05): toggle Ativos / Histórico — Histórico lista os
            arquivados pra ele poder restaurar se deletou errado. */}
        <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-dark-800/50 p-1">
          <button
            onClick={() => setViewMode('active')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              viewMode === 'active'
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Film className="w-4 h-4" />
            Ativos
          </button>
          <button
            onClick={() => setViewMode('archived')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              viewMode === 'archived'
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Archive className="w-4 h-4" />
            Histórico
          </button>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-800/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
          />
        </div>

        {/* Stats clicáveis (Igor 12/05) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <button
            onClick={() => setTypeFilter('all')}
            className={`bg-dark-800/50 backdrop-blur-sm border rounded-xl p-6 text-left transition-all ${
              typeFilter === 'all' ? 'border-white/40' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <p className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              {contents.length}
            </p>
            <p className="text-sm text-gray-400 mt-1">Total de Conteúdos</p>
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'movie' ? 'all' : 'movie')}
            className={`bg-dark-800/50 backdrop-blur-sm border rounded-xl p-6 text-left transition-all ${
              typeFilter === 'movie' ? 'border-blue-400/60' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {movieCount}
            </p>
            <p className="text-sm text-gray-400 mt-1">Filmes</p>
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'series' ? 'all' : 'series')}
            className={`bg-dark-800/50 backdrop-blur-sm border rounded-xl p-6 text-left transition-all ${
              typeFilter === 'series' ? 'border-purple-400/60' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {seriesCount}
            </p>
            <p className="text-sm text-gray-400 mt-1">Séries</p>
          </button>
        </div>

        {/* Pills de filtro adicional (Igor 12/05) */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              typeFilter === 'all'
                ? 'bg-white text-black'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            Todos ({contents.length})
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'movie' ? 'all' : 'movie')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              typeFilter === 'movie'
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            Filmes ({movieCount})
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'series' ? 'all' : 'series')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              typeFilter === 'series'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            Séries ({seriesCount})
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'novelinha' ? 'all' : 'novelinha')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              typeFilter === 'novelinha'
                ? 'bg-pink-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            Novelinhas ({novelinhaCount})
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
            Novidades ({releaseCount})
          </button>
          <button
            onClick={() => setTypeFilter(typeFilter === 'new_season' ? 'all' : 'new_season')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 ${
              typeFilter === 'new_season'
                ? 'bg-orange-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${typeFilter === 'new_season' ? 'bg-white' : 'bg-orange-500'}`} />
            Nova Temp. ({newSeasonCount})
          </button>
        </div>

        {/* Igor (08/05): barra de aprovacao em batch dos DRAFTs.
            Aparece quando ha DRAFTs no filtro atual. */}
        {draftsVisible.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-amber-200">
              <strong>{draftsVisible.length}</strong> conteúdo(s) aguardando aprovação ·{' '}
              <strong>{selectedDraftIds.size}</strong> selecionado(s)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={selectAllVisibleDrafts}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-zinc-200 hover:bg-white/5"
                disabled={selectedDraftIds.size === draftsVisible.length}
              >
                Selecionar todos
              </button>
              {selectedDraftIds.size > 0 && (
                <button
                  onClick={clearDraftSelection}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-zinc-200 hover:bg-white/5"
                >
                  Limpar seleção
                </button>
              )}
              <button
                onClick={() => setPendingPublish({ type: 'batch' })}
                disabled={selectedDraftIds.size === 0 || batchPublishing}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {batchPublishing
                  ? 'Publicando...'
                  : `Publicar ${selectedDraftIds.size > 0 ? `${selectedDraftIds.size} ` : ''}selecionado${selectedDraftIds.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        )}

        {/* Content Table */}
        <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900/50">
                <tr>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-400 w-10">
                    {/* checkbox column */}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Poster
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Título
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Adicionado por
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredContents.map((content) => {
                  const isDraft =
                    content.status === 'DRAFT' || content.status === 'draft';
                  const isSelected = selectedDraftIds.has(content.id);
                  return (
                  <tr
                    key={content.id}
                    className={`hover:bg-white/5 transition-colors ${
                      isSelected ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <td className="px-3 py-4">
                      {isDraft && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDraftSelection(content.id)}
                          className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          aria-label={`Selecionar ${content.title} para publicação em batch`}
                        />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <img
                        src={content.poster_url || '/images/placeholder-poster.svg'}
                        alt={content.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{content.title}</div>
                      {content.content_type === 'series' && (
                        <div className="text-sm text-gray-400 mt-1">
                          {content.total_seasons} Temporadas • {content.total_episodes} Episódios
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary-500/20 text-primary-400">
                        <Film className="w-3 h-3" />
                        {content.content_type === 'movie' ? 'Filme' : 'Série'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {content.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                          <AlertCircle className="w-3 h-3" />
                          {content.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {content.createdBy ? (
                        <div>
                          <div className="text-sm text-white">{content.createdBy.name}</div>
                          <div className="text-xs text-gray-400 capitalize">
                            {content.createdBy.role?.toLowerCase() || 'usuário'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 italic">Sistema</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {viewMode === 'archived' ? (
                          <button
                            onClick={() => handleRestore(content)}
                            disabled={restoringId === content.id}
                            className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
                            title="Restaurar conteúdo"
                          >
                            {restoringId === content.id ? (
                              <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                            Restaurar
                          </button>
                        ) : (
                          <>
                            {/* Botão Publicar - só aparece se não estiver publicado */}
                            {(content.status === 'DRAFT' || content.status === 'draft') && (
                              <button
                                onClick={() => setPendingPublish({ type: 'single', content })}
                                disabled={publishingId === content.id}
                                className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Publicar conteúdo"
                              >
                                {publishingId === content.id ? (
                                  <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Upload className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            {/* Igor (15/05): 2 botões condicionais. Bot (roxo) só
                                se telegram_chat_id setado; Link (ciano) só se
                                telegram_group_link setado. Cores distintas pra Igor
                                saber qual modo está testando — Matheus usa bot ID,
                                esposa do Igor usa link de convite. */}
                            {content.telegram_chat_id && (
                              <button
                                onClick={() => testTelegramGroup(content, 'bot')}
                                className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                                title="Testar via bot (chat_id)"
                              >
                                <Bot className="w-4 h-4" />
                              </button>
                            )}
                            {content.telegram_group_link && (
                              <button
                                onClick={() => testTelegramGroup(content, 'link')}
                                className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                                title="Testar via link de convite"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              // Igor (15/05): abre em nova aba pra não perder a seleção
                              // de batch approve dos drafts. Igor reportou que clicar no
                              // lápis e voltar zerava o checkbox de todos os outros filmes.
                              onClick={() => window.open(`/admin/content/${content.id}/edit`, '_blank', 'noopener,noreferrer')}
                              className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                              title="Editar (abre em nova aba)"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(content)}
                              className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                              title="Deletar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deleteTarget && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">
                Confirmar Exclusão
              </h3>
              <p className="text-gray-300 mb-6">
                Tem certeza que deseja excluir <strong>{deleteTarget.title}</strong>?
                Esta ação não pode ser desfeita e irá remover:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-400 mb-6 space-y-1">
                <li>O conteúdo do banco de dados</li>
                <li>Todos os episódios (se for série)</li>
                <li>Imagens (poster, backdrop)</li>
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteTarget(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-dark-700 text-white hover:bg-dark-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Publish Confirmation Modal — Igor (18/05): substitui o
            window.confirm() que estava sendo bloqueado ("botão morto"). */}
        {pendingPublish && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">Publicar conteúdo</h3>
              <p className="text-gray-300 mb-6">
                {pendingPublish.type === 'single' ? (
                  <>
                    Publicar <strong>{pendingPublish.content.title}</strong>? Ele
                    ficará visível no site.
                  </>
                ) : (
                  <>
                    Publicar <strong>{selectedDraftIds.size}</strong> conteúdo(s)
                    selecionado(s)? Eles ficam visíveis no site imediatamente.
                  </>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingPublish(null)}
                  className="flex-1 px-4 py-2 rounded-lg bg-dark-700 text-white hover:bg-dark-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmPublish}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                >
                  Publicar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
