import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface UploadProgress {
  contentId: string;
  languageId: string;
  languageType: 'DUBLADO' | 'LEGENDADO';
  fileName: string;
  totalSize: number;
  uploadedSize: number;
  percentage: number;
  currentPart: number;
  totalParts: number;
  speed: number; // bytes per second
  status: 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/upload-progress',
})
export class UploadProgressGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(UploadProgressGateway.name);
  private uploadProgress: Map<string, UploadProgress> = new Map();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  updateProgress(languageId: string, progress: Partial<UploadProgress>) {
    const existing = this.uploadProgress.get(languageId) || ({} as UploadProgress);
    const updated = { ...existing, ...progress };
    this.uploadProgress.set(languageId, updated);

    // Broadcast to all connected clients
    this.server.emit('upload-progress', updated);

    this.logger.debug(
      `Upload progress updated for ${languageId}: ${updated.percentage}%`,
    );
  }

  getProgress(languageId: string): UploadProgress | undefined {
    return this.uploadProgress.get(languageId);
  }

  getAllProgress(): UploadProgress[] {
    return Array.from(this.uploadProgress.values());
  }

  clearProgress(languageId: string) {
    this.uploadProgress.delete(languageId);
    this.server.emit('upload-cleared', { languageId });
  }
}
