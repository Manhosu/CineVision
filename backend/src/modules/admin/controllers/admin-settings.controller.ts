import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminSettingsService } from '../services/admin-settings.service';
import { UpdatePixSettingsDto, AdminSettingsResponseDto } from '../dto/admin-settings.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Admin - Settings')
@ApiBearerAuth()
@Controller('api/v1/admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get('pix')
  @ApiOperation({ summary: 'Get PIX payment settings' })
  @ApiResponse({
    status: 200,
    description: 'PIX settings retrieved successfully',
    type: AdminSettingsResponseDto,
  })
  async getPixSettings(): Promise<AdminSettingsResponseDto> {
    return await this.settingsService.getPixSettings();
  }

  @Put('pix')
  @ApiOperation({ summary: 'Update PIX payment settings' })
  @ApiResponse({
    status: 200,
    description: 'PIX settings updated successfully',
    type: AdminSettingsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid PIX key format',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  async updatePixSettings(
    @Body() dto: UpdatePixSettingsDto,
  ): Promise<AdminSettingsResponseDto> {
    return await this.settingsService.updatePixSettings(dto);
  }
}
