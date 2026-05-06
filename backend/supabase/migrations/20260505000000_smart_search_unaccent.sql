-- Migracao: Busca Inteligente com Fuzzy Search e Normalizacao de Acentos
-- Requer: PostgreSQL com extensoes unaccent e pg_trgm

-- 1. Habilitar extensao unaccent (para normalizacao de acentos/diacriticos)
CREATE EXTENSION IF NOT EXISTS "unaccent" SCHEMA extensions;

-- 2. Verificar que pg_trgm esta habilitada (para fuzzy matching via trigrams)
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA extensions;

-- 3. Criar funcao imutavel de unaccent (necessaria para uso em indices)
CREATE OR REPLACE FUNCTION f_unaccent(text)
RETURNS text AS $$
  SELECT extensions.unaccent($1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- 4. Criar indice trigram no titulo normalizado (para fuzzy search)
CREATE INDEX IF NOT EXISTS idx_content_title_trgm
ON content USING gin (f_unaccent(lower(title)) gin_trgm_ops);

-- 5. Criar indice trigram na descricao normalizada
CREATE INDEX IF NOT EXISTS idx_content_description_trgm
ON content USING gin (f_unaccent(lower(COALESCE(description, ''))) gin_trgm_ops);

-- 6. Helper: verifica se TODAS as palavras aparecem no texto (busca por palavras individuais)
CREATE OR REPLACE FUNCTION all_words_match(haystack text, words text[])
RETURNS boolean AS $$
  SELECT bool_and(haystack ILIKE '%' || word || '%')
  FROM unnest(words) AS word
  WHERE length(trim(word)) > 0
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- 7. Funcao principal de busca inteligente
CREATE OR REPLACE FUNCTION search_content(
  search_query text,
  content_type_filter text DEFAULT NULL,
  result_limit integer DEFAULT 20,
  result_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  synopsis text,
  thumbnail_url text,
  poster_url text,
  backdrop_url text,
  trailer_url text,
  video_url text,
  hls_master_url text,
  price_cents integer,
  currency varchar,
  duration_minutes integer,
  release_year integer,
  total_seasons integer,
  total_episodes integer,
  age_rating varchar,
  director text,
  "cast" text,
  genres text,
  imdb_rating numeric,
  content_type varchar,
  status varchar,
  is_featured boolean,
  is_release boolean,
  views_count integer,
  purchases_count integer,
  weekly_sales integer,
  total_sales integer,
  telegram_group_link text,
  created_at timestamptz,
  updated_at timestamptz,
  search_rank real
) AS $$
DECLARE
  normalized_query text;
  query_words text[];
  tsquery_val tsquery;
BEGIN
  -- Normalizar a query: remover acentos e converter para minusculas
  normalized_query := f_unaccent(lower(trim(search_query)));

  -- Dividir query em palavras individuais (para busca por palavra)
  query_words := string_to_array(normalized_query, ' ');
  -- Remover palavras vazias
  query_words := array(SELECT word FROM unnest(query_words) AS word WHERE length(trim(word)) > 0);

  -- Construir tsquery para full-text search
  BEGIN
    tsquery_val := to_tsquery('portuguese',
      regexp_replace(normalized_query, '\s+', ' & ', 'g')
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fallback se parsing falhar
    tsquery_val := plainto_tsquery('portuguese', normalized_query);
  END;

  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.description,
    c.synopsis,
    c.thumbnail_url,
    c.poster_url,
    c.backdrop_url,
    c.trailer_url,
    c.video_url,
    c.hls_master_url,
    c.price_cents,
    c.currency,
    c.duration_minutes,
    c.release_year,
    c.total_seasons,
    c.total_episodes,
    c.age_rating,
    c.director,
    c."cast",
    c.genres,
    c.imdb_rating,
    c.content_type,
    c.status,
    c.is_featured,
    c.is_release,
    c.views_count,
    c.purchases_count,
    c.weekly_sales,
    c.total_sales,
    c.telegram_group_link,
    c.created_at,
    c.updated_at,
    (
      -- Ranking: todas palavras no titulo (15x) > frase exata titulo (10x) > palavras titulo+desc (7x)
      -- > similaridade titulo (5x) > full-text (3x) > similaridade descricao (1x)
      CASE WHEN all_words_match(f_unaccent(lower(c.title)), query_words)
           THEN 15.0 ELSE 0.0 END
      +
      CASE WHEN f_unaccent(lower(c.title)) ILIKE '%' || normalized_query || '%'
           THEN 10.0 ELSE 0.0 END
      +
      CASE WHEN all_words_match(
             f_unaccent(lower(c.title || ' ' || COALESCE(c.description, ''))),
             query_words
           ) THEN 7.0 ELSE 0.0 END
      +
      COALESCE(similarity(f_unaccent(lower(c.title)), normalized_query), 0) * 5.0
      +
      COALESCE(ts_rank(
        to_tsvector('portuguese', c.title || ' ' || COALESCE(c.description, '')),
        tsquery_val
      ), 0) * 3.0
      +
      COALESCE(similarity(f_unaccent(lower(COALESCE(c.description, ''))), normalized_query), 0) * 1.0
    )::real AS search_rank
  FROM content c
  WHERE c.status = 'PUBLISHED'
    AND (content_type_filter IS NULL OR c.content_type = content_type_filter)
    AND (
      -- Todas as palavras aparecem no titulo (ex: "wicked 2" encontra "Wicked: Parte 2")
      all_words_match(f_unaccent(lower(c.title)), query_words)
      OR
      -- Frase exata no titulo (ex: "wicked" encontra "Wicked")
      f_unaccent(lower(c.title)) ILIKE '%' || normalized_query || '%'
      OR
      -- Todas as palavras aparecem no titulo + descricao combinados
      all_words_match(
        f_unaccent(lower(c.title || ' ' || COALESCE(c.description, ''))),
        query_words
      )
      OR
      -- Similaridade trigram no titulo (fuzzy matching, ex: "btman" encontra "Batman")
      similarity(f_unaccent(lower(c.title)), normalized_query) > 0.15
      OR
      -- Full-text search no titulo e descricao
      to_tsvector('portuguese', c.title || ' ' || COALESCE(c.description, '')) @@ tsquery_val
      OR
      -- Similaridade trigram na descricao
      similarity(f_unaccent(lower(COALESCE(c.description, ''))), normalized_query) > 0.25
    )
  ORDER BY search_rank DESC, c.created_at DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. Funcao de contagem para paginacao
CREATE OR REPLACE FUNCTION search_content_count(
  search_query text,
  content_type_filter text DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  normalized_query text;
  query_words text[];
  tsquery_val tsquery;
  total integer;
BEGIN
  normalized_query := f_unaccent(lower(trim(search_query)));
  query_words := string_to_array(normalized_query, ' ');
  query_words := array(SELECT word FROM unnest(query_words) AS word WHERE length(trim(word)) > 0);

  BEGIN
    tsquery_val := to_tsquery('portuguese',
      regexp_replace(normalized_query, '\s+', ' & ', 'g')
    );
  EXCEPTION WHEN OTHERS THEN
    tsquery_val := plainto_tsquery('portuguese', normalized_query);
  END;

  SELECT count(*)::integer INTO total
  FROM content c
  WHERE c.status = 'PUBLISHED'
    AND (content_type_filter IS NULL OR c.content_type = content_type_filter)
    AND (
      all_words_match(f_unaccent(lower(c.title)), query_words)
      OR
      f_unaccent(lower(c.title)) ILIKE '%' || normalized_query || '%'
      OR
      all_words_match(
        f_unaccent(lower(c.title || ' ' || COALESCE(c.description, ''))),
        query_words
      )
      OR
      similarity(f_unaccent(lower(c.title)), normalized_query) > 0.15
      OR
      to_tsvector('portuguese', c.title || ' ' || COALESCE(c.description, '')) @@ tsquery_val
      OR
      similarity(f_unaccent(lower(COALESCE(c.description, ''))), normalized_query) > 0.25
    );

  RETURN total;
END;
$$ LANGUAGE plpgsql STABLE;
