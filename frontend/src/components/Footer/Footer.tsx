'use client';

import Link from 'next/link';
import {
  FilmIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    platform: [
      { label: 'Como Funciona', href: '/how-it-works' },
      { label: 'Preços', href: '/pricing' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Suporte', href: '/support' }
    ],
    content: [
      { label: 'Filmes', href: '/movies' },
      { label: 'Categorias', href: '/categories' },
      { label: 'Lançamentos', href: '/releases' },
      { label: 'Pedidos', href: '/requests' }
    ],
    legal: [
      { label: 'Termos de Uso', href: '/terms' },
      { label: 'Política de Privacidade', href: '/privacy' },
      { label: 'Política de Reembolso', href: '/refund-policy' },
      { label: 'Direitos Autorais', href: '/copyright' }
    ],
    social: [
      { label: 'Telegram', href: 'https://t.me/cinevision_bot', external: true },
      { label: 'Instagram', href: 'https://instagram.com/cinevision', external: true },
      { label: 'Twitter', href: 'https://twitter.com/cinevision', external: true },
      { label: 'YouTube', href: 'https://youtube.com/@cinevision', external: true }
    ]
  };

  return (
    <footer className="relative mt-20 bg-dark-950 border-t border-white/10">

      {/* Main Footer Content */}
      <div className="container mx-auto px-4 lg:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand Section */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center space-x-3 text-2xl font-bold">
              <FilmIcon className="w-8 h-8 text-primary-600" />
              <span>
                <span className="text-primary-600">Cine</span>
                <span className="text-white">Vision</span>
              </span>
            </Link>

            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Sua plataforma de streaming favorita. Filmes em alta qualidade,
              disponíveis para assistir online ou baixar via Telegram.
            </p>

            {/* Contact Info */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-3 text-gray-400">
                <EnvelopeIcon className="w-4 h-4 text-primary-600" />
                <a
                  href="mailto:contato@cinevision.com"
                  className="hover:text-white transition-colors focus-outline"
                >
                  contato@cinevision.com
                </a>
              </div>

              <div className="flex items-center space-x-3 text-gray-400">
                <PhoneIcon className="w-4 h-4 text-primary-600" />
                <span>+55 (11) 9999-9999</span>
              </div>

              <div className="flex items-center space-x-3 text-gray-400">
                <MapPinIcon className="w-4 h-4 text-primary-600" />
                <span>São Paulo, Brasil</span>
              </div>
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Plataforma</h3>
            <ul className="space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 text-sm hover:text-white transition-colors focus-outline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Content Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Conteúdo</h3>
            <ul className="space-y-3">
              {footerLinks.content.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 text-sm hover:text-white transition-colors focus-outline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social & Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">Conecte-se</h3>

            {/* Social Links */}
            <ul className="space-y-3 mb-6">
              {footerLinks.social.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="text-gray-400 text-sm hover:text-white transition-colors focus-outline flex items-center space-x-2"
                  >
                    <span>{link.label}</span>
                    {link.external && (
                      <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                    )}
                  </a>
                </li>
              ))}
            </ul>

            {/* Newsletter Signup */}
            <div className="space-y-3">
              <h4 className="text-white text-sm font-medium">Newsletter</h4>
              <form className="flex space-x-2">
                <input
                  type="email"
                  placeholder="Seu e-mail"
                  className="flex-1 bg-dark-800 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 transition-colors"
                />
                <button
                  type="submit"
                  className="btn-primary text-xs px-4 py-2"
                >
                  Inscrever
                </button>
              </form>
              <p className="text-xs text-gray-500">
                Receba novidades sobre lançamentos
              </p>
            </div>
          </div>
        </div>

        {/* Telegram Integration CTA */}
        <div className="mt-12 p-6 bg-gradient-to-r from-blue-600/20 to-blue-800/20 rounded-xl border border-blue-500/30">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div>
              <h3 className="text-white font-semibold mb-2">
                🤖 Experimente nosso Bot no Telegram
              </h3>
              <p className="text-gray-300 text-sm">
                Compre filmes, receba notificações de lançamentos e baixe conteúdo diretamente pelo Telegram.
              </p>
            </div>
            <a
              href="https://t.me/cinevision_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="btn bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 flex items-center space-x-2 whitespace-nowrap"
            >
              <span>Abrir Bot</span>
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-white/10 bg-dark-950">
        <div className="container mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">

            {/* Copyright */}
            <div className="text-center md:text-left">
              <p className="text-gray-400 text-sm">
                © {currentYear} Cine Vision. Todos os direitos reservados.
              </p>
            </div>

            {/* Legal Links */}
            <div className="flex flex-wrap justify-center md:justify-end space-x-6">
              {footerLinks.legal.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-500 text-xs hover:text-gray-300 transition-colors focus-outline"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-center text-xs text-gray-500">
              Cine Vision é uma plataforma de distribuição digital de conteúdo audiovisual.
              <br className="hidden sm:inline" />
              Todos os filmes são licenciados e distribuídos de acordo com os direitos autorais.
            </p>
          </div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-72 h-72 bg-primary-600/5 rounded-full blur-3xl pointer-events-none" />
      </div>
    </footer>
  );
}