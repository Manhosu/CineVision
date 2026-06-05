/**
 * Igor (18/05): WhatsApp e Facebook NÃO renderizam o preview de link quando a
 * `og:image` é WebP — e os backdrops do Cine Vision são quase todos `.webp`
 * (~424 de ~480 conteúdos). Resultado: ao compartilhar o link, não aparece
 * imagem nenhuma (o filme "Obsessão", que tem backdrop `.jpeg`, funcionava;
 * as séries, com backdrop `.webp`, não).
 *
 * Igor (05/06): substituído o proxy externo `images.weserv.nl` por endpoint
 * próprio em `/api/og-image`. Twitter/Facebook ficavam com cache colado e
 * algumas plataformas tratam proxies externos com desconfiança. Servindo
 * via nosso próprio domínio (cinevisionapp.com.br) o crawler trata como
 * imagem normal e re-puxa quando o cache TTL expira.
 *
 * O endpoint /api/og-image converte WebP→JPEG via sharp e mantém JPEGs/PNGs
 * em passthrough. Cache forte na resposta pro CDN não bater no Supabase a
 * cada preview gerado.
 *
 * @param rawUrl  URL original do backdrop/thumbnail (pode ser webp)
 * @returns URL JPEG pronta pra og:image, ou undefined se não houver imagem.
 */

const FRONTEND_ORIGIN = 'https://www.cinevisionapp.com.br';

export function ogImageUrl(rawUrl?: string | null): string | undefined {
  const url = (rawUrl || '').trim();
  if (!url) return undefined;
  return `${FRONTEND_ORIGIN}/api/og-image?url=${encodeURIComponent(url)}`;
}
