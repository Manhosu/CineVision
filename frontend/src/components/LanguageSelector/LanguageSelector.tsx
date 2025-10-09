'use client';

import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { ContentLanguage, LanguageType } from '@/types/language';
import { useRouter } from 'next/navigation';

interface LanguageSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  movieTitle: string;
}

export function LanguageSelector({ isOpen, onClose, contentId, movieTitle }: LanguageSelectorProps) {
  const router = useRouter();
  const [languages, setLanguages] = useState<ContentLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<ContentLanguage | null>(null);

  useEffect(() => {
    if (isOpen && contentId) {
      fetchLanguages();
    }
  }, [isOpen, contentId]);

  const fetchLanguages = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content-language-upload/public/languages/${contentId}`
      );

      if (response.ok) {
        const data = await response.json();
        setLanguages(data);

        // Auto-select default language
        const defaultLang = data.find((lang: ContentLanguage) => lang.is_default);
        if (defaultLang) {
          setSelectedLanguage(defaultLang);
        } else if (data.length > 0) {
          setSelectedLanguage(data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching languages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWatch = () => {
    if (selectedLanguage) {
      router.push(`/watch/${contentId}?lang=${selectedLanguage.id}`);
      onClose();
    }
  };

  const getLanguageTypeLabel = (type: LanguageType) => {
    return type === LanguageType.DUBBED ? 'Dublado' : 'Legendado';
  };

  const getLanguageIcon = (type: LanguageType) => {
    return type === LanguageType.DUBBED ? '🎤' : '📝';
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-dark-900 border border-white/10 p-6 text-left align-middle shadow-xl transition-all">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-xl font-bold text-white">
                    Selecione o Áudio
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="btn-icon text-gray-400 hover:text-white"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Movie Title */}
                <p className="text-gray-400 text-sm mb-6">{movieTitle}</p>

                {/* Loading State */}
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full"></div>
                  </div>
                ) : languages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">Nenhum áudio disponível</p>
                    <button onClick={onClose} className="btn-secondary">
                      Fechar
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Language Options */}
                    <div className="space-y-3 mb-6">
                      {languages.map((lang) => (
                        <button
                          key={lang.id}
                          onClick={() => setSelectedLanguage(lang)}
                          className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${
                            selectedLanguage?.id === lang.id
                              ? 'border-primary-500 bg-primary-500/10'
                              : 'border-white/10 bg-dark-800 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{getLanguageIcon(lang.language_type)}</span>
                            <div className="text-left">
                              <div className="font-medium text-white">
                                {lang.language_name}
                              </div>
                              <div className="text-xs text-gray-400">
                                {getLanguageTypeLabel(lang.language_type)}
                              </div>
                            </div>
                          </div>
                          {selectedLanguage?.id === lang.id && (
                            <CheckIcon className="w-5 h-5 text-primary-500" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-3">
                      <button
                        onClick={onClose}
                        className="btn-secondary flex-1"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleWatch}
                        disabled={!selectedLanguage}
                        className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Assistir
                      </button>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
