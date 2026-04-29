'use client';

import Link from 'next/link';

export default function AdminBackButton({ label = 'Voltar ao painel' }: { label?: string }) {
  return (
    <Link
      href="/admin"
      className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      {label}
    </Link>
  );
}
