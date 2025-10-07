import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface MovieData {
  title: string;
  year: number;
  fileName: string;
  filePath: string;
}

// Parse movie filename to extract metadata
function parseMovieFileName(fileName: string): MovieData | null {
  // Format: "FILME_ Título (Ano)"
  const match = fileName.match(/^FILME_\s*(.+?)\s*\((\d{4})\)/);

  if (!match) {
    console.warn(`⚠️  Arquivo ignorado (formato inválido): ${fileName}`);
    return null;
  }

  const [, title, year] = match;

  return {
    title: title.trim(),
    year: parseInt(year),
    fileName,
    filePath: path.join(process.cwd(), 'movies', fileName),
  };
}

// Upload file to Supabase Storage
async function uploadFile(
  bucket: string,
  filePath: string,
  storagePath: string
): Promise<string | null> {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (error) {
      console.error(`❌ Erro ao fazer upload de ${storagePath}:`, error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error(`❌ Erro ao ler arquivo ${filePath}:`, err);
    return null;
  }
}

// Create movie record in database
async function createMovieRecord(movie: MovieData, videoUrl: string, coverUrl: string) {
  const { data, error } = await supabase
    .from('content')
    .insert({
      title: movie.title,
      description: `Filme ${movie.title} lançado em ${movie.year}`,
      release_year: movie.year,
      video_url: videoUrl,
      poster_url: coverUrl,
      thumbnail_url: coverUrl,
      backdrop_url: coverUrl,
      price_cents: 1500, // R$ 15,00 default
      content_type: 'movie',
      status: 'PUBLISHED',
      is_online: true,
      quality: 'HD',
      format: 'MP4',
      category: 'Ação', // Default category
      weekly_sales: 0,
      views_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error(`❌ Erro ao criar registro para ${movie.title}:`, error);
    return null;
  }

  return data;
}

// Main function
async function main() {
  console.log('🎬 Iniciando upload de filmes para Supabase...\n');

  const moviesDir = path.join(process.cwd(), 'movies');

  if (!fs.existsSync(moviesDir)) {
    console.error(`❌ Diretório 'movies' não encontrado: ${moviesDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(moviesDir);
  const movies: MovieData[] = files
    .map(parseMovieFileName)
    .filter((m): m is MovieData => m !== null);

  console.log(`📁 Encontrados ${movies.length} filmes para processar\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const movie of movies) {
    console.log(`📤 Processando: ${movie.title} (${movie.year})`);

    try {
      // Generate unique ID for storage paths
      const movieId = `${movie.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${movie.year}`;

      // Upload video file
      console.log(`  ⏳ Fazendo upload do vídeo...`);
      const videoUrl = await uploadFile(
        'movies',
        movie.filePath,
        `${movieId}.mp4`
      );

      if (!videoUrl) {
        errorCount++;
        continue;
      }

      // For now, use a placeholder cover (you can add real covers later)
      const coverUrl = `https://via.placeholder.com/500x750?text=${encodeURIComponent(movie.title)}`;

      console.log(`  ⏳ Criando registro no banco...`);
      const record = await createMovieRecord(movie, videoUrl, coverUrl);

      if (record) {
        console.log(`  ✅ Sucesso! ID: ${record.id}\n`);
        successCount++;
      } else {
        errorCount++;
      }
    } catch (err) {
      console.error(`  ❌ Erro ao processar ${movie.title}:`, err);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Upload concluído!`);
  console.log(`   Sucessos: ${successCount}`);
  console.log(`   Erros: ${errorCount}`);
  console.log('='.repeat(50));
}

// Run script
main().catch(console.error);