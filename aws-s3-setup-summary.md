# Configuração AWS S3 - CineVision

## ✅ Buckets Criados

1. **cinevision-filmes** - Armazenamento de filmes (média 1GB+ cada)
2. **cinevision-capas** - Armazenamento de imagens de capas/posters  
3. **cinevision-trailers** - Armazenamento de trailers opcionais

## ✅ Permissões Configuradas

### cinevision-filmes
- **Acesso**: Restrito (apenas usuários autenticados via backend)
- **CORS**: Habilitado para uploads do painel admin
- **Versionamento**: Habilitado
- **Ciclo de vida**: Arquivos > 180 dias movidos para Glacier

### cinevision-capas
- **Acesso**: Leitura pública habilitada
- **CORS**: Habilitado para uploads do painel admin
- **Política**: Permite GetObject público

### cinevision-trailers  
- **Acesso**: Leitura pública habilitada
- **CORS**: Habilitado para uploads do painel admin
- **Política**: Permite GetObject público

## ✅ CORS Configurado

Todos os buckets têm CORS habilitado com:
- **Métodos**: GET, PUT, POST, DELETE, HEAD
- **Headers**: Todos permitidos (*)
- **Origens**: Todas permitidas (*) 
- **ExposeHeaders**: ETag
- **MaxAgeSeconds**: 3000

## ✅ Versionamento e Ciclo de Vida

### cinevision-filmes
- **Versionamento**: Habilitado
- **Regra de ciclo de vida**: Arquivos > 180 dias → Glacier

## ⚠️ Limitações Encontradas

### Usuário IAM
- **Status**: Não foi possível criar devido a limitações de permissão
- **Usuário atual**: video-platform-admin não tem permissões IAM
- **Solução**: Usar credenciais do usuário atual ou solicitar criação manual

### Política IAM Recomendada
Arquivo: `cinevision-storage-policy.json`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject", 
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:PutObjectAcl",
        "s3:GetObjectAcl"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-filmes",
        "arn:aws:s3:::cinevision-filmes/*",
        "arn:aws:s3:::cinevision-capas", 
        "arn:aws:s3:::cinevision-capas/*",
        "arn:aws:s3:::cinevision-trailers",
        "arn:aws:s3:::cinevision-trailers/*"
      ]
    }
  ]
}
```

## ✅ Recursos Habilitados

### Multipart Upload
- **Status**: Habilitado por padrão em todos os buckets
- **Capacidade**: Suporte a arquivos até 5TB
- **Uso**: Ideal para filmes grandes (1GB+)

### URLs Assinadas (Pre-signed URLs)
- **Status**: Habilitado por padrão
- **Uso**: Streaming seguro de filmes
- **Controle**: Via backend com autenticação

## 📋 Próximos Passos

1. **Criar usuário IAM manualmente** (cinevision-storage-user)
2. **Aplicar política IAM** do arquivo `cinevision-storage-policy.json`
3. **Gerar credenciais** (Access Key + Secret)
4. **Configurar no backend** as credenciais AWS
5. **Testar uploads** via painel admin
6. **Testar streaming** com URLs assinadas

## 🔧 Integração com Backend

### Variáveis de Ambiente Necessárias
```env
AWS_ACCESS_KEY_ID=<access_key>
AWS_SECRET_ACCESS_KEY=<secret_key>
AWS_REGION=us-east-1
AWS_S3_BUCKET_FILMES=cinevision-filmes
AWS_S3_BUCKET_CAPAS=cinevision-capas  
AWS_S3_BUCKET_TRAILERS=cinevision-trailers
```

### URLs dos Buckets
- **Filmes**: https://cinevision-filmes.s3.us-east-1.amazonaws.com
- **Capas**: https://cinevision-capas.s3.us-east-1.amazonaws.com
- **Trailers**: https://cinevision-trailers.s3.us-east-1.amazonaws.com