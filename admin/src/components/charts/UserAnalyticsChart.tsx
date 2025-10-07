'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface UserAnalyticsData {
  date: string;
  new_users: number;
  active_users: number;
  blocked_users: number;
}

interface UserStatusData {
  name: string;
  value: number;
  color: string;
}

interface UserAnalyticsChartProps {
  data: UserAnalyticsData[];
  statusData: UserStatusData[];
  loading?: boolean;
}

const COLORS = {
  new_users: '#3B82F6',
  active_users: '#10B981',
  blocked_users: '#EF4444',
};

export default function UserAnalyticsChart({ data, statusData, loading }: UserAnalyticsChartProps) {
  if (loading) {
    return (
      <div className="h-80 bg-dark-800 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-700 p-3 rounded-lg border border-dark-600">
          <p className="text-gray-300 text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.dataKey === 'new_users' && 'Novos: '}
              {entry.dataKey === 'active_users' && 'Ativos: '}
              {entry.dataKey === 'blocked_users' && 'Bloqueados: '}
              {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-dark-700 p-3 rounded-lg border border-dark-600">
          <p className="text-gray-300 text-sm">{data.payload.name}</p>
          <p style={{ color: data.payload.color }} className="font-semibold">
            {data.value} usuários
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Bar Chart - User Activity Over Time */}
      <div className="lg:col-span-2 card">
        <h3 className="text-lg font-semibold text-white mb-4">Atividade de Usuários</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="new_users"
                fill={COLORS.new_users}
                name="Novos Usuários"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="active_users"
                fill={COLORS.active_users}
                name="Usuários Ativos"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="blocked_users"
                fill={COLORS.blocked_users}
                name="Usuários Bloqueados"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex justify-center space-x-6 mt-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS.new_users }}></div>
            <span className="text-sm text-gray-400">Novos</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS.active_users }}></div>
            <span className="text-sm text-gray-400">Ativos</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS.blocked_users }}></div>
            <span className="text-sm text-gray-400">Bloqueados</span>
          </div>
        </div>
      </div>

      {/* Pie Chart - User Status Distribution */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Distribuição de Status</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Pie Legend */}
        <div className="space-y-2 mt-4">
          {statusData.map((entry, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-sm text-gray-400">{entry.name}</span>
              </div>
              <span className="text-sm text-white font-semibold">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}