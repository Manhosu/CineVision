import { Controller, Post, Body, Headers, Logger, Get, Param, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TelegramsService } from './telegrams.service';
import { TelegramsEnhancedService } from './telegrams-enhanced.service';
import { SupabaseService } from '../../config/supabase.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  InitiateTelegramPurchaseDto,
  TelegramPurchaseResponseDto,
  VerifyEmailDto,
  VerifyEmailResponseDto,
} from './dto';

@ApiTags('telegrams')
@Controller('telegrams')
export class TelegramsController {
  private readonly logger = new Logger(TelegramsController.name);

  // Eduardo (16/07): throttle in-memory (60s por bot) pra last_update_received_at.
  // Bot quente recebe update a cada poucos segundos; stampar toda vez sobrecarrega
  // a tabela sem ganho (a resolução de 1min é o que precisamos pro healthcheck).
  private lastUpdateStamp = new Map<string, number>();

  constructor(
    private readonly telegramsService: TelegramsService,
    private readonly telegramsEnhancedService: TelegramsEnhancedService,
    private readonly supabase: SupabaseService,
  ) {
    this.logger.log('TelegramsController initialized');
  }

  // Igor pediu (04/05): re-acesso pelo dashboard. Cliente já comprou,
  // vai assistir outro dia, clica em "Assistir" — backend valida
  // ownership e gera invite single-use de 24h on-the-fly. Sem expor
  // link permanente que dá pra encaminhar pra terceiros.
  @Post('access-link/:contentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate single-use Telegram invite link for purchased content',
    description:
      'Validates the authenticated user owns a paid purchase of contentId, then returns a single-use invite link (24h expiry) generated via Bot API.',
  })
  @ApiResponse({ status: 200, description: 'Invite link generated' })
  @ApiResponse({ status: 403, description: 'User did not purchase this content' })
  @ApiResponse({ status: 400, description: 'Content has no Telegram group configured' })
  async getAccessLink(
    @Param('contentId') contentId: string,
    @GetUser() user: any,
  ) {
    return this.telegramsEnhancedService.getOrCreateAccessLinkForPurchasedContent(
      user.sub,
      contentId,
    );
  }

  // Igor (17/05): o botão "Assistir" do dashboard/home agora dispara o
  // ENVIO dos links de acesso ao grupo NO TELEGRAM do cliente — em vez
  // de o frontend abrir uma aba (o `window.open` causava tela branca
  // `about:blank` travada em mobile). Se o cliente não tem Telegram
  // vinculado, devolve `{ sent: false, link }` pro frontend abrir.
  @Post('send-access/:contentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send Telegram group access links to the user via the bot',
    description:
      'Validates ownership of contentId, then makes the bot send the access links (24h + fixed) to the user\'s Telegram DM. Returns { sent: true } when delivered, or { sent: false, link } if the user has no Telegram linked.',
  })
  @ApiResponse({ status: 200, description: 'Access sent or link returned' })
  @ApiResponse({ status: 403, description: 'User did not purchase this content' })
  @ApiResponse({ status: 400, description: 'Content has no Telegram group configured' })
  async sendAccess(
    @Param('contentId') contentId: string,
    @GetUser() user: any,
  ) {
    return this.telegramsEnhancedService.sendAccessToUser(user.sub, contentId);
  }

  // Igor (07/05): valida Chat ID na hora de cadastrar conteúdo —
  // mostra se bot é admin do grupo + tem permissão de invite, antes
  // do cliente descobrir pagando.
  @Post('validate-chat-id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate if bot is admin of given chat ID with invite permission' })
  async validateChatId(@Body() body: { chat_id: string }) {
    return this.telegramsEnhancedService.validateChatIdAdmin(body.chat_id || '');
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Telegram bot webhook handler (legacy, default bot)' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Body() webhookData: any,
    @Headers('x-telegram-bot-api-secret-token') signature?: string
  ) {
    return this.telegramsEnhancedService.handleWebhook(webhookData, signature);
  }

  /**
   * Igor (07/06): webhook por bot. Cada bot cadastrado em telegram_bots
   * pode ter URL própria `/webhook/<botId>` — assim o backend identifica
   * qual bot recebeu a mensagem (Telegram não envia bot_id no payload).
   * O `/webhook` legado continua atendendo o bot default pra compat.
   */
  @Post('webhook/:botId')
  @ApiOperation({ summary: 'Telegram bot webhook handler (multi-bot)' })
  async handleWebhookForBot(
    @Param('botId') botId: string,
    @Body() webhookData: any,
    @Headers('x-telegram-bot-api-secret-token') signature?: string,
  ) {
    // Eduardo (16/07): fire-and-forget stamp de last_update_received_at.
    // Prova viva de que o Telegram tá entregando updates pra esse bot.
    // Throttle 60s por bot pra não sobrecarregar a tabela (bot quente
    // recebe update a cada 1-2s). Se erro na stamp, ignora — não pode
    // atrasar a resposta ao Telegram (que exige <=10s).
    const now = Date.now();
    const last = this.lastUpdateStamp.get(botId) || 0;
    if (now - last > 60_000) {
      this.lastUpdateStamp.set(botId, now);
      this.supabase.client
        .from('telegram_bots')
        .update({ last_update_received_at: new Date().toISOString() })
        .eq('id', botId)
        .then(
          () => undefined,
          (err) => this.logger.warn(`stamp last_update failed for bot ${botId}: ${err?.message || err}`),
        );
    }
    return this.telegramsEnhancedService.handleWebhook(webhookData, signature, botId);
  }

  /**
   * Igor (07/06): deeplink rotativo. Cliente clica "Comprar no Telegram"
   * no site → backend sorteia entre os bots `attendance` ativos
   * (peso `attendance_weight`) e retorna `t.me/<username>?start=...`.
   * Distribui carga entre bots — quando um cai, o sorteio para de
   * mandar pra ele e clientes novos vão pros outros automaticamente.
   *
   * Quando não tem `start` (cliente só clica "abrir bot"), retorna o
   * link puro pro padrão. Quando tem `start=...`, propaga.
   */
  @Get('start-deeplink')
  @ApiOperation({ summary: 'Sorteia bot ativo e retorna deeplink t.me' })
  async startDeeplink(@Query('start') startParam?: string) {
    return this.telegramsEnhancedService.getStartDeeplink(startParam);
  }

  /**
   * Igor (07/06 noite): redirect 302 round-robin pro botão "Acessar
   * conteúdos" do grupo portal. Cliente clica no botão do Telegram, abre
   * essa URL no browser/app, e cai 302 direto pro próximo bot da fila.
   * Cliente 1 → bot 1, cliente 2 → bot 2, ...; distribuição determinística.
   *
   * Headers no-cache pra Telegram/Cloudflare/iOS Safari não cachearem
   * o redirect — senão a 2ª pessoa pegaria o mesmo bot do 1º.
   */
  @Get('portal')
  @ApiOperation({ summary: 'Redirect 302 round-robin pro próximo bot da fila' })
  async portalRedirect(
    @Res() res: Response,
    @Query('start') startParam?: string,
  ) {
    const { url, bot_username } = await this.telegramsEnhancedService.getNextRoundRobinBot();
    const finalStart = startParam || 'portal';
    const target = `${url}?start=${encodeURIComponent(finalStart)}`;
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    this.logger.log(`[portal-redirect] → @${bot_username} (start=${finalStart})`);
    return res.redirect(302, target);
  }

  /**
   * Igor (14/06 noite): redirect 302 round-robin pra ENTREGA de filme.
   * Cliente compra → bot manda "Aqui está seu filme" com botão apontando
   * pra essa URL → clica → sorteia bot ativo → bot recebe `/start
   * watch_<purchaseId>`, valida posse e manda o invite link do grupo no
   * chat DAQUELE bot. Cliente fica registrado num bot adicional — se
   * algum cair, ainda alcançamos ela via outro.
   */
  @Get('r/watch')
  @ApiOperation({ summary: 'Redirect 302 round-robin pra entrega de purchase' })
  async watchRedirect(
    @Res() res: Response,
    @Query('p') purchaseId?: string,
  ) {
    const pid = (purchaseId || '').trim();
    if (!pid) {
      return res.status(400).send('purchase_id ausente');
    }
    const { url, bot_username } = await this.telegramsEnhancedService.getNextRoundRobinBot();
    const target = `${url}?start=watch_${encodeURIComponent(pid)}`;
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    this.logger.log(`[watch-redirect] purchase=${pid} → @${bot_username}`);
    return res.redirect(302, target);
  }

  /**
   * Igor (25/06): redirect 302 round-robin pra resgate de ORDER órfã.
   * Mesmo padrão de /r/watch mas pra fluxo de "compra órfã sem Telegram"
   * (cliente pagou no site sem login, depois acessa o bot pra resgatar).
   *
   * Antes a URL era `t.me/<bot fixo>?start=order_<token>` — admin copiava
   * 5 links e todos iam pro MESMO bot (o que getNextRoundRobinBot sorteou
   * no momento da abertura do painel). Agora a URL fica `/r/order?token=X`
   * fixa, e cada CLIQUE rotaciona pra bot diferente.
   *
   * Bonus: bot novo cadastrado em `telegram_bots` entra na rotação
   * automaticamente (getNextRoundRobinBot lê os ativos).
   */
  @Get('r/order')
  @ApiOperation({ summary: 'Redirect 302 round-robin pra resgate de order órfã' })
  async orderRedirect(
    @Res() res: Response,
    @Query('token') orderToken?: string,
  ) {
    const token = (orderToken || '').trim();
    if (!token) {
      return res.status(400).send('token ausente');
    }
    const { url, bot_username } = await this.telegramsEnhancedService.getNextRoundRobinBot();
    const target = `${url}?start=order_${encodeURIComponent(token)}`;
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    this.logger.log(`[order-redirect] token=${token.slice(0, 8)} → @${bot_username}`);
    return res.redirect(302, target);
  }

  /**
   * Igor (09/07): endpoint público que retorna se um filme tem bot promocional
   * vinculado + ATIVO + saudável. ContentHero no site chama pra decidir se
   * o botão "Comprar" desvia pro bot promo (concentra interações lá).
   *
   * Não expõe token (só username pra montar t.me/<username>).
   */
  @Get('promo-bot-for-content')
  async promoBotForContent(@Query('content') contentId?: string) {
    const id = (contentId || '').trim();
    if (!id) return { available: false };
    return this.telegramsEnhancedService.getPromoBotForContent(id);
  }

  /**
   * Igor (12/07): fix do LOOP INFINITO no bot promo.
   *
   * Cliente logado clica Comprar no site num filme com promo vinculado.
   * Frontend chama esse endpoint (POST em vez de montar URL na mão).
   * Backend cria purchase_intent + retorna deeplink `t.me/<promo>?start=pi_<token>`.
   * Bot promo recebe /start pi_<token>, processa via handlePurchaseIntent
   * (mesmo fluxo do Cenário 3 do bot oficial) → gera PIX imediato.
   *
   * Não gera loop: bot promo NUNCA manda cliente de volta pro site
   * pra intent com pi_. Só handlePromoWelcome (fallback quando /start
   * puro) que redireciona — e aí o cliente veio pelo QR code manual.
   */
  @Post('create-site-intent')
  async createSiteIntent(@Body() body: { content_id?: string }) {
    const contentId = (body?.content_id || '').trim();
    if (!contentId) {
      return { error: 'content_id ausente' };
    }
    return this.telegramsEnhancedService.createIntentForSiteVisitor(contentId);
  }

  @Post('send-notification')
  @ApiOperation({ summary: 'Send notification via Telegram' })
  @ApiResponse({ status: 200, description: 'Notification sent successfully' })
  async sendNotification(@Body() notificationData: any) {
    return this.telegramsService.sendNotification(
      notificationData.chatId,
      notificationData.message
    );
  }

  // @Post('setup-webhook')
  // @ApiOperation({ summary: 'Setup Telegram webhook' })
  // @ApiResponse({ status: 200, description: 'Webhook setup successfully' })
  // async setupWebhook(@Body() setupData: { url: string; secretToken?: string }) {
  //   return this.telegramsService.setupWebhook(setupData.url, setupData.secretToken);
  // }

  // @Get('setup-webhook')
  // @ApiOperation({ summary: 'Setup Telegram webhook (auto-detect URL)' })
  // @ApiResponse({ status: 200, description: 'Webhook setup successfully' })
  // async setupWebhookAuto() {
  //   // Auto-detect backend URL from environment
  //   const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://cinevisionn.onrender.com';
  //   const webhookUrl = `${backendUrl}/api/v1/telegrams/webhook`;

  //   this.logger.log(`Setting up webhook with URL: ${webhookUrl}`);
  //   return this.telegramsService.setupWebhook(webhookUrl);
  // }

  @Post('payment-confirmation')
  @ApiOperation({ summary: 'Send payment confirmation' })
  @ApiResponse({ status: 200, description: 'Payment confirmation sent' })
  async sendPaymentConfirmation(@Body() data: { chatId: string; purchaseData: any }) {
    return this.telegramsService.sendPaymentConfirmation(data.chatId, data.purchaseData);
  }

  @Post('new-release-notification')
  @ApiOperation({ summary: 'Send new release notification' })
  @ApiResponse({ status: 200, description: 'New release notification sent' })
  async sendNewReleaseNotification(@Body() data: { chatId: string; movieData: any }) {
    return this.telegramsService.sendNewReleaseNotification(data.chatId, data.movieData);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify if email exists in system' })
  @ApiResponse({ status: 200, description: 'Email verification result', type: VerifyEmailResponseDto })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    return this.telegramsEnhancedService.verifyUserEmail(verifyEmailDto);
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Initiate Telegram purchase' })
  @ApiResponse({ status: 200, description: 'Purchase initiated', type: TelegramPurchaseResponseDto })
  async initiatePurchase(@Body() purchaseDto: InitiateTelegramPurchaseDto): Promise<TelegramPurchaseResponseDto> {
    return this.telegramsEnhancedService.initiateTelegramPurchase(purchaseDto);
  }

  @Post('payment-success')
  @ApiOperation({ summary: 'Handle payment success callback' })
  @ApiResponse({ status: 200, description: 'Payment success handled' })
  async handlePaymentSuccess(@Body() data: { purchase_id: string }) {
    return this.telegramsEnhancedService.handlePaymentConfirmation(data.purchase_id);
  }

  @Post('payment-cancel')
  @ApiOperation({ summary: 'Handle payment cancellation' })
  @ApiResponse({ status: 200, description: 'Payment cancellation handled' })
  async handlePaymentCancel(@Body() data: { purchase_id: string }) {
    this.logger.log(`Payment cancelled for purchase ${data.purchase_id}`);
    return { message: 'Payment cancelled', purchase_id: data.purchase_id };
  }

  @Post('miniapp/purchase')
  @ApiOperation({ summary: 'Initiate purchase from Telegram Mini App' })
  @ApiResponse({ status: 200, description: 'Mini App purchase initiated' })
  async initiateMiniAppPurchase(@Body() data: {
    telegram_id: number;
    movie_id: string;
    movie_title: string;
    movie_price: number;
    init_data: string;
  }) {
    return this.telegramsEnhancedService.handleMiniAppPurchase(data);
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      status: 'ok',
      service: 'telegrams',
      timestamp: new Date().toISOString(),
    };
  }
}