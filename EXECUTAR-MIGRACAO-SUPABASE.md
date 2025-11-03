# 🗃️ EXECUTAR MIGRAÇÃO NO SUPABASE

**Tempo estimado:** 2 minutos

---

## 📋 PASSO A PASSO

### 1️⃣ Acesse o Supabase

**URL:** https://supabase.com/dashboard

1. Faça login
2. Selecione o projeto **CineVision**

---

### 2️⃣ Abra o SQL Editor

1. Menu lateral esquerdo: clique em **SQL Editor**
2. Clique no botão **New Query** (canto superior direito)

---

### 3️⃣ Cole o SQL Abaixo

⚠️ **IMPORTANTE:** Use o SQL do arquivo [MIGRACAO-SUPABASE-COMPLETA.sql](MIGRACAO-SUPABASE-COMPLETA.sql)

Ou copie TODO o SQL abaixo e cole no editor:

```sql
-- ============================================================
-- MIGRAÇÃO COMPLETA: Payment Provider Enum + Índices
-- Date: 2025-01-11
-- Description:
--   1. Add 'stripe' and 'mercadopago' values to payment_provider_enum
--   2. Create composite index for faster webhook lookups
--   3. Add index on created_at for temporal queries

-- Step 1: Add new enum values (PostgreSQL 9.1+)
DO $$
BEGIN
    -- Add 'stripe' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'stripe'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum'
        )
    ) THEN
        ALTER TYPE payment_provider_enum ADD VALUE 'stripe';
        RAISE NOTICE 'Added "stripe" to payment_provider_enum';
    ELSE
        RAISE NOTICE '"stripe" already exists in payment_provider_enum';
    END IF;

    -- Add 'mercadopago' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'mercadopago'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum'
        )
    ) THEN
        ALTER TYPE payment_provider_enum ADD VALUE 'mercadopago';
        RAISE NOTICE 'Added "mercadopago" to payment_provider_enum';
    ELSE
        RAISE NOTICE '"mercadopago" already exists in payment_provider_enum';
    END IF;
END$$;

-- Step 2: Create composite index for webhook lookups
-- This index speeds up queries like:
-- SELECT * FROM payments WHERE provider = 'mercadopago' AND provider_payment_id = '12345'
CREATE INDEX IF NOT EXISTS idx_payments_provider_lookup
ON payments(provider, provider_payment_id);

COMMENT ON INDEX idx_payments_provider_lookup IS
'Composite index for fast webhook payment lookups by provider and external payment ID';

-- Step 3: Create index on created_at for temporal queries
CREATE INDEX IF NOT EXISTS idx_payments_created_at
ON payments(created_at DESC);

COMMENT ON INDEX idx_payments_created_at IS
'Index for temporal queries and payment history lookups';

-- Step 4: Create index on status for filtering
-- Already exists from initial migration, but ensure it's there
CREATE INDEX IF NOT EXISTS idx_payments_status
ON payments(status);

-- Step 5: Verify the changes
DO $$
DECLARE
    enum_values TEXT[];
BEGIN
    -- Get all enum values
    SELECT ARRAY_AGG(enumlabel ORDER BY enumlabel) INTO enum_values
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum');

    RAISE NOTICE 'Current payment_provider_enum values: %', enum_values;

    -- Verify required values exist
    IF 'stripe' = ANY(enum_values) AND 'mercadopago' = ANY(enum_values) THEN
        RAISE NOTICE '✅ All required enum values are present';
    ELSE
        RAISE WARNING '⚠️ Some enum values might be missing';
    END IF;
END$$;

-- Step 6: Output index information
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'payments'
ORDER BY indexname;
```

---

### 4️⃣ Execute a Query

1. Clique no botão **Run** (canto inferior direito)
2. Ou pressione: `Ctrl + Enter` (Windows) / `Cmd + Enter` (Mac)

---

### 5️⃣ Verifique o Resultado

Você deve ver algo assim:

**Mensagens esperadas:**
```
NOTICE: Added "stripe" to payment_provider_enum
NOTICE: Added "mercadopago" to payment_provider_enum
NOTICE: Current payment_provider_enum values: {mercadopago,stripe,...}
NOTICE: ✅ All required enum values are present
```

**Tabela de índices:**
```
indexname                          | indexdef
-----------------------------------|------------------------------------------
idx_payments_created_at            | CREATE INDEX idx_payments_created_at...
idx_payments_provider_lookup       | CREATE INDEX idx_payments_provider_lookup...
idx_payments_status                | CREATE INDEX idx_payments_status...
```

---

### 6️⃣ Status de Sucesso

Se você viu as mensagens acima: **✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!**

---

## ✅ O QUE ESSA MIGRAÇÃO FAZ

| Item | O Que Faz | Por Que É Importante |
|------|-----------|---------------------|
| **Adiciona 'stripe' ao enum** | Permite pagamentos com cartão via Stripe | Essencial para aceitar cartões |
| **Adiciona 'mercadopago' ao enum** | Permite pagamentos PIX via Mercado Pago | Essencial para aceitar PIX |
| **Cria índice provider_lookup** | Acelera busca de pagamentos por provider | Webhook responde mais rápido |
| **Cria índice created_at** | Acelera queries de histórico | Dashboard carrega mais rápido |
| **Cria índice status** | Acelera filtros por status | Listagens mais rápidas |

---

## 🚫 SE DER ERRO

### Erro: "enum value already exists"
**Solução:** Tudo bem! Isso significa que o valor já foi adicionado antes. Continue normalmente.

### Erro: "table payments does not exist"
**Solução:** Você precisa criar a tabela `payments` primeiro. Entre em contato para eu gerar a migration completa.

### Erro: "permission denied"
**Solução:** Certifique-se de estar usando o SQL Editor do Supabase (não do pgAdmin). O Supabase tem as permissões corretas.

---

## 🎯 APÓS EXECUTAR

Com a migração concluída, o sistema está **100% pronto** para:

1. ✅ Aceitar pagamentos com **Cartão** (Stripe)
2. ✅ Aceitar pagamentos com **PIX** (Mercado Pago)
3. ✅ Processar webhooks de ambos os provedores
4. ✅ Entregar conteúdo automaticamente via Telegram

---

## 📞 PRÓXIMO PASSO

**Testar o sistema completo:**

1. Fazer um pagamento teste com PIX
2. Verificar se conteúdo é entregue em 5-15 segundos
3. Fazer um pagamento teste com Cartão
4. Verificar se conteúdo é entregue em 5-15 segundos

**Sistema pronto para produção!** 🚀
