export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  category?: string;
  channelNumber?: number;
}

export interface PlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  isFullscreen: boolean;
  isMirrored: boolean;
  isTheaterMode: boolean;
  isPiP: boolean;
  isLoading: boolean;
  error: string | null;
}
