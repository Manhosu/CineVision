# Admin Upload Flow - Cine Vision

## Overview

This document describes the complete flow for uploading and processing video content through the admin interface, including multipart S3 upload, HLS transcoding, Stripe integration, and Telegram notifications.

## Upload Flow Diagram

```
1. CREATE CONTENT
   ├─> Validate input
   ├─> Create Stripe Product + Price
   ├─> Save to database (status: DRAFT, processing: PENDING)
   └─> Return content_id + stripe IDs

2. INITIATE UPLOAD
   ├─> Validate file (type, size, extension)
   ├─> Create S3 multipart upload
   ├─> Generate presigned URLs for each part (TTL: 1h)
   ├─> Update status to UPLOADING
   └─> Return: uploadId, key, presignedUrls[]

3. CLIENT UPLOAD (parallel parts)
   ├─> Split file into chunks (10MB default)
   ├─> Upload each part to presigned URL
   ├─> Collect ETags from S3 responses
   └─> Handle retry on failure

4. COMPLETE UPLOAD
   ├─> Validate all parts present
   ├─> Complete S3 multipart upload
   ├─> Update status to PROCESSING
   ├─> Push job to transcode queue
   └─> Return success

5. TRANSCODE WORKER (background)
   ├─> Download source from S3
   ├─> Transcode to multi-bitrate HLS
   │   ├─> 1080p (if source allows)
   │   ├─> 720p
   │   ├─> 480p
   │   └─> 360p
   ├─> Generate master.m3u8 + playlists
   ├─> Upload segments to S3
   ├─> Update status to READY
   └─> Store HLS URLs in database

6. PUBLISH CONTENT
   ├─> Verify processing_status = READY
   ├─> Update status to PUBLISHED
   ├─> Optionally notify Telegram bot
   └─> Content available for purchase
```

## API Endpoints

### 1. Create Content

**POST** `/admin/api/content/create`

Creates content and automatically generates Stripe Product + Price.

**Request Body:**
```json
{
  "type": "movie",
  "title": "Inception",
  "description": "A mind-bending thriller",
  "synopsis": "Full synopsis here...",
  "price_cents": 1990,
  "currency": "BRL",
  "availability": "both",
  "genres": ["Action", "Sci-Fi"],
  "category_ids": ["uuid-1", "uuid-2"],
  "trailer_url": "https://youtube.com/...",
  "release_year": 2010,
  "director": "Christopher Nolan",
  "imdb_rating": 8.8,
  "duration_minutes": 148,
  "is_featured": true
}
```

**Response:**
```json
{
  "id": "content-uuid",
  "title": "Inception",
  "status": "DRAFT",
  "processing_status": "pending",
  "stripe_product_id": "prod_xxx",
  "stripe_price_id": "price_xxx",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### 2. Initiate Upload

**POST** `/admin/api/content/initiate-upload`

Initiates S3 multipart upload and returns presigned URLs.

**Request Body:**
```json
{
  "content_id": "content-uuid",
  "file_name": "inception.mp4",
  "file_size": 5368709120,
  "content_type": "video/mp4",
  "chunk_size": 10485760
}
```

**Response:**
```json
{
  "uploadId": "s3-upload-id",
  "key": "videos/1234567890-inception.mp4",
  "presignedUrls": [
    "https://s3.amazonaws.com/...",
    "https://s3.amazonaws.com/...",
    "..."
  ],
  "contentId": "content-uuid"
}
```

### 3. Complete Upload

**POST** `/admin/api/content/complete-upload`

Finalizes multipart upload and triggers transcoding.

**Request Body:**
```json
{
  "content_id": "content-uuid",
  "upload_id": "s3-upload-id",
  "key": "videos/1234567890-inception.mp4",
  "parts": [
    { "PartNumber": 1, "ETag": "\"etag-1\"" },
    { "PartNumber": 2, "ETag": "\"etag-2\"" },
    { "PartNumber": 3, "ETag": "\"etag-3\"" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "contentId": "content-uuid",
  "s3Location": "https://s3.amazonaws.com/...",
  "status": "processing",
  "message": "Upload completed successfully. Transcoding will begin shortly."
}
```

### 4. Get Processing Status

**GET** `/admin/api/content/:id/status`

Returns current upload/processing status with progress.

**Response:**
```json
{
  "id": "content-uuid",
  "title": "Inception",
  "status": "DRAFT",
  "processing_status": "processing",
  "processing_progress": 45,
  "processing_error": null,
  "processing_started_at": "2025-01-01T01:00:00Z",
  "processing_completed_at": null,
  "is_ready": false,
  "hls_available": false,
  "available_qualities": []
}
```

### 5. Publish Content

**PUT** `/admin/api/content/:id/publish`

Publishes content and optionally notifies users.

**Request Body:**
```json
{
  "notify_users": true
}
```

**Response:**
```json
{
  "success": true,
  "contentId": "content-uuid",
  "status": "PUBLISHED",
  "message": "Content published successfully"
}
```

## Client-Side Implementation

### Example: React/Next.js Upload Component

```typescript
import { useState } from 'react';

interface UploadProgress {
  uploadedParts: number;
  totalParts: number;
  percentage: number;
}

export function useMultipartUpload() {
  const [progress, setProgress] = useState<UploadProgress>({
    uploadedParts: 0,
    totalParts: 0,
    percentage: 0,
  });

  const uploadFile = async (
    contentId: string,
    file: File
  ) => {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

    // Step 1: Initiate upload
    const initResponse = await fetch('/admin/api/content/initiate-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: contentId,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
        chunk_size: CHUNK_SIZE,
      }),
    });

    const { uploadId, key, presignedUrls } = await initResponse.json();

    // Step 2: Upload parts in parallel
    const parts: Array<{ PartNumber: number; ETag: string }> = [];
    setProgress({
      uploadedParts: 0,
      totalParts: presignedUrls.length,
      percentage: 0,
    });

    const uploadPromises = presignedUrls.map(async (url: string, index: number) => {
      const start = index * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const response = await fetch(url, {
        method: 'PUT',
        body: chunk,
        headers: {
          'Content-Type': file.type,
        },
      });

      const etag = response.headers.get('ETag');

      parts.push({
        PartNumber: index + 1,
        ETag: etag!,
      });

      setProgress((prev) => ({
        ...prev,
        uploadedParts: prev.uploadedParts + 1,
        percentage: Math.round(((prev.uploadedParts + 1) / prev.totalParts) * 100),
      }));

      return { PartNumber: index + 1, ETag: etag };
    });

    await Promise.all(uploadPromises);

    // Step 3: Complete upload
    const completeResponse = await fetch('/admin/api/content/complete-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: contentId,
        upload_id: uploadId,
        key,
        parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      }),
    });

    return completeResponse.json();
  };

  return { uploadFile, progress };
}
```

## File Validation

### Supported Formats
- `.mp4` (recommended)
- `.mpeg`
- `.mov`
- `.avi`
- `.wmv`
- `.webm`
- `.mkv`

### Size Limits
- **Minimum:** 1 MB
- **Maximum:** 5 GB (configurable)

### MIME Types
- `video/mp4`
- `video/mpeg`
- `video/quicktime`
- `video/x-msvideo`
- `video/x-ms-wmv`
- `video/webm`
- `video/x-matroska`

## HLS Transcoding

### Quality Profiles

| Quality | Resolution | Video Bitrate | Audio Bitrate | Target Devices |
|---------|-----------|---------------|---------------|----------------|
| 1080p   | 1920x1080 | 5000 kbps     | 192 kbps      | Desktop, Smart TV |
| 720p    | 1280x720  | 2500 kbps     | 128 kbps      | Desktop, Tablet |
| 480p    | 854x480   | 1000 kbps     | 96 kbps       | Mobile, Tablet |
| 360p    | 640x360   | 600 kbps      | 64 kbps       | Mobile (slow connection) |

### S3 Structure

```
s3://cinevision-filmes/
  videos/
    {content_id}/
      original/
        video.mp4
      hls/
        master.m3u8
        1080p/
          playlist.m3u8
          segment_001.ts
          segment_002.ts
          ...
        720p/
          playlist.m3u8
          segment_001.ts
          ...
        480p/
          ...
        360p/
          ...
```

## Error Handling

### Common Errors

1. **Invalid file type**
   ```json
   {
     "statusCode": 400,
     "message": "Unsupported file type: video/x-flv"
   }
   ```

2. **File too large**
   ```json
   {
     "statusCode": 400,
     "message": "File size too large: 6442450944 bytes. Maximum allowed: 5368709120 bytes (5GB)"
   }
   ```

3. **Upload timeout**
   - Presigned URLs expire after 1 hour
   - Solution: Restart upload or implement resume functionality

4. **Transcoding failure**
   - Check `processing_error` field in content status
   - Common causes: corrupted file, unsupported codec

## Cleanup and Maintenance

### Automatic Cleanup

A cron job runs daily to abort incomplete multipart uploads older than 24 hours:

```typescript
@Cron('0 2 * * *') // 2 AM daily
async cleanupIncompleteUploads() {
  const cleaned = await this.uploadService.cleanupIncompleteUploads(24);
  this.logger.log(`Cleaned up ${cleaned} incomplete uploads`);
}
```

### Manual Cleanup

```bash
# Via admin API
POST /admin/api/uploads/cleanup
{
  "older_than_hours": 24
}
```

## Security Considerations

1. **Authentication:** All admin endpoints require JWT authentication
2. **Presigned URLs:** Limited to 1 hour TTL
3. **File validation:** Server-side validation of file type, size, and checksums
4. **CloudFront signed URLs:** Short-lived URLs (12h) for streaming
5. **Webhook verification:** Stripe signature validation required

## Performance Tips

1. **Parallel uploads:** Upload parts concurrently (max 5-10 at a time)
2. **Chunk size:** 10MB default, adjust based on network speed
3. **Retry strategy:** Implement exponential backoff for failed parts
4. **Progress tracking:** Update UI every 100ms to avoid flickering
5. **Queue priority:** Critical content can be prioritized in transcode queue

## Monitoring

### Key Metrics

- Upload success rate
- Average upload time
- Transcoding success rate
- Average transcoding time per quality
- Queue depth and processing lag

### Logs

All operations are logged to SystemLog table:
- `upload_initiate`
- `upload_complete`
- `transcode_start`
- `transcode_complete`
- `transcode_failed`
- `content_publish`
