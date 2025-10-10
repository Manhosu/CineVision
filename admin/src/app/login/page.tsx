'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { EyeIcon, EyeSlashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import AuthService from '@/services/authService';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Redirect if already authenticated
    if (AuthService.isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (requires2FA) {
        // Verify 2FA code
        await AuthService.verify2FA(pendingEmail, twoFactorCode);
        router.push('/dashboard');
      } else {
        // Initial login
        const response = await AuthService.login({ email, password });
        
        if (response.requires_2fa) {
          setRequires2FA(true);
          setPendingEmail(email);
          setTwoFactorCode('');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setRequires2FA(false);
    setPendingEmail('');
    setTwoFactorCode('');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Image
            src="/CINEVT.png"
            alt="Cine Vision Admin"
            width={150}
            height={45}
            className="h-11 mx-auto mb-4"
            style={{ width: 'auto', height: 'auto' }}
          />
          <h2 className="text-center text-2xl font-bold text-white">
            Admin
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            {requires2FA
              ? 'Digite o código de autenticação de dois fatores'
              : 'Entre na sua conta'
            }
          </p>
        </div>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {!requires2FA ? (
            // Login form
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="admin@cinevision.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Senha
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-600 bg-gray-800 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // 2FA form
            <div className="space-y-4">
              <div className="text-center">
                <ShieldCheckIcon className="mx-auto h-12 w-12 text-blue-500" />
                <p className="mt-2 text-sm text-gray-400">
                  Digite o código de autenticação de dois fatores
                </p>
              </div>
              <div>
                <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-300">
                  Código de 6 dígitos
                </label>
                <input
                  id="twoFactorCode"
                  name="twoFactorCode"
                  type="text"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-center text-lg tracking-widest"
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            {requires2FA && (
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 flex justify-center py-2 px-4 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Voltar
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || (requires2FA && twoFactorCode.length !== 6)}
              className="flex-1 flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Verificando...' : (requires2FA ? 'Verificar Código' : 'Entrar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}