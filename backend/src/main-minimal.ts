import { NestFactory } from '@nestjs/core';
import { AppMinimalModule } from './app-minimal.module';

async function bootstrap() {
  const app = await NestFactory.create(AppMinimalModule);
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`🚀 Minimal NestJS app running on: http://localhost:${port}`);
}

bootstrap().catch(err => {
  console.error('Error starting minimal app:', err);
});