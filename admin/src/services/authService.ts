interface LoginCredentials {
  email: string;
  password: string;
  twoFactorCode?: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  access_token: string;
  refresh_token: string;
  requires_2fa?: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

class AuthService {
  private static readonly API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  private static readonly TOKEN_KEY = 'admin_token';
  private static readonly REFRESH_TOKEN_KEY = 'admin_refresh_token';
  private static readonly USER_KEY = 'admin_user';

  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${this.API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data: AuthResponse = await response.json();

    // Verificar se o usuário tem role de admin
    if (data.user.role.toLowerCase() !== 'admin') {
      throw new Error('Acesso negado. Apenas administradores podem acessar este painel.');
    }

    // Se não requer 2FA, salvar tokens
    if (!data.requires_2fa) {
      this.setTokens(data.access_token, data.refresh_token);
      this.setUser(data.user);
    }

    return data;
  }

  static async verify2FA(email: string, code: string): Promise<AuthResponse> {
    const response = await fetch(`${this.API_BASE}/auth/verify-2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '2FA verification failed');
    }

    const data: AuthResponse = await response.json();

    this.setTokens(data.access_token, data.refresh_token);
    this.setUser(data.user);

    return data;
  }

  static async refreshToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${this.API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        this.logout();
        return null;
      }

      const data = await response.json();
      this.setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch (error) {
      this.logout();
      return null;
    }
  }

  static async logout(): Promise<void> {
    const token = this.getToken();
    
    if (token) {
      try {
        await fetch(`${this.API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    this.clearStorage();
  }

  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static getUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  static isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  }

  static setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  static setUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static clearStorage(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  // Verificar se o token está próximo do vencimento
  static isTokenExpiringSoon(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = exp - now;
      
      // Renovar se expira em menos de 5 minutos
      return timeUntilExpiry < 5 * 60 * 1000;
    } catch (error) {
      return true;
    }
  }

  // Auto-renovação de token
  static async ensureValidToken(): Promise<string | null> {
    if (!this.isAuthenticated()) return null;

    if (this.isTokenExpiringSoon()) {
      return await this.refreshToken();
    }

    return this.getToken();
  }
}

export default AuthService;
export type { LoginCredentials, AuthResponse, User };