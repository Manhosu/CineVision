# 🚀 Próximos Passos - Sistema HLS CineVision

## ✅ O Que Foi Implementado

### Backend Services
1. **VideoProcessorController** - Endpoint para processar vídeos
   - `POST /api/v1/video-processor/process` - Processar vídeo (MKV→MP4 ou MP4→HLS)
   - `GET /api/v1/video-processor/status/:contentId` - Status do processamento
   - `GET /api/v1/video-processor/logs/:contentId` - Logs de conversão
   - `GET /api/v1/video-processor/stats` - Estatísticas de conversão

2. **VideoProcessorService** - Serviço de processamento automático
   - Detecta formato MKV e converte para MP4
   - Converte para HLS se arquivo > 500MB
   - Upload automático para bucket apropriado
   - Logging completo no Supabase

3. **VideoConversionLogsService** - Tracking de conversões
   - Registra todas as conversões
   - Atualiza progresso em tempo real
   - Marca conclusão/falha
   - Estatísticas de processamento

4. **CloudFrontSignerService** - Assinatura de URLs
   - Gera Signed URLs para HLS
   - Carrega chave privada do Secrets Manager
   - Suporte a TTL configurável (3600s)

### Frontend Components
1. **useHLS Hook** - Player HLS inteligente
   - Auto-detecta HLS vs MP4
   - Inicializa HLS.js ou Safari nativo
   - Gerencia múltiplas qualidades
   - Tratamento robusto de erros

2. **VideoPlayer** - Detecção de formatos
   - Detecta MKV/AVI/WMV não suportados
   - Exibe erro amigável
   - Opção para tentar outro idioma

### Database
- Tabela `video_conversion_logs` criada no Supabase
- Índices otimizados para queries rápidas

### AWS Infrastructure
- Buckets criados: `cinevision-hls`, `cinevision-cover`
- CORS configurado em todos os buckets
- Chaves RSA geradas (2048 bits):
  - Private Key: `C:/tmp/cinevision-keys/private_key.pem`
  - Public Key: `C:/tmp/cinevision-keys/public_key.pem`

---

## ⏳ Pendente - Configuração Manual CloudFront (Dudu)

### 1. Emitir Certificado ACM
```
Região: us-east-1 (obrigatório para CloudFront)
Domínio: cdn.cinevision.app
Validação: DNS (adicionar CNAME no provedor)
```

**Passos:**
1. AWS Console → Certificate Manager (us-east-1)
2. Request certificate → Public certificate
3. Domain name: `cdn.cinevision.app`
4. Validation: DNS validation
5. Copiar CNAME record
6. Adicionar CNAME no provedor de DNS
7. **Aguardar status: Issued** ⏱️

---

### 2. Criar Origin Access Control (OAC)
```
AWS Console → CloudFront → Origin access → Create control setting
Name: cinevision-hls-oac
Type: S3
Signing behavior: Sign requests (recommended)
```

**Anotar:** OAC ID (será usado na bucket policy)

---

### 3. Criar Distribuição CloudFront

**Origin Settings:**
```
Origin domain: cinevision-hls.s3.us-east-1.amazonaws.com
Origin access: Origin access control settings (recommended)
Origin access control: cinevision-hls-oac (criado no passo 2)
```

**Default cache behavior:**
```
Viewer protocol policy: Redirect HTTP to HTTPS
Allowed HTTP methods: GET, HEAD, OPTIONS
Cache key and origin requests: CachingOptimized
Compress objects automatically: Yes
```

**Settings:**
```
Alternate domain name (CNAME): cdn.cinevision.app
Custom SSL certificate: Selecionar certificado ACM criado
Supported HTTP versions: HTTP/2 and HTTP/3
```

**Anotar:**
- Distribution ID (ex: E1ABC2DEF3GHIJ)
- Distribution domain (ex: d123abc456def.cloudfront.net)

---

### 4. Criar Public Key no CloudFront

**Passos:**
1. CloudFront → Public keys → Create public key
2. Name: `cinevision-signing-key`
3. Key value: Colar conteúdo de `C:/tmp/cinevision-keys/public_key.pem`

**Conteúdo da Public Key:**
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw9OSBY2+Y0nseQXhCZTh
VPBEoXuyDNYRTzTJPx0pCQqw6j1XC8y7r8dJAh+YSK1uRTzzyP0sjfVBqOeTIsw1
am6Gbwp63PPMWuciDQty5Lzhy5EeYqRCkTZPg0n1q79JHGHRPL7eXTeSv3lSos+h
h/37CEvPvWTDEl1SFDV7wvUP/A/N4GlbNHYssug5EyElCuacUCd0CZ/bu+c8zo2x
ZZEbQgsHU16BPGL+IC+03jSJbFvo3z8yshSlzlfA4yggjKobwpj4FZTRQj8uuXI8
sB1xnOiDbN3Z6+coKp5izo4oC+A9DZ8OpVkPl9qlPgP90Ar+GIhn9ZbGsj4I2euu
xQIDAQAB
-----END PUBLIC KEY-----
```

**Anotar:** Public Key ID (ex: K2ABC123DEF456)

---

### 5. Criar Key Group

**Passos:**
1. CloudFront → Key groups → Create key group
2. Name: `cinevision-key-group`
3. Public keys: Selecionar `cinevision-signing-key`

**Anotar:** Key Group ID (ex: KG1ABC123DEF456)

---

### 6. Associar Key Group à Distribuição

**Passos:**
1. CloudFront → Distributions → Selecionar distribuição
2. Edit → Behaviors → Edit default behavior
3. Restrict viewer access: Yes
4. Trusted key groups: Selecionar `cinevision-key-group`
5. Save changes

**Aguardar:** Distribution status = Deployed ⏱️

---

### 7. Configurar Bucket Policy

Substituir `DISTRIBUTION_ID` pelo ID da distribuição:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::cinevision-hls/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::912928332688:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

**Aplicar em:**
1. S3 → cinevision-hls → Permissions → Bucket policy
2. Colar JSON acima (substituindo DISTRIBUTION_ID)
3. Save changes

---

### 8. Armazenar Private Key no Secrets Manager

**Via AWS CLI:**
```bash
aws secretsmanager create-secret \
  --name cinevision/cloudfront/private_key \
  --secret-string file://C:/tmp/cinevision-keys/private_key.pem \
  --region us-east-1
```

**Via Console:**
1. AWS Console → Secrets Manager (us-east-1)
2. Store a new secret → Other type of secret
3. Key/value:
   - Key: `privateKey`
   - Value: Colar conteúdo de `C:/tmp/cinevision-keys/private_key.pem`
4. Secret name: `cinevision/cloudfront/private_key`
5. Create secret

**Anotar:** Secret ARN (ex: `arn:aws:secretsmanager:us-east-1:912928332688:secret:cinevision/cloudfront/private_key-XXXXXX`)

---

### 9. Atualizar `.env` do Backend

Adicionar ao arquivo `backend/.env`:

```env
# CloudFront Configuration
CLOUDFRONT_DOMAIN=cdn.cinevision.app
CLOUDFRONT_KEY_GROUP_ID=KG1ABC123DEF456
CLOUDFRONT_PUBLIC_KEY_ID=K2ABC123DEF456
CLOUDFRONT_PRIVATE_KEY_SECRET_ARN=arn:aws:secretsmanager:us-east-1:912928332688:secret:cinevision/cloudfront/private_key-XXXXXX
CLOUDFRONT_URL_TTL_SECONDS=3600

# S3 Buckets
S3_HLS_BUCKET=cinevision-hls
S3_COVER_BUCKET=cinevision-cover
```

**Reiniciar backend:**
```bash
cd backend
npm run start:dev
```

---

### 10. Configurar CNAME no DNS

**No provedor de DNS:**
```
Tipo: CNAME
Nome: cdn
Valor: d123abc456def.cloudfront.net (domínio CloudFront)
TTL: 300 (5 minutos)
```

**Testar:**
```bash
nslookup cdn.cinevision.app
# Deve retornar o domínio CloudFront
```

---

## 🧪 Testes Após Configuração

### 1. Testar Signed URL Generation

**Endpoint:**
```bash
POST http://localhost:3001/api/v1/cdn/generate-signed-url
Content-Type: application/json
Authorization: Bearer <token>

{
  "url": "https://cdn.cinevision.app/videos/test/master.m3u8",
  "expiresIn": 3600
}
```

**Resposta esperada:**
```json
{
  "signedUrl": "https://cdn.cinevision.app/videos/test/master.m3u8?Expires=...&Signature=...&Key-Pair-Id=..."
}
```

---

### 2. Processar Vídeo de Teste

**Upload vídeo MKV:**
```bash
POST http://localhost:3001/api/v1/video-processor/process
Content-Type: application/json
Authorization: Bearer <token>

{
  "contentId": "UUID_DO_CONTEUDO",
  "inputPath": "s3://cinevision-filmes/videos/lilo---stitch-2025-dubbed.mkv",
  "languageId": "UUID_DO_IDIOMA",
  "languageType": "dubbed",
  "autoConvertToHLS": true
}
```

**Monitorar progresso:**
```bash
GET http://localhost:3001/api/v1/video-processor/status/:contentId
```

---

### 3. Testar Player HLS

**Acessar:**
```
http://localhost:3000/watch/:contentId?lang=:languageId
```

**Verificar:**
- [ ] Player carrega HLS automaticamente
- [ ] Múltiplas qualidades disponíveis (480p, 720p, 1080p)
- [ ] Mudança de qualidade funciona
- [ ] Buffer funciona corretamente
- [ ] Erro tratado adequadamente

---

### 4. Testar Chromecast/AirPlay

**Chromecast:**
- Conectar dispositivo Chromecast
- Clicar no botão de cast
- Verificar se vídeo inicia no Chromecast

**AirPlay:**
- Conectar Apple TV ou dispositivo AirPlay
- Clicar no botão AirPlay no player
- Verificar se vídeo inicia no dispositivo

---

## 📊 Métricas de Sucesso

Após testes completos, verificar:

- [x] Backend compilando sem erros
- [x] Frontend compilando sem erros
- [x] Buckets S3 criados
- [x] CORS configurado
- [x] Chaves RSA geradas
- [ ] Certificado ACM emitido
- [ ] CloudFront distribution criada
- [ ] Public Key e Key Group configurados
- [ ] Bucket policy aplicada
- [ ] Private key no Secrets Manager
- [ ] DNS CNAME configurado
- [ ] Signed URL funcionando
- [ ] Upload de vídeo funcionando
- [ ] Conversão MKV→MP4 funcionando
- [ ] Conversão MP4→HLS funcionando
- [ ] Player HLS reproduzindo
- [ ] Múltiplas qualidades funcionando
- [ ] Chromecast/AirPlay funcionando

---

## 📝 Checklist Dudu

### Urgente (Fazer Hoje)
- [ ] Emitir certificado ACM em us-east-1
- [ ] Validar certificado via DNS (adicionar CNAME)
- [ ] Aguardar certificado status = Issued

### Importante (Após Certificado)
- [ ] Criar OAC para cinevision-hls
- [ ] Criar distribuição CloudFront
- [ ] Criar Public Key com conteúdo de `C:/tmp/cinevision-keys/public_key.pem`
- [ ] Criar Key Group
- [ ] Associar Key Group à distribuição
- [ ] Aguardar distribuição status = Deployed

### Finalização
- [ ] Configurar bucket policy com ARN da distribuição
- [ ] Armazenar private key no Secrets Manager
- [ ] Atualizar `.env` do backend
- [ ] Reiniciar backend
- [ ] Configurar DNS CNAME
- [ ] Testar Signed URL
- [ ] Processar vídeo de teste
- [ ] Testar player HLS
- [ ] Testar Chromecast/AirPlay

---

## 🆘 Suporte

Se encontrar problemas:

1. **Certificado ACM não valida:**
   - Verificar CNAME no DNS
   - Aguardar propagação DNS (pode levar até 30min)

2. **CloudFront distribution não deploy:**
   - Verificar se certificado está Issued
   - Verificar se domínio customizado está correto

3. **Signed URL retorna 403:**
   - Verificar se Key Group está associado
   - Verificar se bucket policy está correta
   - Verificar se private key está no Secrets Manager

4. **Vídeo não reproduz:**
   - Verificar se HLS.js está carregado
   - Verificar URL do CloudFront
   - Verificar logs de conversão

---

**Última Atualização:** 9 de Outubro de 2025
**Status:** ✅ Backend pronto, ⏳ Aguardando configuração CloudFront manual
