import { Controller, Get, Delete, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupabaseRestClient } from '../../../config/supabase-rest-client';

@ApiTags('admin-users')
@Controller('admin/users')
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(private readonly supabaseClient: SupabaseRestClient) {}

  @Get()
  @ApiOperation({ summary: 'Get all Telegram users (Admin endpoint - no auth required)' })
  async getAllUsers() {
    const users = await this.supabaseClient.select('users', {
      select: 'id, telegram_id, telegram_username, telegram_chat_id, name, role, created_at',
      order: { column: 'created_at', ascending: false },
      limit: 10000 // Set high limit to fetch all users (default is 1000)
    });

    // Filter only users with telegram_id
    const telegramUsers = users.filter(user => user.telegram_id);

    // Return users list along with total count
    return {
      users: telegramUsers,
      totalSystemUsers: users.length
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user permanently with all related data' })
  async deleteUser(@Param('id') id: string) {
    this.logger.log(`Deleting user ${id} and all related data...`);

    // Delete related data first
    // 1. Delete purchases
    await this.supabaseClient.delete('purchases', { user_id: id });
    this.logger.log(`Deleted purchases for user ${id}`);

    // 2. Delete favorites
    await this.supabaseClient.delete('favorites', { user_id: id });
    this.logger.log(`Deleted favorites for user ${id}`);

    // 3. Delete watch history
    await this.supabaseClient.delete('watch_history', { user_id: id });
    this.logger.log(`Deleted watch history for user ${id}`);

    // 4. Finally delete the user
    await this.supabaseClient.delete('users', { id });
    this.logger.log(`Deleted user ${id}`);

    return {
      message: 'User and all related data deleted successfully',
      id,
      deleted: ['user', 'purchases', 'favorites', 'watch_history']
    };
  }
}
