-- Verificar se a compra ff26cbd6-c135-4758-98e2-65019bc13d51 existe
-- Execute no Supabase Dashboard: https://supabase.com/dashboard/project/bxddcejjjcclglnvhzoo/editor

-- 1. Buscar diretamente pelo ID da compra
SELECT * FROM purchases WHERE id = 'ff26cbd6-c135-4758-98e2-65019bc13d51';

-- 2. Contar compras do usuário
SELECT COUNT(*) as total_purchases
FROM purchases
WHERE user_id::text = '7cc46ab4-f8e7-442e-98fa-5f06ab57c179';

-- 3. Listar TODAS as compras do usuário (sem JOIN)
SELECT
    id,
    user_id,
    content_id,
    status,
    amount_cents,
    created_at
FROM purchases
WHERE user_id::text = '7cc46ab4-f8e7-442e-98fa-5f06ab57c179'
ORDER BY created_at DESC;
