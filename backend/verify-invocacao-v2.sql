-- Verificar compra e conteúdo do Invocação do Mal 4
-- Execute no Supabase Dashboard: https://supabase.com/dashboard/project/bxddcejjjcclglnvhzoo/editor

-- 1. Verificar TODAS as compras do usuário cinevision@teste.com
SELECT
    p.id as purchase_id,
    p.status,
    c.title,
    c.content_type,
    c.availability,
    c.status as content_status,
    p.created_at
FROM purchases p
JOIN users u ON u.id::text = p.user_id::text
JOIN content c ON c.id::text = p.content_id::text
WHERE u.email = 'cinevision@teste.com'
ORDER BY p.created_at DESC;

-- 2. Verificar se o conteúdo "Invocação do Mal 4" existe e seus detalhes
SELECT
    id,
    title,
    content_type,
    availability,
    status,
    processing_status,
    price_cents
FROM content
WHERE id = 'cea7478d-abcd-4039-bb1b-b15839da4cfe';
