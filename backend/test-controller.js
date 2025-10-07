require('dotenv').config();
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');

async function testController() {
  try {
    console.log('Creating NestJS application...');
    const app = await NestFactory.create(AppModule);
    
    console.log('Application created successfully');
    
    // Get all registered routes
    const server = app.getHttpServer();
    const router = server._events.request.router;
    
    if (router && router.stack) {
      console.log('Registered routes:');
      router.stack.forEach(layer => {
        if (layer.route) {
          console.log(`${Object.keys(layer.route.methods).join(', ').toUpperCase()} ${layer.route.path}`);
        }
      });
    }
    
    await app.close();
  } catch (error) {
    console.error('Error creating application:', error);
  }
}

testController();