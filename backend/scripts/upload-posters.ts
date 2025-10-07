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
  posterPath: string;
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
  const posterPath = path.join(moviesDir, folderName, 'POSTER.webp');

  // Check if POSTER.webp exists
  if (!fs.existsSync(posterPath)) {
    console.warn(`⚠️  POSTER.webp não encontrado em: ${folderName}`);
    return null;
  }

  return {
    folderName,
    title: title.trim(),
    year: parseInt(year),
    posterPath,
  };
}

// Upload poster to Supabase Storage
async function uploadPoster(
  posterPath: string,
  storagePath: string
): Promise<string | null> {
  try {
    const fileBuffer = fs.readFileSync(posterPath);

    // Try to create bucket if it doesn't exist
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'posters');

    if (!bucketExists) {
      console.log('📦 Criando bucket "posters"...');
      const { error: createError } = await supabase.storage.createBucket('posters', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
      });

      if (createError) {
        console.error('❌ Erro ao criar bucket:', createError);
        return null;
      }
    }

    const { data, error } = await supabase.storage
      .from('posters')
      .upload(storagePath, fileBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (error) {
      console.error(`❌ Erro ao fazer upload de ${storagePath}:`, error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('posters')
      .getPublicUrl(storagePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error(`❌ Erro ao ler arquivo ${posterPath}:`, err);
    return null;
  }
}

// Update movie record with poster URL
async function updateMoviePoster(title: string, year: number, posterUrl: string) {
  // Try to find existing movie by title and year
  const { data: existingMovies } = await supabase
    .from('content')
    .select('id, title, release_year')
    .ilike('title', `%${title}%`)
    .eq('release_year', year);

  if (!existingMovies || existingMovies.length === 0) {
    console.warn(`  ⚠️  Filme não encontrado no banco: ${title} (${year})`);
    return null;
  }

  const movieId = existingMovies[0].id;

  const { data, error } = await supabase
    .from('content')
    .update({
      poster_url: posterUrl,
      thumbnail_url: posterUrl,
      backdrop_url: posterUrl,
    })
    .eq('id', movieId)
    .select()
    .single();

  if (error) {
    console.error(`  ❌ Erro ao atualizar registro para ${title}:`, error);
    return null;
  }

  return data;
}

// Main function
async function main() {
  console.log('🎨 Iniciando upload de posters para Supabase...\n');

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

  console.log(`📁 Encontrados ${movies.length} posters para processar\n`);

  let successCount = 0;
  let errorCount = 0;
  let notFoundCount = 0;

  for (const movie of movies) {
    console.log(`📤 Processando: ${movie.title} (${movie.year})`);

    try {
      // Generate unique ID for storage path
      const movieId = `${movie.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${movie.year}`;

      // Upload poster file
      console.log(`  ⏳ Fazendo upload do poster...`);
      const posterUrl = await uploadPoster(
        movie.posterPath,
        `${movieId}.webp`
      );

      if (!posterUrl) {
        errorCount++;
        continue;
      }

      console.log(`  ✅ Poster enviado: ${posterUrl}`);

      // Update movie record
      console.log(`  ⏳ Atualizando registro no banco...`);
      const record = await updateMoviePoster(movie.title, movie.year, posterUrl);

      if (record) {
        console.log(`  ✅ Sucesso! ID: ${record.id}\n`);
        successCount++;
      } else {
        notFoundCount++;
      }
    } catch (err) {
      console.error(`  ❌ Erro ao processar ${movie.title}:`, err);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Upload concluído!`);
  console.log(`   Sucessos: ${successCount}`);
  console.log(`   Não encontrados no banco: ${notFoundCount}`);
  console.log(`   Erros: ${errorCount}`);
  console.log('='.repeat(50));
}

// Run script
main().catch(console.error);
