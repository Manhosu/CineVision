import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseRestClient } from '../../config/supabase-rest-client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersSupabaseService {
  private readonly logger = new Logger(UsersSupabaseService.name);

  constructor(private readonly supabaseClient: SupabaseRestClient) {}

  async create(createUserDto: CreateUserDto): Promise<any> {
    this.logger.log(`Creating user: ${createUserDto.email}`);
    
    try {
      const result = await this.supabaseClient.insert('users', createUserDto);
      this.logger.log(`User created successfully`);
      return result[0]; // Return first created user
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }

  async findAll(): Promise<any[]> {
    this.logger.log('Finding all users with Supabase REST client');

    try {
      const users = await this.supabaseClient.select('users', {
        select: 'id, name, email, phone, role, status, telegram_id, telegram_username, telegram_chat_id, created_at, updated_at'
      });
      return users;
    } catch (error) {
      this.logger.error('Failed to find users:', error.message);
      throw new Error(`Failed to find users: ${error.message}`);
    }
  }

  async findById(id: string): Promise<any> {
    this.logger.log(`Finding user by ID: ${id}`);
    
    try {
      const user = await this.supabaseClient.selectOne('users', {
        where: { id }
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to find user:', error.message);
      throw new Error(`Failed to find user: ${error.message}`);
    }
  }

  async findByEmail(email: string): Promise<any> {
    this.logger.log(`Finding user by email: ${email}`);
    
    try {
      const user = await this.supabaseClient.selectOne('users', {
        where: { email }
      });
      return user; // Returns null if not found
    } catch (error) {
      this.logger.error('Failed to find user by email:', error.message);
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<any> {
    this.logger.log(`Updating user: ${id}`);
    
    try {
      const result = await this.supabaseClient.update('users', updateUserDto, { id });
      if (result.length === 0) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      return result[0];
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to update user:', error.message);
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing user: ${id}`);
    
    try {
      await this.supabaseClient.delete('users', { id });
    } catch (error) {
      this.logger.error('Failed to remove user:', error.message);
      throw new Error(`Failed to remove user: ${error.message}`);
    }
  }

  async findByTelegramUsername(telegram_username: string): Promise<any> {
    this.logger.log(`Finding user by telegram username: ${telegram_username}`);
    
    try {
      const user = await this.supabaseClient.selectOne('users', {
        where: { telegram_username }
      });
      return user; // Returns null if not found
    } catch (error) {
      this.logger.error('Failed to find user by telegram username:', error.message);
      throw new Error(`Failed to find user by telegram username: ${error.message}`);
    }
  }

  async findByTelegramChatId(telegram_chat_id: string): Promise<any> {
    this.logger.log(`Finding user by telegram chat ID: ${telegram_chat_id}`);
    
    try {
      const user = await this.supabaseClient.selectOne('users', {
        where: { telegram_chat_id }
      });
      return user; // Returns null if not found
    } catch (error) {
      this.logger.error('Failed to find user by telegram chat ID:', error.message);
      throw new Error(`Failed to find user by telegram chat ID: ${error.message}`);
    }
  }

  async findByTelegramId(telegram_id: string): Promise<any> {
    this.logger.log(`Finding user by telegram ID: ${telegram_id}`);
    
    try {
      const user = await this.supabaseClient.selectOne('users', {
        where: { telegram_id }
      });
      return user; // Returns null if not found
    } catch (error) {
      this.logger.error('Failed to find user by telegram ID:', error.message);
      throw new Error(`Failed to find user by telegram ID: ${error.message}`);
    }
  }

  async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    this.logger.log(`Updating refresh token for user: ${id}`);
    
    try {
      await this.supabaseClient.update('users', { refresh_token: refreshToken }, { id });
    } catch (error) {
      this.logger.error('Failed to update refresh token:', error.message);
      throw new Error(`Failed to update refresh token: ${error.message}`);
    }
  }
}