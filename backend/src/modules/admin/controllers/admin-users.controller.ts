import { Controller, Get, Put, Delete, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SupabaseRestClient } from '../../../config/supabase-rest-client';

@ApiTags('admin-users')
@Controller('admin/users')
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(private readonly supabaseClient: SupabaseRestClient) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated users with search and filter' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 50)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by telegram_id, telegram_username, or name' })
  @ApiQuery({ name: 'blocked', required: false, description: 'Filter blocked users only (true)' })
  async getUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
    @Query('blocked') blocked?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    this.logger.log(`Fetching users page=${pageNum} limit=${limitNum} search=${search || ''} blocked=${blocked || ''}`);

    // Build query options
    const queryOptions: any = {
      select: 'id, telegram_id, telegram_username, telegram_chat_id, name, role, blocked, created_at',
      order: { column: 'created_at', ascending: false },
      limit: limitNum,
      offset: offset,
      where: {} as Record<string, any>,
    };

    // Filter: only users with telegram_id
    queryOptions.rawFilters = {
      telegram_id: 'not.is.null',
    };

    // Filter: blocked users
    if (blocked === 'true') {
      queryOptions.where.blocked = true;
    }

    // Search: use PostgREST OR syntax across multiple fields
    if (search && search.trim()) {
      const term = search.trim();
      // PostgREST or syntax: or=(field1.ilike.*term*,field2.ilike.*term*,field3.ilike.*term*)
      queryOptions.or = `(telegram_id.ilike.*${term}*,telegram_username.ilike.*${term}*,name.ilike.*${term}*)`;
    }

    const { data: users, count: total } = await this.supabaseClient.selectWithCount('users', queryOptions);

    const totalPages = Math.ceil(total / limitNum);

    this.logger.log(`Found ${total} users total, returning page ${pageNum}/${totalPages} (${users.length} items)`);

    return {
      users,
      total,
      page: pageNum,
      totalPages,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics (counts only, no data loaded)' })
  async getUserStats() {
    this.logger.log('Fetching user stats...');

    // Run all count queries in parallel - no data is loaded
    const [totalUsers, totalAdmins, totalBlocked] = await Promise.all([
      this.supabaseClient.count('users', { telegram_id: { ilike: '*' } }),
      this.supabaseClient.count('users', { role: 'admin' }),
      this.supabaseClient.count('users', { blocked: true }),
    ]);

    this.logger.log(`Stats: total=${totalUsers} admins=${totalAdmins} blocked=${totalBlocked}`);

    return {
      totalUsers,
      totalAdmins,
      totalBlocked,
    };
  }

  @Put(':id/block')
  @ApiOperation({ summary: 'Block a user' })
  async blockUser(@Param('id') id: string) {
    this.logger.log(`Blocking user ${id}...`);

    const result = await this.supabaseClient.update(
      'users',
      { blocked: true },
      { id },
      { returning: 'id, name, telegram_id, telegram_username, blocked' },
    );

    this.logger.log(`User ${id} blocked successfully`);

    return {
      message: 'User blocked successfully',
      user: result[0] || null,
    };
  }

  @Put(':id/unblock')
  @ApiOperation({ summary: 'Unblock a user' })
  async unblockUser(@Param('id') id: string) {
    this.logger.log(`Unblocking user ${id}...`);

    const result = await this.supabaseClient.update(
      'users',
      { blocked: false },
      { id },
      { returning: 'id, name, telegram_id, telegram_username, blocked' },
    );

    this.logger.log(`User ${id} unblocked successfully`);

    return {
      message: 'User unblocked successfully',
      user: result[0] || null,
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
      deleted: ['user', 'purchases', 'favorites', 'watch_history'],
    };
  }
}
