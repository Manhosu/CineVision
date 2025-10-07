import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return health check message', () => {
      const result = appService.getHealth();
      expect(result).toBeDefined();
      expect(result.status).toBe('OK');
      expect(result.message).toBe('Cine Vision API is running');
    });

    it('should return status information', () => {
      const result = appService.getStatus();
      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
      expect(result.environment).toBeDefined();
    });
  });
});