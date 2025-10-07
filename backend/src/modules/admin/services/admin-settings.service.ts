import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminSettings } from '../entities/admin-settings.entity';
import { UpdatePixSettingsDto, AdminSettingsResponseDto } from '../dto/admin-settings.dto';

@Injectable()
export class AdminSettingsService {
  constructor(
    @InjectRepository(AdminSettings)
    private readonly settingsRepository: Repository<AdminSettings>,
  ) {}

  /**
   * Get PIX payment settings
   */
  async getPixSettings(): Promise<AdminSettingsResponseDto> {
    const pixKey = await this.getSetting('pix_key');
    const merchantName = await this.getSetting('pix_merchant_name');
    const merchantCity = await this.getSetting('pix_merchant_city');

    return {
      pix_key: pixKey?.setting_value || '',
      merchant_name: merchantName?.setting_value || 'Cine Vision',
      merchant_city: merchantCity?.setting_value || 'SAO PAULO',
      updated_at: pixKey?.updated_at || new Date(),
    };
  }

  /**
   * Update PIX payment settings
   */
  async updatePixSettings(dto: UpdatePixSettingsDto): Promise<AdminSettingsResponseDto> {
    await this.updateSetting('pix_key', dto.pix_key);

    if (dto.merchant_name) {
      await this.updateSetting('pix_merchant_name', dto.merchant_name);
    }

    if (dto.merchant_city) {
      await this.updateSetting('pix_merchant_city', dto.merchant_city);
    }

    return this.getPixSettings();
  }

  /**
   * Get a single setting by key
   */
  private async getSetting(key: string): Promise<AdminSettings | null> {
    return await this.settingsRepository.findOne({
      where: { setting_key: key },
    });
  }

  /**
   * Update or create a setting
   */
  private async updateSetting(key: string, value: string): Promise<AdminSettings> {
    let setting = await this.getSetting(key);

    if (setting) {
      setting.setting_value = value;
      setting.updated_at = new Date();
    } else {
      setting = this.settingsRepository.create({
        setting_key: key,
        setting_value: value,
      });
    }

    return await this.settingsRepository.save(setting);
  }

  /**
   * Get all settings as key-value map
   */
  async getAllSettings(): Promise<Record<string, string>> {
    const settings = await this.settingsRepository.find();

    const result: Record<string, string> = {};
    for (const setting of settings) {
      result[setting.setting_key] = setting.setting_value;
    }

    return result;
  }
}
