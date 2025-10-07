import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthService, { User } from '@/services/authService';

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<{ requires2FA?: boolean }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated on mount
    const checkAuth = () => {
      const currentUser = AuthService.getUser();
      const isAuth = AuthService.isAuthenticated();
      
      setUser(currentUser);
      setIsLoading(false);

      // If not authenticated and not on login page, redirect
      if (!isAuth && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        router.push('/login');
      }
    };

    checkAuth();

    // Set up token refresh interval
    const refreshInterval = setInterval(async () => {
      if (AuthService.isAuthenticated() && AuthService.isTokenExpiringSoon()) {
        await AuthService.refreshToken();
      }
    }, 4 * 60 * 1000); // Check every 4 minutes

    return () => clearInterval(refreshInterval);
  }, [router]);

  const login = async (email: string, password: string, twoFactorCode?: string) => {
    try {
      const response = await AuthService.login({ email, password, twoFactorCode });
      
      if (response.requires_2fa) {
        return { requires2FA: true };
      }

      setUser(response.user);
      return {};
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AuthService.logout();
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      AuthService.clearStorage();
      setUser(null);
      router.push('/login');
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const newToken = await AuthService.refreshToken();
      return !!newToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
      return false;
    }
  };

  return {
    user,
    isAuthenticated: !!user && AuthService.isAuthenticated(),
    isLoading,
    login,
    logout,
    refreshToken,
  };
}