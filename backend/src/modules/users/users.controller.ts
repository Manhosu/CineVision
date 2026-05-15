import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin required' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin required' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        active: { type: 'number' },
        banned: { type: 'number' },
        inactive: { type: 'number' },
      },
    },
  })
  getUserStats() {
    return this.usersService.getUserStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/ban')
  @ApiOperation({ summary: 'Ban user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User banned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  banUser(@Param('id') id: string) {
    return this.usersService.banUser(id);
  }

  @Post(':id/unban')
  @ApiOperation({ summary: 'Unban user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User unbanned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  unbanUser(@Param('id') id: string) {
    return this.usersService.unbanUser(id);
  }

  @Patch(':id/whatsapp-joined')
  @ApiOperation({ summary: 'Update user WhatsApp joined status' })
  @ApiResponse({ status: 200, description: 'WhatsApp joined status updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateWhatsappJoined(@Param('id') id: string, @Body() body: { joined: boolean }) {
    return this.usersService.updateWhatsappJoined(id, body.joined);
  }

  @Patch(':id/whatsapp')
  @ApiOperation({ summary: 'Update user personal WhatsApp number' })
  @ApiResponse({ status: 200, description: 'WhatsApp number updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid WhatsApp number' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateWhatsapp(@Param('id') id: string, @Body() body: { whatsapp: string }) {
    // Sanitização básica: só dígitos.
    const digits = (body?.whatsapp || '').replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) {
      throw new BadRequestException('WhatsApp inválido');
    }
    // Igor (15/05): normaliza com DDI 55 quando é número BR (10-11 dígitos),
    // pro mesmo formato de orders.customer_whatsapp. Assim a deduplicação
    // do broadcast (collectWhatsappContacts) bate exato e o mesmo número
    // nunca conta/envia 2x — mesmo se a pessoa comprou via órfão E salvou
    // no dashboard.
    const normalized =
      digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
    return this.usersService.updateWhatsapp(id, normalized);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}