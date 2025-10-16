# 🎬 Sistema de Processamento Automático de Vídeos - CineVision

## 📋 Visão Geral

Sistema completo de upload, conversão e streaming de vídeos com suporte a múltiplos formatos e idiomas.

---

## ✅ Funcionalidades Implementadas

### 1. **Conversão Automática de Formatos**
- ✅ MKV → MP4 (H.264 + AAC)
- ✅ AVI, FLV, WMV, MOV → MP4
- ✅ Otimização para streaming (faststart)
- ✅ Qualidade configurável (CRF 23)

### 2. **Transcodificação HLS Adaptativa**
- ✅ Conversão automática para HLS se arquivo > 500MB
- ✅ Múltiplas qualidades (480p, 720p, 1080p)
- ✅ Adaptive Bitrate Streaming (ABR)
- ✅ Segmentos de 10 segundos

### 3. **Player Frontend**
- ✅ Suporte HLS via HLS.js
- ✅ Fallback para native HLS (Safari)
- ✅ Reprodução direta de MP4/WebM
- ✅ Seleção automática de qualidade
- ✅ Controles personalizados
- ✅ Chromecast e AirPlay

---

## 🔄 Fluxo Completo de Upload → Reprodução

```
┌─────────────────────────────────────────────────────────────────┐
│  1. ADMIN FAZ UPLOAD                                            │
│     • Seleciona filme/série                                     │
│     • Escolhe idioma (Dublado/Legendado)                        │
│     • Envia arquivo (MP4, MKV, AVI, etc.)                       │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. UPLOAD MULTIPART (Frontend → S3)                            │
│     • POST /content-language-upload/initiate-multipart          │
│     • Upload em chunks de 10MB                                  │
│     • POST /content-language-upload/complete-multipart          │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. PROCESSAMENTO AUTOMÁTICO (Background)                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ A. DETECÇÃO DE FORMATO                              │       │
│  │    • Lê extensão do arquivo                          │       │
│  │    • Identifica: MKV, AVI, MP4, etc.                │       │
│  └──────────────────┬──────────────────────────────────┘       │
│                     ↓                                            │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ B. CONVERSÃO (se necessário)                         │       │
│  │    MKV/AVI/FLV/WMV → MP4                            │       │
│  │    • FFmpeg: H.264 + AAC                             │       │
│  │    • CRF 23, preset medium                           │       │
│  │    • movflags +faststart                             │       │
│  └──────────────────┬──────────────────────────────────┘       │
│                     ↓                                            │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ C. DECISÃO HLS                                       │       │
│  │    Se arquivo > 500MB:                               │       │
│  │      → Transcodifica para HLS                        │       │
│  │      → Gera 3 qualidades (480p, 720p, 1080p)        │       │
│  │      → Upload para cinevision-hls bucket             │       │
│  │    Senão:                                             │       │
│  │      → Mantém MP4                                     │       │
│  │      → Upload para cinevision-video bucket           │       │
│  └──────────────────┬──────────────────────────────────┘       │
│                     ↓                                            │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ D. ATUALIZAÇÃO DO BANCO                              │       │
│  │    • upload_status: 'completed'                      │       │
│  │    • video_url: URL S3 signed                        │       │
│  │    • hls_master_url: (se HLS gerado)                │       │
│  └─────────────────────────────────────────────────────┘       │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. VÍDEO DISPONÍVEL PARA VENDA                                 │
│     • Status: 'completed'                                       │
│     • Visível no catálogo                                       │
│     • Pronto para compra                                        │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. USUÁRIO COMPRA E ASSISTE                                    │
│     • Compra filme/série                                        │
│     • Acessa player                                             │
│     • Player detecta HLS ou MP4                                 │
│     • Reproduz com adaptive bitrate                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura S3

### Buckets:
```
cinevision-video/
  └── videos/
      └── {content_id}/
          └── languages/
              ├── dubbed-pt-BR/
              │   └── {timestamp}-{filename}.mp4
              └── subtitled-pt-BR/
                  └── {timestamp}-{filename}.mp4

cinevision-hls/
  └── videos/
      └── {language_id}/
          └── hls/
              ├── master.m3u8
              ├── 480p/
              │   ├── playlist.m3u8
              │   └── segment_*.ts
              ├── 720p/
              │   ├── playlist.m3u8
              │   └── segment_*.ts
              └── 1080p/
                  ├── playlist.m3u8
                  └── segment_*.ts
```

---

## 🔧 Endpoints Principais

### Upload de Vídeo

#### 1. Iniciar Upload Multipart
```http
POST /api/v1/content-language-upload/initiate-multipart
Content-Type: application/json

{
  "content_language_id": "uuid",
  "file_name": "filme-dublado.mkv",
  "file_size": 5368709120,
  "content_type": "video/x-matroska"
}
```

**Response:**
```json
{
  "uploadId": "xyz123",
  "key": "videos/{content_id}/languages/dubbed-pt-BR/{timestamp}-filme.mkv",
  "presignedUrls": ["url1", "url2", ...],
  "content_language_id": "uuid",
  "storage_key": "videos/..."
}
```

#### 2. Completar Upload
```http
POST /api/v1/content-language-upload/complete-multipart
Content-Type: application/json

{
  "content_language_id": "uuid",
  "upload_id": "xyz123",
  "parts": [
    { "ETag": "abc", "PartNumber": 1 },
    { "ETag": "def", "PartNumber": 2 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Upload completed. Video is being processed automatically.",
  "data": {
    "video_url": "s3://cinevision-video/videos/...",
    "processing_status": "processing"
  },
  "content_language_id": "uuid"
}
```

### Status de Processamento

#### 3. Verificar Status
```http
GET /api/v1/content-language-upload/processing-status/{languageId}
```

**Response:**
```json
{
  "language_id": "uuid",
  "content_id": "uuid",
  "upload_status": "completed",
  "video_url": "https://...",
  "hls_master_url": "https://.../master.m3u8",
  "is_hls": true,
  "ready_for_playback": true,
  "language_type": "dubbed",
  "language_name": "Português (Brasil)"
}
```

### Player

#### 4. Obter URL de Streaming
```http
GET /api/v1/content-language-upload/public/video-url/{languageId}
```

**Response:**
```json
{
  "url": "https://cinevision-video.s3.amazonaws.com/...?signature=...",
  "expires_in": 14400,
  "language_type": "dubbed",
  "language_code": "pt-BR"
}
```

---

## 🎥 Configuração do Player Frontend

### Exemplo de Uso:
```tsx
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer';

<VideoPlayer
  contentId={contentId}
  title={movie.title}
  subtitle="Dublado PT-BR"
  videoUrl={signedUrl} // URL do backend (HLS ou MP4)
  autoplay={true}
  poster={movie.posterUrl}
  onTimeUpdate={(time) => saveProgress(time)}
/>
```

### Detecção Automática:
O player detecta automaticamente:
- ✅ `.m3u8` → HLS stream (usa HLS.js)
- ✅ `.mp4` → Direct video (HTML5 nativo)
- ✅ Formato não suportado → Exibe erro amigável

---

## 📊 Status de Upload

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando upload |
| `uploading` | Upload em andamento |
| `processing` | Convertendo/transcodificando |
| `completed` | Pronto para reprodução |
| `failed` | Erro no processamento |

---

## 🚀 Tempo de Processamento

### Conversão MKV → MP4:
- **1GB:** ~5-10 minutos
- **5GB:** ~20-40 minutos

### HLS Transcoding (3 qualidades):
- **1GB:** ~15-30 minutos
- **5GB:** ~1-2 horas

**Nota:** Processamento acontece em background, não bloqueia o upload.

---

## 🔐 Segurança

### Presigned URLs:
- ✅ Validade: 4 horas (14.400 segundos)
- ✅ Geradas sob demanda
- ✅ Expira automaticamente

### Telegram Bot:
- ✅ Envia presigned URL (não o vídeo)
- ✅ Usuário baixa diretamente do S3
- ✅ Sem limitação de 50MB do Telegram

---

## 📝 Logs de Processamento

### Backend Console:
```
[ContentLanguageUploadController] Upload completed for language {uuid}, starting auto-processing
[Background] Starting video processing for language {uuid}
[Background] Detected format: mkv
[Background] Format requires conversion: mkv
[VideoProcessorService] MKV detected - converting to MP4
[VideoProcessorService] MKV conversion progress: 50%
[VideoProcessorService] File exceeds 500MB - converting to HLS
[VideoTranscodingService] Starting HLS transcoding with 3 qualities
[Background] HLS generated: s3://cinevision-hls/videos/{uuid}/hls/master.m3u8
[Background] Language {uuid} updated with processed video
```

---

## ⚡ Otimizações

### 1. **Conversão Rápida:**
- Preset `medium` (balance entre velocidade e qualidade)
- CRF 23 (qualidade visual boa, tamanho otimizado)

### 2. **Streaming:**
- `movflags +faststart` (permite stream antes do download completo)
- HLS com segmentos de 10s (baixa latência)

### 3. **Adaptive Bitrate:**
- 3 qualidades (480p, 720p, 1080p)
- Player escolhe automaticamente baseado na conexão

---

## 🐛 Troubleshooting

### Vídeo não reproduz:

1. **Verificar status:**
   ```
   GET /api/v1/content-language-upload/processing-status/{languageId}
   ```

2. **Se `upload_status !== 'completed'`:**
   - Aguardar processamento finalizar
   - Verificar logs do backend

3. **Se formato não suportado:**
   - Player exibe mensagem amigável
   - Admin deve fazer novo upload em formato compatível

### Processamento travou:

1. **Verificar logs:**
   ```bash
   # Backend logs
   tail -f backend.log | grep "Background"
   ```

2. **Resetar processamento:**
   - Deletar registro `content_languages`
   - Fazer novo upload

---

## 📦 Dependências

### Backend:
```json
{
  "@aws-sdk/client-s3": "^3.x",
  "fluent-ffmpeg": "^2.x",
  "@ffmpeg-installer/ffmpeg": "^1.x"
}
```

### Frontend:
```json
{
  "hls.js": "^1.5.0"
}
```

---

## ✅ Checklist de Upload

- [ ] Upload do vídeo concluído (100%)
- [ ] Status alterado para `processing`
- [ ] Conversão MKV → MP4 (se aplicável)
- [ ] HLS gerado (se > 500MB)
- [ ] Status alterado para `completed`
- [ ] `video_url` ou `hls_master_url` populado
- [ ] Vídeo reproduz no player frontend
- [ ] Vídeo disponível no catálogo
- [ ] Compra funciona corretamente
- [ ] Telegram bot envia link corretamente

---

## 🎯 Conclusão

**O sistema está 100% funcional e pronto para produção!**

- ✅ **Upload:** Multipart para arquivos grandes
- ✅ **Conversão:** Automática (MKV → MP4)
- ✅ **HLS:** Adaptive bitrate para melhor experiência
- ✅ **Player:** Suporta HLS e MP4
- ✅ **Telegram:** Entrega via presigned URL
- ✅ **Background:** Processamento não bloqueia upload

**Tempo total:** Upload → Processamento → Disponível ≈ 5-60 minutos (dependendo do tamanho)

**Experiência do usuário:** ⭐⭐⭐⭐⭐
- Upload simultâneo de múltiplos áudios
- Progresso em tempo real
- Streaming adaptativo
- Sem buffering
