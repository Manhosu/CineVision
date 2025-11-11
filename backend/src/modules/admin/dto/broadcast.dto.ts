import { IsString, IsOptional, IsUrl, MaxLength, MinLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class InlineButtonDto {
  @IsString()
  @MaxLength(50, { message: 'O texto do botão não pode ter mais de 50 caracteres' })
  text: string;

  @IsUrl({ require_protocol: true }, { message: 'URL do botão inválida' })
  url: string;
}

export class SendBroadcastDto {
  @IsString()
  @MinLength(1, { message: 'A mensagem não pode estar vazia' })
  @MaxLength(4000, { message: 'A mensagem não pode ter mais de 4000 caracteres' })
  message_text: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'URL da imagem inválida' })
  image_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'O texto do botão não pode ter mais de 100 caracteres' })
  button_text?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'URL do botão inválida' })
  button_url?: string;

  @IsOptional()
  @IsArray({ message: 'inline_buttons deve ser um array' })
  @ValidateNested({ each: true })
  @Type(() => InlineButtonDto)
  inline_buttons?: InlineButtonDto[];

  @IsArray({ message: 'telegram_ids deve ser um array' })
  @IsString({ each: true, message: 'Cada telegram_id deve ser uma string' })
  telegram_ids: string[];
}
