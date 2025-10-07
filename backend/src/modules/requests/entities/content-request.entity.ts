import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { createEnumColumn, createTimestampColumn } from '../../../database/transformers/enum.transformer';

export enum RequestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum RequestPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('content_requests')
@Index(['status', 'priority', 'created_at'])
@Index(['user_id', 'created_at'])
export class ContentRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { nullable: true })
  user_id?: string;

  @Column()
  requested_title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  imdb_url?: string;

  @Column({ nullable: true })
  year?: number;

  @Column(createEnumColumn(RequestStatus, RequestStatus.PENDING))
  status: RequestStatus;

  @Column(createEnumColumn(RequestPriority, RequestPriority.MEDIUM))
  priority: RequestPriority;

  @Column({ default: false })
  notification_sent: boolean;

  @Column({ type: 'text', nullable: true })
  admin_notes?: string;

  @Column({ nullable: true })
  telegram_chat_id?: string;

  @Column({ nullable: true })
  telegram_message_id?: string;

  @Column({ type: 'int', default: 1 })
  vote_count: number;

  @Column(createTimestampColumn(true))
  completed_at?: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
