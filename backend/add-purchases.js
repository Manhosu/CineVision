require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addPurchases() {
  try {
    console.log('🔍 Buscando usuário com telegram_id 2006803983...\n');

    // 1. Buscar usuário
    const userResult = await pool.query(`
      SELECT id, username, telegram_id, email
      FROM users
      WHERE telegram_id = '2006803983'
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ Usuário não encontrado!');
      await pool.end();
      return;
    }

    const user = userResult.rows[0];
    console.log('✅ Usuário encontrado:');
    console.log('   ID:', user.id);
    console.log('   Username:', user.username);
    console.log('   Telegram ID:', user.telegram_id);
    console.log('   Email:', user.email);

    // 2. Buscar Superman
    console.log('\n🔍 Buscando filme Superman...');
    const supermanResult = await pool.query(`
      SELECT id, title, content_type, status
      FROM content
      WHERE title ILIKE '%superman%' AND content_type = 'movie'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    let supermanId = null;
    if (supermanResult.rows.length > 0) {
      supermanId = supermanResult.rows[0].id;
      console.log('✅ Superman encontrado:');
      console.log('   ID:', supermanResult.rows[0].id);
      console.log('   Título:', supermanResult.rows[0].title);
      console.log('   Tipo:', supermanResult.rows[0].content_type);
      console.log('   Status:', supermanResult.rows[0].status);
    } else {
      console.log('❌ Filme Superman não encontrado!');
    }

    // 3. Buscar Wandinha
    console.log('\n🔍 Buscando série Wandinha...');
    const wandinhaResult = await pool.query(`
      SELECT id, title, content_type, status
      FROM content
      WHERE title ILIKE '%wandinha%' AND content_type = 'series'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    let wandinhaId = null;
    if (wandinhaResult.rows.length > 0) {
      wandinhaId = wandinhaResult.rows[0].id;
      console.log('✅ Wandinha encontrada:');
      console.log('   ID:', wandinhaResult.rows[0].id);
      console.log('   Título:', wandinhaResult.rows[0].title);
      console.log('   Tipo:', wandinhaResult.rows[0].content_type);
      console.log('   Status:', wandinhaResult.rows[0].status);
    } else {
      console.log('❌ Série Wandinha não encontrada!');
    }

    // 4. Verificar compras existentes
    console.log('\n🔍 Verificando compras existentes...');
    const existingPurchases = await pool.query(`
      SELECT content_id, status, created_at
      FROM purchases
      WHERE user_id = $1
    `, [user.id]);

    console.log(`✅ Encontradas ${existingPurchases.rows.length} compras existentes`);
    existingPurchases.rows.forEach(p => {
      console.log(`   - Content ID: ${p.content_id}, Status: ${p.status}`);
    });

    const existingContentIds = existingPurchases.rows.map(p => p.content_id);

    // 5. Adicionar Superman se necessário
    if (supermanId && !existingContentIds.includes(supermanId)) {
      console.log('\n📦 Adicionando compra do Superman...');
      await pool.query(`
        INSERT INTO purchases (
          user_id, content_id, amount_cents, currency, status, created_at, updated_at
        ) VALUES ($1, $2, 0, 'BRL', 'COMPLETED', NOW(), NOW())
      `, [user.id, supermanId]);
      console.log('✅ Compra do Superman adicionada!');
    } else if (supermanId) {
      console.log('\n✅ Superman já está no dashboard do usuário');
    }

    // 6. Adicionar Wandinha se necessário
    if (wandinhaId && !existingContentIds.includes(wandinhaId)) {
      console.log('\n📦 Adicionando compra da Wandinha...');
      await pool.query(`
        INSERT INTO purchases (
          user_id, content_id, amount_cents, currency, status, created_at, updated_at
        ) VALUES ($1, $2, 0, 'BRL', 'COMPLETED', NOW(), NOW())
      `, [user.id, wandinhaId]);
      console.log('✅ Compra da Wandinha adicionada!');
    } else if (wandinhaId) {
      console.log('\n✅ Wandinha já está no dashboard do usuário');
    }

    // 7. Listar todas as compras atuais
    console.log('\n📋 COMPRAS ATUAIS DO USUÁRIO:');
    const finalPurchases = await pool.query(`
      SELECT p.id, c.title, c.content_type, p.status, p.created_at
      FROM purchases p
      JOIN content c ON c.id = p.content_id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
    `, [user.id]);

    console.log(`\nTotal: ${finalPurchases.rows.length} compras`);
    finalPurchases.rows.forEach((p, index) => {
      console.log(`\n${index + 1}. ${p.title}`);
      console.log(`   Tipo: ${p.content_type}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Comprado em: ${p.created_at}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ CONCLUÍDO!');
    console.log('='.repeat(60));
    console.log('\n🔗 Acesse o dashboard em:');
    console.log('https://cine-vision-murex.vercel.app/auth/telegram-login?telegram_id=2006803983&redirect=/dashboard');
    console.log('');

    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

addPurchases();
