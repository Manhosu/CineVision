import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { TelegramLinkToken } from '../entities/telegram-link-token.entity';
import { UsersService } from '../../users/users.service';
import { User, UserRole } from '../../users/entities/user.entity';
import { TelegramCallbackDto } from '../dto/telegram-callback.dto';

@Injectable()
export class TelegramAuthService {
  constructor(
    @InjectRepository(TelegramLinkToken)
    private telegramLinkTokenRepository: Repository<TelegramLinkToken>,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Generate a temporary token for Telegram authentication
   */
  async generateTelegramLink(ipAddress?: string, userAgent?: string) {
    // Clean up expired tokens
    await this.cleanupExpiredTokens();

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Token expires in 2 minutes
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    const telegramLinkToken = this.telegramLinkTokenRepository.create({
      token,
      expires_at: expiresAt,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    await this.telegramLinkTokenRepository.save(telegramLinkToken);

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'CineVisionApp_Bot';
    const deepLink = `https://t.me/${botUsername}?start=${token}`;

    return {
      token,
      deep_link: deepLink,
      qr_data: deepLink,
      expires_in: 120, // 2 minutes in seconds
    };
  }

  /**
   * Process Telegram callback and authenticate user
   */
  async processTelegramCallback(callbackDto: TelegramCallbackDto) {
    // Validate HMAC signature
    if (!this.validateHmacSignature(callbackDto)) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Find and validate token
    const linkToken = await this.telegramLinkTokenRepository.findOne({
      where: { token: callbackDto.token },
    });

    if (!linkToken) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (linkToken.is_used) {
      throw new BadRequestException('Token already used');
    }

    if (linkToken.expires_at < new Date()) {
      throw new BadRequestException('Token expired');
    }

    // Mark token as used
    linkToken.is_used = true;
    linkToken.used_at = new Date();
    linkToken.telegram_id = callbackDto.telegram_id;
    linkToken.telegram_username = callbackDto.telegram_username;
    linkToken.telegram_first_name = callbackDto.telegram_first_name;
    linkToken.telegram_last_name = callbackDto.telegram_last_name;
    
    await this.telegramLinkTokenRepository.save(linkToken);

    // Find existing user by telegram_id
    let user = await this.usersService.findByTelegramId(callbackDto.telegram_id);
    let isNewUser = false;

    if (!user) {
      // Create new user with minimal data
      const userName = this.generateUserName(
        callbackDto.telegram_first_name,
        callbackDto.telegram_last_name,
        callbackDto.telegram_username,
      );

      user = await this.usersService.create({
        name: userName,
        email: `telegram_${callbackDto.telegram_id}@cinevision.temp`, // Temporary email
        password: crypto.randomBytes(32).toString('hex'), // Random password (user won't use it)
        telegram_id: callbackDto.telegram_id,
        telegram_username: callbackDto.telegram_username,
        role: UserRole.USER,
      });

      isNewUser = true;
    } else {
      // Update existing user's Telegram info if needed
      if (user.telegram_username !== callbackDto.telegram_username) {
        await this.usersService.updateTelegramInfo(user.id, {
          telegram_username: callbackDto.telegram_username,
        });
        user.telegram_username = callbackDto.telegram_username;
      }
    }

    // Generate JWT tokens
    const tokens = await this.generateTokens(user);

    // Save refresh token
    await this.usersService.updateRefreshToken(user.id, tokens.refresh_token);

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    const { password, refresh_token, ...userWithoutSensitiveData } = user;

    return {
      user: {
        ...userWithoutSensitiveData,
        role: userWithoutSensitiveData.role.toString(),
        status: userWithoutSensitiveData.status.toString(),
      },
      ...tokens,
      is_new_user: isNewUser,
    };
  }

  /**
   * Validate HMAC signature from Telegram bot
   */
  private validateHmacSignature(callbackDto: TelegramCallbackDto): boolean {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    // Create data string for HMAC validation
    const dataString = [
      `telegram_id=${callbackDto.telegram_id}`,
      `token=${callbackDto.token}`,
      callbackDto.telegram_username ? `telegram_username=${callbackDto.telegram_username}` : null,
      callbackDto.telegram_first_name ? `telegram_first_name=${callbackDto.telegram_first_name}` : null,
      callbackDto.telegram_last_name ? `telegram_last_name=${callbackDto.telegram_last_name}` : null,
    ]
      .filter(Boolean)
      .sort()
      .join('\n');

    // Generate expected signature
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(dataString)
      .digest('hex');

    // Extract signature from header (remove 'sha256=' prefix if present)
    const receivedSignature = callbackDto.signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex'),
    );
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
    return 'Telegram User';
  }

  /**
   * Generate JWT tokens for user
   */
  private async generateTokens(user: User) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      telegram_id: user.telegram_id,
    };

    const access_token = this.jwtService.sign(payload);

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
   * Clean up expired tokens
   */
  private async cleanupExpiredTokens() {
    await this.telegramLinkTokenRepository.delete({
      expires_at: LessThan(new Date()),
    });
  }
}