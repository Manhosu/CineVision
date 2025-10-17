import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

@Injectable()
export class AutoLoginService {
  private readonly logger = new Logger(AutoLoginService.name);
  private supabase: SupabaseClient;

  constructor(private jwtService: JwtService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  /**
   * Generate a temporary auto-login token for a user
   * This token can be used in deep links from Telegram
   */
  async generateAutoLoginToken(
    userId: string,
    telegramId: string,
    redirectUrl?: string,
  ): Promise<{ token: string; login_url: string; expires_in: number }> {
    try {
      // Generate secure random token
      const token = crypto.randomBytes(32).toString('hex');

      // Token expires in 5 minutes
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Clean up old expired tokens for this user
      await this.cleanupExpiredTokens(userId);

      // Create token in database
      const { data, error } = await this.supabase
        .from('auto_login_tokens')
        .insert({
          token,
          user_id: userId,
          telegram_id: telegramId,
          expires_at: expiresAt.toISOString(),
          redirect_url: redirectUrl || null,
          is_used: false,
        })
        .select()
        .single();

      if (error || !data) {
        this.logger.error('Error creating auto-login token:', error);
        throw new Error('Failed to create auto-login token');
      }

      // Generate login URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const loginUrl = `${frontendUrl}/auth/auto-login?token=${token}${redirectUrl ? `&redirect=${encodeURIComponent(redirectUrl)}` : ''}`;

      this.logger.log(`Generated auto-login token for user ${userId} (telegram_id: ${telegramId})`);

      return {
        token,
        login_url: loginUrl,
        expires_in: 300, // 5 minutes in seconds
      };
    } catch (error) {
      this.logger.error('Error in generateAutoLoginToken:', error);
      throw error;
    }
  }

  /**
   * Validate and consume an auto-login token
   * Returns JWT tokens for the user
   */
  async validateAndConsumeToken(token: string): Promise<{
    access_token: string;
    refresh_token: string;
    user: any;
    redirect_url?: string;
  }> {
    try {
      // Find token in database
      const { data: tokenData, error: tokenError } = await this.supabase
        .from('auto_login_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (tokenError || !tokenData) {
        this.logger.warn(`Invalid auto-login token: ${token}`);
        throw new UnauthorizedException('Invalid or expired login token');
      }

      // Check if token is already used
      if (tokenData.is_used) {
        this.logger.warn(`Auto-login token already used: ${token}`);
        throw new UnauthorizedException('Login token already used');
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        this.logger.warn(`Auto-login token expired: ${token}`);
        throw new UnauthorizedException('Login token expired');
      }

      // Mark token as used
      await this.supabase
        .from('auto_login_tokens')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
        })
        .eq('id', tokenData.id);

      // Get user data
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', tokenData.user_id)
        .single();

      if (userError || !user) {
        this.logger.error(`User not found for auto-login token: ${tokenData.user_id}`);
        throw new UnauthorizedException('User not found');
      }

      // Generate JWT tokens
      const tokens = await this.generateJwtTokens(user);

      this.logger.log(`Auto-login successful for user ${user.id} (telegram_id: ${user.telegram_id})`);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          telegram_id: user.telegram_id,
          telegram_username: user.telegram_username,
          role: user.role,
          status: user.status,
        },
        redirect_url: tokenData.redirect_url,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error in validateAndConsumeToken:', error);
      throw new UnauthorizedException('Failed to validate login token');
    }
  }

  /**
   * Generate JWT access and refresh tokens for a user
   */
  private async generateJwtTokens(user: any) {
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

  /**
   * Clean up expired tokens for a user
   */
  private async cleanupExpiredTokens(userId: string) {
    try {
      await this.supabase
        .from('auto_login_tokens')
        .delete()
        .eq('user_id', userId)
        .lt('expires_at', new Date().toISOString());
    } catch (error) {
      this.logger.warn('Error cleaning up expired tokens:', error);
    }
  }

  /**
   * Generate authenticated catalog URL for Telegram user
   */
  async generateCatalogUrl(userId: string, telegramId: string): Promise<string> {
    const { login_url } = await this.generateAutoLoginToken(
      userId,
      telegramId,
      '/catalog',
    );
    return login_url;
  }

  /**
   * Generate authenticated movie detail URL for Telegram user
   */
  async generateMovieUrl(
    userId: string,
    telegramId: string,
    movieId: string,
  ): Promise<string> {
    const { login_url } = await this.generateAutoLoginToken(
      userId,
      telegramId,
      `/movies/${movieId}`,
    );
    return login_url;
  }

  /**
   * Generate authenticated purchase URL for Telegram user
   */
  async generatePurchaseUrl(
    userId: string,
    telegramId: string,
    purchaseId: string,
  ): Promise<string> {
    const { login_url } = await this.generateAutoLoginToken(
      userId,
      telegramId,
      `/dashboard/purchases/${purchaseId}`,
    );
    return login_url;
  }
}
