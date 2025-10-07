# CloudFront Manual Setup Guide for CineVision

## Prerequisites
- AWS Account with CloudFront permissions
- S3 bucket: `cinevision-videos-prod` (already created)
- RSA keys generated (already done)

## Step 1: Create Origin Access Control (OAC)

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config file://cloudfront-oac-config.json
```

Create `cloudfront-oac-config.json`:
```json
{
  "Name": "cinevision-oac",
  "Description": "Origin Access Control for CineVision S3 bucket",
  "SigningProtocol": "sigv4",
  "SigningBehavior": "always",
  "OriginAccessControlOriginType": "s3"
}
```

## Step 2: Create CloudFront Distribution

```bash
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-distribution-config.json
```

Use the `cloudfront-setup.json` file as reference for the distribution configuration.

## Step 3: Update S3 Bucket Policy

After creating the distribution, update the bucket policy with the actual distribution ARN:

```bash
aws s3api put-bucket-policy \
  --bucket cinevision-videos-prod \
  --policy file://s3-bucket-policy.json
```

## Step 4: Create CloudFront Public Key

```bash
aws cloudfront create-public-key \
  --public-key-config file://cloudfront-public-key-config.json
```

Create `cloudfront-public-key-config.json`:
```json
{
  "CallerReference": "cinevision-public-key-2024",
  "Name": "cinevision-public-key",
  "EncodedKey": "PASTE_PUBLIC_KEY_CONTENT_HERE",
  "Comment": "Public key for CineVision signed URLs"
}
```

## Step 5: Create Key Group

```bash
aws cloudfront create-key-group \
  --key-group-config file://cloudfront-key-group-config.json
```

Create `cloudfront-key-group-config.json`:
```json
{
  "Name": "cinevision-key-group",
  "Items": ["PUBLIC_KEY_ID_FROM_STEP_4"],
  "Comment": "Key group for CineVision signed URLs"
}
```

## Step 6: Update Environment Variables

After completing the setup, update the `.env` file with:
- `CLOUDFRONT_DISTRIBUTION_ID`
- `CLOUDFRONT_DOMAIN_NAME`
- `CLOUDFRONT_KEY_PAIR_ID`
- `CLOUDFRONT_KEY_GROUP_ID`

## Notes
- Replace placeholders with actual values from AWS responses
- Ensure all resources are in the same AWS region
- Test the setup with a sample video upload and signed URL generation