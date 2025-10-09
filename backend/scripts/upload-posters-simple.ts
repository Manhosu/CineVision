import * as fs from 'fs';
import * as path from 'path';

interface MovieData {
  title: string;
  year: number;
  folderPath: string;
  posterPath: string | null;
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

  console.log('🎬 Escaneando filmes...\n');

  const allMovies = await scanMoviesDirectory(MOVIES_DIR);

  // Filmes restantes (excluindo Lilo & Stitch que já foi processado)
  const remainingMovies = allMovies.filter(m =>
    m.title !== 'Lilo & Stitch'
  );

  console.log(`📊 Filmes encontrados: ${remainingMovies.length}\n`);

  for (const movie of remainingMovies) {
    const movieId = `${movie.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${movie.year}`;
    const hasPoster = movie.posterPath ? '✅' : '❌';

    console.log(`${hasPoster} ${movie.title} (${movie.year})`);
    console.log(`   ID: ${movieId}`);
    if (movie.posterPath) {
      console.log(`   Poster: ${movie.posterPath}`);
    }
    console.log('');
  }

  console.log('\n📋 Próximo passo: Use AWS MCP para fazer upload dos posters listados acima');
}

main().catch(console.error);
