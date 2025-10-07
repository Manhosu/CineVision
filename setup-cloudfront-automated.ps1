# CloudFront Setup Automation Script for CineVision
# This script automates the CloudFront distribution setup using AWS CLI

param(
    [Parameter(Mandatory=$true)]
    [string]$BucketName = "cinevision-videos-prod",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-east-1"
)

Write-Host "Starting CloudFront setup for CineVision..." -ForegroundColor Green

# Check if AWS CLI is installed and configured
try {
    $awsIdentity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "AWS CLI configured for account: $($awsIdentity.Account)" -ForegroundColor Yellow
} catch {
    Write-Error "AWS CLI not configured. Please run 'aws configure' first."
    exit 1
}

# Step 1: Create Origin Access Control (OAC)
Write-Host "`nStep 1: Creating Origin Access Control..." -ForegroundColor Cyan

$oacConfig = @{
    Name = "cinevision-oac"
    Description = "Origin Access Control for CineVision S3 bucket"
    OriginAccessControlOriginType = "s3"
    SigningBehavior = "always"
    SigningProtocol = "sigv4"
} | ConvertTo-Json

$oacConfig | Out-File -FilePath "oac-config.json" -Encoding UTF8

try {
    $oacResult = aws cloudfront create-origin-access-control --origin-access-control-config file://oac-config.json --output json | ConvertFrom-Json
    $oacId = $oacResult.OriginAccessControl.Id
    Write-Host "OAC created successfully: $oacId" -ForegroundColor Green
} catch {
    Write-Error "Failed to create OAC: $_"
    exit 1
}

# Step 2: Create CloudFront Distribution
Write-Host "`nStep 2: Creating CloudFront Distribution..." -ForegroundColor Cyan

$distributionConfig = @{
    CallerReference = "cinevision-$(Get-Date -Format 'yyyyMMddHHmmss')"
    Comment = "CineVision Video Streaming Distribution"
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
        TrustedKeyGroups = @{
            Enabled = $true
            Quantity = 1
            Items = @("PLACEHOLDER_KEY_GROUP_ID")
        }
        ForwardedValues = @{
            QueryString = $false
            Cookies = @{
                Forward = "none"
            }
        }
        MinTTL = 0
        DefaultTTL = 86400
        MaxTTL = 31536000
        Compress = $true
        AllowedMethods = @{
            Quantity = 2
            Items = @("GET", "HEAD")
            CachedMethods = @{
                Quantity = 2
                Items = @("GET", "HEAD")
            }
        }
    }
    Enabled = $true
    PriceClass = "PriceClass_100"
} | ConvertTo-Json -Depth 10

$distributionConfig | Out-File -FilePath "distribution-config.json" -Encoding UTF8

# Step 3: Create CloudFront Public Key
Write-Host "`nStep 3: Creating CloudFront Public Key..." -ForegroundColor Cyan

if (Test-Path "cloudfront-public-key.pem") {
    $publicKeyContent = Get-Content "cloudfront-public-key.pem" -Raw
    
    $publicKeyConfig = @{
        Name = "cinevision-public-key"
        EncodedKey = $publicKeyContent
        Comment = "Public key for CineVision signed URLs"
    } | ConvertTo-Json
    
    $publicKeyConfig | Out-File -FilePath "public-key-config.json" -Encoding UTF8
    
    try {
        $publicKeyResult = aws cloudfront create-public-key --public-key-config file://public-key-config.json --output json | ConvertFrom-Json
        $publicKeyId = $publicKeyResult.PublicKey.Id
        Write-Host "Public key created successfully: $publicKeyId" -ForegroundColor Green
    } catch {
        Write-Error "Failed to create public key: $_"
        exit 1
    }
} else {
    Write-Error "cloudfront-public-key.pem not found. Please ensure the public key file exists."
    exit 1
}

# Step 4: Create Key Group
Write-Host "`nStep 4: Creating Key Group..." -ForegroundColor Cyan

$keyGroupConfig = @{
    Name = "cinevision-key-group"
    Items = @($publicKeyId)
    Comment = "Key group for CineVision signed URLs"
} | ConvertTo-Json

$keyGroupConfig | Out-File -FilePath "key-group-config.json" -Encoding UTF8

try {
    $keyGroupResult = aws cloudfront create-key-group --key-group-config file://key-group-config.json --output json | ConvertFrom-Json
    $keyGroupId = $keyGroupResult.KeyGroup.Id
    Write-Host "Key group created successfully: $keyGroupId" -ForegroundColor Green
} catch {
    Write-Error "Failed to create key group: $_"
    exit 1
}

# Step 5: Update distribution config with key group
Write-Host "`nStep 5: Updating distribution configuration..." -ForegroundColor Cyan

$distributionConfig = $distributionConfig -replace "PLACEHOLDER_KEY_GROUP_ID", $keyGroupId
$distributionConfig | Out-File -FilePath "distribution-config-final.json" -Encoding UTF8

try {
    $distributionResult = aws cloudfront create-distribution --distribution-config file://distribution-config-final.json --output json | ConvertFrom-Json
    $distributionId = $distributionResult.Distribution.Id
    $distributionDomain = $distributionResult.Distribution.DomainName
    Write-Host "Distribution created successfully: $distributionId" -ForegroundColor Green
    Write-Host "Distribution domain: $distributionDomain" -ForegroundColor Green
} catch {
    Write-Error "Failed to create distribution: $_"
    exit 1
}

# Step 6: Update S3 Bucket Policy
Write-Host "`nStep 6: Updating S3 bucket policy..." -ForegroundColor Cyan

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
                    "AWS:SourceArn" = "arn:aws:cloudfront::$($awsIdentity.Account):distribution/$distributionId"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10

$bucketPolicy | Out-File -FilePath "bucket-policy.json" -Encoding UTF8

try {
    aws s3api put-bucket-policy --bucket $BucketName --policy file://bucket-policy.json
    Write-Host "S3 bucket policy updated successfully" -ForegroundColor Green
} catch {
    Write-Error "Failed to update S3 bucket policy: $_"
    exit 1
}

# Step 7: Generate environment variables
Write-Host "`nStep 7: Generating environment variables..." -ForegroundColor Cyan

$envVars = @"
# CloudFront Configuration - Add these to your .env file
CLOUDFRONT_DOMAIN=$distributionDomain
CLOUDFRONT_KEY_PAIR_ID=$publicKeyId
CLOUDFRONT_PRIVATE_KEY_PATH=./cloudfront-private-key.pem
CLOUDFRONT_SIGNED_URL_TTL=3600

# Distribution Information
CLOUDFRONT_DISTRIBUTION_ID=$distributionId
CLOUDFRONT_KEY_GROUP_ID=$keyGroupId
CLOUDFRONT_OAC_ID=$oacId
"@

$envVars | Out-File -FilePath ".env.cloudfront" -Encoding UTF8

Write-Host "`nCloudFront setup completed successfully!" -ForegroundColor Green
Write-Host "Environment variables saved to .env.cloudfront" -ForegroundColor Yellow
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Copy the contents of .env.cloudfront to your main .env file" -ForegroundColor White
Write-Host "2. Ensure cloudfront-private-key.pem is in your project root" -ForegroundColor White
Write-Host "3. Wait for CloudFront distribution to deploy (15-20 minutes)" -ForegroundColor White
Write-Host "4. Test the video upload and streaming functionality" -ForegroundColor White

# Cleanup temporary files
Remove-Item -Path "oac-config.json", "distribution-config.json", "distribution-config-final.json", "public-key-config.json", "key-group-config.json", "bucket-policy.json" -ErrorAction SilentlyContinue

Write-Host "`nSetup script completed. Check .env.cloudfront for configuration details." -ForegroundColor Green