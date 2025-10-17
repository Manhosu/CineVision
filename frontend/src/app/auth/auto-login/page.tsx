'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AutoLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleAutoLogin = async () => {
      try {
        const token = searchParams.get('token');
        const redirectUrl = searchParams.get('redirect') || '/dashboard';

        if (!token) {
          setStatus('error');
          setErrorMessage('Token de autenticação não fornecido');
          return;
        }

        // Chamar endpoint de auto-login
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/v1/auth/auto-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Falha na autenticação automática');
        }

        const data = await response.json();

        // Salvar tokens e dados do usuário no localStorage
        if (data.access_token && data.user) {
          // Salvar tokens JWT do backend
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          localStorage.setItem('auth_token', data.access_token); // Para compatibilidade
          localStorage.setItem('user', JSON.stringify(data.user));

          setStatus('success');

          // Redirecionar após 500ms
          setTimeout(() => {
            router.push(redirectUrl);
          }, 500);
        } else {
          throw new Error('Dados de autenticação inválidos');
        }
      } catch (error: any) {
        console.error('Erro no auto-login:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Erro ao realizar autenticação automática');

        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      }
    };

    handleAutoLogin();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto h-12 w-12 text-blue-600 dark:text-blue-400">
                <svg
                  className="animate-spin h-12 w-12"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                Autenticando...
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Aguarde enquanto validamos seu acesso
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto h-12 w-12 text-green-600 dark:text-green-400">
                <svg
                  className="h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                Sucesso!
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Redirecionando você...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto h-12 w-12 text-red-600 dark:text-red-400">
                <svg
                  className="h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                Erro na Autenticação
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {errorMessage}
              </p>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-500">
                Redirecionando para a página de login...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
