'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Se já está na página de login, não precisa verificar
    if (pathname === '/admin/login') {
      setIsChecking(false);
      setIsAuthenticated(true);
      return;
    }

    const checkAuth = async () => {
      try {
        // Verificar autenticação via Supabase
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // Não autenticado, redirecionar para login
          router.push('/admin/login');
          return;
        }

        // Verificar se é admin
        if (session.user.email !== 'adm@cinevision.com.br') {
          // Não é admin, redirecionar para home
          router.push('/');
          return;
        }

        // Autenticado e é admin
        setIsAuthenticated(true);
        setIsChecking(false);
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        router.push('/admin/login');
      }
    };

    checkAuth();
  }, [router, pathname]);

  // Mostrar loading enquanto verifica autenticação
  if (isChecking && pathname !== '/admin/login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl mb-4 shadow-2xl shadow-red-500/50">
            <svg className="animate-spin w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-400 text-lg">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Se está na página de login ou autenticado, renderizar
  if (pathname === '/admin/login' || isAuthenticated) {
    return <>{children}</>;
  }

  // Fallback: não renderizar nada se não autenticado
  return null;
}
