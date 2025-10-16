# ✅ Checklist de Deploy - Sistema de Processamento de Vídeos

## 🪣 **1. Criar/Verificar Buckets S3**

### Buckets Necessários:

```bash
# 1. Bucket de vídeos (já existe ✅)
aws s3api head-bucket --bucket cinevision-video --region us-east-2

# 2. Bucket de capas (já existe ✅)
aws s3api head-bucket --bucket cinevision-cover --region us-east-1

# 3. Bucket HLS (PRECISA CRIAR ⚠️)
aws s3api create-bucket \
  --bucket cinevision-hls \
  --region us-east-2 \
  --create-bucket-configuration LocationConstraint=us-east-2
```

### Configurar CORS (em TODOS os buckets):

```bash
# Aplicar CORS no cinevision-video
aws s3api put-bucket-cors --bucket cinevision-video --cors-configuration file://cors-config.json

# Aplicar CORS no cinevision-hls
aws s3api put-bucket-cors --bucket cinevision-hls --cors-configuration file://cors-config.json
```

**cors-config.json:**
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

---

## 🔐 **2. Configurar Permissões IAM**

### Policy para `cinevision-uploader`:

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
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-video/*",
        "arn:aws:s3:::cinevision-hls/*",
        "arn:aws:s3:::cinevision-cover/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-video",
        "arn:aws:s3:::cinevision-hls",
        "arn:aws:s3:::cinevision-cover"
      ]
    }
  ]
}
```

**Aplicar:**
```bash
aws iam put-user-policy \
  --user-name cinevision-uploader \
  --policy-name S3FullAccessVideoBuckets \
  --policy-document file://s3-policy.json
```

---

## 📦 **3. Instalar Dependências**

### Backend:

```bash
cd backend

# Instalar FFmpeg (Windows)
# Baixar de: https://www.gyan.dev/ffmpeg/builds/
# Adicionar ao PATH do sistema

# Verificar instalação
ffmpeg -version
ffprobe -version

# Instalar dependências Node.js
npm install
```

### Frontend:

```bash
cd frontend

# Instalar HLS.js
npm install hls.js

# Verificar package.json
npm list hls.js
```

---

## ⚙️ **4. Configurar Variáveis de Ambiente**

### Backend `.env`:

```env
# AWS Configuration
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here

# S3 Buckets
S3_VIDEO_BUCKET=cinevision-video
S3_HLS_BUCKET=cinevision-hls
S3_COVER_BUCKET=cinevision-cover

# FFmpeg (opcional, auto-detecta se estiver no PATH)
FFMPEG_PATH=C:/ffmpeg/bin/ffmpeg.exe
FFPROBE_PATH=C:/ffmpeg/bin/ffprobe.exe

# Transcoding
TRANSCODING_WORK_DIR=C:/tmp/transcoding
```

### Frontend `.env`:

```env
NEXT_PUBLIC_API_URL=https://api.cinevision.com
# ou
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 🗄️ **5. Verificar Banco de Dados**

### Tabela `content_languages` - Campos Necessários:

```sql
-- Verificar se todos os campos existem
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'content_languages'
ORDER BY ordinal_position;
```

**Campos Essenciais:**
- ✅ `id` (uuid)
- ✅ `content_id` (uuid)
- ✅ `language_type` (varchar)
- ✅ `language_code` (varchar)
- ✅ `video_url` (text)
- ✅ `video_storage_key` (text)
- ✅ `hls_master_url` (text)
- ✅ `upload_status` (varchar) - DEFAULT 'pending'

**Se algum campo estiver faltando:**
```sql
ALTER TABLE content_languages
ADD COLUMN hls_master_url TEXT,
ADD COLUMN upload_status VARCHAR(50) DEFAULT 'pending';
```

---

## 🧪 **6. Testar Sistema**

### Teste 1: Upload de MP4 (< 500MB)

1. Login como admin
2. Criar novo filme
3. Adicionar idioma "Dublado PT-BR"
4. Upload arquivo MP4 de 100MB
5. **Resultado Esperado:**
   - Upload completa
   - Status: `processing` → `completed`
   - `video_url` populado
   - `hls_master_url` = NULL
   - Vídeo reproduz no player

### Teste 2: Upload de MKV (< 500MB)

1. Upload arquivo MKV de 200MB
2. **Resultado Esperado:**
   - Upload completa
   - Status: `processing` (conversão MKV → MP4)
   - Após 5-10 min: Status = `completed`
   - `video_url` com MP4 convertido
   - Vídeo reproduz no player

### Teste 3: Upload de MP4 Grande (> 500MB)

1. Upload arquivo MP4 de 1GB
2. **Resultado Esperado:**
   - Upload completa
   - Status: `processing` (transcodificação HLS)
   - Após 15-30 min: Status = `completed`
   - `hls_master_url` populado
   - Player carrega HLS com múltiplas qualidades
   - Adaptive bitrate funciona

### Teste 4: Telegram Bot

1. Fazer compra no Telegram
2. **Resultado Esperado:**
   - Bot envia mensagem com botões de idioma
   - Clicar botão → Recebe presigned URL
   - Link válido por 4 horas
   - Download funciona

---

## 🚀 **7. Deploy em Produção**

### Backend (Render/Railway):

```bash
# Build
npm run build

# Start
npm run start:prod

# Variáveis de ambiente (configurar no painel):
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_VIDEO_BUCKET=cinevision-video
S3_HLS_BUCKET=cinevision-hls
FFMPEG_PATH=/usr/bin/ffmpeg  # Em Linux
TRANSCODING_WORK_DIR=/tmp/transcoding
```

### Frontend (Vercel):

```bash
# Build
npm run build

# Deploy
vercel --prod

# Variáveis de ambiente:
NEXT_PUBLIC_API_URL=https://api.cinevision.com
```

---

## 📊 **8. Monitoramento**

### Logs para Acompanhar:

```bash
# Backend logs
grep "Background" backend.log
grep "VideoProcessorService" backend.log
grep "HLS" backend.log

# Filtrar erros
grep "ERROR" backend.log | grep "video"
```

### Métricas S3:

```bash
# Tamanho dos buckets
aws s3 ls s3://cinevision-video --recursive --summarize --human-readable
aws s3 ls s3://cinevision-hls --recursive --summarize --human-readable
```

### Verificar Processamento:

```bash
# Ver todos os vídeos em processamento
curl https://api.cinevision.com/api/v1/content-language-upload/processing-status/{language_id}
```

---

## 🐛 **9. Troubleshooting**

### Problema: "HLS not supported"
**Solução:** Verificar se `hls.js` está instalado no frontend

### Problema: "MKV not converting"
**Solução:**
1. Verificar se FFmpeg está instalado
2. Checar logs: `grep "convertMKVToMP4" backend.log`

### Problema: "Upload succeeds but status stays 'processing'"
**Solução:**
1. Verificar logs de background processing
2. Checar permissões S3
3. Verificar espaço em disco no servidor

### Problema: "Video plays but no quality selection"
**Solução:**
1. Verificar se HLS foi gerado corretamente
2. Checar se `hls_master_url` está populado
3. Ver console do browser para erros HLS.js

---

## ✅ **10. Checklist Final**

Antes de considerar o deploy completo:

- [ ] Bucket `cinevision-hls` criado
- [ ] CORS configurado em todos os buckets
- [ ] Permissões IAM atualizadas
- [ ] FFmpeg instalado e funcionando
- [ ] HLS.js instalado no frontend
- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados atualizado
- [ ] Upload de MP4 testado ✅
- [ ] Upload de MKV testado ✅
- [ ] HLS gerado para arquivo > 500MB ✅
- [ ] Player reproduz HLS com qualidades ✅
- [ ] Telegram bot entrega vídeo ✅
- [ ] Processamento em background funciona ✅
- [ ] Logs sem erros críticos
- [ ] Monitoramento configurado

---

## 🎯 Status Atual

| Componente | Status | Observação |
|------------|--------|------------|
| **Backend Processing** | ✅ Implementado | Código completo |
| **Frontend Player** | ✅ Implementado | HLS.js integrado |
| **Bucket cinevision-video** | ✅ Existente | us-east-2 |
| **Bucket cinevision-cover** | ✅ Existente | us-east-1 |
| **Bucket cinevision-hls** | ⚠️ Criar | Necessário para HLS |
| **FFmpeg** | ⚠️ Instalar | Necessário para conversão |
| **Permissões S3** | ⚠️ Atualizar | Adicionar cinevision-hls |

---

## 📝 Próximos Passos

1. **Criar bucket `cinevision-hls`**
2. **Atualizar permissões IAM**
3. **Testar upload de MKV**
4. **Deploy em staging**
5. **Testes de carga**
6. **Deploy em produção**

---

## 🆘 Suporte

Em caso de problemas:
1. Verificar logs do backend
2. Verificar console do navegador (frontend)
3. Verificar status via endpoint `/processing-status`
4. Checar permissões S3
5. Validar variáveis de ambiente

**Logs Principais:**
- `[Background]` - Processamento assíncrono
- `[VideoProcessorService]` - Conversão/transcodificação
- `[HLS]` - Player HLS.js
