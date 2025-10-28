'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, FilmIcon } from '@heroicons/react/24/outline';

interface RequestContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramBotUsername?: string;
}

export function RequestContentModal({
  isOpen,
  onClose,
  telegramBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cinevision_bot'
}: RequestContentModalProps) {

  const handleOpenTelegram = () => {
    // Abre o Telegram com o bot
    const telegramUrl = `https://t.me/${telegramBotUsername}`;
    window.open(telegramUrl, '_blank');
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
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-dark-900 border border-white/10 p-6 text-left align-middle shadow-2xl transition-all">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>

                {/* Icon */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-dark-800 border border-white/10">
                  <FilmIcon className="h-8 w-8 text-primary-500" />
                </div>

                {/* Title */}
                <Dialog.Title
                  as="h3"
                  className="text-xl font-bold text-white text-center mt-4 mb-2"
                >
                  Gostaria de ver este conteúdo?
                </Dialog.Title>

                {/* Description */}
                <Dialog.Description className="text-sm text-gray-400 text-center mb-6">
                  Solicite e receba uma notificação pelo Telegram assim que o conteúdo for adicionado à plataforma!
                </Dialog.Description>

                {/* Button */}
                <button
                  onClick={handleOpenTelegram}
                  className="w-full btn-primary flex items-center justify-center gap-2 text-base py-3"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.155.232.171.325.016.093.036.305.02.469z"/>
                  </svg>
                  Solicitar via Telegram
                </button>

                {/* Hint */}
                <p className="text-xs text-gray-500 text-center mt-4">
                  Dica: Verifique a ortografia ou tente palavras-chave diferentes
                </p>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
