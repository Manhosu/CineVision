import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../.env') });

// Configurações
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID!;
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY!;
const POSTER_BUCKET = 'cinevision-capas';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
});

interface MovieData {
  title: string;
  year: number;
  folderPath: string;
  posterPath: string | null;
}

async function uploadPoster(posterPath: string, movieId: string): Promise<string> {
  const key = `posters/${movieId}.png`;
  const fileBuffer = fs.readFileSync(posterPath);

  const command = new PutObjectCommand({
    Bucket: POSTER_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: 'image/png',
  });

  await s3Client.send(command);
  return `https://${POSTER_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

async function createMovieRecord(movie: MovieData, posterUrl: string | null) {
  const { data, error } = await supabase
    .from('content')
    .insert({
      title: movie.title,
      release_year: movie.year,
      poster_url: posterUrl,
      price_cents: 1500,
      content_type: 'movie',
      status: 'PUBLISHED',
    })
    .select()
    .single();

  if (error) {
    console.error(`❌ Erro ao criar registro para ${movie.title}:`, error);
    return null;
  }

  console.log(`✅ Registro criado para ${movie.title} (ID: ${data.id})`);
  return data.id;
}

async function scanMoviesDirectory(dirPath: string): Promise<MovieData[]> {
  const movies: MovieData[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const match = entry.name.match(/^FILME_\s*(.+?)\s*\((\d{4})\)/);
    if (!match) continue;

    const [, title, yearStr] = match;
    const year = parseInt(yearStr, 10);
    const folderPath = path.join(dirPath, entry.name);

    // Procura pelo poster
    const files = fs.readdirSync(folderPath);
    const posterFile = files.find(f => f.toUpperCase() === 'POSTER.PNG');
    const posterPath = posterFile ? path.join(folderPath, posterFile) : null;

    movies.push({
      title,
      year,
      folderPath,
      posterPath,
    });
  }

  return movies;
}

async function main() {
  const MOVIES_DIR = 'E:\\movies';

  console.log('🎬 Iniciando upload de POSTERS...\n');

  const allMovies = await scanMoviesDirectory(MOVIES_DIR);

  // Filmes restantes (excluindo Lilo & Stitch que já foi processado)
  const remainingMovies = allMovies.filter(m =>
    m.title !== 'Lilo & Stitch'
  );

  console.log(`📊 Total de filmes para processar: ${remainingMovies.length}\n`);

  for (const movie of remainingMovies) {
    console.log(`\n📽️  Processando: ${movie.title} (${movie.year})`);

    const movieId = `${movie.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${movie.year}`;
    let posterUrl: string | null = null;

    // Upload do poster
    if (movie.posterPath) {
      try {
        console.log(`  📤 Fazendo upload do poster...`);
        posterUrl = await uploadPoster(movie.posterPath, movieId);
        console.log(`  ✅ Poster enviado`);
      } catch (error) {
        console.error(`  ❌ Erro ao enviar poster:`, error);
      }
    } else {
      console.log(`  ⚠️  Poster não encontrado`);
    }

    // Cria registro no banco
    try {
      await createMovieRecord(movie, posterUrl);
    } catch (error) {
      console.error(`  ❌ Erro ao criar registro:`, error);
    }
  }

  console.log('\n\n✅ UPLOAD DE POSTERS CONCLUÍDO!\n');
  console.log('📋 Próximos passos:');
  console.log('1. Teste o player com "Lilo & Stitch (2025)"');
  console.log('2. Verifique os posters no painel admin');
  console.log('3. Quando aprovado, podemos continuar com upload dos vídeos restantes\n');
}

main().catch(console.error);
