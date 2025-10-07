import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminSettingsService } from '../../admin/services/admin-settings.service';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

export interface PixPaymentData {
  pixKey?: string;
  merchantName?: string;
  merchantCity?: string;
  amount: number; // in cents
  transactionId: string;
  description?: string;
}

export interface PixQRCodeResponse {
  qrCode: string; // Base64 image
  qrCodeText: string; // PIX copy-paste code
  expiresAt: Date;
  transactionId: string;
  amount: number;
}

@Injectable()
export class PixService {
  private readonly logger = new Logger(PixService.name);
  private readonly pixExpirationMinutes: number;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => AdminSettingsService))
    private adminSettingsService: AdminSettingsService,
  ) {
    this.pixExpirationMinutes = parseInt(this.configService.get('PIX_EXPIRATION_MINUTES', '30'));
    this.logger.log('PIX Service initialized');
  }

  /**
   * Get PIX settings from database or fallback to env
   */
  private async getPixSettings() {
    try {
      const settings = await this.adminSettingsService.getPixSettings();
      return {
        pixKey: settings.pix_key || this.configService.get('PIX_KEY'),
        merchantName: settings.merchant_name || this.configService.get('PIX_MERCHANT_NAME', 'Cine Vision'),
        merchantCity: settings.merchant_city || this.configService.get('PIX_MERCHANT_CITY', 'SAO PAULO'),
      };
    } catch (error) {
      // Fallback to env variables if database is not available
      return {
        pixKey: this.configService.get('PIX_KEY'),
        merchantName: this.configService.get('PIX_MERCHANT_NAME', 'Cine Vision'),
        merchantCity: this.configService.get('PIX_MERCHANT_CITY', 'SAO PAULO'),
      };
    }
  }

  /**
   * Generate PIX QR Code for payment
   */
  async generatePixQRCode(data: PixPaymentData): Promise<PixQRCodeResponse> {
    const settings = await this.getPixSettings();

    if (!settings.pixKey && !data.pixKey) {
      throw new BadRequestException('PIX payment not configured');
    }

    try {
      const transactionId = data.transactionId || this.generateTransactionId();
      const amountInReais = (data.amount / 100).toFixed(2);

      // Generate PIX EMV payload
      const pixPayload = this.generatePixPayload({
        pixKey: data.pixKey || settings.pixKey,
        merchantName: data.merchantName || settings.merchantName,
        merchantCity: data.merchantCity || settings.merchantCity,
        amount: amountInReais,
        transactionId,
        description: data.description,
      });

      // Generate QR Code image
      const qrCodeImage = await QRCode.toDataURL(pixPayload, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 400,
        margin: 1,
      });

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.pixExpirationMinutes);

      this.logger.log(`PIX QR Code generated for transaction ${transactionId}, amount: R$ ${amountInReais}`);

      return {
        qrCode: qrCodeImage,
        qrCodeText: pixPayload,
        expiresAt,
        transactionId,
        amount: data.amount,
      };
    } catch (error) {
      this.logger.error(`Failed to generate PIX QR Code: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to generate PIX QR Code: ${error.message}`);
    }
  }

  /**
   * Generate PIX EMV payload (BR Code standard)
   * Based on EMV QR Code Specification for Payment Systems
   */
  private generatePixPayload(data: {
    pixKey: string;
    merchantName: string;
    merchantCity: string;
    amount: string;
    transactionId: string;
    description?: string;
  }): string {
    // Format: ID + LENGTH + VALUE
    const format = (id: string, value: string): string => {
      const length = value.length.toString().padStart(2, '0');
      return `${id}${length}${value}`;
    };

    // Merchant Account Information (dynamic PIX key)
    const merchantAccountInfo = [
      format('00', 'BR.GOV.BCB.PIX'), // GUI (Globally Unique Identifier)
      format('01', data.pixKey), // PIX Key
    ].join('');

    // Build payload
    let payload = '';
    payload += format('00', '01'); // Payload Format Indicator
    payload += format('26', merchantAccountInfo); // Merchant Account Information
    payload += format('52', '0000'); // Merchant Category Code (0000 = not specified)
    payload += format('53', '986'); // Transaction Currency (986 = BRL)
    payload += format('54', data.amount); // Transaction Amount
    payload += format('58', 'BR'); // Country Code
    payload += format('59', this.sanitizeName(data.merchantName)); // Merchant Name
    payload += format('60', this.sanitizeName(data.merchantCity)); // Merchant City

    // Additional Data Field Template (Transaction ID)
    const additionalDataField = format('05', data.transactionId);
    payload += format('62', additionalDataField);

    // CRC16 checksum
    payload += '6304'; // CRC field ID + length
    const crc = this.crc16(payload);
    payload += crc;

    return payload;
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return crypto.randomBytes(16).toString('hex').substring(0, 25);
  }

  /**
   * Sanitize name for PIX payload (remove special characters, limit length)
   */
  private sanitizeName(name: string): string {
    return name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^A-Z0-9\s]/g, '') // Keep only alphanumeric and spaces
      .substring(0, 25); // Max 25 characters
  }

  /**
   * Calculate CRC16-CCITT checksum for PIX payload
   */
  private crc16(payload: string): string {
    const polynomial = 0x1021;
    let crc = 0xffff;

    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ polynomial : crc << 1;
      }
    }

    crc &= 0xffff;
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Verify if PIX payment is configured
   */
  async isConfigured(): Promise<boolean> {
    const settings = await this.getPixSettings();
    return !!settings.pixKey;
  }

  /**
   * Get PIX configuration status
   */
  async getConfigStatus(): Promise<{
    configured: boolean;
    pixKey?: string;
    merchantName?: string;
  }> {
    const settings = await this.getPixSettings();
    return {
      configured: !!settings.pixKey,
      pixKey: settings.pixKey ? this.maskPixKey(settings.pixKey) : undefined,
      merchantName: settings.merchantName,
    };
  }

  /**
   * Mask PIX key for security (show only first and last 4 characters)
   */
  private maskPixKey(key: string): string {
    if (key.length <= 8) return '***';
    return `${key.substring(0, 4)}***${key.substring(key.length - 4)}`;
  }
}
