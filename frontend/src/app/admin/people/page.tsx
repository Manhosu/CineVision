'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  Trash2,
  Pencil,
  Plus,
  X,
  Upload,
  Users,
  Film,
  Clapperboard,
  User,
  Camera,
} from 'lucide-react';
import { uploadImageToSupabase } from '@/lib/supabaseStorage';

interface Person {
  id: string;
  name: string;
  role: string;
  photo_url: string | null;
  bio: string | null;
  content_count: number;
  created_at: string;
  updated_at: string;
}

type FilterTab = 'all' | 'actor' | 'director';

const EMPTY_FORM = { name: '', role: 'actor', bio: '', photo_url: '' };

export default function PeopleManagePage() {
  const router = useRouter();

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortOrder, setSortOrder] = useState<'name' | 'recent'>('name');

  // Create / Edit form
  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);

  // ---------- Helpers ----------
  const getToken = () =>
    localStorage.getItem('access_token') || localStorage.getItem('auth_token');

  const apiHeaders = (json = true) => {
    const h: Record<string, string> = {};
    const token = getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  };

  // ---------- Fetch ----------
  const fetchPeople = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/people`,
        { headers: apiHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setPeople(data);
      } else {
        console.error(`API Error ${response.status}`);
        setPeople([]);
      }
    } catch (error) {
      console.error('Error fetching people:', error);
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  // ---------- Photo upload ----------
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    try {
      setUploading(true);
      const result = await uploadImageToSupabase(file, 'cinevision-capas', 'actors');
      if (result.error) {
        alert(`Erro no upload: ${result.error}`);
        return;
      }
      setForm((prev) => ({ ...prev, photo_url: result.publicUrl }));
    } catch (err) {
      console.error('Upload error:', err);
      alert('Erro ao fazer upload da foto');
    } finally {
      setUploading(false);
    }
  };

  // ---------- Create / Update ----------
  const openCreateForm = () => {
    setEditingPerson(null);
    setForm(EMPTY_FORM);
    setPhotoPreview(null);
    setShowForm(true);
  };

  const openEditForm = (person: Person) => {
    setEditingPerson(person);
    setForm({
      name: person.name,
      role: person.role,
      bio: person.bio || '',
      photo_url: person.photo_url || '',
    });
    setPhotoPreview(person.photo_url || null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('O nome e obrigatorio.');
      return;
    }

    try {
      setSaving(true);

      const body: Record<string, string | undefined> = {
        name: form.name.trim(),
        role: form.role,
        bio: form.bio || undefined,
        photo_url: form.photo_url || undefined,
      };

      const isEdit = !!editingPerson;
      const url = isEdit
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/people/${editingPerson!.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/people`;

      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert(isEdit ? 'Pessoa atualizada com sucesso!' : 'Pessoa criada com sucesso!');
        setShowForm(false);
        setEditingPerson(null);
        setForm(EMPTY_FORM);
        setPhotoPreview(null);
        await fetchPeople();
      } else {
        const errText = await response.text();
        try {
          const errJson = JSON.parse(errText);
          alert(`Erro: ${errJson.message || errText}`);
        } catch {
          alert(`Erro: ${response.status} ${response.statusText}\n${errText}`);
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Erro ao salvar pessoa');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Delete ----------
  const handleDelete = (person: Person) => {
    setDeleteTarget(person);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/people/${deleteTarget.id}`,
        { method: 'DELETE', headers: apiHeaders() }
      );
      if (response.ok) {
        alert(`${deleteTarget.name} removido(a) com sucesso!`);
        await fetchPeople();
      } else {
        const errText = await response.text();
        alert(`Erro ao deletar: ${errText}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Erro de rede ao deletar');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  // ---------- Filtering ----------
  const filteredPeople = people
    .filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'all' || p.role === activeTab;
      return matchesSearch && matchesTab;
    })
    .sort((a, b) => {
      if (sortOrder === 'recent') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      return a.name.localeCompare(b.name);
    });

  const stats = {
    total: people.length,
    actors: people.filter((p) => p.role === 'actor').length,
    directors: people.filter((p) => p.role === 'director').length,
  };

  // ---------- Initials helper ----------
  const getInitials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: stats.total },
    { key: 'actor', label: 'Atores', count: stats.actors },
    { key: 'director', label: 'Diretores', count: stats.directors },
  ];

  return (
    <div className="min-h-screen bg-dark-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar para Admin
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              Gerenciar Pessoas
            </h1>
            <p className="text-gray-400 mt-2">Atores e diretores do catalogo</p>
          </div>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            Nova Pessoa
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-primary-400" />
              <div>
                <p className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                  {stats.total}
                </p>
                <p className="text-sm text-gray-400 mt-1">Total de Pessoas</p>
              </div>
            </div>
          </div>
          <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-blue-400" />
              <div>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  {stats.actors}
                </p>
                <p className="text-sm text-gray-400 mt-1">Atores</p>
              </div>
            </div>
          </div>
          <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <Clapperboard className="w-6 h-6 text-purple-400" />
              <div>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {stats.directors}
                </p>
                <p className="text-sm text-gray-400 mt-1">Diretores</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filter Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-800/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-primary-500/20 text-primary-400 border-b-2 border-primary-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'name' | 'recent')}
            className="bg-dark-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="name">A-Z</option>
            <option value="recent">Recentes primeiro</option>
          </select>
        </div>

        {/* People Table */}
        <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Foto</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Nome</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Funcao</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Conteudos</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPeople.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      {searchTerm || activeTab !== 'all'
                        ? 'Nenhuma pessoa encontrada com os filtros aplicados.'
                        : 'Nenhuma pessoa cadastrada ainda.'}
                    </td>
                  </tr>
                ) : (
                  filteredPeople.map((person) => (
                    <tr key={person.id} className="hover:bg-white/5 transition-colors">
                      {/* Photo / Initials */}
                      <td className="px-6 py-4">
                        {person.photo_url ? (
                          <img
                            src={person.photo_url}
                            alt={person.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-white/10"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 border-2 border-white/10 flex items-center justify-center text-sm font-bold text-primary-300">
                            {getInitials(person.name)}
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{person.name}</div>
                        {person.bio && (
                          <div className="text-sm text-gray-400 mt-1 line-clamp-1 max-w-xs">
                            {person.bio}
                          </div>
                        )}
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        {person.role === 'actor' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                            <User className="w-3 h-3" />
                            Ator
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                            <Clapperboard className="w-3 h-3" />
                            Diretor
                          </span>
                        )}
                      </td>

                      {/* Content count */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-300">
                          <Film className="w-4 h-4 text-gray-500" />
                          {person.content_count}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditForm(person)}
                            className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(person)}
                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            title="Deletar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================== CREATE / EDIT MODAL ==================== */}
        {showForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 border border-white/10 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">
                  {editingPerson ? 'Editar Pessoa' : 'Nova Pessoa'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingPerson(null);
                    setForm(EMPTY_FORM);
                    setPhotoPreview(null);
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Photo Upload */}
              <div className="mb-6 flex flex-col items-center">
                <div
                  className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-dashed border-white/20 hover:border-primary-400 transition-colors cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoPreview || form.photo_url ? (
                    <img
                      src={photoPreview || form.photo_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-dark-700 flex flex-col items-center justify-center text-gray-400 group-hover:text-primary-400 transition-colors">
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-xs">Foto</span>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <p className="text-xs text-gray-500 mt-2">Clique para enviar foto</p>
              </div>

              {/* Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Nome *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome completo"
                  className="w-full bg-dark-700/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              {/* Role */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Funcao
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full bg-dark-700/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="actor">Ator / Atriz</option>
                  <option value="director">Diretor(a)</option>
                </select>
              </div>

              {/* Bio */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Biografia
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder="Breve biografia..."
                  rows={4}
                  className="w-full bg-dark-700/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingPerson(null);
                    setForm(EMPTY_FORM);
                    setPhotoPreview(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-dark-700 text-white hover:bg-dark-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || uploading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : editingPerson ? (
                    'Salvar Alteracoes'
                  ) : (
                    'Criar Pessoa'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== DELETE CONFIRMATION MODAL ==================== */}
        {showDeleteConfirm && deleteTarget && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">Confirmar Exclusao</h3>
              <p className="text-gray-300 mb-2">
                Tem certeza que deseja excluir <strong>{deleteTarget.name}</strong>?
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Esta acao ira remover a pessoa e desvincular de todos os conteudos associados.
                {deleteTarget.content_count > 0 && (
                  <span className="block mt-1 text-yellow-400">
                    Esta pessoa esta vinculada a {deleteTarget.content_count} conteudo(s).
                  </span>
                )}
              </p>
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
      </div>
    </div>
  );
}
