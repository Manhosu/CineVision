'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Toggle from '@/components/ui/Toggle'
import Badge from '@/components/ui/Badge'
// import { usePerformance } from '@/hooks/usePerformance'

interface SystemSettings {
  general: {
    siteName: string
    siteUrl: string
    siteDescription: string
    contactEmail: string
    defaultCurrency: string
    maintenanceMode: boolean
    maintenanceMessage: string
  }
  payment: {
    pixKey: string
    enablePix: boolean
    stripePublishableKey: string
    stripeSecretKey: string
    stripeWebhookSecret: string
    enableCard: boolean
  }
  streaming: {
    cdnUrl: string
    defaultQuality: string
    bufferSize: number
    maxConcurrentStreams: number
    enableChromecast: boolean
    enableAirplay: boolean
    enableDownload: boolean
  }
  security: {
    jwtSecret: string
    tokenExpiration: number
    maxLoginAttempts: number
    lockoutTime: number
    enable2FA: boolean
    requireEmailVerification: boolean
    enableRateLimiting: boolean
  }
  notifications: {
    smtpHost: string
    smtpPort: number
    fromEmail: string
    emailPassword: string
    telegramBotToken: string
    telegramChatId: string
    enableEmailNotifications: boolean
    enableTelegramNotifications: boolean
    notifyNewUsers: boolean
    notifyNewPayments: boolean
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    general: {
      siteName: 'Cine Vision',
      siteUrl: 'https://cinevision.com',
      siteDescription: 'Plataforma de streaming de filmes e séries',
      contactEmail: 'contato@cinevision.com',
      defaultCurrency: 'BRL',
      maintenanceMode: false,
      maintenanceMessage: 'Site em manutenção. Voltaremos em breve!'
    },
    payment: {
      pixKey: '',
      enablePix: true,
      stripePublishableKey: '',
      stripeSecretKey: '',
      stripeWebhookSecret: '',
      enableCard: true
    },
    streaming: {
      cdnUrl: 'https://cdn.cinevision.com',
      defaultQuality: 'auto',
      bufferSize: 30,
      maxConcurrentStreams: 3,
      enableChromecast: true,
      enableAirplay: true,
      enableDownload: false
    },
    security: {
      jwtSecret: '',
      tokenExpiration: 24,
      maxLoginAttempts: 5,
      lockoutTime: 15,
      enable2FA: false,
      requireEmailVerification: true,
      enableRateLimiting: true
    },
    notifications: {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      fromEmail: 'noreply@cinevision.com',
      emailPassword: '',
      telegramBotToken: '',
      telegramChatId: '',
      enableEmailNotifications: true,
      enableTelegramNotifications: true,
      notifyNewUsers: true,
      notifyNewPayments: true
    }
  })

  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    // Load settings from localStorage or API
    const savedSettings = localStorage.getItem('system-settings')
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
  }, [])

  const handleSave = async () => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Save to localStorage (in real app, this would be an API call)
      localStorage.setItem('system-settings', JSON.stringify(settings))
      
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const testStripeConnection = async () => {
    if (!settings.payment.stripeSecretKey) {
      alert('Por favor, insira a chave secreta do Stripe primeiro')
      return
    }

    setTestingConnection(true)
    setConnectionStatus('idle')

    try {
      // Simulate API call to test Stripe connection
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock validation - in real app, this would be an actual API call
      const isValid = settings.payment.stripeSecretKey.startsWith('sk_')
      
      setConnectionStatus(isValid ? 'success' : 'error')
      
      if (isValid) {
        alert('Conexão com Stripe testada com sucesso!')
      } else {
        alert('Erro na conexão com Stripe. Verifique as chaves.')
      }
    } catch (error) {
      console.error('Error testing Stripe:', error)
      setConnectionStatus('error')
      alert('Erro ao testar conexão com Stripe')
    } finally {
      setTestingConnection(false)
    }
  }

  const updateSetting = (section: keyof SystemSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
    // Reset connection status when Stripe keys change
    if (section === 'payment' && key.includes('stripe')) {
      setConnectionStatus('idle')
    }
  }

  const tabs = [
    { id: 'general', label: 'Geral', icon: '⚙️' },
    { id: 'payment', label: 'Pagamentos', icon: '💳' },
    { id: 'streaming', label: 'Streaming', icon: '📺' },
    { id: 'security', label: 'Segurança', icon: '🔒' },
    { id: 'notifications', label: 'Notificações', icon: '🔔' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome do Site
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={settings.general.siteName}
                  onChange={(e) => updateSetting('general', 'siteName', e.target.value)}
                  placeholder="Nome do seu site"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL do Site
                </label>
                <input
                  type="url"
                  className="input-field w-full"
                  value={settings.general.siteUrl}
                  onChange={(e) => updateSetting('general', 'siteUrl', e.target.value)}
                  placeholder="https://seusite.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição do Site
                </label>
                <textarea
                  className="input-field w-full h-24"
                  value={settings.general.siteDescription}
                  onChange={(e) => updateSetting('general', 'siteDescription', e.target.value)}
                  placeholder="Descrição do seu site de streaming"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email de Contato
                </label>
                <input
                  type="email"
                  className="input-field w-full"
                  value={settings.general.contactEmail}
                  onChange={(e) => updateSetting('general', 'contactEmail', e.target.value)}
                  placeholder="contato@seusite.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Moeda Padrão
                </label>
                <select
                  className="input-field w-full"
                  value={settings.general.defaultCurrency}
                  onChange={(e) => updateSetting('general', 'defaultCurrency', e.target.value)}
                >
                  <option value="BRL">Real Brasileiro (BRL)</option>
                  <option value="USD">Dólar Americano (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Configurações de Manutenção</h3>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.general.maintenanceMode}
                  onChange={(e) => updateSetting('general', 'maintenanceMode', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Modo de Manutenção (site ficará offline para usuários)
                </label>
              </div>
              {settings.general.maintenanceMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Mensagem de Manutenção
                  </label>
                  <textarea
                    className="input-field w-full h-20"
                    value={settings.general.maintenanceMessage}
                    onChange={(e) => updateSetting('general', 'maintenanceMessage', e.target.value)}
                    placeholder="Site em manutenção. Voltaremos em breve!"
                  />
                </div>
              )}
            </div>
          </div>
        )

      case 'payment':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* PIX Settings */}
              <div className="bg-dark-800/30 border border-dark-600 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Configurações PIX</h3>
                    <p className="text-sm text-gray-400">Configure sua chave PIX para recebimento</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Chave PIX *
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v-2H7v-2H4a1 1 0 01-1-1v-4a1 1 0 011-1h3l2.257-2.257A6 6 0 0121 9z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        className="input-field w-full pl-11"
                        value={settings.payment.pixKey}
                        onChange={(e) => updateSetting('payment', 'pixKey', e.target.value)}
                        placeholder="CPF, CNPJ, Email, Telefone ou Chave Aleatória"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Aceita: CPF, CNPJ, email, telefone ou chave aleatória
                    </p>
                  </div>

                  <div className="space-y-4">
                    <Toggle
                      checked={settings.payment.enablePix}
                      onChange={(checked) => updateSetting('payment', 'enablePix', checked)}
                      label="Habilitar pagamentos via PIX"
                      description="Permite que usuários paguem usando PIX"
                      color="success"
                    />

                    {settings.payment.enablePix && settings.payment.pixKey && (
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <p className="text-green-300 text-sm font-medium">PIX configurado e ativo</p>
                        </div>
                        <p className="text-green-400 text-xs mt-2">
                          Chave: {settings.payment.pixKey}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stripe Settings */}
              <div className="bg-dark-800/30 border border-dark-600 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Configurações Stripe</h3>
                    <p className="text-sm text-gray-400">Configure pagamentos com cartão</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Chave Pública
                    </label>
                    <input
                      type="text"
                      className="input-field w-full"
                      value={settings.payment.stripePublishableKey}
                      onChange={(e) => updateSetting('payment', 'stripePublishableKey', e.target.value)}
                      placeholder="pk_test_... ou pk_live_..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Chave Secreta *
                    </label>
                    <input
                      type="password"
                      className="input-field w-full"
                      value={settings.payment.stripeSecretKey}
                      onChange={(e) => updateSetting('payment', 'stripeSecretKey', e.target.value)}
                      placeholder="sk_test_... ou sk_live_..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Webhook Secret
                    </label>
                    <input
                      type="password"
                      className="input-field w-full"
                      value={settings.payment.stripeWebhookSecret}
                      onChange={(e) => updateSetting('payment', 'stripeWebhookSecret', e.target.value)}
                      placeholder="whsec_..."
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Secret para validação de webhooks do Stripe
                    </p>
                  </div>

                  <div className="space-y-4">
                    <Toggle
                      checked={settings.payment.enableCard}
                      onChange={(checked) => updateSetting('payment', 'enableCard', checked)}
                      label="Habilitar pagamentos com cartão"
                      description="Permite pagamentos via cartão de crédito/débito"
                      color="primary"
                    />

                    {connectionStatus === 'success' && (
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <p className="text-green-300 text-sm font-medium">Stripe conectado com sucesso</p>
                        </div>
                      </div>
                    )}

                    {connectionStatus === 'error' && (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <p className="text-red-300 text-sm font-medium">Erro na conexão com Stripe</p>
                        </div>
                        <p className="text-red-400 text-xs mt-2">
                          Verifique suas chaves de API
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={testStripeConnection}
                disabled={testingConnection || !settings.payment.stripeSecretKey}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {testingConnection ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Testando Conexão...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Testar Conexão Stripe</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )

      case 'streaming':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL da CDN
                </label>
                <input
                  type="url"
                  className="input-field w-full"
                  value={settings.streaming.cdnUrl}
                  onChange={(e) => updateSetting('streaming', 'cdnUrl', e.target.value)}
                  placeholder="https://cdn.seusite.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Qualidade Padrão
                </label>
                <select
                  className="input-field w-full"
                  value={settings.streaming.defaultQuality}
                  onChange={(e) => updateSetting('streaming', 'defaultQuality', e.target.value)}
                >
                  <option value="auto">Automática</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Buffer Size (segundos)
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={settings.streaming.bufferSize}
                  onChange={(e) => updateSetting('streaming', 'bufferSize', parseInt(e.target.value))}
                  min="5"
                  max="60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Máximo de Streams Simultâneos
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={settings.streaming.maxConcurrentStreams}
                  onChange={(e) => updateSetting('streaming', 'maxConcurrentStreams', parseInt(e.target.value))}
                  min="1"
                  max="10"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Recursos Avançados</h3>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.streaming.enableChromecast}
                  onChange={(e) => updateSetting('streaming', 'enableChromecast', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Habilitar Chromecast
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.streaming.enableAirplay}
                  onChange={(e) => updateSetting('streaming', 'enableAirplay', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Habilitar AirPlay
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.streaming.enableDownload}
                  onChange={(e) => updateSetting('streaming', 'enableDownload', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Permitir download de conteúdo
                </label>
              </div>
            </div>
          </div>
        )

      case 'security':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  JWT Secret
                </label>
                <input
                  type="password"
                  className="input-field w-full"
                  value={settings.security.jwtSecret}
                  onChange={(e) => updateSetting('security', 'jwtSecret', e.target.value)}
                  placeholder="Chave secreta para JWT"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Expiração do Token (horas)
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={settings.security.tokenExpiration}
                  onChange={(e) => updateSetting('security', 'tokenExpiration', parseInt(e.target.value))}
                  min="1"
                  max="168"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Máximo de Tentativas de Login
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={settings.security.maxLoginAttempts}
                  onChange={(e) => updateSetting('security', 'maxLoginAttempts', parseInt(e.target.value))}
                  min="3"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tempo de Bloqueio (minutos)
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={settings.security.lockoutTime}
                  onChange={(e) => updateSetting('security', 'lockoutTime', parseInt(e.target.value))}
                  min="5"
                  max="60"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Configurações de Segurança</h3>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.security.enable2FA}
                  onChange={(e) => updateSetting('security', 'enable2FA', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Habilitar autenticação de dois fatores (2FA)
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.security.requireEmailVerification}
                  onChange={(e) => updateSetting('security', 'requireEmailVerification', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Exigir verificação de email
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.security.enableRateLimiting}
                  onChange={(e) => updateSetting('security', 'enableRateLimiting', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Habilitar rate limiting
                </label>
              </div>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SMTP Host
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={settings.notifications.smtpHost}
                  onChange={(e) => updateSetting('notifications', 'smtpHost', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SMTP Port
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={settings.notifications.smtpPort}
                  onChange={(e) => updateSetting('notifications', 'smtpPort', parseInt(e.target.value))}
                  placeholder="587"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email do Remetente
                </label>
                <input
                  type="email"
                  className="input-field w-full"
                  value={settings.notifications.fromEmail}
                  onChange={(e) => updateSetting('notifications', 'fromEmail', e.target.value)}
                  placeholder="noreply@seusite.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Senha do Email
                </label>
                <input
                  type="password"
                  className="input-field w-full"
                  value={settings.notifications.emailPassword}
                  onChange={(e) => updateSetting('notifications', 'emailPassword', e.target.value)}
                  placeholder="Senha ou App Password"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Telegram Bot</h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bot Token
                </label>
                <input
                  type="password"
                  className="input-field w-full"
                  value={settings.notifications.telegramBotToken}
                  onChange={(e) => updateSetting('notifications', 'telegramBotToken', e.target.value)}
                  placeholder="Token do bot do Telegram"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Chat ID para Notificações
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={settings.notifications.telegramChatId}
                  onChange={(e) => updateSetting('notifications', 'telegramChatId', e.target.value)}
                  placeholder="ID do chat para receber notificações"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Tipos de Notificação</h3>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.notifications.enableEmailNotifications}
                  onChange={(e) => updateSetting('notifications', 'enableEmailNotifications', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Habilitar notificações por email
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.notifications.enableTelegramNotifications}
                  onChange={(e) => updateSetting('notifications', 'enableTelegramNotifications', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Habilitar notificações via Telegram
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.notifications.notifyNewUsers}
                  onChange={(e) => updateSetting('notifications', 'notifyNewUsers', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Notificar sobre novos usuários
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={settings.notifications.notifyNewPayments}
                  onChange={(e) => updateSetting('notifications', 'notifyNewPayments', e.target.checked)}
                />
                <label className="ml-2 text-sm text-gray-300">
                  Notificar sobre novos pagamentos
                </label>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Configurações do Sistema</h1>
          {saved && (
            <div className="text-green-400 text-sm">
              ✓ Configurações salvas com sucesso
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="card">
          {renderTabContent()}
          
          {/* Save Button */}
          <div className="mt-8 pt-6 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-400">
                {connectionStatus === 'success' && (
                  <span className="text-green-400">✓ Stripe conectado</span>
                )}
                {connectionStatus === 'error' && (
                  <span className="text-red-400">✗ Erro na conexão Stripe</span>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="card">
          <h2 className="text-xl font-bold text-white mb-6">Status do Sistema</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center justify-between p-6 bg-dark-800/50 border border-dark-600 rounded-xl hover:bg-dark-800/70 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-white">PIX</p>
                  <p className="text-sm text-gray-400">Pagamentos</p>
                </div>
              </div>
              <Badge
                variant={settings.payment.enablePix && settings.payment.pixKey ? 'success' : 'warning'}
                size="sm"
              >
                {settings.payment.enablePix && settings.payment.pixKey ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-6 bg-dark-800/50 border border-dark-600 rounded-xl hover:bg-dark-800/70 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-white">Stripe</p>
                  <p className="text-sm text-gray-400">Cartões</p>
                </div>
              </div>
              <Badge
                variant={
                  settings.payment.enableCard && settings.payment.stripeSecretKey
                    ? connectionStatus === 'success' ? 'success' : 'warning'
                    : 'default'
                }
                size="sm"
              >
                {settings.payment.enableCard && settings.payment.stripeSecretKey
                  ? connectionStatus === 'success' ? 'Conectado' : 'Pendente'
                  : 'Inativo'
                }
              </Badge>
            </div>

            <div className="flex items-center justify-between p-6 bg-dark-800/50 border border-dark-600 rounded-xl hover:bg-dark-800/70 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-white">Streaming</p>
                  <p className="text-sm text-gray-400">CDN</p>
                </div>
              </div>
              <Badge variant="success" size="sm">
                Operacional
              </Badge>
            </div>

            <div className="flex items-center justify-between p-6 bg-dark-800/50 border border-dark-600 rounded-xl hover:bg-dark-800/70 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-white">Telegram</p>
                  <p className="text-sm text-gray-400">Bot</p>
                </div>
              </div>
              <Badge
                variant={settings.notifications.telegramBotToken ? 'success' : 'warning'}
                size="sm"
              >
                {settings.notifications.telegramBotToken ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}