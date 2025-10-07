require('dotenv').config();

// Simular o módulo TypeScript
const { Pool } = require('pg');
const dns = require('dns');

class SupabaseConnection {
  constructor() {
    this.pool = null;
  }

  configureDNS() {
    dns.setServers([
      '8.8.8.8',
      '8.8.4.4',
      '1.1.1.1',
      '1.0.0.1',
      '208.67.222.222',
      '208.67.220.220'
    ]);

    dns.setDefaultResultOrder('ipv4first');
    console.log('✅ DNS configurado para melhor compatibilidade');
  }

  async createConnection(connectionString) {
    this.configureDNS();

    const strategies = [
      () => this.tryDirectConnection(connectionString),
      () => this.tryWithCustomDNS(connectionString),
      () => this.tryWithIPResolution(connectionString),
      () => this.tryWithProxy(connectionString)
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`🔄 Estratégia ${i + 1}/${strategies.length}...`);
        const pool = await strategies[i]();
        
        const client = await pool.connect();
        await client.query('SELECT 1 as test');
        client.release();
        
        console.log(`✅ Estratégia ${i + 1} funcionou!`);
        this.pool = pool;
        return pool;
        
      } catch (error) {
        console.log(`❌ Estratégia ${i + 1} falhou:`, error.message);
        if (i === strategies.length - 1) {
          throw new Error(`Todas as estratégias falharam. Último erro: ${error.message}`);
        }
      }
    }
  }

  async tryDirectConnection(connectionString) {
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

  async tryWithCustomDNS(connectionString) {
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
      options: '-c statement_timeout=30000 -c idle_in_transaction_session_timeout=30000',
    });
  }

  async tryWithIPResolution(connectionString) {
    console.log('🔍 Tentando resolução manual de IP...');
    
    const url = new URL(connectionString);
    const hostname = url.hostname;
    
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

    try {
      const addresses = await this.resolveIPv6(hostname);
      if (addresses.length > 0) {
        url.hostname = `[${addresses[0]}]`;
        const ipv6ConnectionString = url.toString();
        console.log(`📊 Usando IPv6 direto: ${addresses[0]}`);
        
        return new Pool({
          connectionString: ipv6ConnectionString,
          ssl: { rejectUnauthorized: false },
          max: 5,
          min: 1,
          idleTimeoutMillis: 20000,
          connectionTimeoutMillis: 25000,
          keepAlive: false,
        });
      }
    } catch (error) {
      throw new Error('Não foi possível resolver IP do hostname');
    }

    throw new Error('Nenhum endereço IP encontrado');
  }

  async tryWithProxy(connectionString) {
    console.log('🔄 Tentando configuração de fallback...');
    
    return new Pool({
      connectionString,
      ssl: { 
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      },
      max: 5,
      min: 1,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 30000,
      keepAlive: false,
      options: '-c tcp_keepalives_idle=600 -c tcp_keepalives_interval=30 -c tcp_keepalives_count=3',
    });
  }

  resolveIPv4(hostname) {
    return new Promise((resolve, reject) => {
      dns.resolve4(hostname, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
  }

  resolveIPv6(hostname) {
    return new Promise((resolve, reject) => {
      dns.resolve6(hostname, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
  }

  async testConnection() {
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

  async closePool() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('🔒 Pool Supabase fechado');
    }
  }
}

// Executar teste
async function testSupabaseStrategies() {
  console.log('🚀 Testando estratégias de conexão com Supabase...');
  
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    console.error('❌ SUPABASE_DATABASE_URL não configurada');
    process.exit(1);
  }

  const supabase = new SupabaseConnection();
  
  try {
    await supabase.createConnection(connectionString);
    
    console.log('\n📊 Testando funcionalidades...');
    const info = await supabase.testConnection();
    
    console.log('✅ Informações do banco:');
    console.log('   - Timestamp:', info.current_time);
    console.log('   - Database:', info.database_name);
    console.log('   - User:', info.user_name);
    console.log('   - Version:', info.pg_version.split(' ')[0]);
    console.log('   - Server IP:', info.server_ip);
    
    console.log('\n🎉 Conexão com Supabase estabelecida com sucesso!');
    console.log('✅ Sistema pronto para produção');
    
    await supabase.closePool();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Todas as estratégias falharam:', error.message);
    console.log('\n💡 Possíveis soluções:');
    console.log('   1. Verificar conectividade com internet');
    console.log('   2. Verificar configurações de firewall');
    console.log('   3. Verificar se o projeto Supabase está ativo');
    console.log('   4. Tentar de uma rede diferente');
    console.log('   5. Contatar suporte do Supabase');
    
    await supabase.closePool();
    process.exit(1);
  }
}

testSupabaseStrategies();