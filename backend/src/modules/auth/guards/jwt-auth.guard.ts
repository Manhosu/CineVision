import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt', 'supabase-jwt']) {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Try both strategies - Passport will attempt 'jwt' first, then 'supabase-jwt'
    // If either succeeds, authentication passes
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (error) {
      // If both strategies fail, throw the original error
      throw error;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
    // If user is authenticated by either strategy, return the user
    if (user) {
      return user;
    }

    // If no user and there's an error, throw it
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication failed');
    }

    return user;
  }
}