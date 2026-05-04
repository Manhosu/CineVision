'use client';

// IMG_8846 — Funcionário com permissão `can_add_people_photos` cai aqui
// pra adicionar fotos a pessoas (atores/diretores) que ainda não têm
// foto cadastrada. Foto enviada vai para `photo_pending_url` e fica
// aguardando aprovação de admin antes de ir pro catálogo público.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import { uploadImageToSupabase } from '@/lib/supabaseStorage';

interface Person {
  id: string;
  name: string;
  role: string;
  photo_url: string | null;
  photo_pending_url: string | null;
}

export default function EmployeePhotosPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get<Person[]>(
        '/api/v1/admin/people?photo_status=missing',
      );
      setPeople(data);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao carregar pessoas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (person: Person, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem');
      return;
    }
    try {
      setUploadingId(person.id);
      const result = await uploadImageToSupabase(file, 'cinevision-capas', 'actors');
      if (result.error) {
        toast.error(`Erro no upload: ${result.error}`);
        return;
      }
      const submitRes = await api.post<{ status: string }>(
        `/api/v1/admin/people/${person.id}/photo`,
        { photo_url: result.publicUrl },
      );
      if (submitRes.status === 'pending') {
        toast.success('Foto enviada! Aguardando aprovação do admin.');
      } else {
        toast.success('Foto aprovada');
      }
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar foto');
    } finally {
      setUploadingId(null);
    }
  };

  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const getInitials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  return (
    <div className="mx-auto max-w-5xl p-6 text-white">
      <h1 className="mb-2 text-3xl font-bold">Pessoas sem foto</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Selecione uma foto para o ator/diretor. Após o envio, ela ficará pendente
        de aprovação do administrador antes de aparecer no catálogo.
      </p>

      <input
        type="text"
        placeholder="Buscar por nome..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6 w-full max-w-md rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 text-sm focus:border-red-500 focus:outline-none"
      />

      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900 p-8 text-center text-zinc-500">
          {search
            ? 'Nenhuma pessoa encontrada com esse nome.'
            : 'Todas as pessoas têm foto. Bom trabalho!'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((p) => {
            const isPending = !!p.photo_pending_url;
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 transition ${
                  isPending
                    ? 'border-amber-500/40 bg-amber-600/5'
                    : 'border-white/10 bg-zinc-900 hover:border-red-500/30'
                }`}
              >
                <div className="mb-3 flex h-24 w-24 mx-auto items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-purple-500/20 text-xl font-bold text-red-300">
                  {getInitials(p.name)}
                </div>
                <div className="text-center">
                  <div className="line-clamp-2 text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-zinc-500">
                    {p.role === 'director' ? 'Diretor' : 'Ator'}
                  </div>
                </div>

                <input
                  ref={(el) => { fileInputs.current[p.id] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(p, file);
                    e.target.value = '';
                  }}
                />

                {isPending ? (
                  <div className="mt-3 rounded-lg bg-amber-600/20 px-2 py-1 text-center text-[11px] text-amber-300">
                    Aguardando aprovação
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputs.current[p.id]?.click()}
                    disabled={uploadingId === p.id}
                    className="mt-3 w-full rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold transition hover:bg-red-500 disabled:opacity-60"
                  >
                    {uploadingId === p.id ? 'Enviando...' : 'Enviar foto'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
