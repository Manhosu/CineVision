import { Injectable, Logger, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
// import { LogsService } from '../logs/logs.service'; // Temporarily commented
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    // private logsService: LogsService, // Temporarily commented
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    // Diagnóstico F2.2 (Igor reportou que funcionário Rafaela não
    // consegue logar — "Acesso Negado"). Logamos cada falha pra
    // distinguir as 3 causas possíveis: (a) email não encontrado,
    // (b) password_hash ausente, (c) senha errada. Em produção
    // facilita o triage sem expor dados sensíveis (não logamos
    // a senha).
    if (!user) {
      this.logger.warn(`Login failed: email "${email}" not found`);
      return null;
    }

    const hash = user.password_hash || user.password;
    if (!hash) {
      this.logger.warn(
        `Login failed: user ${user.id} (${email}) sem password_hash — registro foi criado sem senha hashada`,
      );
      return null;
    }

    const ok = await bcrypt.compare(password, hash);
    if (!ok) {
      this.logger.warn(`Login failed: senha incorreta para ${email} (role=${user.role})`);
      return null;
    }

    const { password: userPassword, password_hash, refresh_token, ...result } = user;
    return result;
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const { password, password_hash, refresh_token, ...userWithoutSensitiveData } = user;

    const tokens = await this.generateTokens(user);

    // Save refresh token to database - DISABLED (usando tabela refresh_tokens separada)
    // await this.usersService.updateRefreshToken(user.id, tokens.refresh_token);

    return {
      user: userWithoutSensitiveData,
      ...tokens,
    };
  }

  async login(user: User, ip?: string, userAgent?: string) {
    const tokens = await this.generateTokens(user);

    // Save refresh token to database - DISABLED (usando tabela refresh_tokens separada)
    // await this.usersService.updateRefreshToken(user.id, tokens.refresh_token);

    // Log successful login - temporarily commented
    // await this.logsService.logAuth(
    //   `User ${user.email} logged in successfully`,
    //   user.id,
    //   ip,
    //   userAgent,
    // );

    const { password, password_hash, refresh_token, ...userWithoutSensitiveData } = user;

    return {
      user: userWithoutSensitiveData,
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'cine-vision-refresh-secret-key',
      });

      const user = await this.usersService.findById(payload.sub);

      if (!user || user.refresh_token !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user);

      // Update refresh token in database
      await this.usersService.updateRefreshToken(user.id, tokens.refresh_token);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    // Remove refresh token from database
    await this.usersService.updateRefreshToken(userId, null);

    return { message: 'Logged out successfully' };
  }

  private async generateTokens(user: User) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
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
}