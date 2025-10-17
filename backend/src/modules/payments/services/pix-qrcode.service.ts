import { Injectable, Logger } from '@nestjs/common';
import { crc16ccitt } from 'crc';

export interface PixQRCodeData {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  transactionId: string;
  description?: string;
}

export interface GeneratedPixQRCode {
  qrCodeText: string; // EMV payload
  qrCodeBase64?: string; // QR Code image in base64
  copyPasteCode: string; // Same as qrCodeText for copy-paste
}

/**
 * Service for generating PIX QR Codes following EMV standard
 * Based on: https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II-ManualdePadroesparaIniciacaodoPix.pdf
 */
@Injectable()
export class PixQRCodeService {
  private readonly logger = new Logger(PixQRCodeService.name);

  // EMV IDs
  private readonly ID_PAYLOAD_FORMAT_INDICATOR = '00';
  private readonly ID_MERCHANT_ACCOUNT_INFORMATION = '26';
  private readonly ID_MERCHANT_CATEGORY_CODE = '52';
  private readonly ID_TRANSACTION_CURRENCY = '53';
  private readonly ID_TRANSACTION_AMOUNT = '54';
  private readonly ID_COUNTRY_CODE = '58';
  private readonly ID_MERCHANT_NAME = '59';
  private readonly ID_MERCHANT_CITY = '60';
  private readonly ID_ADDITIONAL_DATA_FIELD_TEMPLATE = '62';
  private readonly ID_CRC16 = '63';

  // PIX GUI
  private readonly GUI_PIX = '0014br.gov.bcb.pix';

  /**
   * Generate PIX QR Code in EMV format
   */
  generatePixQRCode(data: PixQRCodeData): GeneratedPixQRCode {
    this.logger.log(`Generating PIX QR Code for transaction ${data.transactionId}`);

    try {
      // Build EMV payload
      let payload = '';

      // 00: Payload Format Indicator
      payload += this.buildTLV(this.ID_PAYLOAD_FORMAT_INDICATOR, '01');

      // 26: Merchant Account Information (PIX)
      const merchantAccountInfo = this.buildPixAccountInfo(data.pixKey);
      payload += this.buildTLV(this.ID_MERCHANT_ACCOUNT_INFORMATION, merchantAccountInfo);

      // 52: Merchant Category Code (0000 for PIX)
      payload += this.buildTLV(this.ID_MERCHANT_CATEGORY_CODE, '0000');

      // 53: Transaction Currency (986 = BRL)
      payload += this.buildTLV(this.ID_TRANSACTION_CURRENCY, '986');

      // 54: Transaction Amount (if specified)
      if (data.amount && data.amount > 0) {
        const amountStr = data.amount.toFixed(2);
        payload += this.buildTLV(this.ID_TRANSACTION_AMOUNT, amountStr);
      }

      // 58: Country Code (BR)
      payload += this.buildTLV(this.ID_COUNTRY_CODE, 'BR');

      // 59: Merchant Name (max 25 chars, uppercase, no special chars)
      const sanitizedName = this.sanitizeMerchantName(data.merchantName);
      payload += this.buildTLV(this.ID_MERCHANT_NAME, sanitizedName);

      // 60: Merchant City (max 15 chars, uppercase, no special chars)
      const sanitizedCity = this.sanitizeMerchantCity(data.merchantCity);
      payload += this.buildTLV(this.ID_MERCHANT_CITY, sanitizedCity);

      // 62: Additional Data Field Template
      const additionalData = this.buildAdditionalData(data.transactionId, data.description);
      payload += this.buildTLV(this.ID_ADDITIONAL_DATA_FIELD_TEMPLATE, additionalData);

      // 63: CRC16 (calculated over the entire payload + ID_CRC16 + '04')
      const crc = this.calculateCRC16(payload + this.ID_CRC16 + '04');
      payload += this.buildTLV(this.ID_CRC16, crc);

      this.logger.log(`PIX QR Code generated successfully: ${payload.substring(0, 50)}...`);

      return {
        qrCodeText: payload,
        copyPasteCode: payload,
      };
    } catch (error) {
      this.logger.error(`Error generating PIX QR Code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build PIX account information (tag 26)
   */
  private buildPixAccountInfo(pixKey: string): string {
    // Tag 00: GUI (br.gov.bcb.pix)
    let accountInfo = this.buildTLV('00', 'br.gov.bcb.pix');

    // Tag 01: PIX Key
    accountInfo += this.buildTLV('01', pixKey);

    return accountInfo;
  }

  /**
   * Build additional data field template (tag 62)
   */
  private buildAdditionalData(transactionId: string, description?: string): string {
    let additionalData = '';

    // Tag 05: Reference Label (Transaction ID)
    if (transactionId) {
      // Sanitize transaction ID (max 25 chars, alphanumeric only)
      const sanitizedTxId = transactionId.substring(0, 25).replace(/[^a-zA-Z0-9]/g, '');
      additionalData += this.buildTLV('05', sanitizedTxId);
    }

    // Tag 08: Purpose of payment (optional)
    if (description) {
      const sanitizedDesc = description.substring(0, 72);
      additionalData += this.buildTLV('08', sanitizedDesc);
    }

    return additionalData;
  }

  /**
   * Build TLV (Tag-Length-Value) format
   */
  private buildTLV(tag: string, value: string): string {
    const length = value.length.toString().padStart(2, '0');
    return tag + length + value;
  }

  /**
   * Calculate CRC16-CCITT
   */
  private calculateCRC16(payload: string): string {
    const buffer = Buffer.from(payload, 'utf8');
    const crcValue = crc16ccitt(buffer);
    return crcValue.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Sanitize merchant name (remove special chars, uppercase, max 25 chars)
   */
  private sanitizeMerchantName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '') // Only letters, numbers and spaces
      .substring(0, 25)
      .trim();
  }

  /**
   * Sanitize merchant city (remove special chars, uppercase, max 15 chars)
   */
  private sanitizeMerchantCity(city: string): string {
    return city
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '') // Only letters, numbers and spaces
      .substring(0, 15)
      .trim();
  }

  /**
   * Validate PIX key format
   */
  validatePixKey(pixKey: string): { valid: boolean; type?: string; error?: string } {
    if (!pixKey || pixKey.trim().length === 0) {
      return { valid: false, error: 'PIX key cannot be empty' };
    }

    const key = pixKey.trim();

    // CPF (11 digits)
    if (/^\d{11}$/.test(key)) {
      return { valid: true, type: 'CPF' };
    }

    // CNPJ (14 digits)
    if (/^\d{14}$/.test(key)) {
      return { valid: true, type: 'CNPJ' };
    }

    // Phone (+5511999999999)
    if (/^\+55\d{10,11}$/.test(key)) {
      return { valid: true, type: 'PHONE' };
    }

    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
      return { valid: true, type: 'EMAIL' };
    }

    // Random key (UUID format)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
      return { valid: true, type: 'RANDOM' };
    }

    return { valid: false, error: 'Invalid PIX key format' };
  }

  /**
   * Generate QR Code image as base64 (requires qrcode library)
   */
  async generateQRCodeImage(emvPayload: string): Promise<string> {
    try {
      // Dynamically import qrcode to avoid adding it as a hard dependency
      const QRCode = await import('qrcode');

      const qrCodeDataUrl = await QRCode.toDataURL(emvPayload, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 512,
        margin: 1,
      });

      // Remove the data:image/png;base64, prefix
      return qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
    } catch (error) {
      this.logger.warn('QRCode library not available, returning text only');
      throw new Error('QRCode image generation requires "qrcode" package');
    }
  }
}
