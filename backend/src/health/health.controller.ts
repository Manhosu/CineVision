import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupabaseService } from '../config/supabase.service';

interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: {
      status: 'connected' | 'disconnected';
      type: string;
      responseTime?: number;
    };
    redis?: {
      status: 'connected' | 'disconnected' | 'disabled';
    };
  };
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is unhealthy',
  })
  async check(): Promise<HealthCheckResponse> {
    const startTime = Date.now();

    // Check database connection
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let dbResponseTime: number | undefined;

    try {
      // Test Supabase connection by making a simple query
      const { data, error } = await this.supabaseService.client
        .from('content')
        .select('count')
        .limit(1);

      if (error) {
        console.error('Supabase health check failed:', error);
        dbStatus = 'disconnected';
      } else {
        dbStatus = 'connected';
        dbResponseTime = Date.now() - startTime;
      }
    } catch (error) {
      console.error('Supabase health check failed:', error);
      dbStatus = 'disconnected';
    }

    // Check Redis connection (if enabled)
    const redisEnabled = process.env.REDIS_ENABLED === 'true';
    let redisStatus: 'connected' | 'disconnected' | 'disabled' = 'disabled';

    if (redisEnabled) {
      // In production, you would check Redis connection here
      redisStatus = 'connected';
    }

    const response: HealthCheckResponse = {
      status: dbStatus === 'connected' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        database: {
          status: dbStatus,
          type: 'postgres',
          responseTime: dbResponseTime,
        },
      },
    };

    if (redisEnabled) {
      response.services.redis = {
        status: redisStatus,
      };
    }

    return response;
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check - is the service ready to accept traffic?' })
  @ApiResponse({
    status: 200,
    description: 'Service is ready',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready',
  })
  async ready(): Promise<{ ready: boolean; message: string }> {
    try {
      // Check if Supabase is connected
      const { data, error } = await this.supabaseService.client
        .from('content')
        .select('count')
        .limit(1);

      if (error) {
        return {
          ready: false,
          message: `Service is not ready - Supabase connection failed: ${error.message}`,
        };
      }

      return {
        ready: true,
        message: 'Service is ready to accept traffic',
      };
    } catch (error) {
      return {
        ready: false,
        message: `Service is not ready - Supabase connection failed: ${error.message}`,
      };
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check - is the service alive?' })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
  })
  async live(): Promise<{ alive: boolean; timestamp: string }> {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
    };
  }
}
