import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface SupabaseQueryOptions {
  select?: string;
  where?: Record<string, any>;
  /** Additional PostgREST AND filters for compound conditions on the same column.
   *  Each entry is a raw PostgREST filter expression, e.g. 'created_at.gte.2024-01-01'
   *  These are combined into a single `and=(...)` query param. */
  andFilters?: string[];
  order?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export interface SupabaseInsertOptions {
  returning?: string;
  onConflict?: string;
}

export interface SupabaseUpdateOptions {
  returning?: string;
}

@Injectable()
export class SupabaseRestClient {
  private readonly logger = new Logger(SupabaseRestClient.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('SUPABASE_URL');
    // Use SERVICE_ROLE_KEY for admin operations to bypass RLS
    this.apiKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
                  this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Supabase URL and API Key are required');
    }

    this.client = axios.create({
      baseURL: `${this.baseUrl}/rest/v1`,
      headers: {
        'apikey': this.apiKey,
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      timeout: 30000,
    });

    // Interceptor para logs
    this.client.interceptors.request.use(
      (config) => {
        this.logger.log(`🔄 ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('❌ Request error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.log(`✅ ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error(`❌ Response error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Buscar registros de uma tabela
   */
  async select<T = any>(
    table: string, 
    options: SupabaseQueryOptions = {}
  ): Promise<T[]> {
    try {
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: `/${table}`,
        params: {}
      };

      // Select columns
      if (options.select) {
        config.params.select = options.select;
      }

      // Where conditions
      if (options.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // Support for IN operator: { id: { in: [val1, val2, val3] } }
            if (typeof value === 'object' && value.in && Array.isArray(value.in)) {
              // PostgREST IN syntax: id=in.(val1,val2,val3) - no quotes for UUIDs
              const values = value.in.join(',');
              config.params[key] = `in.(${values})`;
              this.logger.log(`[SupabaseRestClient] Added IN filter: ${key}=in.(${values})`);
            }
            // Support for NOT IN operator: { user_id: { not_in: [val1, val2] } }
            else if (typeof value === 'object' && value.not_in && Array.isArray(value.not_in)) {
              const values = value.not_in.join(',');
              config.params[key] = `not.in.(${values})`;
              this.logger.log(`[SupabaseRestClient] Added NOT IN filter: ${key}=not.in.(${values})`);
            }
            // Support for GTE operator: { created_at: { gte: '2024-01-01' } }
            else if (typeof value === 'object' && value.gte !== undefined) {
              config.params[key] = `gte.${value.gte}`;
              this.logger.log(`[SupabaseRestClient] Added GTE filter: ${key}=gte.${value.gte}`);
            }
            // Support for LTE operator: { created_at: { lte: '2024-12-31' } }
            else if (typeof value === 'object' && value.lte !== undefined) {
              config.params[key] = `lte.${value.lte}`;
              this.logger.log(`[SupabaseRestClient] Added LTE filter: ${key}=lte.${value.lte}`);
            }
            // Support for ILIKE operator: { title: { ilike: '*search*' } }
            else if (typeof value === 'object' && value.ilike !== undefined) {
              // PostgREST ILIKE syntax: title=ilike.*search*
              config.params[key] = `ilike.${value.ilike}`;
              this.logger.log(`[SupabaseRestClient] Added ILIKE filter: ${key}=ilike.${value.ilike}`);
            } else {
              config.params[key] = `eq.${value}`;
              this.logger.log(`[SupabaseRestClient] Added EQ filter: ${key}=eq.${value}`);
            }
          }
        });
      }

      // Compound AND filters for multiple conditions on the same column
      if (options.andFilters && options.andFilters.length > 0) {
        config.params['and'] = `(${options.andFilters.join(',')})`;
        this.logger.log(`[SupabaseRestClient] Added AND filter: and=(${options.andFilters.join(',')})`);
      }

      this.logger.log(`[SupabaseRestClient] Final query params: ${JSON.stringify(config.params)}`);

      // Order by
      if (options.order) {
        const direction = options.order.ascending !== false ? 'asc' : 'desc';
        config.params.order = `${options.order.column}.${direction}`;
      }

      // Limit
      if (options.limit) {
        config.params.limit = options.limit;
      }

      // Offset
      if (options.offset) {
        config.params.offset = options.offset;
      }

      const response = await this.client.request(config);
      return response.data;
    } catch (error) {
      this.logger.error(`Error selecting from ${table}:`, error.message);
      throw error;
    }
  }

  /**
   * Buscar registros com contagem total (para paginação)
   * Suporta filtros OR via PostgREST
   */
  async selectWithCount<T = any>(
    table: string,
    options: SupabaseQueryOptions & { or?: string; rawFilters?: Record<string, string> } = {}
  ): Promise<{ data: T[]; count: number }> {
    try {
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: `/${table}`,
        params: {},
        headers: {
          'Prefer': 'count=exact'
        }
      };

      // Select columns
      if (options.select) {
        config.params.select = options.select;
      }

      // Where conditions
      if (options.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (typeof value === 'object' && value.in && Array.isArray(value.in)) {
              const values = value.in.join(',');
              config.params[key] = `in.(${values})`;
            } else if (typeof value === 'object' && value.ilike !== undefined) {
              config.params[key] = `ilike.${value.ilike}`;
            } else {
              config.params[key] = `eq.${value}`;
            }
          }
        });
      }

      // OR filter (PostgREST syntax)
      if (options.or) {
        config.params.or = options.or;
      }

      // Raw filters (already formatted for PostgREST)
      if (options.rawFilters) {
        Object.entries(options.rawFilters).forEach(([key, value]) => {
          config.params[key] = value;
        });
      }

      // Order by
      if (options.order) {
        const direction = options.order.ascending !== false ? 'asc' : 'desc';
        config.params.order = `${options.order.column}.${direction}`;
      }

      // Limit
      if (options.limit) {
        config.params.limit = options.limit;
      }

      // Offset
      if (options.offset) {
        config.params.offset = options.offset;
      }

      const response = await this.client.request(config);
      const contentRange = response.headers['content-range'];
      let count = 0;

      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        count = match ? parseInt(match[1], 10) : 0;
      }

      return { data: response.data, count };
    } catch (error) {
      this.logger.error(`Error selectWithCount from ${table}:`, error.message);
      throw error;
    }
  }

  /**
   * Buscar um único registro
   */
  async selectOne<T = any>(
    table: string, 
    options: SupabaseQueryOptions = {}
  ): Promise<T | null> {
    const results = await this.select<T>(table, { ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Inserir registros
   */
  async insert<T = any>(
    table: string, 
    data: Partial<T> | Partial<T>[], 
    options: SupabaseInsertOptions = {}
  ): Promise<T[]> {
    try {
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: `/${table}`,
        data,
        headers: {}
      };

      // Returning
      if (options.returning) {
        config.params = { select: options.returning };
      }

      // On conflict
      if (options.onConflict) {
        config.headers['Prefer'] = `resolution=merge-duplicates`;
      }

      const response = await this.client.request(config);
      return response.data;
    } catch (error) {
      this.logger.error(`Error inserting into ${table}:`, error.message);
      throw error;
    }
  }

  /**
   * Atualizar registros
   */
  async update<T = any>(
    table: string, 
    data: Partial<T>, 
    where: Record<string, any>,
    options: SupabaseUpdateOptions = {}
  ): Promise<T[]> {
    try {
      const config: AxiosRequestConfig = {
        method: 'PATCH',
        url: `/${table}`,
        data,
        params: {}
      };

      // Where conditions
      Object.entries(where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          config.params[key] = `eq.${value}`;
        }
      });

      // Returning
      if (options.returning) {
        config.params.select = options.returning;
      }

      const response = await this.client.request(config);
      return response.data;
    } catch (error) {
      this.logger.error(`Error updating ${table}:`, error.message);
      throw error;
    }
  }

  /**
   * Deletar registros
   */
  async delete<T = any>(
    table: string, 
    where: Record<string, any>
  ): Promise<T[]> {
    try {
      const config: AxiosRequestConfig = {
        method: 'DELETE',
        url: `/${table}`,
        params: {}
      };

      // Where conditions
      Object.entries(where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          config.params[key] = `eq.${value}`;
        }
      });

      const response = await this.client.request(config);
      return response.data;
    } catch (error) {
      this.logger.error(`Error deleting from ${table}:`, error.message);
      throw error;
    }
  }

  /**
   * Executar query SQL customizada (via RPC)
   */
  async rpc<T = any>(
    functionName: string, 
    params: Record<string, any> = {}
  ): Promise<T> {
    try {
      const response = await this.client.post(`/rpc/${functionName}`, params);
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling RPC ${functionName}:`, error.message);
      throw error;
    }
  }

  /**
   * Contar registros
   */
  async count(
    table: string,
    where: Record<string, any> = {},
    andFilters?: string[]
  ): Promise<number> {
    try {
      const config: AxiosRequestConfig = {
        method: 'HEAD',
        url: `/${table}`,
        params: {},
        headers: {
          'Prefer': 'count=exact'
        }
      };

      // Where conditions
      Object.entries(where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Support for IN operator: { id: { in: [val1, val2, val3] } }
          if (typeof value === 'object' && value.in && Array.isArray(value.in)) {
            const values = value.in.join(',');
            config.params[key] = `in.(${values})`;
          }
          // Support for NOT IN operator: { user_id: { not_in: [val1, val2] } }
          else if (typeof value === 'object' && value.not_in && Array.isArray(value.not_in)) {
            const values = value.not_in.join(',');
            config.params[key] = `not.in.(${values})`;
          }
          // Support for GTE operator: { created_at: { gte: '2024-01-01' } }
          else if (typeof value === 'object' && value.gte !== undefined) {
            config.params[key] = `gte.${value.gte}`;
          }
          // Support for LTE operator: { created_at: { lte: '2024-12-31' } }
          else if (typeof value === 'object' && value.lte !== undefined) {
            config.params[key] = `lte.${value.lte}`;
          }
          // Support for ILIKE operator: { title: { ilike: '*search*' } }
          else if (typeof value === 'object' && value.ilike !== undefined) {
            config.params[key] = `ilike.${value.ilike}`;
          } else {
            config.params[key] = `eq.${value}`;
          }
        }
      });

      // Compound AND filters for multiple conditions on the same column
      if (andFilters && andFilters.length > 0) {
        config.params['and'] = `(${andFilters.join(',')})`;
      }

      const response = await this.client.request(config);
      const contentRange = response.headers['content-range'];
      
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      }
      
      return 0;
    } catch (error) {
      this.logger.error(`Error counting ${table}:`, error.message);
      throw error;
    }
  }

  /**
   * Verificar se a conexão está funcionando
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/', {
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.status === 200;
    } catch (error) {
      this.logger.error('Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Obter informações do banco
   */
  async getDatabaseInfo(): Promise<any> {
    try {
      // Usar uma query simples para testar a conexão
      const response = await this.client.get('/', {
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      return {
        status: 'connected',
        timestamp: new Date().toISOString(),
        supabaseUrl: this.baseUrl,
        responseStatus: response.status,
        headers: response.headers
      };
    } catch (error) {
      this.logger.error('Error getting database info:', error.message);
      throw error;
    }
  }
}