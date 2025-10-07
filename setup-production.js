#!/usr/bin/env node

/**
 * 🚀 CineVision - Script de Configuração para Produção
 * 
 * Este script automatiza a configuração das variáveis de ambiente
 * e a configuração do webhook do Telegram para produção.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

class ProductionSetup {
  constructor() {
    this.config = {};
    this.envPath = path.join(__dirname, '.env.production');
  }

  async run() {
    console.log('🚀 CineVision - Configuração para Produção\n');
    
    try {
      await this.collectConfiguration();
      await this.generateEnvFile();
      await this.setupTelegramWebhook();
      await this.validateConfiguration();
      
      console.log('\n✅ Configuração concluída com sucesso!');
      console.log('📋 Próximos passos:');
      console.log('1. Deploy do backend com as variáveis configuradas');
      console.log('2. Deploy do frontend');
      console.log('3. Deploy do bot');
      console.log('4. Executar testes de produção');
      
    } catch (error) {
      console.error('❌ Erro na configuração:', error.message);
    } finally {
      rl.close();
    }
  }

  async collectConfiguration() {
    console.log('📝 Coletando informações de configuração...\n');

    // URLs de produção
    this.config.BACKEND_URL = await question('🌐 URL do backend em produção (ex: https://api.cinevision.com): ');
    this.config.FRONTEND_URL = await question('🌐 URL do frontend em produção (ex: https://cinevision.com): ');
    
    // Telegram
    this.config.TELEGRAM_BOT_TOKEN = await question('🤖 Token do bot do Telegram: ');
    
    // Database (Supabase)
    console.log('\n📊 Configuração do Database (Supabase):');
    this.config.SUPABASE_URL = await question('🔗 URL do Supabase: ');
    this.config.SUPABASE_ANON_KEY = await question('🔑 Anon Key do Supabase: ');
    this.config.SUPABASE_SERVICE_ROLE_KEY = await question('🔑 Service Role Key do Supabase: ');
    this.config.SUPABASE_DB_PASSWORD = await question('🔒 Senha do database: ');
    
    // Segurança
    console.log('\n🔐 Configuração de Segurança:');
    this.config.JWT_SECRET = await question('🔑 JWT Secret (deixe vazio para gerar automaticamente): ') || this.generateSecret();
    this.config.JWT_REFRESH_SECRET = await question('🔑 JWT Refresh Secret (deixe vazio para gerar automaticamente): ') || this.generateSecret();
    this.config.WEBHOOK_SECRET = await question('🔑 Webhook Secret (deixe vazio para gerar automaticamente): ') || this.generateSecret();
    
    // Pagamentos
    this.config.PAYMENT_PROVIDER_KEY = await question('💳 Chave do provedor de pagamento: ');
    
    console.log('\n✅ Configuração coletada!');
  }

  generateSecret() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  async generateEnvFile() {
    console.log('\n📄 Gerando arquivo .env.production...');

    const projectId = this.extractSupabaseProjectId(this.config.SUPABASE_URL);
    
    const envContent = `# ==============================================
# CINE VISION - PRODUCTION ENVIRONMENT
# Generated on ${new Date().toISOString()}
# ==============================================

# ==============================================
# ENVIRONMENT
# ==============================================
NODE_ENV=production
BASE_URL=${this.config.FRONTEND_URL}

# ==============================================
# DATABASE CONFIGURATION - SUPABASE
# ==============================================
DATABASE_TYPE=postgres
SUPABASE_DATABASE_URL=postgresql://postgres:${this.config.SUPABASE_DB_PASSWORD}@db.${projectId}.supabase.co:5432/postgres
SUPABASE_DB_HOST=db.${projectId}.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_USERNAME=postgres
SUPABASE_DB_PASSWORD=${this.config.SUPABASE_DB_PASSWORD}
SUPABASE_DB_NAME=postgres

# Supabase Project Configuration
SUPABASE_URL=${this.config.SUPABASE_URL}
SUPABASE_ANON_KEY=${this.config.SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${this.config.SUPABASE_SERVICE_ROLE_KEY}

# ==============================================
# JWT AUTHENTICATION
# ==============================================
JWT_SECRET=${this.config.JWT_SECRET}
JWT_REFRESH_SECRET=${this.config.JWT_REFRESH_SECRET}

# ==============================================
# TELEGRAM BOT CONFIGURATION
# ==============================================
TELEGRAM_BOT_TOKEN=${this.config.TELEGRAM_BOT_TOKEN}
TELEGRAM_WEBHOOK_URL=${this.config.BACKEND_URL}/telegrams/webhook

# ==============================================
# WEBHOOK CONFIGURATION
# ==============================================
WEBHOOK_SECRET=${this.config.WEBHOOK_SECRET}

# ==============================================
# PAYMENT PROVIDER CONFIGURATION
# ==============================================
PAYMENT_PROVIDER_KEY=${this.config.PAYMENT_PROVIDER_KEY}

# ==============================================
# CORS CONFIGURATION
# ==============================================
CORS_ORIGIN=${this.config.FRONTEND_URL}

# ==============================================
# BOT CONFIGURATION
# ==============================================
BOT_PORT=3003
WEBHOOK_URL=${this.config.BACKEND_URL}/webhook/telegram
`;

    fs.writeFileSync(this.envPath, envContent);
    console.log(`✅ Arquivo criado: ${this.envPath}`);
  }

  extractSupabaseProjectId(url) {
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    return match ? match[1] : 'PROJECT_ID';
  }

  async setupTelegramWebhook() {
    console.log('\n🤖 Configurando webhook do Telegram...');
    
    try {
      const webhookUrl = `${this.config.BACKEND_URL}/telegrams/webhook`;
      
      // Configurar webhook via API do Telegram
      const telegramApiUrl = `https://api.telegram.org/bot${this.config.TELEGRAM_BOT_TOKEN}/setWebhook`;
      
      const response = await axios.post(telegramApiUrl, {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query', 'pre_checkout_query']
      });

      if (response.data.ok) {
        console.log('✅ Webhook do Telegram configurado com sucesso!');
        console.log(`📡 URL: ${webhookUrl}`);
      } else {
        console.log('⚠️ Erro ao configurar webhook:', response.data.description);
      }
    } catch (error) {
      console.log('⚠️ Não foi possível configurar o webhook automaticamente.');
      console.log('📋 Configure manualmente após o deploy do backend:');
      console.log(`curl -X POST https://api.telegram.org/bot${this.config.TELEGRAM_BOT_TOKEN}/setWebhook \\`);
      console.log(`  -d "url=${this.config.BACKEND_URL}/telegrams/webhook"`);
    }
  }

  async validateConfiguration() {
    console.log('\n🔍 Validando configuração...');
    
    const validations = [
      { name: 'Backend URL', value: this.config.BACKEND_URL, valid: this.isValidUrl(this.config.BACKEND_URL) },
      { name: 'Frontend URL', value: this.config.FRONTEND_URL, valid: this.isValidUrl(this.config.FRONTEND_URL) },
      { name: 'Telegram Token', value: this.config.TELEGRAM_BOT_TOKEN, valid: this.isValidTelegramToken(this.config.TELEGRAM_BOT_TOKEN) },
      { name: 'Supabase URL', value: this.config.SUPABASE_URL, valid: this.isValidUrl(this.config.SUPABASE_URL) },
      { name: 'JWT Secret', value: '***', valid: this.config.JWT_SECRET.length >= 32 },
      { name: 'Webhook Secret', value: '***', valid: this.config.WEBHOOK_SECRET.length >= 32 }
    ];

    validations.forEach(validation => {
      const status = validation.valid ? '✅' : '❌';
      console.log(`${status} ${validation.name}: ${validation.value}`);
    });

    const allValid = validations.every(v => v.valid);
    if (!allValid) {
      console.log('\n⚠️ Algumas configurações podem estar incorretas. Verifique antes do deploy.');
    }
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return url.startsWith('https://');
    } catch {
      return false;
    }
  }

  isValidTelegramToken(token) {
    return /^\d+:[A-Za-z0-9_-]+$/.test(token);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  new ProductionSetup().run();
}

module.exports = ProductionSetup;