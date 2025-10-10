import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import {
//   SecretsManagerClient,
//   GetSecretValueCommand
// } from '@aws-sdk/client-secrets-manager';
import * as crypto from 'crypto';

export interface SignedUrlOptions {
  url: string;
  expiresIn?: number; // seconds, default 3600
}

export interface SignedCookieOptions {
  resourcePath: string; // e.g., "videos/*"
  expiresIn?: number;
}

@Injectable()
export class CloudFrontSignerService {
  private readonly logger = new Logger(CloudFrontSignerService.name);
  // private readonly secretsClient: SecretsManagerClient;
  private readonly cloudfrontDomain: string;
  private readonly keyPairId: string;
  private readonly privateKeySecretArn: string;
  private readonly defaultTTL: number;
  private privateKey: string | null = null;

  constructor(private configService: ConfigService) {
    // this.secretsClient = new SecretsManagerClient({
    //   region: this.configService.get('AWS_REGION', 'us-east-1'),
    //   credentials: {
    //     accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID')!,
    //     secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY')!,
    //   },
    // });

    this.cloudfrontDomain = this.configService.get('CLOUDFRONT_DOMAIN')!;
    this.keyPairId = this.configService.get('CLOUDFRONT_PUBLIC_KEY_ID')!;
    this.privateKeySecretArn = this.configService.get('CLOUDFRONT_PRIVATE_KEY_SECRET_ARN')!;
    this.defaultTTL = parseInt(
      this.configService.get('CLOUDFRONT_URL_TTL_SECONDS', '3600')
    );

    if (!this.cloudfrontDomain || !this.keyPairId || !this.privateKeySecretArn) {
      this.logger.warn('CloudFront configuration missing. Signed URLs will not work.');
    }
  }

  /**
   * Load private key from AWS Secrets Manager
   */
  private async loadPrivateKey(): Promise<string> {
    if (this.privateKey) {
      return this.privateKey;
    }

    try {
      // const command = new GetSecretValueCommand({
      //   SecretId: this.privateKeySecretArn,
      // });

      // const response = await this.secretsClient.send(command);
      const response: any = {};

      if (!response.SecretString) {
        throw new Error('Private key not found in secret');
      }

      // Secret pode estar em JSON ou texto puro
      try {
        const secret = JSON.parse(response.SecretString);
        this.privateKey = secret.private_key || secret.privateKey || response.SecretString;
      } catch {
        this.privateKey = response.SecretString;
      }

      this.logger.log('Private key loaded successfully from Secrets Manager');
      return this.privateKey;
    } catch (error) {
      this.logger.error('Failed to load private key:', error);
      throw new Error('Could not load CloudFront private key');
    }
  }

  /**
   * Generate CloudFront Signed URL
   * @param options URL and expiration options
   * @returns Signed URL
   */
  async generateSignedUrl(options: SignedUrlOptions): Promise<string> {
    const { url, expiresIn = this.defaultTTL } = options;

    // Load private key if not loaded
    const privateKey = await this.loadPrivateKey();

    // Parse URL to get path
    const urlObj = new URL(url);
    const resourcePath = urlObj.pathname + urlObj.search;

    // Calculate expiration timestamp
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    // Create policy
    const policy = this.createPolicy(url, expiresAt);

    // Sign policy
    const signature = this.signPolicy(policy, privateKey);

    // Build signed URL
    const separator = url.includes('?') ? '&' : '?';
    const signedUrl = `${url}${separator}Expires=${expiresAt}&Signature=${signature}&Key-Pair-Id=${this.keyPairId}`;

    this.logger.log(`Generated signed URL for: ${resourcePath} (expires in ${expiresIn}s)`);
    return signedUrl;
  }

  /**
   * Generate CloudFront Signed URL for HLS master playlist
   */
  async generateHLSSignedUrl(
    hlsPath: string,
    expiresIn: number = this.defaultTTL
  ): Promise<string> {
    const url = `https://${this.cloudfrontDomain}/${hlsPath}`;
    return this.generateSignedUrl({ url, expiresIn });
  }

  /**
   * Generate Signed URLs for all HLS variants
   */
  async generateHLSSignedUrls(
    hlsBasePath: string,
    variants: string[] = ['master.m3u8'],
    expiresIn: number = this.defaultTTL
  ): Promise<Record<string, string>> {
    const signedUrls: Record<string, string> = {};

    for (const variant of variants) {
      const path = `${hlsBasePath}/${variant}`;
      const url = `https://${this.cloudfrontDomain}/${path}`;
      signedUrls[variant] = await this.generateSignedUrl({ url, expiresIn });
    }

    return signedUrls;
  }

  /**
   * Generate Signed Cookies (para proteger todo um diretório)
   */
  async generateSignedCookies(
    options: SignedCookieOptions
  ): Promise<{
    'CloudFront-Policy': string;
    'CloudFront-Signature': string;
    'CloudFront-Key-Pair-Id': string;
  }> {
    const { resourcePath, expiresIn = this.defaultTTL } = options;

    const privateKey = await this.loadPrivateKey();
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    const url = `https://${this.cloudfrontDomain}/${resourcePath}`;
    const policy = this.createPolicy(url, expiresAt);
    const signature = this.signPolicy(policy, privateKey);

    const policyBase64 = this.urlSafeBase64(Buffer.from(policy));

    return {
      'CloudFront-Policy': policyBase64,
      'CloudFront-Signature': signature,
      'CloudFront-Key-Pair-Id': this.keyPairId,
    };
  }

  /**
   * Create CloudFront policy
   */
  private createPolicy(url: string, expiresAt: number): string {
    const policy = {
      Statement: [
        {
          Resource: url,
          Condition: {
            DateLessThan: {
              'AWS:EpochTime': expiresAt,
            },
          },
        },
      ],
    };

    return JSON.stringify(policy);
  }

  /**
   * Sign policy with RSA-SHA1
   */
  private signPolicy(policy: string, privateKey: string): string {
    const sign = crypto.createSign('RSA-SHA1');
    sign.update(policy);

    const signature = sign.sign(privateKey, 'base64');
    return this.urlSafeBase64(Buffer.from(signature, 'base64'));
  }

  /**
   * URL-safe Base64 encoding
   */
  private urlSafeBase64(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/=/g, '_')
      .replace(/\//g, '~');
  }

  /**
   * Get CloudFront domain
   */
  getCloudFrontDomain(): string {
    return this.cloudfrontDomain;
  }

  /**
   * Check if CloudFront is configured
   */
  isConfigured(): boolean {
    return !!(this.cloudfrontDomain && this.keyPairId && this.privateKeySecretArn);
  }

  /**
   * Get full CloudFront URL for a resource
   */
  getCloudFrontUrl(path: string): string {
    return `https://${this.cloudfrontDomain}/${path}`;
  }
}
