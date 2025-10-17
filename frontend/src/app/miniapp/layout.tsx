import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'CineVision Mini App - Telegram',
  description: 'Catálogo de filmes do CineVision no Telegram',
};

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Load Telegram Web App SDK */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
