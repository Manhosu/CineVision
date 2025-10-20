import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Logger,
  Query,
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

@Controller('api/v1/admin/broadcast')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class BroadcastController {
  private readonly logger = new Logger(BroadcastController.name);

  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  /**
   * Send broadcast message to all users
   */
  @Post('send')
  async sendBroadcast(@Request() req, @Body() broadcastData: SendBroadcastDto) {
    try {
      this.logger.log(`Admin ${req.user.email} is sending a broadcast`);

      const result = await this.broadcastService.sendBroadcast(
        req.user.userId,
        broadcastData,
      );

      return {
        success: true,
        message: 'Broadcast enviado com sucesso',
        ...result,
      };
    } catch (error) {
      this.logger.error('Error in sendBroadcast:', error);
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
        req.user.userId,
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
      const users = await this.broadcastService.getAllBotUsers();

      return {
        success: true,
        total_users: users.length,
      };
    } catch (error) {
      this.logger.error('Error in getUsersCount:', error);
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

      const imageUrl = await this.imageUploadService.uploadImage({
        file,
        imageType: 'cover',
      });

      return {
        success: true,
        image_url: imageUrl,
      };
    } catch (error) {
      this.logger.error('Error uploading broadcast image:', error);
      throw error;
    }
  }
}
