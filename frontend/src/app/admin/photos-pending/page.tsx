'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Igor (07/05): consolidacao do fluxo de aprovacao de foto com
// /admin/edit-requests. Esta rota agora redireciona pra evitar
// quebrar bookmarks/atalhos antigos.
export default function PhotosPendingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/edit-requests');
  }, [router]);
  return (
    <div className="mx-auto max-w-2xl p-12 text-center text-zinc-300">
      Redirecionando para o novo painel de aprovações…
    </div>
  );
}
