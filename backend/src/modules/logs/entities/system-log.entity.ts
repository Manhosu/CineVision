import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { createEnumColumn, createJsonColumn } from '../../../database/transformers/enum.transformer';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export enum LogType {
  AUTH = 'auth',
  PAYMENT = 'payment',
  PURCHASE = 'purchase',
  CONTENT = 'content',
  USER = 'user',
  TELEGRAM = 'telegram',
  SYSTEM = 'system',
  API = 'api',
  SECURITY = 'security',
}

@Entity('system_logs')
@Index(['type', 'created_at'])
@Index(['level', 'created_at'])
@Index(['entity_id', 'type'])
export class SystemLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column(createEnumColumn(LogType))
  type: LogType;

  @Column(createEnumColumn(LogLevel, LogLevel.INFO))
  level: LogLevel;

  @Column({ nullable: true })
  entity_id?: string;

  @Column()
  message: string;

  @Column(createJsonColumn(true))
  meta?: Record<string, any>;

  @Column({ nullable: true })
  user_id?: string;

  @Column({ nullable: true })
  ip_address?: string;

  @Column({ nullable: true })
  user_agent?: string;

  @Column({ nullable: true })
  session_id?: string;

  @Column({ nullable: true })
  request_id?: string;

  @Column({ type: 'text', nullable: true })
  stack_trace?: string;

  @CreateDateColumn()
  created_at: Date;
}
