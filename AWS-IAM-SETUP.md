# Configuração AWS IAM para Produção - CineVision

## ⚠️ AÇÕES NECESSÁRIAS PELO ADMINISTRADOR AWS

### 1. Adicionar Permissões IAM ao usuário `cinevision-uploader`

Execute este comando com uma conta que tenha permissões de administrador IAM:

```bash
aws iam put-user-policy \
  --user-name cinevision-uploader \
  --policy-name CinevisionVideoFullAccess \
  --policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3FullAccessCinevisionVideo",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts",
        "s3:ListBucketMultipartUploads"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-video",
        "arn:aws:s3:::cinevision-video/*"
      ]
    }
  ]
}'
```

### 2. Configurar CloudFront para Produção (OPCIONAL - Melhor Performance)

Se quiser usar CloudFront em vez de S3 direto:

#### 2.1. Gerar Par de Chaves CloudFront

```bash
# Gerar chave privada
openssl genrsa -out cloudfront-private-key.pem 2048

# Gerar chave pública
openssl rsa -pubout -in cloudfront-private-key.pem -out cloudfront-public-key.pem
```

#### 2.2. Criar Public Key no CloudFront

```bash
aws cloudfront create-public-key \
  --public-key-config Name=cinevision-signing-key,CallerReference="key-$(date +%Y%m%d%H%M%S)",EncodedKey="$(cat cloudfront-public-key.pem)"
```

Salve o `Id` retornado (será o `CLOUDFRONT_PUBLIC_KEY_ID`).

#### 2.3. Criar Key Group

```bash
aws cloudfront create-key-group \
  --key-group-config '{
    "Name": "cinevision-key-group",
    "Items": ["SEU_PUBLIC_KEY_ID_AQUI"],
    "Comment": "Key group for CineVision video signing"
  }'
```

#### 2.4. Associar Key Group à Distribuição

```bash
aws cloudfront update-distribution \
  --id E3RAQERX6C6ARN \
  --distribution-config file://cloudfront-config.json
```

#### 2.5. Atualizar `.env` do Backend

```env
CLOUDFRONT_DOMAIN=dcscincghoovk.cloudfront.net
CLOUDFRONT_DISTRIBUTION_ID=E3RAQERX6C6ARN
CLOUDFRONT_PUBLIC_KEY_ID=<ID da public key criada>
CLOUDFRONT_PRIVATE_KEY_SECRET_ARN=<ARN do secret no Secrets Manager>
CLOUDFRONT_URL_TTL_SECONDS=14400
```

## ✅ O que já foi feito:

1. ✅ Política do bucket S3 atualizada para permitir acesso do `cinevision-uploader`
2. ✅ Endpoint backend criado para gerar URLs assinadas (`/api/v1/content-language-upload/public/video-url/:languageId`)
3. ✅ Fallback para URLs assinadas do S3 quando CloudFront não estiver configurado
4. ✅ Upload dos vídeos do "A Hora do Mal" (dublado e legendado) - já no S3
5. 🔄 Upload dos vídeos do "Lilo & Stitch" em andamento

## 📋 Status Atual:

### Bucket S3: `cinevision-video`
- **Região**: us-east-2
- **Política**: Configurada para CloudFront E acesso direto com credenciais
- **Block Public Access**: Ativo (correto para segurança)

### Vídeos no S3:
- ✅ A Hora do Mal - Dublado (2.2 GB)
- ✅ A Hora do Mal - Legendado (1.1 GB)
- 🔄 Lilo & Stitch - Dublado (1.9 GB) - uploading
- ⏳ Lilo & Stitch - Legendado - aguardando

### CloudFront:
- **Distribuição ID**: E3RAQERX6C6ARN
- **Domínio**: dcscincghoovk.cloudfront.net
- **Status**: Não configurado completamente (sem chaves de assinatura)

## 🚀 Próximos Passos:

1. Execute o comando IAM acima para dar permissões ao `cinevision-uploader`
2. Aguarde o upload do Lilo & Stitch completar (em progresso)
3. Teste os vídeos no frontend
4. (Opcional) Configure CloudFront para melhor performance

## 🔧 Troubleshooting:

### Se vídeos retornarem 403:
- Verifique se a policy IAM foi aplicada: `aws iam get-user-policy --user-name cinevision-uploader --policy-name CinevisionVideoFullAccess`
- Verifique a política do bucket: `aws s3api get-bucket-policy --bucket cinevision-video`

### Se upload falhar:
- Verifique credenciais AWS no `.env`
- Verifique se há espaço no bucket
- Verifique conectividade com AWS
