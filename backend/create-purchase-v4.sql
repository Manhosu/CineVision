-- SQL CORRIGIDO V4 - Tabela é "content" não "contents"
-- Execute no Supabase Dashboard: https://supabase.com/dashboard/project/bxddcejjjcclglnvhzoo/editor

-- 1. Buscar o user_id (COPIE o resultado como texto!)
SELECT id::text as user_id, email FROM users WHERE email = 'cinevision@teste.com';

-- 2. Criar a compra (SUBSTITUA 'USER_ID_AQUI' pelo ID retornado acima)
INSERT INTO purchases (
    user_id,
    content_id,
    amount_cents,
    currency,
    status,
    preferred_delivery
) VALUES (
    'USER_ID_AQUI',  -- ⚠️ COLE O ID DO USUÁRIO AQUI (mantenha as aspas)
    'cea7478d-abcd-4039-bb1b-b15839da4cfe',
    720,
    'BRL',
    'paid',
    'site'
) RETURNING *;

-- 3. Verificar se a compra foi criada
SELECT
    p.id,
    p.user_id,
    u.email,
    c.title,
    p.amount_cents,
    p.status,
    p.created_at
FROM purchases p
JOIN users u ON u.id::text = p.user_id
JOIN content c ON c.id::text = p.content_id
WHERE u.email = 'cinevision@teste.com';
