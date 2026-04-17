'use client';

import { useState, useCallback, useEffect } from 'react';
import { UploadProvider } from '@/contexts/UploadContext';
import { AnalyticsTracker } from '@/components/Analytics/AnalyticsTracker';
import { SplashScreen } from '@/components/SplashScreen/SplashScreen';

export function Providers({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Show splash only on first visit (per session)
    if (typeof window !== 'undefined' && !sessionStorage.getItem('splash_shown')) {
      setShowSplash(true);
    }
  }, []);

  const handleSplashFinished = useCallback(() => {
    setShowSplash(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('splash_shown', '1');
    }
  }, []);

  return (
    <UploadProvider>
      {showSplash && <SplashScreen onFinished={handleSplashFinished} />}
      {children}
      {/* Upload progress is handled by FloatingUploadProgress in admin layout */}
      <AnalyticsTracker />
    </UploadProvider>
  );
}
