'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function UploadPage() {
  const router = useRouter();

  useEffect(() => {
    // Upload de video foi desativado - redirecionar para criacao de conteudo
    router.replace('/admin/content/create');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400">Redirecionando...</p>
      </div>
    </div>
  );
}
