/**
 * Serviço de Upload Multipart para S3
 * Gerencia upload de arquivos grandes em chunks sem carregar tudo na memória
 */

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB por chunk
const MAX_CONCURRENT_UPLOADS = 3; // Máximo de uploads simultâneos

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
  uploadSpeed?: number; // bytes por segundo
  timeRemaining?: number; // segundos
  currentPart?: number;
  totalParts?: number;
}

export interface MultipartUploadOptions {
  file: File;
  contentId: string;
  languageType: 'dubbed' | 'subtitled';
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: Error) => void;
  chunkSize?: number;
}

interface PartUpload {
  partNumber: number;
  etag: string;
}

export class MultipartUploadService {
  private apiUrl: string;
  private abortController: AbortController | null = null;
  private uploadStartTime: number = 0;
  private uploadedBytes: number = 0;

  constructor(apiUrl?: string) {
    // Garantir que o apiUrl não tenha /api/v1 no final
    const baseUrl = apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    this.apiUrl = baseUrl.replace(/\/api\/v1\/?$/, '');
  }

  /**
   * Obtém o token de autenticação
   */
  private getAuthToken(): string {
    let token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');

    if (!token) {
      // Tentar obter do Supabase
      const supabaseToken = localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token');
      if (supabaseToken) {
        try {
          const parsed = JSON.parse(supabaseToken);
          token = parsed.access_token;
        } catch (e) {
          token = supabaseToken;
        }
      }
    }

    if (!token) {
      throw new Error('Token de autenticação não encontrado');
    }

    return token;
  }

  /**
   * Divide o arquivo em chunks e faz upload em partes
   */
  async uploadFile(options: MultipartUploadOptions): Promise<string> {
    const {
      file,
      contentId,
      languageType,
      onProgress,
      onError,
      chunkSize = CHUNK_SIZE
    } = options;

    this.abortController = new AbortController();
    this.uploadStartTime = Date.now();
    this.uploadedBytes = 0;

    try {
      // 1. Criar o registro de idioma no banco
      const languageId = await this.createLanguageRecord(contentId, languageType, file);

      // 2. Iniciar multipart upload
      const { uploadId, key } = await this.initiateMultipartUpload(languageId, file);

      // 3. Calcular número de partes
      const totalParts = Math.ceil(file.size / chunkSize);
      const parts: PartUpload[] = [];

      // 4. Upload de chunks com controle de concorrência
      const uploadQueue: Promise<void>[] = [];
      let activeUploads = 0;
      let currentPart = 0;

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        // Aguardar se há muitos uploads simultâneos
        while (activeUploads >= MAX_CONCURRENT_UPLOADS) {
          await Promise.race(uploadQueue);
        }

        const start = (partNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        activeUploads++;
        const uploadPromise = this.uploadPart(
          languageId,
          uploadId,
          partNumber,
          chunk,
          key
        ).then(etag => {
          parts.push({ partNumber, etag });
          this.uploadedBytes += chunk.size;
          currentPart++;

          // Calcular progresso
          const percentage = (this.uploadedBytes / file.size) * 100;
          const elapsedTime = (Date.now() - this.uploadStartTime) / 1000;
          const uploadSpeed = this.uploadedBytes / elapsedTime;
          const remainingBytes = file.size - this.uploadedBytes;
          const timeRemaining = remainingBytes / uploadSpeed;

          if (onProgress) {
            onProgress({
              uploadedBytes: this.uploadedBytes,
              totalBytes: file.size,
              percentage,
              uploadSpeed,
              timeRemaining,
              currentPart,
              totalParts,
            });
          }

          activeUploads--;
        }).catch(error => {
          activeUploads--;
          throw error;
        });

        uploadQueue.push(uploadPromise);
      }

      // Aguardar todos os uploads
      await Promise.all(uploadQueue);

      // 5. Completar multipart upload
      // Ordenar partes por número
      parts.sort((a, b) => a.partNumber - b.partNumber);

      await this.completeMultipartUpload(languageId, uploadId, parts, key, file.size);

      return languageId;

    } catch (error) {
      if (onError) {
        onError(error as Error);
      }
      throw error;
    }
  }

  /**
   * Cria o registro de idioma no banco de dados
   */
  private async createLanguageRecord(
    contentId: string,
    languageType: 'dubbed' | 'subtitled',
    file: File
  ): Promise<string> {
    const token = this.getAuthToken();

    const response = await fetch(`${this.apiUrl}/api/v1/content-language-upload/language`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        content_id: contentId,
        language_type: languageType,
        language_code: 'pt-BR',
        language_name: languageType === 'dubbed' ? 'Português (Brasil)' : 'Português (Brasil)',
        is_default: true,
      }),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao criar registro de idioma');
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Inicia o multipart upload
   */
  private async initiateMultipartUpload(
    languageId: string,
    file: File
  ): Promise<{ uploadId: string; key: string }> {
    const token = this.getAuthToken();

    const response = await fetch(`${this.apiUrl}/api/v1/content-language-upload/initiate-multipart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        content_language_id: languageId,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || 'video/x-matroska',
      }),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao iniciar multipart upload');
    }

    const data = await response.json();
    return { uploadId: data.uploadId, key: data.storage_key };
  }

  /**
   * Faz upload de uma parte do arquivo
   */
  private async uploadPart(
    languageId: string,
    uploadId: string,
    partNumber: number,
    chunk: Blob,
    key: string
  ): Promise<string> {
    const token = this.getAuthToken();

    // 1. Obter URL pré-assinada para esta parte
    const urlResponse = await fetch(`${this.apiUrl}/api/v1/content-language-upload/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        content_language_id: languageId,
        upload_id: uploadId,
        part_number: partNumber,
      }),
      signal: this.abortController?.signal,
    });

    if (!urlResponse.ok) {
      const error = await urlResponse.json();
      throw new Error(error.message || 'Erro ao obter URL pré-assinada');
    }

    const { url } = await urlResponse.json();

    // 2. Upload do chunk diretamente para S3
    const uploadResponse = await fetch(url, {
      method: 'PUT',
      body: chunk,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      signal: this.abortController?.signal,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Erro ao fazer upload da parte ${partNumber}`);
    }

    // 3. Obter ETag da resposta
    const etag = uploadResponse.headers.get('ETag');
    if (!etag) {
      throw new Error(`ETag não encontrado para parte ${partNumber}`);
    }

    return etag.replace(/"/g, ''); // Remover aspas do ETag
  }

  /**
   * Completa o multipart upload
   */
  private async completeMultipartUpload(
    languageId: string,
    uploadId: string,
    parts: PartUpload[],
    key: string,
    fileSize: number
  ): Promise<void> {
    const token = this.getAuthToken();

    const response = await fetch(`${this.apiUrl}/api/v1/content-language-upload/complete-multipart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        content_language_id: languageId,
        upload_id: uploadId,
        parts: parts.map(p => ({
          PartNumber: p.partNumber,
          ETag: p.etag,
        })),
      }),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao completar multipart upload');
    }
  }

  /**
   * Cancela o upload em andamento
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Formata bytes para formato legível
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Formata tempo em formato legível
   */
  static formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '--:--';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}
