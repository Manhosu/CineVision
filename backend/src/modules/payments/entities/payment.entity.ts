import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Purchase } from '../../purchases/entities/purchase.entity';
import { createEnumColumn, createTimestampColumn, createJsonColumn } from '../../../database/transformers/enum.transformer';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentProvider {
  PIX = 'pix',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BOLETO = 'boleto',
  TELEGRAM = 'telegram',
  STRIPE = 'stripe',
  LEGACY = 'legacy',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  purchase_id: string;

  @Column(createEnumColumn(PaymentProvider))
  provider: PaymentProvider;

  @Column({ nullable: true })
  provider_payment_id?: string;

  @Column(createEnumColumn(PaymentStatus, PaymentStatus.PENDING))
  status: PaymentStatus;

  @Column(createJsonColumn(true))
  webhook_payload?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  failure_reason?: string;

  @Column({ type: 'integer', nullable: true })
  amount_cents?: number;

  @Column({ type: 'varchar', length: 3, nullable: true, default: 'BRL' })
  currency?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method?: string;

  @Column(createJsonColumn(true))
  provider_meta?: Record<string, any>;

  @Column(createTimestampColumn(true))
  processed_at?: Date;

  @Column(createTimestampColumn(true))
  expires_at?: Date;

  @Column({ type: 'varchar', nullable: true })
  refund_id?: string;

  @Column({ type: 'integer', nullable: true })
  refund_amount?: number;

  @Column({ type: 'text', nullable: true })
  refund_reason?: string;

  @Column(createTimestampColumn(true))
  refunded_at?: Date;

  @ManyToOne(() => Purchase)
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;

  @CreateDateColumn()
  created_at: Date;
}
