'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Top10Item {
  position: number;
  id: string;
  title: string;
  thumbnail_url: string | null;
  poster_url?: string | null;
  weekly_sales: number;
  views_count: number;
  price: number;
  status: string;
}

function getNextSundayMidnight(): Date {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilSunday);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getLastSundayMidnight(): Date {
  const now = new Date();
  const daysSinceSunday = now.getDay() || 7;
  const last = new Date(now);
  last.setDate(now.getDate() - daysSinceSunday);
  last.setHours(0, 0, 0, 0);
  return last;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00d 00h 00m 00s';
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  const h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((ms % (1000 * 60)) / 1000);
  return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminTop10Page() {
  const [activeTab, setActiveTab] = useState<'movie' | 'series'>('movie');
  const [data, setData] = useState<Top10Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [nextReset, setNextReset] = useState<Date>(getNextSundayMidnight());
  const [lastReset, setLastReset] = useState<Date>(getLastSundayMidnight());

  // Countdown timer
  useEffect(() => {
    const update = () => {
      const now = new Date();
      let next = getNextSundayMidnight();
      // If it's exactly Sunday 00:00, the next is 7 days ahead
      if (now >= next) {
        next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      setNextReset(next);
      setLastReset(getLastSundayMidnight());
      setCountdown(formatCountdown(next.getTime() - now.getTime()));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchTop10 = async () => {
      try {
        setLoading(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const token = typeof window !== 'undefined'
          ? (localStorage.getItem('access_token') || localStorage.getItem('auth_token'))
          : null;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/api/v1/admin/top10/current?type=${activeTab}`, { headers });
        const result = await res.json();
        setData(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error('Error fetching top 10:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTop10();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Top 10 Semanal</h1>
            <p className="text-gray-400 text-sm">Ranking dos conteúdos mais vendidos da semana</p>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar
          </Link>
        </div>

        {/* Reset Timer Card */}
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Próximo reset</p>
                <p className="text-gray-400 text-xs">{formatDate(nextReset)}</p>
              </div>
            </div>

            {/* Countdown */}
            <div className="flex items-center gap-1.5">
              {countdown.split(' ').map((part, i) => (
                <div key={i} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[52px]">
                  <span className="text-white font-mono font-bold text-lg">{part.slice(0, -1)}</span>
                  <span className="text-blue-400 font-mono text-xs ml-0.5">{part.slice(-1)}</span>
                </div>
              ))}
            </div>

            <div className="text-right">
              <p className="text-gray-500 text-xs">Último reset</p>
              <p className="text-gray-400 text-xs">{formatDate(lastReset)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('movie')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === 'movie'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30'
                : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            Filmes
          </button>
          <button
            onClick={() => setActiveTab('series')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === 'series'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30'
                : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            Séries
          </button>
        </div>

        {/* Table */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">#</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Conteúdo</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Vendas Semanais</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Preço</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-700/30">
                      <td colSpan={4} className="px-6 py-4">
                        <div className="animate-pulse bg-gray-700 h-14 rounded" />
                      </td>
                    </tr>
                  ))
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Nenhum conteúdo encontrado para esta categoria.
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors"
                    >
                      {/* Position */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm ${
                          item.position === 1
                            ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg shadow-yellow-500/30'
                            : item.position === 2
                              ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-black'
                              : item.position === 3
                                ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-black'
                                : 'bg-gray-700 text-gray-300'
                        }`}>
                          {item.position}
                        </span>
                      </td>

                      {/* Thumbnail + Title */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {item.thumbnail_url || item.poster_url ? (
                            <img
                              src={item.poster_url || item.thumbnail_url || ''}
                              alt={item.title}
                              className="w-12 h-[72px] object-cover rounded-lg flex-shrink-0 border border-white/10"
                            />
                          ) : (
                            <div className="w-12 h-[72px] bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <span className="text-white font-medium">{item.title}</span>
                        </div>
                      </td>

                      {/* Weekly Sales */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-green-400 font-bold text-lg">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          {item.weekly_sales || 0}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-6 py-4">
                        <span className="text-white font-semibold">
                          {item.price != null
                            ? `R$ ${(item.price / 100).toFixed(2)}`
                            : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
