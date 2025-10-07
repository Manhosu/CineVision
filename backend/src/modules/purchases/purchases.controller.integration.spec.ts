import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PurchasesModule } from './purchases.module';
import { ContentModule } from '../content/content.module';
import { Purchase, PurchaseStatus, PurchaseDeliveryType } from './entities/purchase.entity';
import { Content, ContentStatus, ContentType, ContentAvailability } from '../content/entities/content.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('PurchasesController (Integration)', () => {
  let app: INestApplication;
  let purchaseRepository: Repository<Purchase>;
  let contentRepository: Repository<Content>;
  let testContent: Content;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            url: configService.get('SUPABASE_DATABASE_URL'),
            entities: [Purchase, Content],
            synchronize: false,
            logging: false,
          }),
          inject: [ConfigService],
        }),
        PurchasesModule,
        ContentModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    purchaseRepository = moduleFixture.get<Repository<Purchase>>(
      getRepositoryToken(Purchase),
    );
    contentRepository = moduleFixture.get<Repository<Content>>(
      getRepositoryToken(Content),
    );

    // Create test content
    testContent = await contentRepository.save({
      title: 'Test Movie',
      description: 'A test movie for integration tests',
      price_cents: 1990,
      status: ContentStatus.PUBLISHED,
      type: ContentType.MOVIE,
      availability: ContentAvailability.BOTH,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up purchases before each test
    await purchaseRepository.delete({});
  });

  describe('POST /purchases/initiate', () => {
    it('should create a new purchase with site delivery', async () => {
      const createPurchaseDto = {
        content_id: testContent.id,
        preferred_delivery: PurchaseDeliveryType.SITE,
      };

      const response = await request(app.getHttpServer())
        .post('/purchases/initiate')
        .send(createPurchaseDto)
        .expect(201);

      expect(response.body).toMatchObject({
        status: PurchaseStatus.PENDING,
        amount_cents: 1990,
        currency: 'BRL',
        preferred_delivery: PurchaseDeliveryType.SITE,
        content: {
          id: testContent.id,
          title: 'Test Movie',
        },
      });

      expect(response.body.purchase_token).toBeDefined();
      expect(response.body.telegram_deep_link).toContain('t.me/');
    });

    it('should create a purchase with telegram delivery', async () => {
      const createPurchaseDto = {
        content_id: testContent.id,
        preferred_delivery: PurchaseDeliveryType.TELEGRAM,
      };

      const response = await request(app.getHttpServer())
        .post('/purchases/initiate')
        .send(createPurchaseDto)
        .expect(201);

      expect(response.body.preferred_delivery).toBe(PurchaseDeliveryType.TELEGRAM);
    });

    it('should return 404 for non-existent content', async () => {
      const createPurchaseDto = {
        content_id: '00000000-0000-0000-0000-000000000000',
        preferred_delivery: PurchaseDeliveryType.SITE,
      };

      await request(app.getHttpServer())
        .post('/purchases/initiate')
        .send(createPurchaseDto)
        .expect(404);
    });

    it('should validate request body', async () => {
      const invalidDto = {
        content_id: 'invalid-uuid',
        preferred_delivery: 'invalid-delivery',
      };

      await request(app.getHttpServer())
        .post('/purchases/initiate')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /purchases/token/:token', () => {
    it('should return purchase by token', async () => {
      // Create a purchase first
      const purchase = await purchaseRepository.save({
        content_id: testContent.id,
        amount_cents: 1990,
        currency: 'BRL',
        status: PurchaseStatus.PENDING,
        preferred_delivery: PurchaseDeliveryType.SITE,
        purchase_token: 'test-token-123',
      });

      const response = await request(app.getHttpServer())
        .get('/purchases/token/test-token-123')
        .expect(200);

      expect(response.body).toMatchObject({
        id: purchase.id,
        purchase_token: 'test-token-123',
        status: PurchaseStatus.PENDING,
        amount_cents: 1990,
      });
    });

    it('should return 404 for non-existent token', async () => {
      await request(app.getHttpServer())
        .get('/purchases/token/non-existent-token')
        .expect(404);
    });
  });

  describe('Complete Purchase Flow Integration', () => {
    it('should complete full purchase flow from initiate to payment confirmation', async () => {
      // Step 1: Initiate purchase
      const initiateDto = {
        content_id: testContent.id,
        preferred_delivery: PurchaseDeliveryType.SITE,
      };

      const initiateResponse = await request(app.getHttpServer())
        .post('/purchases/initiate')
        .send(initiateDto)
        .expect(201);

      const purchaseToken = initiateResponse.body.purchase_token;
      const purchaseId = initiateResponse.body.id;

      // Step 2: Verify purchase can be retrieved by token
      const getByTokenResponse = await request(app.getHttpServer())
        .get(`/purchases/token/${purchaseToken}`)
        .expect(200);

      expect(getByTokenResponse.body.status).toBe(PurchaseStatus.PENDING);

      // Step 3: Simulate payment webhook
      const webhookDto = {
        payment_id: 'test-payment-123',
        purchase_token: purchaseToken,
        status: 'paid',
        amount_cents: 1990,
        signature: 'test-signature',
        metadata: {
          provider: 'test',
          method: 'pix',
        },
      };

      const webhookResponse = await request(app.getHttpServer())
        .post('/webhooks/payments')
        .send(webhookDto)
        .expect(200);

      expect(webhookResponse.body).toMatchObject({
        purchase_id: purchaseId,
        status: PurchaseStatus.PAID,
        delivery: {
          type: 'site',
        },
      });

      expect(webhookResponse.body.delivery.access_token).toBeDefined();
      expect(webhookResponse.body.delivery.expires_at).toBeDefined();

      // Step 4: Verify purchase status updated
      const finalPurchase = await purchaseRepository.findOne({
        where: { id: purchaseId },
      });

      expect(finalPurchase.status).toBe(PurchaseStatus.PAID);
      expect(finalPurchase.access_token).toBeDefined();
      expect(finalPurchase.access_expires_at).toBeDefined();
    });

    it('should handle telegram delivery flow', async () => {
      // Create purchase with telegram delivery
      const initiateDto = {
        content_id: testContent.id,
        preferred_delivery: PurchaseDeliveryType.TELEGRAM,
      };

      const initiateResponse = await request(app.getHttpServer())
        .post('/purchases/initiate')
        .send(initiateDto)
        .expect(201);

      const purchaseToken = initiateResponse.body.purchase_token;

      // Simulate payment confirmation
      const webhookDto = {
        payment_id: 'test-payment-telegram',
        purchase_token: purchaseToken,
        status: 'paid',
        amount_cents: 1990,
        signature: 'test-signature',
      };

      const webhookResponse = await request(app.getHttpServer())
        .post('/webhooks/payments')
        .send(webhookDto)
        .expect(200);

      expect(webhookResponse.body.delivery).toMatchObject({
        type: 'telegram',
        telegram_sent: false,
      });
    });

    it('should handle failed payments', async () => {
      const initiateResponse = await request(app.getHttpServer())
        .post('/purchases/initiate')
        .send({
          content_id: testContent.id,
          preferred_delivery: PurchaseDeliveryType.SITE,
        })
        .expect(201);

      const purchaseToken = initiateResponse.body.purchase_token;

      // Simulate failed payment
      const webhookDto = {
        payment_id: 'test-payment-failed',
        purchase_token: purchaseToken,
        status: 'failed',
        amount_cents: 1990,
        signature: 'test-signature',
        failure_reason: 'insufficient_funds',
      };

      const webhookResponse = await request(app.getHttpServer())
        .post('/webhooks/payments')
        .send(webhookDto)
        .expect(200);

      expect(webhookResponse.body.status).toBe(PurchaseStatus.FAILED);

      // Verify no delivery info is provided for failed payments
      expect(webhookResponse.body.delivery).toBeUndefined();
    });

    it('should reject webhook with amount mismatch', async () => {
      const initiateResponse = await request(app.getHttpServer())
        .post('/purchases/initiate')
        .send({
          content_id: testContent.id,
          preferred_delivery: PurchaseDeliveryType.SITE,
        })
        .expect(201);

      const purchaseToken = initiateResponse.body.purchase_token;

      // Webhook with wrong amount
      const webhookDto = {
        payment_id: 'test-payment-wrong-amount',
        purchase_token: purchaseToken,
        status: 'paid',
        amount_cents: 5000, // Wrong amount
        signature: 'test-signature',
      };

      await request(app.getHttpServer())
        .post('/webhooks/payments')
        .send(webhookDto)
        .expect(400);
    });

    it('should handle duplicate webhook calls idempotently', async () => {
      const initiateResponse = await request(app.getHttpServer())
        .post('/purchases/initiate')
        .send({
          content_id: testContent.id,
          preferred_delivery: PurchaseDeliveryType.SITE,
        })
        .expect(201);

      const purchaseToken = initiateResponse.body.purchase_token;

      const webhookDto = {
        payment_id: 'test-payment-duplicate',
        purchase_token: purchaseToken,
        status: 'paid',
        amount_cents: 1990,
        signature: 'test-signature',
      };

      // First webhook call
      const firstResponse = await request(app.getHttpServer())
        .post('/webhooks/payments')
        .send(webhookDto)
        .expect(200);

      // Second webhook call (duplicate)
      const secondResponse = await request(app.getHttpServer())
        .post('/webhooks/payments')
        .send(webhookDto)
        .expect(200);

      // Both should return same result
      expect(firstResponse.body.purchase_id).toBe(secondResponse.body.purchase_id);
      expect(firstResponse.body.status).toBe(secondResponse.body.status);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent purchase initiations', async () => {
      const concurrentRequests = Array(10).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/purchases/initiate')
          .send({
            content_id: testContent.id,
            preferred_delivery: PurchaseDeliveryType.SITE,
          })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.purchase_token).toBeDefined();
      });

      // All purchase tokens should be unique
      const tokens = responses.map(r => r.body.purchase_token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });
  });
});