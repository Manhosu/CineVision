import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  ContentEditRequestsService,
  EditRequestStatus,
} from './content-edit-requests.service';

@ApiTags('admin-content-edit-requests')
@ApiBearerAuth()
@Controller()
export class ContentEditRequestsController {
  constructor(private readonly service: ContentEditRequestsService) {}

  // ----------------- Admin (master) endpoints -----------------
  @Get('admin/content-edit-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'List edit requests (filter by status)' })
  async list(@Query('status') status?: EditRequestStatus) {
    return this.service.list(status);
  }

  @Get('admin/content-edit-requests/pending-count')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Count pending edit requests (badge)' })
  async pendingCount() {
    return { count: await this.service.countPending() };
  }

  @Get('admin/content-edit-requests/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Get edit request by id (with diff)' })
  async getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post('admin/content-edit-requests/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Approve edit request and apply changes' })
  async approve(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @GetUser() user: any,
  ) {
    return this.service.approve(id, user.sub || user.id, body?.notes);
  }

  @Post('admin/content-edit-requests/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Reject edit request with optional reason' })
  async reject(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @GetUser() user: any,
  ) {
    return this.service.reject(id, user.sub || user.id, body?.notes);
  }

  // ----------------- Employee endpoint: list own requests -----------------
  @Get('admin/content-edit-requests/me/list')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Employee lists their own edit requests' })
  async listMine(@GetUser() user: any) {
    return this.service.listByEmployee(user.sub || user.id);
  }
}
