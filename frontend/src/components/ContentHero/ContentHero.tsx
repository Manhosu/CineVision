'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, BookmarkIcon, ShareIcon, PlayIcon, EyeIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkOutline, FireIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { Movie } from '@/types/movie';

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
  isOwned = false,
  checkingOwnership = false,
  onPlay,
  onPurchase,
}: ContentHeroProps) {
  const [saved, setSaved] = useState(false);
  const [urgencyTimer, setUrgencyTimer] = useState('');
  const [fakeViewers, setFakeViewers] = useState(0);
  const [fakeUnits, setFakeUnits] = useState(0);

  const isFlashPromo = content.is_flash_promo && content.promo_ends_at && content.discounted_price_cents;

  // Urgency: compressed countdown (shows less time than real to create urgency)
  useEffect(() => {
    if (!isFlashPromo || !content.promo_ends_at) return;
    const tick = () => {
      const realDiff = new Date(content.promo_ends_at!).getTime() - Date.now();
      if (realDiff <= 0) { setUrgencyTimer(''); return; }
      // Compress: show max 5 min even if real time is more
      const displayDiff = Math.min(realDiff, 5 * 60 * 1000);
      const m = Math.floor(displayDiff / 60000);
      const s = Math.floor((displayDiff % 60000) / 1000);
      setUrgencyTimer(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isFlashPromo, content.promo_ends_at]);

  // Fake viewers that fluctuate (60-120 range)
  useEffect(() => {
    if (!isFlashPromo) return;
    setFakeViewers(Math.floor(Math.random() * 40) + 70);
    const id = setInterval(() => {
      setFakeViewers(prev => {
        const change = Math.floor(Math.random() * 11) - 5; // -5 to +5
        return Math.max(55, Math.min(130, prev + change));
      });
    }, 3000 + Math.random() * 4000);
    return () => clearInterval(id);
  }, [isFlashPromo]);

  // Fake units remaining (3-7, slowly decreasing)
  useEffect(() => {
    if (!isFlashPromo) return;
    setFakeUnits(Math.floor(Math.random() * 3) + 5); // 5-7
    const id = setInterval(() => {
      setFakeUnits(prev => Math.max(2, prev - (Math.random() > 0.6 ? 1 : 0)));
    }, 15000 + Math.random() * 20000);
    return () => clearInterval(id);
  }, [isFlashPromo]);

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

  const handleMainAction = () => {
    if (isOwned && onPlay) {
      onPlay();
    } else if (!isOwned && onPurchase) {
      onPurchase();
    } else {
      // Default: open Telegram
      const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cinevisionv2bot';
      if (isOwned && content.telegram_group_link) {
        window.open(content.telegram_group_link, '_blank');
      } else {
        window.open(`https://t.me/${botUsername}?start=buy_${content.id}`, '_blank');
        toast.success('Abrindo Telegram...', { duration: 2000 });
      }
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

          {/* Actions row */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Main CTA */}
            {checkingOwnership ? (
              <div className="h-12 w-40 bg-white/10 rounded-xl animate-pulse" />
            ) : (
              <button
                onClick={handleMainAction}
                className={`flex items-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold text-base sm:text-lg transition-all duration-200 ${
                  isOwned
                    ? 'bg-white text-dark-950 hover:bg-white/90 shadow-lg shadow-white/20'
                    : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/30'
                }`}
              >
                <PlayIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                {isOwned ? 'Assistir' : 'Comprar'}
              </button>
            )}

            {/* Price tag */}
            <div className="flex flex-col">
              {hasDiscount ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 line-through text-sm">{formatPrice(content.price_cents)}</span>
                    <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">
                      {content.discount_percentage}% OFF
                    </span>
                  </div>
                  <span className="text-green-400 font-bold text-xl sm:text-2xl">
                    {formatPrice(content.discounted_price_cents!)}
                  </span>
                </>
              ) : (
                <span className="text-white font-bold text-xl sm:text-2xl">
                  {formatPrice(content.price_cents)}
                </span>
              )}
            </div>

            {/* Flash Promo Urgency Block */}
            {isFlashPromo && !isOwned && (
              <div className="flex flex-col gap-1.5 px-3 py-2 bg-red-950/40 border border-red-500/30 rounded-xl animate-[pulse_3s_ease-in-out_infinite]">
                {urgencyTimer && (
                  <div className="flex items-center gap-1.5 text-red-400 text-sm font-bold">
                    <FireIcon className="w-4 h-4" />
                    <span>Termina em {urgencyTimer}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                  <EyeIcon className="w-3.5 h-3.5" />
                  <span>{fakeViewers} pessoas vendo agora</span>
                </div>
                <div className="text-red-300 text-xs font-semibold">
                  Apenas {fakeUnits} unidades restantes
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="hidden sm:block w-px h-10 bg-white/10" />

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
