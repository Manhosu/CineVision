import { Injectable, Logger } from '@nestjs/common';
import { SupabaseRestClient } from '../../../config/supabase-rest-client';

@Injectable()
export class AdminPurchasesSimpleService {
  private readonly logger = new Logger(AdminPurchasesSimpleService.name);

  // User UUIDs to exclude from purchase listings (test users)
  // Eduardo Gouveia (telegram_id: 5212925997) and Eduardo Evangelista (telegram_id: 2006803983)
  private readonly BLOCKED_USER_IDS = [
    '84dca2a4-02cd-4dfa-a7df-6f2afcb26027', // Eduardo Gouveia
    'ae8a0bfb-a280-479b-be23-ae28fe4ac2ca'  // Eduardo Evangelista
  ];

  constructor(private readonly supabaseClient: SupabaseRestClient) {
    this.logger.log('AdminPurchasesSimpleService instantiated successfully with real Supabase queries');
  }

  async getAllOrders(page: number = 1, limit: number = 20, status?: string, search?: string) {
    this.logger.log(`Fetching orders - page: ${page}, limit: ${limit}, status: ${status || 'all'}, search: ${search || 'none'}`);

    try {
      // Use UUIDs directly for O(1) lookup performance
      const blockedUserIds = this.BLOCKED_USER_IDS;
      const blockedUserSet = new Set(blockedUserIds);

      this.logger.log(`Filtering ${blockedUserIds.length} blocked test users`);

      let purchases: any[] = [];
      let totalCount = 0;

      if (search && search.trim()) {
        // Search mode: find users and content matching search term first
        this.logger.log(`Searching for: ${search}`);

        // Search users by email, name, or telegram_username
        const users = await this.supabaseClient.select('users', {
          select: 'id,email,telegram_id,telegram_username,name',
        });

        const matchingUsers = users.filter((u: any) =>
          (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
          (u.name && u.name.toLowerCase().includes(search.toLowerCase())) ||
          (u.telegram_username && u.telegram_username.toLowerCase().includes(search.toLowerCase()))
        );

        // Search content by title
        const contents = await this.supabaseClient.select('content', {
          select: 'id,title,poster_url',
        });

        const matchingContents = contents.filter((c: any) =>
          c.title && c.title.toLowerCase().includes(search.toLowerCase())
        );

        const matchingUserIds = matchingUsers.map((u: any) => String(u.id));
        const matchingContentIds = matchingContents.map((c: any) => String(c.id));

        this.logger.log(`Found ${matchingUserIds.length} users and ${matchingContentIds.length} contents matching search`);

        // Fetch all purchases (we'll filter in memory)
        let allPurchases = await this.supabaseClient.select('purchases', {
          select: '*',
          order: { column: 'created_at', ascending: false },
        });

        // Filter by status if provided
        if (status && status !== 'all') {
          allPurchases = allPurchases.filter((p: any) => p.status === status);
        }

        // Filter by matching user_id or content_id, AND exclude blocked users
        const filteredPurchases = allPurchases.filter((p: any) =>
          (matchingUserIds.includes(p.user_id) || matchingContentIds.includes(p.content_id)) &&
          !blockedUserIds.includes(p.user_id)
        );

        totalCount = filteredPurchases.length;

        // Apply pagination to filtered results
        const offset = (page - 1) * limit;
        purchases = filteredPurchases.slice(offset, offset + limit);

        this.logger.log(`Filtered to ${totalCount} purchases, showing ${purchases.length} on page ${page}`);
      } else {
        // Normal mode: fetch ALL purchases, filter blocked users, then paginate
        const queryOptions: any = {
          select: '*',
          order: { column: 'created_at', ascending: false },
        };

        // Add status filter ONLY if provided and not 'all'
        if (status && status !== 'all') {
          queryOptions.where = { status };
          this.logger.log(`Filtering by status: ${status}`);
        } else {
          this.logger.log('Fetching ALL purchases (no status filter)');
        }

        // Fetch ALL purchases
        this.logger.log(`Query options: ${JSON.stringify(queryOptions)}`);
        let allPurchases = await this.supabaseClient.select('purchases', queryOptions);
        this.logger.log(`Found ${allPurchases.length} purchases before filtering`);

        // Filter out blocked users
        const filteredPurchases = allPurchases.filter((p: any) => !blockedUserIds.includes(p.user_id));
        this.logger.log(`${filteredPurchases.length} purchases after removing blocked users`);

        // Apply pagination to filtered results
        totalCount = filteredPurchases.length;
        const offset = (page - 1) * limit;
        purchases = filteredPurchases.slice(offset, offset + limit);
        this.logger.log(`Showing ${purchases.length} purchases on page ${page} of ${Math.ceil(totalCount / limit)}`);
      }

      // Extract unique user IDs and content IDs
      const userIds = [...new Set(purchases.map((p: any) => p.user_id).filter(Boolean))];
      const contentIds = [...new Set(purchases.map((p: any) => p.content_id).filter(Boolean))];

      // Fetch users and content separately
      let users: any[] = [];
      if (userIds.length > 0) {
        const allUsers = await this.supabaseClient.select('users', {
          select: 'id,email,telegram_id,telegram_username,name',
        });
        // Convert UUID to string to match VARCHAR user_id from purchases
        users = allUsers.filter((u: any) => userIds.includes(String(u.id)));
      }

      let contents: any[] = [];
      if (contentIds.length > 0) {
        const allContents = await this.supabaseClient.select('content', {
          select: 'id,title,poster_url',
        });
        // Convert UUID to string for consistent comparison
        contents = allContents.filter((c: any) => contentIds.includes(String(c.id)));
      }

      // Create lookup maps (convert UUIDs to strings to match VARCHAR user_id in purchases)
      const userMap = new Map(users.map((u: any) => [String(u.id), u]));
      const contentMap = new Map(contents.map((c: any) => [String(c.id), c]));

      // FALLBACK: For orphaned purchases (user_id not in users table), try to find user by telegram_id
      const orphanedPurchases = purchases.filter((p: any) =>
        p.user_id && !userMap.has(String(p.user_id))
      );

      if (orphanedPurchases.length > 0) {
        this.logger.warn(`Found ${orphanedPurchases.length} orphaned purchases with invalid user_id`);

        // Extract telegram_user_id from provider_meta
        const telegramIds = orphanedPurchases
          .map((p: any) => p.provider_meta?.telegram_user_id)
          .filter(Boolean);

        if (telegramIds.length > 0) {
          this.logger.log(`Attempting to recover users by telegram_id: ${telegramIds.join(', ')}`);

          // Fetch users by telegram_id
          const allUsers = await this.supabaseClient.select('users', {
            select: 'id,email,telegram_id,telegram_username,name',
          });

          const usersByTelegramId = allUsers.filter((u: any) =>
            telegramIds.includes(String(u.telegram_id))
          );

          // Add recovered users to userMap using their telegram_id as secondary lookup
          usersByTelegramId.forEach((u: any) => {
            // Find purchases with this telegram_id and map them to this user
            orphanedPurchases.forEach((p: any) => {
              if (p.provider_meta?.telegram_user_id === String(u.telegram_id)) {
                userMap.set(String(p.user_id), u);
                this.logger.log(`✅ Recovered user ${u.name} for orphaned purchase ${p.id}`);
              }
            });
          });
        }
      }

      // Helper function to translate status from Portuguese to English
      const translateStatus = (status: string): string => {
        switch(status) {
          case 'pago': return 'paid';
          case 'pendente': return 'pending';
          case 'falhou': return 'failed';
          default: return status;
        }
      };

      // Helper function to get status color (accepts both PT and EN)
      const getStatusColor = (status: string) => {
        switch(status) {
          case 'pago':
          case 'paid': return 'green';
          case 'pendente':
          case 'pending': return 'yellow';
          case 'falhou':
          case 'failed': return 'red';
          default: return 'gray';
        }
      };

      // Transform data to match frontend expectations
      const transformedOrders = purchases.map((purchase: any) => {
        const translatedStatus = translateStatus(purchase.status);

        // Get user from map, or create synthetic user from provider_meta as fallback
        let user = userMap.get(String(purchase.user_id));
        if (!user && purchase.provider_meta) {
          // Create synthetic user object from Telegram metadata
          const telegramUserId = purchase.provider_meta.telegram_user_id;
          const telegramChatId = purchase.provider_meta.telegram_chat_id;

          if (telegramUserId) {
            user = {
              id: purchase.user_id || 'unknown',
              name: `Telegram User ${telegramUserId}`,
              email: `telegram_${telegramUserId}@orphaned.user`,
              telegram_id: telegramUserId,
              telegram_username: null,
              _synthetic: true, // Mark as synthetic for debugging
            };
            this.logger.warn(`Created synthetic user for orphaned purchase ${purchase.id} with telegram_id ${telegramUserId}`);
          }
        }

        return {
          id: purchase.id,
          user_id: purchase.user_id,
          content_id: purchase.content_id,
          amount_cents: purchase.amount_cents,
          currency: purchase.currency || 'BRL',
          status: translatedStatus, // Translate PT → EN for frontend
          status_color: getStatusColor(translatedStatus),
          payment_method: purchase.payment_method || 'unknown',
          created_at: purchase.created_at,
          updated_at: purchase.updated_at,
          // Include nested user and content data (convert IDs to string for map lookup)
          user: user || null,
          content: contentMap.get(String(purchase.content_id)) || null,
        };
      });

      // Calculate statistics from filtered purchases (now using English status)
      const stats = {
        total: totalCount,
        paid: transformedOrders.filter((p: any) => p.status === 'paid').length,
        pending: transformedOrders.filter((p: any) => p.status === 'pending').length,
        failed: transformedOrders.filter((p: any) => p.status === 'failed').length,
        total_revenue: transformedOrders
          .filter((p: any) => p.status === 'paid')
          .reduce((sum: number, p: any) => sum + (p.amount_cents || 0), 0) / 100,
      };

      this.logger.log(`Statistics: ${JSON.stringify(stats)}`);

      // Return in format expected by frontend
      return {
        purchases: transformedOrders,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        total: totalCount,
        limit,
        stats,
      };
    } catch (error) {
      this.logger.error('Error fetching orders:', error);
      throw error;
    }
  }

  async getOrderById(orderId: string) {
    this.logger.log(`Fetching order by ID: ${orderId}`);

    try {
      // Fetch single purchase
      const purchase = await this.supabaseClient.selectOne('purchases', {
        select: '*',
        where: { id: orderId },
      });

      if (!purchase) {
        return {
          success: false,
          data: null,
          message: 'Order not found',
        };
      }

      // Fetch related user and content
      const user = purchase.user_id
        ? await this.supabaseClient.selectOne('users', {
            select: 'id,email,telegram_id,telegram_username,name',
            where: { id: purchase.user_id },
          })
        : null;

      const content = purchase.content_id
        ? await this.supabaseClient.selectOne('content', {
            select: 'id,title,poster_url',
            where: { id: purchase.content_id },
          })
        : null;

      // Transform data
      const transformedOrder = {
        id: purchase.id,
        user_id: purchase.user_id,
        content_id: purchase.content_id,
        amount_cents: purchase.amount_cents,
        currency: purchase.currency || 'BRL',
        status: purchase.status,
        payment_method: purchase.payment_method || 'unknown',
        payment_details: purchase.provider_meta || {},
        created_at: purchase.created_at,
        updated_at: purchase.updated_at,
        user,
        content,
      };

      return {
        success: true,
        data: transformedOrder,
        message: 'Order retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error fetching order by ID:', error);
      throw error;
    }
  }

  async getOrderStats() {
    this.logger.log('Calculating purchase statistics');

    try {
      // Use UUIDs directly
      const blockedUserIds = this.BLOCKED_USER_IDS;

      // Fetch all purchases for statistics
      const allPurchasesRaw = await this.supabaseClient.select('purchases', {
        select: 'id,status,payment_method,amount_cents,created_at,user_id',
      });

      // Filter out blocked users
      const allPurchases = allPurchasesRaw.filter((p: any) => !blockedUserIds.includes(p.user_id));
      this.logger.log(`Statistics: ${allPurchases.length} real purchases (${allPurchasesRaw.length - allPurchases.length} test purchases filtered)`);

      // Calculate total orders
      const totalOrders = allPurchases.length;

      // Calculate total revenue (only from paid orders - status in Portuguese)
      const totalRevenueCents = allPurchases
        .filter((p: any) => p.status === 'pago')
        .reduce((sum: number, p: any) => sum + (p.amount_cents || 0), 0);

      // Count orders by status (database has Portuguese status)
      const ordersByStatus = allPurchases.reduce((acc: any, p: any) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});

      // Count orders by payment method
      const ordersByPaymentMethod = allPurchases.reduce((acc: any, p: any) => {
        const method = p.payment_method || 'unknown';
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {});

      // Count recent orders (last 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const recentOrdersCount = allPurchases.filter(
        (p: any) => new Date(p.created_at) >= yesterday
      ).length;

      // Calculate conversion rate (paid vs total)
      const paidOrders = ordersByStatus.pago || 0;
      const conversionRate = totalOrders > 0 ? paidOrders / totalOrders : 0;

      // Return in format expected by frontend (English field names)
      return {
        total_purchases: totalOrders,
        total_revenue_cents: totalRevenueCents,
        pending_purchases: ordersByStatus.pendente || 0,  // Portuguese DB value
        paid_purchases: ordersByStatus.pago || 0,         // Portuguese DB value
        failed_purchases: ordersByStatus.falhou || 0,     // Portuguese DB value
        refunded_purchases: ordersByStatus.refunded || 0,
        // Additional stats for reference
        orders_by_payment_method: ordersByPaymentMethod,
        recent_orders_count: recentOrdersCount,
        conversion_rate: parseFloat(conversionRate.toFixed(2)),
      };
    } catch (error) {
      this.logger.error('Error calculating statistics:', error);
      throw error;
    }
  }

  async deleteOrder(orderId: string) {
    this.logger.log(`Deleting order by ID: ${orderId}`);

    try {
      // Check if order exists first
      const purchase = await this.supabaseClient.selectOne('purchases', {
        select: '*',
        where: { id: orderId },
      });

      if (!purchase) {
        return {
          success: false,
          message: 'Order not found',
        };
      }

      // Delete the purchase
      await this.supabaseClient.delete('purchases', { id: orderId });

      return {
        success: true,
        message: `Order ${orderId} deleted successfully`,
        deletedOrder: {
          id: purchase.id,
          user_id: purchase.user_id,
          content_id: purchase.content_id,
          status: purchase.status,
        },
      };
    } catch (error) {
      this.logger.error('Error deleting order:', error);
      throw error;
    }
  }
}