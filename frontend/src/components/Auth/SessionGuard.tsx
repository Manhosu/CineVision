'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { refreshAccessToken, getAccessToken, clearTokens } from '@/lib/authTokens';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Igor (14/05): heartbeat de 10min era lento demais — funcionário ficava
// sem saber por até 10min que tinha perdido sessão. Reduzido para 2min.
// Com JWT de 24h, esse heartbeat praticamente nunca dispara o modal —
// serve só pra detectar revogação ou deploy do backend que invalida secret.
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export default function SessionGuard() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const [expired, setExpired] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const run = async () => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const resp = await fetch(`${API_URL}/api/v1/auth/validate`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (resp.status === 401) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            clearTokens();
            setExpired(true);
          }
        }
      } catch {
        // network blip — do nothing
      }
    };

    // Initial heartbeat
    run();
    timerRef.current = window.setInterval(run, HEARTBEAT_INTERVAL_MS);

    // Igor (14/05): quando o admin volta pra aba após ficar em outra,
    // browsers throttlam o setInterval. Detecta a volta via visibilitychange
    // e roda heartbeat imediato — assim o estado da sessão é refrescado na
    // hora em vez de esperar o próximo tick.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        run();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAdmin, pathname]);

  if (!expired) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-zinc-900 p-6 text-center shadow-2xl">
        <div className="mb-3 text-5xl">🔒</div>
        <h2 className="mb-2 text-xl font-bold text-white">Sua sessão expirou</h2>
        <p className="mb-5 text-sm text-zinc-400">
          Por segurança, você precisa entrar novamente para continuar.
        </p>
        <a
          href="/admin/login"
          className="inline-block rounded-lg bg-red-600 px-6 py-2.5 font-semibold text-white transition hover:bg-red-700"
        >
          Fazer login
        </a>
      </div>
    </div>
  );
}
