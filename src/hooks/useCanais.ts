import { useEffect, useMemo, useState } from 'react';
import { adultChannels, getAllChannels } from '../data/channels';
import { cachedChannels, fetchChannels } from '../services/catalogService';
import { atualizar as atualizarFontesDesativadas } from '../services/fontesDesativadas';
import { fetchRealEPG, registerChannels } from '../services/epgService';
import { aoMudar, locais } from '../services/canaisPersonalizados';
import { useAdultMode } from '../contexts/adultoContexto';
import type { Channel } from '../types/channel';

/**
 * A grade de canais para as telas: a guardada na hora, a publicada por trás,
 * os canais personalizados importados e o guia de programação já registrado.
 */
export function useCanais(): Channel[] {
  const { isAdultUnlocked } = useAdultMode();
  const [remotos, setRemotos] = useState<Channel[] | null>(() => cachedChannels());
  const [personalizados, setPersonalizados] = useState<Channel[]>(locais);

  useEffect(() => {
    let vivo = true;
    atualizarFontesDesativadas()
      .catch(() => false)
      .then(() => fetchChannels())
      .then((lista) => { if (vivo && lista) setRemotos(lista); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  useEffect(() => aoMudar(() => setPersonalizados(locais())), []);

  const canais = useMemo(() => {
    const base = remotos
      ? (isAdultUnlocked ? [...remotos, ...adultChannels] : remotos)
      : getAllChannels(isAdultUnlocked);
    return personalizados.length ? [...base, ...personalizados] : base;
  }, [remotos, isAdultUnlocked, personalizados]);

  useEffect(() => {
    if (!canais.length) return;
    registerChannels(canais);
    if (remotos) void fetchRealEPG();
  }, [canais, remotos]);

  return canais;
}
