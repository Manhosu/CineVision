'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  PlayIcon,
  PauseIcon,
  BackwardIcon,
  ForwardIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/solid';

interface TouchOptimizedControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  fullscreen: boolean;
  qualities: Array<{id: string; height: number; active: boolean}>;
  activeQuality: string | null;
  isLoading: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreenToggle: () => void;
  onQualityChange: (qualityId: string) => void;
  onBackward: () => void;
  onForward: () => void;
  className?: string;
}

export default function TouchOptimizedControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  fullscreen,
  qualities,
  activeQuality,
  isLoading,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onFullscreenToggle,
  onQualityChange,
  onBackward,
  onForward,
  className = '',
}: TouchOptimizedControlsProps) {
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [tempTime, setTempTime] = useState(currentTime);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);

  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Auto-hide controls
  useEffect(() => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }

    if (showControls && isPlaying && !isDragging && !showQualityMenu && !showVolumeSlider) {
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000); // Hide after 3 seconds
      setHideTimeout(timeout);
    }

    return () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    };
  }, [showControls, isPlaying, isDragging, showQualityMenu, showVolumeSlider]);

  // Show controls on interaction
  const handleShowControls = () => {
    setShowControls(true);
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
  };

  // Format time
  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle touch/mouse events for progress bar
  const handleProgressMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleProgressInteraction(e.nativeEvent);
  };

  const handleProgressTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleProgressInteraction(e.nativeEvent.touches[0]);
  };

  const handleProgressInteraction = (event: MouseEvent | Touch) => {
    if (!progressRef.current || duration === 0) return;

    const rect = progressRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;

    setTempTime(newTime);
  };

  // Global mouse/touch move and end handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleProgressInteraction(e);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleProgressInteraction(e.touches[0]);
    };

    const handleEnd = () => {
      setIsDragging(false);
      onSeek(tempTime);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, tempTime, duration, onSeek]);

  // Volume control
  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleVolumeInteraction(e.nativeEvent);
  };

  const handleVolumeTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleVolumeInteraction(e.nativeEvent.touches[0]);
  };

  const handleVolumeInteraction = (event: MouseEvent | Touch) => {
    if (!volumeRef.current) return;

    const rect = volumeRef.current.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const percentage = Math.max(0, Math.min(1, 1 - (y / rect.height)));

    onVolumeChange(percentage);
  };

  const displayTime = isDragging ? tempTime : currentTime;
  const progressPercentage = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <div
      className={`absolute inset-0 flex items-end transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      onMouseMove={handleShowControls}
      onTouchStart={handleShowControls}
      onClick={handleShowControls}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

      {/* Controls container */}
      <div className="relative w-full p-4 sm:p-6 space-y-4">
        {/* Progress bar */}
        <div className="w-full">
          <div
            ref={progressRef}
            className="relative h-2 sm:h-3 bg-white/20 rounded-full cursor-pointer touch-manipulation"
            onMouseDown={handleProgressMouseDown}
            onTouchStart={handleProgressTouchStart}
          >
            {/* Buffered progress (if available) */}
            <div className="absolute inset-0 bg-white/30 rounded-full" style={{ width: '0%' }} />

            {/* Current progress */}
            <div
              className="absolute inset-y-0 left-0 bg-red-600 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />

            {/* Scrubber handle */}
            <div
              className={`absolute top-1/2 w-4 h-4 sm:w-5 sm:h-5 bg-red-600 rounded-full transform -translate-y-1/2 transition-all ${
                isDragging ? 'scale-125' : 'scale-100'
              }`}
              style={{ left: `${progressPercentage}%`, marginLeft: '-8px' }}
            />
          </div>

          {/* Time display */}
          <div className="flex justify-between mt-2 text-sm text-white/80">
            <span>{formatTime(displayTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main controls */}
        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Play/Pause */}
            <button
              onClick={isPlaying ? onPause : onPlay}
              disabled={isLoading}
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isPlaying ? (
                <PauseIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              ) : (
                <PlayIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white ml-1" />
              )}
            </button>

            {/* Skip backward */}
            <button
              onClick={onBackward}
              className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Skip backward 10 seconds"
            >
              <BackwardIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>

            {/* Skip forward */}
            <button
              onClick={onForward}
              className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Skip forward 10 seconds"
            >
              <ForwardIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>
          </div>

          {/* Right controls */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Volume control */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                onMouseEnter={() => setShowVolumeSlider(true)}
                className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted || volume === 0 ? (
                  <SpeakerXMarkIcon className="w-5 h-5 text-white" />
                ) : (
                  <SpeakerWaveIcon className="w-5 h-5 text-white" />
                )}
              </button>

              {/* Volume slider */}
              {showVolumeSlider && (
                <div
                  className="absolute bottom-12 left-1/2 transform -translate-x-1/2 p-2 bg-black/80 backdrop-blur-sm rounded-lg"
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <div
                    ref={volumeRef}
                    className="w-6 h-20 bg-white/20 rounded-full cursor-pointer relative"
                    onMouseDown={handleVolumeMouseDown}
                    onTouchStart={handleVolumeTouchStart}
                  >
                    <div
                      className="absolute bottom-0 inset-x-0 bg-red-600 rounded-full"
                      style={{ height: `${(muted ? 0 : volume) * 100}%` }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-red-600 rounded-full transform -translate-x-1/2"
                      style={{
                        left: '50%',
                        bottom: `${(muted ? 0 : volume) * 100}%`,
                        marginBottom: '-8px'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mobile mute button */}
            <button
              onClick={onMuteToggle}
              className="flex sm:hidden items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? (
                <SpeakerXMarkIcon className="w-5 h-5 text-white" />
              ) : (
                <SpeakerWaveIcon className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Quality selector */}
            <div className="relative">
              <button
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="Quality settings"
              >
                <Cog6ToothIcon className="w-5 h-5 text-white" />
              </button>

              {/* Quality menu */}
              {showQualityMenu && (
                <div className="absolute bottom-12 right-0 p-2 bg-black/90 backdrop-blur-sm rounded-lg min-w-24">
                  <div className="space-y-1">
                    <div className="px-3 py-1 text-xs text-white/60 font-medium">Quality</div>
                    {qualities.map((quality) => (
                      <button
                        key={quality.id}
                        onClick={() => {
                          onQualityChange(quality.id);
                          setShowQualityMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                          quality.active
                            ? 'bg-red-600 text-white'
                            : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        {quality.height}p
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={onFullscreenToggle}
              className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {fullscreen ? (
                <ArrowsPointingInIcon className="w-5 h-5 text-white" />
              ) : (
                <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}