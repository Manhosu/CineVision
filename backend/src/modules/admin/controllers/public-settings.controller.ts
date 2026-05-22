import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminSettingsService } from '../services/admin-settings.service';

@ApiTags('Public Settings')
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get('whatsapp-link')
  @ApiOperation({ summary: 'Get WhatsApp group link (public, no auth)' })
  @ApiResponse({ status: 200, description: 'WhatsApp link retrieved successfully' })
  async getWhatsappLink() {
    const settings = await this.settingsService.getAllSettings();
    return {
      whatsapp_group_link: settings['whatsapp_group_link'] || 'https://chat.whatsapp.com/PLACEHOLDER',
    };
  }

  // Igor (21/05): banner OG da home — lido publicamente pelo generateMetadata
  // do layout (server-side, sem auth) pra montar a og:image do link principal.
  @Get('homepage-banner')
  @ApiOperation({ summary: 'Get homepage OG banner URL (public, no auth)' })
  @ApiResponse({ status: 200, description: 'Homepage banner retrieved successfully' })
  async getHomepageBanner() {
    const settings = await this.settingsService.getAllSettings();
    return { url: settings['homepage_og_image_url'] || '' };
  }
}
