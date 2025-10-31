import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { TelegramsEnhancedService } from '../../telegrams/telegrams-enhanced.service';

@Injectable()
export class AdminPixService {
  private readonly logger = new Logger(AdminPixService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly telegramsService: TelegramsEnhancedService,
  ) {
    this.logger.log('AdminPixService initialized');
  }

  /**
   * List all pending PIX payments awaiting verification
   */
  async listPendingPixPayments(limit = 50): Promise<any> {
    try {
      const { data: payments, error } = await this.supabaseService.client
        .from('payments')
        .select(`
          *,
          purchase:purchases!inner(
            id,
            user_id,
            content_id,
            amount_cents,
            currency,
            status,
            provider_meta,
            created_at,
            content:content(
              id,
              title,
              type
            ),
            user:users(
              id,
              name,
              email,
              telegram_username,
              telegram_chat_id
            )
          )
        `)
        .eq('payment_method', 'pix')
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error('Error fetching pending PIX payments:', error);
        throw error;
      }

      // Format response
      const formattedPayments = payments?.map((payment) => ({
        payment_id: payment.id,
        transaction_id: payment.stripe_payment_intent_id || payment.provider_meta?.transaction_id,
        purchase_id: payment.purchase?.id,
        user: {
          id: payment.purchase?.user?.id,
          name: payment.purchase?.user?.name,
          email: payment.purchase?.user?.email,
          telegram_username: payment.purchase?.user?.telegram_username,
          telegram_chat_id: payment.purchase?.user?.telegram_chat_id || payment.purchase?.provider_meta?.telegram_chat_id,
        },
        content: {
          id: payment.purchase?.content?.id,
          title: payment.purchase?.content?.title,
          type: payment.purchase?.content?.type,
        },
        amount_cents: payment.purchase?.amount_cents,
        amount_brl: (payment.purchase?.amount_cents / 100).toFixed(2),
        currency: payment.purchase?.currency || 'BRL',
        pix_key: payment.provider_meta?.pix_key,
        qr_code_emv: payment.provider_meta?.qr_code_emv,
        created_at: payment.created_at,
        purchase_status: payment.purchase?.status,
        payment_status: payment.payment_status,
      })) || [];

      return {
        count: formattedPayments.length,
        payments: formattedPayments,
      };
    } catch (error) {
      this.logger.error('Error in listPendingPixPayments:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a PIX payment
   */
  async getPixPaymentDetails(paymentId: string): Promise<any> {
    try {
      const { data: payment, error } = await this.supabaseService.client
        .from('payments')
        .select(`
          *,
          purchase:purchases!inner(
            *,
            content:content(*),
            user:users(*)
          )
        `)
        .eq('id', paymentId)
        .eq('payment_method', 'pix')
        .single();

      if (error || !payment) {
        throw new NotFoundException(`PIX payment with ID ${paymentId} not found`);
      }

      return {
        payment_id: payment.id,
        transaction_id: payment.stripe_payment_intent_id || payment.provider_meta?.transaction_id,
        purchase: payment.purchase,
        pix_data: {
          pix_key: payment.provider_meta?.pix_key,
          qr_code_emv: payment.provider_meta?.qr_code_emv,
          qr_code_image: payment.provider_meta?.qr_code_image,
        },
        amount_cents: payment.purchase?.amount_cents,
        amount_brl: (payment.purchase?.amount_cents / 100).toFixed(2),
        currency: payment.purchase?.currency || 'BRL',
        payment_status: payment.payment_status,
        purchase_status: payment.purchase?.status,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
      };
    } catch (error) {
      this.logger.error(`Error getting PIX payment ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Manually approve a PIX payment and deliver content
   */
  async approvePixPayment(paymentId: string, notes?: string): Promise<any> {
    try {
      this.logger.log(`Admin approving PIX payment ${paymentId}`);

      // Get payment with purchase data
      const { data: payment, error: fetchError } = await this.supabaseService.client
        .from('payments')
        .select(`
          *,
          purchase:purchases!inner(
            id,
            user_id,
            content_id,
            amount_cents,
            status,
            provider_meta,
            content:content(*)
          )
        `)
        .eq('id', paymentId)
        .eq('payment_method', 'pix')
        .single();

      if (fetchError || !payment) {
        throw new NotFoundException(`PIX payment with ID ${paymentId} not found`);
      }

      if (payment.payment_status === 'completed') {
        throw new BadRequestException('Payment is already approved');
      }

      if (payment.payment_status === 'cancelled' || payment.payment_status === 'failed') {
        throw new BadRequestException(`Payment is ${payment.payment_status} and cannot be approved`);
      }

      // Mark payment as completed
      const { error: updatePaymentError } = await this.supabaseService.client
        .from('payments')
        .update({
          payment_status: 'completed',
          processed_at: new Date().toISOString(),
          provider_meta: {
            ...payment.provider_meta,
            admin_approved: true,
            admin_notes: notes,
            approved_at: new Date().toISOString(),
          },
        })
        .eq('id', paymentId);

      if (updatePaymentError) {
        this.logger.error('Error updating payment status:', updatePaymentError);
        throw updatePaymentError;
      }

      // Mark purchase as paid
      const { error: updatePurchaseError } = await this.supabaseService.client
        .from('purchases')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.purchase.id);

      if (updatePurchaseError) {
        this.logger.error('Error updating purchase status:', updatePurchaseError);
        throw updatePurchaseError;
      }

      // Deliver content via Telegram
      try {
        // Get fresh purchase data with content
        const { data: purchaseWithContent } = await this.supabaseService.client
          .from('purchases')
          .select('*, content(*)')
          .eq('id', payment.purchase.id)
          .single();

        if (purchaseWithContent) {
          // Get user's telegram_chat_id
          const { data: user } = await this.supabaseService.client
            .from('users')
            .select('telegram_chat_id')
            .eq('id', purchaseWithContent.user_id)
            .single();

          const telegramChatId = user?.telegram_chat_id || purchaseWithContent.provider_meta?.telegram_chat_id;

          if (telegramChatId) {
            // Ensure provider_meta has telegram_chat_id
            const purchaseWithTelegramId = {
              ...purchaseWithContent,
              provider_meta: {
                ...purchaseWithContent.provider_meta,
                telegram_chat_id: telegramChatId,
              },
            };

            // Deliver content
            await this.telegramsService['deliverContentAfterPayment'](purchaseWithTelegramId);
            this.logger.log(`Content delivered for PIX payment ${paymentId} to chat ${telegramChatId}`);
          } else {
            this.logger.warn(`No telegram_chat_id found for purchase ${payment.purchase.id}`);

            // Log failure for manual intervention
            await this.supabaseService.client
              .from('system_logs')
              .insert({
                type: 'delivery_failed',
                level: 'warn',
                message: `PIX payment approved but no telegram_chat_id found`,
                meta: {
                  payment_id: paymentId,
                  purchase_id: payment.purchase.id,
                  user_id: purchaseWithContent.user_id,
                  reason: 'missing_telegram_chat_id',
                },
              });
          }
        }
      } catch (deliveryError) {
        this.logger.error('Error delivering content:', deliveryError);

        // Log delivery failure but don't fail the approval
        await this.supabaseService.client
          .from('system_logs')
          .insert({
            type: 'delivery_failed',
            level: 'error',
            message: `PIX payment approved but content delivery failed: ${deliveryError.message}`,
            meta: {
              payment_id: paymentId,
              purchase_id: payment.purchase.id,
              error: deliveryError.message,
              stack: deliveryError.stack,
            },
          });
      }

      return {
        success: true,
        message: 'PIX payment approved successfully',
        payment_id: paymentId,
        purchase_id: payment.purchase.id,
        amount_brl: (payment.purchase.amount_cents / 100).toFixed(2),
      };
    } catch (error) {
      this.logger.error(`Error approving PIX payment ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Reject a PIX payment
   */
  async rejectPixPayment(paymentId: string, reason: string, notifyUser = true): Promise<any> {
    try {
      this.logger.log(`Admin rejecting PIX payment ${paymentId}: ${reason}`);

      // Get payment with purchase data
      const { data: payment, error: fetchError } = await this.supabaseService.client
        .from('payments')
        .select(`
          *,
          purchase:purchases!inner(
            id,
            user_id,
            content_id,
            provider_meta,
            content:content(title)
          )
        `)
        .eq('id', paymentId)
        .eq('payment_method', 'pix')
        .single();

      if (fetchError || !payment) {
        throw new NotFoundException(`PIX payment with ID ${paymentId} not found`);
      }

      if (payment.payment_status === 'completed') {
        throw new BadRequestException('Cannot reject a completed payment');
      }

      // Mark payment as failed
      const { error: updatePaymentError } = await this.supabaseService.client
        .from('payments')
        .update({
          payment_status: 'failed',
          failure_reason: reason,
          processed_at: new Date().toISOString(),
          provider_meta: {
            ...payment.provider_meta,
            admin_rejected: true,
            rejection_reason: reason,
            rejected_at: new Date().toISOString(),
          },
        })
        .eq('id', paymentId);

      if (updatePaymentError) {
        this.logger.error('Error updating payment status:', updatePaymentError);
        throw updatePaymentError;
      }

      // Mark purchase as failed
      const { error: updatePurchaseError } = await this.supabaseService.client
        .from('purchases')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.purchase.id);

      if (updatePurchaseError) {
        this.logger.error('Error updating purchase status:', updatePurchaseError);
        throw updatePurchaseError;
      }

      // Notify user via Telegram if requested
      if (notifyUser) {
        try {
          // Get user's telegram_chat_id
          const { data: user } = await this.supabaseService.client
            .from('users')
            .select('telegram_chat_id')
            .eq('id', payment.purchase.user_id)
            .single();

          const telegramChatId = user?.telegram_chat_id || payment.purchase.provider_meta?.telegram_chat_id;

          if (telegramChatId) {
            const message =
              `❌ *Pagamento PIX Recusado*\n\n` +
              `🎬 Conteúdo: ${payment.purchase.content.title}\n` +
              `💰 Valor: R$ ${(payment.purchase.amount_cents / 100).toFixed(2)}\n\n` +
              `⚠️ *Motivo:* ${reason}\n\n` +
              `💡 *Próximos passos:*\n` +
              `• Verifique se realizou o pagamento corretamente\n` +
              `• Tente novamente ou escolha outro método de pagamento\n` +
              `• Se tiver dúvidas, entre em contato com o suporte`;

            await this.telegramsService['sendMessage'](parseInt(telegramChatId), message, {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔄 Tentar Novamente', callback_data: `buy_${payment.purchase.content_id}` }],
                  [{ text: '📞 Suporte', url: 'https://wa.me/seunumero' }],
                ],
              },
            });

            this.logger.log(`User notified about PIX rejection via Telegram: ${telegramChatId}`);
          }
        } catch (notifyError) {
          this.logger.error('Error notifying user about rejection:', notifyError);
          // Don't fail the rejection if notification fails
        }
      }

      return {
        success: true,
        message: 'PIX payment rejected successfully',
        payment_id: paymentId,
        purchase_id: payment.purchase.id,
        reason,
        user_notified: notifyUser,
      };
    } catch (error) {
      this.logger.error(`Error rejecting PIX payment ${paymentId}:`, error);
      throw error;
    }
  }
}
