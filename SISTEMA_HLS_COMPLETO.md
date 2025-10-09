# Sistema de Processamento de Vídeo e HLS - CineVision

## 📋 Sumário Executivo

O CineVision agora possui um sistema completo de processamento de vídeo que:

1. ✅ **Detecta e converte formatos MKV** para MP4 automaticamente
2. ✅ **Converte vídeos grandes** (>500MB) para HLS streaming adaptativo
3. ✅ **Gera múltiplas qualidades** (480p, 720p, 1080p) automaticamente
4. ✅ **Armazena vídeos HLS** em bucket dedicado S3 (`cinevision-hls`)
5. ✅ **Reproduz HLS no navegador** usando HLS.js
6. ✅ **Registra logs de conversão** no Supabase
7. ✅ **Suporta idiomas múltiplos** (dublado/legendado)

---

## 🏗️ Infraestrutura AWS

### Buckets S3 Criados

| Bucket | Uso | Status |
|--------|-----|--------|
| `cinevision-hls` | Vídeos HLS (playlists .m3u8 e segmentos .ts) | ✅ Criado |
| `cinevision-filmes` | Vídeos diretos (MP4) | ✅ Existente |
| `cinevision-capas` | Posters e thumbnails | ✅ Existente |

### Configurações S3

```javascript
// CORS configurado para cinevision-hls
{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}
```

---

## 🎬 Backend - Processamento de Vídeo

### Serviços Implementados

#### 1. **VideoProcessorService** (Novo)
📁 `backend/src/modules/video/services/video-processor.service.ts`

**Funcionalidades:**
- Detecta formato MKV e converte para MP4
- Verifica tamanho do arquivo (threshold: 500MB)
- Decide automaticamente entre MP4 direto ou HLS
- Upload para bucket apropriado

**Exemplo de uso:**
```typescript
const result = await videoProcessorService.processVideo({
  contentId: 'abc-123',
  inputPath: 's3://cinevision-filmes/videos/movie.mkv',
  autoConvertToHLS: true
});

// Resultado:
{
  success: true,
  contentId: 'abc-123',
  originalFormat: 'mkv',
  finalFormat: 'hls',
  hlsGenerated: true,
  hlsMasterUrl: 's3://cinevision-hls/videos/abc-123/hls/master.m3u8',
  processingTime: 245
}
```

#### 2. **VideoTranscodingService** (Existente - Melhorado)
📁 `backend/src/modules/video/services/video-transcoding.service.ts`

**Funcionalidades:**
- Gera HLS com múltiplas qualidades
- Fragmentação em segmentos de 6 segundos
- Cria playlist master (.m3u8)
- Upload automático para S3
- Tracking de progresso

**Qualidades Geradas:**
| Qualidade | Resolução | Bitrate | CRF | Preset |
|-----------|-----------|---------|-----|--------|
| 1080p | 1920x1080 | 5000 kbps | 23 | medium |
| 720p | 1280x720 | 3000 kbps | 24 | medium |
| 480p | 854x480 | 1500 kbps | 26 | medium |
| 360p | 640x360 | 800 kbps | 28 | fast |

---

## 💾 Banco de Dados - Supabase

### Tabela Criada: `video_conversion_logs`

```sql
CREATE TABLE video_conversion_logs (
  id UUID PRIMARY KEY,
  content_id UUID REFERENCES content(id),
  input_file_path TEXT NOT NULL,
  input_format VARCHAR(10),
  input_size_bytes BIGINT,
  output_format VARCHAR(10),
  output_hls_path TEXT,
  conversion_type VARCHAR(50), -- 'mkv_to_mp4', 'mp4_to_hls', 'mkv_to_hls'
  status VARCHAR(20) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  qualities_generated TEXT[],
  duration_seconds INTEGER,
  processing_time_seconds INTEGER,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Campos Atualizados em `content`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `video_url` | TEXT | URL vídeo direto (MP4) |
| `hls_master_url` | TEXT | URL playlist master HLS |
| `hls_base_path` | TEXT | Base path HLS no S3 |
| `processing_status` | VARCHAR | Status do processamento |
| `processing_progress` | INTEGER | Progresso 0-100% |

### Campos Atualizados em `content_languages`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `video_url` | TEXT | URL vídeo direto para idioma |
| `hls_master_url` | TEXT | URL HLS para idioma |
| `hls_base_path` | TEXT | Base path HLS idioma |

---

## 🎮 Frontend - Player HLS

### Hook Criado: `useHLS`
📁 `frontend/src/hooks/useHLS.ts`

**Funcionalidades:**
- Detecta automaticamente HLS vs MP4
- Inicializa HLS.js se necessário
- Fallback para suporte nativo (Safari)
- Gerenciamento de qualidades
- Tratamento de erros

**Exemplo de uso:**
```typescript
const {
  videoRef,
  isHLS,
  qualities,
  currentQuality,
  changeQuality,
  setAutoQuality
} = useHLS({
  videoUrl: content.video_url,
  hlsMasterUrl: content.hls_master_url,
  autoplay: true,
  startTime: resumePosition
});
```

### Biblioteca Instalada

```bash
npm install hls.js
```

**Versão:** Latest (^1.x.x)

---

## 🔄 Fluxo de Processamento Completo

### Cenário 1: Upload de MKV pequeno (<500MB)

```
1. Admin faz upload de movie.mkv (300MB)
   ↓
2. VideoProcessorService detecta MKV
   ↓
3. FFmpeg converte MKV → MP4
   ↓
4. Upload para cinevision-filmes
   ↓
5. content.video_url atualizado
   ↓
6. Player usa <video> nativo
```

### Cenário 2: Upload de MKV grande (>500MB)

```
1. Admin faz upload de movie.mkv (2GB)
   ↓
2. VideoProcessorService detecta MKV + tamanho grande
   ↓
3. FFmpeg converte MKV → MP4 (temporário)
   ↓
4. VideoTranscodingService gera HLS
   - Fragmenta em segmentos .ts
   - Gera playlists para cada qualidade
   - Cria master.m3u8
   ↓
5. Upload para cinevision-hls
   ↓
6. content.hls_master_url atualizado
   ↓
7. Player usa HLS.js
```

### Cenário 3: Upload de MP4 grande (>500MB)

```
1. Admin faz upload de movie.mp4 (1.5GB)
   ↓
2. VideoProcessorService detecta tamanho grande
   ↓
3. VideoTranscodingService gera HLS direto
   ↓
4. Upload para cinevision-hls
   ↓
5. content.hls_master_url atualizado
   ↓
6. Player usa HLS.js
```

---

## 📊 Estrutura de Arquivos HLS no S3

```
cinevision-hls/
└── videos/
    └── {content-id}/
        └── hls/
            ├── master.m3u8          # Playlist principal
            ├── 1080p/
            │   ├── playlist.m3u8    # Playlist 1080p
            │   ├── segment_000.ts
            │   ├── segment_001.ts
            │   └── ...
            ├── 720p/
            │   ├── playlist.m3u8
            │   ├── segment_000.ts
            │   └── ...
            ├── 480p/
            │   └── ...
            └── 360p/
                └── ...
```

### Exemplo de master.m3u8

```m3u8
#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720
720p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
480p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p/playlist.m3u8
```

---

## 🎯 Como Usar o Sistema

### Para Admins: Fazer Upload de Vídeos

**Opção 1: Via API (Recomendado para integração)**

```typescript
// Endpoint a ser criado
POST /api/v1/admin/videos/upload

FormData:
  - file: movie.mkv
  - contentId: abc-123
  - languageType: 'dubbed' | 'subtitled'
```

**Opção 2: Script de Upload em Massa**

```typescript
// backend/scripts/bulk-video-upload.ts
import { VideoProcessorService } from '../src/modules/video/services/video-processor.service';

const files = [
  { path: 'E:/movies/lilo-stitch-dubbed.mkv', contentId: '...', type: 'dubbed' },
  { path: 'E:/movies/superman-dubbed.mp4', contentId: '...', type: 'dubbed' }
];

for (const file of files) {
  const result = await videoProcessor.processVideo({
    contentId: file.contentId,
    inputPath: file.path,
    autoConvertToHLS: true
  });

  console.log(`Processed ${file.path}:`, result);
}
```

### Para Desenvolvedores: Integrar Player

```typescript
// Uso no componente
import { VideoContent } from '@/types/video';

function WatchPage({ content }: { content: VideoContent }) {
  // Player detecta automaticamente HLS ou MP4
  return (
    <VideoPlayer
      contentId={content.id}
      title={content.title}
      videoUrl={content.video_url}        // MP4 direto (opcional)
      hlsMasterUrl={content.hls_master_url} // HLS (opcional)
      poster={content.poster}
      autoplay={true}
    />
  );
}
```

---

## 🔧 Configuração do Ambiente

### Variáveis de Ambiente Backend

```env
# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_VIDEO_BUCKET=cinevision-filmes
S3_HLS_BUCKET=cinevision-hls

# FFmpeg
FFMPEG_PATH=C:/ffmpeg/bin/ffmpeg.exe  # Windows
FFPROBE_PATH=C:/ffmpeg/bin/ffprobe.exe
TRANSCODING_WORK_DIR=C:/tmp/transcoding
```

### Instalação do FFmpeg

**Windows:**
```bash
# Download: https://ffmpeg.org/download.html
# Extrair para C:/ffmpeg
# Adicionar ao PATH: C:/ffmpeg/bin
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Docker:**
```dockerfile
FROM node:18
RUN apt-get update && apt-get install -y ffmpeg
```

---

## 📈 Monitoramento e Logs

### Consultar Status de Conversão

```sql
-- Ver todas conversões em andamento
SELECT
  c.title,
  vcl.conversion_type,
  vcl.status,
  vcl.progress,
  vcl.qualities_generated,
  vcl.processing_time_seconds,
  vcl.created_at
FROM video_conversion_logs vcl
JOIN content c ON c.id = vcl.content_id
WHERE vcl.status = 'processing'
ORDER BY vcl.created_at DESC;
```

### Consultar Filmes Convertidos

```sql
-- Ver todos filmes com HLS
SELECT
  title,
  hls_master_url,
  processing_status,
  available_qualities
FROM content
WHERE hls_master_url IS NOT NULL
ORDER BY updated_at DESC;
```

---

## 🧪 Como Testar

### 1. Testar Conversão MKV → MP4

```bash
# No backend
npm run start:dev

# Em outro terminal
node -e "
const { VideoProcessorService } = require('./dist/modules/video/services/video-processor.service');
const service = new VideoProcessorService(configService, transcodingService);

service.processVideo({
  contentId: 'test-123',
  inputPath: 'E:/movies/test-video.mkv',
  autoConvertToHLS: false  // Força MP4 direto
}).then(result => console.log(result));
"
```

### 2. Testar Conversão para HLS

```bash
node -e "
service.processVideo({
  contentId: 'test-456',
  inputPath: 'E:/movies/test-video-large.mp4',
  autoConvertToHLS: true  // Força HLS
}).then(result => console.log(result));
"
```

### 3. Testar Player HLS no Frontend

```bash
# Frontend rodando em localhost:3000
# Abrir DevTools → Console

# Navegar para: http://localhost:3000/watch/{content-id}
# Verificar logs do HLS.js no console
# Testar mudança de qualidade
```

---

## ⚡ Otimizações Recomendadas

### 1. **Usar Fila de Processamento**

```typescript
// Implementar com Bull/Redis
import { Queue } from 'bull';

const videoQueue = new Queue('video-processing', {
  redis: { host: 'localhost', port: 6379 }
});

videoQueue.process(async (job) => {
  const { contentId, inputPath } = job.data;

  await videoProcessor.processVideo({
    contentId,
    inputPath,
    autoConvertToHLS: true
  });
});

// Adicionar job
videoQueue.add({ contentId: '...', inputPath: '...' });
```

### 2. **CloudFront para CDN**

```javascript
// Configurar distribuição CloudFront apontando para cinevision-hls
// Isso reduzirá latência e custos de bandwidth

// Atualizar URLs no código:
const hlsUrl = `https://d123456.cloudfront.net/videos/${contentId}/hls/master.m3u8`;
```

### 3. **Limpeza Automática de Arquivos Temporários**

```typescript
// Adicionar ao videoProcessor
private async cleanupTempFiles(jobWorkDir: string) {
  try {
    await fs.rm(jobWorkDir, { recursive: true, force: true });
    this.logger.log(`Cleaned up: ${jobWorkDir}`);
  } catch (error) {
    this.logger.warn(`Cleanup failed for ${jobWorkDir}:`, error);
  }
}
```

---

## 🐛 Resolução de Problemas

### Problema: MKV não converte

**Solução:**
```bash
# Verificar se FFmpeg está instalado
ffmpeg -version

# Verificar permissões de arquivo
ls -la /path/to/video.mkv

# Verificar logs
tail -f backend/logs/video-processing.log
```

### Problema: HLS não reproduz no navegador

**Solução:**
```javascript
// Verificar se HLS.js está carregado
console.log(Hls.isSupported());  // deve retornar true

// Verificar CORS do bucket
aws s3api get-bucket-cors --bucket cinevision-hls

// Verificar URL do master.m3u8
fetch('https://cinevision-hls.s3.amazonaws.com/videos/.../master.m3u8')
  .then(r => r.text())
  .then(console.log);
```

### Problema: Conversão muito lenta

**Solução:**
```typescript
// Ajustar preset do FFmpeg para 'faster' ou 'fast'
const settings = {
  ...qualitySettings,
  preset: 'faster'  // Troca: velocidade vs qualidade
};

// Ou processar em paralelo (cuidado com CPU)
const qualities = ['1080p', '720p', '480p'];
await Promise.all(qualities.map(q => transcodeQuality(q)));
```

---

## 📚 Próximos Passos

### Funcionalidades Futuras

1. **DRM (Digital Rights Management)**
   - Criptografia de vídeos com AES-128
   - Proteção contra download

2. **Thumbnails Automáticos**
   - Gerar sprite de thumbnails para scrubbing
   - Preview hover no player

3. **Análise de Qualidade**
   - VMAF scoring
   - Otimização automática de bitrate

4. **Transcrição Automática**
   - Gerar legendas com AWS Transcribe
   - Suporte multi-idioma

5. **Live Streaming**
   - Suporte para HLS live
   - Integração com OBS/RTMP

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs: `backend/logs/`
2. Consultar tabela: `video_conversion_logs`
3. Verificar S3: buckets `cinevision-hls` e `cinevision-filmes`

---

## ✅ Checklist de Implementação

- [x] Bucket S3 `cinevision-hls` criado
- [x] CORS configurado no bucket HLS
- [x] VideoProcessorService implementado
- [x] VideoTranscodingService atualizado
- [x] Tabela `video_conversion_logs` criada
- [x] HLS.js instalado no frontend
- [x] Hook `useHLS` criado
- [x] Tipos TypeScript atualizados
- [x] Suporte a MKV implementado
- [x] Suporte a múltiplas qualidades
- [x] Suporte a múltiplos idiomas
- [ ] Endpoint de upload admin (próximo passo)
- [ ] Interface admin para conversão
- [ ] CloudFront configurado
- [ ] Fila de processamento
- [ ] Testes E2E

---

**Última atualização:** 9 de Outubro de 2025
**Versão:** 1.0.0
**Autor:** Claude Code + CineVision Team
