import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CreateProductDto {
  name: string;
  description?: string;
  images?: string[];
  metadata?: Record<string, string>;
}

export interface CreatePriceDto {
  productId: string;
  unitAmount: number; // in cents
  currency?: string;
  metadata?: Record<string, string>;
}

export interface StripeProductResult {
  productId: string;
  priceId: string;
  product: Stripe.Product;
  price: Stripe.Price;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get('STRIPE_SECRET_KEY');
    this.webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    });

    this.logger.log('Stripe service initialized');
  }

  /**
   * Create a product and price in Stripe automatically
   */
  async createProductWithPrice(
    productDto: CreateProductDto,
    priceDto: Omit<CreatePriceDto, 'productId'>,
  ): Promise<StripeProductResult> {
    try {
      // Create product
      this.logger.log(`Creating Stripe product: ${productDto.name}`);
      const product = await this.stripe.products.create({
        name: productDto.name,
        description: productDto.description,
        images: productDto.images,
        metadata: {
          ...productDto.metadata,
          source: 'cine-vision',
          created_at: new Date().toISOString(),
        },
      });

      this.logger.log(`Stripe product created: ${product.id}`);

      // Create price
      this.logger.log(`Creating Stripe price for product ${product.id}`);
      const price = await this.stripe.prices.create({
        product: product.id,
        unit_amount: priceDto.unitAmount,
        currency: priceDto.currency || 'brl',
        metadata: {
          ...priceDto.metadata,
          source: 'cine-vision',
        },
      });

      this.logger.log(`Stripe price created: ${price.id}`);

      return {
        productId: product.id,
        priceId: price.id,
        product,
        price,
      };
    } catch (error) {
      this.logger.error(`Failed to create Stripe product/price: ${error.message}`);
      throw new BadRequestException(`Failed to create Stripe product: ${error.message}`);
    }
  }

  /**
   * Create a checkout session for payment
   * Supports both PIX and Card payments in Brazil
   */
  async createCheckoutSession(
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card', 'pix'], // Enable both card and PIX payments
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          ...metadata,
          source: 'cine-vision',
        },
      });

      this.logger.log(`Checkout session created: ${session.id} with payment methods: card, pix`);
      return session;
    } catch (error) {
      this.logger.error(`Failed to create checkout session: ${error.message}`);
      throw new BadRequestException(`Failed to create checkout session: ${error.message}`);
    }
  }

  /**
   * Create a payment intent for direct payment
   */
  async createPaymentIntent(
    amount: number,
    currency: string = 'brl',
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        metadata: {
          ...metadata,
          source: 'cine-vision',
        },
      });

      this.logger.log(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to create payment intent: ${error.message}`);
      throw new BadRequestException(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
  ): Stripe.Event {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );

      this.logger.log(`Webhook verified: ${event.type}`);
      return event;
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /**
   * Retrieve product information
   */
  async getProduct(productId: string): Promise<Stripe.Product> {
    try {
      return await this.stripe.products.retrieve(productId);
    } catch (error) {
      this.logger.error(`Failed to retrieve product ${productId}: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve product: ${error.message}`);
    }
  }

  /**
   * Retrieve price information
   */
  async getPrice(priceId: string): Promise<Stripe.Price> {
    try {
      return await this.stripe.prices.retrieve(priceId);
    } catch (error) {
      this.logger.error(`Failed to retrieve price ${priceId}: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve price: ${error.message}`);
    }
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    updates: Partial<CreateProductDto>,
  ): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.update(productId, {
        name: updates.name,
        description: updates.description,
        images: updates.images,
        metadata: updates.metadata,
      });

      this.logger.log(`Product updated: ${productId}`);
      return product;
    } catch (error) {
      this.logger.error(`Failed to update product ${productId}: ${error.message}`);
      throw new BadRequestException(`Failed to update product: ${error.message}`);
    }
  }

  /**
   * Archive/deactivate product
   */
  async archiveProduct(productId: string): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.update(productId, {
        active: false,
      });

      this.logger.log(`Product archived: ${productId}`);
      return product;
    } catch (error) {
      this.logger.error(`Failed to archive product ${productId}: ${error.message}`);
      throw new BadRequestException(`Failed to archive product: ${error.message}`);
    }
  }

  /**
   * Create a refund
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string,
  ): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
        reason: reason as any,
      });

      this.logger.log(`Refund created: ${refund.id} for payment ${paymentIntentId}`);
      return refund;
    } catch (error) {
      this.logger.error(`Failed to create refund: ${error.message}`);
      throw new BadRequestException(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Get payment intent details
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error(`Failed to retrieve payment intent: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve payment intent: ${error.message}`);
    }
  }

  /**
   * Get checkout session details
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      this.logger.error(`Failed to retrieve checkout session: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve checkout session: ${error.message}`);
    }
  }

  /**
   * List all products
   */
  async listProducts(limit: number = 100): Promise<Stripe.Product[]> {
    try {
      const products = await this.stripe.products.list({ limit });
      return products.data;
    } catch (error) {
      this.logger.error(`Failed to list products: ${error.message}`);
      throw new BadRequestException(`Failed to list products: ${error.message}`);
    }
  }

  /**
   * Health check for Stripe connection
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      // Try to list products to verify connection
      await this.stripe.products.list({ limit: 1 });

      return {
        status: 'healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Stripe health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
      };
    }
  }
}
