'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface PersonEntry {
  id: string;
  name: string;
  photo_url?: string;
  role: string;
}

interface CastSectionProps {
  cast?: string | string[];
  director?: string;
  people?: PersonEntry[];
}

function parseCast(cast?: string | string[]): string[] {
  if (!cast) return [];
  if (Array.isArray(cast)) return cast.map(s => s.trim()).filter(Boolean);
  try {
    const parsed = cast.startsWith('[') ? JSON.parse(cast) : null;
    if (Array.isArray(parsed)) return parsed.map((s: string) => s.trim()).filter(Boolean);
  } catch { /* ignore */ }
  return cast.split(',').map(s => s.trim()).filter(Boolean);
}

const COLORS = [
  'from-red-500 to-red-700',
  'from-blue-500 to-blue-700',
  'from-emerald-500 to-emerald-700',
  'from-purple-500 to-purple-700',
  'from-amber-500 to-amber-700',
  'from-pink-500 to-pink-700',
  'from-indigo-500 to-indigo-700',
  'from-teal-500 to-teal-700',
  'from-orange-500 to-orange-700',
  'from-cyan-500 to-cyan-700',
  'from-rose-500 to-rose-700',
  'from-violet-500 to-violet-700',
  'from-lime-500 to-lime-700',
  'from-fuchsia-500 to-fuchsia-700',
  'from-sky-500 to-sky-700',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

export default function CastSection({ cast, director, people }: CastSectionProps) {
  const actors = parseCast(cast);
  const hasPeople = people && people.length > 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const updateScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    updateScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScroll, { passive: true });
    const ro = new ResizeObserver(updateScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScroll); ro.disconnect(); };
  }, [actors, people]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -el.clientWidth * 0.6 : el.clientWidth * 0.6, behavior: 'smooth' });
  };

  const handleImgError = (id: string) => {
    setImgErrors((prev) => ({ ...prev, [id]: true }));
  };

  const showItems = hasPeople || actors.length > 0;

  if (!showItems && !director) return null;

  return (
    <div className="py-8 tv:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 tv:px-16">
        <div className="flex items-baseline gap-4 mb-5 tv:mb-7">
          <h2 className="text-lg sm:text-xl tv:text-2xl font-bold text-white">
            Elenco
          </h2>
          {director && (
            <span className="text-white/40 text-sm tv:text-base">
              Direcao: <span className="text-white/60">{director}</span>
            </span>
          )}
        </div>

        {showItems && (
          <div className="relative group/cast">
            {/* Arrows */}
            {canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-dark-950/80 backdrop-blur border border-white/10 items-center justify-center text-white/70 hover:text-white hover:bg-dark-800 transition-all opacity-0 group-hover/cast:opacity-100"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => scroll('right')}
                className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-dark-950/80 backdrop-blur border border-white/10 items-center justify-center text-white/70 hover:text-white hover:bg-dark-800 transition-all opacity-0 group-hover/cast:opacity-100"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            )}

            <div
              ref={scrollRef}
              className="flex gap-5 sm:gap-6 tv:gap-8 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* Rich people mode: photos + clickable links */}
              {hasPeople &&
                people!.map((person, i) => {
                  const showPhoto = person.photo_url && !imgErrors[person.id];
                  return (
                    <Link
                      key={person.id}
                      href={`/people/${person.id}`}
                      className="flex-shrink-0 w-[72px] sm:w-[88px] tv:w-[104px] text-center snap-start group/person"
                    >
                      <div className="relative w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] tv:w-[104px] tv:h-[104px] rounded-full overflow-hidden mx-auto mb-2.5 shadow-lg ring-2 ring-transparent group-hover/person:ring-white/30 transition-all">
                        {showPhoto ? (
                          <Image
                            src={person.photo_url!}
                            alt={person.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover/person:scale-110"
                            sizes="104px"
                            onError={() => handleImgError(person.id)}
                          />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${COLORS[i % COLORS.length]} flex items-center justify-center`}>
                            <span className="text-white font-bold text-xl sm:text-2xl tv:text-3xl select-none drop-shadow">
                              {getInitials(person.name)}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-white/80 text-xs sm:text-sm tv:text-base font-medium leading-snug line-clamp-2 group-hover/person:text-white transition-colors">
                        {person.name}
                      </p>
                    </Link>
                  );
                })}

              {/* Fallback: plain cast strings (no links, colored initials) */}
              {!hasPeople &&
                actors.map((name, i) => (
                  <div
                    key={`${name}-${i}`}
                    className="flex-shrink-0 w-[72px] sm:w-[88px] tv:w-[104px] text-center snap-start"
                  >
                    <div className={`w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] tv:w-[104px] tv:h-[104px] rounded-full bg-gradient-to-br ${COLORS[i % COLORS.length]} flex items-center justify-center mx-auto mb-2.5 shadow-lg`}>
                      <span className="text-white font-bold text-xl sm:text-2xl tv:text-3xl select-none drop-shadow">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-white/80 text-xs sm:text-sm tv:text-base font-medium leading-snug line-clamp-2">
                      {name}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
