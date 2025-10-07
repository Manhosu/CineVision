#!/bin/bash

# CineVision CloudFront Setup Script
# This script must be run by an AWS user with CloudFront permissions

set -e

echo "🚀 Starting CineVision CloudFront Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
BUCKET_NAME="cinevision-videos-prod"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo -e "${YELLOW}📋 Account ID: $ACCOUNT_ID${NC}"
echo -e "${YELLOW}📦 S3 Bucket: $BUCKET_NAME${NC}"

# Step 1: Create Origin Access Control
echo -e "\n${YELLOW}Step 1: Creating Origin Access Control...${NC}"
OAC_RESPONSE=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config file://cloudfront-oac-config.json \
  --output json)

OAC_ID=$(echo $OAC_RESPONSE | jq -r '.OriginAccessControl.Id')
echo -e "${GREEN}✅ OAC Created: $OAC_ID${NC}"

# Step 2: Create CloudFront Distribution
echo -e "\n${YELLOW}Step 2: Creating CloudFront Distribution...${NC}"

# Update distribution config with OAC ID
cat > cloudfront-distribution-config.json << EOF
{
  "CallerReference": "cinevision-distribution-$(date +%s)",
  "Comment": "CineVision CloudFront Distribution for Video Streaming",
  "DefaultCacheBehavior": {
    "TargetOriginId": "cinevision-s3-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 7,
      "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "ForwardedValues": {
      "QueryString": true,
      "Cookies": {
        "Forward": "none"
      },
      "Headers": {
        "Quantity": 3,
        "Items": ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      }
    },
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "Compress": true
  },
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "cinevision-s3-origin",
        "DomainName": "$BUCKET_NAME.s3.us-east-2.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        },
        "OriginAccessControlId": "$OAC_ID"
      }
    ]
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

DIST_RESPONSE=$(aws cloudfront create-distribution \
  --distribution-config file://cloudfront-distribution-config.json \
  --output json)

DISTRIBUTION_ID=$(echo $DIST_RESPONSE | jq -r '.Distribution.Id')
DOMAIN_NAME=$(echo $DIST_RESPONSE | jq -r '.Distribution.DomainName')
echo -e "${GREEN}✅ Distribution Created: $DISTRIBUTION_ID${NC}"
echo -e "${GREEN}🌐 Domain Name: $DOMAIN_NAME${NC}"

# Step 3: Update S3 Bucket Policy
echo -e "\n${YELLOW}Step 3: Updating S3 Bucket Policy...${NC}"

cat > s3-bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::$ACCOUNT_ID:distribution/$DISTRIBUTION_ID"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket $BUCKET_NAME \
  --policy file://s3-bucket-policy.json

echo -e "${GREEN}✅ S3 Bucket Policy Updated${NC}"

# Step 4: Create CloudFront Public Key
echo -e "\n${YELLOW}Step 4: Creating CloudFront Public Key...${NC}"

PUBLIC_KEY_RESPONSE=$(aws cloudfront create-public-key \
  --public-key-config file://cloudfront-public-key-config.json \
  --output json)

PUBLIC_KEY_ID=$(echo $PUBLIC_KEY_RESPONSE | jq -r '.PublicKey.Id')
echo -e "${GREEN}✅ Public Key Created: $PUBLIC_KEY_ID${NC}"

# Step 5: Create Key Group
echo -e "\n${YELLOW}Step 5: Creating Key Group...${NC}"

# Update key group config with actual public key ID
cat > cloudfront-key-group-config-final.json << EOF
{
  "Name": "cinevision-key-group",
  "Items": ["$PUBLIC_KEY_ID"],
  "Comment": "Key group for CineVision signed URLs"
}
EOF

KEY_GROUP_RESPONSE=$(aws cloudfront create-key-group \
  --key-group-config file://cloudfront-key-group-config-final.json \
  --output json)

KEY_GROUP_ID=$(echo $KEY_GROUP_RESPONSE | jq -r '.KeyGroup.Id')
echo -e "${GREEN}✅ Key Group Created: $KEY_GROUP_ID${NC}"

# Step 6: Generate Environment Variables
echo -e "\n${YELLOW}Step 6: Generating Environment Variables...${NC}"

cat > cloudfront-env-vars.txt << EOF
# CloudFront Configuration for CineVision
CLOUDFRONT_DISTRIBUTION_ID=$DISTRIBUTION_ID
CLOUDFRONT_DOMAIN_NAME=$DOMAIN_NAME
CLOUDFRONT_KEY_PAIR_ID=$PUBLIC_KEY_ID
CLOUDFRONT_KEY_GROUP_ID=$KEY_GROUP_ID
CLOUDFRONT_PRIVATE_KEY_PATH=cloudfront-private-key.pem

# Add these to your .env file
EOF

echo -e "${GREEN}✅ Environment variables saved to cloudfront-env-vars.txt${NC}"

# Summary
echo -e "\n${GREEN}🎉 CloudFront Setup Complete!${NC}"
echo -e "\n${YELLOW}📋 Summary:${NC}"
echo -e "   Distribution ID: $DISTRIBUTION_ID"
echo -e "   Domain Name: $DOMAIN_NAME"
echo -e "   Public Key ID: $PUBLIC_KEY_ID"
echo -e "   Key Group ID: $KEY_GROUP_ID"
echo -e "\n${YELLOW}📝 Next Steps:${NC}"
echo -e "   1. Add the environment variables from cloudfront-env-vars.txt to your .env file"
echo -e "   2. Wait for CloudFront distribution to deploy (15-20 minutes)"
echo -e "   3. Test video streaming with signed URLs"
echo -e "\n${YELLOW}⚠️  Note: CloudFront distribution deployment can take 15-20 minutes${NC}"