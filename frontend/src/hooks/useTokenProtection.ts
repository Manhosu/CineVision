'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  tokenProtectionService,
  StreamingToken,
  TokenValidationResult,
  StreamingPermission,
  DRMInfo
} from '@/services/tokenProtectionService';

export interface UseTokenProtectionReturn {
  // Token state
  hasValidToken: boolean;
  isTokenExpiring: boolean;
  tokenError: string | null;

  // Session info
  sessionInfo: {
    startTime: number | null;
    watchTime: number;
    remainingTime: number | null;
  };

  // Actions
  setToken: (token: StreamingToken) => void;
  validateAccess: (action: StreamingPermission['action']) => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
  startSession: () => void;
  endSession: () => void;

  // Permissions
  canView: boolean;
  canDownload: boolean;
  canCast: boolean;
  canScreenshot: boolean;
  canFullscreen: boolean;

  // Restrictions
  qualityRestrictions: string[] | null;
  bitrateLimit: number | null;

  // Utilities
  getAuthHeaders: () => Record<string, string>;
  getDRMInfo: () => Promise<DRMInfo | null>;
  getProtectionStatus: () => any;
}

export interface UseTokenProtectionOptions {
  contentId: string;
  autoRefresh?: boolean;
  onTokenExpired?: () => void;
  onAccessDenied?: (action: string, error: string) => void;
  onSessionTimeout?: () => void;
  warningTimeBeforeExpiry?: number; // seconds
}

export const useTokenProtection = (options: UseTokenProtectionOptions): UseTokenProtectionReturn => {
  const {
    contentId,
    autoRefresh = true,
    onTokenExpired,
    onAccessDenied,
    onSessionTimeout,
    warningTimeBeforeExpiry = 300, // 5 minutes
  } = options;

  const [hasValidToken, setHasValidToken] = useState(false);
  const [isTokenExpiring, setIsTokenExpiring] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<StreamingPermission[]>([]);
  const [sessionInfo, setSessionInfo] = useState<{
    startTime: number | null;
    watchTime: number;
    remainingTime: number | null;
  }>({ startTime: null, watchTime: 0, remainingTime: null });

  const validationIntervalRef = useRef<NodeJS.Timeout>();
  const sessionUpdateIntervalRef = useRef<NodeJS.Timeout>();
  const expiryWarningShownRef = useRef(false);

  // Check token validity and permissions
  const checkTokenValidity = useCallback(async () => {
    try {
      const validation = await tokenProtectionService.validateToken(contentId, 'view');

      setHasValidToken(validation.valid);
      setTokenError(validation.valid ? null : validation.error || 'Token validation failed');

      if (validation.valid && validation.token) {
        setPermissions(validation.token.permissions);

        // Check if token is expiring soon
        const timeUntilExpiry = validation.token.expiresAt - Date.now();
        const isExpiringSoon = timeUntilExpiry <= warningTimeBeforeExpiry * 1000;

        setIsTokenExpiring(isExpiringSoon);

        // Show expiry warning once
        if (isExpiringSoon && !expiryWarningShownRef.current) {
          expiryWarningShownRef.current = true;
          console.warn(`Token expiring in ${Math.floor(timeUntilExpiry / 1000)} seconds`);
        }

        // Reset warning flag if token was refreshed
        if (!isExpiringSoon && expiryWarningShownRef.current) {
          expiryWarningShownRef.current = false;
        }
      }

      // Handle expired tokens
      if (!validation.valid && validation.needsRefresh && autoRefresh) {
        const refreshed = await tokenProtectionService.refreshToken(contentId);
        if (!refreshed) {
          onTokenExpired?.();
        }
      } else if (!validation.valid && validation.error) {
        onAccessDenied?.('view', validation.error);
      }

    } catch (error) {
      console.error('Token validation error:', error);
      setHasValidToken(false);
      setTokenError('Token validation failed');
    }
  }, [contentId, autoRefresh, warningTimeBeforeExpiry, onTokenExpired, onAccessDenied]);

  // Update session information
  const updateSessionInfo = useCallback(() => {
    const info = tokenProtectionService.getStreamingSession(contentId);
    setSessionInfo(info);

    // Check for session timeout
    if (info.remainingTime !== null && info.remainingTime <= 0) {
      onSessionTimeout?.();
    }
  }, [contentId, onSessionTimeout]);

  // Set up intervals for validation and session updates
  useEffect(() => {
    // Initial check
    checkTokenValidity();
    updateSessionInfo();

    // Set up validation interval (every 30 seconds)
    validationIntervalRef.current = setInterval(checkTokenValidity, 30000);

    // Set up session update interval (every second during playback)
    sessionUpdateIntervalRef.current = setInterval(updateSessionInfo, 1000);

    return () => {
      if (validationIntervalRef.current) {
        clearInterval(validationIntervalRef.current);
      }
      if (sessionUpdateIntervalRef.current) {
        clearInterval(sessionUpdateIntervalRef.current);
      }
    };
  }, [checkTokenValidity, updateSessionInfo]);

  // Action handlers
  const setToken = useCallback((token: StreamingToken) => {
    tokenProtectionService.setAccessToken(contentId, token);
    setTokenError(null);
    expiryWarningShownRef.current = false;

    // Immediate validation
    checkTokenValidity();
  }, [contentId, checkTokenValidity]);

  const validateAccess = useCallback(async (action: StreamingPermission['action']): Promise<boolean> => {
    try {
      const validation = await tokenProtectionService.validateToken(contentId, action);

      if (!validation.valid && validation.error) {
        onAccessDenied?.(action, validation.error);
      }

      return validation.valid;
    } catch (error) {
      console.error('Access validation error:', error);
      onAccessDenied?.(action, 'Validation failed');
      return false;
    }
  }, [contentId, onAccessDenied]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const success = await tokenProtectionService.refreshToken(contentId);
      if (success) {
        setTokenError(null);
        expiryWarningShownRef.current = false;
        await checkTokenValidity();
      }
      return success;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }, [contentId, checkTokenValidity]);

  const startSession = useCallback(() => {
    tokenProtectionService.startStreamingSession(contentId);
    updateSessionInfo();
  }, [contentId, updateSessionInfo]);

  const endSession = useCallback(() => {
    tokenProtectionService.removeAccessToken(contentId);
    setHasValidToken(false);
    setPermissions([]);
    setSessionInfo({ startTime: null, watchTime: 0, remainingTime: null });
  }, [contentId]);

  // Permission helpers
  const getPermission = useCallback((action: StreamingPermission['action']): boolean => {
    const permission = permissions.find(p => p.action === action);
    return permission?.allowed || false;
  }, [permissions]);

  const canView = getPermission('view');
  const canDownload = getPermission('download');
  const canCast = getPermission('cast');
  const canScreenshot = getPermission('screenshot');
  const canFullscreen = getPermission('fullscreen');

  // Restriction getters
  const qualityRestrictions = tokenProtectionService.getQualityRestrictions(contentId);
  const bitrateLimit = tokenProtectionService.getBitrateLimit(contentId);

  // Utility functions
  const getAuthHeaders = useCallback(() => {
    return tokenProtectionService.getAuthHeaders(contentId);
  }, [contentId]);

  const getDRMInfo = useCallback(async (): Promise<DRMInfo | null> => {
    return tokenProtectionService.getDRMInfo(contentId);
  }, [contentId]);

  const getProtectionStatus = useCallback(() => {
    return tokenProtectionService.getProtectionStatus(contentId);
  }, [contentId]);

  return {
    // Token state
    hasValidToken,
    isTokenExpiring,
    tokenError,

    // Session info
    sessionInfo,

    // Actions
    setToken,
    validateAccess,
    refreshToken,
    startSession,
    endSession,

    // Permissions
    canView,
    canDownload,
    canCast,
    canScreenshot,
    canFullscreen,

    // Restrictions
    qualityRestrictions,
    bitrateLimit,

    // Utilities
    getAuthHeaders,
    getDRMInfo,
    getProtectionStatus,
  };
};