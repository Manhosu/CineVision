'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export interface VideoOverlayProps {
  title: string;
  subtitle?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  fullscreen: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreenToggle: () => void;
  onBackToCatalog: () => void;
  className?: string;
  showChromecast?: boolean;
  showAirPlay?: boolean;
  onChromecastClick?: () => void;
  onAirPlayClick?: () => void;
}

const VideoOverlay: React.FC<VideoOverlayProps> = ({
  title,
  subtitle,
  isPlaying,
  currentTime,
  duration,
  buffered,
  volume,
  muted,
  fullscreen,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onFullscreenToggle,
  onBackToCatalog,
  className = '',
  showChromecast = false,
  showAirPlay = false,
  onChromecastClick,
  onAirPlayClick,
}) => {
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);

  // Auto-hide controls after 3 seconds of inactivity
  useEffect(() => {
    const resetHideTimeout = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      
      setShowControls(true);
      
      if (isPlaying && !isDragging) {
        hideTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };

    resetHideTimeout();

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isPlaying, isDragging]);

  // Show controls on mouse movement or touch
  const handleMouseMove = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    setShowControls(true);

    if (isPlaying && !isDragging) {
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Handle touch events for mobile
  const handleTouchStart = () => {
    handleMouseMove(); // Reuse the same logic
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click/drag
  const handleProgressClick = (e: React.MouseEvent) => {
    if (!progressBarRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    onSeek(Math.max(0, Math.min(duration, newTime)));
  };

  // Handle volume slider
  const handleVolumeClick = (e: React.MouseEvent) => {
    if (!volumeSliderRef.current) return;
    
    const rect = volumeSliderRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const percentage = 1 - (clickY / rect.height);
    const newVolume = Math.max(0, Math.min(1, percentage));
    
    onVolumeChange(newVolume);
  };

  // Calculate progress percentages
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercentage = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      className={`absolute inset-0 z-40 ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
      onTouchStart={handleTouchStart}
    >
      {/* Top Overlay - Title and Back Button */}
      <div
        className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 via-black/60 to-transparent transition-all duration-500 ease-out ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        <div className="flex items-center justify-between p-4 sm:p-6">
          <button
            onClick={onBackToCatalog}
            className="flex items-center space-x-2 text-white hover:text-primary-400 transition-all duration-200 group cursor-pointer"
            aria-label="Back to catalog"
          >
            <svg
              className="w-6 h-6 sm:w-7 sm:h-7 transform group-hover:-translate-x-1 transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm sm:text-base font-medium hidden sm:inline">Back</span>
          </button>
          
          <div className="text-right max-w-xs sm:max-w-md">
            <h1 className="text-white text-lg sm:text-xl lg:text-2xl font-bold truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-300 text-xs sm:text-sm mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Center Play/Pause Button */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <button
          onClick={isPlaying ? onPause : onPlay}
          className={`w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary-600/90 to-primary-700/90 hover:from-primary-500 hover:to-primary-600 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl backdrop-blur-sm cursor-pointer pointer-events-auto ${
            showControls || !isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          } hover:scale-110 active:scale-95`}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white ml-1 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
      </div>

      {/* Bottom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-all duration-500 ease-out ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {/* Progress Bar */}
        <div className="px-4 sm:px-6 pb-2">
          <div
            ref={progressBarRef}
            className="relative h-1.5 sm:h-2 bg-white/20 rounded-full cursor-pointer group hover:h-2 sm:hover:h-2.5 transition-all duration-200"
            onClick={handleProgressClick}
          >
            {/* Buffered Progress */}
            <div
              className="absolute top-0 left-0 h-full bg-white/40 rounded-full transition-all"
              style={{ width: `${bufferedPercentage}%` }}
            />

            {/* Current Progress */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full shadow-lg transition-all"
              style={{ width: `${progressPercentage}%` }}
            />

            {/* Progress Handle */}
            <div
              className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 scale-0 group-hover:scale-100"
              style={{ left: `${progressPercentage}%`, marginLeft: '-8px' }}
            />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between px-4 sm:px-6 pb-4 sm:pb-6">
          {/* Left Controls */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Play/Pause */}
            <button
              onClick={isPlaying ? onPause : onPlay}
              className="text-white hover:text-primary-400 transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* Volume Control */}
            <div
              className="relative group"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={onMuteToggle}
                className="text-white hover:text-primary-400 transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted || volume === 0 ? (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : volume < 0.5 ? (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>

              {/* Volume Slider */}
              <div
                className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-black/90 backdrop-blur-sm rounded-lg p-3 transition-all duration-200 ${
                  showVolumeSlider ? 'opacity-100 visible' : 'opacity-0 invisible'
                }`}
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <div
                  ref={volumeSliderRef}
                  className="w-1.5 h-24 bg-white/30 rounded-full cursor-pointer relative hover:w-2 transition-all"
                  onClick={handleVolumeClick}
                >
                  <div
                    className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-primary-500 to-primary-600 rounded-full transition-all"
                    style={{ height: `${volume * 100}%` }}
                  />
                  <div
                    className="absolute w-3.5 h-3.5 bg-white shadow-lg rounded-full transform -translate-x-1/2 transition-all hover:scale-125"
                    style={{ bottom: `${volume * 100}%`, left: '50%', marginBottom: '-7px' }}
                  />
                </div>
                <div className="mt-2 text-center text-xs text-white font-mono">
                  {Math.round(volume * 100)}%
                </div>
              </div>
            </div>

            {/* Time Display */}
            <span className="text-white text-xs sm:text-sm font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Chromecast */}
            {showChromecast && (
              <button
                onClick={onChromecastClick}
                className="text-white hover:text-primary-400 transition-colors"
                aria-label="Cast to Chromecast"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                </svg>
              </button>
            )}

            {/* AirPlay */}
            {showAirPlay && (
              <button
                onClick={onAirPlayClick}
                className="text-white hover:text-primary-400 transition-colors"
                aria-label="Cast to AirPlay"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 22h12l-6-6-6 6zM21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V5h18v12h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                </svg>
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={onFullscreenToggle}
              className="text-white hover:text-primary-400 transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {fullscreen ? (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoOverlay;