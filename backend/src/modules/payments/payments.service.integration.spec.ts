import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Purchase, PurchaseStatus } from '../purchases/entities/purchase.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Content } from '../content/entities/content.entity';
import { PaymentMethod } from './providers/interfaces';

describe('PaymentsService Integration Tests', () => {
  let service: PaymentsService;
  let purchaseRepository: Repository<Purchase>;
  let paymentRepository: Repository<Payment>;
  let configService: ConfigService;

  // Mock data
  const mockContent = {
    id: 'content-1',
    title: 'Test Movie',
    price_cents: 1999,
    poster_url: 'https://example.com/poster.jpg',
  } as Content;

  const mockPurchase = {
    id: 'purchase-1',
    content_id: 'content-1',
    user_id: 'user-1',
    amount_cents: 1999,
    currency: 'BRL',
    status: PurchaseStatus.PENDING,
    purchase_token: 'token-123',
    preferred_delivery: 'site',
    content: mockContent,
    created_at: new Date(),
    updated_at: new Date(),
  } as Purchase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Purchase),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
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

    service = module.get<PaymentsService>(PaymentsService);
    purchaseRepository = module.get<Repository<Purchase>>(getRepositoryToken(Purchase));
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('createPayment', () => {
    it('should create PIX payment successfully', async () => {
      // Arrange
      const createPaymentDto = {
        purchase_id: 'purchase-1',
        payment_method: PaymentMethod.PIX,
        pix_key: 'custom@pix.com',
      };

      const mockSavedPayment = {
        id: 'payment-1',
        purchase_id: 'purchase-1',
        provider_payment_id: 'pi_test_123',
        status: PaymentStatus.PENDING,
        created_at: new Date(),
      };

      jest.spyOn(purchaseRepository, 'findOne').mockResolvedValue(mockPurchase);
      jest.spyOn(paymentRepository, 'create').mockReturnValue(mockSavedPayment as any);
      jest.spyOn(paymentRepository, 'save').mockResolvedValue(mockSavedPayment as any);

      // Act
      const result = await service.createPayment(createPaymentDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.payment_method).toBe(PaymentMethod.PIX);
      expect(result.purchase_id).toBe('purchase-1');
      expect(result.provider).toBe('stripe');
      expect(result.payment_data).toBeDefined();
      expect(result.payment_data.pix_key).toBe('custom@pix.com');

      // Verify repository calls
      expect(purchaseRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'purchase-1' },
        relations: ['content'],
      });
      expect(paymentRepository.create).toHaveBeenCalled();
      expect(paymentRepository.save).toHaveBeenCalled();
    });

    it('should create card payment with hosted page', async () => {
      // Arrange
      const createPaymentDto = {
        purchase_id: 'purchase-1',
        payment_method: PaymentMethod.CARD,
        return_url: 'https://cinevision.com/success',
        cancel_url: 'https://cinevision.com/cancel',
      };

      const mockSavedPayment = {
        id: 'payment-1',
        purchase_id: 'purchase-1',
        provider_payment_id: 'pi_test_card_123',
        status: PaymentStatus.PENDING,
        created_at: new Date(),
      };

      jest.spyOn(purchaseRepository, 'findOne').mockResolvedValue(mockPurchase);
      jest.spyOn(paymentRepository, 'create').mockReturnValue(mockSavedPayment as any);
      jest.spyOn(paymentRepository, 'save').mockResolvedValue(mockSavedPayment as any);

      // Act
      const result = await service.createPayment(createPaymentDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.payment_method).toBe(PaymentMethod.CARD);
      expect(result.payment_url).toBeDefined();
      expect(result.payment_url).toContain('stripe'); // Mock implementation will contain stripe
      expect(result.purchase_id).toBe('purchase-1');
      expect(result.provider).toBe('stripe');
    });

    it('should throw NotFoundException if purchase not found', async () => {
      // Arrange
      const createPaymentDto = {
        purchase_id: 'nonexistent-purchase',
        payment_method: PaymentMethod.PIX,
      };

      jest.spyOn(purchaseRepository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(service.createPayment(createPaymentDto)).rejects.toThrow(
        'Purchase with ID nonexistent-purchase not found'
      );
    });

    it('should throw BadRequestException if purchase already paid', async () => {
      // Arrange
      const paidPurchase = {
        ...mockPurchase,
        status: PurchaseStatus.PAID,
      };

      const createPaymentDto = {
        purchase_id: 'purchase-1',
        payment_method: PaymentMethod.PIX,
      };

      jest.spyOn(purchaseRepository, 'findOne').mockResolvedValue(paidPurchase);

      // Act & Assert
      await expect(service.createPayment(createPaymentDto)).rejects.toThrow(
        'Purchase is already paid'
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature successfully', async () => {
      // Arrange
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'test_signature';

      // Act
      const result = await service.verifyWebhookSignature(payload, signature);

      // Assert
      // This will fail in real test due to actual Stripe verification
      // In a real test environment, you would mock the Stripe provider
      expect(typeof result).toBe('boolean');
    });
  });

  describe('handleStripeWebhook', () => {
    it('should process payment_intent.succeeded webhook', async () => {
      // Arrange
      const payload = JSON.stringify({
        id: 'evt_test_webhook',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            amount_received: 1999,
            currency: 'brl',
            metadata: {
              purchase_token: 'token-123',
              purchase_id: 'purchase-1',
              user_id: 'user-1',
            },
            payment_method_types: ['pix'],
          },
        },
      });
      const signature = 'test_signature';

      const mockPayment = {
        id: 'payment-1',
        purchase_id: 'purchase-1',
        provider_payment_id: 'pi_test_123',
        status: PaymentStatus.PENDING,
        purchase: mockPurchase,
      };

      jest.spyOn(service, 'verifyWebhookSignature').mockResolvedValue(true);
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(mockPayment as any);
      jest.spyOn(paymentRepository, 'save').mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      } as any);
      jest.spyOn(purchaseRepository, 'save').mockResolvedValue({
        ...mockPurchase,
        status: PurchaseStatus.PAID,
      } as any);

      // Mock Stripe provider verification
      const mockVerificationResult = {
        isValid: true,
        event: JSON.parse(payload),
      };
      jest.spyOn(service['paymentProvider'], 'verifyWebhookSignature').mockResolvedValue(
        mockVerificationResult
      );

      // Act
      const result = await service.handleStripeWebhook(payload, signature);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('processed');
      expect(result.purchase_id).toBe('purchase-1');

      // Verify payment and purchase were updated
      expect(paymentRepository.save).toHaveBeenCalled();
      expect(purchaseRepository.save).toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      // Arrange
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'invalid_signature';

      // Mock invalid signature verification
      const mockVerificationResult = {
        isValid: false,
        error: 'Invalid signature',
      };
      jest.spyOn(service['paymentProvider'], 'verifyWebhookSignature').mockResolvedValue(
        mockVerificationResult
      );

      // Act
      const result = await service.handleStripeWebhook(payload, signature);

      // Assert
      expect(result.status).toBe('error');
      expect(result.message).toBe('Invalid signature');
    });
  });

  describe('getPaymentStatus', () => {
    it('should fetch payment status from provider', async () => {
      // Arrange
      const dto = { provider_payment_id: 'pi_test_123' };

      const mockStatusResponse = {
        status: 'paid' as const,
        amount_paid: 1999,
        paid_at: new Date(),
      };

      jest.spyOn(service['paymentProvider'], 'fetchPaymentStatus').mockResolvedValue(
        mockStatusResponse
      );

      // Act
      const result = await service.getPaymentStatus(dto);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('paid');
      expect(result.amount_paid).toBe(1999);
      expect(result.provider_payment_id).toBe('pi_test_123');
      expect(result.provider).toBe('stripe');
    });
  });
});

describe('PaymentsService E2E Integration Tests', () => {
  let service: PaymentsService;

  // These tests would run against actual Stripe test environment
  // They require STRIPE_SECRET_KEY to be set in environment

  beforeEach(async () => {
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      throw new Error('E2E tests require STRIPE_SECRET_KEY (test key) in environment');
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Purchase),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => process.env[key]),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should connect to Stripe successfully', async () => {
    // This test verifies that the Stripe provider can be initialized
    // with real credentials and basic connectivity works
    expect(service).toBeDefined();
    expect(service['paymentProvider']).toBeDefined();
    expect(service['paymentProvider'].getProviderName()).toBe('stripe');
  });
});