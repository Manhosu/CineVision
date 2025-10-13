'use client';

import { UploadProvider } from '@/contexts/UploadContext';
import UploadProgress from '@/components/UploadProgress';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UploadProvider>
      {children}
      <UploadProgress />
    </UploadProvider>
  );
}
