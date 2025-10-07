import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(createUserDto);
    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      select: ['id', 'name', 'email', 'phone', 'role', 'status', 'created_at', 'updated_at'],
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByTelegramUsername(telegram_username: string): Promise<User> {
    return this.userRepository.findOne({ where: { telegram_username } });
  }

  async findByTelegramChatId(telegram_chat_id: string): Promise<User> {
    return this.userRepository.findOne({ where: { telegram_chat_id } });
  }

  async findByTelegramId(telegram_id: string): Promise<User> {
    return this.userRepository.findOne({ where: { telegram_id } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    Object.assign(user, updateUserDto);

    return this.userRepository.save(user);
  }

  async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    await this.userRepository.update(id, { refresh_token: refreshToken });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { last_login: new Date() });
  }

  async updateTelegramChatId(id: string, chatId: string): Promise<void> {
    await this.userRepository.update(id, { telegram_chat_id: chatId });
  }

  async updateTelegramInfo(id: string, telegramInfo: { telegram_username?: string }): Promise<void> {
    await this.userRepository.update(id, telegramInfo);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }

  async banUser(id: string): Promise<User> {
    return this.update(id, { status: 'banned' as any });
  }

  async unbanUser(id: string): Promise<User> {
    return this.update(id, { status: 'active' as any });
  }

  async getUserStats() {
    const total = await this.userRepository.count();
    const active = await this.userRepository.count({ where: { status: 'active' as any } });
    const banned = await this.userRepository.count({ where: { status: 'banned' as any } });

    return {
      total,
      active,
      banned,
      inactive: total - active - banned,
    };
  }
}