'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, GlobeAltIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

interface ViewingOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  movieTitle: string;
  telegramGroupLink: string;
  onChooseSite: () => void;
}

export function ViewingOptionsModal({
  isOpen,
  onClose,
  movieTitle,
  telegramGroupLink,
  onChooseSite,
}: ViewingOptionsModalProps) {
  const handleTelegramClick = () => {
    // Open Telegram group link in new tab
    window.open(telegramGroupLink, '_blank');
    onClose();
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
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 border border-gray-800/50 p-8 shadow-2xl transition-all">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>

                {/* Header */}
                <Dialog.Title className="text-2xl font-bold text-white mb-2">
                  Como você quer assistir?
                </Dialog.Title>
                <p className="text-gray-400 mb-8">
                  {movieTitle}
                </p>

                {/* Options */}
                <div className="space-y-4">
                  {/* Site Option */}
                  <button
                    onClick={onChooseSite}
                    className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-2 border-purple-500/30 hover:border-purple-500/60 p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/20"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                        <GlobeAltIcon className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">
                          🌐 Assistir no Site
                        </h3>
                        <p className="text-sm text-gray-400">
                          Assista diretamente no navegador com nosso player online
                        </p>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </button>

                  {/* Telegram Option */}
                  <button
                    onClick={handleTelegramClick}
                    className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-2 border-blue-500/30 hover:border-blue-500/60 p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/20"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                        <ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-300 transition-colors">
                          📱 Assistir no Telegram
                        </h3>
                        <p className="text-sm text-gray-400">
                          Acesse o grupo privado do Telegram para baixar o filme
                        </p>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </button>
                </div>

                {/* Info */}
                <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-300">
                    💡 <strong>Dica:</strong> No Telegram você pode baixar o filme para assistir offline, enquanto no site você assiste online com streaming.
                  </p>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
