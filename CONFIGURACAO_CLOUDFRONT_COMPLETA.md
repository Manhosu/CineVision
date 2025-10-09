# 🚀 Configuração CloudFront + Signed URLs - CineVision

## 📋 Resumo do que foi feito automaticamente

✅ **Buckets S3 criados:**
- `cinevision-hls` - Vídeos processados em HLS
- `cinevision-cover` - Capas e imagens

✅ **CORS configurado** em ambos os buckets

✅ **Par de chaves RSA gerado (2048 bits):**
- Chave privada: `C:/tmp/cinevision-keys/private_key.pem`
- Chave pública: `C:/tmp/cinevision-keys/public_key.pem`

---

## 🔧 Configuração Manual (por Dudu)

### Passo 1: Criar Origin Access Control (OAC) no Console AWS

1. Acesse: **CloudFront Console** → **Origin access** → **Create control setting**

2. Preencha:
   - **Name:** `cinevision-hls-oac`
   - **Description:** `OAC for CineVision HLS streaming`
   - **Signing behavior:** `Sign requests (recommended)`
   - **Origin type:** `S3`

3. Clique em **Create**

4. **Anote o ID do OAC** (ex: `E2QWRTYUIOP`)

---

### Passo 2: Criar Distribuição CloudFront

1. Acesse: **CloudFront Console** → **Create distribution**

#### **Origin Settings:**
- **Origin domain:** `cinevision-hls.s3.us-east-1.amazonaws.com`
- **Origin path:** deixe vazio
- **Name:** `cinevision-hls-origin`
- **Origin access:** `Origin access control settings (recommended)`
- **Origin access control:** Selecione o OAC criado no Passo 1

#### **Default cache behavior:**
- **Path pattern:** `Default (*)`
- **Compress objects automatically:** `Yes`
- **Viewer protocol policy:** `Redirect HTTP to HTTPS`
- **Allowed HTTP methods:** `GET, HEAD, OPTIONS`
- **Restrict viewer access:** `Yes` ✅ **IMPORTANTE**
  - **Trusted key groups:** (Selecione após criar no Passo 4)

#### **Cache key and origin requests:**
- **Cache policy:** `CachingOptimized`
- **Origin request policy:** `CORS-S3Origin`
- **Response headers policy:** `CORS-with-preflight-and-SecurityHeadersPolicy`

#### **Settings:**
- **Price class:** `Use North America, Europe, Asia, Middle East, and Africa`
- **Alternate domain names (CNAMEs):** `cdn.cinevision.app` (opcional)
- **Custom SSL certificate:** (Configure ACM no Passo 3)
- **Supported HTTP versions:** `HTTP/2, HTTP/3`
- **Default root object:** deixe vazio
- **Standard logging:** `Off` (ou configure se desejar)

2. **NÃO CLIQUE EM CREATE AINDA** - Antes, vá para o Passo 3

---

### Passo 3: Emitir Certificado ACM (AWS Certificate Manager)

1. Acesse: **ACM Console** (região **us-east-1** obrigatório para CloudFront)

2. Clique em **Request certificate**

3. Preencha:
   - **Certificate type:** `Public certificate`
   - **Fully qualified domain name:** `cdn.cinevision.app`
   - **Add another name:** `*.cdn.cinevision.app` (opcional, para subdomínios)
   - **Validation method:** `DNS validation` ✅ **RECOMENDADO**

4. Clique em **Request**

5. **Validar certificado via DNS:**
   - Após criar, abra o certificado
   - Copie os registros CNAME exibidos
   - Adicione esses registros no seu provedor de DNS (ex: Cloudflare, Route 53)
   - Aguarde validação (pode levar de 5 min a 30 min)

6. **Aguarde status:** `Issued` ✅

7. **Volte para a distribuição CloudFront:**
   - Em **Custom SSL certificate:** selecione o certificado criado
   - **Agora pode clicar em Create distribution**

---

### Passo 4: Criar Public Key e Key Group

#### 4.1 - Criar Public Key

1. Acesse: **CloudFront Console** → **Public keys** → **Create public key**

2. Preencha:
   - **Name:** `cinevision-signing-key`
   - **Key value:** Cole o conteúdo de `C:/tmp/cinevision-keys/public_key.pem`

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

3. Clique em **Create**

4. **Anote o ID da Public Key** (ex: `K2ABC123DEF456`)

#### 4.2 - Criar Key Group

1. Acesse: **CloudFront Console** → **Key groups** → **Create key group**

2. Preencha:
   - **Name:** `cinevision-key-group`
   - **Public keys:** Selecione a chave criada acima

3. Clique em **Create**

4. **Anote o ID do Key Group** (ex: `KG1ABC123DEF456`)

---

### Passo 5: Associar Key Group à Distribuição

1. Volte para **CloudFront Console** → **Distributions**

2. Selecione a distribuição criada

3. Clique em **Edit**

4. Vá até **Restrict viewer access:**
   - Marque **Yes**
   - **Trusted key groups:** Selecione o Key Group criado
   - **Remove** qualquer Trusted signer se aparecer

5. Clique em **Save changes**

6. **Aguarde deploy** (status: `Deployed`)

---

### Passo 6: Configurar Bucket Policy com OAC

1. Acesse **S3 Console** → **cinevision-hls** → **Permissions**

2. Em **Bucket policy**, cole:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::cinevision-hls/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::912928332688:distribution/XXXXXXXXXXXXX"
        }
      }
    }
  ]
}
```

**IMPORTANTE:** Substitua `XXXXXXXXXXXXX` pelo **ID da sua distribuição CloudFront**

3. Clique em **Save**

4. **Repita para `cinevision-cover`** se for usar CloudFront para imagens também

---

### Passo 7: Armazenar Private Key no AWS Secrets Manager

```bash
# Via AWS CLI:
aws secretsmanager create-secret \
  --name cinevision/cloudfront/private_key \
  --description "CloudFront private key for signed URLs" \
  --secret-string file://C:/tmp/cinevision-keys/private_key.pem \
  --region us-east-1
```

Ou pelo console:
1. **Secrets Manager Console** → **Store a new secret**
2. **Secret type:** `Other type of secret`
3. **Key:** `private_key`
4. **Value:** Cole o conteúdo de `C:/tmp/cinevision-keys/private_key.pem`
5. **Secret name:** `cinevision/cloudfront/private_key`
6. Clique em **Store**

**Anote o ARN do Secret** (ex: `arn:aws:secretsmanager:us-east-1:912928332688:secret:cinevision/cloudfront/private_key-AbCdEf`)

---

### Passo 8: Configurar CNAME no Provedor de DNS

1. Acesse seu provedor de DNS (Cloudflare, Route 53, etc.)

2. Adicione registro CNAME:
   - **Nome:** `cdn` (ou `cdn.cinevision.app` dependendo do provedor)
   - **Tipo:** `CNAME`
   - **Valor:** `d123abc456def.cloudfront.net` (domínio da sua distribuição CloudFront)
   - **TTL:** `Auto` ou `300`

3. Salve

4. **Aguarde propagação DNS** (5-30 min)

5. **Teste:** `https://cdn.cinevision.app/` (deve retornar erro 403, mas SSL deve funcionar)

---

## 🔑 Variáveis para o Backend

Após concluir os passos acima, atualize o `.env` do backend:

```env
# CloudFront Configuration
CLOUDFRONT_DOMAIN=d123abc456def.cloudfront.net
# Ou com domínio custom:
# CLOUDFRONT_DOMAIN=cdn.cinevision.app

CLOUDFRONT_KEY_GROUP_ID=KG1ABC123DEF456
CLOUDFRONT_PUBLIC_KEY_ID=K2ABC123DEF456
CLOUDFRONT_PRIVATE_KEY_SECRET_ARN=arn:aws:secretsmanager:us-east-1:912928332688:secret:cinevision/cloudfront/private_key-AbCdEf

# Assinatura de URLs
CLOUDFRONT_URL_TTL_SECONDS=3600

# Regiões
AWS_REGION=us-east-1
```

---

## 🧪 Testando a Configuração

### Teste 1: Acesso Direto (deve falhar)

```bash
# Sem assinatura - deve retornar 403 Forbidden
curl https://cdn.cinevision.app/videos/test/master.m3u8
# Expected: 403 Forbidden
```

### Teste 2: Signed URL (deve funcionar)

```bash
# No backend, gere uma Signed URL e teste:
curl "https://cdn.cinevision.app/videos/test/master.m3u8?Expires=...&Signature=...&Key-Pair-Id=..."
# Expected: 200 OK com conteúdo do arquivo
```

---

## 📊 Checklist de Configuração

- [ ] OAC criado e ID anotado
- [ ] Distribuição CloudFront criada
- [ ] Certificado ACM emitido em us-east-1
- [ ] Certificado validado via DNS (status: Issued)
- [ ] Certificado associado à distribuição
- [ ] Public Key criada no CloudFront
- [ ] Key Group criado e associado à distribuição
- [ ] Bucket policy atualizada com ARN da distribuição
- [ ] Private Key armazenada no Secrets Manager
- [ ] CNAME configurado no DNS
- [ ] Variáveis atualizadas no backend .env
- [ ] CloudFront deployment completo (status: Deployed)
- [ ] Teste de Signed URL funcionando

---

## 🎬 Próximos Passos Após Configuração

1. **Testar upload de vídeo** via sistema
2. **Processar para HLS**
3. **Gerar Signed URL** via backend
4. **Testar player** com HLS.js
5. **Testar casting** (Chromecast/AirPlay)
6. **Monitorar métricas** CloudFront
7. **Configurar invalidações** se necessário

---

## 📝 Informações Importantes

### IDs Gerados (a serem preenchidos por você):

```yaml
# Após configurar, preencha aqui:
CloudFront Distribution ID: _______________________
CloudFront Domain: _______________________
Key Group ID: _______________________
Public Key ID: _______________________
Secrets Manager ARN: _______________________
ACM Certificate ARN: _______________________
```

### Custos Estimados CloudFront:

- **Transferência de dados:** ~$0.085/GB (primeiros 10 TB/mês)
- **Requests HTTPS:** ~$0.01 por 10,000 requests
- **Signed URLs:** Sem custo adicional
- **Origin Access Control:** Sem custo adicional

### Recomendações de Segurança:

1. ✅ **Use sempre Signed URLs** para conteúdo premium
2. ✅ **TTL curto** (3600s) para maior controle
3. ✅ **Rotate chaves** a cada 6-12 meses
4. ✅ **Monitor CloudWatch** para acessos anômalos
5. ✅ **WAF** (opcional) para proteção extra

---

**Última atualização:** 9 de Outubro de 2025
**Versão:** 1.0.0
**Autor:** Claude Code + CineVision Team
