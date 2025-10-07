'use client';

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'info';
  showPercentage?: boolean;
  label?: string;
  animate?: boolean;
}

export default function ProgressBar({
  value,
  max = 100,
  className = '',
  size = 'md',
  color = 'primary',
  showPercentage = false,
  label,
  animate = true,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colorClasses = {
    primary: 'bg-primary-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-300">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm text-gray-400">{percentage.toFixed(0)}%</span>
          )}
        </div>
      )}

      <div className={`bg-dark-700 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full transition-all duration-500 ease-out ${
            animate ? 'transform-gpu' : ''
          }`}
          style={{
            width: `${percentage}%`,
            transition: animate ? 'width 0.5s ease-out' : undefined,
          }}
        >
          {animate && (
            <div className="w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}