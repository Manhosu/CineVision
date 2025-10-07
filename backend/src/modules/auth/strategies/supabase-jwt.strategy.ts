import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
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
  }

  async validate(payload: any) {
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
      throw new UnauthorizedException('Invalid Supabase token');
    }

    // Map Supabase payload to our user format
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.user_metadata?.role || 'user',
      // Add any additional fields needed
      supabase: true, // Flag to identify this came from Supabase auth
    };
  }
}
