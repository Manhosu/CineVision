require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkEpisodes() {
  try {
    // Primeiro verificar a série
    const seriesResult = await pool.query(`
      SELECT id, title, content_type, status, created_at
      FROM content
      WHERE id = '08fc07e1-fe03-434e-8349-997d84a6e269'
    `);

    if (seriesResult.rows.length === 0) {
      console.log('❌ Série Wandinha não encontrada no banco!');
      await pool.end();
      return;
    }

    console.log('\n=== INFORMAÇÕES DA SÉRIE ===');
    console.log('ID:', seriesResult.rows[0].id);
    console.log('Título:', seriesResult.rows[0].title);
    console.log('Tipo:', seriesResult.rows[0].content_type);
    console.log('Status:', seriesResult.rows[0].status);
    console.log('Criada em:', seriesResult.rows[0].created_at);

    // Verificar compra do usuário
    const purchaseResult = await pool.query(`
      SELECT p.*, u.telegram_id, u.username
      FROM purchases p
      JOIN users u ON u.id = p.user_id
      WHERE p.content_id = '08fc07e1-fe03-434e-8349-997d84a6e269'
        AND u.telegram_id = '2006803983'
    `);

    console.log('\n=== COMPRA DO USUÁRIO (telegram_id: 2006803983) ===');
    if (purchaseResult.rows.length > 0) {
      console.log('✅ Usuário TEM acesso à série');
      console.log('Username:', purchaseResult.rows[0].username);
      console.log('Status da compra:', purchaseResult.rows[0].status);
      console.log('Comprado em:', purchaseResult.rows[0].created_at);
    } else {
      console.log('❌ Usuário NÃO tem acesso à série');
    }

    // Verificar episódios
    const result = await pool.query(`
      SELECT
        id,
        season_number,
        episode_number,
        title,
        processing_status,
        CASE
          WHEN video_url IS NOT NULL THEN 'SIM'
          ELSE 'NAO'
        END as tem_video,
        CASE
          WHEN hls_url IS NOT NULL THEN 'SIM'
          ELSE 'NAO'
        END as tem_hls,
        video_url,
        hls_url,
        created_at,
        updated_at
      FROM episodes
      WHERE series_id = '08fc07e1-fe03-434e-8349-997d84a6e269'
      ORDER BY season_number, episode_number
    `);

    console.log('\n=== STATUS DOS EPISÓDIOS DA WANDINHA ===\n');

    if (result.rows.length === 0) {
      console.log('❌ Nenhum episódio encontrado!');
    } else {
      result.rows.forEach((ep, index) => {
        console.log(`\n📺 Episódio ${index + 1}:`);
        console.log(`   Temporada/Episódio: S${ep.season_number}E${ep.episode_number}`);
        console.log(`   Título: ${ep.title}`);
        console.log(`   Status de Processamento: ${ep.processing_status}`);
        console.log(`   Tem vídeo (video_url): ${ep.tem_video}`);
        console.log(`   Tem HLS (hls_url): ${ep.tem_hls}`);
        if (ep.video_url) {
          console.log(`   Video URL: ${ep.video_url.substring(0, 80)}...`);
        }
        if (ep.hls_url) {
          console.log(`   HLS URL: ${ep.hls_url.substring(0, 80)}...`);
        }
        console.log(`   Criado em: ${ep.created_at}`);
        console.log(`   Atualizado em: ${ep.updated_at}`);
      });

      console.log(`\n\n📊 RESUMO:`);
      const total = result.rows.length;
      const comVideo = result.rows.filter(ep => ep.tem_video === 'SIM').length;
      const comHLS = result.rows.filter(ep => ep.tem_hls === 'SIM').length;
      const ready = result.rows.filter(ep => ep.processing_status === 'ready').length;
      const processing = result.rows.filter(ep => ep.processing_status === 'processing').length;
      const pending = result.rows.filter(ep => ep.processing_status === 'pending').length;
      const failed = result.rows.filter(ep => ep.processing_status === 'failed').length;

      console.log(`   Total de episódios: ${total}`);
      console.log(`   Com vídeo original: ${comVideo}/${total}`);
      console.log(`   Com HLS processado: ${comHLS}/${total}`);
      console.log(`   Status READY (prontos): ${ready}/${total}`);
      console.log(`   Status PROCESSING: ${processing}/${total}`);
      console.log(`   Status PENDING: ${pending}/${total}`);
      console.log(`   Status FAILED: ${failed}/${total}`);

      if (comVideo === total && comHLS === total && ready === total) {
        console.log('\n✅ TODOS OS EPISÓDIOS ESTÃO PRONTOS PARA ASSISTIR!');
      } else if (comVideo === total) {
        console.log('\n⏳ UPLOADS COMPLETOS - Aguardando processamento HLS...');
      } else {
        console.log('\n⚠️  UPLOADS AINDA NÃO FINALIZADOS');
      }
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkEpisodes();
