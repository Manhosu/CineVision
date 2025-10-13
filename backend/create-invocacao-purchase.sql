-- Criar compra do Invocação do Mal 4 para cinevision@teste.com
-- Execute no Supabase Dashboard: https://supabase.com/dashboard/project/bxddcejjjcclglnvhzoo/editor

INSERT INTO purchases (
    user_id,
    content_id,
    amount_cents,
    currency,
    status,
    preferred_delivery
) VALUES (
    '7cc46ab4-f8e7-442e-98fa-5f06ab57c179',
    'cea7478d-abcd-4039-bb1b-b15839da4cfe',
    720,
    'BRL',
    'paid',
    'site'
) RETURNING *;

-- Verificar a compra criada
SELECT
    p.id as purchase_id,
    p.status,
    p.amount_cents,
    u.email,
    c.title,
    c.content_type,
    c.status as content_status,
    p.created_at
FROM purchases p
JOIN users u ON u.id::text = p.user_id::text
JOIN content c ON c.id::text = p.content_id::text
WHERE p.user_id::text = '7cc46ab4-f8e7-442e-98fa-5f06ab57c179'
AND p.content_id::text = 'cea7478d-abcd-4039-bb1b-b15839da4cfe';
