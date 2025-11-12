'use client';

import { useEffect, useState } from 'react';
import { Eye, Users, Film, Activity } from 'lucide-react';

interface RealtimeStats {
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

interface ActiveSession {
  session_id: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  telegram_id?: string;
  telegram_username?: string;
  current_page?: string;
  is_watching: boolean;
  watching_content_title?: string;
  last_activity: string;
  status: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Group sessions by user to avoid duplicates
function groupSessionsByUser(sessions: ActiveSession[]) {
  const grouped = new Map<string, {
    key: string;
    user_id?: string;
    user_name?: string;
    telegram_id?: string;
    telegram_username?: string;
    session_id: string;
    is_watching: boolean;
    last_activity: string;
    session_count: number;
  }>();

  sessions.forEach((session) => {
    // Use user_id for authenticated users, session_id for anonymous visitors
    const key = session.user_id || session.session_id;

    if (grouped.has(key)) {
      const existing = grouped.get(key)!;
      existing.session_count++;

      // Update to most recent activity
      if (new Date(session.last_activity) > new Date(existing.last_activity)) {
        existing.last_activity = session.last_activity;
        existing.is_watching = session.is_watching;
      }

      // If any session is watching, mark as watching
      if (session.is_watching) {
        existing.is_watching = true;
      }
    } else {
      grouped.set(key, {
        key,
        user_id: session.user_id,
        user_name: session.user_name,
        telegram_id: session.telegram_id,
        telegram_username: session.telegram_username,
        session_id: session.session_id,
        is_watching: session.is_watching,
        last_activity: session.last_activity,
        session_count: 1,
      });
    }
  });

  // Convert map to array and sort by last activity
  return Array.from(grouped.values()).sort((a, b) =>
    new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
  );
}

export function RealtimeAnalytics() {
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch realtime stats with retry
  const fetchStats = async (retries = 2) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/analytics/realtime-stats`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        if (retries > 0 && (response.status === 502 || response.status === 503)) {
          // Backend cold start - retry after delay
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchStats(retries - 1);
        }
        throw new Error('Erro ao carregar estatísticas');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setStats(result.data);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      if (retries === 0) {
        setError('Erro ao carregar estatísticas');
      }
    }
  };

  // Fetch active sessions with retry
  const fetchSessions = async (retries = 2) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/analytics/active-sessions`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        if (retries > 0 && (response.status === 502 || response.status === 503)) {
          // Backend cold start - retry after delay
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchSessions(retries - 1);
        }
        throw new Error('Erro ao carregar sessões');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setSessions(result.data);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      // Silently fail - don't break the UI
      if (retries === 0) {
        setSessions([]);
      }
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchStats(), fetchSessions()]);
      setIsLoading(false);
      setLastUpdate(new Date());
    };

    loadData();
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      await Promise.all([fetchStats(), fetchSessions()]);
      setLastUpdate(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-dark-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 bg-white/10 rounded"></div>
            <div className="h-24 bg-white/10 rounded"></div>
            <div className="h-24 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-900/50 backdrop-blur-sm border border-red-500/30 rounded-xl p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary-500" />
          Análise em Tempo Real
        </h2>
        <div className="text-sm text-gray-400">
          Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Online */}
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-300 mb-1">Usuários Online</p>
              <p className="text-4xl font-bold text-white">
                {stats?.total_online || 0}
              </p>
            </div>
            <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Watching */}
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-300 mb-1">Assistindo</p>
              <p className="text-4xl font-bold text-white">
                {stats?.total_watching || 0}
              </p>
            </div>
            <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center">
              <Film className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Browsing */}
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-300 mb-1">Navegando</p>
              <p className="text-4xl font-bold text-white">
                {stats?.total_browsing || 0}
              </p>
            </div>
            <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Eye className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Most Watched Content */}
      {stats?.watching_by_content && stats.watching_by_content.length > 0 && (
        <div className="bg-dark-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Film className="w-5 h-5 text-primary-500" />
            Mais Assistidos Agora
          </h3>
          <div className="space-y-3">
            {stats.watching_by_content.slice(0, 5).map((content, index) => (
              <div
                key={content.content_id}
                className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-400 font-bold text-sm">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {content.content_title}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  <Eye className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-semibold">
                    {content.viewer_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Sessions Table */}
      {sessions.length > 0 && (
        <div className="bg-dark-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-500" />
            Sessões Ativas ({sessions.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Usuário</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Última Atividade</th>
                </tr>
              </thead>
              <tbody>
                {groupSessionsByUser(sessions).slice(0, 10).map((sessionGroup) => (
                  <tr
                    key={sessionGroup.key}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">
                            {sessionGroup.user_name || `Visitante #${sessionGroup.session_id.slice(-6)}`}
                          </p>
                          {sessionGroup.session_count > 1 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary-500/20 text-primary-400 text-xs font-medium">
                              {sessionGroup.session_count} abas
                            </span>
                          )}
                        </div>
                        {sessionGroup.telegram_id && (
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                            <span className="font-mono">📱 {sessionGroup.telegram_id}</span>
                            {sessionGroup.telegram_username && (
                              <span>@{sessionGroup.telegram_username}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {sessionGroup.is_watching ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                          <Eye className="w-3 h-3" />
                          Assistindo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                          <Activity className="w-3 h-3" />
                          Navegando
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {formatTimestamp(sessionGroup.last_activity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}m atrás`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h atrás`;
  return date.toLocaleDateString('pt-BR');
}
