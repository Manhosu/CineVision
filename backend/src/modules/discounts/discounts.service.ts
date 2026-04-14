import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../config/supabase.service';

export interface Discount {
  id: string;
  name: string;
  description?: string;
  discount_scope: 'global' | 'category' | 'individual';
  scope_id?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  starts_at: string;
  ends_at: string;
  is_flash: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDiscountDto {
  name: string;
  description?: string;
  discount_scope: 'global' | 'category' | 'individual';
  scope_id?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  starts_at: string;
  ends_at: string;
  is_flash?: boolean;
}

export interface UpdateDiscountDto {
  name?: string;
  description?: string;
  discount_scope?: 'global' | 'category' | 'individual';
  scope_id?: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  starts_at?: string;
  ends_at?: string;
  is_flash?: boolean;
  is_active?: boolean;
}

@Injectable()
export class DiscountsService {
  private readonly logger = new Logger(DiscountsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(data: CreateDiscountDto): Promise<Discount> {
    const { data: discount, error } = await this.supabaseService.client
      .from('discounts')
      .insert({
        ...data,
        is_flash: data.is_flash ?? false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create discount: ${error.message}`);
    }

    return discount;
  }

  async update(id: string, data: UpdateDiscountDto): Promise<Discount> {
    const { data: discount, error } = await this.supabaseService.client
      .from('discounts')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update discount: ${error.message}`);
    }

    return discount;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('discounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete discount: ${error.message}`);
    }
  }

  async findAll(page = 1, limit = 20): Promise<{ data: Discount[]; total: number; page: number; limit: number; totalPages: number }> {
    const offset = (page - 1) * limit;

    const { data: discounts, error, count } = await this.supabaseService.client
      .from('discounts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch discounts: ${error.message}`);
    }

    return {
      data: discounts || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findActiveDiscounts(): Promise<Discount[]> {
    const now = new Date().toISOString();

    const { data: discounts, error } = await this.supabaseService.client
      .from('discounts')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('discount_value', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch active discounts: ${error.message}`);
    }

    return discounts || [];
  }

  async findActiveFlashPromotions(): Promise<Discount[]> {
    const now = new Date().toISOString();

    const { data: discounts, error } = await this.supabaseService.client
      .from('discounts')
      .select('*')
      .eq('is_active', true)
      .eq('is_flash', true)
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('discount_value', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch flash promotions: ${error.message}`);
    }

    return discounts || [];
  }

  async getDiscountForContent(contentId: string): Promise<Discount | null> {
    const now = new Date().toISOString();

    // 1. Check individual discount (scope='individual', scope_id=contentId)
    const { data: individualDiscounts } = await this.supabaseService.client
      .from('discounts')
      .select('*')
      .eq('is_active', true)
      .eq('discount_scope', 'individual')
      .eq('scope_id', contentId)
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('discount_value', { ascending: false })
      .limit(1);

    if (individualDiscounts && individualDiscounts.length > 0) {
      return individualDiscounts[0];
    }

    // 2. Check category discount (scope='category', scope_id in content's categories)
    const { data: contentCategories } = await this.supabaseService.client
      .from('content_categories')
      .select('category_id')
      .eq('content_id', contentId);

    if (contentCategories && contentCategories.length > 0) {
      const categoryIds = contentCategories.map(cc => cc.category_id);

      const { data: categoryDiscounts } = await this.supabaseService.client
        .from('discounts')
        .select('*')
        .eq('is_active', true)
        .eq('discount_scope', 'category')
        .in('scope_id', categoryIds)
        .lte('starts_at', now)
        .gte('ends_at', now)
        .order('discount_value', { ascending: false })
        .limit(1);

      if (categoryDiscounts && categoryDiscounts.length > 0) {
        return categoryDiscounts[0];
      }
    }

    // 3. Check global discount (scope='global')
    const { data: globalDiscounts } = await this.supabaseService.client
      .from('discounts')
      .select('*')
      .eq('is_active', true)
      .eq('discount_scope', 'global')
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('discount_value', { ascending: false })
      .limit(1);

    if (globalDiscounts && globalDiscounts.length > 0) {
      return globalDiscounts[0];
    }

    return null;
  }

  calculateDiscountedPrice(priceCents: number, discount: Discount): number {
    if (discount.discount_type === 'percentage') {
      const discountAmount = Math.round(priceCents * (discount.discount_value / 100));
      return Math.max(0, priceCents - discountAmount);
    } else {
      // Fixed discount - discount_value is in cents
      return Math.max(0, priceCents - discount.discount_value);
    }
  }

  /**
   * Cron job to deactivate expired discounts every 5 minutes
   */
  @Cron('*/5 * * * *')
  async deactivateExpiredDiscounts(): Promise<void> {
    const now = new Date().toISOString();

    try {
      const { data, error } = await this.supabaseService.client
        .from('discounts')
        .update({ is_active: false, updated_at: now })
        .eq('is_active', true)
        .lt('ends_at', now)
        .select('id');

      if (error) {
        this.logger.error(`Failed to deactivate expired discounts: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        this.logger.log(`Deactivated ${data.length} expired discount(s)`);
      }
    } catch (err) {
      this.logger.error(`Error in deactivateExpiredDiscounts cron: ${err}`);
    }
  }
}
