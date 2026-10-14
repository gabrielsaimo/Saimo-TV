import { useEffect, useCallback, useRef } from 'react';

interface ShortcutHandlers {
  onFullscreen?: () => void;
  onMute?: () => void;
  onTheater?: () => void;
  onPiP?: () => void;
  onNextChannel?: () => void;
  onPrevChannel?: () => void;
  onMirror?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onPlayPause?: () => void;
  onMultiScreen?: () => void;
  onChannelNumber?: (channelNumber: number) => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  // Buffer para acumular dígitos do número do canal
  const channelNumberBuffer = useRef<string>('');
  const channelNumberTimeout = useRef<number | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignorar se estiver em um input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Verifica se é um número (0-9)
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      
      // Acumula o dígito no buffer
      channelNumberBuffer.current += e.key;
      
      // Limpa timeout anterior se existir
      if (channelNumberTimeout.current) {
        clearTimeout(channelNumberTimeout.current);
      }
      
      // Define timeout para processar o número após 1.5 segundos de inatividade
      // ou imediatamente se o buffer tiver 3 dígitos (máximo de canais)
      const bufferLength = channelNumberBuffer.current.length;
      const delay = bufferLength >= 3 ? 0 : 1500;
      
      channelNumberTimeout.current = window.setTimeout(() => {
        const channelNumber = parseInt(channelNumberBuffer.current, 10);
        if (channelNumber > 0 && handlers.onChannelNumber) {
          handlers.onChannelNumber(channelNumber);
        }
        channelNumberBuffer.current = '';
      }, delay);
      
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'f':
        e.preventDefault();
        handlers.onFullscreen?.();
        break;
      case 'm':
        e.preventDefault();
        handlers.onMute?.();
        break;
      case 't':
        e.preventDefault();
        handlers.onTheater?.();
        break;
      case 'u':
        e.preventDefault();
        handlers.onMultiScreen?.();
        break;
      case 'p':
        e.preventDefault();
        handlers.onPiP?.();
        break;
      case 'arrowright':
        e.preventDefault();
        handlers.onNextChannel?.();
        break;
      case 'arrowleft':
        e.preventDefault();
        handlers.onPrevChannel?.();
        break;
      case 'r':
        e.preventDefault();
        handlers.onMirror?.();
        break;
      case 'arrowup':
        e.preventDefault();
        handlers.onVolumeUp?.();
        break;
      case 'arrowdown':
        e.preventDefault();
        handlers.onVolumeDown?.();
        break;
      case ' ':
        e.preventDefault();
        handlers.onPlayPause?.();
        break;
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Limpa timeout ao desmontar
      if (channelNumberTimeout.current) {
        clearTimeout(channelNumberTimeout.current);
      }
    };
  }, [handleKeyDown]);
}
