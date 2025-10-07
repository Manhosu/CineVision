import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'OK',
      message: 'Cine Vision API is running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  getStatus() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected', // TODO: Add real database check
        telegram: 'configured', // TODO: Add real telegram check
        payments: 'configured', // TODO: Add real payment provider check
      },
    };
  }
}