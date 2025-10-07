import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupabaseRestClient } from '../../../config/supabase-rest-client';

@ApiTags('supabase-test')
@Controller('supabase-test')
export class SupabaseTestController {
  private readonly logger = new Logger(SupabaseTestController.name);

  constructor(private readonly supabaseClient: SupabaseRestClient) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test Supabase REST API connectivity',
    description: 'Verifies if Supabase REST API is accessible and credentials are valid',
  })
  @ApiResponse({
    status: 200,
    description: 'Supabase health check result',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time' },
        supabaseUrl: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Supabase service error' })
  async healthCheck() {
    try {
      const isHealthy = await this.supabaseClient.healthCheck();
      
      if (isHealthy) {
        const dbInfo = await this.supabaseClient.getDatabaseInfo();
        return {
          status: 'healthy',
          ...dbInfo,
        };
      } else {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Failed to connect to Supabase',
        };
      }
    } catch (error) {
      this.logger.error('Supabase health check failed:', error.message);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  @Get('database-info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Supabase database information',
    description: 'Returns basic information about the Supabase database connection',
  })
  @ApiResponse({
    status: 200,
    description: 'Database information',
  })
  async getDatabaseInfo() {
    try {
      const info = await this.supabaseClient.getDatabaseInfo();
      return info;
    } catch (error) {
      this.logger.error('Failed to get database info:', error.message);
      throw error;
    }
  }

  @Get('test-query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test basic Supabase query',
    description: 'Executes a simple query to test database connectivity',
  })
  @ApiResponse({
    status: 200,
    description: 'Query test result',
  })
  async testQuery() {
    try {
      // Test a simple query - this will work even if no tables exist
      const result = await this.supabaseClient.rpc('version', {});
      return {
        status: 'success',
        timestamp: new Date().toISOString(),
        result: result,
      };
    } catch (error) {
      this.logger.error('Test query failed:', error.message);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}