import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminSettingsService } from '../services/admin-settings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Admin - Settings')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  // PIX settings endpoints removed - using Woovi PIX instead

  @Get('whatsapp')
  @ApiOperation({ summary: 'Get WhatsApp group link setting' })
  @ApiResponse({ status: 200, description: 'WhatsApp link retrieved successfully' })
  async getWhatsappLink() {
    const settings = await this.settingsService.getAllSettings();
    return {
      whatsapp_group_link: settings['whatsapp_group_link'] || '',
    };
  }

  @Patch('whatsapp')
  @ApiOperation({ summary: 'Update WhatsApp group link setting' })
  @ApiResponse({ status: 200, description: 'WhatsApp link updated successfully' })
  async updateWhatsappLink(@Body() body: { whatsapp_group_link: string }) {
    // Use the internal updateSetting by going through a workaround:
    // We update via the same pattern as PIX settings
    const allSettings = await this.settingsService.getAllSettings();
    // Store the new value
    await this.settingsService.updateSettingByKey('whatsapp_group_link', body.whatsapp_group_link);
    return {
      whatsapp_group_link: body.whatsapp_group_link,
    };
  }
}
