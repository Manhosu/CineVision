'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  name?: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Mapear usuário do Supabase para nosso formato
  const mapSupabaseUser = async (supabaseUser: SupabaseUser): Promise<User> => {
    // Verificar se é admin pelo email
    const isAdmin = supabaseUser.email === 'adm@cinevision.com.br';

    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      role: isAdmin ? 'admin' : (supabaseUser.user_metadata?.role || 'user'),
      name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0]
    };
  };

  const checkAuth = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      setIsLoading(true);

      // First check for JWT tokens from backend (telegram-login)
      const backendToken = localStorage.getItem('access_token');
      const userStr = localStorage.getItem('user');

      if (backendToken && userStr) {
        try {
          const userData = JSON.parse(userStr);
          setUser({
            id: userData.id,
            email: userData.email || 'telegram-user@cinevision.com',
            role: userData.role || 'user',
            name: userData.name || userData.telegram_username || 'Usuário',
            telegram_id: userData.telegram_id,
            telegram_username: userData.telegram_username
          });
          setIsAuthenticated(true);
          localStorage.setItem('auth_token', backendToken);
          setIsLoading(false);
          return;
        } catch (parseError) {
          console.error('Error parsing backend user data:', parseError);
        }
      }

      // Fallback to Supabase Auth
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const mappedUser = await mapSupabaseUser(session.user);
        setUser(mappedUser);
        setIsAuthenticated(true);

        // Manter token no localStorage para compatibilidade com sistema antigo
        localStorage.setItem('auth_token', session.access_token);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Call backend login endpoint to get JWT tokens
      const response = await fetch(`${API_URL}/api/v1/supabase-auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (result.status === 'error' || !result.access_token) {
        throw new Error(result.message || 'Login failed');
      }

      // Save backend JWT tokens
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', result.access_token);
        localStorage.setItem('refresh_token', result.refresh_token);
        localStorage.setItem('auth_token', result.access_token); // For compatibility
        localStorage.setItem('user', JSON.stringify(result.user));
      }

      // Set user state
      setUser({
        id: result.user.id,
        email: result.user.email,
        role: result.user.role || 'user',
        name: result.user.name || result.user.email.split('@')[0],
      });
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      });

      if (error) throw error;

      // Registrar também no backend para sincronização
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            email,
            password,
          }),
        });
      } catch (backendError) {
        console.error('Backend registration failed:', backendError);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  useEffect(() => {
    checkAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const mappedUser = await mapSupabaseUser(session.user);
          setUser(mappedUser);
          setIsAuthenticated(true);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuth]);

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    checkAuth,
  };
}
