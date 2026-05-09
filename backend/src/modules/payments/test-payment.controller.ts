import { Controller, Post, Body, Logger, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupabaseService } from '../../config/supabase.service';
import { TelegramsEnhancedService } from '../telegrams/telegrams-enhanced.service';

/**
 * Controller para simular pagamentos em ambiente de desenvolvimento/teste
 * ATENÇÃO: Este controller deve ser desabilitado em produção
 */
@ApiTags('test-payments')
@Controller('test-payments')
export class TestPaymentController {
  private readonly logger = new Logger(TestPaymentController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly telegramsService: TelegramsEnhancedService,
  ) {}

  @Post('simulate-success/:purchaseId')
  @ApiOperation({
    summary: '🧪 Simular pagamento bem-sucedido (APENAS TESTE)',
    description: 'Simula todo o fluxo de pagamento bem-sucedido sem usar Stripe. Marca a compra como paga e entrega o conteúdo via Telegram.'
  })
  async simulatePaymentSuccess(@Param('purchaseId') purchaseId: string) {
    try {
      this.logger.warn(`🧪 SIMULANDO pagamento bem-sucedido para purchase ${purchaseId}`);

      // 1. Buscar a compra
      const { data: purchase, error: purchaseError } = await this.supabaseService.client
        .from('purchases')
        .select('*, content(*)')
        .eq('id', purchaseId)
        .single();

      if (purchaseError || !purchase) {
        return {
          success: false,
          error: `Compra ${purchaseId} não encontrada`,
          details: purchaseError,
        };
      }

      this.logger.log(`Compra encontrada: ${purchase.id} - Status atual: ${purchase.status}`);

      // 2. Verificar se já está paga
      if (purchase.status === 'paid') {
        return {
          success: false,
          error: 'Compra já está marcada como paga',
          purchase_id: purchase.id,
          current_status: purchase.status,
        };
      }

      // 3. Buscar telegram_chat_id
      let telegramChatId = purchase.provider_meta?.telegram_chat_id;

      // Se não tiver no provider_meta, buscar da tabela users
      if (!telegramChatId && purchase.user_id) {
        const { data: user } = await this.supabaseService.client
          .from('users')
          .select('telegram_chat_id')
          .eq('id', purchase.user_id)
          .single();

        if (user?.telegram_chat_id) {
          telegramChatId = user.telegram_chat_id;
          this.logger.log(`telegram_chat_id encontrado na tabela users: ${telegramChatId}`);
        }
      }

      if (!telegramChatId) {
        return {
          success: false,
          error: 'telegram_chat_id não encontrado nem no provider_meta nem na tabela users',
          purchase_id: purchase.id,
          provider_meta: purchase.provider_meta,
          user_id: purchase.user_id,
        };
      }

      this.logger.log(`telegram_chat_id: ${telegramChatId}`);

      // 4. Marcar compra como paga
      const { error: updateError } = await this.supabaseService.client
        .from('purchases')
        .update({
          status: 'paid',
          payment_provider_id: `test_payment_${Date.now()}`,
          payment_method: 'test',
          provider_meta: {
            ...purchase.provider_meta,
            telegram_chat_id: telegramChatId,
            test_payment: true,
            simulated_at: new Date().toISOString(),
          },
          access_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchase.id);

      if (updateError) {
        return {
          success: false,
          error: 'Erro ao atualizar status da compra',
          details: updateError,
        };
      }

      this.logger.log(`✅ Compra ${purchase.id} marcada como PAID`);

      // 5. Buscar compra atualizada
      const { data: updatedPurchase } = await this.supabaseService.client
        .from('purchases')
        .select('*, content(*)')
        .eq('id', purchase.id)
        .single();

      // 6. Chamar deliverContentAfterPayment (mesma função que o webhook chama)
      this.logger.log(`📤 Chamando deliverContentAfterPayment...`);

      // Preparar purchase com telegram_chat_id no provider_meta
      const purchaseWithTelegramId = {
        ...updatedPurchase,
        provider_meta: {
          ...updatedPurchase.provider_meta,
          telegram_chat_id: telegramChatId,
        },
      };

      await this.telegramsService['deliverContentAfterPayment'](purchaseWithTelegramId);

      this.logger.log(`✅ Conteúdo entregue com sucesso!`);

      return {
        success: true,
        message: '✅ Pagamento simulado com sucesso! Conteúdo entregue via Telegram.',
        purchase_id: purchase.id,
        status: 'paid',
        telegram_chat_id: telegramChatId,
        content_title: purchase.content.title,
        test_url: `https://t.me/CineVisionApp_rbot?start=payment_success_${purchase.id}`,
        notes: [
          'Este foi um pagamento de TESTE',
          'Acesse o link acima no Telegram para ver a mensagem de confirmação',
          'O conteúdo já foi entregue no chat do Telegram',
        ],
      };
    } catch (error) {
      this.logger.error(`Erro ao simular pagamento: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Post('simulate-cancel/:purchaseId')
  @ApiOperation({
    summary: '🧪 Simular cancelamento de pagamento (APENAS TESTE)',
    description: 'Simula cancelamento de pagamento. Apenas gera o link de retorno ao Telegram.'
  })
  async simulatePaymentCancel(@Param('purchaseId') purchaseId: string) {
    try {
      this.logger.warn(`🧪 SIMULANDO cancelamento de pagamento para purchase ${purchaseId}`);

      // Buscar a compra para validar
      const { data: purchase, error: purchaseError } = await this.supabaseService.client
        .from('purchases')
        .select('*')
        .eq('id', purchaseId)
        .single();

      if (purchaseError || !purchase) {
        return {
          success: false,
          error: `Compra ${purchaseId} não encontrada`,
        };
      }

      return {
        success: true,
        message: '❌ Cancelamento simulado',
        purchase_id: purchase.id,
        test_url: `https://t.me/CineVisionApp_rbot?start=payment_cancel_${purchase.id}`,
        notes: [
          'Acesse o link acima no Telegram para ver a mensagem de cancelamento',
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('check-provider-meta/:purchaseId')
  @ApiOperation({
    summary: '🔍 Verificar provider_meta da compra',
    description: 'Verifica se telegram_chat_id está salvo no provider_meta da compra'
  })
  async checkProviderMeta(@Param('purchaseId') purchaseId: string) {
    try {
      const { data: purchase, error } = await this.supabaseService.client
        .from('purchases')
        .select('*, content(title), users(telegram_chat_id, telegram_id)')
        .eq('id', purchaseId)
        .single();

      if (error || !purchase) {
        return {
          success: false,
          error: `Compra ${purchaseId} não encontrada`,
        };
      }

      const hasTelegramChatIdInMeta = !!purchase.provider_meta?.telegram_chat_id;
      const telegramChatIdFromUser = purchase.users?.telegram_chat_id;

      return {
        success: true,
        purchase_id: purchase.id,
        status: purchase.status,
        content_title: purchase.content?.title,
        checks: {
          telegram_chat_id_in_provider_meta: hasTelegramChatIdInMeta,
          telegram_chat_id_value: purchase.provider_meta?.telegram_chat_id || null,
          telegram_chat_id_from_user: telegramChatIdFromUser || null,
          can_deliver_content: hasTelegramChatIdInMeta || !!telegramChatIdFromUser,
        },
        provider_meta: purchase.provider_meta,
        recommendation: !hasTelegramChatIdInMeta
          ? '⚠️ telegram_chat_id não está no provider_meta. Atualize o código para salvar durante a criação da compra.'
          : '✅ telegram_chat_id está salvo corretamente no provider_meta',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
