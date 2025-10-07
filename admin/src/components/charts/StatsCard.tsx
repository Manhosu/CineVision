'use client';

import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  icon: ReactNode;
  loading?: boolean;
  description?: string;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'purple';
}

export default function StatsCard({
  title,
  value,
  change,
  icon,
  loading,
  description,
  color = 'primary'
}: StatsCardProps) {
  if (loading) {
    return (
      <div className="relative overflow-hidden bg-dark-800/50 border border-dark-700 rounded-xl p-6 backdrop-blur-sm">
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <div className="h-4 bg-dark-600 rounded-md w-24"></div>
              <div className="h-8 bg-dark-600 rounded-md w-20"></div>
            </div>
            <div className="w-14 h-14 bg-dark-600 rounded-xl"></div>
          </div>
          {change && (
            <div className="mt-4 h-5 bg-dark-600 rounded-md w-28"></div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-dark-600/20 to-transparent animate-shimmer"></div>
      </div>
    );
  }

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      if (title.toLowerCase().includes('receita') || title.toLowerCase().includes('revenue')) {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      }

      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
    }

    return val.toString();
  };

  const getColorClasses = (colorType: string) => {
    const colors = {
      primary: 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-primary-500/25',
      success: 'bg-gradient-to-br from-green-500 to-green-600 shadow-green-500/25',
      warning: 'bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-yellow-500/25',
      info: 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/25',
      purple: 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-purple-500/25',
    };
    return colors[colorType as keyof typeof colors] || colors.primary;
  };

  return (
    <div className="group relative overflow-hidden bg-dark-800/50 border border-dark-700 rounded-xl p-6 backdrop-blur-sm hover:bg-dark-800/70 hover:border-dark-600 transition-all duration-300 hover:shadow-lg hover:shadow-black/25">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-white tracking-tight">
            {formatValue(value)}
          </p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl shadow-lg ${getColorClasses(color)} transform group-hover:scale-110 transition-transform duration-200`}>
          <div className="w-6 h-6 text-white">
            {icon}
          </div>
        </div>
      </div>

      {change && (
        <div className="mt-4 flex items-center space-x-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
              change.type === 'increase'
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}
          >
            {change.type === 'increase' ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {Math.abs(change.value)}%
          </span>
          <span className="text-xs text-gray-500">
            vs. período anterior
          </span>
        </div>
      )}

      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    </div>
  );
}