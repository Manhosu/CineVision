export interface PixPaymentResult {
  paymentId: string;
  status: string;
  qrCode: string;
  qrCodeBase64?: string;
  expiresAt?: Date;
  amount: number;
}

export interface PixPaymentStatus {
  status: 'pending' | 'approved' | 'cancelled' | 'expired';
  paidAt?: Date;
}

export interface PixProvider {
  createPixPayment(options: {
    amount: number;
    description: string;
    email?: string;
    externalId?: string;
    metadata?: Record<string, string>;
  }): Promise<PixPaymentResult>;

  getPaymentStatus(paymentId: string): Promise<PixPaymentStatus>;

  verifyWebhookSignature(payload: string, signature: string): boolean;

  getProviderName(): string;
}
