'use client';

import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * Componente para rastrear analytics automaticamente
 * Deve ser incluído no layout raiz
 */
export function AnalyticsTracker() {
  // O hook já faz todo o rastreamento automaticamente
  useAnalytics();

  // Componente invisível - apenas ativa o tracking
  return null;
}
