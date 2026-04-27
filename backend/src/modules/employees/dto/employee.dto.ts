import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  can_add_movies?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  can_add_series?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  can_edit_own_content?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  can_edit_any_content?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  can_view_users?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  can_view_purchases?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  can_view_top10?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  can_view_online_users?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  can_manage_discounts?: boolean;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(168)
  edit_window_hours?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  daily_content_limit?: number;
}

export class UpdateEmployeePermissionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  can_add_movies?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  can_add_series?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  can_edit_own_content?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  can_edit_any_content?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  can_view_users?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  can_view_purchases?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  can_view_top10?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  can_view_online_users?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  can_manage_discounts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  edit_window_hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  daily_content_limit?: number;
}
