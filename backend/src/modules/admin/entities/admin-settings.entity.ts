import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('admin_settings')
export class AdminSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  setting_key: string;

  @Column({ type: 'text' })
  setting_value: string;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
