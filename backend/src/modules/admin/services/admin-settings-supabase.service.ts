import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { UpdatePixSettingsDto, AdminSettingsResponseDto } from '../dto/admin-settings.dto';

@Injectable()
export class AdminSettingsSupabaseService {
  private readonly logger = new Logger(AdminSettingsSupabaseService.name);

  constructor(private readonly supabaseService: SupabaseService) {
    this.logger.log('AdminSettingsSupabaseService initialized (Supabase mode)');
  }

  /**
   * Get PIX payment settings
   */
  async getPixSettings(): Promise<AdminSettingsResponseDto> {
    const pixKey = await this.getSetting('pix_key');
    const merchantName = await this.getSetting('merchant_name');
    const merchantCity = await this.getSetting('merchant_city');

    return {
      pix_key: pixKey?.value || '',
      merchant_name: merchantName?.value || 'Cine Vision',
      merchant_city: merchantCity?.value || 'SAO PAULO',
      updated_at: pixKey?.updated_at ? new Date(pixKey.updated_at) : new Date(),
    };
  }

  /**
   * Update PIX payment settings
   */
  async updatePixSettings(dto: UpdatePixSettingsDto): Promise<AdminSettingsResponseDto> {
    await this.updateSetting('pix_key', dto.pix_key);

    if (dto.merchant_name) {
      await this.updateSetting('merchant_name', dto.merchant_name);
    }

    if (dto.merchant_city) {
      await this.updateSetting('merchant_city', dto.merchant_city);
    }

    return this.getPixSettings();
  }

  /**
   * Get a single setting by key
   */
  private async getSetting(key: string): Promise<any | null> {
    const { data, error } = await this.supabaseService.client
      .from('admin_settings')
      .select('*')
      .eq('key', key)
      .single();

    if (error) {
      this.logger.warn(`Setting ${key} not found:`, error.message);
      return null;
    }

    return data;
  }

  /**
   * Update or create a setting
   */
  private async updateSetting(key: string, value: string): Promise<any> {
    const existing = await this.getSetting(key);

    if (existing) {
      // Update existing setting
      const { data, error } = await this.supabaseService.client
        .from('admin_settings')
        .update({
          value: value,
          updated_at: new Date().toISOString(),
        })
        .eq('key', key)
        .select()
        .single();

      if (error) {
        this.logger.error(`Error updating setting ${key}:`, error);
        throw error;
      }

      return data;
    } else {
      // Create new setting
      const { data, error } = await this.supabaseService.client
        .from('admin_settings')
        .insert({
          key: key,
          value: value,
        })
        .select()
        .single();

      if (error) {
        this.logger.error(`Error creating setting ${key}:`, error);
        throw error;
      }

      return data;
    }
  }

  /**
   * Get all settings as key-value map
   */
  async getAllSettings(): Promise<Record<string, string>> {
    const { data: settings, error } = await this.supabaseService.client
      .from('admin_settings')
      .select('*');

    if (error) {
      this.logger.error('Error fetching all settings:', error);
      throw error;
    }

    const result: Record<string, string> = {};
    for (const setting of settings || []) {
      result[setting.key] = setting.value;
    }

    return result;
  }
}
