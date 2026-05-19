/**
 * Igor (18/05): WhatsApp e Facebook NÃO renderizam o preview de link quando a
 * `og:image` é WebP — e os backdrops do Cine Vision são quase todos `.webp`
 * (~424 de ~480 conteúdos). Resultado: ao compartilhar o link, não aparece
 * imagem nenhuma (o filme "Obsessão", que tem backdrop `.jpeg`, funcionava;
 * as séries, com backdrop `.webp`, não).
 *
 * `ogImageUrl` envolve a URL da imagem no proxy `images.weserv.nl` — um
 * serviço de imagem gratuito e amplamente usado — que força a saída em JPEG
 * (`output=jpg`) e redimensiona pro tamanho ideal de Open Graph (1200x630).
 *
 * Bônus: como a URL final muda, isso também fura o cache de preview que o
 * WhatsApp já tinha guardado (sem imagem) das séries compartilhadas antes.
 *
 * @param rawUrl  URL original do backdrop/thumbnail (pode ser webp)
 * @returns URL JPEG pronta pra og:image, ou undefined se não houver imagem.
 */
export function ogImageUrl(rawUrl?: string | null): string | undefined {
  const url = (rawUrl || '').trim();
  if (!url) return undefined;
  return `https://images.weserv.nl/?url=${encodeURIComponent(
    url,
  )}&w=1200&h=630&fit=cover&output=jpg`;
}
