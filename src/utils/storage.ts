const FAVORITES_KEY = 'tv-favorites';
const LAST_CHANNEL_KEY = 'tv-last-channel';
const VOLUME_KEY = 'tv-volume';

export const storage = {
  getFavorites: (): string[] => {
    try {
      const data = localStorage.getItem(FAVORITES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setFavorites: (favorites: string[]): void => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  },

  toggleFavorite: (channelId: string): string[] => {
    const favorites = storage.getFavorites();
    const index = favorites.indexOf(channelId);
    
    if (index === -1) {
      favorites.push(channelId);
    } else {
      favorites.splice(index, 1);
    }
    
    storage.setFavorites(favorites);
    return favorites;
  },

  isFavorite: (channelId: string): boolean => {
    return storage.getFavorites().includes(channelId);
  },

  getLastChannel: (): string | null => {
    return localStorage.getItem(LAST_CHANNEL_KEY);
  },

  setLastChannel: (channelId: string): void => {
    localStorage.setItem(LAST_CHANNEL_KEY, channelId);
  },

  getVolume: (): number => {
    const volume = localStorage.getItem(VOLUME_KEY);
    return volume ? parseFloat(volume) : 1;
  },

  setVolume: (volume: number): void => {
    localStorage.setItem(VOLUME_KEY, volume.toString());
  },
};
