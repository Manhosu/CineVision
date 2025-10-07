'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TopContentData {
  content_id: string;
  title: string;
  purchases: number;
  revenue: number;
  views: number;
}

interface TopContentChartProps {
  data: TopContentData[];
  loading?: boolean;
}

export default function TopContentChart({ data, loading }: TopContentChartProps) {
  if (loading) {
    return (
      <div className="h-80 bg-dark-800 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  // Limit to top 5 and truncate long titles
  const chartData = data.slice(0, 5).map(item => ({
    ...item,
    short_title: item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-dark-700 p-3 rounded-lg border border-dark-600 max-w-xs">
          <p className="text-white font-semibold mb-2">{data.title}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-400">Compras: {data.purchases}</p>
            <p className="text-green-400">Receita: {formatCurrency(data.revenue)}</p>
            <p className="text-purple-400">Views: {data.views}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Top Conteúdos</h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            layout="horizontal"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              stroke="#9CA3AF"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="short_title"
              stroke="#9CA3AF"
              fontSize={11}
              width={120}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="purchases"
              fill="#3B82F6"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed list */}
      <div className="space-y-2">
        {data.slice(0, 5).map((item, index) => (
          <div key={item.content_id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
                {index + 1}
              </span>
              <div>
                <p className="text-white font-medium truncate max-w-xs">{item.title}</p>
                <p className="text-gray-400 text-sm">{item.purchases} compras</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-green-400 font-semibold">{formatCurrency(item.revenue)}</p>
              <p className="text-gray-400 text-sm">{item.views} views</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}