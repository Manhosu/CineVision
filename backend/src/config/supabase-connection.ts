import { Pool, PoolConfig } from 'pg';
import * as dns from 'dns';

export class SupabaseConnection {
  private static instance: SupabaseConnection;
  private pool: Pool | null = null;

  private constructor() {}

  public static getInstance(): SupabaseConnection {
    if (!SupabaseConnection.instance) {
      SupabaseConnection.instance = new SupabaseConnection();
    }
    return SupabaseConnection.instance;
  }

  /**
   * Configura DNS para melhor compatibilidade com Supabase
   */
  private configureDNS(): void {
    // Usar DNS públicos que têm melhor suporte IPv6/IPv4
    dns.setServers([
      '8.8.8.8',      // Google DNS
      '8.8.4.4',      // Google DNS secundário
      '1.1.1.1',      // Cloudflare DNS
      '1.0.0.1',      // Cloudflare DNS secundário
      '208.67.222.222', // OpenDNS
      '208.67.220.220'  // OpenDNS secundário
    ]);

    // Preferir IPv4 quando possível
    dns.setDefaultResultOrder('ipv4first');
    
    console.log('✅ DNS configurado para melhor compatibilidade');
  }

  /**
   * Cria conexão robusta com Supabase usando múltiplas estratégias
   */
  public async createConnection(connectionString: string): Promise<Pool> {
    this.configureDNS();

    const strategies = [
      () => this.tryDirectConnection(connectionString),
      () => this.tryWithCustomDNS(connectionString),
      () => this.tryWithIPResolution(connectionString),
      () => this.tryWithProxy(connectionString)
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`🔄 Tentativa ${i + 1}/${strategies.length}...`);
        const pool = await strategies[i]();
        
        // Testar a conexão
        const client = await pool.connect();
        await client.query('SELECT 1 as test');
        client.release();
        
        console.log(`✅ Estratégia ${i + 1} funcionou!`);
        this.pool = pool;
        return pool;
        
      } catch (error) {
        console.log(`❌ Estratégia ${i + 1} falhou:`, error.message);
        if (i === strategies.length - 1) {
          throw new Error(`Todas as estratégias de conexão falharam. Último erro: ${error.message}`);
        }
      }
    }

    throw new Error('Não foi possível estabelecer conexão com Supabase');
  }

  /**
   * Estratégia 1: Conexão direta padrão
   */
  private async tryDirectConnection(connectionString: string): Promise<Pool> {
    console.log('📡 Tentando conexão direta...');
    
    return new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });
  }

  /**
   * Estratégia 2: Usar DNS customizado com timeout maior
   */
  private async tryWithCustomDNS(connectionString: string): Promise<Pool> {
    console.log('🌐 Tentando com DNS customizado...');
    
    return new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 15,
      min: 1,
      idleTimeoutMillis: 45000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 15000,
      // Configurações específicas para DNS
      options: '-c statement_timeout=30000 -c idle_in_transaction_session_timeout=30000',
    });
  }

  /**
   * Estratégia 3: Resolver IP manualmente e usar endereço direto
   */
  private async tryWithIPResolution(connectionString: string): Promise<Pool> {
    console.log('🔍 Tentando resolução manual de IP...');
    
    const url = new URL(connectionString);
    const hostname = url.hostname;
    
    // Tentar resolver IPv4 primeiro
    try {
      const addresses = await this.resolveIPv4(hostname);
      if (addresses.length > 0) {
        url.hostname = addresses[0];
        const ipConnectionString = url.toString();
        console.log(`📊 Usando IP direto: ${addresses[0]}`);
        
        return new Pool({
          connectionString: ipConnectionString,
          ssl: { rejectUnauthorized: false },
          max: 10,
          min: 1,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
          keepAlive: true,
        });
      }
    } catch (error) {
      console.log('⚠️ Resolução IPv4 falhou, tentando IPv6...');
    }

    // Se IPv4 falhar, tentar IPv6 com configurações especiais
    try {
      const addresses = await this.resolveIPv6(hostname);
      if (addresses.length > 0) {
        url.hostname = `[${addresses[0]}]`; // IPv6 precisa de colchetes
        const ipv6ConnectionString = url.toString();
        console.log(`📊 Usando IPv6 direto: ${addresses[0]}`);
        
        return new Pool({
          connectionString: ipv6ConnectionString,
          ssl: { rejectUnauthorized: false },
          max: 5,
          min: 1,
          idleTimeoutMillis: 20000,
          connectionTimeoutMillis: 25000,
          keepAlive: false, // Desabilitar keep-alive para IPv6
        });
      }
    } catch (error) {
      throw new Error('Não foi possível resolver IP do hostname');
    }

    throw new Error('Nenhum endereço IP encontrado');
  }

  /**
   * Estratégia 4: Usar configurações de proxy/fallback
   */
  private async tryWithProxy(connectionString: string): Promise<Pool> {
    console.log('🔄 Tentando configuração de fallback...');
    
    // Configurações mais conservadoras para ambientes restritivos
    return new Pool({
      connectionString,
      ssl: { 
        rejectUnauthorized: false,
        // Configurações SSL mais permissivas
        checkServerIdentity: () => undefined,
      },
      max: 5,
      min: 1,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 30000,
      keepAlive: false,
      // Configurações PostgreSQL específicas
      options: '-c tcp_keepalives_idle=600 -c tcp_keepalives_interval=30 -c tcp_keepalives_count=3',
    });
  }

  /**
   * Resolve IPv4 addresses
   */
  private resolveIPv4(hostname: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      dns.resolve4(hostname, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
  }

  /**
   * Resolve IPv6 addresses
   */
  private resolveIPv6(hostname: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      dns.resolve6(hostname, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
  }

  public getPool(): Pool | null {
    return this.pool;
  }

  public async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('🔒 Pool Supabase fechado');
    }
  }

  /**
   * Testa a conexão e retorna informações do banco
   */
  public async testConnection(): Promise<any> {
    if (!this.pool) {
      throw new Error('Pool não inicializado');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          NOW() as current_time,
          current_database() as database_name,
          current_user as user_name,
          version() as pg_version,
          inet_server_addr() as server_ip
      `);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }
}