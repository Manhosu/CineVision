'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { toast } from 'react-hot-toast';

export default function PixSettingsPage() {
  const router = useRouter();
  const [pixKey, setPixKey] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [merchantCity, setMerchantCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Obter token do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        router.push('/admin/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/settings/pix`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPixKey(data.pix_key || '');
        setMerchantName(data.merchant_name || '');
        setMerchantCity(data.merchant_city || '');
      } else {
        toast.error('Erro ao carregar configurações');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validações básicas
    if (!pixKey.trim()) {
      toast.error('Chave PIX é obrigatória');
      return;
    }

    if (merchantName.length > 25) {
      toast.error('Nome do comerciante deve ter no máximo 25 caracteres');
      return;
    }

    if (merchantCity.length > 15) {
      toast.error('Cidade deve ter no máximo 15 caracteres');
      return;
    }

    setSaving(true);
    try {
      // Obter token do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        router.push('/admin/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/settings/pix`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pix_key: pixKey,
          merchant_name: merchantName,
          merchant_city: merchantCity
        })
      });

      if (response.ok) {
        toast.success('✅ Configurações PIX salvas com sucesso!');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh] pt-24">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
            <p>Carregando configurações...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Header />

      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Back Button */}
        <div className="mb-6">
          <a
            href="/admin"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar para Admin
          </a>
        </div>

        {/* Breadcrumb */}
        <div className="mb-6">
          <nav className="text-sm">
            <a href="/admin" className="text-gray-400 hover:text-white">Admin</a>
            <span className="text-gray-600 mx-2">/</span>
            <span className="text-white">Configurações PIX</span>
          </nav>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            📱 Configurações PIX
          </h1>
          <p className="text-gray-400">
            Configure a chave PIX para receber pagamentos no bot do Telegram
          </p>
        </div>

        {/* Current PIX Key Info (if exists) */}
        {pixKey && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 max-w-2xl mb-6">
            <h2 className="text-lg font-bold text-green-400 mb-3">
              ✅ Chave PIX Configurada
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Chave PIX:</span>
                <code className="text-green-400 bg-black/40 px-3 py-1 rounded font-mono">
                  {pixKey}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Comerciante:</span>
                <span className="text-white">{merchantName || 'Cine Vision'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Cidade:</span>
                <span className="text-white">{merchantCity || 'SAO PAULO'}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              💡 Esta chave está sendo usada para gerar QR Codes PIX no bot do Telegram
            </p>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-black/60 backdrop-blur-lg rounded-xl border border-gray-800 p-6 max-w-2xl">
          <h2 className="text-xl font-bold text-white mb-6">
            {pixKey ? '✏️ Atualizar Configurações' : '➕ Configurar PIX'}
          </h2>

          {/* PIX Key */}
          <div className="mb-6">
            <label htmlFor="pixKey" className="block text-sm font-medium text-gray-300 mb-2">
              Chave PIX *
            </label>
            <input
              id="pixKey"
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              placeholder="email@exemplo.com"
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 Tipos aceitos: Email, CPF, CNPJ, Telefone (+5511999999999) ou Chave Aleatória (UUID)
            </p>
          </div>

          {/* Merchant Name */}
          <div className="mb-6">
            <label htmlFor="merchantName" className="block text-sm font-medium text-gray-300 mb-2">
              Nome do Comerciante *
              <span className="text-gray-500 text-xs ml-2">
                (máx. 25 caracteres)
              </span>
            </label>
            <input
              id="merchantName"
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              maxLength={25}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              placeholder="Cine Vision"
            />
            <p className="text-xs text-gray-500 mt-2">
              {merchantName.length}/25 caracteres
            </p>
          </div>

          {/* Merchant City */}
          <div className="mb-6">
            <label htmlFor="merchantCity" className="block text-sm font-medium text-gray-300 mb-2">
              Cidade *
              <span className="text-gray-500 text-xs ml-2">
                (máx. 15 caracteres)
              </span>
            </label>
            <input
              id="merchantCity"
              type="text"
              value={merchantCity}
              onChange={(e) => setMerchantCity(e.target.value)}
              maxLength={15}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              placeholder="SAO PAULO"
            />
            <p className="text-xs text-gray-500 mt-2">
              {merchantCity.length}/15 caracteres
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-400">
              <strong>ℹ️ Importante:</strong> Estas informações aparecerão no QR Code PIX gerado para os clientes.
              Use LETRAS MAIÚSCULAS sem acentos para melhor compatibilidade.
            </p>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !pixKey.trim()}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Salvando...
              </>
            ) : (
              <>
                💾 Salvar Configurações
              </>
            )}
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-black/40 backdrop-blur-lg rounded-xl border border-gray-800 p-6 max-w-2xl">
          <h2 className="text-xl font-bold text-white mb-4">❓ Ajuda</h2>

          <div className="space-y-4 text-gray-300">
            <div>
              <h3 className="font-semibold text-white mb-2">Como funciona o pagamento PIX?</h3>
              <p className="text-sm">
                Quando um cliente escolhe pagar via PIX no bot do Telegram, o sistema gera automaticamente
                um QR Code com estas informações. O cliente escaneia o código no app bancário e confirma o pagamento.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Onde consigo minha chave PIX?</h3>
              <p className="text-sm">
                Acesse o aplicativo do seu banco e procure por "Minhas chaves PIX". Você pode usar qualquer
                tipo de chave cadastrada (email, CPF, telefone ou chave aleatória).
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Os pagamentos são automáticos?</h3>
              <p className="text-sm">
                Atualmente, você precisará confirmar manualmente os pagamentos PIX no painel admin.
                Uma integração automática com gateway de pagamento pode ser implementada futuramente.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
