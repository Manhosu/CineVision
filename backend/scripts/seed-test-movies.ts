import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const testMovies = [
  {
    title: 'Vingadores: Ultimato',
    description: 'Após Thanos eliminar metade das criaturas vivas, os Vingadores têm que lidar com a perda de amigos e entes queridos. Com Tony Stark vagando perdido no espaço sem água e comida, Steve Rogers e Natasha Romanov lideram a resistência contra o titã louco.',
    synopsis: 'O confronto épico final entre os Vingadores e Thanos.',
    content_type: 'movie',
    price_cents: 1990,
    currency: 'BRL',
    poster_url: 'https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
    thumbnail_url: 'https://image.tmdb.org/t/p/w300/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
    trailer_url: 'https://www.youtube.com/watch?v=TcMBFSGVi1c',
    release_year: 2019,
    duration_minutes: 181,
    imdb_rating: 8.4,
    genres: ['Ação', 'Aventura', 'Ficção Científica'],
    director: 'Anthony e Joe Russo',
    cast: 'Robert Downey Jr., Chris Evans, Mark Ruffalo, Chris Hemsworth, Scarlett Johansson',
    status: 'PUBLISHED',
    availability: 'both',
    is_featured: true,
  },
  {
    title: 'Pantera Negra: Wakanda Para Sempre',
    description: 'A rainha Ramonda, Shuri, M\'Baku, Okoye e as Dora Milaje lutam para proteger sua nação das potências mundiais intervenientes após a morte do Rei T\'Challa.',
    synopsis: 'O reino de Wakanda enfrenta novos desafios após a perda de seu rei.',
    content_type: 'movie',
    price_cents: 1690,
    currency: 'BRL',
    poster_url: 'https://image.tmdb.org/t/p/w500/ps2oKfhY6DL3alynlSqggHQ52P9.jpg',
    thumbnail_url: 'https://image.tmdb.org/t/p/w300/ps2oKfhY6DL3alynlSqggHQ52P9.jpg',
    trailer_url: 'https://www.youtube.com/watch?v=_Z3QKkl1WyM',
    release_year: 2022,
    duration_minutes: 161,
    imdb_rating: 6.7,
    genres: ['Ação', 'Aventura', 'Drama'],
    director: 'Ryan Coogler',
    cast: 'Letitia Wright, Lupita Nyong\'o, Danai Gurira, Winston Duke',
    status: 'PUBLISHED',
    availability: 'both',
    is_featured: true,
  },
  {
    title: 'Avatar: O Caminho da Água',
    description: 'Jake Sully vive com sua nova família formada na lua extraterrestre de Pandora. Quando uma ameaça familiar retorna para terminar o que foi começado anteriormente, Jake deve trabalhar com Neytiri e o exército da raça Na\'vi para proteger seu planeta.',
    synopsis: 'Jake Sully e sua família enfrentam novos desafios em Pandora.',
    content_type: 'movie',
    price_cents: 2190,
    currency: 'BRL',
    poster_url: 'https://image.tmdb.org/t/p/w500/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
    thumbnail_url: 'https://image.tmdb.org/t/p/w300/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
    trailer_url: 'https://www.youtube.com/watch?v=d9MyW72ELq0',
    release_year: 2022,
    duration_minutes: 192,
    imdb_rating: 7.6,
    genres: ['Aventura', 'Ficção Científica', 'Ação'],
    director: 'James Cameron',
    cast: 'Sam Worthington, Zoe Saldana, Sigourney Weaver, Stephen Lang',
    status: 'PUBLISHED',
    availability: 'both',
    is_featured: true,
  },
  {
    title: 'Homem-Aranha: Sem Volta Para Casa',
    description: 'Peter Parker tem a sua identidade secreta revelada e pede ajuda ao Doutor Estranho. Quando um feitiço para reverter o evento não sai como o esperado, o Homem-Aranha e seu companheiro dos Vingadores precisam enfrentar inimigos de todo o multiverso.',
    synopsis: 'Peter Parker enfrenta as consequências de sua identidade revelada.',
    content_type: 'movie',
    price_cents: 1890,
    currency: 'BRL',
    poster_url: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
    thumbnail_url: 'https://image.tmdb.org/t/p/w300/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
    trailer_url: 'https://www.youtube.com/watch?v=JfVOs4VSpmA',
    release_year: 2021,
    duration_minutes: 148,
    imdb_rating: 8.2,
    genres: ['Ação', 'Aventura', 'Ficção Científica'],
    director: 'Jon Watts',
    cast: 'Tom Holland, Zendaya, Benedict Cumberbatch, Jacob Batalon',
    status: 'PUBLISHED',
    availability: 'both',
    is_featured: false,
  },
  {
    title: 'Guardiões da Galáxia Vol. 3',
    description: 'Peter Quill deve reunir sua equipe para defender o universo e proteger um dos seus. Se a missão não for totalmente bem-sucedida, isso pode levar ao fim dos Guardiões.',
    synopsis: 'Os Guardiões embarcam em sua missão mais perigosa.',
    content_type: 'movie',
    price_cents: 1790,
    currency: 'BRL',
    poster_url: 'https://image.tmdb.org/t/p/w500/r2J02Z2OpNTctfOSN1Ydgii51I3.jpg',
    thumbnail_url: 'https://image.tmdb.org/t/p/w300/r2J02Z2OpNTctfOSN1Ydgii51I3.jpg',
    trailer_url: 'https://www.youtube.com/watch?v=u3V5KDHRQvk',
    release_year: 2023,
    duration_minutes: 150,
    imdb_rating: 7.9,
    genres: ['Ação', 'Aventura', 'Comédia', 'Ficção Científica'],
    director: 'James Gunn',
    cast: 'Chris Pratt, Zoe Saldana, Dave Bautista, Karen Gillan, Pom Klementieff',
    status: 'PUBLISHED',
    availability: 'both',
    is_featured: false,
  },
  {
    title: 'Oppenheimer',
    description: 'A história do físico americano J. Robert Oppenheimer e seu papel no desenvolvimento da bomba atômica.',
    synopsis: 'A história épica do pai da bomba atômica.',
    content_type: 'movie',
    price_cents: 2290,
    currency: 'BRL',
    poster_url: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    thumbnail_url: 'https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    trailer_url: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
    release_year: 2023,
    duration_minutes: 180,
    imdb_rating: 8.3,
    genres: ['Drama', 'Suspense'],
    director: 'Christopher Nolan',
    cast: 'Cillian Murphy, Emily Blunt, Matt Damon, Robert Downey Jr.',
    status: 'PUBLISHED',
    availability: 'site',
    is_featured: true,
  },
  {
    title: 'Barbie',
    description: 'Barbie e Ken estão se divertindo na colorida e aparentemente perfeita Barbieland. No entanto, quando eles têm a chance de ir ao mundo real, eles logo descobrem as alegrias e os perigos de viver entre os humanos.',
    synopsis: 'A jornada de Barbie pelo mundo real.',
    content_type: 'movie',
    price_cents: 1590,
    currency: 'BRL',
    poster_url: 'https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg',
    thumbnail_url: 'https://image.tmdb.org/t/p/w300/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg',
    trailer_url: 'https://www.youtube.com/watch?v=pBk4NYhWNMM',
    release_year: 2023,
    duration_minutes: 114,
    imdb_rating: 6.8,
    genres: ['Comédia', 'Aventura'],
    director: 'Greta Gerwig',
    cast: 'Margot Robbie, Ryan Gosling, Issa Rae, Kate McKinnon',
    status: 'PUBLISHED',
    availability: 'both',
    is_featured: false,
  },
  {
    title: 'Missão Impossível: Acerto de Contas Parte 1',
    description: 'Ethan Hunt e sua equipe do FMI embarcam em sua missão mais perigosa até agora.',
    synopsis: 'A missão mais perigosa de Ethan Hunt.',
    content_type: 'movie',
    price_cents: 1990,
    currency: 'BRL',
    poster_url: 'https://image.tmdb.org/t/p/w500/NNxYkU70HPurnNCSiCjYAmacwm.jpg',
    thumbnail_url: 'https://image.tmdb.org/t/p/w300/NNxYkU70HPurnNCSiCjYAmacwm.jpg',
    trailer_url: 'https://www.youtube.com/watch?v=avz06PDqDbM',
    release_year: 2023,
    duration_minutes: 163,
    imdb_rating: 7.7,
    genres: ['Ação', 'Suspense', 'Aventura'],
    director: 'Christopher McQuarrie',
    cast: 'Tom Cruise, Hayley Atwell, Ving Rhames, Simon Pegg',
    status: 'PUBLISHED',
    availability: 'both',
    is_featured: false,
  },
];

async function seedMovies() {
  console.log('🌱 Seeding test movies to Supabase...\n');

  try {
    for (const movie of testMovies) {
      console.log(`📽️  Adding: ${movie.title}...`);

      const { data, error } = await supabase
        .from('content')
        .insert([movie])
        .select();

      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Added successfully (ID: ${data[0]?.id})`);
      }
    }

    console.log(`\n✨ Seeding complete! Added ${testMovies.length} test movies.`);

    // Show summary
    const { count, error } = await supabase
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PUBLISHED');

    if (!error) {
      console.log(`📊 Total published movies in database: ${count}`);
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  }
}

seedMovies();
