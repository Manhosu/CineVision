import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { Purchase, PurchaseStatus, PurchaseDeliveryType } from './entities/purchase.entity';
import { Content, ContentStatus } from '../content/entities/content.entity';
import {
  InitiatePurchaseDto,
  PaymentWebhookDto,
  WebhookPaymentStatus
} from './dto';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PurchasesService', () => {
  let service: PurchasesService;
  let purchaseRepository: jest.Mocked<Repository<Purchase>>;
  let contentRepository: jest.Mocked<Repository<Content>>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockContent: Content = {
    id: 'content-123',
    title: 'Test Movie',
    price_cents: 1990,
    status: ContentStatus.PUBLISHED,
  } as Content;

  const mockPurchase: Purchase = {
    id: 'purchase-123',
    content_id: 'content-123',
    amount_cents: 1990,
    currency: 'BRL',
    status: PurchaseStatus.PENDING,
    preferred_delivery: PurchaseDeliveryType.SITE,
    purchase_token: 'token-123',
    created_at: new Date(),
    updated_at: new Date(),
  } as Purchase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        {
          provide: getRepositoryToken(Purchase),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Content),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PurchasesService>(PurchasesService);
    purchaseRepository = module.get(getRepositoryToken(Purchase));
    contentRepository = module.get(getRepositoryToken(Content));
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Setup default mocks
    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'TELEGRAM_BOT_USERNAME':
          return 'TestBot';
        case 'BOT_WEBHOOK_URL':
          return 'http://localhost:3003';
        case 'WEBHOOK_SECRET':
          return 'test-secret';
        default:
          return undefined;
      }
    });

    jwtService.sign.mockReturnValue('mock-jwt-token');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiatePurchase', () => {
    it('should create a purchase successfully', async () => {
      const dto: InitiatePurchaseDto = {
        content_id: 'content-123',
        preferred_delivery: PurchaseDeliveryType.SITE,
      };

      contentRepository.findOne.mockResolvedValue(mockContent);
      purchaseRepository.create.mockReturnValue(mockPurchase);
      purchaseRepository.save.mockResolvedValue(mockPurchase);

      const result = await service.initiatePurchase(dto);

      expect(result).toMatchObject({
        id: 'purchase-123',
        status: PurchaseStatus.PENDING,
        amount_cents: 1990,
        currency: 'BRL',
        preferred_delivery: PurchaseDeliveryType.SITE,
        content: {
          id: 'content-123',
          title: 'Test Movie',
        },
      });

      expect(result.purchase_token).toBeDefined();
      expect(result.telegram_deep_link).toContain('t.me/TestBot?start=');
      expect(purchaseRepository.create).toHaveBeenCalled();
      expect(purchaseRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent content', async () => {
      const dto: InitiatePurchaseDto = {
        content_id: 'non-existent-content',
        preferred_delivery: PurchaseDeliveryType.SITE,
      };

      contentRepository.findOne.mockResolvedValue(null);

      await expect(service.initiatePurchase(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create purchase with user_id when provided', async () => {
      const dto: InitiatePurchaseDto = {
        user_id: 'user-123',
        content_id: 'content-123',
        preferred_delivery: PurchaseDeliveryType.SITE,
      };

      contentRepository.findOne.mockResolvedValue(mockContent);
      purchaseRepository.create.mockReturnValue({
        ...mockPurchase,
        user_id: 'user-123',
      });
      purchaseRepository.save.mockResolvedValue({
        ...mockPurchase,
        user_id: 'user-123',
      });

      await service.initiatePurchase(dto);

      expect(purchaseRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
        }),
      );
    });
  });

  describe('processPaymentWebhook', () => {
    it('should process successful payment webhook', async () => {
      const dto: PaymentWebhookDto = {
        payment_id: 'payment-123',
        purchase_token: 'token-123',
        status: WebhookPaymentStatus.PAID,
        amount_cents: 1990,
        signature: 'test-signature',
      };

      const purchaseWithContent = {
        ...mockPurchase,
        content: mockContent,
      };

      purchaseRepository.findOne.mockResolvedValue(purchaseWithContent);
      purchaseRepository.save.mockResolvedValue({
        ...purchaseWithContent,
        status: PurchaseStatus.PAID,
        access_token: 'mock-jwt-token',
        access_expires_at: new Date(),
      });

      // Mock successful bot notification
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const result = await service.processPaymentWebhook(dto);

      expect(result.status).toBe(PurchaseStatus.PAID);
      expect(result.delivery?.type).toBe('site');
      expect(result.delivery?.access_token).toBe('mock-jwt-token');
      expect(purchaseRepository.save).toHaveBeenCalled();
    });

    it('should handle telegram delivery', async () => {
      const dto: PaymentWebhookDto = {
        payment_id: 'payment-123',
        purchase_token: 'token-123',
        status: WebhookPaymentStatus.PAID,
        amount_cents: 1990,
        signature: 'test-signature',
      };

      const telegramPurchase = {
        ...mockPurchase,
        preferred_delivery: PurchaseDeliveryType.TELEGRAM,
        content: mockContent,
      };

      purchaseRepository.findOne.mockResolvedValue(telegramPurchase);
      purchaseRepository.save.mockResolvedValue({
        ...telegramPurchase,
        status: PurchaseStatus.PAID,
      });

      mockedAxios.post.mockResolvedValue({ status: 200 });

      const result = await service.processPaymentWebhook(dto);

      expect(result.delivery?.type).toBe('telegram');
      expect(result.delivery?.telegram_sent).toBe(false);
    });

    it('should handle failed payments', async () => {
      const dto: PaymentWebhookDto = {
        payment_id: 'payment-123',
        purchase_token: 'token-123',
        status: WebhookPaymentStatus.FAILED,
        amount_cents: 1990,
        signature: 'test-signature',
        failure_reason: 'insufficient_funds',
      };

      purchaseRepository.findOne.mockResolvedValue({
        ...mockPurchase,
        content: mockContent,
      });
      purchaseRepository.save.mockResolvedValue({
        ...mockPurchase,
        status: PurchaseStatus.FAILED,
      });

      const result = await service.processPaymentWebhook(dto);

      expect(result.status).toBe(PurchaseStatus.FAILED);
      expect(result.delivery).toBeUndefined();
    });

    it('should throw NotFoundException for non-existent purchase', async () => {
      const dto: PaymentWebhookDto = {
        payment_id: 'payment-123',
        purchase_token: 'non-existent-token',
        status: WebhookPaymentStatus.PAID,
        amount_cents: 1990,
        signature: 'test-signature',
      };

      purchaseRepository.findOne.mockResolvedValue(null);

      await expect(service.processPaymentWebhook(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for amount mismatch', async () => {
      const dto: PaymentWebhookDto = {
        payment_id: 'payment-123',
        purchase_token: 'token-123',
        status: WebhookPaymentStatus.PAID,
        amount_cents: 5000, // Wrong amount
        signature: 'test-signature',
      };

      purchaseRepository.findOne.mockResolvedValue({
        ...mockPurchase,
        content: mockContent,
      });

      await expect(service.processPaymentWebhook(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should continue processing even if bot notification fails', async () => {
      const dto: PaymentWebhookDto = {
        payment_id: 'payment-123',
        purchase_token: 'token-123',
        status: WebhookPaymentStatus.PAID,
        amount_cents: 1990,
        signature: 'test-signature',
      };

      purchaseRepository.findOne.mockResolvedValue({
        ...mockPurchase,
        content: mockContent,
      });
      purchaseRepository.save.mockResolvedValue({
        ...mockPurchase,
        status: PurchaseStatus.PAID,
      });

      // Mock failed bot notification
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      // Should not throw error even if bot notification fails
      const result = await service.processPaymentWebhook(dto);
      expect(result.status).toBe(PurchaseStatus.PAID);
    });
  });

  describe('findByPurchaseToken', () => {
    it('should find purchase by token', async () => {
      purchaseRepository.findOne.mockResolvedValue({
        ...mockPurchase,
        content: mockContent,
      });

      const result = await service.findByPurchaseToken('token-123');

      expect(result).toBeDefined();
      expect(result.purchase_token).toBe('token-123');
      expect(purchaseRepository.findOne).toHaveBeenCalledWith({
        where: { purchase_token: 'token-123' },
        relations: ['content', 'user'],
      });
    });

    it('should return null for non-existent token', async () => {
      purchaseRepository.findOne.mockResolvedValue(null);

      const result = await service.findByPurchaseToken('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid token', async () => {
      const mockPayload = {
        sub: 'user-123',
        content_id: 'content-123',
        purchase_id: 'purchase-123',
        type: 'content_access',
      };

      jwtService.verify.mockReturnValue(mockPayload);

      const result = await service.verifyAccessToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('should throw BadRequestException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyAccessToken('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };

      (purchaseRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      await service.cleanupExpiredTokens();

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Purchase);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        access_token: null,
        access_expires_at: null,
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'access_expires_at < :now',
        { now: expect.any(Date) },
      );
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });
});