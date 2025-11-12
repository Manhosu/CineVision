-- ========================================
-- GRANT FULL ACCESS TO ADMIN USERS
-- ========================================
-- Telegram IDs: 5212925997 e 2006803983
-- Acesso total a TODO o conteúdo (existente e futuro)

-- 1. Buscar IDs dos usuários admin
DO $$
DECLARE
  admin1_user_id UUID;
  admin2_user_id UUID;
  content_record RECORD;
BEGIN
  -- Buscar user_id dos admins pelos telegram_id
  SELECT id INTO admin1_user_id FROM users WHERE telegram_id = '5212925997';
  SELECT id INTO admin2_user_id FROM users WHERE telegram_id = '2006803983';

  -- Verificar se os usuários existem
  IF admin1_user_id IS NULL THEN
    RAISE NOTICE 'AVISO: Usuário com telegram_id 5212925997 não encontrado!';
  ELSE
    RAISE NOTICE 'Admin 1 encontrado: %', admin1_user_id;
  END IF;

  IF admin2_user_id IS NULL THEN
    RAISE NOTICE 'AVISO: Usuário com telegram_id 2006803983 não encontrado!';
  ELSE
    RAISE NOTICE 'Admin 2 encontrado: %', admin2_user_id;
  END IF;

  -- 2. Para cada conteúdo existente, criar purchase PAID se não existir
  FOR content_record IN
    SELECT id, title, price_cents FROM content WHERE status = 'PUBLISHED'
  LOOP
    -- Admin 1
    IF admin1_user_id IS NOT NULL THEN
      INSERT INTO purchases (
        user_id,
        content_id,
        amount_cents,
        currency,
        status,
        preferred_delivery,
        purchase_token,
        paid_at,
        created_at,
        updated_at
      )
      SELECT
        admin1_user_id,
        content_record.id,
        content_record.price_cents,
        'BRL',
        'PAID',
        'TELEGRAM',
        gen_random_uuid()::text,
        NOW(),
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM purchases
        WHERE user_id = admin1_user_id
          AND content_id = content_record.id
          AND status = 'PAID'
      );
    END IF;

    -- Admin 2
    IF admin2_user_id IS NOT NULL THEN
      INSERT INTO purchases (
        user_id,
        content_id,
        amount_cents,
        currency,
        status,
        preferred_delivery,
        purchase_token,
        paid_at,
        created_at,
        updated_at
      )
      SELECT
        admin2_user_id,
        content_record.id,
        content_record.price_cents,
        'BRL',
        'PAID',
        'TELEGRAM',
        gen_random_uuid()::text,
        NOW(),
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM purchases
        WHERE user_id = admin2_user_id
          AND content_id = content_record.id
          AND status = 'PAID'
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Processo concluído!';
END $$;

-- 3. Criar função trigger para conteúdo futuro
CREATE OR REPLACE FUNCTION grant_admin_access_on_new_content()
RETURNS TRIGGER AS $$
DECLARE
  admin1_user_id UUID;
  admin2_user_id UUID;
BEGIN
  -- Apenas para conteúdo PUBLISHED
  IF NEW.status = 'PUBLISHED' THEN
    -- Buscar IDs dos admins
    SELECT id INTO admin1_user_id FROM users WHERE telegram_id = '5212925997';
    SELECT id INTO admin2_user_id FROM users WHERE telegram_id = '2006803983';

    -- Criar purchase para admin 1
    IF admin1_user_id IS NOT NULL THEN
      INSERT INTO purchases (
        user_id,
        content_id,
        amount_cents,
        currency,
        status,
        preferred_delivery,
        purchase_token,
        paid_at,
        created_at,
        updated_at
      )
      VALUES (
        admin1_user_id,
        NEW.id,
        NEW.price_cents,
        'BRL',
        'PAID',
        'TELEGRAM',
        gen_random_uuid()::text,
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Criar purchase para admin 2
    IF admin2_user_id IS NOT NULL THEN
      INSERT INTO purchases (
        user_id,
        content_id,
        amount_cents,
        currency,
        status,
        preferred_delivery,
        purchase_token,
        paid_at,
        created_at,
        updated_at
      )
      VALUES (
        admin2_user_id,
        NEW.id,
        NEW.price_cents,
        'BRL',
        'PAID',
        'TELEGRAM',
        gen_random_uuid()::text,
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger que executa a função
DROP TRIGGER IF EXISTS trigger_grant_admin_access ON content;
CREATE TRIGGER trigger_grant_admin_access
  AFTER INSERT OR UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION grant_admin_access_on_new_content();

-- 5. Verificar resultado
SELECT
  u.telegram_id,
  u.name,
  COUNT(p.id) as total_purchases
FROM users u
LEFT JOIN purchases p ON p.user_id = u.id AND p.status = 'PAID'
WHERE u.telegram_id IN ('5212925997', '2006803983')
GROUP BY u.telegram_id, u.name;

SELECT 'Script concluído! Admins agora têm acesso a todo o conteúdo (existente e futuro).' as status;
