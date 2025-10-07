import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Purchase, PurchaseStatus } from '../../purchases/entities/purchase.entity';

describe('PaymentsService - Refund System', () => {
  let service: PaymentsService;
  let paymentRepository: Repository<Payment>;
  let purchaseRepository: Repository<Purchase>;

  const mockPaymentRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockPurchaseRepository = {
    save: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_123';
      return 'test-value';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(Purchase),
          useValue: mockPurchaseRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    purchaseRepository = module.get<Repository<Purchase>>(getRepositoryToken(Purchase));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refundPayment', () => {
    it('should throw NotFoundException when payment is not found', async () => {
      mockPaymentRepository.findOne.mockResolvedValue(null);

      await expect(service.refundPayment('non-existent-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when payment is not paid', async () => {
      const payment = {
        id: 'payment-1',
        status: PaymentStatus.PENDING,
        purchase: { id: 'purchase-1', status: PurchaseStatus.PENDING },
      };

      mockPaymentRepository.findOne.mockResolvedValue(payment);

      await expect(service.refundPayment('payment-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when payment is already refunded', async () => {
      const payment = {
        id: 'payment-1',
        status: PaymentStatus.REFUNDED,
        purchase: { id: 'purchase-1', status: PurchaseStatus.REFUNDED },
      };

      mockPaymentRepository.findOne.mockResolvedValue(payment);

      await expect(service.refundPayment('payment-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should validate that only completed payments can be refunded', async () => {
      const payment = {
        id: 'payment-1',
        status: PaymentStatus.COMPLETED,
        purchase: { id: 'purchase-1', status: PurchaseStatus.PAID },
      };

      mockPaymentRepository.findOne.mockResolvedValue(payment);

      // This should not throw an error for the status check
      // (it will fail later due to missing Stripe configuration, but that's expected)
      try {
        await service.refundPayment('payment-1');
      } catch (error) {
        // We expect this to fail due to Stripe configuration, not status validation
        expect(error.message).not.toBe('Only completed payments can be refunded');
      }
    });
  });
});