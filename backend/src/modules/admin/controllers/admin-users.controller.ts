import { Controller, Get, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupabaseRestClient } from '../../../config/supabase-rest-client';

@ApiTags('admin-users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly supabaseClient: SupabaseRestClient) {}

  @Get()
  @ApiOperation({ summary: 'Get all users (Admin endpoint - no auth required)' })
  async getAllUsers() {
    const users = await this.supabaseClient.select('users', {
      select: 'id, email, role, created_at',
      order: { column: 'created_at', ascending: false }
    });
    return users;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user permanently' })
  async deleteUser(@Param('id') id: string) {
    await this.supabaseClient.delete('users', { id });
    return { message: 'User deleted successfully', id };
  }
}
