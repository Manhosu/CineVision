import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { MovieCard } from '@/components/MovieCard/MovieCard';
import { Movie } from '@/types/movie';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface Person {
  id: string;
  name: string;
  role: string;
  photo_url?: string;
  bio?: string;
  contents: Movie[];
}

interface PersonPageProps {
  params: { id: string };
}

async function getPerson(id: string): Promise<Person | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return null;
    const res = await fetch(`${apiUrl}/api/v1/content/people/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

export async function generateMetadata({ params }: PersonPageProps): Promise<Metadata> {
  const person = await getPerson(params.id);
  if (!person) return { title: 'Pessoa nao encontrada - Cine Vision' };

  return {
    title: `${person.name} - Cine Vision`,
    description: person.bio || `Veja todos os filmes e series com ${person.name}`,
    openGraph: {
      title: person.name,
      description: person.bio || `Filmografia de ${person.name}`,
      ...(person.photo_url && {
        images: [{ url: person.photo_url, width: 400, height: 400, alt: person.name }],
      }),
    },
  };
}

export default async function PersonPage({ params }: PersonPageProps) {
  const person = await getPerson(params.id);
  if (!person) notFound();

  const roleLabel =
    person.role === 'director'
      ? 'Diretor(a)'
      : person.role === 'actor'
        ? 'Ator / Atriz'
        : person.role;

  return (
    <>
      <Header />

      <main className="bg-dark-950 min-h-screen pt-24 lg:pt-28">
        {/* Back button */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Voltar
          </Link>
        </div>

        {/* Person header */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 mb-12">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            {/* Photo / Initials */}
            <div className="relative flex-shrink-0 w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden ring-2 ring-white/10 shadow-2xl">
              {person.photo_url ? (
                <Image
                  src={person.photo_url}
                  alt={person.name}
                  fill
                  className="object-cover"
                  sizes="176px"
                  priority
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center">
                  <span className="text-white font-bold text-4xl sm:text-5xl select-none drop-shadow">
                    {getInitials(person.name)}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2">
                {person.name}
              </h1>
              <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-white/70 text-sm font-medium mb-4">
                {roleLabel}
              </span>
              {person.bio && (
                <p className="text-white/60 text-sm sm:text-base leading-relaxed max-w-2xl">
                  {person.bio}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Content grid */}
        {person.contents && person.contents.length > 0 && (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pb-16">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">
              Filmografia ({person.contents.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 lg:gap-6">
              {person.contents.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </section>
        )}

        {(!person.contents || person.contents.length === 0) && (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pb-16">
            <p className="text-white/40 text-center py-12">
              Nenhum conteudo encontrado para esta pessoa.
            </p>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
