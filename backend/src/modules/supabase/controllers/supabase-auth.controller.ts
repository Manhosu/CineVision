import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SupabaseRestClient } from '../../../config/supabase-rest-client';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

@ApiTags('supabase-auth')
@Controller('supabase-auth')
export class SupabaseAuthController {
  private readonly logger = new Logger(SupabaseAuthController.name);

  constructor(private readonly supabaseClient: SupabaseRestClient) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login temporário usando Supabase REST',
    description: 'Faz login diretamente via REST API do Supabase, contornando problemas de RLS',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'admin@cinevision.com' },
        password: { type: 'string', example: 'admin123' },
      },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
@Get('table-info')
  @ApiOperation({ summary: 'Get users table information' })
  async getTableInfo() {
    try {
      const result = await this.supabaseClient.select('users', { limit: 1 });
      return {
        status: 'success',
        message: 'Table info retrieved',
        data: result,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro ao obter informações da tabela',
        error: error.message,
      };
    }
  }

  @Post('disable-rls')
  @ApiOperation({ summary: 'Temporarily disable RLS on users table (ADMIN ONLY)' })
  async disableRLS() {
    try {
      // Create Supabase client with service role key for admin operations
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Execute SQL command to disable RLS on users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(0); // Just test connection first
      
      // If connection works, try to disable RLS using a different approach
      if (!error) {
        // For now, we'll return success and manually disable RLS in Supabase dashboard
        return {
          status: 'success',
          message: 'RLS needs to be disabled manually in Supabase dashboard',
          instruction: 'Go to Supabase Dashboard > Authentication > RLS and disable for users table',
        };
      }

      if (error) {
        throw new Error(error.message);
      }
      
      return {
        status: 'success',
        message: 'RLS disabled on users table',
        data: data,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro ao desabilitar RLS',
        error: error.message,
      };
    }
  }

  @Get('test-users-table')
  @ApiOperation({ summary: 'Test users table connectivity with service role' })
  async testUsersTable() {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Test with service role key (bypasses RLS)
      const { data, error } = await supabase
        .from('users')
        .select('id, email, created_at')
        .limit(5);

      if (error) {
        return {
          status: 'error',
          message: 'Erro ao acessar tabela users',
          error: error.message,
          note: 'Service role key should bypass RLS - this indicates a deeper issue',
        };
      }

      return {
        status: 'success',
        message: 'Tabela users acessível via service role',
        count: data?.length || 0,
        data: data,
        note: 'Service role bypassed RLS successfully',
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro interno ao testar tabela users',
        error: error.message,
      };
    }
  }

  @Get('test-users-anon')
  @ApiOperation({ summary: 'Test users table with anonymous key (will fail with RLS)' })
  async testUsersAnon() {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      // Test with anon key (subject to RLS)
      const { data, error } = await supabase
        .from('users')
        .select('id, email, created_at')
        .limit(5);

      if (error) {
        return {
          status: 'error',
          message: 'Erro ao acessar tabela users (esperado com RLS)',
          error: error.message,
          note: 'This error is expected if RLS is enabled and causing recursion',
        };
      }

      return {
        status: 'success',
        message: 'Tabela users acessível via anon key',
        count: data?.length || 0,
        data: data,
        note: 'RLS is either disabled or working correctly',
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro interno ao testar tabela users',
        error: error.message,
      };
    }
  }

  @Post('login-direct')
  @ApiOperation({ summary: 'Direct login without table verification' })
  async loginDirect(@Body() loginDto: { email: string; password: string }) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      // Try direct authentication without table queries
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginDto.email,
        password: loginDto.password,
      });

      if (error) {
        return {
          status: 'error',
          message: 'Erro na autenticação',
          error: error.message,
        };
      }

      return {
        status: 'success',
        message: 'Login realizado com sucesso',
        user: data.user,
        session: data.session,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro interno no login direto',
        error: error.message,
      };
    }
  }

  @Post('register-admin')
  @ApiOperation({ summary: 'Register admin user directly' })
  async registerAdmin(@Body() registerDto: { email: string; password: string }) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for admin registration
      );

      // Register user with Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: registerDto.email,
        password: registerDto.password,
        email_confirm: true, // Auto-confirm email for admin
      });

      if (error) {
        return {
          status: 'error',
          message: 'Erro ao registrar admin',
          error: error.message,
        };
      }

      return {
        status: 'success',
        message: 'Admin registrado com sucesso',
        user: data.user,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro interno no registro do admin',
        error: error.message,
      };
    }
  }

  @Post('insert-admin-to-table')
  @ApiOperation({ summary: 'Insert admin user into users table using service role' })
  async insertAdminToTable(@Body() insertDto: { 
    userId: string; 
    email: string;
    passwordHash?: string;
  }) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role to bypass RLS
      );

      // Generate a default password hash if not provided
      const defaultPasswordHash = await bcrypt.hash('admin123', 10);

      // Insert user into users table with all required fields
      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            id: insertDto.userId,
            email: insertDto.email,
            password_hash: insertDto.passwordHash || defaultPasswordHash,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        ])
        .select();

      if (error) {
        return {
          status: 'error',
          message: 'Erro ao inserir admin na tabela users',
          error: error.message,
          note: 'Trying to insert into custom users table with required fields',
        };
      }

      return {
        status: 'success',
        message: 'Admin inserido na tabela users com sucesso',
        data: data,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro interno ao inserir admin na tabela',
        error: error.message,
      };
    }
  }

  @Post('disable-rls-temporarily')
  @ApiOperation({ summary: 'Disable RLS on users table temporarily for testing' })
  async disableRLSTemporarily() {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Execute SQL to disable RLS
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;'
      });

      if (error) {
        return {
          status: 'error',
          message: 'Erro ao desabilitar RLS',
          error: error.message,
          note: 'Pode ser necessário executar manualmente no dashboard do Supabase',
        };
      }

      return {
        status: 'success',
        message: 'RLS desabilitado temporariamente na tabela users',
        data,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro interno ao desabilitar RLS',
        error: error.message,
      };
    }
  }

  @Post('create-custom-users-table')
  @ApiOperation({ summary: 'Create custom users table with proper RLS policies' })
  async createCustomUsersTable() {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Execute SQL to create custom table
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          -- Create app_users table if not exists
          CREATE TABLE IF NOT EXISTS public.app_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            role VARCHAR(50) DEFAULT 'user',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Enable RLS
          ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

          -- Create simple policies without recursion
          DROP POLICY IF EXISTS "Users can view their own data" ON public.app_users;
          CREATE POLICY "Users can view their own data" ON public.app_users
            FOR SELECT USING (auth.uid()::text = id::text);

          DROP POLICY IF EXISTS "Users can update their own data" ON public.app_users;
          CREATE POLICY "Users can update their own data" ON public.app_users
            FOR UPDATE USING (auth.uid()::text = id::text);

          -- Service role can do everything
          DROP POLICY IF EXISTS "Service role full access" ON public.app_users;
          CREATE POLICY "Service role full access" ON public.app_users
            FOR ALL USING (current_setting('role') = 'service_role');
        `
      });

      if (error) {
        return {
          status: 'error',
          message: 'Erro ao criar tabela customizada',
          error: error.message,
        };
      }

      return {
        status: 'success',
        message: 'Tabela app_users criada com políticas RLS corretas',
        data,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro interno ao criar tabela customizada',
        error: error.message,
      };
    }
  }

  @Post('enable-rls')
  @ApiOperation({ summary: 'Re-enable RLS on users table' })
  async enableRLS() {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Execute SQL to enable RLS
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;'
      });

      if (error) {
        return {
          status: 'error',
          message: 'Erro ao habilitar RLS',
          error: error.message,
        };
      }

      return {
        status: 'success',
        message: 'RLS habilitado na tabela users',
        data,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Erro interno ao habilitar RLS',
        error: error.message,
      };
    }
  }

  @Post('execute-admin-migration')
  @ApiOperation({ summary: 'Execute admin user migration SQL (20250103000001_add_admin_user.sql)' })
  async executeAdminMigration() {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      this.logger.log('Executing admin user migration...');

      // First, insert the admin user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({
          id: 'admin-cinevision-2025-0000-000000000001',
          name: 'Administrador CineVision',
          email: 'adm@cinevision.com.br',
          password: '$2b$12$RkZ492rLZOf4bkLDj61kyOtgJyvguKUHZnYmUSeYN60GU9IZ9a2vK', // Admin123
          role: 'admin',
          status: 'active',
          blocked: false,
          email_verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'email'
        });

      if (userError) {
        this.logger.error('Error inserting admin user:', userError);
        throw new Error(`Failed to insert admin user: ${userError.message}`);
      }

      this.logger.log('Admin user inserted successfully');

      // Then, insert the system log
      const { data: logData, error: logError } = await supabase
        .from('system_logs')
        .insert({
          type: 'auth',
          level: 'info',
          message: 'Admin user created/updated: adm@cinevision.com.br',
          meta: {
            email: 'adm@cinevision.com.br',
            role: 'admin',
            migration: '20250103000001'
          },
          created_at: new Date().toISOString()
        });

      if (logError) {
        this.logger.warn('Error inserting system log:', logError);
        // Don't fail the migration if log insertion fails
      } else {
        this.logger.log('System log inserted successfully');
      }

      return {
        status: 'success',
        message: 'Admin user migration executed successfully',
        data: {
          user: userData,
          log: logData,
          migration: '20250103000001_add_admin_user.sql'
        }
      };
    } catch (error) {
      this.logger.error('Error executing admin migration:', error);
      return {
        status: 'error',
        message: 'Failed to execute admin migration',
        error: error.message
      };
    }
  }

  @Post('login')
  async login(@Body() loginDto: { email: string; password: string }) {
    try {
      this.logger.log(`Tentativa de login para: ${loginDto.email}`);

      // Buscar usuário diretamente via REST API
      const users = await this.supabaseClient.select('users', {
        select: 'id,name,email,password,role,status,blocked,created_at,updated_at',
        where: { email: loginDto.email },
        limit: 1,
      });

      if (!users || users.length === 0) {
        this.logger.warn(`Usuário não encontrado: ${loginDto.email}`);
        return {
          status: 'error',
          message: 'Credenciais inválidas',
        };
      }

      const user = users[0];

      // Verificar se o usuário está ativo
      if (user.status !== 'active' || user.blocked) {
        this.logger.warn(`Usuário bloqueado ou inativo: ${loginDto.email}`);
        return {
          status: 'error',
          message: 'Usuário bloqueado ou inativo',
        };
      }

      // Verificar senha
      const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
      if (!isPasswordValid) {
        this.logger.warn(`Senha inválida para: ${loginDto.email}`);
        return {
          status: 'error',
          message: 'Credenciais inválidas',
        };
      }

      // Gerar tokens JWT
      const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
      const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-key';

      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      };

      const accessToken = jwt.sign(payload, jwtSecret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      });

      const refreshToken = jwt.sign(payload, jwtRefreshSecret, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      });

      this.logger.log(`Login bem-sucedido para: ${loginDto.email}`);

      return {
        status: 'success',
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      this.logger.error('Erro no login:', error.message);
      return {
        status: 'error',
        message: 'Erro interno do servidor',
        error: error.message,
      };
    }
  }

  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar token JWT',
    description: 'Verifica se um token JWT é válido',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
      },
      required: ['token'],
    },
  })
  async verifyToken(@Body() verifyDto: { token: string }) {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
      const decoded = jwt.verify(verifyDto.token, jwtSecret);
      
      return {
        status: 'valid',
        payload: decoded,
      };
    } catch (error) {
      return {
        status: 'invalid',
        error: error.message,
      };
    }
  }

  @Post('fix-purchase-status')
  @ApiOperation({ summary: 'Fix purchase status from PAID to paid' })
  async fixPurchaseStatus() {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data, error } = await supabase
        .from('purchases')
        .update({ status: 'paid' })
        .eq('status', 'PAID')
        .select();

      if (error) {
        throw new Error(error.message);
      }

      return {
        status: 'success',
        message: `Updated ${data?.length || 0} purchases from PAID to paid`,
        data,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to fix purchase status',
        error: error.message,
      };
    }
  }
}