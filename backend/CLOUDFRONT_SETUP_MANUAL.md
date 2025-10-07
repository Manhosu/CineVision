# Configuração Manual do CloudFront para CineVision

Este guia fornece instruções passo a passo para configurar o CloudFront com Origin Access Control (OAC) e URLs assinadas para o projeto CineVision.

## Pré-requisitos

- AWS CLI instalado e configurado com permissões administrativas
- Acesso ao console AWS com permissões para CloudFront, S3 e IAM
- Bucket S3 `cinevision-videos-prod` já criado

## Passo 1: Criar Origin Access Control (OAC)

### Via AWS CLI:
```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config \
  Name=cinevision-oac,Description="OAC for CineVision S3 bucket",OriginAccessControlOriginType=s3,SigningBehavior=always,SigningProtocol=sigv4
```

### Via Console AWS:
1. Acesse o console do CloudFront
2. Vá para "Origin access" > "Origin access control"
3. Clique em "Create origin access control"
4. Configure:
   - **Name**: `cinevision-oac`
   - **Description**: `OAC for CineVision S3 bucket`
   - **Origin type**: S3
   - **Signing behavior**: Always sign
   - **Signing protocol**: sigv4

## Passo 2: Criar Distribuição CloudFront

### Via AWS CLI:
```bash
# Criar arquivo de configuração
cat > distribution-config.json << EOF
{
  "CallerReference": "cinevision-$(date +%Y%m%d%H%M%S)",
  "Comment": "CineVision video streaming distribution",
  "DefaultRootObject": "",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-cinevision-videos-prod",
        "DomainName": "cinevision-videos-prod.s3.us-east-1.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        },
        "OriginAccessControlId": "SEU_OAC_ID_AQUI"
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-cinevision-videos-prod",
    "ViewerProtocolPolicy": "redirect-to-https",
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0,
    "Compress": true
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

aws cloudfront create-distribution --distribution-config file://distribution-config.json
```

### Via Console AWS:
1. Acesse o console do CloudFront
2. Clique em "Create distribution"
3. Configure:
   - **Origin domain**: `cinevision-videos-prod.s3.us-east-1.amazonaws.com`
   - **Origin access**: Origin access control settings
   - **Origin access control**: Selecione o OAC criado anteriormente
   - **Viewer protocol policy**: Redirect HTTP to HTTPS
   - **Compress objects automatically**: Yes
   - **Price class**: Use only North America and Europe

## Passo 3: Gerar Chaves para URLs Assinadas

### Gerar par de chaves:
```bash
# Gerar chave privada
openssl genrsa -out cloudfront-private-key.pem 2048

# Gerar chave pública
openssl rsa -pubout -in cloudfront-private-key.pem -out cloudfront-public-key.pem
```

### Criar chave pública no CloudFront:
```bash
aws cloudfront create-public-key \
  --public-key-config Name=cinevision-signing-key,CallerReference="key-$(date +%Y%m%d%H%M%S)",EncodedKey="$(cat cloudfront-public-key.pem)"
```

### Via Console AWS:
1. Acesse CloudFront > Public keys
2. Clique em "Create public key"
3. Configure:
   - **Name**: `cinevision-signing-key`
   - **Key**: Cole o conteúdo do arquivo `cloudfront-public-key.pem`

## Passo 4: Criar Key Group

### Via AWS CLI:
```bash
aws cloudfront create-key-group \
  --key-group-config Name=cinevision-key-group,Items=SEU_PUBLIC_KEY_ID_AQUI,Comment="Key group for CineVision signed URLs"
```

### Via Console AWS:
1. Acesse CloudFront > Key groups
2. Clique em "Create key group"
3. Configure:
   - **Name**: `cinevision-key-group`
   - **Public keys**: Selecione a chave criada anteriormente

## Passo 5: Atualizar Política do Bucket S3

```bash
# Criar política do bucket
cat > bucket-policy.json << EOF
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
      "Resource": "arn:aws:s3:::cinevision-videos-prod/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::SEU_ACCOUNT_ID:distribution/SEU_DISTRIBUTION_ID"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket cinevision-videos-prod --policy file://bucket-policy.json
```

## Passo 6: Configurar Variáveis de Ambiente

Após criar todos os recursos, adicione as seguintes variáveis ao arquivo `.env`:

```env
# CloudFront Configuration
CLOUDFRONT_DOMAIN=SEU_CLOUDFRONT_DOMAIN.cloudfront.net
CLOUDFRONT_DISTRIBUTION_ID=SEU_DISTRIBUTION_ID
CLOUDFRONT_KEY_PAIR_ID=SEU_PUBLIC_KEY_ID
CLOUDFRONT_PRIVATE_KEY_PATH=./cloudfront-private-key.pem
CLOUDFRONT_SIGNED_URL_TTL=3600

# S3 Configuration
AWS_S3_BUCKET=cinevision-videos-prod
AWS_REGION=us-east-1
```

## Passo 7: Testar a Configuração

1. Aguarde a distribuição do CloudFront ser implantada (15-20 minutos)
2. Teste o upload de um vídeo através da interface admin
3. Verifique se as URLs assinadas são geradas corretamente
4. Teste o streaming do vídeo através do CloudFront

## Comandos de Verificação

```bash
# Verificar status da distribuição
aws cloudfront get-distribution --id SEU_DISTRIBUTION_ID

# Listar OACs
aws cloudfront list-origin-access-controls

# Listar chaves públicas
aws cloudfront list-public-keys

# Listar key groups
aws cloudfront list-key-groups
```

## Segurança

- **NUNCA** commite a chave privada (`cloudfront-private-key.pem`) no repositório
- Mantenha a chave privada segura e com permissões restritas
- Use variáveis de ambiente para todas as configurações sensíveis
- Considere usar AWS Secrets Manager para armazenar a chave privada em produção

## Troubleshooting

### Erro 403 ao acessar vídeos:
- Verifique se a política do bucket S3 está correta
- Confirme se o OAC está associado à distribuição
- Verifique se a distribuição está implantada

### URLs assinadas não funcionam:
- Verifique se o key group está associado ao behavior da distribuição
- Confirme se a chave privada corresponde à chave pública
- Verifique se o TTL da URL não expirou

### Distribuição não implanta:
- Verifique se todas as configurações estão corretas
- Aguarde o tempo necessário (pode levar até 20 minutos)
- Verifique os logs do CloudFront para erros específicos