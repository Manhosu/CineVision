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
  // IMPORTANT: Stripe webhook needs raw body for signature verification
  app.use(
    require('express').json({
      limit: '50mb',
      verify: (req: any, res: any, buf: Buffer) => {
        // Store raw body for Stripe webhook signature verification
        req.rawBody = buf;
      },
    }),
  );
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
    'https://cine-vision-murex.vercel.app',
    'https://cinevisionn.vercel.app',
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
      if (!origin) {
        console.log('✅ CORS: Request without origin - ALLOWED');
        return callback(null, true);
      }

      // Check if origin is allowed or matches allowed patterns
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('cinevisionapp.com.br') ||
        origin === 'https://www.cinevisionapp.com.br' ||
        origin === 'https://cinevisionapp.com.br' ||
        origin === 'http://www.cinevisionapp.com.br' ||
        origin === 'http://cinevisionapp.com.br';

      if (isAllowed) {
        console.log(`✅ CORS: Origin allowed - ${origin}`);
        callback(null, true);
      } else {
        console.log(`❌ CORS: Origin blocked - ${origin}`);
        console.log('Allowed origins:', allowedOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Pragma'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
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
