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

export function useKeyboardShortcuts(_handlers: ShortcutHandlers) {
  // Atalhos de teclado desativados no site.
}

