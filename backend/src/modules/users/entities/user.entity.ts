import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { createEnumColumn, createTimestampColumn } from '../../../database/transformers/enum.transformer';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
  PENDING = 'pending',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  password_hash?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true, unique: true })
  telegram_id?: string;

  @Column({ nullable: true })
  telegram_username?: string;

  @Column({ nullable: true })
  telegram_chat_id?: string;

  @Column(createEnumColumn(UserRole, UserRole.USER))
  role: UserRole;

  @Column(createEnumColumn(UserStatus, UserStatus.ACTIVE))
  status: UserStatus;

  @Column({ default: false })
  blocked: boolean;

  @Column({ nullable: true })
  refresh_token?: string;

  @Column({ nullable: true })
  avatar_url?: string;

  @Column(createTimestampColumn(true))
  last_login: Date;

  @Column(createTimestampColumn(true))
  email_verified_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
