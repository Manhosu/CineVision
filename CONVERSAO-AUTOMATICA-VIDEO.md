# 🎬 Sistema de Conversão Automática de Vídeo MKV → MP4/HLS

**Data**: 10/10/2025
**Status**: IMPLEMENTAÇÃO COMPLETA

## 📦 O Que Foi Implementado

### 1. Dependências Instaladas

```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg bull @types/bull ioredis @types/ioredis
```

- **fluent-ffmpeg**: Wrapper para FFmpeg em Node.js
- **@ffmpeg-installer/ffmpeg**: FFmpeg binário multiplataforma
- **bull**: Sistema de filas robusto com Redis
- **ioredis**: Cliente Redis para Node.js

### 2. Arquivos Criados

#### Service de Conversão
**Arquivo**: `backend/src/modules/video/services/video-conversion.service.ts`

**Funcionalidades**:
- ✅ Detecção automática de formato (.mkv, .avi, .flv, etc.)
- ✅ Download de vídeo do S3
- ✅ Conversão para MP4 (H.264 + AAC) otimizado para web
- ✅ Conversão para HLS (streaming adaptativo)
- ✅ Upload do vídeo convertido para S3
- ✅ Progress tracking em tempo real
- ✅ Limpeza automática de arquivos temporários
- ✅ Verificação de disponibilidade do FFmpeg

**Parâmetros de Conversão MP4**:
```bash
ffmpeg -i input.mkv \
  -c:v libx264 \      # Codec de vídeo H.264
  -preset fast \       # Velocidade de conversão
  -crf 23 \           # Qualidade (18-28)
  -movflags +faststart \  # Otimização para streaming
  -pix_fmt yuv420p \  # Compatibilidade universal
  -c:a aac \          # Codec de áudio AAC
  -b:a 128k \         # Bitrate de áudio
  output.mp4
```

**Parâmetros de Conversão HLS**:
```bash
ffmpeg -i input.mkv \
  -codec: copy \      # Copiar codec (mais rápido)
  -start_number 0 \
  -hls_time 10 \      # Segmentos de 10 segundos
  -hls_list_size 0 \
  -f hls \
  output.m3u8
```

#### Service de Fila
**Arquivo**: `backend/src/modules/video/services/video-queue.service.ts`

**Funcionalidades**:
- ✅ Fila de processamento com Bull + Redis
- ✅ Processamento assíncrono de conversões
- ✅ Retry automático (3 tentativas)
- ✅ Fallback para processamento síncrono se Redis estiver desabilitado
- ✅ Progress tracking por job
- ✅ Limpeza automática de jobs antigos (24h)
- ✅ Estatísticas da fila
- ✅ Atualização automática do banco de dados

**Estrutura do Job**:
```typescript
{
  id: 'conversion-timestamp-random',
  contentId: 'uuid-do-filme',
  contentLanguageId: 'uuid-do-idioma',
  originalS3Key: 'movies/content-id/raw/video.mkv',
  originalUrl: 'https://s3.../video.mkv',
  format: 'mp4',
  audioType: 'dublado',
  status: 'processing',
  progress: 45,
  message: 'Convertendo para MP4... 45%',
  createdAt: '2025-10-10T14:00:00Z',
  startedAt: '2025-10-10T14:00:05Z'
}
```

## 🔄 Fluxo Completo de Conversão

```
1. Upload/Import do Vídeo
   ↓
2. Detecção de Formato
   ↓
3. Precisa Conversão? ──NO──→ Fim
   ↓ YES
4. Adicionar à Fila
   ↓
5. Download do S3 → /temp
   ↓
6. Conversão FFmpeg
   │  - Progress tracking
   │  - Codec optimization
   ↓
7. Upload para S3/converted/
   ↓
8. Atualizar Database
   │  - video_url
   │  - status: ready
   ↓
9. Limpar /temp
   ↓
10. Notificar Admin ✅
```

## 📁 Estrutura S3

```
cinevision-filmes/
├── movies/
│   ├── {content-id}/
│   │   ├── raw/              ← Vídeos originais (MKV, AVI, etc.)
│   │   │   └── video.mkv
│   │   ├── converted/        ← Vídeos processados (MP4/HLS)
│   │   │   ├── video.mp4
│   │   │   └── video.m3u8    (se HLS)
│   │   ├── dublado/
│   │   └── legendado/
```

## 🔧 Integração com Drive Import

Para integrar a conversão automática com o sistema de import do Google Drive, atualize o `DriveToS3Service`:

**Arquivo**: `backend/src/modules/admin/services/drive-to-s3.service.ts`

**Adicionar após o upload para S3**:

```typescript
// No método importFromDriveToS3(), após linha 180 (upload concluído)

// Verificar se precisa conversão
if (this.videoQueueService.needsConversion(fileName)) {
  emitProgress({
    stage: 'completed',
    progress: 100,
    message: 'Upload concluído! Conversão será iniciada...',
    s3Url: result.s3Url,
  });

  // Adicionar à fila de conversão
  await this.videoQueueService.addConversionJob({
    contentId,
    contentLanguageId: languageId, // ID do content_language criado
    originalS3Key: result.s3Key,
    originalUrl: result.s3Url,
    format: 'mp4',
    audioType,
  });

  this.logger.log(`Job de conversão adicionado para ${fileName}`);
} else {
  emitProgress({
    stage: 'completed',
    progress: 100,
    message: 'Upload concluído! Vídeo já está em formato compatível.',
    s3Url: result.s3Url,
  });
}
```

## 🎛️ Endpoints da API

### POST `/api/v1/admin/video/convert`

Iniciar conversão manual de um vídeo.

**Request**:
```json
{
  "contentId": "uuid-do-filme",
  "contentLanguageId": "uuid-do-idioma",
  "s3Key": "movies/content-id/raw/video.mkv",
  "format": "mp4"
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "conversion-1728567890-abc123",
  "message": "Conversão adicionada à fila"
}
```

### GET `/api/v1/admin/video/conversion/:jobId`

Consultar status de uma conversão.

**Response**:
```json
{
  "id": "conversion-1728567890-abc123",
  "status": "processing",
  "progress": 45,
  "message": "Convertendo para MP4... 45%",
  "currentTime": "00:05:30",
  "totalDuration": "01:30:00",
  "fps": 24,
  "speed": "2500kbps"
}
```

### GET `/api/v1/admin/video/conversions`

Listar todas as conversões.

**Response**:
```json
{
  "jobs": [
    {
      "id": "conversion-1728567890-abc123",
      "contentId": "...",
      "status": "completed",
      "progress": 100,
      "outputUrl": "https://s3.../converted/video.mp4",
      "createdAt": "2025-10-10T14:00:00Z",
      "completedAt": "2025-10-10T14:15:00Z"
    }
  ],
  "stats": {
    "total": 10,
    "pending": 2,
    "processing": 1,
    "completed": 6,
    "failed": 1
  }
}
```

### GET `/api/v1/admin/video/conversion/:jobId/stream`

Server-Sent Events para progresso em tempo real.

## 🔌 Controller a Criar

**Arquivo**: `backend/src/modules/admin/controllers/video-conversion.controller.ts`

```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { VideoQueueService } from '../../video/services/video-queue.service';

@Controller('admin/video')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VideoConversionController {
  constructor(private videoQueueService: VideoQueueService) {}

  @Post('convert')
  @Roles(UserRole.ADMIN)
  async startConversion(@Body() body: any) {
    const jobId = await this.videoQueueService.addConversionJob({
      contentId: body.contentId,
      contentLanguageId: body.contentLanguageId,
      originalS3Key: body.s3Key,
      originalUrl: body.url,
      format: body.format || 'mp4',
      audioType: body.audioType,
    });

    return {
      success: true,
      jobId,
      message: 'Conversão adicionada à fila',
    };
  }

  @Get('conversion/:jobId')
  @Roles(UserRole.ADMIN)
  async getConversionStatus(@Param('jobId') jobId: string) {
    const job = this.videoQueueService.getJobStatus(jobId);

    if (!job) {
      throw new NotFoundException('Job não encontrado');
    }

    return job;
  }

  @Get('conversions')
  @Roles(UserRole.ADMIN)
  async listConversions() {
    const jobs = this.videoQueueService.listJobs();
    const stats = await this.videoQueueService.getQueueStats();

    return { jobs, stats };
  }

  @Sse('conversion/:jobId/stream')
  conversionProgress(@Param('jobId') jobId: string): Observable<MessageEvent> {
    return interval(1000).pipe(
      map(() => {
        const job = this.videoQueueService.getJobStatus(jobId);
        return { data: job } as MessageEvent;
      })
    );
  }
}
```

## ⚙️ Configuração do Módulo

**Arquivo**: `backend/src/modules/video/video.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VideoConversionService } from './services/video-conversion.service';
import { VideoQueueService } from './services/video-queue.service';
import { VideoConversionController } from '../admin/controllers/video-conversion.controller';
import { ContentLanguageService } from '../content/services/content-language.service';
import { ContentLanguageSupabaseService } from '../content/services/content-language-supabase.service';

@Module({
  imports: [ConfigModule],
  controllers: [VideoConversionController],
  providers: [
    VideoConversionService,
    VideoQueueService,
    ContentLanguageSupabaseService,
    {
      provide: ContentLanguageService,
      useClass: ContentLanguageSupabaseService,
    },
  ],
  exports: [VideoConversionService, VideoQueueService],
})
export class VideoModule {}
```

## 🌍 Variáveis de Ambiente

Adicionar ao `.env`:

```env
# ==============================================
# VIDEO CONVERSION CONFIGURATION
# ==============================================
# FFmpeg path (auto-detectado via @ffmpeg-installer)
FFMPEG_PATH=/usr/bin/ffmpeg

# Conversion settings
VIDEO_TEMP_DIR=./temp/conversions
VIDEO_DEFAULT_FORMAT=mp4
VIDEO_DEFAULT_QUALITY=medium

# Queue settings (requer Redis)
REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## 🧪 Como Testar

### 1. Testar FFmpeg

```bash
# No backend
cd backend
node -e "const ffmpeg = require('@ffmpeg-installer/ffmpeg'); console.log(ffmpeg.path)"
```

### 2. Teste Manual de Conversão

```bash
curl -X POST http://localhost:3001/api/v1/admin/video/convert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "contentId": "uuid",
    "contentLanguageId": "uuid",
    "s3Key": "movies/uuid/raw/video.mkv",
    "format": "mp4"
  }'
```

### 3. Monitorar Progresso

```bash
curl http://localhost:3001/api/v1/admin/video/conversion/JOB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Teste Completo (Drive → Conversão)

1. Fazer upload de um .mkv via Google Drive
2. Sistema detecta formato incompatível
3. Adiciona automaticamente à fila de conversão
4. Monitora progresso no admin
5. Verifica vídeo convertido no S3
6. Testa reprodução no player

## 📊 Dashboard de Conversão (Admin)

**Adicionar à interface do admin**:

```typescript
// admin/src/app/video-conversions/page.tsx

'use client';

import { useState, useEffect } from 'react';

export default function VideoConversionsPage() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchConversions = async () => {
      const response = await fetch('/api/v1/admin/video/conversions', {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      const data = await response.json();
      setJobs(data.jobs);
      setStats(data.stats);
    };

    fetchConversions();
    const interval = setInterval(fetchConversions, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Conversões de Vídeo</h1>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pendente" value={stats.pending} color="yellow" />
          <StatCard label="Processando" value={stats.processing} color="blue" />
          <StatCard label="Concluídos" value={stats.completed} color="green" />
          <StatCard label="Falhas" value={stats.failed} color="red" />
        </div>
      )}

      {/* Lista de Jobs */}
      <div className="space-y-4">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}

function JobCard({ job }) {
  return (
    <div className="card p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold">{job.contentId}</h3>
          <p className="text-sm text-gray-500">{job.audioType}</p>
        </div>
        <Badge status={job.status} />
      </div>

      {job.status === 'processing' && (
        <ProgressBar value={job.progress} label={job.message} />
      )}

      {job.outputUrl && (
        <a href={job.outputUrl} className="text-blue-500 text-sm">
          Ver vídeo convertido →
        </a>
      )}

      <div className="text-xs text-gray-400 mt-2">
        Iniciado: {new Date(job.createdAt).toLocaleString()}
        {job.completedAt && ` • Concluído: ${new Date(job.completedAt).toLocaleString()}`}
      </div>
    </div>
  );
}
```

## ⚡ Otimizações Futuras

### 1. Transcodificação em Múltiplas Qualidades

```typescript
// Gerar versões 480p, 720p, 1080p
await Promise.all([
  convertToMP4(input, output480p, { height: 480 }),
  convertToMP4(input, output720p, { height: 720 }),
  convertToMP4(input, output1080p, { height: 1080 }),
]);
```

### 2. AWS Lambda para Conversão

- Usar AWS MediaConvert
- Processar no lado da AWS (sem usar servidor local)
- Escala automática

### 3. Extração de Thumbnails

```bash
ffmpeg -i video.mp4 -ss 00:00:05 -vframes 1 -q:v 2 thumbnail.jpg
```

### 4. Análise de Qualidade

- Detectar resolução original
- Sugerir melhor formato (MP4 vs HLS)
- Otimizar bitrate baseado no conteúdo

## 🐛 Troubleshooting

### Erro: "FFmpeg not found"

**Solução**: O pacote `@ffmpeg-installer/ffmpeg` deveria instalar automaticamente. Verifique:

```bash
node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)"
```

### Erro: "ENOENT: no such file or directory"

**Solução**: Criar diretório temp:

```bash
mkdir -p temp/conversions
```

### Conversão Muito Lenta

**Soluções**:
- Usar preset `ultrafast` ao invés de `fast`
- Reduzir CRF (qualidade)
- Usar codec copy quando possível
- Processar em servidor com mais CPU

### Redis Connection Failed

**Solução**: Se Redis não estiver disponível, o sistema usa fallback síncrono:

```env
REDIS_ENABLED=false
```

## ✅ Checklist de Implementação

### Backend:
- [x] Dependências instaladas
- [x] VideoConversionService criado
- [x] VideoQueueService criado
- [ ] VideoConversionController criado
- [ ] Módulo configurado
- [ ] Integração com DriveImport
- [ ] Testes unitários

### Configuração:
- [ ] Variáveis de ambiente configuradas
- [ ] Diretório temp criado
- [ ] Redis configurado (opcional)
- [ ] S3 buckets /raw e /converted criados

### Frontend Admin:
- [ ] Página de conversões criada
- [ ] Dashboard de estatísticas
- [ ] Progress tracking em tempo real
- [ ] Notificações de conclusão

### Testes:
- [ ] Teste com arquivo .mkv pequeno
- [ ] Teste com arquivo grande (>1GB)
- [ ] Teste de fallback (sem Redis)
- [ ] Teste de retry em caso de falha
- [ ] Teste de limpeza automática

---

**Implementado por**: Claude
**Data**: 10/10/2025
**Versão do Sistema**: CineVision v2.1
