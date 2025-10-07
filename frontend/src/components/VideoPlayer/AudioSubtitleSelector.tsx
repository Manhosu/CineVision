'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface AudioTrack {
  id: string;
  language: string;
  label: string;
  active: boolean;
}

export interface TextTrack {
  id: string;
  language: string;
  label: string;
  active: boolean;
}

interface AudioSubtitleSelectorProps {
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
  onAudioChange: (trackId: string) => void;
  onSubtitleChange: (trackId: string | null) => void;
  className?: string;
}

export const AudioSubtitleSelector: React.FC<AudioSubtitleSelectorProps> = ({
  audioTracks,
  textTracks,
  onAudioChange,
  onSubtitleChange,
  className = '',
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'audio' | 'subtitle'>('audio');
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const activeAudioTrack = audioTracks.find(track => track.active);
  const activeTextTrack = textTracks.find(track => track.active);

  const getLanguageLabel = (lang: string): string => {
    const languageMap: Record<string, string> = {
      'pt': 'Português',
      'pt-BR': 'Português (BR)',
      'en': 'Inglês',
      'es': 'Espanhol',
      'fr': 'Francês',
      'de': 'Alemão',
      'it': 'Italiano',
      'ja': 'Japonês',
      'ko': 'Coreano',
      'zh': 'Chinês',
    };

    return languageMap[lang] || lang.toUpperCase();
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      {/* Botão para abrir menu */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 rounded-lg hover:bg-white/20 transition-colors"
        title="Áudio e Legendas"
        aria-label="Configurações de áudio e legendas"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
      </button>

      {/* Menu */}
      {showMenu && (
        <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-lg shadow-xl border border-gray-700 overflow-hidden min-w-[280px] z-50">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('audio')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'audio'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Áudio
            </button>
            <button
              onClick={() => setActiveTab('subtitle')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'subtitle'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Legendas
            </button>
          </div>

          {/* Conteúdo */}
          <div className="max-h-64 overflow-y-auto">
            {activeTab === 'audio' && (
              <div className="py-2">
                {audioTracks.length > 0 ? (
                  audioTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        onAudioChange(track.id);
                        setShowMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
                        track.active
                          ? 'bg-red-600/20 text-red-500'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span>{track.label || getLanguageLabel(track.language)}</span>
                      {track.active && (
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    Nenhuma faixa de áudio disponível
                  </div>
                )}
              </div>
            )}

            {activeTab === 'subtitle' && (
              <div className="py-2">
                {/* Opção para desativar legendas */}
                <button
                  onClick={() => {
                    onSubtitleChange(null);
                    setShowMenu(false);
                  }}
                  className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
                    !activeTextTrack
                      ? 'bg-red-600/20 text-red-500'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>Desativado</span>
                  {!activeTextTrack && (
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>

                {textTracks.length > 0 ? (
                  textTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        onSubtitleChange(track.id);
                        setShowMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
                        track.active
                          ? 'bg-red-600/20 text-red-500'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span>{track.label || getLanguageLabel(track.language)}</span>
                      {track.active && (
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    Nenhuma legenda disponível
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioSubtitleSelector;
