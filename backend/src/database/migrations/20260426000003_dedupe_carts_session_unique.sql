-- ============================================================================
-- Dedupe carts and add UNIQUE(session_id) so each session has at most one cart.
-- This is idempotent and safe to run on production data.
-- ============================================================================

-- Step 1: dedupe cart_items first (rows that already collide on (cart_id, content_id))
DELETE FROM cart_items ci USING (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY cart_id, content_id ORDER BY added_at) AS rn
  FROM cart_items
) d
WHERE ci.id = d.id AND d.rn > 1;

-- Step 2: when carts are duplicated for the same session_id and would create
-- conflicts after re-parenting items, delete the redundant items first.
WITH ranked AS (
  SELECT c.id,
         FIRST_VALUE(c.id) OVER (PARTITION BY c.session_id ORDER BY c.created_at) AS keeper
  FROM carts c WHERE c.session_id IS NOT NULL
),
items_with_keeper AS (
  SELECT ci.id,
         ROW_NUMBER() OVER (PARTITION BY r.keeper, ci.content_id ORDER BY ci.added_at) AS rn
  FROM cart_items ci
  JOIN ranked r ON ci.cart_id = r.id
)
DELETE FROM cart_items ci USING items_with_keeper iwk
WHERE ci.id = iwk.id AND iwk.rn > 1;

-- Step 3: safely re-parent remaining items to the oldest cart per session_id
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) AS rn,
         FIRST_VALUE(id) OVER (PARTITION BY session_id ORDER BY created_at) AS keeper
  FROM carts WHERE session_id IS NOT NULL
)
UPDATE cart_items ci SET cart_id = r.keeper
FROM ranked r WHERE ci.cart_id = r.id AND r.rn > 1;

-- Step 4: drop duplicate carts per session_id (keep the oldest)
DELETE FROM carts c USING (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) AS rn
  FROM carts WHERE session_id IS NOT NULL
) d
WHERE c.id = d.id AND d.rn > 1;

-- Step 5: enforce UNIQUE(session_id) for carts where session_id is set
CREATE UNIQUE INDEX IF NOT EXISTS uniq_carts_session_id
  ON carts (session_id)
  WHERE session_id IS NOT NULL;
