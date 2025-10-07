'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '@/services/authService';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check authentication and redirect accordingly
    if (AuthService.isAuthenticated()) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">Carregando...</p>
      </div>
    </div>
  );
}