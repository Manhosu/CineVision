import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
  private readonly logger = new (require('@nestjs/common').Logger)(SupabaseJwtStrategy.name);

  constructor(private configService: ConfigService) {
    // Supabase JWTs are signed with the SUPABASE_JWT_SECRET (extracted from project settings)
    // For development, we can use the SUPABASE_ANON_KEY as it contains the same secret
    const supabaseJwtSecret = configService.get('SUPABASE_JWT_SECRET') ||
                              configService.get('SUPABASE_ANON_KEY');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: supabaseJwtSecret,
      // Supabase uses HS256 algorithm
      algorithms: ['HS256'],
    });

    this.logger.log(`SupabaseJwtStrategy initialized with secret: ${supabaseJwtSecret?.substring(0, 20)}...`);
  }

  async validate(payload: any) {
    // Log the entire payload for debugging
    this.logger.log('=== SupabaseJwtStrategy.validate() called ===');
    this.logger.log(`Payload received: ${JSON.stringify(payload, null, 2)}`);

    // Supabase JWT payload structure:
    // {
    //   aud: "authenticated",
    //   exp: 1234567890,
    //   iat: 1234567890,
    //   iss: "https://szghyvnbmjlquznxhqum.supabase.co/auth/v1",
    //   sub: "user-uuid",
    //   email: "user@example.com",
    //   phone: "",
    //   app_metadata: { provider: "email", ... },
    //   user_metadata: { name: "User Name", role: "admin" },
    //   role: "authenticated",
    //   aal: "aal1",
    //   amr: [...],
    //   session_id: "..."
    // }

    if (!payload.sub) {
      this.logger.error('VALIDATION FAILED: No sub field in payload');
      throw new UnauthorizedException('Invalid Supabase token');
    }

    // Map Supabase payload to our user format
    const user = {
      id: payload.sub,
      sub: payload.sub,  // Required by @GetUser() decorator
      email: payload.email,
      role: payload.user_metadata?.role || 'user',
      // Add any additional fields needed
      supabase: true, // Flag to identify this came from Supabase auth
    };

    this.logger.log(`User validated successfully: ${JSON.stringify(user, null, 2)}`);
    this.logger.log('===========================================');

    return user;
  }
}
