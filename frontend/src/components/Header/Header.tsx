'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Movie } from '@/types/movie';
import {
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
  ShoppingBagIcon,
  FilmIcon,
  HomeIcon,
  TvIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface HeaderProps {
  transparent?: boolean;
  hasFlashBanner?: boolean;
}

export function Header({ transparent = false, hasFlashBanner = false }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActiveLink = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  // Live search - debounced
  const liveSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const [moviesRes, seriesRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/content/movies?search=${encodeURIComponent(query)}&limit=5`, { cache: 'no-store' }),
        fetch(`${API_URL}/api/v1/content/series?search=${encodeURIComponent(query)}&limit=5`, { cache: 'no-store' }),
      ]);
      const moviesData = moviesRes.ok ? await moviesRes.json() : { movies: [] };
      const seriesData = seriesRes.ok ? await seriesRes.json() : { movies: [] };
      const combined = [...(moviesData.movies || []), ...(seriesData.movies || [])].slice(0, 8);
      setSearchResults(combined);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => liveSearch(value), 100);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Verificar se usuário tem telegram_id (autologin do Telegram)
  const isTelegramUser = isAuthenticated && user?.telegram_id;

  const navigationItems = [
    { label: 'Início', href: '/', icon: HomeIcon },
    { label: 'Filmes', href: '/movies', icon: FilmIcon },
    { label: 'Séries', href: '/series', icon: TvIcon },
    { label: 'Categorias', href: '/categories', icon: Squares2X2Icon },
    ...(isTelegramUser ? [
      { label: 'Minhas Compras', href: '/dashboard', icon: ShoppingBagIcon },
      { label: 'Fazer Pedido', onClick: () => window.open('https://t.me/m/YAU1-zMrZDcx', '_blank'), icon: FilmIcon }
    ] : [])
  ];

  return (
    <>
      <header
        className={`fixed left-0 right-0 z-50 transition-all duration-700 ease-in-out ${
          hasFlashBanner ? 'top-10' : 'top-0'
        } ${
          isScrolled
            ? 'bg-black shadow-lg'
            : 'bg-transparent'
        }`}
      >
        {/* Gradiente sutil no topo apenas quando não scrollado */}
        {!isScrolled && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none"></div>
        )}

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="flex items-center justify-between h-20 lg:h-24">
            {/* Logo estilo Netflix - Simples e Clean */}
            <Link
              href="/"
              className="flex items-center focus:outline-none"
            >
              <Image
                src="/CINEVT.png"
                alt="Cine Vision"
                width={450}
                height={135}
                priority
                className="h-14 md:h-20 lg:h-24 xl:h-28 w-auto transition-opacity duration-200 hover:opacity-80"
              />
            </Link>

            {/* Navegação estilo Netflix - Clean e Minimalista */}
            <nav className="hidden lg:flex items-center space-x-5">
              {navigationItems.map((item, index) => {
                const ItemIcon = item.icon;
                
                // Se tem onClick, renderizar como button
                if (item.onClick) {
                  return (
                    <button
                      key={`nav-item-${index}`}
                      onClick={item.onClick}
                      className="text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 text-gray-300 hover:text-gray-200"
                    >
                      {ItemIcon && <ItemIcon className="w-4 h-4" />}
                      {item.label}
                    </button>
                  );
                }
                
                // Se tem href, renderizar como Link
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 ${
                      isActiveLink(item.href)
                        ? 'text-white font-semibold'
                        : 'text-gray-300 hover:text-gray-200'
                    }`}
                  >
                    {ItemIcon && <ItemIcon className="w-4 h-4" />}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Ações estilo Netflix - Simples e Clean */}
            <div className="flex items-center space-x-4 lg:space-x-6">
              {/* Busca Desktop Expansível com Live Search */}
              <div className="hidden lg:block relative" ref={searchDropdownRef}>
                <div className={`flex items-center transition-all duration-500 ease-in-out ${
                  isSearchOpen
                    ? 'bg-black/90 backdrop-blur-sm border border-white/30 w-96 rounded-lg'
                    : 'w-auto'
                }`}>
                  {isSearchOpen && (
                    <form onSubmit={handleSearch} className="flex items-center flex-1">
                      <input
                        type="text"
                        placeholder="Buscar filmes, series..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        autoFocus
                        className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none"
                      />
                    </form>
                  )}
                  <button
                    onClick={() => {
                      if (isSearchOpen && searchQuery) {
                        handleSearch(new Event('submit') as any);
                      }
                      setIsSearchOpen(!isSearchOpen);
                      if (isSearchOpen) { setSearchQuery(''); setSearchResults([]); }
                    }}
                    className="p-2 text-white hover:text-gray-300 transition-colors duration-200"
                    aria-label="Buscar"
                  >
                    {isSearchOpen ? (
                      <XMarkIcon className="w-5 h-5" />
                    ) : (
                      <MagnifyingGlassIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Live Search Dropdown */}
                {isSearchOpen && searchResults.length > 0 && (
                  <div className="absolute top-full right-0 mt-1 w-96 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[60] max-h-[70vh] overflow-y-auto">
                    {searchResults.map((movie) => (
                      <button
                        key={movie.id}
                        onClick={() => {
                          const type = (movie as any).content_type === 'series' ? 'series' : 'movies';
                          window.location.href = `/${type}/${movie.id}`;
                          setIsSearchOpen(false);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/10 transition-colors text-left"
                      >
                        {movie.poster_url && (
                          <img src={movie.poster_url} alt="" className="w-12 h-16 object-cover rounded-lg" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{movie.title}</p>
                          <p className="text-gray-400 text-xs">
                            {movie.release_year}
                            {(movie as any).content_type === 'series' && ' · Serie'}
                          </p>
                        </div>
                        {movie.price_cents && (
                          <span className="text-xs flex-shrink-0">
                            {movie.discounted_price_cents && movie.discounted_price_cents < movie.price_cents ? (
                              <>
                                <span className="text-gray-600 line-through mr-1">R$ {(movie.price_cents / 100).toFixed(2)}</span>
                                <span className="text-green-400 font-bold">R$ {(movie.discounted_price_cents / 100).toFixed(2)}</span>
                              </>
                            ) : (
                              <span className="text-gray-500">R$ {(movie.price_cents / 100).toFixed(2)}</span>
                            )}
                          </span>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="w-full px-4 py-2.5 text-center text-sm text-red-400 hover:bg-white/10 border-t border-white/10 transition-colors"
                    >
                      Ver todos os resultados
                    </button>
                  </div>
                )}
              </div>

              {/* Busca Mobile */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="lg:hidden p-2 text-white hover:text-gray-300 transition-colors duration-200"
                aria-label="Abrir busca"
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
              </button>

              {/* Menu Mobile Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-white hover:text-gray-300 transition-colors duration-200"
                aria-label="Menu"
              >
                {isMobileMenuOpen ? (
                  <XMarkIcon className="w-6 h-6" />
                ) : (
                  <Bars3Icon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Menu Mobile Melhorado */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Content */}
            <div className="fixed top-20 lg:top-24 left-0 right-0 bg-dark-900/98 backdrop-blur-lg border-t border-white/10 shadow-2xl z-50 transform transition-transform duration-300">
              <div className="container mx-auto px-4 py-6 max-h-screen overflow-y-auto">
                {/* Navegação Principal */}
                <nav className="space-y-1 mb-6">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3">
                    Navegação
                  </div>
                  {navigationItems.map((item, index) => {
                    const ItemIcon = item.icon;
                    
                    // Se tem onClick, renderizar como button
                    if (item.onClick) {
                      return (
                        <button
                          key={`mobile-nav-${index}`}
                          onClick={() => {
                            item.onClick();
                            setIsMobileMenuOpen(false);
                          }}
                          className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-300 hover:bg-white/5 hover:text-white active:bg-white/10"
                        >
                          {ItemIcon && <ItemIcon className="w-5 h-5 flex-shrink-0" />}
                          <span className="flex-1">{item.label}</span>
                        </button>
                      );
                    }
                    
                    // Se tem href, renderizar como Link
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          isActiveLink(item.href)
                            ? 'bg-primary-600/20 text-primary-400 border-l-4 border-primary-500'
                            : 'text-gray-300 hover:bg-white/5 hover:text-white active:bg-white/10'
                        }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {ItemIcon && <ItemIcon className="w-5 h-5 flex-shrink-0" />}
                        <span className="flex-1">{item.label}</span>
                        {isActiveLink(item.href) && (
                          <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </nav>

                {/* WhatsApp Community */}
                <div className="border-t border-white/10 pt-4 mb-4">
                  <a
                    href="https://chat.whatsapp.com/CK5DVQUWQqG3WRrDgjTbgy"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-[#25D366] hover:bg-[#25D366]/10 transition-all"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span className="flex-1 text-sm font-medium">Comunidade WhatsApp</span>
                  </a>
                </div>

                {/* Seção de Busca Mobile */}
                <div className="border-t border-white/10 pt-6 lg:hidden">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3">
                    Buscar
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsSearchOpen(true);
                    }}
                    className="flex items-center w-full px-3 py-3 rounded-lg text-base font-medium text-gray-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <MagnifyingGlassIcon className="w-5 h-5 mr-3 text-primary-500" />
                    <span className="flex-1 text-left">Buscar conteúdo...</span>
                  </button>
                </div>

                {/* Footer do Menu */}
                <div className="border-t border-white/10 pt-6 mt-6">
                  <div className="text-center">
                    <Image
                      src="/CINEVT.png"
                      alt="Cine Vision"
                      width={120}
                      height={36}
                      className="mx-auto mb-2"
                      style={{ maxHeight: '32px', width: 'auto' }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      A melhor experiência em streaming
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Busca Modal Mobile com Live Search */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[55] bg-black/95 lg:hidden overflow-y-auto">
          <div className="container mx-auto px-4 pt-6">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Buscar filmes, series..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                autoFocus
                className="w-full bg-transparent border-b border-white/20 px-12 py-4 text-white text-lg placeholder-gray-400 focus:outline-none focus:border-white"
              />
              <button
                type="submit"
                className="absolute left-0 top-1/2 transform -translate-y-1/2 p-1 text-white hover:text-primary-500 transition-colors"
                aria-label="Buscar"
              >
                <MagnifyingGlassIcon className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-0 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </form>

            {/* Live Search Results Mobile */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-1">
                {searchResults.map((movie) => (
                  <button
                    key={movie.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const type = (movie as any).content_type === 'series' ? 'series' : 'movies';
                      const url = `/${type}/${movie.id}`;
                      setSearchResults([]);
                      setSearchQuery('');
                      setIsSearchOpen(false);
                      setIsMobileMenuOpen(false);
                      router.push(url);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-3 hover:bg-white/10 rounded-lg transition-colors text-left"
                  >
                    {movie.poster_url && (
                      <img src={movie.poster_url} alt="" className="w-10 h-14 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{movie.title}</p>
                      <p className="text-gray-400 text-xs">
                        {movie.release_year}
                        {(movie as any).content_type === 'series' && ' · Serie'}
                      </p>
                    </div>
                    {movie.price_cents && (
                      <span className="text-xs flex-shrink-0">
                        {movie.discounted_price_cents && movie.discounted_price_cents < movie.price_cents ? (
                          <>
                            <span className="text-gray-600 line-through mr-1">R$ {(movie.price_cents / 100).toFixed(2)}</span>
                            <span className="text-green-400 font-bold">R$ {(movie.discounted_price_cents / 100).toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-gray-500">R$ {(movie.price_cents / 100).toFixed(2)}</span>
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-gray-400 text-sm">Nenhum resultado encontrado</p>
                <button
                  onClick={() => { window.open('https://t.me/m/YAU1-zMrZDcx', '_blank'); }}
                  className="mt-3 text-red-400 text-sm hover:text-red-300"
                >
                  Solicitar este conteudo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </>
  );
}