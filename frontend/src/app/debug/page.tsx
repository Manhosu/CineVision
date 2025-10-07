'use client';

import { useState, useEffect } from 'react';

export default function DebugPage() {
  const [status, setStatus] = useState('');
  const [mounted, setMounted] = useState(false);
  const [tokenInfo, setTokenInfo] = useState({
    admin_token: '',
    auth_token: '',
    token: '',
    all_keys: [] as string[],
  });

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const admin = localStorage.getItem('admin_token');
      const auth = localStorage.getItem('auth_token');
      const token = localStorage.getItem('token');

      const all = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) all.push(key);
      }

      setTokenInfo({
        admin_token: admin || '(não existe)',
        auth_token: auth || '(não existe)',
        token: token || '(não existe)',
        all_keys: all,
      });
    }
  }, []);

  const testAuth = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      setStatus('Testando autenticação...');
      const response = await fetch('http://localhost:3001/api/v1/content-language-upload/language-options', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setStatus(`Status: ${response.status}\nResponse: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      setStatus('Erro: ' + error);
    }
  };

  const clearServiceWorkerCache = async () => {
    try {
      setStatus('Limpando cache...');

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      setStatus('Cache limpo com sucesso! Recarregue a página.');
    } catch (error) {
      setStatus(`Erro ao limpar cache: ${error}`);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug - Token & Cache</h1>

      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-bold mb-2">Tokens no localStorage:</h2>
        <p className="mb-1"><strong>admin_token:</strong> {tokenInfo.admin_token.substring(0, 50)}{tokenInfo.admin_token.length > 50 ? '...' : ''}</p>
        <p className="mb-1"><strong>auth_token:</strong> {tokenInfo.auth_token.substring(0, 50)}{tokenInfo.auth_token.length > 50 ? '...' : ''}</p>
        <p className="mb-1"><strong>token:</strong> {tokenInfo.token.substring(0, 50)}{tokenInfo.token.length > 50 ? '...' : ''}</p>

        <h3 className="font-bold mt-4 mb-2">Todas as chaves ({tokenInfo.all_keys.length}):</h3>
        <ul className="list-disc list-inside">
          {tokenInfo.all_keys.map((key) => (
            <li key={key} className="text-sm">{key}</li>
          ))}
        </ul>
      </div>

      <div className="space-x-2">
        <button
          onClick={testAuth}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Testar Autenticação
        </button>
        <button
          onClick={clearServiceWorkerCache}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Limpar Cache
        </button>
      </div>

      {status && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <pre className="whitespace-pre-wrap">{status}</pre>
        </div>
      )}
    </div>
  );
}