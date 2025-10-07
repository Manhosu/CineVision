import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripePaymentProvider } from './stripe';
import { PaymentMethod } from './interfaces';

describe('StripePaymentProvider', () => {
  let provider: StripePaymentProvider;
  let configService: ConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StripePaymentProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                STRIPE_SECRET_KEY: 'sk_test_123456789',
                STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
                DEFAULT_PIX_KEY: 'test@example.com',
                FRONTEND_URL: 'https://cinevision.com',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<StripePaymentProvider>(StripePaymentProvider);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('initialization', () => {
    it('should initialize with Stripe secret key', () => {
      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('stripe');
    });

    it('should throw error if STRIPE_SECRET_KEY is missing', async () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      expect(() => new StripePaymentProvider(mockConfigService as any)).toThrow(
        'STRIPE_SECRET_KEY is required'
      );
    });
  });

  describe('createPaymentIntent', () => {
    const mockPurchase = {
      id: 'purchase-1',
      content_id: 'content-1',
      user_id: 'user-1',
      amount_cents: 1999,
      purchase_token: 'token-123',
      content: {
        id: 'content-1',
        title: 'Test Movie',
      },
    };

    it('should create PIX payment intent', async () => {
      // Mock Stripe API call
      const mockPaymentIntent = {
        id: 'pi_test_123',
        amount: 1999,
        currency: 'brl',
        client_secret: 'pi_test_123_secret_xyz',
        metadata: {
          purchase_id: 'purchase-1',
          purchase_token: 'token-123',
          pix_key: 'custom@pix.com',
        },
      };

      jest.spyOn(provider['stripe'].paymentIntents, 'create').mockResolvedValue(
        mockPaymentIntent as any
      );

      const options = {
        purchase: mockPurchase as any,
        payment_method: PaymentMethod.PIX,
        pix_key: 'custom@pix.com',
      };

      const result = await provider.createPaymentIntent(options);

      expect(result).toBeDefined();
      expect(result.provider_payment_id).toBe('pi_test_123');
      expect(result.amount_cents).toBe(1999);
      expect(result.currency).toBe('BRL');
      expect(result.payment_data).toBeDefined();
      expect(result.payment_data.pix_key).toBe('custom@pix.com');
      expect(result.payment_data.client_secret).toBe('pi_test_123_secret_xyz');

      expect(provider['stripe'].paymentIntents.create).toHaveBeenCalledWith({
        amount: 1999,
        currency: 'brl',
        payment_method_types: ['pix'],
        metadata: expect.objectContaining({
          purchase_id: 'purchase-1',
          purchase_token: 'token-123',
          pix_key: 'custom@pix.com',
        }),
        confirmation_method: 'automatic',
        confirm: false,
      });
    });

    it('should create card payment intent with checkout session', async () => {
      // Mock Stripe checkout session creation
      const mockSession = {
        id: 'cs_test_123',
        payment_intent: 'pi_test_card_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
        metadata: {
          purchase_id: 'purchase-1',
          purchase_token: 'token-123',
        },
      };

      jest.spyOn(provider['stripe'].checkout.sessions, 'create').mockResolvedValue(
        mockSession as any
      );

      const options = {
        purchase: mockPurchase as any,
        payment_method: PaymentMethod.CARD,
        return_url: 'https://cinevision.com/success',
        cancel_url: 'https://cinevision.com/cancel',
      };

      const result = await provider.createPaymentIntent(options);

      expect(result).toBeDefined();
      expect(result.provider_payment_id).toBe('pi_test_card_123');
      expect(result.payment_url).toBe('https://checkout.stripe.com/pay/cs_test_123');
      expect(result.amount_cents).toBe(1999);
      expect(result.currency).toBe('BRL');

      expect(provider['stripe'].checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: 'Test Movie',
                description: 'Compra do filme Test Movie',
              },
              unit_amount: 1999,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: 'https://cinevision.com/success',
        cancel_url: 'https://cinevision.com/cancel',
        metadata: expect.objectContaining({
          purchase_id: 'purchase-1',
          purchase_token: 'token-123',
        }),
        expires_at: expect.any(Number),
      });
    });

    it('should throw error for unsupported payment method', async () => {
      const options = {
        purchase: mockPurchase as any,
        payment_method: 'unsupported' as any,
      };

      await expect(provider.createPaymentIntent(options)).rejects.toThrow(
        'Unsupported payment method: unsupported'
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', async () => {
      const payload = '{"test": "data"}';
      const signature = 'test_signature';
      const secret = 'whsec_test_123';

      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test_123' } },
      };

      jest.spyOn(provider['stripe'].webhooks, 'constructEvent').mockReturnValue(mockEvent as any);

      const result = await provider.verifyWebhookSignature(payload, signature, secret);

      expect(result.isValid).toBe(true);
      expect(result.event).toEqual(mockEvent);
      expect(provider['stripe'].webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        secret
      );
    });

    it('should reject invalid webhook signature', async () => {
      const payload = '{"test": "data"}';
      const signature = 'invalid_signature';
      const secret = 'whsec_test_123';

      jest.spyOn(provider['stripe'].webhooks, 'constructEvent').mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = await provider.verifyWebhookSignature(payload, signature, secret);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should return error if webhook secret not configured', async () => {
      const payload = '{"test": "data"}';
      const signature = 'test_signature';

      // Mock ConfigService to return undefined for webhook secret
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      const result = await provider.verifyWebhookSignature(payload, signature);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('STRIPE_WEBHOOK_SECRET not configured');
    });
  });

  describe('fetchPaymentStatus', () => {
    it('should fetch payment intent status', async () => {
      const paymentId = 'pi_test_123';
      const mockPaymentIntent = {
        id: 'pi_test_123',
        status: 'succeeded',
        amount_received: 1999,
        created: 1234567890,
        metadata: { purchase_id: 'purchase-1' },
      };

      jest.spyOn(provider['stripe'].paymentIntents, 'retrieve').mockResolvedValue(
        mockPaymentIntent as any
      );

      const result = await provider.fetchPaymentStatus(paymentId);

      expect(result.status).toBe('paid');
      expect(result.amount_paid).toBe(1999);
      expect(result.paid_at).toEqual(new Date(1234567890 * 1000));
      expect(result.metadata).toEqual({ purchase_id: 'purchase-1' });
    });

    it('should handle checkout session payment intent', async () => {
      const sessionId = 'cs_test_123';

      // First call fails (not a payment intent)
      jest.spyOn(provider['stripe'].paymentIntents, 'retrieve')
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          id: 'pi_test_123',
          status: 'succeeded',
          amount_received: 1999,
          charges: { data: [{ created: 1234567890 }] },
          metadata: {},
        } as any);

      // Retrieve session
      jest.spyOn(provider['stripe'].checkout.sessions, 'retrieve').mockResolvedValue({
        id: 'cs_test_123',
        payment_intent: 'pi_test_123',
      } as any);

      const result = await provider.fetchPaymentStatus(sessionId);

      expect(result.status).toBe('paid');
      expect(provider['stripe'].checkout.sessions.retrieve).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('helper methods', () => {
    it('should map Stripe status to payment status', () => {
      expect(provider['mapStripeStatusToPaymentStatus']('succeeded')).toBe('paid');
      expect(provider['mapStripeStatusToPaymentStatus']('canceled')).toBe('cancelled');
      expect(provider['mapStripeStatusToPaymentStatus']('requires_payment_method')).toBe('failed');
      expect(provider['mapStripeStatusToPaymentStatus']('processing')).toBe('pending');
    });

    it('should get supported payment methods for BRL', () => {
      const methods = provider.getSupportedPaymentMethods('brl');
      expect(methods).toContain(PaymentMethod.PIX);
      expect(methods).toContain(PaymentMethod.CARD);
    });

    it('should get supported payment methods for other currencies', () => {
      const methods = provider.getSupportedPaymentMethods('usd');
      expect(methods).toContain(PaymentMethod.CARD);
      expect(methods).not.toContain(PaymentMethod.PIX);
    });

    it('should format PIX instructions', () => {
      const instructions = provider.formatPixInstructions('test@example.com', 1999);

      expect(instructions).toContain('test@example.com');
      expect(instructions).toContain('R$ 19.99');
      expect(instructions).toContain('PIX');
      expect(instructions).toContain('confirmado automaticamente');
    });
  });
});

// Integration test that requires actual Stripe test credentials
describe('StripePaymentProvider Integration (requires test credentials)', () => {
  let provider: StripePaymentProvider;

  beforeEach(() => {
    // Skip these tests if no real Stripe test key is provided
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      return; // Tests will be skipped individually
    }

    const configService = {
      get: jest.fn((key: string) => process.env[key]),
    } as any;

    provider = new StripePaymentProvider(configService);
  });

  (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? it : it.skip)('should create actual PIX payment intent', async () => {
    const mockPurchase = {
      id: 'test-purchase-1',
      content_id: 'test-content-1',
      user_id: 'test-user-1',
      amount_cents: 1000, // R$ 10.00
      purchase_token: 'test-token-123',
      content: {
        id: 'test-content-1',
        title: 'Test Integration Movie',
      },
    };

    const options = {
      purchase: mockPurchase as any,
      payment_method: PaymentMethod.PIX,
      pix_key: 'integration@test.com',
    };

    const result = await provider.createPaymentIntent(options);

    expect(result.provider_payment_id).toMatch(/^pi_/);
    expect(result.amount_cents).toBe(1000);
    expect(result.currency).toBe('BRL');
    expect(result.payment_data.client_secret).toMatch(/^pi_.*_secret_/);
    expect(result.payment_data.pix_key).toBe('integration@test.com');
  });

  (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? it : it.skip)('should create actual card checkout session', async () => {
    const mockPurchase = {
      id: 'test-purchase-2',
      content_id: 'test-content-2',
      user_id: 'test-user-2',
      amount_cents: 2500, // R$ 25.00
      purchase_token: 'test-token-456',
      content: {
        id: 'test-content-2',
        title: 'Test Integration Card Movie',
      },
    };

    const options = {
      purchase: mockPurchase as any,
      payment_method: PaymentMethod.CARD,
      return_url: 'https://test.cinevision.com/success',
      cancel_url: 'https://test.cinevision.com/cancel',
    };

    const result = await provider.createPaymentIntent(options);

    expect(result.provider_payment_id).toMatch(/^pi_/);
    expect(result.payment_url).toMatch(/^https:\/\/checkout\.stripe\.com/);
    expect(result.amount_cents).toBe(2500);
    expect(result.currency).toBe('BRL');
  });
});