'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RealTimeData {
  time: string;
  concurrent_streams: number;
  active_users: number;
  bandwidth_usage: number;
}

interface RealTimeMetricsProps {
  loading?: boolean;
}

export default function RealTimeMetrics({ loading }: RealTimeMetricsProps) {
  const [data, setData] = useState<RealTimeData[]>([]);
  const [isLive, setIsLive] = useState(true);

  // Simulate real-time data
  useEffect(() => {
    if (!isLive) return;

    const generateDataPoint = (): RealTimeData => {
      const now = new Date();
      return {
        time: now.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }),
        concurrent_streams: Math.floor(Math.random() * 100) + 50,
        active_users: Math.floor(Math.random() * 500) + 200,
        bandwidth_usage: Math.floor(Math.random() * 1000) + 500,
      };
    };

    // Initialize with some data points
    const initialData = Array.from({ length: 20 }, (_, i) => {
      const time = new Date(Date.now() - (19 - i) * 5000);
      return {
        time: time.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }),
        concurrent_streams: Math.floor(Math.random() * 100) + 50,
        active_users: Math.floor(Math.random() * 500) + 200,
        bandwidth_usage: Math.floor(Math.random() * 1000) + 500,
      };
    });

    setData(initialData);

    const interval = setInterval(() => {
      setData(prevData => {
        const newData = [...prevData.slice(1), generateDataPoint()];
        return newData;
      });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isLive]);

  const toggleLive = () => {
    setIsLive(!isLive);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-700 p-3 rounded-lg border border-dark-600">
          <p className="text-gray-300 text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.dataKey === 'concurrent_streams' && 'Streams: '}
              {entry.dataKey === 'active_users' && 'Usuários: '}
              {entry.dataKey === 'bandwidth_usage' && 'Bandwidth: '}
              {entry.value}
              {entry.dataKey === 'bandwidth_usage' && ' MB/s'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="h-80 bg-dark-800 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Métricas em Tempo Real</h3>
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-sm text-gray-400">{isLive ? 'AO VIVO' : 'PAUSADO'}</span>
          </div>
          <button
            onClick={toggleLive}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              isLive 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isLive ? 'Pausar' : 'Iniciar'}
          </button>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorStreams" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorBandwidth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              stroke="#9CA3AF"
              fontSize={10}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#9CA3AF"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="concurrent_streams"
              stroke="#EF4444"
              fillOpacity={1}
              fill="url(#colorStreams)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="active_users"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#colorUsers)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="bandwidth_usage"
              stroke="#10B981"
              fillOpacity={1}
              fill="url(#colorBandwidth)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex justify-center space-x-6 mt-4">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
          <span className="text-sm text-gray-400">Streams Concorrentes</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-2 bg-blue-500"></div>
          <span className="text-sm text-gray-400">Usuários Ativos</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-2 bg-green-500"></div>
          <span className="text-sm text-gray-400">Bandwidth (MB/s)</span>
        </div>
      </div>

      {/* Current Values */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-dark-600">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">
            {data[data.length - 1]?.concurrent_streams || 0}
          </div>
          <div className="text-xs text-gray-400">Streams</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">
            {data[data.length - 1]?.active_users || 0}
          </div>
          <div className="text-xs text-gray-400">Usuários</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">
            {data[data.length - 1]?.bandwidth_usage || 0}
          </div>
          <div className="text-xs text-gray-400">MB/s</div>
        </div>
      </div>
    </div>
  );
}