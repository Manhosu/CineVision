/**
 * Analytics tracking utility
 * Tracks user sessions and activities for real-time analytics
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Generate a unique session ID
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Get or create session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

// Get user info from Supabase Auth
async function getUserInfo() {
  if (typeof window === 'undefined') return {};

  try {
    // Import Supabase client dynamically to avoid SSR issues
    const { supabase } = await import('@/lib/supabase');

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Get user name from metadata, fallback to email username
      const userName = user.user_metadata?.name || user.email?.split('@')[0];

      // Buscar dados adicionais do usuário na tabela users (incluindo telegram_id)
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('telegram_id, telegram_username, name')
          .eq('id', user.id)
          .single();

        if (userError) {
          console.error('[Analytics] ERRO ao buscar telegram_id da tabela users:', {
            error: userError,
            user_id: user.id,
            code: userError.code,
            message: userError.message,
            details: userError.details
          });
        }

        if (userData) {
          console.log('[Analytics] Dados do usuário encontrados:', {
            user_id: user.id,
            has_telegram_id: !!userData.telegram_id,
            telegram_id: userData.telegram_id,
            telegram_username: userData.telegram_username
          });

          return {
            user_id: user.id,
            user_email: user.email,
            user_name: userData.name || userName,
            telegram_id: userData.telegram_id,
            telegram_username: userData.telegram_username,
          };
        }
      } catch (dbError) {
        console.error('[Analytics] EXCEÇÃO ao buscar dados do usuário:', dbError);
      }

      // Fallback: tentar buscar telegram_id do user_metadata do Supabase Auth
      const telegramIdFromMetadata = user.user_metadata?.telegram_id || user.user_metadata?.telegramId;
      const telegramUsernameFromMetadata = user.user_metadata?.telegram_username || user.user_metadata?.telegramUsername;

      console.warn('[Analytics] Usando fallback - telegram_id da metadata:', {
        user_id: user.id,
        telegram_id_from_metadata: telegramIdFromMetadata,
        has_telegram_id: !!telegramIdFromMetadata
      });

      return {
        user_id: user.id,
        user_email: user.email,
        user_name: userName,
        telegram_id: telegramIdFromMetadata,
        telegram_username: telegramUsernameFromMetadata,
      };
    }
  } catch (error) {
    console.debug('Error getting user info:', error);
  }

  return {};
}

// Track user session
export async function trackSession(data: {
  current_page?: string;
  is_watching?: boolean;
  watching_content_id?: string;
  watching_content_title?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const sessionId = getSessionId();
    const userInfo = await getUserInfo();

    await fetch(`${API_URL}/api/v1/analytics/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        ...userInfo,
        user_agent: navigator.userAgent,
        current_page: data.current_page || window.location.pathname,
        is_watching: data.is_watching || false,
        watching_content_id: data.watching_content_id,
        watching_content_title: data.watching_content_title,
      }),
    });
  } catch (error) {
    // Fail silently - analytics should not break the app
    console.debug('Analytics tracking error:', error);
  }
}

// End user session
export async function endSession(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const sessionId = getSessionId();

    await fetch(`${API_URL}/api/v1/analytics/session/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
      }),
    });

    // Clear session ID
    sessionStorage.removeItem('analytics_session_id');
  } catch (error) {
    console.debug('Analytics end session error:', error);
  }
}

// Track activity event
export async function trackActivity(event: {
  event_type: 'page_view' | 'video_start' | 'video_pause' | 'video_resume' | 'video_end' | 'purchase' | 'search';
  content_id?: string;
  content_title?: string;
  metadata?: any;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const sessionId = getSessionId();
    const userInfo = await getUserInfo();

    await fetch(`${API_URL}/api/v1/analytics/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        ...userInfo,
        ...event,
      }),
    });
  } catch (error) {
    console.debug('Analytics track activity error:', error);
  }
}

// Initialize session tracking on page load
export function initializeAnalytics(): void {
  if (typeof window === 'undefined') return;

  // Track initial page view
  trackSession({
    current_page: window.location.pathname,
    is_watching: false,
  });

  // Track page views on navigation
  // Eduardo (15/07): antes tinha setInterval de 1s pra detectar mudança de
  // rota + heartbeat de 30s. Ambos batendo em user_sessions/activity_events
  // consumiam Disk IO da instância Supabase (Advisor: "Disk IO budget is
  // being consumed"). Mudanças:
  //   - Path change: escuta history.pushState/replaceState/popstate direto
  //     (evento nativo, ~0 CPU vs setInterval a cada 1s) → dispara track
  //     imediato ao invés de esperar até 1s.
  //   - Heartbeat: 30s → 120s (2min). Corta 75% dos UPSERTs em
  //     user_sessions sem afetar UX (sessão fica "online" por 5min
  //     desde o último ping — 2min é folgado).
  let lastPath = window.location.pathname;
  const onPathChange = () => {
    if (window.location.pathname === lastPath) return;
    lastPath = window.location.pathname;
    trackSession({
      current_page: window.location.pathname,
      is_watching: false,
    });
    trackActivity({
      event_type: 'page_view',
    });
  };

  // Intercepta pushState/replaceState pra emitir evento — Next Router
  // dispara esses ao navegar client-side. Fallback popstate pra voltar.
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  history.pushState = function (...args) {
    origPushState.apply(this, args as any);
    onPathChange();
  };
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args as any);
    onPathChange();
  };
  window.addEventListener('popstate', onPathChange);

  // Heartbeat a cada 2min (era 30s — cortamos 75% do tráfego).
  setInterval(() => {
    trackSession({
      current_page: window.location.pathname,
    });
  }, 120000);

  // Track session end on page unload
  window.addEventListener('beforeunload', () => {
    // Use navigator.sendBeacon for reliable delivery on page unload
    const sessionId = getSessionId();
    const url = `${API_URL}/api/v1/analytics/session/end`;
    const data = JSON.stringify({ session_id: sessionId });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, data);
    } else {
      // Fallback for browsers without sendBeacon
      endSession();
    }
  });
}
