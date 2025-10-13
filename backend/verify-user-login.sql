-- Verificar dados do usuário cinevision@teste.com
-- Execute no Supabase Dashboard: https://supabase.com/dashboard/project/bxddcejjjcclglnvhzoo/editor

-- 1. Verificar se o usuário existe e pegar o ID
SELECT id, email, name FROM users WHERE email = 'cinevision@teste.com';

-- 2. Verificar TODAS as compras desse usuário
SELECT
    p.id as purchase_id,
    p.status,
    p.created_at,
    c.title,
    c.content_type
FROM purchases p
JOIN content c ON c.id::text = p.content_id::text
WHERE p.user_id::text = '7cc46ab4-f8e7-442e-98fa-5f06ab57c179'
ORDER BY p.created_at DESC;
