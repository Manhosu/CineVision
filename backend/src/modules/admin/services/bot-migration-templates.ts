/**
 * Igor (07/06): Fase C — migração WhatsApp quando um bot Telegram cai.
 *
 * 10 templates rotativos pra romper padrão do anti-spam do WA. Determinístico
 * por userId (mesma pessoa recebe sempre a mesma mensagem se rodar 2x, mas
 * pessoas diferentes recebem variações distintas).
 *
 * Mensagem NÃO cita nome de filme, "catálogo", "1080p", "dublado" — texto
 * neutro pra não enquadrar como infração. O link do bot novo vem no formato
 * `t.me/<username>` simples, sem `?start=...` (cliente entra direto).
 */

interface TemplateContext {
  /** URL do bot ativo pro usuário migrar (ex: https://t.me/CineVisionBrasil_bot). */
  newBotUrl: string;
  /** Mesma URL sem o prefixo https:// — pra variar a forma de exibição. */
  newBotUrlBare: string;
  /** @username do bot novo (sem t.me/). */
  newBotHandle: string;
}

type TemplateFn = (ctx: TemplateContext) => string;

const TEMPLATES: TemplateFn[] = [
  // 0 — neutra, "instabilidade"
  ({ newBotUrl }) =>
    `Olá! Aqui é da Cine Vision. Tivemos uma instabilidade no nosso atendimento do Telegram e migramos pra outro canal.\n\nPra continuar acessando seus conteúdos, é só abrir esse link:\n${newBotUrl}\n\nÉ automático.`,

  // 1 — "número novo"
  ({ newBotUrl }) =>
    `Oi! Tô passando aqui pra avisar que o nosso atendimento mudou de número no Telegram. Pra ficar tudo certo, é só abrir esse link e mandar /start:\n\n${newBotUrl}\n\nO histórico continua o mesmo.`,

  // 2 — informal, sem https
  ({ newBotUrlBare, newBotHandle }) =>
    `Eai! O ${newBotHandle} é o nosso novo atendimento. Acessa por aqui que já reconhece:\n\n${newBotUrlBare}\n\nQualquer coisa me chama.`,

  // 3 — direto, sem rodeio
  ({ newBotUrl }) =>
    `Atualização rápida: nosso atendimento mudou de bot. Pra continuar, é só clicar:\n${newBotUrl}\n\nFunciona igualzinho.`,

  // 4 — link primeiro
  ({ newBotUrl }) =>
    `${newBotUrl}\n\nOlá! Esse é o nosso novo canal de atendimento. Migra por aí pra manter seu acesso ativo.`,

  // 5 — "boa tarde"
  ({ newBotUrlBare }) =>
    `Boa tarde! Quem fala é a Cine Vision. Tivemos que migrar nosso atendimento pra outro bot — link aqui:\n${newBotUrlBare}\n\nSeu acesso continua normal por lá.`,

  // 6 — "tudo bem?"
  ({ newBotUrl }) =>
    `Oii, tudo bem? Só passando pra avisar uma mudança: nosso atendimento agora roda em outro bot. Abre esse link aqui que já conecta:\n\n${newBotUrl}`,

  // 7 — "atualizamos"
  ({ newBotUrl, newBotHandle }) =>
    `Eai! Atualizamos nosso atendimento — agora o oficial é o ${newBotHandle}. Abre por aqui e manda /start:\n\n${newBotUrl}\n\nLeva 5 segundos.`,

  // 8 — "novo canal"
  ({ newBotUrlBare }) =>
    `Oi! Aqui é da Cine Vision. Temos um canal novo de atendimento. Pra continuar acessando, é só entrar por aqui:\n${newBotUrlBare}\n\nSeus acessos continuam ativos.`,

  // 9 — "passei aqui"
  ({ newBotUrl }) =>
    `Opa! Passei aqui rapidão pra avisar: nosso bot anterior está fora do ar. O novo canal é esse:\n\n${newBotUrl}\n\nAbre e segue normal.`,
];

export function pickBotMigrationTemplate(
  userId: string,
  newBotUrl: string,
  newBotHandle: string,
): string {
  const newBotUrlBare = newBotUrl.replace(/^https?:\/\//, '');
  const hex = userId.replace(/[^0-9a-f]/gi, '');
  const num = parseInt(hex.slice(0, 8) || '0', 16) || 0;
  const idx = num % TEMPLATES.length;
  return TEMPLATES[idx]({ newBotUrl, newBotUrlBare, newBotHandle });
}

export const BOT_MIGRATION_TEMPLATE_COUNT = TEMPLATES.length;
