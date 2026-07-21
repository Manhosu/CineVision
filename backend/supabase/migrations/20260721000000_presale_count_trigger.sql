-- Igor (21/07): pré-venda "0 clientes" no tooltip do botão liberar.
-- Root cause: coluna `content.presale_purchases_count` foi criada em 04/06
-- prometendo "incrementado a cada compra" mas ninguém implementou a lógica.
-- Ficou eternamente 0 e Igor viu 0 clientes no tooltip do Homem-Aranha
-- (que tinha 8 pagos + 48 mal-marcados = 56 vendas reais).
--
-- Estratégia: backfill primeiro (sem trigger ativo pra evitar cascata
-- recursiva no UPDATE em massa), depois cria trigger que mantém coerência
-- daí pra frente.

-- 1) Backfill secundário: quando content vira is_presale=true DEPOIS de já
-- ter vendas pagas, essas vendas ficaram com is_presale_purchase=false e
-- nunca serão notificadas quando ele liberar. Cenário Homem-Aranha: 48
-- pagas com flag false. Marca todas as pagas de content em pré-venda
-- ainda não liberado.
UPDATE purchases p
SET is_presale_purchase = TRUE
FROM content c
WHERE p.content_id = c.id
  AND c.is_presale = TRUE
  AND LOWER(p.status) = 'paid'
  AND p.presale_released_at IS NULL
  AND p.is_presale_purchase = FALSE;

-- 2) Backfill principal: popula content.presale_purchases_count com o
-- valor real (paid + presale + não liberado).
UPDATE content c
SET presale_purchases_count = COALESCE(sub.n, 0)
FROM (
  SELECT p.content_id, COUNT(*)::int AS n
  FROM purchases p
  WHERE p.is_presale_purchase = TRUE
    AND p.presale_released_at IS NULL
    AND LOWER(p.status) = 'paid'
  GROUP BY p.content_id
) sub
WHERE c.id = sub.content_id;

-- Zera contents que não têm pré-venda ativa (limpeza defensiva).
UPDATE content
SET presale_purchases_count = 0
WHERE presale_purchases_count > 0
  AND id NOT IN (
    SELECT DISTINCT content_id FROM purchases
    WHERE is_presale_purchase = TRUE
      AND presale_released_at IS NULL
      AND LOWER(status) = 'paid'
  );

-- 3) Função e trigger pra manter coerência daí pra frente.
CREATE OR REPLACE FUNCTION refresh_content_presale_count(p_content_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE content
  SET presale_purchases_count = (
    SELECT COUNT(*)::int
    FROM purchases
    WHERE content_id = p_content_id
      AND is_presale_purchase = TRUE
      AND presale_released_at IS NULL
      AND LOWER(status) = 'paid'
  )
  WHERE id = p_content_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_purchases_refresh_presale_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_content_presale_count(OLD.content_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_content_presale_count(NEW.content_id);
    IF TG_OP = 'UPDATE' AND OLD.content_id IS DISTINCT FROM NEW.content_id THEN
      PERFORM refresh_content_presale_count(OLD.content_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS purchases_refresh_presale_count ON purchases;
CREATE TRIGGER purchases_refresh_presale_count
AFTER INSERT OR UPDATE OF status, is_presale_purchase, presale_released_at OR DELETE
ON purchases
FOR EACH ROW
EXECUTE FUNCTION trg_purchases_refresh_presale_count();

COMMENT ON FUNCTION refresh_content_presale_count IS
  'Igor (21/07): recalcula content.presale_purchases_count a partir das purchases pagas e não liberadas.';
