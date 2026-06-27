/**
 * Igor (26/06): pôsteres upados grandes (1-2MB em WEBP) demoravam carregar
 * e davam "tela preta" na página de detalhes do filme. Supabase Storage tem
 * endpoint de transform (/render/image/) que redimensiona + comprime sob
 * demanda. Esse helper detecta URLs do Supabase e devolve a variante
 * otimizada. URLs de outros domínios passam inalteradas.
 *
 * Exemplo:
 *   storage/v1/object/public/cinevision-capas/posters/x.webp (1.8MB)
 *   → storage/v1/render/image/public/cinevision-capas/posters/x.webp?width=400&quality=70 (225KB)
 */
export function optimizeStorageUrl(
  url: string | null | undefined,
  opts?: { width?: number; quality?: number },
): string {
  if (!url) return '';
  if (!url.includes('supabase.co/storage/v1/object/public/')) return url;
  const width = opts?.width ?? 600;
  const quality = opts?.quality ?? 75;
  const transformed = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/',
  );
  // Sem resize=cover — mantém proporção original do upload pra não distorcer
  // nem cortar a imagem. O CSS do consumidor cuida do enquadramento.
  return `${transformed}?width=${width}&quality=${quality}`;
}

/** Preset pra pôsteres do catálogo (cards menores). */
export const posterUrl = (url: string | null | undefined) =>
  optimizeStorageUrl(url, { width: 400, quality: 75 });

/** Preset pra backdrops/heroes (banners grandes mas comprimidos). */
export const backdropUrl = (url: string | null | undefined) =>
  optimizeStorageUrl(url, { width: 1200, quality: 80 });
