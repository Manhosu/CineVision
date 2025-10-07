'use client';

import React from 'react';
import { useChromecast } from '@/hooks/useChromecast';

export interface ChromecastButtonProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onCastStart?: () => void;
  onCastEnd?: () => void;
  disabled?: boolean;
}

const ChromecastButton: React.FC<ChromecastButtonProps> = ({
  className = '',
  size = 'medium',
  showLabel = false,
  onCastStart,
  onCastEnd,
  disabled = false,
}) => {
  const {
    isAvailable,
    isConnected,
    hasReceivers,
    isLoading,
    error,
    requestSession,
    endSession,
    clearError,
  } = useChromecast();

  // Don't render if Chromecast is not available
  if (!isAvailable || !hasReceivers) {
    return null;
  }

  const handleClick = async () => {
    if (disabled) return;

    clearError();

    try {
      if (isConnected) {
        await endSession();
        onCastEnd?.();
      } else {
        await requestSession();
        onCastStart?.();
      }
    } catch (error) {
      console.error('Chromecast action failed:', error);
    }
  };

  const sizeClasses = {
    small: 'w-6 h-6 p-1',
    medium: 'w-8 h-8 p-1.5',
    large: 'w-10 h-10 p-2',
  };

  const iconSizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6',
  };

  const buttonClasses = `
    cast-button
    ${sizeClasses[size]}
    ${isConnected ? 'connected' : ''}
    ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    ${className}
  `.trim();

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={buttonClasses}
        title={isConnected ? 'Disconnect from Chromecast' : 'Cast to Chromecast'}
        aria-label={isConnected ? 'Disconnect from Chromecast' : 'Cast to Chromecast'}
      >
        {isLoading ? (
          <div className={`animate-spin ${iconSizeClasses[size]}`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="31.416" strokeDashoffset="31.416">
                <animate attributeName="strokeDasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                <animate attributeName="strokeDashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>
        ) : (
          <CastIcon className={iconSizeClasses[size]} connected={isConnected} />
        )}
      </button>

      {showLabel && (
        <span className="ml-2 text-sm text-white">
          {isConnected ? 'Connected' : 'Cast'}
        </span>
      )}

      {/* Error tooltip */}
      {error && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-red-600 text-white text-xs rounded whitespace-nowrap z-50">
          {error}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-red-600"></div>
        </div>
      )}
    </div>
  );
};

interface CastIconProps {
  className?: string;
  connected?: boolean;
}

const CastIcon: React.FC<CastIconProps> = ({ className = '', connected = false }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{
        color: connected ? '#1976d2' : 'currentColor', // Blue when connected
      }}
    >
      {/* Chromecast icon */}
      <path d="M1,18 L1,21 L4,21 C4,19.34 2.66,18 1,18 Z M1,14 L1,16 C3.76,16 6,18.24 6,21 L8,21 C8,17.13 4.87,14 1,14 Z M1,10 L1,12 C5.97,12 10,16.03 10,21 L12,21 C12,14.92 7.08,10 1,10 Z M21,3 L3,3 C1.9,3 1,3.9 1,5 L1,8 L3,8 L3,5 L21,5 L21,19 L14,19 L14,21 L21,21 C22.1,21 23,20.1 23,19 L23,5 C23,3.9 22.1,3 21,3 Z"/>

      {/* Connection indicator */}
      {connected && (
        <>
          <circle cx="18" cy="6" r="2" fill="#4CAF50" opacity="0.8">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="18" cy="6" r="1" fill="#ffffff"/>
        </>
      )}
    </svg>
  );
};

export default ChromecastButton;