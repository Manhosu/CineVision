'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Discount {
  id: string;
  name: string;
  description?: string;
  discount_scope: 'global' | 'category' | 'individual';
  scope_id?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  starts_at: string;
  ends_at: string;
  is_flash: boolean;
  is_active: boolean;
  created_at?: string;
}

const emptyForm: {
  name: string;
  description: string;
  discount_scope: 'global' | 'category' | 'individual';
  scope_id: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  starts_at: string;
  ends_at: string;
  is_flash: boolean;
} = {
  name: '',
  description: '',
  discount_scope: 'global',
  scope_id: '',
  discount_type: 'percentage',
  discount_value: 0,
  starts_at: '',
  ends_at: '',
  is_flash: false,
};

interface ContentOption {
  id: string;
  title: string;
  content_type: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

export default function AdminDiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [contentSearch, setContentSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('access_token') || localStorage.getItem('auth_token'))
      : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/discounts?limit=100`, { headers: getHeaders() });
      const data = await res.json();
      setDiscounts(data.data || []);
    } catch (err) {
      console.error('Failed to fetch discounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
    fetchContentAndCategories();
  }, []);

  const fetchContentAndCategories = async () => {
    try {
      // Fetch all content (movies + series)
      const [moviesRes, seriesRes, catsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/content/movies?limit=100`, { headers: getHeaders() }),
        fetch(`${API_URL}/api/v1/content/series?limit=100`, { headers: getHeaders() }),
        fetch(`${API_URL}/api/v1/content/categories`, { headers: getHeaders() }).catch(() => null),
      ]);
      const moviesData = await moviesRes.json();
      const seriesData = await seriesRes.json();
      const movies = (moviesData.movies || moviesData.data || []).map((m: any) => ({ id: m.id, title: m.title, content_type: 'movie' }));
      const series = (seriesData.movies || seriesData.data || []).map((s: any) => ({ id: s.id, title: s.title, content_type: 'series' }));
      setContentOptions([...movies, ...series]);

      if (catsRes && catsRes.ok) {
        const catsData = await catsRes.json();
        setCategoryOptions(Array.isArray(catsData) ? catsData : []);
      }
    } catch (err) {
      console.error('Failed to fetch content/categories:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const body: any = {
        name: form.name,
        description: form.description || undefined,
        discount_scope: form.discount_scope,
        scope_id: form.scope_id || undefined,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        is_flash: form.is_flash,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`${API_URL}/api/v1/discounts/${editingId}`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API_URL}/api/v1/discounts`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Erro ao salvar desconto');
      }

      setSuccess(editingId ? 'Desconto atualizado com sucesso!' : 'Desconto criado com sucesso!');
      setForm(emptyForm);
      setEditingId(null);
      fetchDiscounts();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar desconto');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (discount: Discount) => {
    setEditingId(discount.id);
    setForm({
      name: discount.name,
      description: discount.description || '',
      discount_scope: discount.discount_scope,
      scope_id: discount.scope_id || '',
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      starts_at: discount.starts_at ? new Date(discount.starts_at).toISOString().slice(0, 16) : '',
      ends_at: discount.ends_at ? new Date(discount.ends_at).toISOString().slice(0, 16) : '',
      is_flash: discount.is_flash,
    });
    setError(null);
    setSuccess(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja desativar este desconto?')) return;

    try {
      await fetch(`${API_URL}/api/v1/discounts/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      setSuccess('Desconto desativado com sucesso!');
      fetchDiscounts();
    } catch (err) {
      setError('Erro ao desativar desconto');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setSuccess(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatValue = (type: string, value: number) => {
    if (type === 'percentage') return `${value}%`;
    return `R$ ${(value / 100).toFixed(2)}`;
  };

  const scopeLabels: Record<string, string> = {
    global: 'Global',
    category: 'Categoria',
    individual: 'Individual',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Gerenciar Descontos</h1>
            <p className="text-gray-400">Crie e gerencie descontos e promo&ccedil;&otilde;es rel&acirc;mpago</p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Voltar ao Painel
          </Link>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-300">
            {success}
          </div>
        )}

        {/* Form */}
        <div className="mb-8 bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
          <h2 className="text-xl font-bold text-white mb-4">
            {editingId ? 'Editar Desconto' : 'Novo Desconto'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Ex: Black Friday 2026"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Descri&ccedil;&atilde;o</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Descri&ccedil;&atilde;o opcional"
              />
            </div>

            {/* Scope */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Escopo</label>
              <select
                value={form.discount_scope}
                onChange={(e) => setForm({ ...form, discount_scope: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="global">Global (todos os conte&uacute;dos)</option>
                <option value="category">Categoria</option>
                <option value="individual">Individual (conte&uacute;do espec&iacute;fico)</option>
              </select>
            </div>

            {/* Scope ID - Content or Category selector */}
            {form.discount_scope === 'individual' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Selecionar Conteúdo</label>
                <input
                  type="text"
                  value={contentSearch}
                  onChange={(e) => setContentSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent mb-2"
                  placeholder="Buscar filme ou série..."
                />
                <div className="max-h-48 overflow-y-auto bg-gray-900/50 border border-gray-600 rounded-lg">
                  {contentOptions
                    .filter(c => !contentSearch || c.title.toLowerCase().includes(contentSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setForm({ ...form, scope_id: c.id }); setContentSearch(c.title); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700/50 transition-colors flex items-center justify-between ${
                          form.scope_id === c.id ? 'bg-red-600/20 text-red-400' : 'text-gray-300'
                        }`}
                      >
                        <span>{c.title}</span>
                        <span className="text-xs text-gray-500">{c.content_type === 'series' ? 'Série' : 'Filme'}</span>
                      </button>
                    ))}
                  {contentOptions.filter(c => !contentSearch || c.title.toLowerCase().includes(contentSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-500">Nenhum conteúdo encontrado</p>
                  )}
                </div>
                {form.scope_id && (
                  <p className="text-xs text-green-400 mt-1">
                    Selecionado: {contentOptions.find(c => c.id === form.scope_id)?.title || form.scope_id}
                  </p>
                )}
              </div>
            )}

            {form.discount_scope === 'category' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Selecionar Categoria</label>
                {categoryOptions.length > 0 ? (
                  <select
                    value={form.scope_id}
                    onChange={(e) => setForm({ ...form, scope_id: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">Selecione uma categoria</option>
                    {categoryOptions.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500 py-2">Nenhuma categoria encontrada</p>
                )}
              </div>
            )}

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="percentage">Porcentagem (%)</option>
                <option value="fixed">Valor Fixo (centavos)</option>
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Valor {form.discount_type === 'percentage' ? '(%)' : '(centavos)'}
              </label>
              <input
                type="number"
                required
                min="0"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Starts at */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">In&iacute;cio</label>
              <input
                type="datetime-local"
                required
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Ends at */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fim</label>
              <input
                type="datetime-local"
                required
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Flash toggle */}
            <div className="flex items-center gap-3 pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_flash}
                  onChange={(e) => setForm({ ...form, is_flash: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
              <span className="text-sm font-medium text-gray-300">
                Promo&ccedil;&atilde;o Rel&acirc;mpago &#9889;
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-3 lg:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-lg transition-all disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Desconto'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-all"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Discounts Table */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="p-6 border-b border-gray-700/50">
            <h2 className="text-xl font-bold text-white">Descontos Cadastrados</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-pulse text-gray-400">Carregando...</div>
            </div>
          ) : discounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhum desconto cadastrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Escopo</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">In&iacute;cio</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Fim</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">A&ccedil;&otilde;es</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {discounts.map((discount) => {
                    const now = new Date();
                    const isCurrentlyActive =
                      discount.is_active &&
                      new Date(discount.starts_at) <= now &&
                      new Date(discount.ends_at) >= now;

                    return (
                      <tr key={discount.id} className="hover:bg-gray-700/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{discount.name}</span>
                            {discount.is_flash && (
                              <span className="text-xs bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                                &#9889; Flash
                              </span>
                            )}
                          </div>
                          {discount.description && (
                            <p className="text-xs text-gray-500 mt-1">{discount.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {scopeLabels[discount.discount_scope]}
                          {discount.scope_id && (
                            <span className="block text-xs text-gray-500 font-mono mt-0.5">
                              {discount.scope_id.substring(0, 8)}...
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-white font-bold">
                          {formatValue(discount.discount_type, discount.discount_value)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {formatDate(discount.starts_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {formatDate(discount.ends_at)}
                        </td>
                        <td className="px-4 py-3">
                          {isCurrentlyActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 text-xs font-bold rounded-full">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                              Ativo
                            </span>
                          ) : discount.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs font-bold rounded-full">
                              Agendado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-900/30 text-gray-500 text-xs font-bold rounded-full">
                              Inativo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(discount)}
                              className="px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-bold rounded-lg transition-colors"
                            >
                              Editar
                            </button>
                            {discount.is_active && (
                              <button
                                onClick={() => handleDelete(discount.id)}
                                className="px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 text-xs font-bold rounded-lg transition-colors"
                              >
                                Desativar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
