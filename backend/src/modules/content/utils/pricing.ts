/**
 * Igor (13/07): helper CANÔNICO pra cálculo do preço efetivo de um content.
 *
 * Antes dessa centralização, o preço era calculado em 4 lugares:
 *   - cart.service.addItem
 *   - telegrams-enhanced.calculateFinalPrice (bot oficial callback)
 *   - telegrams-enhanced.createIntentForSiteVisitor (Cenário 3 anônimo)
 *   - telegrams-enhanced.detourPurchaseToPromoBot (Cenário 3 logado)
 *
 * Cada um usava lógica ligeiramente diferente. Igor testou fluxos reais
 * e mostrou 2 bugs (13/07 madrugada):
 *   BUG A: bot promo cobrava R$ 7,90 num filme com 5% flash promo global
 *          (site mostrava R$ 7,50 correto)
 *   BUG B: bot oficial cobrava R$ 7,50 num filme em pré-venda R$ 6,90
 *          + 5% flash (aplicava desconto no preço cheio, ignorou presale)
 *
 * Ordem canônica agora respeitada em TODA superfície de venda:
 *   1. Presale: se ativa E presale_price_cents < price_cents → GANHA sempre
 *   2. Discount: se existe e discount_percentage > 0 → aplica sobre price_cents
 *   3. Full: preço cheio, sem ajuste
 *
 * Presale NUNCA acumula com discount (Igor: "pré-venda é exclusiva").
 * Passe `discount = null` se o contexto não tem cliente DB (chamadas de
 * cálculo puro em fluxos que já resolveram desconto).
 */

export type EffectivePriceSource = 'presale' | 'discount' | 'full';

export interface EffectivePrice {
  priceCents: number;
  source: EffectivePriceSource;
  discountPercent?: number;
  originalCents?: number;
}

export interface PricingContent {
  price_cents: number;
  is_presale?: boolean | null;
  presale_price_cents?: number | null;
}

export interface PricingDiscount {
  discount_percentage: number;
  is_flash?: boolean;
}

export function getEffectivePriceCents(
  content: PricingContent,
  discount?: PricingDiscount | null,
): EffectivePrice {
  const full = Math.max(0, content.price_cents || 0);

  // 1) Pré-venda vence sempre (Igor: exclusiva, não acumula)
  if (
    content.is_presale &&
    content.presale_price_cents &&
    content.presale_price_cents < full
  ) {
    const presale = content.presale_price_cents;
    const percent = full > 0 ? Math.round(((full - presale) / full) * 100) : 0;
    return {
      priceCents: presale,
      source: 'presale',
      discountPercent: percent,
      originalCents: full,
    };
  }

  // 2) Discount (flash ou não)
  if (discount && discount.discount_percentage > 0 && discount.discount_percentage <= 100) {
    const cents = Math.round(full * (1 - discount.discount_percentage / 100));
    return {
      priceCents: cents,
      source: 'discount',
      discountPercent: discount.discount_percentage,
      originalCents: full,
    };
  }

  // 3) Cheio
  return { priceCents: full, source: 'full' };
}
