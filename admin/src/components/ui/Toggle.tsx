'use client';

import { useState } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'danger';
  label?: string;
  description?: string;
  loading?: boolean;
}

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  color = 'primary',
  label,
  description,
  loading = false,
}: ToggleProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleToggle = async () => {
    if (disabled || loading) return;

    setIsTransitioning(true);
    try {
      onChange(!checked);
    } finally {
      setTimeout(() => setIsTransitioning(false), 200);
    }
  };

  const sizeClasses = {
    sm: {
      switch: 'h-4 w-7',
      thumb: 'h-3 w-3',
      translate: 'translate-x-3',
    },
    md: {
      switch: 'h-6 w-11',
      thumb: 'h-5 w-5',
      translate: 'translate-x-5',
    },
    lg: {
      switch: 'h-7 w-14',
      thumb: 'h-6 w-6',
      translate: 'translate-x-7',
    },
  };

  const colorClasses = {
    primary: 'bg-primary-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
  };

  const activeColor = colorClasses[color];
  const { switch: switchSize, thumb: thumbSize, translate } = sizeClasses[size];

  return (
    <div className="flex items-center space-x-3">
      <div className="relative">
        <button
          type="button"
          className={`${switchSize} relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 ${
            checked ? activeColor : 'bg-dark-600'
          } ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onClick={handleToggle}
          disabled={disabled || loading}
          role="switch"
          aria-checked={checked}
        >
          <span
            className={`${thumbSize} inline-block transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
              checked ? translate : 'translate-x-0'
            } ${isTransitioning ? 'scale-110' : ''}`}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </span>
        </button>

        {/* Ripple effect */}
        {isTransitioning && (
          <div className={`absolute inset-0 ${switchSize} rounded-full ${activeColor} opacity-30 animate-ping`} />
        )}
      </div>

      {(label || description) && (
        <div className="flex-1">
          {label && (
            <label className="text-sm font-medium text-gray-300 cursor-pointer" onClick={handleToggle}>
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}