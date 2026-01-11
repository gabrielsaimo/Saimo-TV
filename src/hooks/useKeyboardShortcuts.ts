import { useEffect, useCallback } from 'react';

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
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignorar se estiver em um input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
