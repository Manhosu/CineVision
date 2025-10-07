import crypto from 'crypto';

export class SecurityService {
  private static readonly WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-secret';

  /**
   * Generate HMAC signature for bot -> backend communication
   */
  static generateHmacSignature(payload: any): string {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.WEBHOOK_SECRET)
      .update(payloadString)
      .digest('hex');
    
    return `sha256=${signature}`;
  }

  /**
   * Verify HMAC signature from backend -> bot communication
   */
  static verifyHmacSignature(signature: string, payload: any): boolean {
    try {
      const expectedSignature = this.generateHmacSignature(payload);
      const receivedSignature = signature.startsWith('sha256=') ? signature : `sha256=${signature}`;
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(receivedSignature)
      );
    } catch (error) {
      console.error('Error verifying HMAC signature:', error);
      return false;
    }
  }

  /**
   * Create authenticated request headers for bot -> backend calls
   */
  static createAuthHeaders(payload: any): Record<string, string> {
    const signature = this.generateHmacSignature(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    return {
      'Content-Type': 'application/json',
      'X-Bot-Signature': signature,
      'X-Bot-Timestamp': timestamp,
      'User-Agent': 'CineVision-Bot/2.0'
    };
  }

  /**
   * Validate timestamp to prevent replay attacks (5 minute window)
   */
  static validateTimestamp(timestamp: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    const maxAge = 5 * 60; // 5 minutes
    
    return Math.abs(now - requestTime) <= maxAge;
  }

  /**
   * Create secure request to backend with HMAC authentication
   */
  static async makeAuthenticatedRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any
  ): Promise<any> {
    const axios = require('axios');
    const payload = data || '';
    const headers = this.createAuthHeaders(payload);

    try {
      const response = await axios({
        method,
        url,
        data,
        headers,
        timeout: 10000 // 10 second timeout
      });

      return response.data;
    } catch (error: any) {
      console.error(`Authenticated request failed: ${method} ${url}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw error;
    }
  }
}