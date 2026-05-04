import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminPeopleService, PhotoStatus } from '../services/admin-people.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('admin-people')
@Controller('admin/people')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminPeopleController {
  constructor(private readonly peopleService: AdminPeopleService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List people (filterable by photo_status)' })
  async findAll(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('photo_status') photoStatus?: PhotoStatus,
  ) {
    return this.peopleService.findAll(search, role, photoStatus || 'all');
  }

  @Get('photos/pending')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List people with photos pending admin approval' })
  async listPending() {
    return this.peopleService.listPendingPhotos();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get person by ID' })
  async findById(@Param('id') id: string) {
    return this.peopleService.findById(id);
  }

  @Get(':id/with-content')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get person with linked content' })
  async findByIdWithContent(@Param('id') id: string) {
    return this.peopleService.findByIdWithContent(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a person (admin only)' })
  async create(
    @Body() data: { name: string; role?: string; photo_url?: string; bio?: string },
  ) {
    return this.peopleService.create(data);
  }

  @Post('find-or-create')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Find existing person or create new' })
  async findOrCreate(@Body() data: { name: string; role?: string }) {
    return this.peopleService.findOrCreate(data.name, data.role || 'actor');
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a person (admin only)' })
  async update(
    @Param('id') id: string,
    @Body() data: { name?: string; photo_url?: string; bio?: string; role?: string },
  ) {
    return this.peopleService.update(id, data);
  }

  // -----------------------------------------------------------------------
  // IMG_8846 — Photo workflow
  // -----------------------------------------------------------------------

  @Post(':id/photo')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Submit a photo for a person',
    description:
      'Admin: persiste direto em photo_url. Employee com can_add_people_photos: vai para photo_pending_url até aprovação.',
  })
  async submitPhoto(
    @Param('id') id: string,
    @Body() body: { photo_url: string },
    @GetUser() user: any,
  ) {
    const isAdmin = user?.role === UserRole.ADMIN;
    if (!isAdmin && user?.role !== UserRole.EMPLOYEE) {
      throw new ForbiddenException('Sem permissão para enviar fotos');
    }
    return this.peopleService.submitPhoto(id, body.photo_url, user.sub, isAdmin);
  }

  @Post(':id/photo/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending photo' })
  async approvePhoto(@Param('id') id: string, @GetUser() user: any) {
    return this.peopleService.approvePendingPhoto(id, user.sub);
  }

  @Post(':id/photo/reject')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending photo' })
  async rejectPhoto(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @GetUser() user: any,
  ) {
    return this.peopleService.rejectPendingPhoto(id, user.sub, body?.reason);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a person (admin only)' })
  async delete(@Param('id') id: string) {
    return this.peopleService.delete(id);
  }
}
