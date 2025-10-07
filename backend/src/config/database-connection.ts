import { Pool } from 'pg';
import * as dns from 'dns';

/**
 * Configuração robusta de conexão com Supabase
 * Implementa retry, pooling e fallbacks para resolver problemas de conectividade
 */

// Configurar DNS para preferir IPv4
dns.setDefaultResultOrder('ipv4first');

export class DatabaseConnection {
  private static pool: Pool | null = null;
  private static retryCount = 0;
  private static maxRetries = 5;
  private static retryDelay = 2000; // 2 segundos

  /**
   * Cria um pool de conexões com configurações otimizadas
   */
  static createPool(): Pool {
    if (this.pool) {
      return this.pool;
    }

    const connectionString = process.env.SUPABASE_DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('SUPABASE_DATABASE_URL não está configurada');
    }

    this.pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      // Configurações de pool otimizadas
      max: 20, // máximo de conexões no pool
      min: 2,  // mínimo de conexões mantidas
      idleTimeoutMillis: 30000, // 30 segundos
      connectionTimeoutMillis: 10000, // 10 segundos para conectar
      
      // Configurações de retry
      query_timeout: 30000, // 30 segundos para queries
      statement_timeout: 30000,
      
      // Configurações de keep-alive
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Event listeners para monitoramento
    this.pool.on('connect', (client) => {
      console.log('✅ Nova conexão estabelecida com Supabase');
      this.retryCount = 0; // Reset retry count on successful connection
    });

    this.pool.on('error', (err) => {
      console.error('❌ Erro no pool de conexões:', err.message);
      this.handleConnectionError(err);
    });

    this.pool.on('remove', () => {
      console.log('🔄 Conexão removida do pool');
    });

    return this.pool;
  }

  /**
   * Testa a conectividade com retry automático
   */
  static async testConnection(): Promise<boolean> {
    const pool = this.createPool();
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Tentativa de conexão ${attempt}/${this.maxRetries}...`);
        
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
        
        console.log('✅ Conexão com Supabase estabelecida!');
        console.log('📊 Informações do banco:', {
          timestamp: result.rows[0].current_time,
          version: result.rows[0].pg_version.split(' ')[0]
        });
        
        client.release();
        return true;
        
      } catch (error: any) {
        console.error(`❌ Tentativa ${attempt} falhou:`, error.message);
        
        if (attempt === this.maxRetries) {
          console.error('💥 Todas as tentativas falharam');
          return false;
        }
        
        // Aguardar antes da próxima tentativa
        await this.delay(this.retryDelay * attempt);
      }
    }
    
    return false;
  }

  /**
   * Obtém uma conexão do pool com retry
   */
  static async getConnection() {
    const pool = this.createPool();
    
    try {
      return await pool.connect();
    } catch (error: any) {
      console.error('❌ Erro ao obter conexão do pool:', error.message);
      
      // Se for erro de DNS, tentar reconfigurar
      if (error.code === 'ENOTFOUND') {
        await this.reconfigureDNS();
      }
      
      throw error;
    }
  }

  /**
   * Fecha o pool de conexões
   */
  static async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('🔒 Pool de conexões fechado');
    }
  }

  /**
   * Reconfiguração DNS em caso de falha
   */
  private static async reconfigureDNS(): Promise<void> {
    console.log('🔧 Reconfigurando DNS...');
    
    // Limpar cache DNS
    dns.setDefaultResultOrder('ipv4first');
    
    // Tentar com servidores DNS alternativos
    const dnsServers = [
      ['8.8.8.8', '8.8.4.4'], // Google
      ['1.1.1.1', '1.0.0.1'], // Cloudflare
      ['208.67.222.222', '208.67.220.220'], // OpenDNS
    ];
    
    for (const servers of dnsServers) {
      try {
        dns.setServers(servers);
        console.log(`🌐 Tentando DNS: ${servers.join(', ')}`);
        await this.delay(1000);
        break;
      } catch (error) {
        console.log(`❌ DNS ${servers.join(', ')} falhou`);
      }
    }
  }

  /**
   * Manipula erros de conexão
   */
  private static handleConnectionError(error: any): void {
    this.retryCount++;
    
    if (error.code === 'ENOTFOUND') {
      console.log('🔍 Erro DNS detectado, tentando reconfiguração...');
      this.reconfigureDNS();
    } else if (error.code === 'ENETUNREACH') {
      console.log('🌐 Erro de rede detectado, verificando conectividade...');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('🚫 Conexão recusada, verificando credenciais...');
    }
    
    if (this.retryCount >= this.maxRetries) {
      console.error('💥 Limite de tentativas excedido, reiniciando pool...');
      this.pool?.end();
      this.pool = null;
      this.retryCount = 0;
    }
  }

  /**
   * Utilitário para delay
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtém estatísticas do pool
   */
  static getPoolStats() {
    if (!this.pool) {
      return null;
    }
    
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}