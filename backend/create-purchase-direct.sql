-- SQL para criar compra para usuário cinevision@teste.com
-- Execute este SQL no Supabase Dashboard: https://supabase.com/dashboard/project/bxddcejjjcclglnvhzoo/editor

-- 1. Buscar o user_id (copie o resultado)
SELECT id, email, name FROM users WHERE email = 'cinevision@teste.com';

-- 2. Criar a compra (substitua 'USER_ID_AQUI' pelo ID retornado acima)
INSERT INTO purchases (
    id,
    user_id,
    content_id,
    amount_cents,
    currency,
    status,
    preferred_delivery,
    purchase_token,
    payment_confirmed_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'USER_ID_AQUI',  -- SUBSTITUA PELO ID DO USUÁRIO
    'cea7478d-abcd-4039-bb1b-b15839da4cfe',  -- Invocação do Mal 4
    720,  -- R$ 7,20
    'BRL',
    'paid',
    'site',
    gen_random_uuid(),
    NOW(),
    NOW(),
    NOW()
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
