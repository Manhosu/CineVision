import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class ActivityTrackerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ActivityTrackerMiddleware.name);
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // Only track activity for authenticated requests
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        // Decode JWT to get user ID (simple approach without verification)
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const userId = payload.sub || payload.userId;

        if (userId) {
          // Update last_active_at asynchronously (don't wait for it)
          this.updateUserActivity(userId).catch(error => {
            this.logger.warn(`Failed to update activity for user ${userId}:`, error.message);
          });
        }
      } catch (error) {
        // Silently fail - don't block the request
      }
    }

    next();
  }

  private async updateUserActivity(userId: string): Promise<void> {
    await this.supabase
      .from('users')
      .update({
        last_active_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }
}
