'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, BookmarkIcon, ShareIcon, PlayIcon, EyeIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkOutline, FireIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { Movie } from '@/types/movie';
import AddToCartButton from '@/components/Cart/AddToCartButton';
import { getPresaleInfo, formatPresaleCountdown, formatPresaleReleaseAbsolute } from '@/lib/presale';
import DiscountHint from '@/components/Cart/DiscountHint';
import { useCartStore } from '@/stores/cartStore';
import { openContentGroup } from '@/lib/telegramAccess';
import { getBotDeeplink } from '@/lib/botDeeplink';

// Anônimo = não tem telegram_id salvo no localStorage. Usuários do
// bot fazem login e gravam telegram_id no blob `user`; visitantes
// vindos de WhatsApp/navegador externo nunca têm. Essa distinção
// decide se o botão "Comprar" abre o bot (telegram-logado) ou se
// gera Pix direto na web (anônimo).
function isAnonymousUser(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const u = localStorage.getItem('user');
    if (!u) return true;
    return !JSON.parse(u)?.telegram_id;
  } catch {
    return true;
  }
}

interface ContentHeroProps {
  content: Movie & {
    total_seasons?: number;
    total_episodes?: number;
  };
  backHref?: string;
  backLabel?: string;
  contentType?: 'movie' | 'series';
  /** If true, user owns this content */
  isOwned?: boolean;
  checkingOwnership?: boolean;
  onPlay?: () => void;
  onPurchase?: () => void;
}

export default function ContentHero({
  content,
  backHref = '/',
  backLabel = 'Voltar',
  contentType = 'movie',
  isOwned: isOwnedProp = false,
  checkingOwnership: checkingOwnershipProp = false,
  onPlay,
  onPurchase,
}: ContentHeroProps) {
  const [saved, setSaved] = useState(false);
  const [urgencyTimer, setUrgencyTimer] = useState('');
  const [fakeViewers, setFakeViewers] = useState(0);
  const [fakeUnits, setFakeUnits] = useState(0);
  const [buyingNow, setBuyingNow] = useState(false);

  const router = useRouter();
  const cartAdd = useCartStore((s) => s.add);
  const cartClear = useCartStore((s) => s.clear);
  const cartCheckout = useCartStore((s) => s.checkout);

  // The /movies/[id] page is a server component and never sets the
  // isOwned prop, so by default the hero shows "Comprar" + the
  // add-to-cart button even for content the user already paid for.
  // Run our own client-side check using the same endpoint the
  // homepage uses (/purchases/user/{id}/content), which works for
  // Telegram-authenticated users where /purchases/check/{id} doesn't
  // because that one requires a JWT user.sub on every request.
  const [ownedFromCheck, setOwnedFromCheck] = useState<boolean | null>(null);
  const isOwned = isOwnedProp || ownedFromCheck === true;
  const checkingOwnership = checkingOwnershipProp || ownedFromCheck === null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isOwnedProp) {
      // Parent already knows — skip the network round-trip.
      setOwnedFromCheck(true);
      return;
    }

    let cancelled = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('admin_token');

    if (!token) {
      setOwnedFromCheck(false);
      return;
    }

    const userStr = localStorage.getItem('user');
    let userId: string | null = null;
    try {
      if (userStr) userId = JSON.parse(userStr)?.id || null;
    } catch { /* malformed user blob */ }

    if (!userId) {
      setOwnedFromCheck(false);
      return;
    }

    fetch(`${apiUrl}/api/v1/purchases/user/${userId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => {
        if (cancelled) return;
        const owned = Array.isArray(items)
          ? items.some((c: any) => c?.id === content.id)
          : false;
        setOwnedFromCheck(owned);
      })
      .catch(() => {
        if (!cancelled) setOwnedFromCheck(false);
      });

    return () => {
      cancelled = true;
    };
  }, [content.id, isOwnedProp]);

  const isFlashPromo = content.is_flash_promo && content.promo_ends_at && content.discounted_price_cents;
  // Igor (04/06): pré-venda — declarado aqui em cima pra ficar acessível
  // pros handlers de compra (handleMainAction etc.).
  const presaleInfo = getPresaleInfo(content as any);
  const effectivePriceCents = presaleInfo.isPresale
    ? presaleInfo.effectivePriceCents
    : (content.discounted_price_cents && content.discounted_price_cents < content.price_cents
      ? content.discounted_price_cents
      : content.price_cents);

  // Simple hash from content ID for consistent pseudo-random per content
  const idHash = (content.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  // Urgency countdown: 2-4 min per content (seeded by content ID), resets on page visit
  const urgencyStartRef = useRef<number>(0);
  const urgencyDurationRef = useRef<number>(0);

  useEffect(() => {
    if (!isFlashPromo) return;
    // Duration: 2-4 min based on content ID hash
    const durationMs = (120 + (idHash % 120)) * 1000; // 120s-240s (2-4 min)
    urgencyDurationRef.current = durationMs;
    urgencyStartRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - urgencyStartRef.current;
      const remaining = Math.max(0, urgencyDurationRef.current - elapsed);
      if (remaining <= 0) {
        // Reset timer to simulate new urgency cycle
        urgencyStartRef.current = Date.now();
        urgencyDurationRef.current = (120 + (idHash % 120)) * 1000;
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setUrgencyTimer(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isFlashPromo, idHash]);

  // Igor (02/07): social proof + escassez também na pré-venda, não só no
  // flash promo. Ele viu que a página da pré-venda ficou "chapada" sem
  // sensação de urgência ("legal se tivesse tipo tanto de gente olhando
  // a publicação, estoque escasso pra pessoa achar que tá acabando").
  const showSocialProof = isFlashPromo || presaleInfo.isPresale;

  // Fake viewers — seeded by content ID for variation between content
  useEffect(() => {
    if (!showSocialProof) return;
    const base = 60 + (idHash % 50); // 60-109 base, different per content
    setFakeViewers(base);
    const id = setInterval(() => {
      setFakeViewers(prev => {
        const change = Math.floor(Math.random() * 9) - 4;
        return Math.max(40, Math.min(150, prev + change));
      });
    }, 4000 + (idHash % 3000));
    return () => clearInterval(id);
  }, [showSocialProof, idHash]);

  // Fake units — seeded by content ID
  useEffect(() => {
    if (!showSocialProof) return;
    const base = 3 + (idHash % 5); // 3-7, different per content
    setFakeUnits(base);
    const id = setInterval(() => {
      setFakeUnits(prev => Math.max(1, prev - (Math.random() > 0.65 ? 1 : 0)));
    }, 18000 + (idHash % 12000));
    return () => clearInterval(id);
  }, [showSocialProof, idHash]);

  // Igor (26/06): backdrop fica SEM transform pra não bagunçar o
  // backdrop_position que ele ajustou no painel admin. Backdrops têm
  // proporção variável (4K, 16:9, vertical pra mobile) e qualquer
  // resize=cover distorceria o enquadramento já configurado.
  const backdropUrl = content.backdrop_url || content.poster_url || content.thumbnail_url;
  const desktopPos = content.backdrop_position || '50% 50%';
  const mobilePos = content.backdrop_position_mobile || desktopPos;

  const formatDuration = (mins?: number) => {
    if (!mins) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: content.title, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    }
  };

  const handleSave = () => {
    setSaved(!saved);
    toast.success(saved ? 'Removido da lista' : 'Salvo na lista');
  };

  const handleMainAction = async () => {
    if (isOwned && onPlay) {
      onPlay();
      return;
    }
    if (!isOwned && onPurchase) {
      onPurchase();
      return;
    }
    if (isOwned) {
      // Já comprou — abre o grupo via helper (link direto pra link
      // de convite legado, ou single-use 24h pra Chat ID numérico).
      await openContentGroup(content.id, content.telegram_group_link);
      return;
    }

    // Igor (09/07): Cenário 3 mais amplo — se o filme tem bot promocional
    // vinculado (setado em /admin/content/[id]/edit) E o bot está ativo,
    // o botão Comprar leva DIRETO pro bot promo, independente da origem
    // do cliente. Assim toda venda desse filme aumenta interações reais
    // no bot promo → melhor ranking na busca do Telegram.
    //
    // Prioridade:
    //   1) Content tem promotional_bot vinculado + ativo → bot promo
    //   2) Cliente veio de bot promo (Cenário 1) → bot oficial via rotação
    //   3) Fluxo padrão (logado → bot oficial, anônimo → cart/checkout)
    if (typeof window !== 'undefined' && !isOwned) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const r = await fetch(
          `${apiUrl}/api/v1/telegrams/promo-bot-for-content?content=${encodeURIComponent(content.id)}`,
          { cache: 'no-store' }
        );
        if (r.ok) {
          const data = await r.json();
          if (data.available && data.username) {
            // Deep-link direto pro bot promo com o mesmo start=buy_ que ele
            // já sabe processar (handleBuyCallback intercepta lá dentro).
            const url = `https://t.me/${data.username}?start=buy_${content.id}`;
            window.open(url, '_blank');
            toast.success('Abrindo Telegram...', { duration: 2000 });
            return;
          }
        }
      } catch { /* fallback pros próximos branches */ }

      // Cenário 1 legado — cliente veio de bot promo (promo_link_capture).
      let promoBotSession: string | null = null;
      try {
        promoBotSession = sessionStorage.getItem('cv_promo_bot');
      } catch { /* incógnito */ }
      if (promoBotSession) {
        const url = await getBotDeeplink(`buy_${content.id}`);
        window.open(url, '_blank');
        toast.success('Abrindo Telegram...', { duration: 2000 });
        return;
      }
    }

    // Comprar: bifurca por estado de login.
    // Quem está logado com telegram_id segue pro fluxo histórico do
    // bot (deep link buy_<id>) — Igor opera vendas pelo bot e
    // mantém esse caminho intacto.
    // Quem é anônimo (sem telegram_id no localStorage) precisa de
    // um caminho que feche a venda na web: criamos uma order de 1
    // item via cart e mandamos pra /cart/checkout (que já gera Pix
    // e captura WhatsApp).
    if (!isAnonymousUser()) {
      // Igor (07/06): deeplink rotativo entre bots ativos.
      const url = await getBotDeeplink(`buy_${content.id}`);
      window.open(url, '_blank');
      toast.success('Abrindo Telegram...', { duration: 2000 });
      return;
    }

    if (buyingNow) return;
    setBuyingNow(true);
    try {
      // Pix direto na web: limpa o cart pra evitar arrastar itens
      // antigos do anônimo, adiciona só este filme e finaliza.
      // `clear` falha silenciosamente se o cart já estava vazio.
      try { await cartClear(); } catch { /* cart já vazio é ok */ }
      await cartAdd(content.id, {
        id: content.id,
        title: content.title,
        poster_url: content.poster_url || undefined,
        price_cents: effectivePriceCents,
        type: contentType,
      });
      const result = await cartCheckout('site');
      router.push(`/cart/checkout?token=${result.order.order_token}`);
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível iniciar a compra. Tente novamente.');
      setBuyingNow(false);
    }
  };

  // Parse genres
  let genres: string[] = [];
  if (content.genres) {
    if (Array.isArray(content.genres)) {
      genres = content.genres;
    } else if (typeof content.genres === 'string') {
      try { genres = JSON.parse(content.genres as string); }
      catch { genres = (content.genres as string).split(',').map(g => g.trim()); }
    }
  }

  const hasDiscount = content.discounted_price_cents && content.discounted_price_cents < content.price_cents;
  // Igor (04/06): alias da pré-venda já declarada em cima + countdown formatado.
  const presale = presaleInfo;
  const presaleCountdown = formatPresaleCountdown(presale.releaseAt);
  const presaleReleaseAbs = formatPresaleReleaseAbsolute(presale.releaseAt);

  return (
    <section className="relative w-full min-h-[100svh] flex flex-col">
      {/* Backdrop - fullscreen */}
      {backdropUrl && (
        <div className="absolute inset-0 z-0">
          {/* Desktop backdrop */}
          <img
            src={backdropUrl}
            alt=""
            className="hidden sm:block w-full h-full object-cover"
            style={{ objectPosition: desktopPos }}
            loading="eager"
          />
          {/* Mobile backdrop */}
          <img
            src={backdropUrl}
            alt=""
            className="block sm:hidden w-full h-full object-cover"
            style={{ objectPosition: mobilePos }}
            loading="eager"
          />
          {/* Cinematic gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/50 to-dark-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-dark-950/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-dark-950 to-transparent" />
        </div>
      )}

      {/* Back button - top */}
      <div className="relative z-20 pt-20 lg:pt-24 px-4 sm:px-6 lg:px-10 tv:px-16">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>{backLabel}</span>
        </Link>
      </div>

      {/* Content - anchored to bottom */}
      <div className="relative z-10 mt-auto px-4 sm:px-6 lg:px-10 tv:px-16 pb-10 sm:pb-14 lg:pb-16 tv:pb-20">
        <div className="max-w-4xl">
          {/* Rating badge */}
          {content.imdb_rating && (
            <div className="inline-flex items-center gap-1.5 mb-3 tv:mb-4">
              <div className="flex items-center gap-1 bg-yellow-500/20 backdrop-blur-sm px-2.5 py-1 rounded-md">
                <svg className="w-3.5 h-3.5 fill-yellow-400" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-yellow-400 text-sm font-semibold">{content.imdb_rating}</span>
              </div>
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl tv:text-7xl font-black text-white leading-[1.05] tracking-tight mb-4 tv:mb-5">
            {content.title}
          </h1>

          {/* Metadata line */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm sm:text-base tv:text-lg text-white/60 mb-4 tv:mb-5">
            {content.release_year && (
              <span>{content.release_year}</span>
            )}
            {content.age_rating && (
              <span className="border border-white/30 text-white/80 px-1.5 py-0 rounded text-xs sm:text-sm font-medium">
                {content.age_rating}
              </span>
            )}
            {contentType === 'series' && content.total_seasons ? (
              <span>{content.total_seasons} {content.total_seasons === 1 ? 'Temporada' : 'Temporadas'}</span>
            ) : formatDuration(content.duration_minutes) ? (
              <span>{formatDuration(content.duration_minutes)}</span>
            ) : null}
            {content.quality_label && (
              <span className="border border-white/30 text-white/80 px-1.5 py-0 rounded text-xs sm:text-sm font-medium">
                {content.quality_label}
              </span>
            )}
            {content.audio_type && (
              <span className={`px-1.5 py-0 rounded text-xs sm:text-sm font-medium ${
                content.audio_type === 'dubbed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                content.audio_type === 'subtitled' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-green-500/20 text-green-400 border border-green-500/30'
              }`}>
                {content.audio_type === 'dubbed' ? 'Dublado' :
                 content.audio_type === 'subtitled' ? 'Legendado' :
                 'Dub · Leg'}
              </span>
            )}
          </div>

          {/* Genres */}
          {genres.length > 0 && (
            <p className="text-white/50 text-sm sm:text-base tv:text-lg mb-5 tv:mb-6 italic">
              {genres.join(' · ')}
            </p>
          )}

          {/* Description */}
          {content.description && (
            <p className="text-white/70 text-sm sm:text-base tv:text-lg leading-relaxed mb-6 tv:mb-8 max-w-2xl line-clamp-3">
              {content.description}
            </p>
          )}

          {/* Flash Promo Banner */}
          {isFlashPromo && !isOwned && urgencyTimer && (
            <div className="mb-4 max-w-md">
              <div className="bg-gradient-to-r from-amber-600/20 via-red-600/20 to-amber-600/20 border border-amber-500/40 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">&#9889;</span>
                  <span className="text-amber-400 text-sm font-black uppercase tracking-wide">Oferta Relâmpago</span>
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">{content.discount_percentage}% OFF</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-red-400 font-bold">
                      <FireIcon className="w-3.5 h-3.5" />
                      Termina em {urgencyTimer}
                    </span>
                    <span className="flex items-center gap-1 text-amber-400/80">
                      <EyeIcon className="w-3.5 h-3.5" />
                      {fakeViewers} vendo
                    </span>
                  </div>
                  <span className="text-red-300 font-semibold">{fakeUnits} restantes</span>
                </div>
              </div>
            </div>
          )}

          {/* Price tag — centralizado acima do CTA pra ancorar a
              decisão de compra. Antes ficava no meio da row de
              botões e perdia hierarquia visual. Só aparece quando
              o usuário ainda não comprou — quem já tem o filme só
              vê "Assistir". */}
          {/* Igor (04/06): Badge grande de PRÉ-VENDA + countdown — chama atenção forte */}
          {!isOwned && !checkingOwnership && presale.isPresale && (
            <div className="mb-3 sm:mb-4 flex flex-col items-center text-center gap-2">
              <div className="inline-flex items-center gap-2 bg-amber-500 text-black text-sm sm:text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-full shadow-xl shadow-amber-500/30">
                🎟 Pré-venda Exclusiva
                {presale.discountPercent && (
                  <span className="bg-black/20 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    -{presale.discountPercent}%
                  </span>
                )}
              </div>
              {/* Igor (02/07): trocou countdown relativo ("Em 1 dia") por
                  data absoluta em destaque — deixa claro que é PREVISÃO
                  (pode antecipar/atrasar) e fixa uma data que o cliente
                  marca na agenda. Fallback pro countdown se admin não
                  cadastrou data. */}
              {presaleReleaseAbs ? (
                <div className="inline-flex flex-col items-center gap-0.5 px-4 py-2 bg-amber-500/10 border border-amber-400/30 rounded-lg">
                  <span className="text-amber-300/80 text-[10px] sm:text-xs uppercase tracking-wider font-semibold">
                    📅 Previsão de lançamento
                  </span>
                  <span className="text-amber-200 text-sm sm:text-base font-bold">
                    {presaleReleaseAbs}
                  </span>
                </div>
              ) : presaleCountdown ? (
                <span className="text-amber-300 text-xs sm:text-sm font-medium">⏱ Previsão: {presaleCountdown.toLowerCase()}</span>
              ) : null}
            </div>
          )}

          {!isOwned && !checkingOwnership && (
            <div className="mb-3 sm:mb-4 flex flex-col items-center text-center">
              {presale.isPresale && presale.originalPriceCents ? (
                // Igor (áudio 02/07): pediu preço antigo riscado AO LADO
                // do preço promo, não empilhado acima. Fica mais claro
                // visualmente que é uma promoção.
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-amber-400 font-bold text-2xl sm:text-3xl">
                    {formatPrice(presale.effectivePriceCents)}
                  </span>
                  <span className="text-white/40 line-through text-sm sm:text-base">
                    {formatPrice(presale.originalPriceCents)}
                  </span>
                </div>
              ) : hasDiscount ? (
                <>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-white/40 line-through text-sm">{formatPrice(content.price_cents)}</span>
                    <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">
                      {content.discount_percentage}% OFF
                    </span>
                  </div>
                  <span className="text-green-400 font-bold text-2xl sm:text-3xl">
                    {formatPrice(content.discounted_price_cents!)}
                  </span>
                </>
              ) : (
                <span className="text-white font-bold text-2xl sm:text-3xl">
                  {formatPrice(content.price_cents)}
                </span>
              )}
            </div>
          )}

          {/* Igor (04/06): aviso explicativo pra pré-venda — copy forte. */}
          {!isOwned && !checkingOwnership && presale.isPresale && (
            <div className="mb-3 sm:mb-4 px-3 py-2 bg-amber-500/10 border border-amber-400/30 rounded-lg text-xs sm:text-sm text-amber-200 max-w-lg mx-auto sm:mx-0">
              <strong className="text-amber-300">Garante seu acesso AGORA com desconto exclusivo.</strong> Você já entra no grupo do filme pra acompanhar — assim que liberar, recebe notificação automática no Telegram. Sem stress.
            </div>
          )}

          {/* Igor (vídeo 02/07): social proof + escassez também na pré-venda
              pra gerar desejo/urgência. Usa os mesmos fakeViewers/fakeUnits
              que já rodam pro flash promo — só é gated com showSocialProof. */}
          {!isOwned && !checkingOwnership && presale.isPresale && (
            <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-xs sm:text-sm max-w-lg mx-auto sm:mx-0">
              <span className="inline-flex items-center gap-1.5 text-amber-300/90">
                <EyeIcon className="w-4 h-4" />
                <span><strong>{fakeViewers}</strong> pessoas olhando essa publicação agora</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-red-300 font-semibold">
                🔥 Só faltam <strong>{fakeUnits}</strong> unidades!
              </span>
            </div>
          )}

          {/* Igor (21/05): aviso de acesso vitalício. Cliente achava que era
              aluguel (tempo limitado) e adiava a compra → venda perdida.
              Linguagem simples, sem a palavra "vitalício". */}
          {!isOwned && !checkingOwnership && (
            <div className="mb-3 sm:mb-4 flex items-center justify-center sm:justify-start gap-1.5 text-xs sm:text-sm text-green-400 font-medium">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Acesso para sempre — assista quantas vezes quiser</span>
            </div>
          )}

          {/* Actions row — N7 (Igor 04/05): em mobile, centralizar a row
              pra que o botão "Comprar" alinhe visualmente com o preço
              que já fica centralizado. Em sm+ volta pro layout original
              (alinhado à esquerda) que combina com o título da hero. */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4">
            {/* Main CTA */}
            {checkingOwnership ? (
              <div className="h-12 w-40 bg-white/10 rounded-xl animate-pulse" />
            ) : (
              <button
                onClick={handleMainAction}
                disabled={buyingNow}
                className={`flex items-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold text-base sm:text-lg transition-all duration-200 disabled:cursor-wait disabled:opacity-70 ${
                  isOwned
                    ? 'bg-white text-dark-950 hover:bg-white/90 shadow-lg shadow-white/20'
                    : presale.isPresale
                      ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/40'
                      : isFlashPromo
                        ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white hover:from-amber-600 hover:to-red-700 shadow-lg shadow-red-600/30 animate-[pulse_2s_ease-in-out_infinite]'
                        : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/30'
                }`}
              >
                {!presale.isPresale && <PlayIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
                {isOwned
                  ? 'Assistir'
                  : buyingNow
                    ? 'Processando...'
                    : presale.isPresale
                      // Igor (02/07): pediu que apareça o preço embutido no
                      // botão pra reforçar o valor promocional ("Garantir
                      // Pré-Venda · R$ 6,90").
                      ? `🎟 Garantir Pré-Venda · ${formatPrice(presale.effectivePriceCents)}`
                      : isFlashPromo
                        ? 'Comprar Agora'
                        : 'Comprar'}
              </button>
            )}

            {/* Add to cart (only if not owned) */}
            {!isOwned && !checkingOwnership && (
              <AddToCartButton
                content={{
                  id: content.id,
                  title: content.title,
                  poster_url: content.poster_url || undefined,
                  price_cents: presale.isPresale
                    ? presale.effectivePriceCents
                    : (hasDiscount ? content.discounted_price_cents! : content.price_cents),
                  type: contentType,
                }}
                variant="hero"
              />
            )}

            {/* Cart discount incentive hint */}
            {!isOwned && <DiscountHint className="ml-auto sm:ml-0" />}

            {/* Secondary actions */}
            <button
              onClick={handleSave}
              className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all"
              title="Salvar"
            >
              {saved ? (
                <BookmarkIcon className="w-5 h-5 text-primary-500" />
              ) : (
                <BookmarkOutline className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={handleShare}
              className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all"
              title="Compartilhar"
            >
              <ShareIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
