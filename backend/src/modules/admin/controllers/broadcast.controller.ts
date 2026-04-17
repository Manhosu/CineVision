import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Logger,
  Query,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BroadcastService } from '../services/broadcast.service';
import { SendBroadcastDto } from '../dto/broadcast.dto';
import { ImageUploadService } from '../services/image-upload.service';
import { UserRole } from '../../users/entities/user.entity';

@Controller('admin/broadcast')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class BroadcastController {
  private readonly logger = new Logger(BroadcastController.name);

  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  /**
   * Send broadcast message to users (async fire-and-forget)
   */
  @Post('send')
  async sendBroadcast(@Request() req, @Body() broadcastData: SendBroadcastDto) {
    try {
      this.logger.log(`Admin ${req.user.email} is sending a broadcast`);

      const result = await this.broadcastService.sendBroadcast(
        req.user.id,
        broadcastData,
      );

      return result;
    } catch (error) {
      this.logger.error('Error in sendBroadcast:', error);
      throw error;
    }
  }

  /**
   * Get broadcast progress by ID
   */
  @Get('progress/:broadcastId')
  async getBroadcastProgress(@Param('broadcastId') broadcastId: string) {
    try {
      const progress = await this.broadcastService.getBroadcastProgress(broadcastId);

      return {
        success: true,
        ...progress,
      };
    } catch (error) {
      this.logger.error('Error in getBroadcastProgress:', error);
      throw error;
    }
  }

  /**
   * Get broadcast history
   */
  @Get('history')
  async getBroadcastHistory(@Request() req, @Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 20;
      const history = await this.broadcastService.getBroadcastHistory(
        req.user.id,
        limitNum,
      );

      return {
        success: true,
        broadcasts: history,
      };
    } catch (error) {
      this.logger.error('Error in getBroadcastHistory:', error);
      throw error;
    }
  }

  /**
   * Get count of users who can receive broadcasts
   */
  @Get('users-count')
  async getUsersCount() {
    try {
      const total = await this.broadcastService.getBotUsersCount();

      return {
        success: true,
        total_users: total,
      };
    } catch (error) {
      this.logger.error('Error in getUsersCount:', error);
      throw error;
    }
  }

  /**
   * Get list of all users who can receive broadcasts
   */
  @Get('users-list')
  async getUsersList() {
    try {
      const users = await this.broadcastService.getAllBotUsers();

      return {
        success: true,
        users: users.map(u => ({
          telegram_id: u.telegram_id,
          name: u.name,
          telegram_username: u.telegram_username,
        })),
      };
    } catch (error) {
      this.logger.error('Error in getUsersList:', error);
      throw error;
    }
  }

  /**
   * Upload image for broadcast
   */
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('image'))
  async uploadBroadcastImage(@UploadedFile() file: Express.Multer.File) {
    try {
      this.logger.log('Uploading broadcast image...');

      if (!file) {
        throw new Error('No file provided');
      }

      const imageUploadResult = await this.imageUploadService.uploadImage({
        file,
        imageType: 'cover',
      });

      this.logger.log(`Image uploaded successfully. Public URL: ${imageUploadResult.publicUrl}`);

      // Return the public URL that Telegram can access
      return {
        success: true,
        image_url: imageUploadResult.publicUrl,
      };
    } catch (error) {
      this.logger.error('Error uploading broadcast image:', error);
      throw error;
    }
  }
}
