-- Verificar compra do Invocação do Mal 4
-- Execute no Supabase Dashboard: https://supabase.com/dashboard/project/bxddcejjjcclglnvhzoo/editor

-- 1. Verificar se a compra existe
SELECT * FROM purchases WHERE id = 'ff26cbd6-c135-4758-98e2-65019bc13d51';

-- 2. Verificar detalhes completos da compra
SELECT
    p.id as purchase_id,
    p.user_id,
    p.content_id,
    p.status,
    p.preferred_delivery,
    p.amount_cents,
    p.created_at,
    u.email,
    c.title,
    c.type,
    c.availability
FROM purchases p
LEFT JOIN users u ON u.id::text = p.user_id::text
LEFT JOIN content c ON c.id::text = p.content_id::text
WHERE p.id = 'ff26cbd6-c135-4758-98e2-65019bc13d51';

-- 3. Verificar TODAS as compras do usuário cinevision@teste.com
SELECT
    p.id as purchase_id,
    p.status,
    c.title,
    c.type,
    p.created_at
FROM purchases p
JOIN users u ON u.id::text = p.user_id::text
JOIN content c ON c.id::text = p.content_id::text
WHERE u.email = 'cinevision@teste.com'
ORDER BY p.created_at DESC;

-- 4. Verificar se o conteúdo existe
SELECT id, title, type, availability, status FROM content
WHERE id = 'cea7478d-abcd-4039-bb1b-b15839da4cfe';
