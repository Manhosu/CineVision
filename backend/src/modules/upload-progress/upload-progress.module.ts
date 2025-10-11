import { Module } from '@nestjs/common';
import { UploadProgressGateway } from './upload-progress.gateway';

@Module({
  providers: [UploadProgressGateway],
  exports: [UploadProgressGateway],
})
export class UploadProgressModule {}
