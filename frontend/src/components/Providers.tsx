'use client';

import { UploadProvider } from '@/contexts/UploadContext';
import { AnalyticsTracker } from '@/components/Analytics/AnalyticsTracker';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UploadProvider>
      {children}
      {/* Upload progress is handled by FloatingUploadProgress in admin layout */}
      <AnalyticsTracker />
    </UploadProvider>
  );
}
