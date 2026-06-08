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

  // N25 (Igor 07/06): toggle on/off do popup de WhatsApp + link editável.
  // Igor precisou desativar quando número saiu do ar — antes exigia intervenção
  // do dev. Agora ele mesmo controla pelo painel.
  @Get('whatsapp-popup')
  @ApiOperation({ summary: 'Get WhatsApp popup settings (enabled + link)' })
  async getWhatsappPopup() {
    const settings = await this.settingsService.getAllSettings();
    return {
      whatsapp_popup_enabled: settings['whatsapp_popup_enabled'] === 'true',
      whatsapp_popup_link: settings['whatsapp_popup_link'] || settings['whatsapp_group_link'] || '',
    };
  }

  @Patch('whatsapp-popup')
  @ApiOperation({ summary: 'Update WhatsApp popup settings' })
  async updateWhatsappPopup(@Body() body: { whatsapp_popup_enabled?: boolean; whatsapp_popup_link?: string }) {
    if (body.whatsapp_popup_enabled !== undefined) {
      await this.settingsService.updateSettingByKey('whatsapp_popup_enabled', body.whatsapp_popup_enabled ? 'true' : 'false');
    }
    if (body.whatsapp_popup_link !== undefined) {
      await this.settingsService.updateSettingByKey('whatsapp_popup_link', body.whatsapp_popup_link);
    }
    const settings = await this.settingsService.getAllSettings();
    return {
      whatsapp_popup_enabled: settings['whatsapp_popup_enabled'] === 'true',
      whatsapp_popup_link: settings['whatsapp_popup_link'] || '',
    };
  }

  // Igor (21/05): banner editável que aparece no preview de link da HOME
  // ao compartilhar cinevisionapp.com.br no WhatsApp/Facebook (og:image).
  @Patch('homepage-banner')
  @ApiOperation({ summary: 'Update homepage Open Graph banner (link preview image)' })
  @ApiResponse({ status: 200, description: 'Homepage banner updated successfully' })
  async updateHomepageBanner(@Body() body: { url: string }) {
    await this.settingsService.updateSettingByKey('homepage_og_image_url', body.url || '');
    return { url: body.url || '' };
  }
}
