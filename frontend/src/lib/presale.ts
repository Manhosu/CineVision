// Igor (04/06): helpers compartilhados pra renderizar pré-venda em cards,
// hero banner e página de detalhe. Centraliza a regra de qual preço mostrar
// e qual badge/cor — pra mudança futura ficar num lugar só.

export interface PresaleInfo {
  isPresale: boolean;
  /** Preço efetivo a ser cobrado/mostrado (em centavos). */
  effectivePriceCents: number;
  /** Preço original (riscado), em centavos. Null se sem desconto. */
  originalPriceCents: number | null;
  /** Percentual de desconto (inteiro), null se sem desconto. */
  discountPercent: number | null;
  /** Data prevista de liberação (ISO), se admin cadastrou. */
  releaseAt: string | null;
}

export function getPresaleInfo(content: {
  is_presale?: boolean;
  presale_price_cents?: number | null;
  presale_release_at?: string | null;
  price_cents?: number;
} | null | undefined): PresaleInfo {
  const original = content?.price_cents || 0;
  if (!content?.is_presale) {
    return {
      isPresale: false,
      effectivePriceCents: original,
      originalPriceCents: null,
      discountPercent: null,
      releaseAt: null,
    };
  }
  const presale = content.presale_price_cents ?? null;
  const effective = presale != null && presale > 0 && presale < original ? presale : original;
  const hasDiscount = presale != null && presale > 0 && presale < original;
  return {
    isPresale: true,
    effectivePriceCents: effective,
    originalPriceCents: hasDiscount ? original : null,
    discountPercent: hasDiscount && original > 0
      ? Math.round(((original - presale) / original) * 100)
      : null,
    releaseAt: content.presale_release_at || null,
  };
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Formata countdown "Em X dias", "Em Xh Ymin", "Em Xmin" ou null se passou */
export function formatPresaleCountdown(releaseAt: string | null | undefined): string | null {
  if (!releaseAt) return null;
  const ms = new Date(releaseAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 2) return `Em ${days} dias`;
  if (days === 1) return 'Em 1 dia';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) {
    const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return mins ? `Em ${hours}h ${mins}min` : `Em ${hours}h`;
  }
  const mins = Math.max(1, Math.floor(ms / (60 * 1000)));
  return `Em ${mins}min`;
}
