import { createContext, useContext } from 'react';

/** Estado do modo adulto (+18), compartilhado entre todas as telas. */
export interface AdultModeContextType {
  isAdultUnlocked: boolean;
  unlockAdult: () => void;
  lockAdult: () => void;
}

export const AdultModeContext = createContext<AdultModeContextType>({
  isAdultUnlocked: false,
  unlockAdult: () => {},
  lockAdult: () => {},
});

export const useAdultMode = () => useContext(AdultModeContext);
