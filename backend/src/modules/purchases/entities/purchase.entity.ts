import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Content } from '../../content/entities/content.entity';
import { createEnumColumn, createJsonColumn } from '../../../database/transformers/enum.transformer';

export enum PurchaseStatus {
  PENDING = 'pending',
  PAID = 'paid',
  COMPLETED = 'COMPLETED',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PurchaseDeliveryType {
  SITE = 'site',
  TELEGRAM = 'telegram',
}

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { nullable: true })
  user_id?: string;

  @Column('uuid')
  content_id: string;

  @Column({ nullable: true })
  payment_provider_id?: string;

  @Column({ type: 'int' })
  amount_cents: number;

  @Column({ length: 3, default: 'BRL' })
  currency: string;

  @Column(createEnumColumn(PurchaseStatus, PurchaseStatus.PENDING))
  status: PurchaseStatus;

  @Column(createJsonColumn(true))
  provider_meta?: Record<string, any>;

  @Column({ nullable: true })
  telegram_message_id?: string;

  @Column('uuid', { unique: true, nullable: true })
  purchase_token?: string;

  @Column(createEnumColumn(PurchaseDeliveryType, PurchaseDeliveryType.SITE))
  preferred_delivery: PurchaseDeliveryType;

  @Column({ nullable: true })
  access_token?: string;

  @Column({ nullable: true, type: 'timestamptz' })
  access_expires_at?: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  payment_confirmed_at?: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Content)
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}