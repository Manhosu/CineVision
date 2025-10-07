'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlayerState, QualityLevel } from '@/components/VideoPlayer/VideoPlayer';
import ChromecastButton from '@/components/ChromecastButton/ChromecastButton';
import AirPlayButton from '@/components/AirPlayButton/AirPlayButton';

export interface VideoControlsProps {
  playerState: PlayerState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreenToggle: () => void;
  onQualityChange: (qualityId: string) => void;
  onSubtitleToggle?: () => void;
  className?: string;
  showSubtitles?: boolean;
  subtitles?: Array<{ id: string; label: string; active: boolean }>;
  isTV?: boolean;
}

const VideoControls: React.FC<VideoControlsProps> = ({
  playerState,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onFullscreenToggle,
  onQualityChange,
  onSubtitleToggle,
  className = '',
  showSubtitles = false,
  subtitles = [],
  isTV = false,
}) => {
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mousePosition, setMousePosition] = useState(0);

  const controlsRef = useRef<HTMLDivElement>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout>();
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const progressRef = useRef<HTMLDivElement>(null);

  // Auto-hide controls
  useEffect(() => {
    const resetHideTimer = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      setShowControls(true);

      if (playerState.isPlaying && !isTV) {
        hideTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };

    resetHideTimer();

    const handleMouseMove = () => resetHideTimer();
    const handleMouseLeave = () => {
      if (playerState.isPlaying && !isTV) {
        setShowControls(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    controlsRef.current?.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      controlsRef.current?.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [playerState.isPlaying, isTV]);

  // Format time display
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar interactions
  const handleProgressClick = useCallback((event: React.MouseEvent) => {
    if (!progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const newTime = percent * playerState.duration;

    onSeek(Math.max(0, Math.min(newTime, playerState.duration)));
  }, [playerState.duration, onSeek]);

  const handleProgressMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDragging(true);
    handleProgressClick(event);
  }, [handleProgressClick]);

  const handleProgressMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setMousePosition(percent);
  }, [isDragging]);

  const handleProgressMouseUp = useCallback((event: MouseEvent) => {
    if (!isDragging || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const newTime = percent * playerState.duration;

    onSeek(Math.max(0, Math.min(newTime, playerState.duration)));
    setIsDragging(false);
  }, [isDragging, playerState.duration, onSeek]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleProgressMouseMove);
      document.addEventListener('mouseup', handleProgressMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleProgressMouseMove);
      document.removeEventListener('mouseup', handleProgressMouseUp);
    };
  }, [isDragging, handleProgressMouseMove, handleProgressMouseUp]);

  // Handle volume slider
  const handleVolumeMouseEnter = () => {
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    setShowVolumeSlider(true);
  };

  const handleVolumeMouseLeave = () => {
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 500);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showControls) setShowControls(true);

      switch (event.key.toLowerCase()) {
        case ' ':
        case 'k':
          event.preventDefault();
          playerState.isPlaying ? onPause() : onPlay();
          break;
        case 'f':
          event.preventDefault();
          onFullscreenToggle();
          break;
        case 'm':
          event.preventDefault();
          onMuteToggle();
          break;
        case 'arrowleft':
          event.preventDefault();
          onSeek(playerState.currentTime - 10);
          break;
        case 'arrowright':
          event.preventDefault();
          onSeek(playerState.currentTime + 10);
          break;
        case 'arrowup':
          event.preventDefault();
          onVolumeChange(Math.min(1, playerState.volume + 0.1));
          break;
        case 'arrowdown':
          event.preventDefault();
          onVolumeChange(Math.max(0, playerState.volume - 0.1));
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    showControls,
    playerState.isPlaying,
    playerState.currentTime,
    playerState.volume,
    onPlay,
    onPause,
    onSeek,
    onVolumeChange,
    onMuteToggle,
    onFullscreenToggle
  ]);

  const progressPercentage = playerState.duration ? (playerState.currentTime / playerState.duration) * 100 : 0;
  const bufferPercentage = playerState.duration ? (playerState.buffered / playerState.duration) * 100 : 0;

  return (
    <div
      ref={controlsRef}
      className={`player-controls ${showControls ? '' : 'hidden'} ${isTV ? 'tv-device' : ''} ${className}`}
    >
      {/* Top gradient overlay */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* Progress bar */}
      <div className="absolute bottom-16 left-6 right-6">
        <div
          ref={progressRef}
          className="progress-bar group"
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
        >
          {/* Buffer progress */}
          <div
            className="progress-buffer"
            style={{ width: `${bufferPercentage}%` }}
          />

          {/* Play progress */}
          <div
            className="progress-fill"
            style={{ width: `${isDragging ? mousePosition * 100 : progressPercentage}%` }}
          />

          {/* Scrub handle */}
          <div
            className={`absolute top-1/2 w-4 h-4 bg-primary-600 rounded-full transform -translate-y-1/2 transition-opacity ${
              isDragging || showControls ? 'opacity-100' : 'opacity-0'
            } group-hover:opacity-100`}
            style={{ left: `${isDragging ? mousePosition * 100 : progressPercentage}%`, marginLeft: '-8px' }}
          />
        </div>
      </div>

      {/* Control bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4">
        {/* Left controls */}
        <div className="flex items-center space-x-4">
          {/* Play/Pause */}
          <button
            onClick={playerState.isPlaying ? onPause : onPlay}
            className={`btn-icon ${isTV ? 'w-12 h-12' : 'w-10 h-10'} bg-transparent hover:bg-white/20`}
            aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
          >
            {playerState.isPlaying ? (
              <PauseIcon className={isTV ? 'w-6 h-6' : 'w-5 h-5'} />
            ) : (
              <PlayIcon className={isTV ? 'w-6 h-6' : 'w-5 h-5'} />
            )}
          </button>

          {/* Time display */}
          <div className={`text-white ${isTV ? 'text-lg' : 'text-sm'} font-mono`}>
            {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
          </div>

          {/* Volume controls */}
          <div
            className="relative flex items-center"
            onMouseEnter={handleVolumeMouseEnter}
            onMouseLeave={handleVolumeMouseLeave}
          >
            <button
              onClick={onMuteToggle}
              className={`btn-icon ${isTV ? 'w-10 h-10' : 'w-8 h-8'} bg-transparent hover:bg-white/20`}
              aria-label={playerState.muted ? 'Unmute' : 'Mute'}
            >
              {playerState.muted || playerState.volume === 0 ? (
                <VolumeOffIcon className={isTV ? 'w-5 h-5' : 'w-4 h-4'} />
              ) : playerState.volume < 0.5 ? (
                <VolumeDownIcon className={isTV ? 'w-5 h-5' : 'w-4 h-4'} />
              ) : (
                <VolumeUpIcon className={isTV ? 'w-5 h-5' : 'w-4 h-4'} />
              )}
            </button>

            {/* Volume slider */}
            {showVolumeSlider && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-dark-900/90 backdrop-blur-sm rounded p-2">
                <div className="w-6 h-20 relative">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={playerState.volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    className="absolute w-20 h-6 origin-bottom-left transform rotate-90 -translate-y-16 translate-x-2"
                    style={{
                      background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${playerState.volume * 100}%, rgba(255,255,255,0.3) ${playerState.volume * 100}%, rgba(255,255,255,0.3) 100%)`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center space-x-4">
          {/* Subtitles */}
          {showSubtitles && (
            <div className="relative">
              <button
                onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                className={`btn-icon ${isTV ? 'w-10 h-10' : 'w-8 h-8'} bg-transparent hover:bg-white/20`}
                aria-label="Subtitles"
              >
                <SubtitleIcon className={isTV ? 'w-5 h-5' : 'w-4 h-4'} />
              </button>

              {showSubtitleMenu && (
                <div className="quality-menu">
                  <div className="quality-item" onClick={() => {
                    onSubtitleToggle?.();
                    setShowSubtitleMenu(false);
                  }}>
                    Off
                  </div>
                  {subtitles.map((subtitle) => (
                    <div
                      key={subtitle.id}
                      className={`quality-item ${subtitle.active ? 'active' : ''}`}
                      onClick={() => {
                        // Handle subtitle selection
                        setShowSubtitleMenu(false);
                      }}
                    >
                      {subtitle.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quality selector */}
          <div className="relative">
            <button
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              className={`btn-icon ${isTV ? 'w-10 h-10' : 'w-8 h-8'} bg-transparent hover:bg-white/20`}
              aria-label="Quality"
            >
              <SettingsIcon className={isTV ? 'w-5 h-5' : 'w-4 h-4'} />
            </button>

            {showQualityMenu && (
              <div className="quality-menu">
                <div
                  className="quality-item"
                  onClick={() => {
                    onQualityChange('auto');
                    setShowQualityMenu(false);
                  }}
                >
                  Auto
                </div>
                {playerState.qualities.map((quality) => (
                  <div
                    key={quality.id}
                    className={`quality-item ${quality.active ? 'active' : ''}`}
                    onClick={() => {
                      onQualityChange(quality.id);
                      setShowQualityMenu(false);
                    }}
                  >
                    {quality.height}p
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cast buttons */}
          <ChromecastButton size={isTV ? 'large' : 'medium'} />
          <AirPlayButton size={isTV ? 'large' : 'medium'} />

          {/* Fullscreen */}
          <button
            onClick={onFullscreenToggle}
            className={`btn-icon ${isTV ? 'w-10 h-10' : 'w-8 h-8'} bg-transparent hover:bg-white/20`}
            aria-label={playerState.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {playerState.fullscreen ? (
              <ExitFullscreenIcon className={isTV ? 'w-5 h-5' : 'w-4 h-4'} />
            ) : (
              <FullscreenIcon className={isTV ? 'w-5 h-5' : 'w-4 h-4'} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Icon components
const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
  </svg>
);

const PauseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const VolumeUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.783L4.476 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.476l3.907-3.783a1 1 0 011.617-.141zM14.657 2.343a1 1 0 011.414 0A9.972 9.972 0 0118 10a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0016 10c0-1.61-.476-3.11-1.293-4.364a1 1 0 010-1.293z" clipRule="evenodd" />
    <path d="M11.293 7.293a1 1 0 011.414 0A3.972 3.972 0 0114 10a3.972 3.972 0 01-1.293 2.707 1 1 0 01-1.414-1.414A1.972 1.972 0 0012 10c0-.537-.176-1.032-.464-1.414a1 1 0 010-1.293z" />
  </svg>
);

const VolumeDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.783L4.476 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.476l3.907-3.783a1 1 0 011.617-.141zM12.293 7.293a1 1 0 011.414 0A3.972 3.972 0 0115 10a3.972 3.972 0 01-1.293 2.707 1 1 0 01-1.414-1.414A1.972 1.972 0 0013 10c0-.537-.176-1.032-.464-1.414a1 1 0 010-1.293z" clipRule="evenodd" />
  </svg>
);

const VolumeOffIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.783L4.476 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.476l3.907-3.783a1 1 0 011.617-.141z" clipRule="evenodd" />
    <path d="M12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" />
  </svg>
);

const FullscreenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zM16 4a1 1 0 00-1-1h-4a1 1 0 100 2h1.586l-2.293 2.293a1 1 0 001.414 1.414L14 6.414V8a1 1 0 102 0V4zM3 16a1 1 0 001 1h4a1 1 0 000-2H6.414l2.293-2.293a1 1 0 00-1.414-1.414L5 13.586V12a1 1 0 00-2 0v4zM16 16a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L14 13.586V12a1 1 0 012 0v4z" />
  </svg>
);

const ExitFullscreenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M4 8V6a1 1 0 011-1h4a1 1 0 010 2H7.414l1.293 1.293a1 1 0 11-1.414 1.414L6 8.414V10a1 1 0 01-2 0V8zM12 8V6a1 1 0 00-1-1H7a1 1 0 100 2h2.586L8.293 8.293a1 1 0 101.414 1.414L11 8.414V10a1 1 0 102 0V8zM4 12v2a1 1 0 001 1h4a1 1 0 000-2H7.414l1.293-1.293a1 1 0 00-1.414-1.414L6 11.586V10a1 1 0 00-2 0v2zM16 12v2a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-1.293-1.293a1 1 0 111.414-1.414L14 11.586V10a1 1 0 012 0v2z" />
  </svg>
);

const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const SubtitleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h10v8a1 1 0 01-1 1H6a1 1 0 01-1-1V7a2 2 0 012-2zm0 6a1 1 0 011-1h6a1 1 0 110 2H8a1 1 0 01-1-1zm1 3a1 1 0 100 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
  </svg>
);

export default VideoControls;