/**
 * Igor (01/06): WhatsApp começou a bloquear a conta dele por suspeita de
 * spam — todas as mensagens de recuperação eram idênticas. Esse helper
 * sorteia 1 de 10 templates diferentes por `order_id` (determinístico —
 * mesma compra sempre dá o mesmo template, então se Igor reabrir a lista
 * ele vê a mesma mensagem; e compras diferentes pegam mensagens diferentes
 * pra romper o padrão que o anti-spam do WA detecta).
 *
 * Variações cobrem:
 *  - Saudação (Olá / Oi / Eai / Opa / Boa tarde / etc.)
 *  - Estrutura (link no meio vs no final, com/sem valor da compra)
 *  - Tom (formal vs informal, com/sem emoji)
 *  - Fechamento (qualquer coisa me chama / é automático / boa diversão / etc.)
 *
 * IMPORTANTE: o link em si tem que continuar sendo `t.me/{bot}?start=order_{token}`
 * porque o bot reconhece esse formato. Pra disfarçar mais, algumas variações
 * usam `https://` e outras só `t.me/...` (WA renderiza igual).
 */

interface TemplateContext {
  totalCents: number;
  claimUrl: string;
  /**
   * Variante claim_url sem o prefixo `https://` — algumas mensagens usam
   * essa pra variar a forma como o link aparece no preview do WhatsApp.
   */
  claimUrlBare: string;
}

const fmtMoney = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

type TemplateFn = (ctx: TemplateContext) => string;

const TEMPLATES: TemplateFn[] = [
  // 0 — clássica, com valor da compra explícito
  ({ totalCents, claimUrl }) =>
    `Olá! Vi aqui que você fez uma compra (${fmtMoney(totalCents)}) e ainda não recebeu o acesso.\n\nPra liberar é só abrir nosso bot:\n${claimUrl}\n\nÉ automático.`,

  // 1 — informal, link no final sem "https"
  ({ totalCents, claimUrlBare }) =>
    `Oi! Sua compra de ${fmtMoney(totalCents)} aqui no sistema tá pronta — falta só você abrir nosso bot no Telegram pra receber:\n\n${claimUrlBare}`,

  // 2 — direto, sem citar valor
  ({ claimUrl }) =>
    `Opa! Aqui é da Cine Vision. Tá faltando você abrir o nosso bot pra receber o que comprou. O link é esse:\n\n${claimUrl}\n\nAbriu, chegou.`,

  // 3 — pergunta no início
  ({ totalCents, claimUrl }) =>
    `Eii, tudo bem? Identifiquei sua compra de ${fmtMoney(totalCents)} mas o acesso ainda não foi liberado. Resolve abrindo esse link:\n\n${claimUrl}`,

  // 4 — link primeiro, contexto depois
  ({ totalCents, claimUrlBare }) =>
    `${claimUrlBare}\n\nOlá! Esse é o link de acesso da sua compra de ${fmtMoney(totalCents)} aqui na Cine Vision. Abre que chega tudo automático.`,

  // 5 — mais curta
  ({ claimUrl }) =>
    `Boa! Passei aqui só pra mandar o link da sua compra:\n${claimUrl}\n\nQualquer coisa me chama.`,

  // 6 — "ainda não foi entregue"
  ({ totalCents, claimUrl }) =>
    `Oii! Sua compra de ${fmtMoney(totalCents)} ainda não foi entregue por aqui. Pra resolver, é só clicar nesse link:\n${claimUrl}\n\nQuando abrir, os links vêm direto pra você.`,

  // 7 — formal
  ({ totalCents, claimUrl }) =>
    `Olá, tudo bem? Aqui é da Cine Vision. Sua compra (${fmtMoney(totalCents)}) está aguardando entrega. Esse link vai resolver:\n\n${claimUrl}`,

  // 8 — "boa tarde"
  ({ claimUrlBare }) =>
    `Boa tarde! Tô passando aqui pra mandar o link de acesso do conteúdo que você comprou. Abre aqui:\n${claimUrlBare}\n\nSe precisar de algo, é só responder.`,

  // 9 — "eai", coloquial
  ({ totalCents, claimUrl }) =>
    `Eai! Sua compra de ${fmtMoney(totalCents)} ainda tá esperando você abrir nosso bot. Pra liberar é nesse link:\n\n${claimUrl}\n\nDá uns segundos e os filmes chegam.`,
];

/**
 * Escolha determinística baseada no hash do orderId. Garante que a mesma
 * order sempre receba a mesma mensagem (consistente quando Igor reabre o
 * painel) e orders diferentes recebam mensagens diferentes (rompe padrão
 * detectável pelo anti-spam do WA).
 */
export function pickWhatsappTemplate(
  orderId: string,
  totalCents: number,
  claimUrl: string,
): string {
  const claimUrlBare = claimUrl.replace(/^https?:\/\//, '');
  const hex = orderId.replace(/[^0-9a-f]/gi, '');
  const num = parseInt(hex.slice(0, 8) || '0', 16) || 0;
  const idx = num % TEMPLATES.length;
  return TEMPLATES[idx]({ totalCents, claimUrl, claimUrlBare });
}
