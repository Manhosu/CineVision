-- Script para inserir 1000 registros de content para smoke testing
-- Este script deve ser executado após as migrações

DO $$
DECLARE
    i INTEGER;
    user_id UUID;
    category_id UUID;
    content_id UUID;
    movie_titles TEXT[] := ARRAY[
        'The Matrix', 'Inception', 'Interstellar', 'The Dark Knight', 'Pulp Fiction',
        'Fight Club', 'Forrest Gump', 'The Shawshank Redemption', 'Goodfellas', 'The Godfather',
        'Casablanca', 'Citizen Kane', 'Vertigo', 'Psycho', 'Rear Window',
        'North by Northwest', 'Singin in the Rain', 'Some Like It Hot', 'The Apartment', 'Sunset Boulevard',
        'Avatar', 'Titanic', 'Star Wars', 'Jurassic Park', 'E.T.',
        'Jaws', 'Raiders of the Lost Ark', 'Back to the Future', 'Terminator', 'Alien',
        'Blade Runner', 'The Matrix Reloaded', 'The Matrix Revolutions', 'John Wick', 'Mad Max',
        'Gladiator', 'Braveheart', 'The Lord of the Rings', 'Harry Potter', 'Spider-Man',
        'Batman Begins', 'Iron Man', 'The Avengers', 'Captain America', 'Thor',
        'Black Panther', 'Wonder Woman', 'Aquaman', 'Justice League', 'Suicide Squad'
    ];
    genres TEXT[] := ARRAY[
        'Action', 'Adventure', 'Comedy', 'Drama', 'Horror', 'Thriller', 'Sci-Fi', 
        'Fantasy', 'Romance', 'Crime', 'Mystery', 'War', 'Western', 'Animation', 'Documentary'
    ];
    directors TEXT[] := ARRAY[
        'Christopher Nolan', 'Steven Spielberg', 'Martin Scorsese', 'Quentin Tarantino', 'David Fincher',
        'Ridley Scott', 'James Cameron', 'George Lucas', 'Francis Ford Coppola', 'Stanley Kubrick',
        'Alfred Hitchcock', 'Orson Welles', 'Billy Wilder', 'John Ford', 'Akira Kurosawa'
    ];
    cast_members TEXT[] := ARRAY[
        'Leonardo DiCaprio', 'Tom Hanks', 'Robert De Niro', 'Al Pacino', 'Meryl Streep',
        'Denzel Washington', 'Morgan Freeman', 'Samuel L. Jackson', 'Will Smith', 'Brad Pitt',
        'Johnny Depp', 'Matt Damon', 'Christian Bale', 'Ryan Gosling', 'Scarlett Johansson'
    ];
BEGIN
    -- Buscar um usuário existente para usar como created_by
    SELECT id INTO user_id FROM users LIMIT 1;
    
    -- Se não houver usuário, criar um para teste
    IF user_id IS NULL THEN
        INSERT INTO users (id, name, email, password, role, status, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'Test User',
            'test@example.com',
            '$2b$10$example.hash.for.testing',
            'user',
            'active',
            NOW(),
            NOW()
        ) RETURNING id INTO user_id;
    END IF;

    -- Buscar uma categoria existente
    SELECT id INTO category_id FROM categories LIMIT 1;
    
    -- Se não houver categoria, criar uma para teste
    IF category_id IS NULL THEN
        INSERT INTO categories (id, name, slug, description, is_active, created_at, updated_at, created_by)
        VALUES (
            gen_random_uuid(),
            'Test Category',
            'test-category',
            'Category for testing purposes',
            true,
            NOW(),
            NOW(),
            user_id
        ) RETURNING id INTO category_id;
    END IF;

    -- Inserir 1000 registros de content
    FOR i IN 1..1000 LOOP
        content_id := gen_random_uuid();
        
        INSERT INTO content (
            id,
            title,
            description,
            synopsis,
            poster_url,
            banner_url,
            trailer_url,
            video_url,
            price_cents,
            duration_minutes,
            release_year,
            director,
            cast,
            genres,
            imdb_rating,
            storage_path,
            type,
            availability,
            status,
            is_featured,
            views_count,
            purchases_count,
            created_at,
            updated_at,
            created_by
        ) VALUES (
            content_id,
            movie_titles[1 + (i % array_length(movie_titles, 1))] || ' ' || i,
            'Description for movie ' || i || '. This is a test movie created for performance testing and smoke testing of database indexes.',
            'Synopsis for movie ' || i || '. A compelling story that will captivate audiences worldwide.',
            'https://example.com/poster/' || i || '.jpg',
            'https://example.com/banner/' || i || '.jpg',
            'https://example.com/trailer/' || i || '.mp4',
            'https://example.com/video/' || i || '.mp4',
            (500 + (i % 5000)) * 100, -- Preço entre R$ 5,00 e R$ 55,00 em centavos
            90 + (i % 120), -- Duração entre 90 e 210 minutos
            1990 + (i % 34), -- Ano entre 1990 e 2024
            directors[1 + (i % array_length(directors, 1))],
            ARRAY[
                cast_members[1 + (i % array_length(cast_members, 1))],
                cast_members[1 + ((i + 1) % array_length(cast_members, 1))],
                cast_members[1 + ((i + 2) % array_length(cast_members, 1))]
            ],
            ARRAY[
                genres[1 + (i % array_length(genres, 1))],
                genres[1 + ((i + 1) % array_length(genres, 1))]
            ],
            5.0 + (i % 50) / 10.0, -- Rating entre 5.0 e 10.0
            '/storage/movies/' || i || '.mp4',
            CASE 
                WHEN i % 10 = 0 THEN 'series'
                WHEN i % 15 = 0 THEN 'documentary'
                ELSE 'movie'
            END,
            CASE 
                WHEN i % 3 = 0 THEN 'site'
                WHEN i % 3 = 1 THEN 'telegram'
                ELSE 'both'
            END,
            CASE 
                WHEN i % 20 = 0 THEN 'draft'
                WHEN i % 50 = 0 THEN 'archived'
                ELSE 'published'
            END,
            i % 10 = 0, -- 10% são featured
            i * 10 + (i % 1000), -- Views count variável
            i % 100, -- Purchases count
            NOW() - INTERVAL '1 day' * (i % 365), -- Criado nos últimos 365 dias
            NOW() - INTERVAL '1 hour' * (i % 24), -- Atualizado nas últimas 24 horas
            user_id
        );

        -- Associar com categoria (alguns conteúdos)
        IF i % 3 = 0 THEN
            INSERT INTO content_categories (content_id, category_id)
            VALUES (content_id, category_id)
            ON CONFLICT DO NOTHING;
        END IF;

        -- Log de progresso a cada 100 registros
        IF i % 100 = 0 THEN
            RAISE NOTICE 'Inserted % content records', i;
        END IF;
    END LOOP;

    RAISE NOTICE 'Successfully inserted 1000 content records for smoke testing';
    
    -- Inserir log do processo
    INSERT INTO system_logs (id, type, level, message, meta, created_at)
    VALUES (
        gen_random_uuid(),
        'database',
        'info',
        'Smoke test data inserted: 1000 content records',
        jsonb_build_object(
            'records_inserted', 1000,
            'table', 'content',
            'purpose', 'smoke_testing'
        ),
        NOW()
    );
END $$;

-- Atualizar estatísticas da tabela para otimizar o planner
ANALYZE content;
ANALYZE content_categories;
ANALYZE categories;

-- Verificar se os índices estão sendo usados
-- (Estas queries podem ser executadas manualmente para verificar performance)
/*
EXPLAIN ANALYZE SELECT * FROM content WHERE title ILIKE '%movie%';
EXPLAIN ANALYZE SELECT * FROM content WHERE status = 'published' AND type = 'movie' ORDER BY created_at DESC LIMIT 20;
EXPLAIN ANALYZE SELECT * FROM content WHERE is_featured = true ORDER BY views_count DESC LIMIT 10;
EXPLAIN ANALYZE SELECT c.* FROM content c JOIN content_categories cc ON c.id = cc.content_id WHERE cc.category_id = (SELECT id FROM categories LIMIT 1);
*/