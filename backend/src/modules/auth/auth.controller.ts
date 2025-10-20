import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
  Ip,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { TelegramAuthService } from './services/telegram-auth.service';
import { AutoLoginService } from './services/auto-login.service';
import { Optional } from '@nestjs/common';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TelegramLinkResponseDto } from './dto/telegram-link.dto';
import { TelegramCallbackDto, TelegramCallbackResponseDto } from './dto/telegram-callback.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private autoLoginService: AutoLoginService,
    @Optional() private telegramAuthService?: TelegramAuthService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
          },
        },
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
          },
        },
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Request() req,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(req.user, ip, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user (invalidate refresh token)' })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
  })
  async logout(@Request() req) {
    return this.authService.logout(req.user.id);
  }

  @Get('telegram/link')
  @ApiOperation({ summary: 'Generate Telegram authentication link' })
  @ApiResponse({
    status: 200,
    description: 'Telegram link generated successfully',
    type: TelegramLinkResponseDto,
  })
  async generateTelegramLink(
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<TelegramLinkResponseDto> {
    if (!this.telegramAuthService) {
      throw new BadRequestException('Telegram authentication is not available');
    }
    return this.telegramAuthService.generateTelegramLink(ip, userAgent);
  }

  @Post('telegram/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process Telegram authentication callback' })
  @ApiResponse({
    status: 200,
    description: 'Telegram authentication successful',
    type: TelegramCallbackResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async processTelegramCallback(
    @Body() callbackDto: TelegramCallbackDto,
  ): Promise<TelegramCallbackResponseDto> {
    if (!this.telegramAuthService) {
      throw new BadRequestException('Telegram authentication is not available');
    }
    return this.telegramAuthService.processTelegramCallback(callbackDto);
  }

  @Post('auto-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate auto-login token and authenticate user' })
  @ApiResponse({
    status: 200,
    description: 'Auto-login successful',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
            telegram_id: { type: 'string' },
          },
        },
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        redirect_url: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async autoLogin(@Body() body: { token: string }) {
    return this.autoLoginService.validateAndConsumeToken(body.token);
  }

  @Post('telegram-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user directly with Telegram ID (permanent link)' })
  @ApiResponse({
    status: 200,
    description: 'Telegram auto-login successful',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
            telegram_id: { type: 'string' },
          },
        },
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid Telegram ID' })
  async telegramLogin(@Body() body: { telegram_id: string }) {
    return this.autoLoginService.loginByTelegramId(body.telegram_id);
  }
}