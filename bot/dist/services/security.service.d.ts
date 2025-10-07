export declare class SecurityService {
    private static readonly WEBHOOK_SECRET;
    static generateHmacSignature(payload: any): string;
    static verifyHmacSignature(signature: string, payload: any): boolean;
    static createAuthHeaders(payload: any): Record<string, string>;
    static validateTimestamp(timestamp: string): boolean;
    static makeAuthenticatedRequest(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, data?: any): Promise<any>;
}
//# sourceMappingURL=security.service.d.ts.map