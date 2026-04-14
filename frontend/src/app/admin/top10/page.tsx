'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Top10Item {
  position: number;
  id: string;
  title: string;
  thumbnail_url: string | null;
  weekly_sales: number;
  views_count: number;
  price: number;
  status: string;
}

export default function AdminTop10Page() {
  const [activeTab, setActiveTab] = useState<'movie' | 'series'>('movie');
  const [data, setData] = useState<Top10Item[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Top 10 Semanal</h1>
            <p className="text-gray-400">Ranking dos conteudos mais vendidos da semana</p>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar
          </Link>
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
            Series
          </button>
        </div>

        {/* Table */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">#</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Thumbnail</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Titulo</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Vendas Semanais</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Visualizacoes</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Preco</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-700/30">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="animate-pulse bg-gray-700 h-10 rounded" />
                      </td>
                    </tr>
                  ))
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Nenhum conteudo encontrado para esta categoria.
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          item.position <= 3
                            ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-black'
                            : 'bg-gray-700 text-gray-300'
                        }`}>
                          {item.position}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.title}
                            className="w-16 h-10 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-16 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-white font-medium">{item.title}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-green-400 font-semibold">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          {item.weekly_sales || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{item.views_count || 0}</td>
                      <td className="px-6 py-4 text-gray-300">
                        {item.price != null
                          ? `R$ ${(item.price / 100).toFixed(2)}`
                          : 'N/A'}
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
