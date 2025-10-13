import axios from 'axios';
import AuthService from './authService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/admin`,
  timeout: 30000,
});

// Add auth interceptor with auto-refresh
adminApi.interceptors.request.use(async (config) => {
  const token = await AuthService.ensureValidToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for auth errors
adminApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh token once
      const newToken = await AuthService.refreshToken();
      if (newToken && error.config && !error.config._retry) {
        error.config._retry = true;
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return adminApi.request(error.config);
      }
      
      // If refresh failed, logout and redirect
      AuthService.clearStorage();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface MetricsResponse {
  total_revenue: number;
  total_users: number;
  total_content: number;
  active_purchases: number;
  concurrent_streams: number;
  storage_usage_gb: number;
  revenue_series: Array<{
    date: string;
    revenue: number;
    purchases: number;
  }>;
  top_content: Array<{
    content_id: string;
    title: string;
    purchases: number;
    revenue: number;
    views: number;
  }>;
  conversion_rate: number;
  error_rate: number;
  average_session_duration: number;
  new_users_count: number;
  active_users_count: number;
  blocked_users_count: number;
  successful_payments: number;
  failed_payments: number;
  pending_payments: number;
  refunded_amount: number;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  blocked: boolean;
  telegram_id?: string;
}

export interface Content {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  status: string;
  availability: string;
  created_at: string;
  purchase_count: number;
  total_revenue: number;
  categories: Array<{ name: string }>;
}

export interface Payment {
  id: string;
  amount_cents: number;
  status: string;
  provider: string;
  created_at: string;
  purchase: {
    content: { title: string };
    user: { email: string };
  };
}

export interface Order {
  id: string;
  requested_title: string;
  description?: string;
  imdb_url?: string;
  year?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notification_sent: boolean;
  admin_notes?: string;
  telegram_chat_id?: string;
  vote_count: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface ContentRequest {
  id: string;
  content_title: string;
  description?: string;
  status: 'PENDING' | 'PROCESSED' | 'REJECTED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  admin_notes?: string;
  user_id?: string;
  telegram_chat_id?: string;
  category?: string;
  imdb_url?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    telegram_username?: string;
  };
}

export interface SystemLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  created_at: string;
  meta: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data?: T[];
  users?: T[];
  content?: T[];
  payments?: T[];
  orders?: T[];
  requests?: T[];
  logs?: T[];
  total: number;
  page: number;
  limit: number;
}

export class AdminApiService {
  // Metrics
  static async getMetrics(period = '30d', startDate?: string, endDate?: string): Promise<MetricsResponse> {
    const params = new URLSearchParams({ period });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await adminApi.get(`/metrics?${params.toString()}`);
    return response.data;
  }

  // Users
  static async getUsers(page = 1, limit = 20, search?: string, status?: string): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    const response = await adminApi.get(`/users?${params.toString()}`);
    return response.data;
  }

  static async getUserDetails(userId: string) {
    const response = await adminApi.get(`/users/${userId}`);
    return response.data;
  }

  static async updateUserStatus(userId: string, status: 'active' | 'blocked') {
    const response = await adminApi.put(`/users/${userId}/status`, { status });
    return response.data;
  }

  static async updateUserBalance(userId: string, amount: number, reason: string) {
    const response = await adminApi.put(`/users/${userId}/balance`, { amount, reason });
    return response.data;
  }

  // Content
  static async getContent(page = 1, limit = 20, search?: string, status?: string): Promise<PaginatedResponse<Content>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    const response = await adminApi.get(`/content?${params.toString()}`);
    return response.data;
  }

  static async updateContentAvailability(contentId: string, availability: 'site' | 'telegram' | 'both') {
    const response = await adminApi.put(`/content/${contentId}/availability`, { availability });
    return response.data;
  }

  // Payments
  static async getPayments(page = 1, limit = 20, status?: string, provider?: string): Promise<PaginatedResponse<Payment>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) params.append('status', status);
    if (provider) params.append('provider', provider);

    const response = await adminApi.get(`/payments?${params.toString()}`);
    return response.data;
  }

  static async retryPayment(paymentId: string) {
    const response = await adminApi.post(`/payments/${paymentId}/retry`);
    return response.data;
  }

  static async refundPayment(paymentId: string, amount?: number, reason?: string) {
    const response = await adminApi.post(`/payments/${paymentId}/refund`, { amount, reason });
    return response.data;
  }

  // Orders
  static async getOrders(page = 1, limit = 20, status?: string): Promise<PaginatedResponse<Order>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) params.append('status', status);

    const response = await adminApi.get(`/orders?${params.toString()}`);
    return response.data;
  }

  static async updateOrderStatus(orderId: string, status: string, adminNotes?: string) {
    const response = await adminApi.patch(`/orders/${orderId}`, { status, admin_notes: adminNotes });
    return response.data;
  }

  static async notifyUser(requestId: string, message?: string) {
    const response = await axios.post(
      `${API_BASE_URL}/requests/${requestId}/notify`,
      { message },
      {
        headers: {
          Authorization: `Bearer ${await AuthService.ensureValidToken()}`,
        },
      }
    );
    return response.data;
  }

  // Content Requests
  static async getContentRequests(params: {
    page?: number;
    limit?: number;
    status?: string
  } = {}): Promise<{ requests: ContentRequest[]; total: number }> {
    const queryParams = new URLSearchParams({
      page: (params.page || 1).toString(),
      limit: (params.limit || 20).toString(),
    });
    if (params.status) queryParams.append('status', params.status);

    const response = await axios.get(
      `${API_BASE_URL}/requests?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${await AuthService.ensureValidToken()}`,
        },
      }
    );
    return response.data;
  }

  static async updateContentRequest(requestId: string, data: {
    status?: string;
    admin_notes?: string;
    priority?: string;
  }) {
    const response = await axios.put(
      `${API_BASE_URL}/requests/${requestId}`,
      data,
      {
        headers: {
          Authorization: `Bearer ${await AuthService.ensureValidToken()}`,
        },
      }
    );
    return response.data;
  }

  // System Logs
  static async getLogs(page = 1, limit = 50, level?: string, entity?: string, action?: string): Promise<PaginatedResponse<SystemLog>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (level) params.append('level', level);
    if (entity) params.append('entity', entity);
    if (action) params.append('action', action);

    const response = await adminApi.get(`/logs?${params.toString()}`);
    return response.data;
  }

  // Settings
  static async getSettings() {
    const response = await adminApi.get('/settings');
    return response.data;
  }

  static async updateSettings(settings: Record<string, any>) {
    const response = await adminApi.put('/settings', settings);
    return response.data;
  }
}

export default AdminApiService;