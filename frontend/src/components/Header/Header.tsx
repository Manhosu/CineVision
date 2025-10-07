'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
  FilmIcon,
  UserIcon
} from '@heroicons/react/24/outline';

interface HeaderProps {
  transparent?: boolean;
}

export function Header({ transparent = false }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const pathname = usePathname();

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
      // TODO: Implementar navegação para página de busca
      console.log('Buscar por:', searchQuery);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navigationItems = [
    { label: 'Início', href: '/' },
    { label: 'Filmes', href: '/movies' },
    { label: 'Categorias', href: '/categories' },
    { label: 'Pedidos', href: '/requests' },
    { label: 'Minha Lista', href: '/my-list' },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          transparent && !isScrolled
            ? 'bg-transparent'
            : 'bg-dark-950/95 backdrop-blur-md border-b border-white/10'
        }`}
      >
        <div className="container mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center space-x-3 text-2xl font-bold text-white hover:text-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-950 rounded px-2 py-1"
            >
              <FilmIcon className="w-8 h-8 text-primary-600" />
              <span className="hidden sm:block">
                <span className="text-primary-600">Cine</span>
                <span className="text-white">Vision</span>
              </span>
            </Link>

            {/* Navegação Desktop */}
            <nav className="hidden md:flex items-center space-x-8">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${
                    isActiveLink(item.href)
                      ? 'nav-link-active'
                      : ''
                  }`}
                >
                  {item.label}
                  {isActiveLink(item.href) && (
                    <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
                  )}
                </Link>
              ))}
            </nav>

            {/* Ações (Busca, Login, Menu Mobile) */}
            <div className="flex items-center space-x-4">
              {/* Busca Desktop */}
              <div className="hidden lg:block relative">
                <form onSubmit={handleSearch} className="relative">
                  <input
                    type="text"
                    placeholder="Buscar filmes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-search w-64 text-sm"
                  />
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </form>
              </div>

              {/* Busca Mobile */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="lg:hidden btn-icon"
                aria-label="Abrir busca"
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
              </button>

              {/* Botão Entrar */}
              <Link
                href="/login"
                className="btn-primary text-sm hidden sm:inline-flex"
              >
                <UserIcon className="w-4 h-4 mr-2" />
                Entrar
              </Link>

              {/* Menu Mobile Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden btn-icon"
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
            <div className="fixed top-16 lg:top-20 left-0 right-0 bg-dark-900/98 backdrop-blur-lg border-t border-white/10 shadow-2xl z-50 transform transition-transform duration-300">
              <div className="container mx-auto px-4 py-6 max-h-screen overflow-y-auto">
                {/* Navegação Principal */}
                <nav className="space-y-1 mb-6">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3">
                    Navegação
                  </div>
                  {navigationItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center px-3 py-3 rounded-lg text-base font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        isActiveLink(item.href)
                          ? 'bg-primary-600/20 text-primary-400 border-l-4 border-primary-500'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white active:bg-white/10'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span className="flex-1">{item.label}</span>
                      {isActiveLink(item.href) && (
                        <div className="w-2 h-2 bg-primary-500 rounded-full" />
                      )}
                    </Link>
                  ))}
                </nav>

                {/* Seção de Conta */}
                <div className="border-t border-white/10 pt-6">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3">
                    Conta
                  </div>
                  <Link
                    href="/login"
                    className="flex items-center px-3 py-3 rounded-lg text-base font-medium text-gray-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <UserIcon className="w-5 h-5 mr-3 text-primary-500" />
                    <span className="flex-1">Entrar</span>
                  </Link>
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
                    <span className="flex-1 text-left">Buscar filmes...</span>
                  </button>
                </div>

                {/* Footer do Menu */}
                <div className="border-t border-white/10 pt-6 mt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-400">
                      <span className="text-primary-500 font-medium">Cine</span>
                      <span className="text-white">Vision</span>
                    </p>
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

      {/* Busca Mobile Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80" onClick={() => setIsSearchOpen(false)} />
          <div className="absolute top-0 left-0 right-0 bg-dark-900 border-b border-white/10 p-4">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Buscar filmes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-dark-800 border border-white/20 rounded-lg px-4 py-3 pl-10 pr-12 text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}

    </>
  );
}