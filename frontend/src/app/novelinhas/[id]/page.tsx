import { Metadata } from 'next';
import NovelinhaDetailClient from './NovelinhaDetailClient';
import { ogImageUrl } from '@/lib/ogImage';

interface NovelinhaPageProps {
  params: { id: string };
}

// Igor (24/05): página de detalhe da novelinha. Antes não existia rota
// `/novelinhas/[id]` — o card caía em `/movies/:id` e dava 404. Server
// component fino (com generateMetadata pro preview de link) que renderiza
// o componente client.
async function getNovelinha(id: string): Promise<any | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return null;
    const res = await fetch(`${apiUrl}/api/v1/content/novelinhas/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: NovelinhaPageProps): Promise<Metadata> {
  const n = await getNovelinha(params.id);
  if (!n) return { title: 'Novelinha não encontrada - Cine Vision' };

  const image = ogImageUrl(n.backdrop_url || n.thumbnail_url);
  const description = n.description || n.synopsis || undefined;

  return {
    title: `${n.title} - Cine Vision`,
    description,
    openGraph: {
      title: n.title,
      description,
      images: image
        ? [{ url: image, width: 1200, height: 630, alt: n.title }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: n.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function NovelinhaPage() {
  return <NovelinhaDetailClient />;
}
