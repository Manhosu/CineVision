import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt', 'supabase-jwt']) {
  private readonly logger = new Logger(JwtAuthGuard.name);

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

    // Get request for logging
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      this.logger.warn(`No authorization header found for ${request.url}`);
      throw new UnauthorizedException('Token de autenticação não fornecido');
    }

    // Try both strategies - Passport will attempt 'jwt' first, then 'supabase-jwt'
    // If either succeeds, authentication passes
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (error) {
      this.logger.warn(`Authentication failed for ${request.url}: ${error.message}`);
      // If both strategies fail, throw a clear error
      throw new UnauthorizedException('Token de autenticação inválido ou expirado');
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
    // If user is authenticated by either strategy, return the user
    if (user) {
      return user;
    }

    // Log the error for debugging
    const request = context.switchToHttp().getRequest();
    this.logger.warn(`handleRequest failed for ${request.url}. Error: ${err?.message}, Info: ${info?.message}`);

    // If no user and there's an error, throw it with a clear message
    if (err || !user) {
      throw err || new UnauthorizedException('Token de autenticação inválido ou expirado');
    }

    return user;
  }
}