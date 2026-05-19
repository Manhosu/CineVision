import { Metadata } from 'next';
import SeriesDetailClient from './SeriesDetailClient';
import { ogImageUrl } from '@/lib/ogImage';

interface SeriesPageProps {
  params: { id: string };
}

// Igor (18/05): a página de série era 100% 'use client', então o Next não
// gerava `generateMetadata` — ao compartilhar o link no WhatsApp/Facebook
// não aparecia backdrop nenhum (só filme funcionava, porque /movies/[id]
// já era server component). Agora a página é um server component fino que
// gera as meta tags Open Graph e renderiza o componente client.
async function getSeries(id: string): Promise<any | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return null;
    const res = await fetch(`${apiUrl}/api/v1/content/series/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: SeriesPageProps): Promise<Metadata> {
  const series = await getSeries(params.id);
  if (!series) return { title: 'Série não encontrada - Cine Vision' };

  // Igor (18/05): og:image via proxy que força JPEG — WhatsApp não renderiza WebP.
  const image = ogImageUrl(series.backdrop_url || series.thumbnail_url);
  const description = series.description || series.synopsis || undefined;

  return {
    title: `${series.title} - Cine Vision`,
    description,
    openGraph: {
      title: series.title,
      description,
      images: image
        ? [{ url: image, width: 1200, height: 630, alt: series.title }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: series.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function SeriesPage() {
  return <SeriesDetailClient />;
}
