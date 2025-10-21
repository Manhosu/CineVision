import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface UserSession {
  session_id: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  ip_address?: string;
  user_agent?: string;
  current_page?: string;
  is_watching?: boolean;
  watching_content_id?: string;
  watching_content_title?: string;
}

export interface ActivityEvent {
  session_id: string;
  user_id?: string;
  event_type: 'page_view' | 'video_start' | 'video_pause' | 'video_resume' | 'video_end' | 'purchase' | 'search';
  content_id?: string;
  content_title?: string;
  metadata?: any;
}

export interface RealtimeStats {
  total_online: number;
  total_watching: number;
  total_browsing: number;
  watching_by_content?: Array<{
    content_id: string;
    content_title: string;
    viewer_count: number;
  }>;
  recent_activities?: Array<{
    event_type: string;
    content_title?: string;
    timestamp: string;
  }>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.error('Supabase credentials not configured for analytics');
      throw new Error('Supabase credentials missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('Analytics service initialized');
  }

  /**
   * Registrar ou atualizar sessão de usuário
   */
  async upsertUserSession(session: UserSession): Promise<void> {
    try {
      // Se temos user_id mas não temos user_name, buscar do auth.users
      let userName = session.user_name;
      if (session.user_id && !userName) {
        const { data: userData } = await this.supabase.auth.admin.getUserById(session.user_id);
        if (userData?.user?.user_metadata?.name) {
          userName = userData.user.user_metadata.name;
        } else if (userData?.user?.email) {
          // Fallback: usar parte do email antes do @
          userName = userData.user.email.split('@')[0];
        }
      }

      const { error } = await this.supabase
        .from('user_sessions')
        .upsert({
          session_id: session.session_id,
          user_id: session.user_id,
          user_email: session.user_email,
          user_name: userName,
          ip_address: session.ip_address,
          user_agent: session.user_agent,
          current_page: session.current_page,
          is_watching: session.is_watching || false,
          watching_content_id: session.watching_content_id,
          watching_content_title: session.watching_content_title,
          last_activity: new Date().toISOString(),
          status: 'online',
        }, {
          onConflict: 'session_id'
        });

      if (error) {
        this.logger.error('Error upserting user session:', error);
        throw error;
      }

      this.logger.debug(`Session updated: ${session.session_id}`);
    } catch (error) {
      this.logger.error('Failed to upsert user session:', error);
      throw error;
    }
  }

  /**
   * Marcar sessão como offline
   */
  async endUserSession(sessionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_sessions')
        .update({
          status: 'offline',
          disconnected_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      if (error) {
        this.logger.error('Error ending user session:', error);
        throw error;
      }

      this.logger.debug(`Session ended: ${sessionId}`);
    } catch (error) {
      this.logger.error('Failed to end user session:', error);
      throw error;
    }
  }

  /**
   * Registrar evento de atividade
   */
  async trackActivity(event: ActivityEvent): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('activity_events')
        .insert({
          session_id: event.session_id,
          user_id: event.user_id,
          event_type: event.event_type,
          content_id: event.content_id,
          content_title: event.content_title,
          metadata: event.metadata,
        });

      if (error) {
        this.logger.error('Error tracking activity:', error);
        throw error;
      }

      this.logger.debug(`Activity tracked: ${event.event_type} - ${event.session_id}`);
    } catch (error) {
      this.logger.error('Failed to track activity:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas em tempo real
   */
  async getRealtimeStats(): Promise<RealtimeStats> {
    try {
      // Limpar sessões inativas primeiro
      await this.supabase.rpc('cleanup_inactive_sessions');

      // Obter contadores gerais
      const { data: sessions, error: sessionsError } = await this.supabase
        .from('user_sessions')
        .select('*')
        .eq('status', 'online');

      if (sessionsError) {
        throw sessionsError;
      }

      const total_online = sessions?.length || 0;
      const watching_sessions = sessions?.filter(s => s.is_watching) || [];
      const total_watching = watching_sessions.length;
      const total_browsing = total_online - total_watching;

      // Agrupar por conteúdo sendo assistido
      const watching_by_content = watching_sessions.reduce((acc, session) => {
        if (session.watching_content_id) {
          const existing = acc.find(item => item.content_id === session.watching_content_id);
          if (existing) {
            existing.viewer_count++;
          } else {
            acc.push({
              content_id: session.watching_content_id,
              content_title: session.watching_content_title || 'Unknown',
              viewer_count: 1,
            });
          }
        }
        return acc;
      }, [] as Array<{ content_id: string; content_title: string; viewer_count: number }>);

      // Ordenar por mais assistidos
      watching_by_content.sort((a, b) => b.viewer_count - a.viewer_count);

      // Obter atividades recentes (últimos 10 minutos)
      const { data: recent_events } = await this.supabase
        .from('activity_events')
        .select('event_type, content_title, created_at')
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      const recent_activities = recent_events?.map(event => ({
        event_type: event.event_type,
        content_title: event.content_title,
        timestamp: event.created_at,
      })) || [];

      return {
        total_online,
        total_watching,
        total_browsing,
        watching_by_content: watching_by_content.slice(0, 10), // Top 10
        recent_activities,
      };
    } catch (error) {
      this.logger.error('Failed to get realtime stats:', error);
      throw error;
    }
  }

  /**
   * Obter todas as sessões ativas
   */
  async getActiveSessions(): Promise<any[]> {
    try {
      await this.supabase.rpc('cleanup_inactive_sessions');

      const { data, error } = await this.supabase
        .from('user_sessions')
        .select(`
          *,
          users:user_id (
            id,
            email,
            name,
            telegram_id,
            telegram_username
          )
        `)
        .eq('status', 'online')
        .order('last_activity', { ascending: false });

      if (error) {
        throw error;
      }

      // Flatten user data to session level for easier access in frontend
      const sessions = (data || []).map(session => {
        const user = session.users;
        return {
          ...session,
          user_email: user?.email || session.user_email,
          user_name: user?.name || session.user_name,
          telegram_id: user?.telegram_id || session.telegram_id,
          telegram_username: user?.telegram_username || session.telegram_username,
          users: undefined, // Remove nested user object
        };
      });

      return sessions;
    } catch (error) {
      this.logger.error('Failed to get active sessions:', error);
      throw error;
    }
  }

  /**
   * Obter atividades recentes
   */
  async getRecentActivities(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('activity_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get recent activities:', error);
      throw error;
    }
  }
}
