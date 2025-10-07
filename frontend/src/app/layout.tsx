import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cine Vision - Filmes Online',
  description: 'Plataforma de streaming com filmes em alta qualidade. Assista online ou baixe pelo Telegram.',
  keywords: ['filmes', 'streaming', 'cinema', 'online', 'telegram'],
  authors: [{ name: 'Cine Vision Team' }],
  creator: 'Cine Vision',
  publisher: 'Cine Vision',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://cinevision.com',
    title: 'Cine Vision - Filmes Online',
    description: 'Plataforma de streaming com filmes em alta qualidade. Assista online ou baixe pelo Telegram.',
    siteName: 'Cine Vision',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Cine Vision - Filmes Online',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cine Vision - Filmes Online',
    description: 'Plataforma de streaming com filmes em alta qualidade.',
    images: ['/og-image.jpg'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        {/* Google Cast SDK */}
        <script
          src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"
          async
          defer
        />
        {/* Preconnect to CDN and API */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_CDN_URL} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_CDN_URL} />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased bg-dark-950 text-white min-h-screen`}
        suppressHydrationWarning
      >
        {/* Background gradient */}
        <div
          className="fixed inset-0 bg-gradient-to-br from-dark-900 via-dark-950 to-black -z-10"
          aria-hidden="true"
        />

        {/* Main content */}
        <div className="relative min-h-screen">
          {children}
        </div>

        {/* Global toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#fff',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />

        {/* Service Worker registration - TEMPORARILY DISABLED */}
        {/*
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />
        */}

        {/* Smart TV detection */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Detect Smart TV user agents
                const isTv = /smart-tv|tizen|webos|hbbtv|roku|crkey/i.test(navigator.userAgent) ||
                           (window.screen && window.screen.width >= 1920 && window.screen.height >= 1080 &&
                            !('ontouchstart' in window) && !window.DeviceMotionEvent);

                if (isTv) {
                  document.documentElement.classList.add('tv-device');
                  document.documentElement.style.setProperty('--tv-safe-padding', '3%');
                }
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}