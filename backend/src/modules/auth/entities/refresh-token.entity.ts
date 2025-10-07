import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { createTimestampColumn } from '../../../database/transformers/enum.transformer';

@Entity('refresh_tokens')
@Index(['token'], { unique: true })
@Index(['user_id', 'is_active'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ length: 500 })
  token: string;

  @Column({ default: true })
  is_active: boolean;

  @Column(createTimestampColumn(false))
  expires_at: Date;

  @Column({ nullable: true })
  device_info?: string;

  @Column({ nullable: true })
  ip_address?: string;

  @Column({ nullable: true })
  user_agent?: string;

  @Column(createTimestampColumn(true))
  last_used_at?: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  created_at: Date;
}
