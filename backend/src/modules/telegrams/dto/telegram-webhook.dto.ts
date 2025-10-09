import { IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TelegramWebhookDto {
  @ApiProperty()
  @IsObject()
  update: any;

  @ApiProperty({ required: false })
  @IsOptional()
  signature?: string;
}
