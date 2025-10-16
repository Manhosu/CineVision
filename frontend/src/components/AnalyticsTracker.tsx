'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initializeAnalytics, trackSession, trackActivity } from '@/utils/analytics';

/**
 * Client-side analytics tracker component
 * Automatically tracks page views and user sessions
 */
export function AnalyticsTracker() {
  const pathname = usePathname();

  // Initialize analytics on mount
  useEffect(() => {
    initializeAnalytics();
  }, []);

  // Track page changes
  useEffect(() => {
    if (pathname) {
      trackSession({
        current_page: pathname,
        is_watching: false,
      });

      trackActivity({
        event_type: 'page_view',
      });
    }
  }, [pathname]);

  // No UI - this is just a tracker
  return null;
}
