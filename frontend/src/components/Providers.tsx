'use client';

import { UploadProvider } from '@/contexts/UploadContext';
import { SplashProvider } from '@/contexts/SplashContext';
import { AnalyticsTracker } from '@/components/Analytics/AnalyticsTracker';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UploadProvider>
      <SplashProvider>
        {children}
      </SplashProvider>
      <AnalyticsTracker />
    </UploadProvider>
  );
}
