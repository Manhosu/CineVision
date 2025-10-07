import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { Category } from './category.entity';
import { User } from '../../users/entities/user.entity';
import { Episode } from './episode.entity';
import { createEnumColumn } from '../../../database/transformers/enum.transformer';
import { ContentStatus, ContentAvailability } from './content.entity';

@Entity('series')
@Index('idx_series_title_search', { synchronize: false })
@Index('idx_series_status_created', ['status', 'created_at'])
export class Series {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  synopsis?: string;

  @Column({ nullable: true })
  cover_url?: string;

  @Column({ nullable: true })
  poster_url?: string;

  @Column({ nullable: true })
  backdrop_url?: string;

  @Column({ nullable: true })
  banner_url?: string;

  @Column({ nullable: true })
  trailer_url?: string;

  // Pricing - can be per-series or per-episode
  @Column({ type: 'int', nullable: false })
  price_cents: number;

  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency: string;

  @Column({ type: 'boolean', default: false })
  price_per_episode: boolean; // If true, each episode has individual price

  // Stripe integration fields
  @Column({ type: 'varchar', nullable: true })
  stripe_product_id?: string;

  @Column({ type: 'varchar', nullable: true })
  stripe_price_id?: string;

  // Storage keys for S3
  @Column({ type: 'varchar', nullable: true })
  cover_storage_key?: string;

  @Column({ type: 'varchar', nullable: true })
  trailer_storage_key?: string;

  // Sales tracking
  @Column({ type: 'int', default: 0 })
  weekly_sales: number;

  @Column({ type: 'int', default: 0 })
  total_sales: number;

  @Column({ nullable: true })
  release_year?: number;

  @Column({ nullable: true })
  director?: string;

  @Column({ type: 'text', nullable: true })
  cast?: string;

  @Column({ type: 'text', nullable: true })
  genres?: string;

  @Column({ nullable: true })
  imdb_rating?: number;

  @Column({ type: 'int', default: 1 })
  total_seasons: number;

  @Column({ type: 'int', default: 0 })
  total_episodes: number;

  @Column(createEnumColumn(ContentAvailability, ContentAvailability.BOTH))
  availability: ContentAvailability;

  @Column(createEnumColumn(ContentStatus, ContentStatus.DRAFT))
  status: ContentStatus;

  @Column({ default: false })
  is_featured: boolean;

  @Column({ default: 0 })
  views_count: number;

  @Column({ default: 0 })
  purchases_count: number;

  @OneToMany(() => Episode, (episode) => episode.series)
  episodes: Episode[];

  @ManyToMany(() => Category, (category) => category.contents)
  @JoinTable({
    name: 'series_categories',
    joinColumn: {
      name: 'series_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'category_id',
      referencedColumnName: 'id',
    },
  })
  categories: Category[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  created_by?: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  updated_by?: User;
}
