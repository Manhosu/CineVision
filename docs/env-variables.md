# Environment Variables - Cine Vision

## Complete Configuration Guide

This document lists all required and optional environment variables for the Cine Vision platform.

---

## Database Configuration (REQUIRED)

### Supabase PostgreSQL

```bash
# Supabase Database URL (primary)
SUPABASE_DATABASE_URL=postgresql://postgres:password@db.project-id.supabase.co:5432/postgres

# Alternative format (fallback)
DATABASE_URL=postgresql://postgres:password@db.project-id.supabase.co:5432/postgres

# Individual components (optional, for reference)
SUPABASE_DB_HOST=db.project-id.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_USERNAME=postgres
SUPABASE_DB_PASSWORD=your-password
SUPABASE_DB_NAME=postgres

# Database behavior
DATABASE_SYNCHRONIZE=false  # true only in dev, NEVER in production
DATABASE_LOGGING=false      # true for debugging, false in production
```

### Supabase API (REQUIRED)

```bash
# Supabase Project URL
SUPABASE_URL=https://project-id.supabase.co

# Supabase Anonymous Key (public, safe for client-side)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Key (secret, server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Application Configuration

```bash
# Environment
NODE_ENV=development  # development | production

# Server Port
PORT=3001

# Base URL (for redirects, webhooks)
BASE_URL=http://localhost:3001  # or https://api.cinevision.com
```

---

## Security & Authentication (REQUIRED)

### JWT Configuration

```bash
# Access Token Secret (256-bit recommended)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Access Token Expiration
JWT_EXPIRES_IN=1h

# Refresh Token Secret (different from access token)
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Refresh Token Expiration
JWT_REFRESH_EXPIRES_IN=7d

# Password Hashing
BCRYPT_ROUNDS=12  # 10-12 recommended for production
```

### Rate Limiting

```bash
# Rate limit window (milliseconds)
RATE_LIMIT_TTL=60000  # 1 minute

# Max requests per window
RATE_LIMIT_LIMIT=100
```

---

## AWS Configuration (REQUIRED)

### AWS Credentials

```bash
# AWS Region
AWS_REGION=us-east-1

# AWS Access Key ID
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE

# AWS Secret Access Key
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### S3 Buckets

```bash
# Video storage bucket
S3_VIDEO_BUCKET=cinevision-filmes

# Cover images bucket
S3_COVERS_BUCKET=cinevision-capas

# Trailers bucket
S3_TRAILERS_BUCKET=cinevision-trailers
```

### CloudFront (REQUIRED for production)

```bash
# CloudFront Distribution Domain (without https://)
CLOUDFRONT_DISTRIBUTION_DOMAIN=d1234567890abc.cloudfront.net

# CloudFront Distribution ID
CLOUDFRONT_DISTRIBUTION_ID=E1234567890ABC

# CloudFront Key Pair ID
CLOUDFRONT_KEY_PAIR_ID=APKAI23HZ27SI6FQMGNQ

# Path to CloudFront Private Key File
CLOUDFRONT_PRIVATE_KEY_PATH=./secrets/cloudfront-private-key.pem

# OR: Inline Private Key (not recommended, use file instead)
# CLOUDFRONT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIE...

# Signed URL TTL in seconds
CLOUDFRONT_SIGNED_URL_TTL=43200  # 12 hours default
```

---

## Payment Integration (REQUIRED)

### Stripe

```bash
# Stripe Secret Key (starts with sk_test_ or sk_live_)
STRIPE_SECRET_KEY=sk_test_51234567890abcdefghijk

# Stripe Webhook Secret (starts with whsec_)
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijk

# Stripe Publishable Key (for frontend, optional here)
# STRIPE_PUBLISHABLE_KEY=pk_test_51234567890abcdefghijk
```

---

## Telegram Bot (REQUIRED)

```bash
# Telegram Bot Token
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Telegram Webhook URL (must be HTTPS in production)
TELEGRAM_WEBHOOK_URL=https://api.cinevision.com/webhooks/telegram

# Telegram Webhook Secret (for validation)
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret-key
```

---

## Redis (Optional, for Queue)

```bash
# Enable/disable Redis
REDIS_ENABLED=true  # false for development without Redis

# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # Leave empty if no password
REDIS_DB=0

# Redis TLS (for production)
# REDIS_TLS=true
```

---

## Video Transcoding

```bash
# Worker concurrency (number of parallel transcode jobs)
TRANSCODE_CONCURRENCY=2

# FFmpeg path (optional, auto-detected)
# FFMPEG_PATH=/usr/bin/ffmpeg

# MediaConvert (optional, alternative to FFmpeg)
# AWS_MEDIACONVERT_ENDPOINT=https://abcdefg.mediaconvert.us-east-1.amazonaws.com
# AWS_MEDIACONVERT_ROLE=arn:aws:iam::123456789:role/MediaConvertRole
```

---

## CORS Configuration

```bash
# Allowed origins (comma-separated)
CORS_ORIGIN=http://localhost:3000,https://cinevision.com

# Allowed methods
CORS_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS

# Allow credentials
CORS_CREDENTIALS=true
```

---

## Logging & Monitoring

```bash
# Log level (error | warn | log | debug | verbose)
LOG_LEVEL=log

# Sentry DSN (optional, for error tracking)
# SENTRY_DSN=https://public@sentry.io/project-id

# Disable logs in production (optional)
# DISABLE_LOGS=false
```

---

## Example .env Files

### Development (.env.development)

```bash
NODE_ENV=development
PORT=3001
BASE_URL=http://localhost:3001

# Database
SUPABASE_DATABASE_URL=postgresql://postgres:password@localhost:5432/cine_vision
DATABASE_SYNCHRONIZE=true
DATABASE_LOGGING=true

# Security
JWT_SECRET=dev-secret-key-not-for-production
JWT_REFRESH_SECRET=dev-refresh-secret-key

# AWS (using LocalStack or dev account)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_VIDEO_BUCKET=cinevision-dev

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Telegram (test bot)
TELEGRAM_BOT_TOKEN=test-bot-token

# Redis (disabled for local dev)
REDIS_ENABLED=false

# CloudFront (disabled for dev, direct S3)
# CLOUDFRONT_DISTRIBUTION_DOMAIN=
```

### Production (.env.production)

```bash
NODE_ENV=production
PORT=3001
BASE_URL=https://api.cinevision.com

# Database
SUPABASE_DATABASE_URL=postgresql://postgres:SECURE_PASSWORD@db.project.supabase.co:5432/postgres
DATABASE_SYNCHRONIZE=false
DATABASE_LOGGING=false

# Security
JWT_SECRET=GENERATE_STRONG_256_BIT_KEY_HERE
JWT_REFRESH_SECRET=GENERATE_DIFFERENT_256_BIT_KEY_HERE
BCRYPT_ROUNDS=12

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_VIDEO_BUCKET=cinevision-videos-prod
S3_COVERS_BUCKET=cinevision-covers-prod

# CloudFront
CLOUDFRONT_DISTRIBUTION_DOMAIN=d123abc.cloudfront.net
CLOUDFRONT_DISTRIBUTION_ID=E123ABC
CLOUDFRONT_KEY_PAIR_ID=APKAI...
CLOUDFRONT_PRIVATE_KEY_PATH=/etc/secrets/cloudfront-private-key.pem
CLOUDFRONT_SIGNED_URL_TTL=43200

# Stripe (live mode)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Telegram
TELEGRAM_BOT_TOKEN=1234567890:REAL_BOT_TOKEN
TELEGRAM_WEBHOOK_URL=https://api.cinevision.com/webhooks/telegram
TELEGRAM_WEBHOOK_SECRET=SECURE_WEBHOOK_SECRET

# Redis
REDIS_ENABLED=true
REDIS_HOST=redis.production.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=REDIS_SECURE_PASSWORD
REDIS_TLS=true

# Transcoding
TRANSCODE_CONCURRENCY=4

# CORS
CORS_ORIGIN=https://cinevision.com
```

---

## Security Best Practices

### 1. Secret Generation

Use strong random secrets:

```bash
# Generate 256-bit secret (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate 256-bit secret (OpenSSL)
openssl rand -hex 32

# Generate base64 secret
openssl rand -base64 48
```

### 2. Secret Storage

**Development:**
- Use `.env` file (gitignored)
- Never commit secrets to Git

**Production:**
- Use environment variables
- OR use secret management service:
  - AWS Secrets Manager
  - HashiCorp Vault
  - Kubernetes Secrets
  - Supabase Vault

### 3. Rotation

Rotate secrets periodically:
- JWT secrets: Every 90 days
- Stripe keys: When compromised
- Database passwords: Every 90 days
- CloudFront keys: Annually

### 4. Validation

Validate on startup:

```typescript
// backend/src/main.ts
function validateEnvironment() {
  const required = [
    'SUPABASE_DATABASE_URL',
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'AWS_ACCESS_KEY_ID',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
```

---

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check `SUPABASE_DATABASE_URL` format
   - Verify network access to Supabase
   - Check SSL settings

2. **Stripe webhook fails**
   - Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
   - Ensure webhook endpoint is HTTPS in production
   - Check raw body parser is enabled

3. **CloudFront signed URL errors**
   - Verify `CLOUDFRONT_PRIVATE_KEY_PATH` points to valid file
   - Check key pair ID matches CloudFront configuration
   - Ensure private key has correct permissions (chmod 600)

4. **Redis connection timeout**
   - Verify `REDIS_HOST` and `REDIS_PORT`
   - Check network access
   - Try setting `REDIS_ENABLED=false` temporarily

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [AWS CloudFront Signed URLs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [BullMQ Configuration](https://docs.bullmq.io/guide/connections)
