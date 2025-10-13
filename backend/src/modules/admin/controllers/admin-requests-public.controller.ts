import { Controller, Get, Put, Delete, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupabaseRestClient } from '../../../config/supabase-rest-client';

@ApiTags('admin-requests-public')
@Controller('admin/requests')
export class AdminRequestsPublicController {
  constructor(private readonly supabaseClient: SupabaseRestClient) {}

  @Post()
  @ApiOperation({ summary: 'Create a new content request' })
  async createRequest(@Body() body: {
    requested_title: string;
    description?: string;
    user_id?: string;
    priority?: string;
  }) {
    const requestData: any = {
      requested_title: body.requested_title,
      description: body.description || null,
      user_id: body.user_id || null,
      priority: body.priority || 'medium',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await this.supabaseClient.insert('content_requests', requestData);
    return result[0];
  }

  @Get()
  @ApiOperation({ summary: 'Get all content requests (Admin endpoint - no auth required)' })
  async getAllRequests(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('status') status?: string,
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    try {
      // Fetch all requests
      const allRequests = await this.supabaseClient.select('content_requests', {
        select: 'id, requested_title, description, status, priority, user_id, admin_notes, created_at, updated_at',
        order: { column: 'created_at', ascending: false },
      });

      // Filter by status if provided
      let filteredRequests = allRequests;
      if (status) {
        filteredRequests = allRequests.filter((r: any) => r.status === status);
      }

      // Paginate
      const paginatedRequests = filteredRequests.slice(offset, offset + limitNum);

      return {
        data: paginatedRequests,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filteredRequests.length,
          totalPages: Math.ceil(filteredRequests.length / limitNum),
        },
      };
    } catch (error) {
      console.error('Error fetching requests:', error);
      throw error;
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get request statistics' })
  async getStats() {
    try {
      const allRequests = await this.supabaseClient.select('content_requests', {
        select: 'id, status',
      });

      const stats = {
        total: allRequests.length,
        pending: allRequests.filter((r: any) => r.status === 'pending').length,
        approved: allRequests.filter((r: any) => r.status === 'approved').length,
        rejected: allRequests.filter((r: any) => r.status === 'rejected').length,
        in_progress: allRequests.filter((r: any) => r.status === 'in_progress').length,
      };

      return stats;
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get content request by ID' })
  async getRequest(@Param('id') id: string) {
    const allRequests = await this.supabaseClient.select('content_requests', {
      select: '*',
    });

    const request = allRequests.find((r: any) => r.id === id);

    if (!request) {
      throw new Error('Request not found');
    }

    return request;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update content request' })
  async updateRequest(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('admin_notes') adminNotes?: string,
  ) {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
    }

    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    await this.supabaseClient.update('content_requests', updateData, { id });

    return { message: 'Request updated successfully', id };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete content request' })
  async deleteRequest(@Param('id') id: string) {
    await this.supabaseClient.delete('content_requests', { id });
    return { message: 'Request deleted successfully', id };
  }
}
