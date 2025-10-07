'use client';

import React from 'react';
import { useAirPlay } from '@/hooks/useAirPlay';

export interface AirPlayButtonProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onConnectionStart?: () => void;
  onConnectionEnd?: () => void;
  disabled?: boolean;
}

const AirPlayButton: React.FC<AirPlayButtonProps> = ({
  className = '',
  size = 'medium',
  showLabel = false,
  onConnectionStart,
  onConnectionEnd,
  disabled = false,
}) => {
  const {
    isAvailable,
    isConnected,
    error,
    showDevicePicker,
    clearError,
  } = useAirPlay();

  // Don't render if AirPlay is not available (not Safari or no AirPlay support)
  if (!isAvailable) {
    return null;
  }

  React.useEffect(() => {
    if (isConnected) {
      onConnectionStart?.();
    } else {
      onConnectionEnd?.();
    }
  }, [isConnected, onConnectionStart, onConnectionEnd]);

  const handleClick = () => {
    if (disabled) return;

    clearError();
    showDevicePicker();
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
    inline-flex items-center justify-center
    rounded-full
    transition-all duration-200
    focus-outline
    ${sizeClasses[size]}
    ${isConnected
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'bg-dark-800/50 text-white hover:bg-dark-700/50'
    }
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    ${className}
  `.trim();

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={disabled}
        className={buttonClasses}
        title={isConnected ? 'Connected to AirPlay' : 'Connect to AirPlay'}
        aria-label={isConnected ? 'Connected to AirPlay device' : 'Connect to AirPlay device'}
      >
        <AirPlayIcon className={iconSizeClasses[size]} connected={isConnected} />
      </button>

      {showLabel && (
        <span className="ml-2 text-sm text-white">
          {isConnected ? 'AirPlay Connected' : 'AirPlay'}
        </span>
      )}

      {/* Connection indicator */}
      {isConnected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-dark-900">
          <div className="w-full h-full bg-green-400 rounded-full animate-pulse"></div>
        </div>
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

interface AirPlayIconProps {
  className?: string;
  connected?: boolean;
}

const AirPlayIcon: React.FC<AirPlayIconProps> = ({ className = '', connected = false }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      {/* AirPlay icon */}
      <path d="M6,22 L18,22 C19.1045695,22 20,21.1045695 20,20 L20,6 C20,4.8954305 19.1045695,4 18,4 L6,4 C4.8954305,4 4,4.8954305 4,6 L4,20 C4,21.1045695 4.8954305,22 6,22 Z M6,20 L6,6 L18,6 L18,20 L16.5,20 L7.5,20 L6,20 Z M7.5,15 L16.5,15 L12,18.5 L7.5,15 Z"/>

      {/* Connection waves animation for connected state */}
      {connected && (
        <g opacity="0.8">
          <path d="M12,8 C10.5,8 9.5,9 9.5,10.5" stroke="currentColor" strokeWidth="0.8" fill="none">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" begin="0s"/>
          </path>
          <path d="M12,8 C13.5,8 14.5,9 14.5,10.5" stroke="currentColor" strokeWidth="0.8" fill="none">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" begin="0.3s"/>
          </path>
          <path d="M12,6 C9.5,6 7.5,8 7.5,10.5" stroke="currentColor" strokeWidth="0.8" fill="none">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" begin="0.6s"/>
          </path>
          <path d="M12,6 C14.5,6 16.5,8 16.5,10.5" stroke="currentColor" strokeWidth="0.8" fill="none">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" begin="0.9s"/>
          </path>
        </g>
      )}
    </svg>
  );
};

export default AirPlayButton;