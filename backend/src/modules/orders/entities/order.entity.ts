import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { nullable: true })
  user_id?: string;

  @Column('uuid', { unique: true })
  order_token: string;

  @Column({ type: 'int' })
  subtotal_cents: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  discount_percent: number;

  @Column({ type: 'int', default: 0 })
  discount_cents: number;

  @Column({ type: 'int' })
  total_cents: number;

  @Column({ type: 'int' })
  total_items: number;

  @Column({ length: 20, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column('uuid', { nullable: true })
  payment_id?: string;

  @Column({ default: false })
  is_recovery_order: boolean;

  @Column('uuid', { nullable: true })
  original_order_id?: string;

  @Column({ nullable: true, length: 50 })
  telegram_chat_id?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at?: Date;
}
