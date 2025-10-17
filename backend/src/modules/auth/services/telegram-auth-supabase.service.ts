import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

@Injectable()
export class TelegramAuthSupabaseService {
  private readonly logger = new Logger(TelegramAuthSupabaseService.name);
  private supabase: SupabaseClient;

  constructor(
    private jwtService: JwtService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  /**
   * Process Telegram Login Widget callback and authenticate user
   * This method validates the Telegram auth data and creates/updates user
   */
  async authenticateWithTelegram(telegramAuthData: TelegramAuthData) {
    this.logger.log(`Authenticating user with Telegram ID: ${telegramAuthData.id}`);

    // Validate Telegram auth data
    if (!this.validateTelegramAuth(telegramAuthData)) {
      throw new UnauthorizedException('Invalid Telegram authentication data');
    }

    // Check if auth_date is not too old (within 1 hour)
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - telegramAuthData.auth_date > 3600) {
      throw new UnauthorizedException('Authentication data expired');
    }

    // Find or create user
    const user = await this.findOrCreateUser(telegramAuthData);

    if (!user) {
      throw new UnauthorizedException('Failed to create or find user');
    }

    // Generate JWT tokens
    const tokens = await this.generateTokens(user);

    this.logger.log(`User authenticated successfully: ${user.id}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        telegram_id: user.telegram_id,
        telegram_username: user.telegram_username,
        role: user.role,
        status: user.status,
      },
      ...tokens,
    };
  }

  /**
   * Validate Telegram authentication data using HMAC-SHA256
   * According to Telegram Login Widget documentation
   */
  private validateTelegramAuth(data: TelegramAuthData): boolean {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN not configured');
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    // Create data check string
    const checkData: { [key: string]: string | number } = {};
    Object.keys(data).forEach((key) => {
      if (key !== 'hash') {
        checkData[key] = data[key];
      }
    });

    // Sort keys and create check string
    const dataCheckString = Object.keys(checkData)
      .sort()
      .map((key) => `${key}=${checkData[key]}`)
      .join('\n');

    // Generate secret key
    const secretKey = crypto.createHash('sha256').update(botToken).digest();

    // Generate expected hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Compare hashes using timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(data.hash, 'hex'),
    );
  }

  /**
   * Find existing user by Telegram ID or create new one
   */
  private async findOrCreateUser(telegramAuthData: TelegramAuthData): Promise<any> {
    try {
      // Try to find existing user by telegram_id
      const { data: existingUser, error: findError } = await this.supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramAuthData.id.toString())
        .single();

      if (existingUser && !findError) {
        this.logger.log(`Found existing user with telegram_id ${telegramAuthData.id}: ${existingUser.id}`);

        // Update Telegram info if changed
        const updates: any = {};
        if (telegramAuthData.username && existingUser.telegram_username !== telegramAuthData.username) {
          updates.telegram_username = telegramAuthData.username;
        }
        if (telegramAuthData.first_name || telegramAuthData.last_name) {
          const newName = this.generateUserName(
            telegramAuthData.first_name,
            telegramAuthData.last_name,
            telegramAuthData.username,
          );
          if (newName !== existingUser.name) {
            updates.name = newName;
          }
        }

        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          await this.supabase
            .from('users')
            .update(updates)
            .eq('id', existingUser.id);

          return { ...existingUser, ...updates };
        }

        return existingUser;
      }

      // User not found, create new one
      this.logger.log(`Creating new user for telegram_id ${telegramAuthData.id}`);

      const userName = this.generateUserName(
        telegramAuthData.first_name,
        telegramAuthData.last_name,
        telegramAuthData.username,
      );

      const { data: newUser, error: createError } = await this.supabase
        .from('users')
        .insert({
          telegram_id: telegramAuthData.id.toString(),
          telegram_username: telegramAuthData.username || null,
          name: userName,
          email: `telegram_${telegramAuthData.id}@cinevision.temp`,
          password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
          role: 'user',
          status: 'active',
        })
        .select()
        .single();

      if (createError || !newUser) {
        this.logger.error('Error creating user:', createError);
        throw new Error('Failed to create user');
      }

      this.logger.log(`New user created: ${newUser.id} for telegram_id ${telegramAuthData.id}`);
      return newUser;

    } catch (error) {
      this.logger.error('Error in findOrCreateUser:', error);
      throw error;
    }
  }

  /**
   * Generate user name from Telegram data
   */
  private generateUserName(
    firstName?: string,
    lastName?: string,
    username?: string,
  ): string {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) {
      return firstName;
    }
    if (username) {
      return username;
    }
    return 'Usuário Telegram';
  }

  /**
   * Generate JWT access and refresh tokens
   */
  private async generateTokens(user: any) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      telegram_id: user.telegram_id,
    };

    const access_token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'cine-vision-secret-key',
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    const refresh_token = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'cine-vision-refresh-secret-key',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return {
      access_token,
      refresh_token,
    };
  }
}
