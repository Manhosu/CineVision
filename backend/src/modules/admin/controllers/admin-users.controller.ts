import { Controller, Get, Put, Delete, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SupabaseService } from '../../../config/supabase.service';

@ApiTags('admin-users')
@Controller('admin/users')
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(private readonly supabaseService: SupabaseService) {}
  private get supabase() { return this.supabaseService.client; }

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

    let query = this.supabase
      .from('users')
      .select('id, telegram_id, telegram_username, telegram_chat_id, name, role, blocked, created_at', { count: 'exact' })
      .not('telegram_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (blocked === 'true') {
      query = query.eq('blocked', true);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`telegram_id.ilike.${term},telegram_username.ilike.${term},name.ilike.${term}`);
    }

    const { data: users, count, error } = await query;

    if (error) {
      this.logger.error('Error fetching users:', error.message);
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limitNum);

    return { users: users || [], total, page: pageNum, totalPages };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics (counts only, no data loaded)' })
  async getUserStats() {
    this.logger.log('Fetching user stats...');

    const [totalRes, adminRes, blockedRes] = await Promise.all([
      this.supabase.from('users').select('*', { count: 'exact', head: true }).not('telegram_id', 'is', null),
      this.supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      this.supabase.from('users').select('*', { count: 'exact', head: true }).eq('blocked', true),
    ]);

    return {
      totalUsers: totalRes.count || 0,
      totalAdmins: adminRes.count || 0,
      totalBlocked: blockedRes.count || 0,
      total: totalRes.count || 0, // alias for dashboard compatibility
    };
  }

  @Put(':id/block')
  @ApiOperation({ summary: 'Block a user' })
  async blockUser(@Param('id') id: string) {
    this.logger.log(`Blocking user ${id}...`);

    const { data, error } = await this.supabase
      .from('users')
      .update({ blocked: true })
      .eq('id', id)
      .select('id, name, telegram_id, telegram_username, blocked')
      .single();

    if (error) throw new Error(`Failed to block user: ${error.message}`);
    return { message: 'User blocked successfully', user: data };
  }

  @Put(':id/unblock')
  @ApiOperation({ summary: 'Unblock a user' })
  async unblockUser(@Param('id') id: string) {
    this.logger.log(`Unblocking user ${id}...`);

    const { data, error } = await this.supabase
      .from('users')
      .update({ blocked: false })
      .eq('id', id)
      .select('id, name, telegram_id, telegram_username, blocked')
      .single();

    if (error) throw new Error(`Failed to unblock user: ${error.message}`);
    return { message: 'User unblocked successfully', user: data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user permanently with all related data' })
  async deleteUser(@Param('id') id: string) {
    this.logger.log(`Deleting user ${id} and all related data...`);

    // Delete related data first
    await this.supabase.from('purchases').delete().eq('user_id', id);
    await this.supabase.from('users').delete().eq('id', id);
    this.logger.log(`Deleted user ${id} and related data`);

    return {
      message: 'User and all related data deleted successfully',
      id,
      deleted: ['user', 'purchases', 'favorites', 'watch_history'],
    };
  }
}
