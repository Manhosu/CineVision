// Script para decodificar e verificar um token JWT
// Uso: node verificar-token-jwt.js "seu-token-aqui"

const jwt = require('jsonwebtoken');

const token = process.argv[2];

if (!token) {
  console.log('❌ Erro: Forneça um token JWT como argumento\n');
  console.log('Uso: node verificar-token-jwt.js "seu-token-aqui"\n');
  console.log('Como obter o token:');
  console.log('1. Abra o navegador (F12 → Console)');
  console.log('2. Execute: localStorage.getItem("access_token")');
  console.log('3. Copie o token retornado\n');
  process.exit(1);
}

console.log('🔍 Analisando Token JWT...\n');
console.log('─'.repeat(80));

try {
  // Decodificar sem verificar assinatura (apenas para inspeção)
  const decoded = jwt.decode(token, { complete: true });

  if (!decoded) {
    console.log('❌ Token inválido ou malformado\n');
    process.exit(1);
  }

  console.log('📋 HEADER:');
  console.log(JSON.stringify(decoded.header, null, 2));
  console.log('\n📋 PAYLOAD:');
  console.log(JSON.stringify(decoded.payload, null, 2));

  // Verificar expiração
  if (decoded.payload.exp) {
    const expirationDate = new Date(decoded.payload.exp * 1000);
    const now = new Date();
    const isExpired = expirationDate < now;

    console.log('\n⏰ EXPIRAÇÃO:');
    console.log(`   Expira em: ${expirationDate.toLocaleString('pt-BR')}`);
    console.log(`   Agora: ${now.toLocaleString('pt-BR')}`);
    console.log(`   Status: ${isExpired ? '❌ EXPIRADO' : '✅ VÁLIDO'}`);

    if (isExpired) {
      const horasExpirado = Math.floor((now - expirationDate) / (1000 * 60 * 60));
      console.log(`   Expirou há: ${horasExpirado} hora(s)`);
    } else {
      const horasRestantes = Math.floor((expirationDate - now) / (1000 * 60 * 60));
      console.log(`   Expira em: ${horasRestantes} hora(s)`);
    }
  }

  // Verificar role
  console.log('\n👤 USUÁRIO:');
  console.log(`   ID: ${decoded.payload.sub || decoded.payload.userId || 'N/A'}`);
  console.log(`   Email: ${decoded.payload.email || 'N/A'}`);
  console.log(`   Role: ${decoded.payload.role || 'N/A'}`);

  if (decoded.payload.role !== 'admin') {
    console.log('\n⚠️  AVISO: Este token NÃO é de um usuário ADMIN!');
    console.log('   O endpoint /admin/broadcast requer role "admin"');
  } else {
    console.log('\n✅ Token de usuário ADMIN válido');
  }

  console.log('\n─'.repeat(80));
  console.log('✅ Análise concluída!\n');

} catch (error) {
  console.error('❌ Erro ao decodificar token:', error.message);
  console.log('\nO token pode estar malformado ou corrompido.\n');
  process.exit(1);
}
