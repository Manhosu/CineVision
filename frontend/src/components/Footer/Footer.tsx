'use client';

import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative mt-20 bg-dark-950 border-t border-white/10">
      <div className="container mx-auto px-4 lg:px-6 py-8">
        <div className="flex flex-col items-center justify-center space-y-6">
          {/* Logo */}
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <Image
              src="/CINEVT.png"
              alt="Cine Vision"
              width={130}
              height={40}
              className="h-9"
              style={{ width: 'auto', height: 'auto' }}
            />
          </Link>

          {/* Copyright */}
          <p className="text-gray-400 text-sm text-center">
            © {currentYear} Cine Vision. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}