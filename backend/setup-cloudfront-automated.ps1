# CloudFront Automated Setup Script
# This script sets up CloudFront distribution with OAC for S3 bucket

param(
    [string]$BucketName = "cinevision-videos-prod",
    [string]$Region = "us-east-1"
)

Write-Host "Starting CloudFront setup for bucket: $BucketName" -ForegroundColor Green

# Step 1: Create Origin Access Control (OAC)
Write-Host "Creating Origin Access Control..." -ForegroundColor Yellow
$oacConfig = @{
    Name = "cinevision-oac"
    Description = "OAC for CineVision S3 bucket"
    OriginAccessControlOriginType = "s3"
    SigningBehavior = "always"
    SigningProtocol = "sigv4"
} | ConvertTo-Json

$oacConfigFile = "oac-config.json"
$oacConfig | Out-File -FilePath $oacConfigFile -Encoding UTF8

try {
    $oacResult = aws cloudfront create-origin-access-control --origin-access-control-config file://$oacConfigFile --output json | ConvertFrom-Json
    $oacId = $oacResult.OriginAccessControl.Id
    Write-Host "OAC created with ID: $oacId" -ForegroundColor Green
} catch {
    Write-Host "Failed to create OAC: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Create CloudFront Distribution
Write-Host "Creating CloudFront Distribution..." -ForegroundColor Yellow
$distributionConfig = @{
    CallerReference = "cinevision-$(Get-Date -Format 'yyyyMMddHHmmss')"
    Comment = "CineVision video streaming distribution"
    DefaultRootObject = ""
    Origins = @{
        Quantity = 1
        Items = @(
            @{
                Id = "S3-$BucketName"
                DomainName = "$BucketName.s3.$Region.amazonaws.com"
                S3OriginConfig = @{
                    OriginAccessIdentity = ""
                }
                OriginAccessControlId = $oacId
            }
        )
    }
    DefaultCacheBehavior = @{
        TargetOriginId = "S3-$BucketName"
        ViewerProtocolPolicy = "redirect-to-https"
        TrustedSigners = @{
            Enabled = $false
            Quantity = 0
        }
        ForwardedValues = @{
            QueryString = $false
            Cookies = @{
                Forward = "none"
            }
        }
        MinTTL = 0
        Compress = $true
    }
    Enabled = $true
    PriceClass = "PriceClass_100"
} | ConvertTo-Json -Depth 10

$distributionConfigFile = "distribution-config.json"
$distributionConfig | Out-File -FilePath $distributionConfigFile -Encoding UTF8

try {
    $distributionResult = aws cloudfront create-distribution --distribution-config file://$distributionConfigFile --output json | ConvertFrom-Json
    $distributionId = $distributionResult.Distribution.Id
    $distributionDomain = $distributionResult.Distribution.DomainName
    Write-Host "Distribution created with ID: $distributionId" -ForegroundColor Green
    Write-Host "Distribution domain: $distributionDomain" -ForegroundColor Green
} catch {
    Write-Host "Failed to create distribution: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Create Public Key for Signed URLs
Write-Host "Creating public key for signed URLs..." -ForegroundColor Yellow
$keyName = "cinevision-signing-key"

# Generate key pair
openssl genrsa -out private_key.pem 2048
openssl rsa -pubout -in private_key.pem -out public_key.pem

try {
    $publicKeyResult = aws cloudfront create-public-key --public-key-config Name=$keyName,CallerReference="key-$(Get-Date -Format 'yyyyMMddHHmmss')",EncodedKey="$(Get-Content public_key.pem -Raw)" --output json | ConvertFrom-Json
    $publicKeyId = $publicKeyResult.PublicKey.Id
    Write-Host "Public key created with ID: $publicKeyId" -ForegroundColor Green
} catch {
    Write-Host "Failed to create public key: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Create Key Group
Write-Host "Creating key group..." -ForegroundColor Yellow
$keyGroupConfig = @{
    Name = "cinevision-key-group"
    Items = @($publicKeyId)
    Comment = "Key group for CineVision signed URLs"
} | ConvertTo-Json

$keyGroupConfigFile = "key-group-config.json"
$keyGroupConfig | Out-File -FilePath $keyGroupConfigFile -Encoding UTF8

try {
    $keyGroupResult = aws cloudfront create-key-group --key-group-config file://$keyGroupConfigFile --output json | ConvertFrom-Json
    $keyGroupId = $keyGroupResult.KeyGroup.Id
    Write-Host "Key group created with ID: $keyGroupId" -ForegroundColor Green
} catch {
    Write-Host "Failed to create key group: $_" -ForegroundColor Red
    exit 1
}

# Step 5: Update S3 Bucket Policy for OAC
Write-Host "Updating S3 bucket policy..." -ForegroundColor Yellow
$bucketPolicy = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Sid = "AllowCloudFrontServicePrincipal"
            Effect = "Allow"
            Principal = @{
                Service = "cloudfront.amazonaws.com"
            }
            Action = "s3:GetObject"
            Resource = "arn:aws:s3:::$BucketName/*"
            Condition = @{
                StringEquals = @{
                    "AWS:SourceArn" = "arn:aws:cloudfront::$(aws sts get-caller-identity --query Account --output text):distribution/$distributionId"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10

$bucketPolicyFile = "bucket-policy.json"
$bucketPolicy | Out-File -FilePath $bucketPolicyFile -Encoding UTF8

try {
    aws s3api put-bucket-policy --bucket $BucketName --policy file://$bucketPolicyFile
    Write-Host "S3 bucket policy updated successfully" -ForegroundColor Green
} catch {
    Write-Host "Failed to update bucket policy: $_" -ForegroundColor Red
    exit 1
}

# Step 6: Generate Environment Variables
Write-Host "Generating environment variables..." -ForegroundColor Yellow
$envVars = @"
# CloudFront Configuration
CLOUDFRONT_DOMAIN=$distributionDomain
CLOUDFRONT_DISTRIBUTION_ID=$distributionId
CLOUDFRONT_KEY_PAIR_ID=$publicKeyId
CLOUDFRONT_PRIVATE_KEY_PATH=./private_key.pem
CLOUDFRONT_SIGNED_URL_TTL=3600

# S3 Configuration
AWS_S3_BUCKET=$BucketName
AWS_REGION=$Region
"@

$envVars | Out-File -FilePath ".env.cloudfront" -Encoding UTF8

Write-Host "Environment variables saved to .env.cloudfront" -ForegroundColor Green
Write-Host "Private key saved to private_key.pem" -ForegroundColor Green

# Cleanup temporary files
Remove-Item $oacConfigFile, $distributionConfigFile, $keyGroupConfigFile, $bucketPolicyFile, "public_key.pem" -ErrorAction SilentlyContinue

Write-Host "CloudFront setup completed successfully!" -ForegroundColor Green
Write-Host "Distribution Domain: $distributionDomain" -ForegroundColor Cyan
Write-Host "Distribution ID: $distributionId" -ForegroundColor Cyan
Write-Host "Public Key ID: $publicKeyId" -ForegroundColor Cyan
Write-Host "Key Group ID: $keyGroupId" -ForegroundColor Cyan

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Copy the environment variables from .env.cloudfront to your main .env file"
Write-Host "2. Ensure the private_key.pem file is secure and not committed to version control"
Write-Host "3. Wait for CloudFront distribution to deploy (can take 15-20 minutes)"
Write-Host "4. Test the signed URL generation in your application"