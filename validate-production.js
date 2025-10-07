#!/usr/bin/env node

/**
 * 🧪 CineVision - Script de Validação de Produção
 * 
 * Este script executa testes de integração em produção
 * para validar que todos os serviços estão funcionando.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ProductionValidator {
  constructor() {
    this.loadConfig();
    this.results = [];
  }

  loadConfig() {
    const envPath = path.join(__dirname, '.env.production');
    if (!fs.existsSync(envPath)) {
      throw new Error('Arquivo .env.production não encontrado. Execute setup-production.js primeiro.');
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    this.config = {};
    
    envContent.split('\n').forEach(line => {
      if (line.includes('=') && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        this.config[key.trim()] = value.trim();
      }
    });
  }

  async run() {
    console.log('🧪 CineVision - Validação de Produção\n');
    
    try {
      await this.testFrontend();
      await this.testBackendHealth();
      await this.testBackendEndpoints();
      await this.testTelegramWebhook();
      await this.testDatabase();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Erro na validação:', error.message);
    }
  }

  async testFrontend() {
    console.log('🌐 Testando Frontend...');
    
    try {
      const response = await axios.get(this.config.BASE_URL, { timeout: 10000 });
      
      if (response.status === 200) {
        this.addResult('Frontend', '✅', 'Acessível e respondendo');
      } else {
        this.addResult('Frontend', '⚠️', `Status: ${response.status}`);
      }
    } catch (error) {
      this.addResult('Frontend', '❌', `Erro: ${error.message}`);
    }
  }

  async testBackendHealth() {
    console.log('🔧 Testando Backend - Health Check...');
    
    const backendUrl = this.config.BASE_URL.replace('cinevision.com', 'api.cinevision.com');
    
    try {
      // Teste de conectividade básica
      const response = await axios.get(`${backendUrl}/simple-test/ping`, { timeout: 10000 });
      
      if (response.data.message === 'pong') {
        this.addResult('Backend Health', '✅', 'Respondendo corretamente');
      } else {
        this.addResult('Backend Health', '⚠️', 'Resposta inesperada');
      }
    } catch (error) {
      this.addResult('Backend Health', '❌', `Erro: ${error.message}`);
    }
  }

  async testBackendEndpoints() {
    console.log('🔗 Testando Endpoints do Backend...');
    
    const backendUrl = this.config.BASE_URL.replace('cinevision.com', 'api.cinevision.com');
    
    const endpoints = [
      { name: 'Telegram Webhook Setup', url: '/telegrams/setup-webhook', method: 'POST' },
      { name: 'Telegram Send Notification', url: '/telegrams/send-notification', method: 'POST' },
      { name: 'Telegram Payment Confirmation', url: '/telegrams/payment-confirmation', method: 'POST' },
      { name: 'Telegram New Release', url: '/telegrams/new-release-notification', method: 'POST' }
    ];

    for (const endpoint of endpoints) {
      try {
        const testData = this.getTestData(endpoint.name);
        const response = await axios({
          method: endpoint.method,
          url: `${backendUrl}${endpoint.url}`,
          data: testData,
          timeout: 10000,
          validateStatus: () => true // Aceitar qualquer status
        });

        if (response.status >= 200 && response.status < 300) {
          this.addResult(`Endpoint: ${endpoint.name}`, '✅', `Status: ${response.status}`);
        } else if (response.status === 404) {
          this.addResult(`Endpoint: ${endpoint.name}`, '⚠️', 'Endpoint não encontrado');
        } else {
          this.addResult(`Endpoint: ${endpoint.name}`, '⚠️', `Status: ${response.status}`);
        }
      } catch (error) {
        this.addResult(`Endpoint: ${endpoint.name}`, '❌', `Erro: ${error.message}`);
      }
    }
  }

  async testTelegramWebhook() {
    console.log('🤖 Testando Webhook do Telegram...');
    
    try {
      const telegramApiUrl = `https://api.telegram.org/bot${this.config.TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
      const response = await axios.get(telegramApiUrl, { timeout: 10000 });
      
      if (response.data.ok) {
        const webhookInfo = response.data.result;
        
        if (webhookInfo.url) {
          this.addResult('Telegram Webhook', '✅', `Configurado: ${webhookInfo.url}`);
          
          if (webhookInfo.has_custom_certificate) {
            this.addResult('Webhook Certificate', '✅', 'Certificado personalizado');
          }
          
          if (webhookInfo.pending_update_count > 0) {
            this.addResult('Webhook Updates', '⚠️', `${webhookInfo.pending_update_count} atualizações pendentes`);
          } else {
            this.addResult('Webhook Updates', '✅', 'Nenhuma atualização pendente');
          }
        } else {
          this.addResult('Telegram Webhook', '❌', 'Webhook não configurado');
        }
      } else {
        this.addResult('Telegram Webhook', '❌', 'Erro ao verificar webhook');
      }
    } catch (error) {
      this.addResult('Telegram Webhook', '❌', `Erro: ${error.message}`);
    }
  }

  async testDatabase() {
    console.log('🗄️ Testando Conexão com Database...');
    
    try {
      // Teste básico de conectividade com Supabase
      const response = await axios.get(`${this.config.SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': this.config.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${this.config.SUPABASE_ANON_KEY}`
        },
        timeout: 10000
      });

      if (response.status === 200) {
        this.addResult('Database Connection', '✅', 'Supabase acessível');
      } else {
        this.addResult('Database Connection', '⚠️', `Status: ${response.status}`);
      }
    } catch (error) {
      this.addResult('Database Connection', '❌', `Erro: ${error.message}`);
    }
  }

  getTestData(endpointName) {
    const testData = {
      'Telegram Webhook Setup': { url: 'https://test.com/webhook' },
      'Telegram Send Notification': { userId: 'test', message: 'Test message' },
      'Telegram Payment Confirmation': { 
        movieId: 'test-movie',
        userId: 'test-user',
        amount: 1000
      },
      'Telegram New Release': {
        title: 'Test Movie',
        movieId: 'test-123',
        releaseDate: new Date().toISOString()
      }
    };

    return testData[endpointName] || {};
  }

  addResult(test, status, message) {
    this.results.push({ test, status, message });
    console.log(`${status} ${test}: ${message}`);
  }

  generateReport() {
    console.log('\n📊 Relatório de Validação\n');
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.status === '✅').length;
    const warnings = this.results.filter(r => r.status === '⚠️').length;
    const failed = this.results.filter(r => r.status === '❌').length;
    
    console.log(`✅ Testes Passaram: ${passed}`);
    console.log(`⚠️ Avisos: ${warnings}`);
    console.log(`❌ Falhas: ${failed}`);
    console.log(`📊 Total: ${this.results.length}`);
    
    console.log('\n📋 Detalhes:\n');
    this.results.forEach(result => {
      console.log(`${result.status} ${result.test}`);
      console.log(`   ${result.message}\n`);
    });

    // Salvar relatório em arquivo
    const reportPath = path.join(__dirname, 'production-validation-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: { passed, warnings, failed, total: this.results.length },
      results: this.results,
      config: {
        frontend: this.config.BASE_URL,
        backend: this.config.BASE_URL.replace('cinevision.com', 'api.cinevision.com'),
        supabase: this.config.SUPABASE_URL
      }
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Relatório salvo em: ${reportPath}`);

    // Recomendações
    console.log('\n💡 Recomendações:');
    
    if (failed > 0) {
      console.log('❌ Há falhas críticas que precisam ser corrigidas antes do lançamento.');
    }
    
    if (warnings > 0) {
      console.log('⚠️ Há avisos que devem ser investigados.');
    }
    
    if (passed === this.results.length) {
      console.log('🎉 Todos os testes passaram! Sistema pronto para produção.');
    }

    console.log('\n📋 Próximos passos:');
    console.log('1. Corrigir falhas identificadas');
    console.log('2. Investigar avisos');
    console.log('3. Configurar monitoramento');
    console.log('4. Executar testes de carga');
    console.log('5. Configurar alertas');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  new ProductionValidator().run();
}

module.exports = ProductionValidator;