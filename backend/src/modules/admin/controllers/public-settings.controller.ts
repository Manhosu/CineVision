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

  // N25 (Igor 07/06): popup de WhatsApp — lido publicamente pelo frontend
  // antes de exibir o popup. Se disabled, frontend não mostra o botão.
  @Get('whatsapp-popup')
  @ApiOperation({ summary: 'Get WhatsApp popup state (public, no auth)' })
  @ApiResponse({ status: 200, description: 'WhatsApp popup settings' })
  async getWhatsappPopup() {
    const settings = await this.settingsService.getAllSettings();
    return {
      enabled: settings['whatsapp_popup_enabled'] === 'true',
      link: settings['whatsapp_popup_link'] || settings['whatsapp_group_link'] || '',
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

  // Igor (14/06 noite): PIX manual — alguns bancos (Santander, Inter)
  // não aceitam o PIX gerado pelo provedor Azosfy. Cliente clica
  // "Não consegui pagar" no checkout, vê chave PIX direta + valor +
  // botão pra mandar comprovante no WhatsApp do Igor liberar manual.
  @Get('manual-pix')
  @ApiOperation({ summary: 'Get manual PIX fallback config (public, no auth)' })
  async getManualPix() {
    const settings = await this.settingsService.getAllSettings();
    return {
      enabled: (settings['manual_pix_enabled'] ?? 'true') === 'true',
      pix_key: settings['manual_pix_key'] || '',
      pix_key_label: settings['manual_pix_key_label'] || 'E-mail',
      whatsapp: (settings['manual_pix_whatsapp'] || '').replace(/\D/g, ''),
    };
  }
}
