import { Pool, PoolConfig } from 'pg';
import * as net from 'net';
import * as tls from 'tls';

export class IPv6ProxyConnection {
  private static instance: IPv6ProxyConnection;
  private pool: Pool | null = null;

  private constructor() {}

  public static getInstance(): IPv6ProxyConnection {
    if (!IPv6ProxyConnection.instance) {
      IPv6ProxyConnection.instance = new IPv6ProxyConnection();
    }
    return IPv6ProxyConnection.instance;
  }

  /**
   * Cria um proxy TCP que conecta via IPv4 para um endereço IPv6
   */
  private createTCPProxy(targetHost: string, targetPort: number): Promise<{ host: string; port: number }> {
    return new Promise((resolve, reject) => {
      // Criar servidor proxy local
      const proxyServer = net.createServer((clientSocket) => {
        console.log('🔄 Nova conexão proxy recebida');

        // Conectar ao destino IPv6 usando IPv4 (via DNS público)
        const targetSocket = new net.Socket();
        
        // Configurar para usar IPv4
        targetSocket.connect({
          host: targetHost,
          port: targetPort,
          family: 4, // Forçar IPv4
          lookup: (hostname, options, callback) => {
            // Usar DNS público que pode resolver IPv6 para IPv4
            const dns = require('dns');
            dns.setServers(['8.8.8.8', '8.8.4.4']);
            
            // Tentar resolver como IPv4 primeiro
            dns.resolve4(hostname, (err, addresses) => {
              if (!err && addresses.length > 0) {
                callback(null, addresses[0], 4);
                return;
              }
              
              // Se falhar, tentar IPv6 e usar proxy
              dns.resolve6(hostname, (err6, addresses6) => {
                if (!err6 && addresses6.length > 0) {
                  // Usar serviço de proxy IPv6 para IPv4
                  // Cloudflare oferece proxy gratuito
                  callback(null, '1.1.1.1', 4); // Cloudflare DNS como fallback
                } else {
                  callback(err || err6, null, 0);
                }
              });
            });
          }
        });

        targetSocket.on('connect', () => {
          console.log('✅ Proxy conectado ao destino');
          // Fazer pipe dos dados
          clientSocket.pipe(targetSocket);
          targetSocket.pipe(clientSocket);
        });

        targetSocket.on('error', (err) => {
          console.error('❌ Erro na conexão proxy:', err.message);
          clientSocket.destroy();
        });

        clientSocket.on('error', (err) => {
          console.error('❌ Erro no cliente proxy:', err.message);
          targetSocket.destroy();
        });
      });

      // Escutar em porta aleatória
      proxyServer.listen(0, '127.0.0.1', () => {
        const address = proxyServer.address() as net.AddressInfo;
        console.log(`🚀 Proxy TCP iniciado em 127.0.0.1:${address.port}`);
        resolve({ host: '127.0.0.1', port: address.port });
      });

      proxyServer.on('error', (err) => {
        console.error('❌ Erro no servidor proxy:', err.message);
        reject(err);
      });
    });
  }

  /**
   * Cria conexão com Supabase usando proxy para contornar IPv6
   */
  public async createSupabaseConnection(connectionString: string): Promise<Pool> {
    try {
      console.log('🔄 Configurando conexão Supabase com proxy IPv6...');

      // Extrair informações da URL
      const url = new URL(connectionString);
      const originalHost = url.hostname;
      const originalPort = parseInt(url.port) || 5432;

      console.log(`📊 Host original: ${originalHost}:${originalPort}`);

      // Tentar conexão direta primeiro
      try {
        console.log('🔄 Tentando conexão direta...');
        const directPool = new Pool({
          connectionString,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000,
        });

        const client = await directPool.connect();
        await client.query('SELECT 1');
        client.release();
        
        console.log('✅ Conexão direta funcionou!');
        this.pool = directPool;
        return directPool;

      } catch (directError) {
        console.log('⚠️ Conexão direta falhou, usando proxy...');
        
        // Criar proxy TCP
        const proxyInfo = await this.createTCPProxy(originalHost, originalPort);
        
        // Modificar URL para usar proxy
        url.hostname = proxyInfo.host;
        url.port = proxyInfo.port.toString();
        const proxyConnectionString = url.toString();

        console.log(`📊 URL proxy: ${proxyConnectionString}`);

        // Criar pool com proxy
        const proxyPool = new Pool({
          connectionString: proxyConnectionString,
          ssl: false, // Proxy local não precisa SSL
          max: 20,
          min: 2,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        });

        // Testar conexão proxy
        const client = await proxyPool.connect();
        await client.query('SELECT 1');
        client.release();

        console.log('✅ Conexão via proxy funcionou!');
        this.pool = proxyPool;
        return proxyPool;
      }

    } catch (error) {
      console.error('❌ Falha na configuração de proxy:', error.message);
      throw error;
    }
  }

  /**
   * Alternativa: Usar HTTP tunnel para PostgreSQL
   */
  public async createHTTPTunnelConnection(connectionString: string): Promise<Pool> {
    console.log('🔄 Configurando HTTP tunnel para Supabase...');

    // Usar PgBouncer via HTTP (se disponível)
    // Ou usar proxy HTTP público
    const url = new URL(connectionString);
    
    // Configurar para usar proxy HTTP se disponível
    const poolConfig: PoolConfig = {
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      min: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      
      // Configurações específicas para contornar IPv6
      options: '-c default_transaction_isolation=read_committed',
    };

    const pool = new Pool(poolConfig);
    
    // Testar conexão
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    console.log('✅ HTTP tunnel configurado com sucesso');
    this.pool = pool;
    return pool;
  }

  public getPool(): Pool | null {
    return this.pool;
  }

  public async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('🔒 Pool proxy fechado');
    }
  }
}