'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { airplayService } from '@/services/airplayService';
import { CastDevice } from '@/types/video';

export interface UseAirPlayReturn {
  // State
  isAvailable: boolean;
  isConnected: boolean;
  currentDevice: CastDevice | null;
  error: string | null;

  // Actions
  setupVideoElement: (element: HTMLVideoElement) => void;
  showDevicePicker: () => void;
  enablePictureInPicture: () => Promise<void>;
  disablePictureInPicture: () => Promise<void>;
  clearError: () => void;

  // Utilities
  createAirPlayButton: (container: HTMLElement) => HTMLButtonElement;
  getDebugInfo: () => any;
}

export const useAirPlay = (): UseAirPlayReturn => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<CastDevice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Initialize AirPlay service and set up event listeners
  useEffect(() => {
    const updateAvailability = () => {
      setIsAvailable(airplayService.checkAvailability());
    };

    const updateConnection = () => {
      const connected = airplayService.isCurrentlyConnected();
      const device = airplayService.getCurrentDevice();

      setIsConnected(connected);
      setCurrentDevice(device);
    };

    // Event listeners
    const handleInitialized = () => {
      updateAvailability();
      updateConnection();
    };

    const handleAvailabilityChanged = (data: { available: boolean }) => {
      console.log('AirPlay availability changed:', data.available);
    };

    const handleConnectionStart = (data: { device: CastDevice }) => {
      setCurrentDevice(data.device);
      setIsConnected(true);
      setError(null);
      console.log('AirPlay connection started:', data.device.name);
    };

    const handleConnectionEnd = () => {
      setCurrentDevice(null);
      setIsConnected(false);
      console.log('AirPlay connection ended');
    };

    const handleVideoElementSetup = (data: { element: HTMLVideoElement }) => {
      console.log('AirPlay setup completed for video element');
    };

    const handleDevicePickerShown = () => {
      console.log('AirPlay device picker shown');
    };

    const handlePipEntered = () => {
      console.log('Picture-in-Picture entered');
    };

    const handlePipExited = () => {
      console.log('Picture-in-Picture exited');
    };

    const handleError = (data: { code: string; message: string }) => {
      setError(`${data.code}: ${data.message}`);
      console.error('AirPlay error:', data);
    };

    // Set up event listeners
    airplayService.on('initialized', handleInitialized);
    airplayService.on('availabilityChanged', handleAvailabilityChanged);
    airplayService.on('connectionStart', handleConnectionStart);
    airplayService.on('connectionEnd', handleConnectionEnd);
    airplayService.on('videoElementSetup', handleVideoElementSetup);
    airplayService.on('devicePickerShown', handleDevicePickerShown);
    airplayService.on('pipEntered', handlePipEntered);
    airplayService.on('pipExited', handlePipExited);
    airplayService.on('error', handleError);

    // Initial state update
    updateAvailability();
    updateConnection();

    return () => {
      // Cleanup event listeners
      airplayService.off('initialized', handleInitialized);
      airplayService.off('availabilityChanged', handleAvailabilityChanged);
      airplayService.off('connectionStart', handleConnectionStart);
      airplayService.off('connectionEnd', handleConnectionEnd);
      airplayService.off('videoElementSetup', handleVideoElementSetup);
      airplayService.off('devicePickerShown', handleDevicePickerShown);
      airplayService.off('pipEntered', handlePipEntered);
      airplayService.off('pipExited', handlePipExited);
      airplayService.off('error', handleError);
    };
  }, []);

  // Action handlers
  const setupVideoElement = useCallback((element: HTMLVideoElement): void => {
    if (!element) return;

    videoElementRef.current = element;
    airplayService.setupVideoElement(element);
  }, []);

  const showDevicePicker = useCallback((): void => {
    try {
      setError(null);
      airplayService.showDevicePicker();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to show AirPlay picker';
      setError(errorMessage);
    }
  }, []);

  const enablePictureInPicture = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await airplayService.enablePictureInPicture();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable Picture-in-Picture';
      setError(errorMessage);
    }
  }, []);

  const disablePictureInPicture = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await airplayService.disablePictureInPicture();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable Picture-in-Picture';
      setError(errorMessage);
    }
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const createAirPlayButton = useCallback((container: HTMLElement): HTMLButtonElement => {
    return airplayService.createAirPlayButton(container);
  }, []);

  const getDebugInfo = useCallback(() => {
    return airplayService.getDebugInfo();
  }, []);

  return {
    // State
    isAvailable,
    isConnected,
    currentDevice,
    error,

    // Actions
    setupVideoElement,
    showDevicePicker,
    enablePictureInPicture,
    disablePictureInPicture,
    clearError,

    // Utilities
    createAirPlayButton,
    getDebugInfo,
  };
};