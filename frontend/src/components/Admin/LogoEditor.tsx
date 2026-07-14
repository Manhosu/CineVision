'use client';

/**
 * Igor (14/07): editor do logo PNG oficial do filme no hero.
 *
 * Clone estrutural do BackdropEditor com 3 diferenças:
 * 1. Preview compõe backdrop (fundo) + logo (foreground absoluto)
 * 2. Slider de SCALE (50-150%) além da posição X/Y
 * 3. Modelo de posicionamento IDÊNTICO ao runtime: `position: absolute`
 *    com `left/top: X% Y%` + `transform: translate(-50%, -50%)` + `width: N%`.
 *    Assim o drag no editor corresponde 1:1 ao que aparece no site.
 *    (Diferente do backdrop que usa object-position em img cover.)
 *
 * Igor (15/07): refactor pra preview FIEL do runtime — não é mais um
 * "mock genérico" com "2026 · 14 · 2h 15min · Comprar". Agora renderiza
 * uma cópia estrutural do ContentHero (backdrop com objectPosition +
 * gradientes reais + rating + logo + presale + metadata + sinopse +
 * preço com regra igual + CTA com texto real). Igor arrasta e vê
 * exatamente onde vai aparecer.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getPresaleInfo, formatPresaleCountdown, formatPresaleReleaseAbsolute } from '@/lib/presale';

interface Position { x: number; y: number; }
interface Snapshot { pos: Position; scale: number; }

// Igor (15/07): subset do Content usado pra montar preview fiel.
export interface LogoEditorContent {
  title: string;
  description?: string | null;
  imdb_rating?: number | null;
  release_year?: number | null;
  age_rating?: string | null;
  duration_minutes?: number | null;
  quality_label?: string | null;
  audio_type?: string | null;
  is_presale?: boolean;
  presale_price_cents?: number | null;
  presale_release_at?: string | null;
  price_cents: number;
  backdrop_position?: string;
  backdrop_position_mobile?: string;
  genres?: string[];
}

interface LogoEditorProps {
  logoUrl: string;
  backdropUrl?: string;
  content: LogoEditorContent;
  initialDesktop?: Snapshot;
  initialMobile?: Snapshot;
  onSave: (desktop: Snapshot, mobile: Snapshot) => void;
  onClose: () => void;
}

type ActiveTab = 'desktop' | 'mobile';

// ---------- Helpers de formatação ----------

function formatDuration(mins?: number | null): string | null {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// ---------- Preview fiel ----------

function DraggableLogoPreview({
  logoUrl,
  backdropUrl,
  content,
  position,
  scale,
  onChange,
  aspectRatio,
  width,
  label,
  isMobile,
}: {
  logoUrl: string;
  backdropUrl?: string;
  content: LogoEditorContent;
  position: Position;
  scale: number;
  onChange: (pos: Position) => void;
  aspectRatio: string;
  width?: string;
  label: string;
  isMobile?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const move = useCallback((clientX: number, clientY: number) => {
    if (!dragging || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    onChange({ x, y });
  }, [dragging, onChange]);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY); };
    const onEnd = () => setDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [dragging, move]);

  // Presale via mesmo helper do runtime — texto do CTA/preço bate 1:1.
  const presale = getPresaleInfo({
    is_presale: content.is_presale,
    presale_price_cents: content.presale_price_cents,
    presale_release_at: content.presale_release_at,
    price_cents: content.price_cents,
  });
  const presaleReleaseAbs = formatPresaleReleaseAbsolute(presale.releaseAt);
  const presaleCountdown = formatPresaleCountdown(presale.releaseAt);

  const backdropPos = isMobile
    ? (content.backdrop_position_mobile || content.backdrop_position || '50% 50%')
    : (content.backdrop_position || '50% 50%');

  const duration = formatDuration(content.duration_minutes);
  const genres = content.genres || [];

  // Escalas de fonte compactas — a área do preview é bem menor que a real.
  // Desktop (aspect 16/7 dentro do modal max-w-5xl): fator ~0.46 vs 1920px.
  // Mobile (300×533): fator ~0.79 vs viewport real 375-390px.
  const T = isMobile
    ? {
        backLabel: 'text-[8px]',
        rating: 'text-[9px]',
        ratingIcon: 'w-2 h-2',
        logoHeight: 'h-16',
        titleFallback: 'text-2xl',
        presaleBadge: 'text-[10px] px-2 py-0.5',
        presaleSubBadge: 'text-[8px] px-1 py-0',
        presaleReleaseLabel: 'text-[7px]',
        presaleReleaseVal: 'text-[10px]',
        presaleCountdown: 'text-[9px]',
        metadata: 'text-[9px] gap-x-1.5 gap-y-1',
        metaBadge: 'text-[8px] px-1 py-0',
        genres: 'text-[9px]',
        description: 'text-[9px] line-clamp-2 leading-snug',
        priceMain: 'text-lg',
        priceSub: 'text-[9px]',
        priceOff: 'text-[8px] px-1.5 py-0',
        presaleInfo: 'text-[8px] px-2 py-1',
        socialProof: 'text-[8px] gap-x-2',
        forever: 'text-[9px] gap-1',
        foreverIcon: 'w-3 h-3',
        cta: 'text-[9px] px-2 py-1.5 gap-1.5 rounded-md',
        ctaIcon: 'w-3 h-3',
        secondary: 'w-6 h-6',
        secondaryIcon: 'w-3 h-3',
        contentPad: 'px-3 pb-3',
        contentBottomGrad: 'h-16',
        maxContent: 'max-w-[95%]',
      }
    : {
        backLabel: 'text-[9px]',
        rating: 'text-[10px]',
        ratingIcon: 'w-2.5 h-2.5',
        logoHeight: 'h-20',
        titleFallback: 'text-2xl',
        presaleBadge: 'text-[10px] px-2.5 py-1',
        presaleSubBadge: 'text-[8px] px-1 py-0',
        presaleReleaseLabel: 'text-[7px]',
        presaleReleaseVal: 'text-[10px]',
        presaleCountdown: 'text-[9px]',
        metadata: 'text-[10px] gap-x-2 gap-y-1',
        metaBadge: 'text-[9px] px-1 py-0',
        genres: 'text-[10px]',
        description: 'text-[10px] line-clamp-2 leading-snug',
        priceMain: 'text-xl',
        priceSub: 'text-[10px]',
        priceOff: 'text-[8px] px-1.5 py-0',
        presaleInfo: 'text-[9px] px-2 py-1',
        socialProof: 'text-[9px] gap-x-2.5',
        forever: 'text-[10px] gap-1',
        foreverIcon: 'w-3 h-3',
        cta: 'text-xs px-3 py-1.5 gap-1.5 rounded-lg',
        ctaIcon: 'w-3.5 h-3.5',
        secondary: 'w-7 h-7',
        secondaryIcon: 'w-3.5 h-3.5',
        contentPad: 'px-4 pb-4',
        contentBottomGrad: 'h-24',
        maxContent: 'max-w-2xl',
      };

  // CTA text — mesma regra do runtime, sem ownership/checkingOwnership/flash.
  const ctaText = presale.isPresale
    ? `🎟 Garantir Pré-Venda · ${formatPrice(presale.effectivePriceCents)}`
    : 'Comprar';
  const ctaClass = presale.isPresale
    ? 'bg-amber-500 text-black'
    : 'bg-primary-600 text-white';

  return (
    <div style={{ width: width || '100%' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
        <span className="text-xs text-white/30 font-mono">
          {Math.round(position.x)}% {Math.round(position.y)}% · {scale}%
        </span>
      </div>
      <div
        ref={ref}
        className="relative rounded-xl overflow-hidden cursor-crosshair select-none border-2 border-white/10 hover:border-white/20 transition-colors bg-dark-950"
        style={{ aspectRatio }}
        onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
        onTouchStart={() => setDragging(true)}
      >
        {/* Backdrop layer — usa objectPosition igual runtime */}
        {backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ objectPosition: backdropPos }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-dark-800 to-dark-950 pointer-events-none" />
        )}

        {/* Gradientes idênticos ao ContentHero */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/50 to-dark-950/20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-950/70 via-transparent to-transparent pointer-events-none" />
        <div className={`absolute bottom-0 left-0 right-0 ${T.contentBottomGrad} bg-gradient-to-t from-dark-950 to-transparent pointer-events-none`} />

        {/* Back button ghost — top-left, só visual */}
        <div className={`absolute top-2 left-2 sm:top-3 sm:left-3 inline-flex items-center gap-1 text-white/70 ${T.backLabel} pointer-events-none`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Voltar</span>
        </div>

        {/* Content anchored bottom-left — flex column mt-auto */}
        <div className={`absolute inset-0 flex flex-col pointer-events-none`}>
          <div className={`mt-auto ${T.contentPad} ${T.maxContent}`}>
            {/* Rating badge */}
            {content.imdb_rating != null && (
              <div className="inline-flex items-center gap-1 mb-1.5">
                <div className="flex items-center gap-0.5 bg-yellow-500/20 backdrop-blur-sm px-1.5 py-0.5 rounded">
                  <svg className={`${T.ratingIcon} fill-yellow-400`} viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className={`text-yellow-400 ${T.rating} font-semibold`}>
                    {content.imdb_rating}
                  </span>
                </div>
              </div>
            )}

            {/* Logo container — altura fixa igual runtime (h-40 desktop / h-24 mobile
                escalados pro preview → h-20 / h-16). O logo é position:absolute
                DENTRO desse container, mas o drag é sobre o preview inteiro
                (mais intuitivo pro Igor). */}
            <div className={`relative w-full ${T.logoHeight} mb-1.5`}>
              {/* Placeholder pra visualizar a área do container */}
              <div className="absolute inset-0 pointer-events-none" />
            </div>

            {/* Presale badge — MESMO estilo do ContentHero, escalado */}
            {presale.isPresale && (
              <div className="mb-1.5 flex flex-col items-start gap-1">
                <div className={`inline-flex items-center gap-1 bg-amber-500 text-black ${T.presaleBadge} font-bold uppercase tracking-wider rounded-full`}>
                  🎟 Pré-venda
                  {presale.discountPercent != null && (
                    <span className={`bg-black/20 text-black ${T.presaleSubBadge} font-bold rounded-full`}>
                      -{presale.discountPercent}%
                    </span>
                  )}
                </div>
                {presaleReleaseAbs ? (
                  <div className={`inline-flex flex-col items-start ${T.presaleInfo} bg-amber-500/10 border border-amber-400/30 rounded`}>
                    <span className={`text-amber-300/80 ${T.presaleReleaseLabel} uppercase tracking-wider font-semibold`}>
                      📅 Previsão
                    </span>
                    <span className={`text-amber-200 ${T.presaleReleaseVal} font-bold`}>
                      {presaleReleaseAbs}
                    </span>
                  </div>
                ) : presaleCountdown ? (
                  <span className={`text-amber-300 ${T.presaleCountdown} font-medium`}>
                    ⏱ {presaleCountdown}
                  </span>
                ) : null}
              </div>
            )}

            {/* Metadata line */}
            <div className={`flex flex-wrap items-center ${T.metadata} text-white/60 mb-1.5`}>
              {content.release_year && <span>{content.release_year}</span>}
              {content.age_rating && (
                <span className={`border border-white/30 text-white/80 ${T.metaBadge} rounded font-medium`}>
                  {content.age_rating}
                </span>
              )}
              {duration && <span>{duration}</span>}
              {content.quality_label && (
                <span className={`border border-white/30 text-white/80 ${T.metaBadge} rounded font-medium`}>
                  {content.quality_label}
                </span>
              )}
              {content.audio_type && (
                <span className={`${T.metaBadge} rounded font-medium ${
                  content.audio_type === 'dubbed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  content.audio_type === 'subtitled' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  'bg-green-500/20 text-green-400 border border-green-500/30'
                }`}>
                  {content.audio_type === 'dubbed' ? 'Dub' :
                   content.audio_type === 'subtitled' ? 'Leg' :
                   'Dub·Leg'}
                </span>
              )}
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <p className={`text-white/50 ${T.genres} italic mb-1.5`}>
                {genres.join(' · ')}
              </p>
            )}

            {/* Description */}
            {content.description && (
              <p className={`text-white/70 ${T.description} mb-2 max-w-[95%]`}>
                {content.description}
              </p>
            )}

            {/* Preço — mesma lógica presale > desconto > cheio */}
            <div className="mb-2 flex flex-col items-center text-center">
              {presale.isPresale && presale.originalPriceCents ? (
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className={`text-amber-400 font-bold ${T.priceMain}`}>
                    {formatPrice(presale.effectivePriceCents)}
                  </span>
                  <span className={`text-white/40 line-through ${T.priceSub}`}>
                    {formatPrice(presale.originalPriceCents)}
                  </span>
                </div>
              ) : (
                <span className={`text-white font-bold ${T.priceMain}`}>
                  {formatPrice(content.price_cents)}
                </span>
              )}
            </div>

            {/* Acesso pra sempre */}
            <div className={`mb-2 flex items-center justify-center sm:justify-start ${T.forever} text-green-400 font-medium`}>
              <svg className={`${T.foreverIcon} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Acesso para sempre</span>
            </div>

            {/* Actions row */}
            <div className="flex items-center justify-center sm:justify-start gap-1.5">
              <div className={`inline-flex items-center ${T.cta} font-bold ${ctaClass}`}>
                {!presale.isPresale && (
                  <svg className={T.ctaIcon} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
                <span className="whitespace-nowrap">{ctaText}</span>
              </div>
              <div className={`${T.secondary} rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white`}>
                <svg className={T.secondaryIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div className={`${T.secondary} rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white`}>
                <svg className={T.secondaryIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Logo layer — modelo idêntico ao runtime:
            absolute + left/top % + translate(-50%,-50%) + width: scale%.
            Renderizado POR CIMA da UI simulada pra ficar sempre visível
            enquanto o Igor arrasta. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          className="absolute h-auto object-contain pointer-events-none drop-shadow-2xl"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: `${scale}%`,
            maxWidth: '95%',
            transform: 'translate(-50%, -50%)',
          }}
          draggable={false}
        />

        {/* Crosshair no centro do logo */}
        <div
          className="absolute w-6 h-6 border-2 border-white rounded-full pointer-events-none"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 2px rgba(0,0,0,0.6), 0 0 12px rgba(255,255,255,0.3)',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Presets adaptados pra logo (cantos e centro fazem sentido)
const PRESETS: { label: string; x: number; y: number }[] = [
  { label: 'Sup-Esq', x: 20, y: 30 },
  { label: 'Sup-Dir', x: 80, y: 30 },
  { label: 'Centro', x: 50, y: 50 },
  { label: 'Inf-Esq', x: 20, y: 70 },
  { label: 'Inf-Dir', x: 80, y: 70 },
];

const SCALE_MIN = 50;
const SCALE_MAX = 150;

export default function LogoEditor({
  logoUrl,
  backdropUrl,
  content,
  initialDesktop = { pos: { x: 50, y: 50 }, scale: 100 },
  initialMobile,
  onSave,
  onClose,
}: LogoEditorProps) {
  const [desktop, setDesktop] = useState<Snapshot>(initialDesktop);
  const [mobile, setMobile] = useState<Snapshot>(initialMobile || initialDesktop);
  const [tab, setTab] = useState<ActiveTab>('desktop');

  const active = tab === 'desktop' ? desktop : mobile;
  const setActive = tab === 'desktop' ? setDesktop : setMobile;

  const setPos = (pos: Position) => setActive({ ...active, pos });
  const setScale = (scale: number) => setActive({ ...active, scale });

  // ESC pra fechar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white">Ajustar Logo — {content.title}</h3>
            <p className="text-xs text-white/40">Arraste pra posicionar · use o slider pro tamanho · desktop e celular separados</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none px-2">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setTab('desktop')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all relative ${
              tab === 'desktop' ? 'text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2"/><path d="M8 21h8M12 17v4" strokeWidth="2"/></svg>
              Desktop
            </span>
            {tab === 'desktop' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
          </button>
          <button
            onClick={() => setTab('mobile')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all relative ${
              tab === 'mobile' ? 'text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" strokeWidth="2"/><path d="M12 18h.01" strokeWidth="2" strokeLinecap="round"/></svg>
              Mobile
            </span>
            {tab === 'mobile' && <div className="absolute bottom-0 left-0 h-0.5 bg-primary-500 right-0" />}
          </button>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto p-5">
          {tab === 'desktop' ? (
            <DraggableLogoPreview
              logoUrl={logoUrl}
              backdropUrl={backdropUrl}
              content={content}
              position={desktop.pos}
              scale={desktop.scale}
              onChange={setPos}
              aspectRatio="16/9"
              label="Como aparece no desktop / tablet"
            />
          ) : (
            <div className="flex justify-center">
              <DraggableLogoPreview
                logoUrl={logoUrl}
                backdropUrl={backdropUrl}
                content={content}
                position={mobile.pos}
                scale={mobile.scale}
                onChange={setPos}
                aspectRatio="9/16"
                width="300px"
                label="Como aparece no celular"
                isMobile
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-5 py-3 border-t border-white/10 space-y-3">
          {/* Scale slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/40 uppercase tracking-wider">Tamanho</span>
              <span className="text-xs text-white/60 font-mono">{active.scale}%</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={SCALE_MIN}
                max={SCALE_MAX}
                step={5}
                value={active.scale}
                onChange={(e) => setScale(parseInt(e.target.value, 10))}
                className="flex-1 accent-primary-500"
              />
              <button
                type="button"
                onClick={() => setScale(100)}
                className="text-[10px] text-white/40 hover:text-white/70 uppercase tracking-wider"
              >
                reset
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-white/30 mr-1">Atalhos:</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPos({ x: p.x, y: p.y })}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  Math.abs(active.pos.x - p.x) < 5 && Math.abs(active.pos.y - p.y) < 5
                    ? 'bg-primary-600 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => { onSave(desktop, mobile); onClose(); }}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-all"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
