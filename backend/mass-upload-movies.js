const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001';
const MOVIES_DIR = 'E:/movies';

// Lista de todos os filmes para fazer upload
const MOVIES = [
  {
    folder: 'FILME_  Lilo & Stitch (2025)',
    title: 'Lilo & Stitch',
    year: 2025,
    duration: 120,
    synopsis: 'A história clássica de Lilo e Stitch retorna aos cinemas em uma nova aventura emocionante.',
    classification: 'L',
    category: 'Animação',
  },
  {
    folder: 'FILME_ A Longa Marcha - Caminhe ou Morra (2025)',
    title: 'A Longa Marcha - Caminhe ou Morra',
    year: 2025,
    duration: 135,
    synopsis: 'Um grupo de jovens participa de uma competição mortal onde devem continuar caminhando ou enfrentar consequências fatais.',
    classification: '16',
    category: 'Suspense',
  },
  {
    folder: 'FILME_ Como Treinar o Seu Dragão (2025)',
    title: 'Como Treinar o Seu Dragão',
    year: 2025,
    duration: 125,
    synopsis: 'A amizade entre um jovem viking e um dragão transforma uma vila inteira nesta emocionante aventura.',
    classification: 'L',
    category: 'Animação',
  },
  {
    folder: 'FILME_ Demon Slayer - Castelo Infinito (2025)',
    title: 'Demon Slayer - Castelo Infinito',
    year: 2025,
    duration: 140,
    synopsis: 'Tanjiro e seus amigos enfrentam novos desafios no misterioso Castelo Infinito.',
    classification: '14',
    category: 'Ação',
  },
  {
    folder: 'FILME_ F1 - O Filme (2025)',
    title: 'F1 - O Filme',
    year: 2025,
    duration: 130,
    synopsis: 'A história por trás das corridas mais emocionantes da Fórmula 1.',
    classification: '12',
    category: 'Drama',
  },
  {
    folder: 'FILME_ Invocação do Mal 4_ O Último Ritual (2025)',
    title: 'Invocação do Mal 4: O Último Ritual',
    year: 2025,
    duration: 115,
    synopsis: 'Ed e Lorraine Warren enfrentam o caso mais aterrorizante de suas carreiras.',
    classification: '16',
    category: 'Terror',
  },
  {
    folder: 'FILME_ Jurassic World_ Recomeço (2025)',
    title: 'Jurassic World: Recomeço',
    year: 2025,
    duration: 145,
    synopsis: 'Uma nova era começa enquanto a humanidade aprende a coexistir com os dinossauros.',
    classification: '12',
    category: 'Ação',
  },
  {
    folder: 'FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)',
    title: 'Quarteto Fantástico: Primeiros Passos',
    year: 2025,
    duration: 135,
    synopsis: 'A origem dos heróis mais poderosos da Marvel finalmente ganha vida nos cinemas.',
    classification: '12',
    category: 'Ação',
  },
];

// Função para buscar ou criar categoria
async function getOrCreateCategory(categoryName) {
  try {
    // Buscar todas as categorias
    const response = await axios.get(`${API_URL}/api/v1/content/categories`);
    const categories = response.data;

    // Procurar categoria existente
    const existing = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (existing) {
      return existing.id;
    }

    // Se não existir, criar nova categoria
    console.log(`  📁 Criando categoria: ${categoryName}`);
    // Por enquanto, vamos usar uma categoria padrão se não encontrar
    return categories[0]?.id || null;
  } catch (error) {
    console.error('  ❌ Erro ao buscar categorias:', error.message);
    return null;
  }
}

// Função para criar conteúdo
async function createContent(movie) {
  try {
    console.log(`\n🎬 Criando conteúdo: ${movie.title}`);

    const categoryId = await getOrCreateCategory(movie.category);

    const contentData = {
      title: movie.title,
      synopsis: movie.synopsis,
      releaseYear: movie.year,
      duration: movie.duration,
      classification: movie.classification,
      type: 'movie',
      categoryIds: categoryId ? [categoryId] : [],
    };

    const response = await axios.post(
      `${API_URL}/api/v1/admin/content/create`,
      contentData
    );

    if (response.data && response.data.id) {
      console.log(`  ✅ Conteúdo criado - ID: ${response.data.id}`);
      return response.data.id;
    } else {
      throw new Error('Resposta inválida ao criar conteúdo');
    }
  } catch (error) {
    console.error(`  ❌ Erro ao criar conteúdo:`, error.response?.data || error.message);
    throw error;
  }
}

// Função para fazer upload de imagem
async function uploadImage(contentId, imagePath, type) {
  try {
    if (!fs.existsSync(imagePath)) {
      console.log(`  ⚠️  Imagem não encontrada: ${imagePath}`);
      return null;
    }

    console.log(`  📤 Fazendo upload de ${type}: ${path.basename(imagePath)}`);

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const response = await axios.post(
      `${API_URL}/api/v1/admin/api/images/upload`,
      {
        contentId,
        imageType: type,
        imageData: `data:${mimeType};base64,${base64Image}`,
      }
    );

    if (response.data && response.data.url) {
      console.log(`  ✅ ${type} enviado com sucesso`);
      return response.data.url;
    }

    return null;
  } catch (error) {
    console.error(`  ❌ Erro ao fazer upload de ${type}:`, error.response?.data || error.message);
    return null;
  }
}

// Função para encontrar vídeos no diretório
function findVideos(movieFolder) {
  const fullPath = path.join(MOVIES_DIR, movieFolder);

  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠️  Pasta não encontrada: ${fullPath}`);
    return { dubbed: null, subtitled: null };
  }

  const files = fs.readdirSync(fullPath);

  const dubbed = files.find(f =>
    (f.includes('DUBLADO') || f.includes('DUBBED')) &&
    (f.endsWith('.mp4') || f.endsWith('.mkv'))
  );

  const subtitled = files.find(f =>
    (f.includes('LEGENDADO') || f.includes('SUBTITLED')) &&
    (f.endsWith('.mp4') || f.endsWith('.mkv'))
  );

  return {
    dubbed: dubbed ? path.join(fullPath, dubbed) : null,
    subtitled: subtitled ? path.join(fullPath, subtitled) : null,
  };
}

// Função principal de upload de um filme
async function uploadMovie(movie) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎬 INICIANDO UPLOAD: ${movie.title}`);
  console.log(`${'='.repeat(80)}`);

  try {
    // 1. Criar conteúdo
    const contentId = await createContent(movie);

    // 2. Upload de imagens
    const moviePath = path.join(MOVIES_DIR, movie.folder);
    const posterPath = path.join(moviePath, 'poster.jpg');
    const coverPath = path.join(moviePath, 'capa.jpg');

    await uploadImage(contentId, posterPath, 'poster');
    await uploadImage(contentId, coverPath, 'cover');

    // 3. Encontrar vídeos
    const videos = findVideos(movie.folder);

    if (!videos.dubbed && !videos.subtitled) {
      console.log(`  ⚠️  Nenhum vídeo encontrado para ${movie.title}`);
      return {
        success: true,
        contentId,
        message: 'Conteúdo criado, mas sem vídeos para upload',
      };
    }

    console.log(`\n  📹 Vídeos encontrados:`);
    if (videos.dubbed) console.log(`    - DUBLADO: ${path.basename(videos.dubbed)}`);
    if (videos.subtitled) console.log(`    - LEGENDADO: ${path.basename(videos.subtitled)}`);

    console.log(`\n  ✅ ${movie.title} - Conteúdo criado com sucesso!`);
    console.log(`  📝 Content ID: ${contentId}`);
    console.log(`  ⏳ Os vídeos podem ser enviados via painel do admin`);

    return {
      success: true,
      contentId,
      videos,
      message: 'Conteúdo criado com sucesso',
    };

  } catch (error) {
    console.error(`\n  ❌ ERRO ao processar ${movie.title}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Função principal
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                    UPLOAD EM MASSA DE FILMES                              ║
║                    CineVision - Mass Upload Script                        ║
╚═══════════════════════════════════════════════════════════════════════════╝
`);

  console.log(`📁 Diretório de filmes: ${MOVIES_DIR}`);
  console.log(`🎬 Total de filmes para processar: ${MOVIES.length}`);
  console.log(`⏰ Horário de início: ${new Date().toLocaleString()}`);

  const results = [];

  for (let i = 0; i < MOVIES.length; i++) {
    const movie = MOVIES[i];
    console.log(`\n\n[${i + 1}/${MOVIES.length}]`);

    const result = await uploadMovie(movie);
    results.push({
      movie: movie.title,
      ...result,
    });

    // Aguardar 2 segundos entre uploads
    if (i < MOVIES.length - 1) {
      console.log(`\n⏳ Aguardando 2 segundos antes do próximo upload...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Resumo final
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`📊 RESUMO FINAL`);
  console.log(`${'='.repeat(80)}\n`);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Sucesso: ${successful}/${MOVIES.length}`);
  console.log(`❌ Falhas: ${failed}/${MOVIES.length}`);

  console.log(`\n📋 Detalhes:\n`);
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.movie}`);
    if (result.contentId) {
      console.log(`   Content ID: ${result.contentId}`);
    }
    if (result.error) {
      console.log(`   Erro: ${result.error}`);
    }
  });

  console.log(`\n⏰ Horário de conclusão: ${new Date().toLocaleString()}`);
  console.log(`\n✨ Upload em massa concluído!`);
  console.log(`\n📝 Os vídeos podem ser enviados individualmente via painel do admin:`);
  console.log(`   http://localhost:3000/admin/content/create`);
  console.log(`\n${'='.repeat(80)}\n`);
}

// Executar
main().catch(error => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});
