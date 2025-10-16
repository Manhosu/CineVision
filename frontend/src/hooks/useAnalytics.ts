import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { usePathname } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SessionData {
  session_id: string;
  user_id?: string;
  user_email?: string;
  current_page?: string;
  is_watching?: boolean;
  watching_content_id?: string;
  watching_content_title?: string;
}

interface ActivityEvent {
  session_id: string;
  user_id?: string;
  event_type: 'page_view' | 'video_start' | 'video_pause' | 'video_resume' | 'video_end' | 'purchase' | 'search';
  content_id?: string;
  content_title?: string;
  metadata?: any;
}

/**
 * Hook para rastreamento de analytics em tempo real
 * Envia dados de sessão e atividade para o backend
 */
export function useAnalytics() {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Gerar ou recuperar session ID
  const getSessionId = useCallback(() => {
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    // Tentar recuperar do sessionStorage
    let sessionId = sessionStorage.getItem('analytics_session_id');

    if (!sessionId) {
      // Gerar novo session ID
      sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }

    sessionIdRef.current = sessionId;
    return sessionId;
  }, []);

  // Enviar dados de sessão
  const updateSession = useCallback(async (data: Partial<SessionData>) => {
    const sessionId = getSessionId();

    const sessionData: SessionData = {
      session_id: sessionId,
      user_id: user?.id,
      user_email: user?.email,
      current_page: pathname,
      ...data,
    };

    try {
      await fetch(`${API_URL}/api/v1/analytics/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });
    } catch (error) {
      console.error('[Analytics] Error updating session:', error);
    }
  }, [user, pathname, getSessionId]);

  // Rastrear atividade
  const trackActivity = useCallback(async (
    eventType: ActivityEvent['event_type'],
    contentId?: string,
    contentTitle?: string,
    metadata?: any
  ) => {
    const sessionId = getSessionId();

    const event: ActivityEvent = {
      session_id: sessionId,
      user_id: user?.id,
      event_type: eventType,
      content_id: contentId,
      content_title: contentTitle,
      metadata,
    };

    try {
      await fetch(`${API_URL}/api/v1/analytics/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('[Analytics] Error tracking activity:', error);
    }
  }, [user, getSessionId]);

  // Rastrear visualização de vídeo
  const trackVideoStart = useCallback((contentId: string, contentTitle: string) => {
    trackActivity('video_start', contentId, contentTitle);
    updateSession({
      is_watching: true,
      watching_content_id: contentId,
      watching_content_title: contentTitle,
    });
  }, [trackActivity, updateSession]);

  const trackVideoPause = useCallback((contentId: string, contentTitle: string) => {
    trackActivity('video_pause', contentId, contentTitle);
  }, [trackActivity]);

  const trackVideoResume = useCallback((contentId: string, contentTitle: string) => {
    trackActivity('video_resume', contentId, contentTitle);
  }, [trackActivity]);

  const trackVideoEnd = useCallback((contentId: string, contentTitle: string) => {
    trackActivity('video_end', contentId, contentTitle);
    updateSession({
      is_watching: false,
      watching_content_id: undefined,
      watching_content_title: undefined,
    });
  }, [trackActivity, updateSession]);

  const trackSearch = useCallback((query: string) => {
    trackActivity('search', undefined, query);
  }, [trackActivity]);

  const trackPurchase = useCallback((contentId: string, contentTitle: string) => {
    trackActivity('purchase', contentId, contentTitle);
  }, [trackActivity]);

  // Inicializar sessão ao montar o componente
  useEffect(() => {
    // Enviar dados iniciais da sessão
    updateSession({
      is_watching: false,
    });

    // Rastrear page view
    trackActivity('page_view');

    // Heartbeat - atualizar sessão a cada 30 segundos
    heartbeatIntervalRef.current = setInterval(() => {
      updateSession({});
    }, 30000); // 30 segundos

    // Cleanup ao desmontar
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Marcar sessão como offline
      const sessionId = getSessionId();
      fetch(`${API_URL}/api/v1/analytics/session/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(console.error);
    };
  }, [updateSession, trackActivity, getSessionId]);

  // Atualizar sessão quando a página mudar
  useEffect(() => {
    updateSession({
      current_page: pathname,
      is_watching: false,
    });
    trackActivity('page_view');
  }, [pathname, updateSession, trackActivity]);

  // Atualizar sessão quando o usuário logar/deslogar
  useEffect(() => {
    if (user) {
      updateSession({
        user_id: user.id,
        user_email: user.email,
      });
    }
  }, [user, updateSession]);

  return {
    trackVideoStart,
    trackVideoPause,
    trackVideoResume,
    trackVideoEnd,
    trackSearch,
    trackPurchase,
    trackActivity,
    updateSession,
  };
}
