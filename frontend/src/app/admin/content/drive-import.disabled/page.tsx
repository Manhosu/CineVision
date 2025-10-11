'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface DriveImportProgress {
  stage: string;
  progress: number;
  message: string;
  error?: string;
  s3Url?: string;
  fileSize?: number;
}

interface Category {
  id: string;
  name: string;
}

// Gêneros disponíveis
const AVAILABLE_GENRES = [
  'Ação',
  'Aventura',
  'Animação',
  'Comédia',
  'Crime',
  'Documentary',
  'Drama',
  'Fantasia',
  'Ficção Científica',
  'Guerra',
  'História',
  'Horror',
  'Música',
  'Mistério',
  'Romance',
  'Suspense',
  'Thriller',
  'Western',
  'Família',
];

export default function DriveImportPage() {
  const router = useRouter();

  // Form fields
  const [driveUrl, setDriveUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [priceReais, setPriceReais] = useState('0');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string>('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [director, setDirector] = useState('');
  const [cast, setCast] = useState('');
  const [imdbRating, setImdbRating] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [uploadIds, setUploadIds] = useState<string[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, DriveImportProgress>>(new Map());

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (uploadIds.length === 0) return;

    const intervals: NodeJS.Timeout[] = [];

    uploadIds.forEach((uploadId) => {
      const interval = setInterval(async () => {
        try {
          const token = localStorage.getItem('auth_token');
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/drive-import/progress/${uploadId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const progressData = await response.json();
            setProgressMap(prev => new Map(prev).set(uploadId, progressData));

            if (progressData.stage === 'completed' || progressData.stage === 'failed') {
              clearInterval(interval);
            }
          }
        } catch (error) {
          console.error(`Erro ao buscar progresso de ${uploadId}:`, error);
        }
      }, 2000);

      intervals.push(interval);
    });

    return () => intervals.forEach(i => clearInterval(i));
  }, [uploadIds]);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  const handlePosterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPosterFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPosterPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPoster = async (): Promise<string | null> => {
    if (!posterFile) return null;

    setIsUploadingPoster(true);
    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('file', posterFile);
      formData.append('imageType', 'poster');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/api/images/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        return result.publicUrl || result.url;
      } else {
        console.error('Erro ao fazer upload do poster');
        return null;
      }
    } catch (error) {
      console.error('Erro ao fazer upload do poster:', error);
      return null;
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!driveUrl || !title) {
      alert('Por favor, preencha pelo menos o Link do Google Drive e o Título');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Fazer upload do poster primeiro (se houver)
      let posterUrl = '';
      if (posterFile) {
        const uploadedUrl = await uploadPoster();
        if (uploadedUrl) {
          posterUrl = uploadedUrl;
        } else {
          alert('Erro ao fazer upload do poster. Continuando sem poster.');
        }
      }

      // 2. Criar filme e iniciar importação
      const token = localStorage.getItem('auth_token');

      const priceCents = Math.round(parseFloat(priceReais || '0') * 100);

      const payload = {
        drive_url: driveUrl,
        title,
        description: description || undefined,
        synopsis: synopsis || undefined,
        price_cents: priceCents,
        poster_url: posterUrl || undefined,
        trailer_url: trailerUrl || undefined,
        release_year: releaseYear ? parseInt(releaseYear) : undefined,
        director: director || undefined,
        cast: cast ? cast.split(',').map(c => c.trim()) : undefined,
        imdb_rating: imdbRating ? parseFloat(imdbRating) : undefined,
        duration_minutes: durationMinutes ? parseInt(durationMinutes) : undefined,
        genres: selectedGenres.length > 0 ? selectedGenres : undefined,
        category_ids: selectedCategories.length > 0 ? selectedCategories : undefined,
        is_featured: isFeatured,
        type: 'movie',
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/drive-import/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.uploadIds) {
          setUploadIds(result.uploadIds);
          alert(`Filme criado! Importando ${result.totalFiles} vídeo(s)...\nOs tipos de áudio serão detectados automaticamente.`);
        } else if (result.uploadId) {
          setUploadIds([result.uploadId]);
          alert('Filme criado e importação iniciada!');
        }
      } else {
        alert(`Erro: ${result.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao criar filme:', error);
      alert('Erro ao criar filme e iniciar importação');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  return (
    <div className="min-h-screen bg-dark-900 p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-6 text-primary-500 hover:text-primary-400 flex items-center gap-2"
        >
          ← Voltar
        </button>

        <div className="bg-dark-800 rounded-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Criar Filme via Google Drive</h1>
          <p className="text-gray-400">
            Crie um novo filme e importe os vídeos diretamente do Google Drive.
            O sistema detectará automaticamente os tipos de áudio (dublado/legendado/original).
          </p>
        </div>

        <form onSubmit={handleImport} className="bg-dark-800 rounded-lg p-6 space-y-6">
          {/* Google Drive Link */}
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
            <h2 className="text-xl font-semibold text-white mb-4">📁 Link do Google Drive</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Link da Pasta *
              </label>
              <input
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                required
                disabled={isLoading || uploadIds.length > 0}
              />
              <p className="text-xs text-gray-500 mt-1">
                Cole o link da pasta do Google Drive contendo os vídeos
              </p>
            </div>
          </div>

          {/* Informações Básicas */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">📄 Informações Básicas</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Superman"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                  required
                  disabled={isLoading || uploadIds.length > 0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição Curta
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição resumida do filme"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                  disabled={isLoading || uploadIds.length > 0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sinopse Completa
                </label>
                <textarea
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="Sinopse detalhada do filme..."
                  rows={4}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                  disabled={isLoading || uploadIds.length > 0}
                />
              </div>
            </div>
          </div>

          {/* Poster */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">🖼️ Poster</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Upload do Poster
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePosterChange}
                disabled={isLoading || uploadIds.length > 0 || isUploadingPoster}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-500 file:text-white hover:file:bg-primary-600"
              />
              {posterPreview && (
                <div className="mt-4">
                  <img
                    src={posterPreview}
                    alt="Preview do poster"
                    className="max-w-xs h-auto rounded-lg border border-dark-600"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Detalhes do Filme */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">🎬 Detalhes do Filme</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Preço (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={priceReais}
                  onChange={(e) => setPriceReais(e.target.value)}
                  placeholder="19.90"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                  disabled={isLoading || uploadIds.length > 0}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {parseFloat(priceReais) > 0 ? `R$ ${parseFloat(priceReais).toFixed(2)}` : 'Grátis'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ano de Lançamento
                </label>
                <input
                  type="number"
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value)}
                  placeholder="2025"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                  disabled={isLoading || uploadIds.length > 0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Duração (minutos)
                </label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="120"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                  disabled={isLoading || uploadIds.length > 0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Diretor
                </label>
                <input
                  type="text"
                  value={director}
                  onChange={(e) => setDirector(e.target.value)}
                  placeholder="Nome do diretor"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                  disabled={isLoading || uploadIds.length > 0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nota IMDB
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={imdbRating}
                  onChange={(e) => setImdbRating(e.target.value)}
                  placeholder="8.5"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                  disabled={isLoading || uploadIds.length > 0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL do Trailer
                </label>
                <input
                  type="url"
                  value={trailerUrl}
                  onChange={(e) => setTrailerUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                  disabled={isLoading || uploadIds.length > 0}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Elenco (separado por vírgulas)
                </label>
                <input
                  type="text"
                  value={cast}
                  onChange={(e) => setCast(e.target.value)}
                  placeholder="Ator 1, Ator 2, Ator 3"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-white"
                  disabled={isLoading || uploadIds.length > 0}
                />
              </div>
            </div>
          </div>

          {/* Gêneros */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">🎭 Gêneros</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {AVAILABLE_GENRES.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  disabled={isLoading || uploadIds.length > 0}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedGenres.includes(genre)
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Categorias */}
          {categories.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">🏷️ Categorias</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    disabled={isLoading || uploadIds.length > 0}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategories.includes(category.id)
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opções */}
          <div>
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                disabled={isLoading || uploadIds.length > 0}
                className="w-4 h-4 text-primary-500 bg-dark-700 border-dark-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm">Marcar como destaque</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || uploadIds.length > 0 || isUploadingPoster}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploadingPoster ? 'Fazendo upload do poster...' : isLoading ? 'Criando e Importando...' : 'Criar Filme e Importar Vídeos'}
          </button>
        </form>

        {/* Progress Display */}
        {uploadIds.length > 0 && (
          <div className="bg-dark-800 rounded-lg p-6 mt-6">
            <h2 className="text-2xl font-bold text-white mb-4">Status das Importações</h2>
            <div className="space-y-6">
              {uploadIds.map((uploadId) => {
                const progress = progressMap.get(uploadId);
                if (!progress) {
                  return (
                    <div key={uploadId} className="space-y-4 border-b border-dark-700 pb-4 last:border-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Upload:</span>
                        <span className="font-mono text-xs text-white">{uploadId.split('-').pop()}</span>
                      </div>
                      <p className="text-gray-400">Inicializando...</p>
                    </div>
                  );
                }

                return (
                  <div key={uploadId} className="space-y-4 border-b border-dark-700 pb-4 last:border-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Upload:</span>
                      <span className="font-mono text-xs text-white">{uploadId.split('-').pop()}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Estágio:</span>
                      <span className="text-white font-medium">{progress.stage}</span>
                    </div>

                    {progress.stage !== 'completed' && progress.stage !== 'failed' && (
                      <>
                        <div className="w-full bg-dark-700 rounded-full h-2">
                          <div
                            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Progresso:</span>
                          <span className="text-white">{progress.progress.toFixed(1)}%</span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Mensagem:</span>
                      <span className="text-white">{progress.message}</span>
                    </div>

                    {progress.fileSize && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Tamanho:</span>
                        <span className="text-white">{(progress.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    )}

                    {progress.stage === 'completed' && progress.s3Url && (
                      <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-green-500 font-medium">✓ Upload concluído com sucesso!</p>
                      </div>
                    )}

                    {progress.error && (
                      <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-500 font-medium">✗ Erro no upload</p>
                        <p className="text-xs text-gray-400 mt-1">{progress.error}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-dark-800 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">📖 Como Usar</h3>
          <ol className="space-y-2 text-gray-300 text-sm">
            <li>1. Faça upload dos vídeos para uma pasta no Google Drive</li>
            <li>2. Configure o compartilhamento para "Qualquer pessoa com o link pode visualizar"</li>
            <li>3. Cole o link da pasta no campo acima</li>
            <li>4. Preencha as informações do filme e faça upload do poster</li>
            <li>5. Selecione os gêneros e categorias</li>
            <li>6. O sistema detectará automaticamente os tipos de áudio:
              <ul className="ml-4 mt-1 space-y-1 text-gray-400">
                <li>• Arquivos com "dublad" ou "dubbed" → Dublado</li>
                <li>• Arquivos com "legendad" ou "subtitle" → Legendado</li>
                <li>• Arquivos com "original" → Original</li>
              </ul>
            </li>
            <li>7. Clique em "Criar Filme e Importar Vídeos"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
