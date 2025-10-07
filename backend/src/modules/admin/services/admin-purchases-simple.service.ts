import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AdminPurchasesSimpleService {
  private readonly logger = new Logger(AdminPurchasesSimpleService.name);

  constructor() {
    console.log('AdminPurchasesSimpleService instantiated successfully');
  }

  async getAllOrders(page: number = 1, limit: number = 20, status?: string) {
    console.log('AdminPurchasesSimpleService.getAllOrders called with:', { page, limit, status });
    
    // Mock data for testing - simulating purchase orders
    const mockOrders = [
      {
        id: 'order-1',
        user_id: 'user-123',
        content_id: 'content-456',
        content_title: 'Superman',
        amount_cents: 710,
        currency: 'BRL',
        status: 'paid',
        payment_method: 'pix',
        created_at: new Date('2024-01-15T10:30:00Z'),
        updated_at: new Date('2024-01-15T10:35:00Z'),
      },
      {
        id: 'order-2',
        user_id: 'user-789',
        content_id: 'content-321',
        content_title: 'Lilo & Stitch',
        amount_cents: 690,
        currency: 'BRL',
        status: 'pending',
        payment_method: 'credit_card',
        created_at: new Date('2024-01-14T15:20:00Z'),
        updated_at: new Date('2024-01-14T15:20:00Z'),
      },
      {
        id: 'order-3',
        user_id: 'user-456',
        content_id: 'content-789',
        content_title: 'Como Treinar o Seu Dragão',
        amount_cents: 698,
        currency: 'BRL',
        status: 'failed',
        payment_method: 'boleto',
        created_at: new Date('2024-01-13T09:15:00Z'),
        updated_at: new Date('2024-01-13T09:45:00Z'),
      },
    ];

    // Filter by status if provided
    let filteredOrders = mockOrders;
    if (status) {
      filteredOrders = mockOrders.filter(order => order.status === status);
    }

    // Simple pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    return {
      success: true,
      data: {
        orders: paginatedOrders,
        pagination: {
          page,
          limit,
          total: filteredOrders.length,
          totalPages: Math.ceil(filteredOrders.length / limit),
        },
      },
      message: 'Orders retrieved successfully (mock data)',
    };
  }

  async getOrderById(orderId: string) {
    console.log('AdminPurchasesSimpleService.getOrderById called with:', orderId);
    
    // Mock single order data
    const mockOrder = {
      id: orderId,
      user_id: 'user-123',
      content_id: 'content-456',
      content_title: 'Superman',
      amount_cents: 710,
      currency: 'BRL',
      status: 'paid',
      payment_method: 'pix',
      payment_details: {
        transaction_id: 'tx-' + orderId,
        payment_date: new Date('2024-01-15T10:35:00Z'),
      },
      created_at: new Date('2024-01-15T10:30:00Z'),
      updated_at: new Date('2024-01-15T10:35:00Z'),
    };

    return {
      success: true,
      data: mockOrder,
      message: 'Order retrieved successfully (mock data)',
    };
  }

  async getOrderStats() {
    console.log('AdminPurchasesSimpleService.getOrderStats called');
    
    // Mock statistics
    const mockStats = {
      total_orders: 156,
      total_revenue_cents: 108420, // R$ 1,084.20
      orders_by_status: {
        paid: 98,
        pending: 23,
        failed: 35,
      },
      orders_by_payment_method: {
        pix: 67,
        credit_card: 45,
        boleto: 44,
      },
      recent_orders_count: 12, // last 24h
      conversion_rate: 0.73, // 73%
    };

    return {
      success: true,
      data: mockStats,
      message: 'Order statistics retrieved successfully (mock data)',
    };
  }
}