'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import chart components
const RevenueChart = dynamic(() => import('@/components/charts/RevenueChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

const UserAnalyticsChart = dynamic(() => import('@/components/charts/UserAnalyticsChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

const RealTimeMetrics = dynamic(() => import('@/components/charts/RealTimeMetrics'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

interface LazyChartProps {
  type: 'revenue' | 'user-analytics' | 'real-time';
  data?: any;
  className?: string;
  height?: number;
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div 
      className="animate-pulse bg-gray-200 rounded-lg flex items-center justify-center"
      style={{ height }}
    >
      <div className="text-center text-gray-500">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-300 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <p className="text-sm">Carregando gráfico...</p>
      </div>
    </div>
  );
}

export default function LazyChart({ type, data, className = '', height = 300 }: LazyChartProps) {
  const [isInView, setIsInView] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          // Add a small delay to improve performance
          setTimeout(() => setShouldLoad(true), 100);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const renderChart = () => {
    if (!shouldLoad) {
      return <ChartSkeleton height={height} />;
    }

    switch (type) {
      case 'revenue':
        return <RevenueChart data={data} />;
      case 'user-analytics':
        return <UserAnalyticsChart data={data} />;
      case 'real-time':
        return <RealTimeMetrics />;
      default:
        return <ChartSkeleton height={height} />;
    }
  };

  return (
    <div 
      ref={chartRef}
      className={`w-full ${className}`}
      style={{ minHeight: height }}
    >
      <Suspense fallback={<ChartSkeleton height={height} />}>
        {renderChart()}
      </Suspense>
    </div>
  );
}

// Export individual lazy chart components
export const LazyRevenueChart = (props: Omit<LazyChartProps, 'type'>) => (
  <LazyChart {...props} type="revenue" />
);

export const LazyUserAnalyticsChart = (props: Omit<LazyChartProps, 'type'>) => (
  <LazyChart {...props} type="user-analytics" />
);

export const LazyRealTimeMetrics = (props: Omit<LazyChartProps, 'type'>) => (
  <LazyChart {...props} type="real-time" />
);