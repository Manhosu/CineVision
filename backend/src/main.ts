import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import { configureDNS, configureSupabaseConnection } from './config/dns-config';

async function bootstrap() {
  // Configurar DNS para resolver problemas de conectividade IPv6
  configureDNS();
  configureSupabaseConnection();
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default body parser to set custom limits
  });

  // Configure Express body parser with increased limits for video uploads
  app.use(require('express').json({ limit: '50mb' }));
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }));

  // Security - Configure helmet to allow frontend connections
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
        imgSrc: ["'self'", "data:", "https:", "https://img.youtube.com"],
        connectSrc: ["'self'", "http://localhost:3000", "http://localhost:3001"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());

  // CORS - Allow frontend connections
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  // Add production origins from environment
  if (process.env.CORS_ORIGIN) {
    allowedOrigins.push(...process.env.CORS_ORIGIN.split(',').map(o => o.trim()));
  }

  // Add Vercel preview and production domains
  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Check if origin is allowed or matches Vercel pattern
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false, // Temporarily disabled to debug DTO issue
      forbidNonWhitelisted: false,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Cine Vision API')
    .setDescription('Netflix-like streaming platform with Telegram integration')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('content', 'Movies and series management')
    .addTag('purchases', 'Purchase history and transactions')
    .addTag('payments', 'Payment processing (PIX, Card)')
    .addTag('admin', 'Administrative operations')
    .addTag('users', 'User management')
    .addTag('telegrams', 'Telegram bot integration')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Cine Vision API running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
