import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const VIDEO_BUCKET = process.env.S3_VIDEO_BUCKET || 'cinevision-storage';
const COVERS_BUCKET = process.env.S3_COVERS_BUCKET || 'cinevision-capas';
const MOVIES_DIR = 'E:/movies';

interface VideoFile {
  fileName: string;
  filePath: string;
  type: 'dubbed' | 'subtitled';
  format: 'mp4' | 'mkv';
  fileSize: number;
}

interface MovieData {
  folderName: string;
  title: string;
  year: number;
  posterPath: string | null;
  videos: VideoFile[];
}

// ===== HELPER FUNCTIONS =====

function parseMovieFolderName(folderName: string): { title: string; year: number } | null {
  const match = folderName.match(/^FILME_\s*(.+?)\s*\((\d{4})\)/);
  if (!match) {
    console.warn(`⚠️  Pasta ignorada (formato inválido): ${folderName}`);
    return null;
  }
  return { title: match[1].trim(), year: parseInt(match[2]) };
}

function detectVideoType(fileName: string): 'dubbed' | 'subtitled' | null {
  const upperFileName = fileName.toUpperCase();
  if (upperFileName.includes('DUBLADO') || upperFileName.includes('DUBBED')) {
    return 'dubbed';
  }
  if (upperFileName.includes('LEGENDADO') || upperFileName.includes('SUBTITLED')) {
    return 'subtitled';
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function generateProgress(current: number, total: number, width: number = 40): string {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((width * current) / total);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `${bar} ${percent}% | ${formatBytes(current)}/${formatBytes(total)}`;
}

// ===== SCAN MOVIES DIRECTORY =====

async function scanMoviesDirectory(): Promise<MovieData[]> {
  console.log(`📁 Escaneando pasta: ${MOVIES_DIR}\n`);

  if (!fs.existsSync(MOVIES_DIR)) {
    throw new Error(`Pasta não encontrada: ${MOVIES_DIR}`);
  }

  const folders = fs.readdirSync(MOVIES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const movies: MovieData[] = [];

  for (const folderName of folders) {
    const parsed = parseMovieFolderName(folderName);
    if (!parsed) continue;

    const folderPath = path.join(MOVIES_DIR, folderName);
    const files = fs.readdirSync(folderPath);

    // Find poster
    const posterFile = files.find(f => f.match(/^POSTER\.(png|jpg|jpeg|webp)$/i));
    const posterPath = posterFile ? path.join(folderPath, posterFile) : null;

    // Find videos
    const videoFiles: VideoFile[] = [];
    const videoExtensions = /\.(mp4|mkv)$/i;

    for (const file of files) {
      if (!videoExtensions.test(file)) continue;

      const type = detectVideoType(file);
      if (!type) {
        console.warn(`  ⚠️  Tipo de vídeo não identificado: ${file}`);
        continue;
      }

      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);
      const format = file.toLowerCase().endsWith('.mkv') ? 'mkv' : 'mp4';

      videoFiles.push({
        fileName: file,
        filePath,
        type,
        format,
        fileSize: stats.size,
      });
    }

    // If multiple videos of same type, keep the one with highest number in filename
    const groupedVideos = videoFiles.reduce((acc, video) => {
      if (!acc[video.type]) {
        acc[video.type] = video;
      } else {
        // Extract number from filename (e.g., "DUBLADO-014.mkv" -> 14)
        const currentNum = parseInt(video.fileName.match(/-(\d+)\./)?.[1] || '0');
        const existingNum = parseInt(acc[video.type].fileName.match(/-(\d+)\./)?.[1] || '0');
        if (currentNum > existingNum) {
          acc[video.type] = video;
        }
      }
      return acc;
    }, {} as Record<string, VideoFile>);

    movies.push({
      folderName,
      title: parsed.title,
      year: parsed.year,
      posterPath,
      videos: Object.values(groupedVideos),
    });
  }

  return movies;
}

// ===== UPLOAD POSTER =====

async function uploadPoster(movie: MovieData): Promise<string | null> {
  if (!movie.posterPath || !fs.existsSync(movie.posterPath)) {
    console.log(`  ⚠️  Poster não encontrado, usando placeholder`);
    return null;
  }

  try {
    const fileBuffer = fs.readFileSync(movie.posterPath);
    const fileExtension = path.extname(movie.posterPath);
    const movieId = `${movie.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${movie.year}`;
    const key = `posters/${movieId}${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: COVERS_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: fileExtension === '.png' ? 'image/png' : 'image/jpeg',
      CacheControl: 'max-age=31536000',
    });

    await s3Client.send(command);

    const publicUrl = `https://${COVERS_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    console.log(`  ✅ Poster enviado: ${key}`);
    return publicUrl;
  } catch (error) {
    console.error(`  ❌ Erro ao enviar poster:`, error.message);
    return null;
  }
}

// ===== UPLOAD VIDEO (MULTIPART) =====

async function uploadVideoMultipart(video: VideoFile, movie: MovieData): Promise<string> {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  const movieId = `${movie.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${movie.year}`;
  const key = `videos/${movieId}-${video.type}.${video.format}`;

  console.log(`  ⏳ Uploading ${video.type.toUpperCase()}: ${video.fileName}`);
  console.log(`     Tamanho: ${formatBytes(video.fileSize)}`);

  try {
    // Initiate multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: VIDEO_BUCKET,
      Key: key,
      ContentType: `video/${video.format}`,
      Metadata: {
        originalName: video.fileName,
        movieTitle: movie.title,
        languageType: video.type,
      },
    });

    const { UploadId } = await s3Client.send(createCommand);

    if (!UploadId) {
      throw new Error('Failed to initiate multipart upload');
    }

    // Upload parts
    const fileStream = fs.createReadStream(video.filePath, { highWaterMark: CHUNK_SIZE });
    const parts: Array<{ ETag: string; PartNumber: number }> = [];
    let partNumber = 1;
    let uploadedBytes = 0;

    for await (const chunk of fileStream) {
      const uploadPartCommand = new UploadPartCommand({
        Bucket: VIDEO_BUCKET,
        Key: key,
        PartNumber: partNumber,
        UploadId,
        Body: chunk as Buffer,
      });

      const { ETag } = await s3Client.send(uploadPartCommand);

      if (!ETag) {
        throw new Error(`Failed to upload part ${partNumber}`);
      }

      parts.push({ ETag, PartNumber: partNumber });
      uploadedBytes += (chunk as Buffer).length;

      // Progress bar
      console.log(`     ${generateProgress(uploadedBytes, video.fileSize)}`);

      partNumber++;
    }

    // Complete multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: VIDEO_BUCKET,
      Key: key,
      UploadId,
      MultipartUpload: { Parts: parts },
    });

    await s3Client.send(completeCommand);

    const videoUrl = `https://${VIDEO_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    console.log(`  ✅ Video ${video.type} enviado com sucesso!`);
    return key;
  } catch (error) {
    console.error(`  ❌ Erro ao enviar vídeo ${video.type}:`, error.message);
    throw error;
  }
}

// ===== CREATE DATABASE RECORDS =====

async function createMovieRecord(movie: MovieData, posterUrl: string | null, videoKeys: Map<string, string>) {
  try {
    // Check if movie already exists
    const { data: existingMovies } = await supabase
      .from('content')
      .select('id, title, release_year')
      .ilike('title', `%${movie.title}%`)
      .eq('release_year', movie.year);

    let contentId: string;

    if (existingMovies && existingMovies.length > 0) {
      console.log(`  ℹ️  Filme já existe no banco: ${movie.title} (${movie.year})`);
      contentId = existingMovies[0].id;
    } else {
      // Create new content record
      const { data, error } = await supabase
        .from('content')
        .insert({
          title: movie.title,
          description: `${movie.title} - Lançamento ${movie.year}`,
          release_year: movie.year,
          poster_url: posterUrl,
          thumbnail_url: posterUrl,
          backdrop_url: posterUrl,
          price_cents: 1500, // R$ 15,00
          content_type: 'movie',
          status: 'PUBLISHED',
          is_online: true,
          quality: 'HD',
          format: movie.videos[0]?.format?.toUpperCase() || 'MP4',
          category: 'Ação',
          weekly_sales: 0,
          views_count: 0,
          genres: ['Ação', 'Aventura'],
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      contentId = data.id;
      console.log(`  ✅ Registro de conteúdo criado: ID ${contentId}`);
    }

    // Create content_languages records
    for (const video of movie.videos) {
      const videoKey = videoKeys.get(video.type);
      if (!videoKey) continue;

      const languageType = video.type; // 'dubbed' or 'subtitled'
      const languageName = video.type === 'dubbed'
        ? 'Português (Brasil) - Dublado'
        : 'Português (Brasil) - Legendado';

      // Check if language already exists
      const { data: existingLanguage } = await supabase
        .from('content_languages')
        .select('id')
        .eq('content_id', contentId)
        .eq('language_type', languageType)
        .eq('language_code', 'pt-BR')
        .single();

      if (existingLanguage) {
        console.log(`  ℹ️  Idioma ${languageType} já existe, atualizando...`);
        await supabase
          .from('content_languages')
          .update({
            video_storage_key: videoKey,
            file_size_bytes: video.fileSize,
            is_active: true,
          })
          .eq('id', existingLanguage.id);
      } else {
        const { error: langError } = await supabase
          .from('content_languages')
          .insert({
            content_id: contentId,
            language_type: languageType,
            language_code: 'pt-BR',
            language_name: languageName,
            video_storage_key: videoKey,
            file_size_bytes: video.fileSize,
            is_default: languageType === 'dubbed', // Dublado como padrão
            is_active: true,
          });

        if (langError) {
          console.error(`  ⚠️  Erro ao criar idioma ${languageType}:`, langError.message);
        } else {
          console.log(`  ✅ Idioma ${languageType} criado`);
        }
      }
    }

    return contentId;
  } catch (error) {
    console.error(`  ❌ Erro ao criar registros no banco:`, error.message);
    throw error;
  }
}

// ===== MAIN FUNCTION =====

async function main() {
  console.log('🎬 CineVision - Upload em Massa de Filmes\n');
  console.log('='.repeat(60));

  try {
    // Scan movies directory
    const movies = await scanMoviesDirectory();

    if (movies.length === 0) {
      console.log('❌ Nenhum filme encontrado para processar');
      return;
    }

    console.log(`\n📊 Estatísticas:`);
    console.log(`   Filmes encontrados: ${movies.length}`);
    console.log(`   Total de vídeos: ${movies.reduce((acc, m) => acc + m.videos.length, 0)}`);
    const totalSize = movies.reduce((acc, m) =>
      acc + m.videos.reduce((sum, v) => sum + v.fileSize, 0), 0
    );
    console.log(`   Tamanho total: ${formatBytes(totalSize)}`);
    console.log('\n' + '='.repeat(60) + '\n');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i];
      console.log(`\n📤 [${i + 1}/${movies.length}] Processando: ${movie.title} (${movie.year})`);
      console.log(`   Vídeos: ${movie.videos.map(v => v.type).join(', ')}`);

      try {
        // Upload poster
        const posterUrl = await uploadPoster(movie);

        // Upload videos
        const videoKeys = new Map<string, string>();
        for (const video of movie.videos) {
          const key = await uploadVideoMultipart(video, movie);
          videoKeys.set(video.type, key);
        }

        // Create database records
        await createMovieRecord(movie, posterUrl, videoKeys);

        console.log(`  ✅ ${movie.title} processado com sucesso!\n`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Erro ao processar ${movie.title}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Processamento Concluído!');
    console.log(`   Sucessos: ${successCount}`);
    console.log(`   Erros: ${errorCount}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Run script
main().catch(console.error);
