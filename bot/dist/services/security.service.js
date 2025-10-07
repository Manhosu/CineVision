"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class SecurityService {
    static generateHmacSignature(payload) {
        const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const signature = crypto_1.default
            .createHmac('sha256', this.WEBHOOK_SECRET)
            .update(payloadString)
            .digest('hex');
        return `sha256=${signature}`;
    }
    static verifyHmacSignature(signature, payload) {
        try {
            const expectedSignature = this.generateHmacSignature(payload);
            const receivedSignature = signature.startsWith('sha256=') ? signature : `sha256=${signature}`;
            return crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature));
        }
        catch (error) {
            console.error('Error verifying HMAC signature:', error);
            return false;
        }
    }
    static createAuthHeaders(payload) {
        const signature = this.generateHmacSignature(payload);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        return {
            'Content-Type': 'application/json',
            'X-Bot-Signature': signature,
            'X-Bot-Timestamp': timestamp,
            'User-Agent': 'CineVision-Bot/2.0'
        };
    }
    static validateTimestamp(timestamp) {
        const now = Math.floor(Date.now() / 1000);
        const requestTime = parseInt(timestamp, 10);
        const maxAge = 5 * 60;
        return Math.abs(now - requestTime) <= maxAge;
    }
    static async makeAuthenticatedRequest(method, url, data) {
        const axios = require('axios');
        const payload = data || '';
        const headers = this.createAuthHeaders(payload);
        try {
            const response = await axios({
                method,
                url,
                data,
                headers,
                timeout: 10000
            });
            return response.data;
        }
        catch (error) {
            console.error(`Authenticated request failed: ${method} ${url}`, {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });
            throw error;
        }
    }
}
exports.SecurityService = SecurityService;
SecurityService.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-secret';
//# sourceMappingURL=security.service.js.map