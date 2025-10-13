-- SQL FINAL V5 - Com todos os casts corretos
-- Execute no Supabase Dashboard: https://supabase.com/dashboard/project/bxddcejjjcclglnvhzoo/editor

-- 1. Buscar o user_id (COPIE o resultado!)
SELECT id::text as user_id, email FROM users WHERE email = 'cinevision@teste.com';

-- 2. Criar a compra (SUBSTITUA 'USER_ID_AQUI' pelo ID retornado)
INSERT INTO purchases (
    user_id,
    content_id,
    amount_cents,
    currency,
    status,
    preferred_delivery
) VALUES (
    'USER_ID_AQUI',  -- ⚠️ COLE O ID AQUI
    'cea7478d-abcd-4039-bb1b-b15839da4cfe',
    720,
    'BRL',
    'paid',
    'site'
) RETURNING *;

-- 3. Verificar (com casts em ambos os lados)
SELECT
    p.id,
    p.user_id,
    u.email,
    c.title,
    p.amount_cents,
    p.status,
    p.created_at
FROM purchases p
JOIN users u ON u.id::text = p.user_id::text
JOIN content c ON c.id::text = p.content_id::text
WHERE u.email = 'cinevision@teste.com';
