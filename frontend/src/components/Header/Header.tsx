'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

interface HeaderProps {
  transparent?: boolean;
}

export function Header({ transparent = false }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

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
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsUserMenuOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const navigationItems = [
    { label: 'Início', href: '/' },
    { label: 'Filmes', href: '/movies' },
    { label: 'Categorias', href: '/categories' },
    { label: 'Minha Lista', href: '/my-list' },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-in-out ${
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
          <div className="flex items-center justify-between h-16 lg:h-[70px]">
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
                className="w-auto transition-opacity duration-200 hover:opacity-80"
                style={{ height: '112px', width: 'auto' }}
              />
            </Link>

            {/* Navegação estilo Netflix - Clean e Minimalista */}
            <nav className="hidden lg:flex items-center space-x-5">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors duration-200 ${
                    isActiveLink(item.href)
                      ? 'text-white font-semibold'
                      : 'text-gray-300 hover:text-gray-200'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Ações estilo Netflix - Simples e Clean */}
            <div className="flex items-center space-x-4 lg:space-x-6">
              {/* Busca Desktop Expansível */}
              <div className="hidden lg:block">
                <div className={`flex items-center transition-all duration-300 ${
                  isSearchOpen
                    ? 'bg-black border border-white w-64'
                    : 'w-auto'
                }`}>
                  {isSearchOpen && (
                    <form onSubmit={handleSearch} className="flex items-center flex-1">
                      <input
                        type="text"
                        placeholder="Títulos, pessoas, gêneros"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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
                      if (isSearchOpen) setSearchQuery('');
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
              </div>

              {/* Busca Mobile */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="lg:hidden p-2 text-white hover:text-gray-300 transition-colors duration-200"
                aria-label="Abrir busca"
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
              </button>

              {/* Menu de Usuário apenas para Admin */}
              {isAuthenticated && user?.role === 'admin' && (
                <div ref={userMenuRef} className="relative hidden sm:block">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 text-white hover:text-gray-300 transition-colors duration-200"
                  >
                    <div className="w-8 h-8 rounded bg-primary-600 flex items-center justify-center">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-black/95 border border-gray-800 shadow-2xl overflow-hidden z-50">
                      <div className="p-3 border-b border-gray-800">
                        <p className="text-sm text-white truncate">{user?.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{user?.email}</p>
                      </div>

                      <div className="py-2">
                        <Link
                          href="/admin"
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          Painel Admin
                        </Link>

                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          Sair do Cine Vision
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

                {/* Seção de Conta - Apenas Admin */}
                {isAuthenticated && user?.role === 'admin' && (
                  <div className="border-t border-white/10 pt-6">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3">
                      Admin
                    </div>
                    {user && (
                      <div className="px-3 py-2 mb-2">
                        <p className="text-sm font-medium text-white">{user.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                      </div>
                    )}
                    <Link
                      href="/admin"
                      className="flex items-center px-3 py-3 rounded-lg text-base font-medium text-gray-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <UserIcon className="w-5 h-5 mr-3 text-primary-500" />
                      <span className="flex-1">Painel Admin</span>
                    </Link>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center w-full px-3 py-3 rounded-lg text-base font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 active:bg-red-500/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
                      <span className="flex-1 text-left">Sair</span>
                    </button>
                  </div>
                )}

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

      {/* Busca Modal Mobile */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black lg:hidden">
          <div className="container mx-auto px-4 pt-4">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Títulos, pessoas, gêneros"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-transparent border-b border-white/20 px-12 py-4 text-white text-lg placeholder-gray-400 focus:outline-none focus:border-white"
              />
              <MagnifyingGlassIcon className="absolute left-0 top-1/2 transform -translate-y-1/2 w-6 h-6 text-white" />
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="absolute right-0 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </form>
          </div>
        </div>
      )}

    </>
  );
}