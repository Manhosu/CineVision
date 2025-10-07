# AWS IAM Policies - Cine Vision

## Overview

This document describes the minimum required IAM permissions for the Cine Vision platform to function correctly with AWS services.

---

## IAM User Setup

### Create IAM User

1. Go to AWS Console → IAM → Users
2. Click "Create user"
3. Name: `cinevision-backend`
4. Access type: **Programmatic access** (generate Access Key)
5. Attach policies (see below)
6. Save Access Key ID and Secret Access Key to `.env`

---

## Required IAM Policies

### 1. S3 Full Access Policy (Recommended Approach)

Create a custom policy with minimal permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBuckets",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-filmes",
        "arn:aws:s3:::cinevision-capas",
        "arn:aws:s3:::cinevision-trailers"
      ]
    },
    {
      "Sid": "ObjectOperations",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts",
        "s3:ListBucketMultipartUploads"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-filmes/*",
        "arn:aws:s3:::cinevision-capas/*",
        "arn:aws:s3:::cinevision-trailers/*"
      ]
    },
    {
      "Sid": "MultipartUpload",
      "Effect": "Allow",
      "Action": [
        "s3:CreateMultipartUpload",
        "s3:CompleteMultipartUpload",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts",
        "s3:ListBucketMultipartUploads"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-filmes/*",
        "arn:aws:s3:::cinevision-capas/*",
        "arn:aws:s3:::cinevision-trailers/*"
      ]
    },
    {
      "Sid": "PresignedURLGeneration",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-filmes/*",
        "arn:aws:s3:::cinevision-capas/*",
        "arn:aws:s3:::cinevision-trailers/*"
      ]
    }
  ]
}
```

**Policy Name:** `CineVisionS3Access`

---

### 2. CloudFront Access Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
    },
    {
      "Sid": "CloudFrontDistributionRead",
      "Effect": "Allow",
      "Action": [
        "cloudfront:GetDistribution",
        "cloudfront:GetDistributionConfig",
        "cloudfront:ListDistributions"
      ],
      "Resource": "*"
    }
  ]
}
```

**Policy Name:** `CineVisionCloudFrontAccess`

**Note:** Replace `ACCOUNT_ID` and `DISTRIBUTION_ID` with your values.

---

### 3. MediaConvert Policy (Optional - for AWS MediaConvert)

If using AWS MediaConvert instead of FFmpeg:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "MediaConvertJobSubmission",
      "Effect": "Allow",
      "Action": [
        "mediaconvert:CreateJob",
        "mediaconvert:GetJob",
        "mediaconvert:ListJobs",
        "mediaconvert:CancelJob"
      ],
      "Resource": "*"
    },
    {
      "Sid": "MediaConvertPresetAndTemplate",
      "Effect": "Allow",
      "Action": [
        "mediaconvert:GetJobTemplate",
        "mediaconvert:ListJobTemplates",
        "mediaconvert:GetPreset",
        "mediaconvert:ListPresets"
      ],
      "Resource": "*"
    },
    {
      "Sid": "MediaConvertPassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/MediaConvertRole",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "mediaconvert.amazonaws.com"
        }
      }
    }
  ]
}
```

**Policy Name:** `CineVisionMediaConvertAccess`

---

### 4. Combined Policy (All Services)

For simplicity, you can combine all policies:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3BucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:ListBucketMultipartUploads"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-filmes",
        "arn:aws:s3:::cinevision-capas",
        "arn:aws:s3:::cinevision-trailers"
      ]
    },
    {
      "Sid": "S3ObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:CreateMultipartUpload",
        "s3:CompleteMultipartUpload",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-filmes/*",
        "arn:aws:s3:::cinevision-capas/*",
        "arn:aws:s3:::cinevision-trailers/*"
      ]
    },
    {
      "Sid": "CloudFrontAccess",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:GetDistribution",
        "cloudfront:ListDistributions"
      ],
      "Resource": "*"
    }
  ]
}
```

**Policy Name:** `CineVisionFullAccess`

---

## S3 Bucket Policies

### Video Bucket Policy

Add this bucket policy to `cinevision-filmes`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFrontOACAccess",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::cinevision-filmes/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
        }
      }
    },
    {
      "Sid": "BackendUploadAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT_ID:user/cinevision-backend"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:CreateMultipartUpload",
        "s3:CompleteMultipartUpload",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::cinevision-filmes/*"
    },
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::cinevision-filmes/*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalArn": [
            "arn:aws:iam::ACCOUNT_ID:user/cinevision-backend"
          ]
        },
        "StringNotLike": {
          "aws:PrincipalServiceName": "cloudfront.amazonaws.com"
        }
      }
    }
  ]
}
```

---

## CloudFront Origin Access Control (OAC)

### Create OAC

1. Go to CloudFront → Origin Access
2. Create Origin Access Control
3. Name: `cinevision-oac`
4. Signing behavior: **Sign requests (recommended)**
5. Origin type: **S3**

### Update S3 Bucket Policy

Add CloudFront OAC to bucket policy (see above).

---

## CloudFront Trusted Key Groups

### Create Key Pair for Signed URLs

```bash
# Generate RSA key pair
openssl genrsa -out cloudfront-private-key.pem 2048
openssl rsa -pubout -in cloudfront-private-key.pem -out cloudfront-public-key.pem

# Convert public key to CloudFront format
cat cloudfront-public-key.pem
```

### Upload Public Key to CloudFront

1. Go to CloudFront → Public keys
2. Create public key
3. Name: `cinevision-signing-key`
4. Paste public key content
5. Save Key ID (e.g., `APKAI23HZ27SI6FQMGNQ`)

### Create Key Group

1. Go to CloudFront → Key groups
2. Create key group
3. Name: `cinevision-key-group`
4. Add the public key created above

### Update Distribution

1. Go to CloudFront → Distributions
2. Select your distribution
3. Edit → Trusted key groups
4. Select `cinevision-key-group`
5. Save

---

## IAM Role for MediaConvert (Optional)

If using AWS MediaConvert:

### Create Role

```bash
# Trust policy (trust-policy.json)
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "mediaconvert.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### Role Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3AccessForMediaConvert",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-filmes/*"
      ]
    },
    {
      "Sid": "APIExecuteForMediaConvert",
      "Effect": "Allow",
      "Action": [
        "execute-api:Invoke",
        "execute-api:ManageConnections"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Security Best Practices

### 1. Principle of Least Privilege

- Only grant minimum required permissions
- Use resource-specific ARNs, not `*`
- Review permissions quarterly

### 2. Access Key Rotation

```bash
# Rotate access keys every 90 days
aws iam create-access-key --user-name cinevision-backend
aws iam delete-access-key --user-name cinevision-backend --access-key-id OLD_KEY_ID
```

### 3. MFA Protection

```json
{
  "Condition": {
    "Bool": {
      "aws:MultiFactorAuthPresent": "true"
    }
  }
}
```

### 4. IP Restrictions (Optional)

```json
{
  "Condition": {
    "IpAddress": {
      "aws:SourceIp": [
        "203.0.113.0/24",
        "198.51.100.0/24"
      ]
    }
  }
}
```

### 5. Audit with CloudTrail

Enable CloudTrail to monitor:
- S3 object access
- CloudFront invalidations
- IAM changes

---

## Troubleshooting

### Access Denied Errors

1. **S3 Access Denied**
   ```
   Error: Access Denied (403)
   ```
   - Check IAM policy has `s3:PutObject` permission
   - Verify bucket policy allows IAM user
   - Check bucket CORS configuration

2. **CloudFront Invalidation Failed**
   ```
   Error: User is not authorized to perform: cloudfront:CreateInvalidation
   ```
   - Add `cloudfront:CreateInvalidation` to IAM policy
   - Verify distribution ARN is correct

3. **Multipart Upload Failed**
   ```
   Error: Access Denied on CompleteMultipartUpload
   ```
   - Add `s3:CompleteMultipartUpload` permission
   - Check bucket policy allows multipart operations

### Testing Permissions

```bash
# Test S3 upload
aws s3 cp test.txt s3://cinevision-filmes/test.txt --profile cinevision

# Test CloudFront invalidation
aws cloudfront create-invalidation \
  --distribution-id E123ABC \
  --paths "/*" \
  --profile cinevision

# Simulate policy
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT_ID:user/cinevision-backend \
  --action-names s3:PutObject \
  --resource-arns arn:aws:s3:::cinevision-filmes/test.txt
```

---

## Quick Setup Script

```bash
#!/bin/bash

# Variables
BUCKET_NAME="cinevision-filmes"
IAM_USER="cinevision-backend"
REGION="us-east-1"

# Create S3 buckets
aws s3 mb s3://$BUCKET_NAME --region $REGION
aws s3 mb s3://cinevision-capas --region $REGION
aws s3 mb s3://cinevision-trailers --region $REGION

# Block public access
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Create IAM user
aws iam create-user --user-name $IAM_USER

# Attach policy
aws iam put-user-policy \
  --user-name $IAM_USER \
  --policy-name CineVisionS3Access \
  --policy-document file://iam-policy.json

# Create access key
aws iam create-access-key --user-name $IAM_USER

echo "Setup complete! Save the Access Key ID and Secret Access Key to your .env file."
```

---

## Additional Resources

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [S3 Bucket Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html)
- [CloudFront Signed URLs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html)
- [MediaConvert IAM Permissions](https://docs.aws.amazon.com/mediaconvert/latest/ug/iam-role.html)
