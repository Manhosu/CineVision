import { NestFactory } from '@nestjs/core';
import { AppTestModule } from './app-test.module';

async function bootstrap() {
  const app = await NestFactory.create(AppTestModule);
  
  // Configurações básicas
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`🚀 Test NestJS app running on: http://localhost:${port}`);
  console.log(`✅ Backend is working without TypeORM dependencies`);
}

bootstrap().catch(err => {
  console.error('Error starting test app:', err);
});