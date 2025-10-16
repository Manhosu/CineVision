'use client';

import { UploadProvider } from '@/contexts/UploadContext';
import UploadProgress from '@/components/UploadProgress';
import { AnalyticsTracker } from '@/components/Analytics/AnalyticsTracker';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UploadProvider>
      {children}
      <UploadProgress />
      <AnalyticsTracker />
    </UploadProvider>
  );
}
