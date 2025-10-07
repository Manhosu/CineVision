'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Preserve any query parameters (like redirect)
    const searchParams = new URLSearchParams(window.location.search);
    const redirectPath = `/auth/login${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    router.replace(redirectPath);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
        <p>Redirecionando para o login...</p>
      </div>
    </div>
  );
}