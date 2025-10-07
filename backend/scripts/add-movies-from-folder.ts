import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface MovieFolder {
  folderName: string;
  title: string;
  year: number;
  posterUrl: string;
  videoFiles: string[];
}

// Parse movie folder name to extract metadata
function parseMovieFolderName(folderName: string, moviesDir: string): MovieFolder | null {
  // Format: "FILME_ Título (Ano)"
  const match = folderName.match(/^FILME_\s*(.+?)\s*\((\d{4})\)/);

  if (!match) {
    console.warn(`⚠️  Pasta ignorada (formato inválido): ${folderName}`);
    return null;
  }

  const [, title, year] = match;
  const folderPath = path.join(moviesDir, folderName);

  // Check video files
  const files = fs.readdirSync(folderPath);
  const videoFiles = files.filter(f => f.match(/\.(mp4|mkv|avi|mov)$/i));

  if (videoFiles.length === 0) {
    console.warn(`⚠️  Nenhum arquivo de vídeo encontrado em: ${folderName}`);
    return null;
  }

  // Generate poster URL based on the naming convention from upload-posters.ts
  const movieId = `${title.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}-${year}`;
  const posterUrl = `https://szghyvnbmjlquznxhqum.supabase.co/storage/v1/object/public/posters/${movieId}.webp`;

  return {
    folderName,
    title: title.trim(),
    year: parseInt(year),
    posterUrl,
    videoFiles,
  };
}

// Create movie record in database
async function createMovieRecord(movie: MovieFolder) {
  // Check if movie already exists
  const { data: existingMovies } = await supabase
    .from('content')
    .select('id, title, release_year')
    .ilike('title', `%${movie.title}%`)
    .eq('release_year', movie.year);

  if (existingMovies && existingMovies.length > 0) {
    console.log(`  ℹ️  Filme já existe no banco: ${movie.title} (${movie.year})`);
    return existingMovies[0];
  }

  const { data, error } = await supabase
    .from('content')
    .insert({
      title: movie.title,
      description: `${movie.title} - Lançamento ${movie.year}`,
      release_year: movie.year,
      poster_url: movie.posterUrl,
      thumbnail_url: movie.posterUrl,
      backdrop_url: movie.posterUrl,
      price_cents: 1500, // R$ 15,00 default
      content_type: 'movie',
      status: 'PUBLISHED',
      is_online: true,
      quality: 'HD',
      format: movie.videoFiles[0].endsWith('.mkv') ? 'MKV' : 'MP4',
      category: 'Ação',
      weekly_sales: 0,
      views_count: 0,
      genres: ['Ação', 'Aventura'],
    })
    .select()
    .single();

  if (error) {
    console.error(`  ❌ Erro ao criar registro para ${movie.title}:`, error);
    return null;
  }

  return data;
}

// Main function
async function main() {
  console.log('🎬 Adicionando filmes da pasta movies ao banco de dados...\n');

  const moviesDir = path.join(process.cwd(), '..', 'movies');

  if (!fs.existsSync(moviesDir)) {
    console.error(`❌ Diretório 'movies' não encontrado: ${moviesDir}`);
    process.exit(1);
  }

  const folders = fs.readdirSync(moviesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const movies: MovieFolder[] = folders
    .map(folder => parseMovieFolderName(folder, moviesDir))
    .filter((m): m is MovieFolder => m !== null);

  console.log(`📁 Encontrados ${movies.length} filmes para adicionar\n`);

  let successCount = 0;
  let existingCount = 0;
  let errorCount = 0;

  for (const movie of movies) {
    console.log(`📤 Processando: ${movie.title} (${movie.year})`);
    console.log(`   Arquivos de vídeo: ${movie.videoFiles.join(', ')}`);
    console.log(`   Poster: ${movie.posterUrl}`);

    try {
      const record = await createMovieRecord(movie);

      if (record) {
        if (record.id) {
          console.log(`  ✅ Adicionado com sucesso! ID: ${record.id}\n`);
          successCount++;
        } else {
          existingCount++;
          console.log();
        }
      } else {
        errorCount++;
      }
    } catch (err) {
      console.error(`  ❌ Erro ao processar ${movie.title}:`, err);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Processamento concluído!`);
  console.log(`   Novos filmes adicionados: ${successCount}`);
  console.log(`   Filmes já existentes: ${existingCount}`);
  console.log(`   Erros: ${errorCount}`);
  console.log('='.repeat(50));
}

// Run script
main().catch(console.error);
