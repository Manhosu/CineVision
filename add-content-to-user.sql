-- Script para adicionar Superman e Wandinha ao dashboard do usuário telegram_id 2006803983
-- Execute este script no Supabase SQL Editor

-- 1. Verificar usuário
SELECT id, username, telegram_id, email
FROM users
WHERE telegram_id = '2006803983';

-- 2. Buscar Superman (filme)
SELECT id, title, content_type, status, created_at
FROM content
WHERE title ILIKE '%superman%' AND content_type = 'movie'
ORDER BY created_at DESC
LIMIT 1;

-- 3. Buscar Wandinha (série)
SELECT id, title, content_type, status, created_at
FROM content
WHERE title ILIKE '%wandinha%' AND content_type = 'series'
ORDER BY created_at DESC
LIMIT 1;

-- 4. Verificar compras existentes do usuário
SELECT p.id, c.title, c.content_type, p.status, p.created_at
FROM purchases p
JOIN content c ON c.id = p.content_id
JOIN users u ON u.id = p.user_id
WHERE u.telegram_id = '2006803983'
ORDER BY p.created_at DESC;

-- 5. Adicionar Superman ao dashboard (substitua USER_ID e SUPERMAN_ID pelos valores corretos)
-- Primeiro execute as queries acima para pegar os IDs
INSERT INTO purchases (user_id, content_id, amount_cents, currency, status, created_at, updated_at)
SELECT
  u.id as user_id,
  c.id as content_id,
  0 as amount_cents,
  'BRL' as currency,
  'COMPLETED' as status,
  NOW() as created_at,
  NOW() as updated_at
FROM users u
CROSS JOIN content c
WHERE u.telegram_id = '2006803983'
  AND c.title ILIKE '%superman%'
  AND c.content_type = 'movie'
  AND NOT EXISTS (
    SELECT 1 FROM purchases p
    WHERE p.user_id = u.id AND p.content_id = c.id
  );

-- 6. Adicionar Wandinha ao dashboard (se ainda não existir)
INSERT INTO purchases (user_id, content_id, amount_cents, currency, status, created_at, updated_at)
SELECT
  u.id as user_id,
  c.id as content_id,
  0 as amount_cents,
  'BRL' as currency,
  'COMPLETED' as status,
  NOW() as created_at,
  NOW() as updated_at
FROM users u
CROSS JOIN content c
WHERE u.telegram_id = '2006803983'
  AND c.title ILIKE '%wandinha%'
  AND c.content_type = 'series'
  AND NOT EXISTS (
    SELECT 1 FROM purchases p
    WHERE p.user_id = u.id AND p.content_id = c.id
  );

-- 7. Verificar resultado final - Listar todas as compras do usuário
SELECT
  p.id,
  c.title,
  c.content_type,
  p.status,
  p.amount_cents,
  p.created_at
FROM purchases p
JOIN content c ON c.id = p.content_id
JOIN users u ON u.id = p.user_id
WHERE u.telegram_id = '2006803983'
ORDER BY p.created_at DESC;
