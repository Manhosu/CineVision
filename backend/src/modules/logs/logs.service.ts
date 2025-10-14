import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemLog, LogLevel, LogType } from './entities/system-log.entity';

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(SystemLog)
    private systemLogRepository: Repository<SystemLog>,
  ) {}

  async logAuth(
    message: string,
    userId?: string,
    ip?: string,
    userAgent?: string,
    level: LogLevel = LogLevel.INFO,
    meta?: Record<string, any>,
  ): Promise<SystemLog> {
    const log = this.systemLogRepository.create({
      type: LogType.AUTH,
      level,
      message,
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      meta,
    });

    return this.systemLogRepository.save(log);
  }

  async logSecurity(
    message: string,
    userId?: string,
    ip?: string,
    userAgent?: string,
    level: LogLevel = LogLevel.WARN,
    meta?: Record<string, any>,
  ): Promise<SystemLog> {
    const log = this.systemLogRepository.create({
      type: LogType.SECURITY,
      level,
      message,
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      meta,
    });

    return this.systemLogRepository.save(log);
  }

  async logSystem(
    message: string,
    level: LogLevel = LogLevel.INFO,
    meta?: Record<string, any>,
  ): Promise<SystemLog> {
    const log = this.systemLogRepository.create({
      type: LogType.SYSTEM,
      level,
      message,
      meta,
    });

    return this.systemLogRepository.save(log);
  }

  async getLogs(
    type?: LogType,
    level?: LogLevel,
    limit: number = 50,
  ): Promise<SystemLog[]> {
    const queryBuilder = this.systemLogRepository.createQueryBuilder('log');

    if (type) {
      queryBuilder.andWhere('log.type = :type', { type });
    }

    if (level) {
      queryBuilder.andWhere('log.level = :level', { level });
    }

    return queryBuilder
      .orderBy('log.created_at', 'DESC')
      .limit(limit)
      .getMany();
  }
}