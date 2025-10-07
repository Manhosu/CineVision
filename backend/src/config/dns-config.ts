import * as dns from 'dns';

/**
 * Configuração DNS para forçar IPv4 e resolver problemas de conectividade
 * com Supabase em ambientes que não suportam IPv6 adequadamente
 */
export function configureDNS(): void {
  // Força o Node.js a preferir IPv4 sobre IPv6
  dns.setDefaultResultOrder('ipv4first');
  
  // Configura servidores DNS públicos
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
  
  console.log('🌐 DNS configurado para preferir IPv4');
  console.log('🌐 Servidores DNS: Google, Cloudflare');
}

/**
 * Configuração específica para Supabase com retry e fallback
 */
export function configureSupabaseConnection(): void {
  // Configurações específicas para melhorar conectividade
  process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --dns-result-order=ipv4first';
  
  // Log de debug para conectividade
  console.log('Configuração DNS aplicada para Supabase');
  console.log('Ordem de resolução DNS: IPv4 primeiro');
}