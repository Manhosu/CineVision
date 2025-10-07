-- Script para limpar dados de teste e manter apenas filmes reais
-- Este script remove todos os filmes que não correspondem aos filmes reais na pasta movies

-- Lista dos filmes reais (baseado na pasta movies)
-- FILME_  Lilo & Stitch (2025)
-- FILME_ A Hora do Mal (2025)
-- FILME_ A Longa Marcha - Caminhe ou Morra (2025)
-- FILME_ Como Treinar o Seu Dragão (2025)
-- FILME_ Demon Slayer - Castelo Infinito (2025)
-- FILME_ F1 - O Filme (2025)
-- FILME_ Invocação do Mal 4_ O Último Ritual (2025)
-- FILME_ Jurassic World_ Recomeço (2025)
-- FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)
-- FILME_ Superman (2025)

-- Primeiro, vamos ver quantos registros temos
SELECT COUNT(*) as total_movies FROM content WHERE type = 'movie';

-- Ver os filmes que serão mantidos
SELECT id, title, release_year 
FROM content 
WHERE type = 'movie' 
AND (
  (title ILIKE '%Lilo%Stitch%' AND release_year = 2025) OR
  (title ILIKE '%Hora do Mal%' AND release_year = 2025) OR
  (title ILIKE '%Longa Marcha%' AND release_year = 2025) OR
  (title ILIKE '%Como Treinar%Dragão%' AND release_year = 2025) OR
  (title ILIKE '%Demon Slayer%' AND release_year = 2025) OR
  (title ILIKE '%F1%Filme%' AND release_year = 2025) OR
  (title ILIKE '%Invocação do Mal%' AND release_year = 2025) OR
  (title ILIKE '%Jurassic World%' AND release_year = 2025) OR
  (title ILIKE '%Quarteto Fantástico%' AND release_year = 2025) OR
  (title ILIKE '%Superman%' AND release_year = 2025)
);

-- Ver os filmes que serão removidos
SELECT id, title, release_year 
FROM content 
WHERE type = 'movie' 
AND NOT (
  (title ILIKE '%Lilo%Stitch%' AND release_year = 2025) OR
  (title ILIKE '%Hora do Mal%' AND release_year = 2025) OR
  (title ILIKE '%Longa Marcha%' AND release_year = 2025) OR
  (title ILIKE '%Como Treinar%Dragão%' AND release_year = 2025) OR
  (title ILIKE '%Demon Slayer%' AND release_year = 2025) OR
  (title ILIKE '%F1%Filme%' AND release_year = 2025) OR
  (title ILIKE '%Invocação do Mal%' AND release_year = 2025) OR
  (title ILIKE '%Jurassic World%' AND release_year = 2025) OR
  (title ILIKE '%Quarteto Fantástico%' AND release_year = 2025) OR
  (title ILIKE '%Superman%' AND release_year = 2025)
);

-- Remover os filmes de teste (descomente a linha abaixo para executar)
-- DELETE FROM content 
-- WHERE type = 'movie' 
-- AND NOT (
--   (title ILIKE '%Lilo%Stitch%' AND release_year = 2025) OR
--   (title ILIKE '%Hora do Mal%' AND release_year = 2025) OR
--   (title ILIKE '%Longa Marcha%' AND release_year = 2025) OR
--   (title ILIKE '%Como Treinar%Dragão%' AND release_year = 2025) OR
--   (title ILIKE '%Demon Slayer%' AND release_year = 2025) OR
--   (title ILIKE '%F1%Filme%' AND release_year = 2025) OR
--   (title ILIKE '%Invocação do Mal%' AND release_year = 2025) OR
--   (title ILIKE '%Jurassic World%' AND release_year = 2025) OR
--   (title ILIKE '%Quarteto Fantástico%' AND release_year = 2025) OR
--   (title ILIKE '%Superman%' AND release_year = 2025)
-- );

-- Verificar resultado final
-- SELECT COUNT(*) as remaining_movies FROM content WHERE type = 'movie';