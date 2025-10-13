-- SQL CORRIGIDO para criar compra
-- Execute no Supabase Dashboard: https://supabase.com/dashboard/project/bxddcejjjcclglnvhzoo/editor

-- 1. Buscar o user_id (COPIE o resultado!)
SELECT id, email FROM users WHERE email = 'cinevision@teste.com';

-- 2. Criar a compra (SUBSTITUA 'USER_ID_AQUI' pelo ID retornado acima)
INSERT INTO purchases (
    user_id,
    content_id,
    amount_cents,
    currency,
    status,
    preferred_delivery
) VALUES (
    'USER_ID_AQUI',  -- ⚠️ COLE O ID DO USUÁRIO AQUI
    'cea7478d-abcd-4039-bb1b-b15839da4cfe',  -- Invocação do Mal 4
    720,  -- R$ 7,20
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
JOIN users u ON u.id = p.user_id
JOIN contents c ON c.id = p.content_id
WHERE u.email = 'cinevision@teste.com'
  AND c.id = 'cea7478d-abcd-4039-bb1b-b15839da4cfe';
