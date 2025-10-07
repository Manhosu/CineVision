import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { createTimestampColumn } from '../../../database/transformers/enum.transformer';

@Entity('telegram_link_tokens')
@Index(['token'], { unique: true })
@Index(['expires_at'])
export class TelegramLinkToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64, unique: true })
  token: string;

  @Column({ nullable: true })
  telegram_id?: string;

  @Column({ nullable: true })
  telegram_username?: string;

  @Column({ nullable: true })
  telegram_first_name?: string;

  @Column({ nullable: true })
  telegram_last_name?: string;

  @Column({ default: false })
  is_used: boolean;

  @Column(createTimestampColumn(false))
  expires_at: Date;

  @Column({ nullable: true })
  ip_address?: string;

  @Column({ nullable: true })
  user_agent?: string;

  @Column(createTimestampColumn(true))
  used_at?: Date;

  @CreateDateColumn()
  created_at: Date;
}
