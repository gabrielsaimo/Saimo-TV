import { useEffect, useMemo, useState } from 'react';
import { adultChannels, getAllChannels } from '../data/channels';
import { cachedChannels, fetchChannels } from '../services/catalogService';
import { atualizar as atualizarFontesDesativadas } from '../services/fontesDesativadas';
import { fetchRealEPG, registerChannels } from '../services/epgService';
import { useAdultMode } from '../contexts/adultoContexto';
import type { Channel } from '../types/channel';

/**
 * A grade de canais para as telas que não são o "Ao vivo": a guardada na hora,
 * a publicada por trás, e o guia de programação já registrado — é o que faz o
 * "Ao vivo agora" mostrar o programa no ar.
 */
export function useCanais(): Channel[] {
  const { isAdultUnlocked } = useAdultMode();
  const [remotos, setRemotos] = useState<Channel[] | null>(() => cachedChannels());

  useEffect(() => {
    let vivo = true;
    atualizarFontesDesativadas()
      .catch(() => false)
      .then(() => fetchChannels())
      .then((lista) => { if (vivo && lista) setRemotos(lista); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const canais = useMemo(() => remotos
    ? (isAdultUnlocked ? [...remotos, ...adultChannels] : remotos)
    : getAllChannels(isAdultUnlocked), [remotos, isAdultUnlocked]);

  useEffect(() => {
    if (!canais.length) return;
    registerChannels(canais);
    if (remotos) void fetchRealEPG();
  }, [canais, remotos]);

  return canais;
}
