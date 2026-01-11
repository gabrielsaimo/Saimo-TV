export interface Program {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category?: string;
  rating?: string;
  thumbnail?: string;
  isLive?: boolean;
  episodeInfo?: {
    season?: number;
    episode?: number;
    episodeTitle?: string;
  };
}

export interface ChannelEPG {
  channelId: string;
  programs: Program[];
}

export interface CurrentProgram {
  current: Program | null;
  next: Program | null;
  progress: number; // 0-100
}
