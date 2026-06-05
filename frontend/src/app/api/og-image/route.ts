// Igor (05/06): proxy próprio de OG image. Antes usava images.weserv.nl,
// mas Twitter/Facebook ficavam com cache colado e algumas plataformas
// tratam proxies externos com desconfiança. Servindo via nosso próprio
// domínio (cinevisionapp.com.br) os crawlers respeitam normalmente.
//
// O endpoint:
// 1. Aceita só URLs do storage do Supabase do projeto (whitelist) — sem
//    SSRF.
// 2. Se a imagem original já é JPEG/PNG, faz passthrough (rápido).
// 3. Se for WebP (a maioria dos backdrops), converte com sharp pra JPEG
//    1200x630 — formato que TODOS os crawlers de OG renderizam.
// 4. Cache HTTP forte pra CDN edge não bater no Supabase a cada preview.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_HOST_PREFIX = 'https://szghyvnbmjlquznxhqum.supabase.co/';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get('url');
  if (!src) {
    return new Response('Missing url', { status: 400 });
  }
  if (!src.startsWith(ALLOWED_HOST_PREFIX)) {
    return new Response('Forbidden', { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(src, { cache: 'no-store' });
  } catch {
    return new Response('Upstream fetch failed', { status: 502 });
  }
  if (!upstream.ok) {
    return new Response('Upstream ' + upstream.status, { status: 502 });
  }

  const upstreamCT = (upstream.headers.get('content-type') || '').toLowerCase();
  const arr = await upstream.arrayBuffer();
  let body: Buffer = Buffer.from(arr);
  let outCT = 'image/jpeg';

  const needsConversion =
    upstreamCT.includes('webp') ||
    upstreamCT.includes('avif') ||
    upstreamCT.includes('png');

  if (needsConversion) {
    try {
      const sharpMod = await import('sharp');
      const sharp = sharpMod.default;
      body = await sharp(body)
        .resize(1200, 630, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    } catch (err: any) {
      // Se sharp falhar por qualquer motivo, devolve o original.
      // Pior caso: WebP/AVIF não rendera em alguns clientes — mesmo
      // estado de antes do fix. Nunca devolver 500 aqui.
      outCT = upstreamCT || 'application/octet-stream';
    }
  } else if (upstreamCT) {
    outCT = upstreamCT;
  }

  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': outCT,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
