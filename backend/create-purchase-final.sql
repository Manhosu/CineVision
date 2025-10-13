-- SQL FINAL CORRIGIDO para criar compra
-- Execute no Supabase Dashboard: https://supabase.com/dashboard/project/bxddcejjjcclglnvhzoo/editor

-- 1. Buscar o user_id (COPIE o resultado!)
SELECT id::text, email FROM users WHERE email = 'cinevision@teste.com';

-- 2. Criar a compra (SUBSTITUA 'USER_ID_AQUI' pelo ID retornado acima - como texto)
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

-- 3. Verificar se a compra foi criada (com CAST para corrigir tipo)
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
JOIN contents c ON c.id::text = p.content_id
WHERE u.email = 'cinevision@teste.com'
  AND c.id::text = 'cea7478d-abcd-4039-bb1b-b15839da4cfe';
