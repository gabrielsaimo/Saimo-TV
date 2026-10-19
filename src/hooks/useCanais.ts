import { useEffect, useMemo, useState } from 'react';
import {
  cachedChannels, cachedRestritos, fetchChannels, fetchRestritos,
} from '../services/catalogService';
import {
  atualizar as atualizarFontesDesativadas, VALIDADE_MS as FONTES_MS,
} from '../services/fontesDesativadas';
import { fetchRealEPG, registerChannels } from '../services/epgService';
import { aoMudar, locais } from '../services/canaisPersonalizados';
import { useListas } from '../services/listas';
import { useAdultMode } from '../contexts/adultoContexto';
import type { Channel } from '../types/channel';

const VAZIO: Channel[] = [];

/**
 * A grade de canais para as telas: a guardada na hora, a publicada por trás,
 * os canais personalizados importados e o guia de programação já registrado.
 *
 * Sem endereço de canais a lista é vazia e nada é pedido à rede; trocar o
 * endereço em Ajustes refaz tudo daqui.
 */
export function useCanais(): Channel[] {
  const { isAdultUnlocked } = useAdultMode();
  const { canais: link } = useListas();
  const [remotos, setRemotos] = useState<{ link: string; lista: Channel[] | null }>(
    () => ({ link, lista: cachedChannels() }),
  );
  const [restritos, setRestritos] = useState<{ link: string; lista: Channel[] }>(
    () => ({ link, lista: isAdultUnlocked ? cachedRestritos() : VAZIO }),
  );
  const [personalizados, setPersonalizados] = useState<Channel[]>(locais);

  // O que está em estado só vale para o endereço com que foi lido.
  const doLink = remotos.link === link ? remotos.lista : null;
  const restritosDoLink = restritos.link === link ? restritos.lista : VAZIO;

  useEffect(() => {
    if (!link) return;
    let vivo = true;
    // O que veio da visita anterior já está na tela e fica nela; a lista
    // publicada é rebuscada sempre, por trás, e só troca a tela se chegar.
    // A lista de servidores desligados vem antes do catálogo: chegando depois,
    // a tela mostraria por um instante canais que já não abrem.
    const cache = cachedChannels();
    if (cache) setRemotos({ link, lista: cache });
    atualizarFontesDesativadas()
      .catch(() => false)
      .then(() => fetchChannels())
      .then((lista) => { if (vivo && lista) setRemotos({ link, lista }); })
      .catch((err) => console.error('Erro ao carregar catálogo remoto:', err));
    // Um servidor desligado no painel tem que sumir da tela em minutos, sem
    // recarregar a página: a lista é remontada do que já está em disco.
    const relogio = window.setInterval(() => {
      void atualizarFontesDesativadas().then((mudou) => {
        if (!mudou || !vivo) return;
        const lista = cachedChannels();
        if (lista) setRemotos({ link, lista });
      });
    }, FONTES_MS);
    return () => { vivo = false; window.clearInterval(relogio); };
  }, [link]);

  // `restritos.txt` só é pedido depois do código do controle parental.
  useEffect(() => {
    if (!link || !isAdultUnlocked) return;
    let vivo = true;
    const cache = cachedRestritos();
    if (cache.length) setRestritos({ link, lista: cache });
    void fetchRestritos().then((lista) => { if (vivo && lista) setRestritos({ link, lista }); });
    return () => { vivo = false; };
  }, [link, isAdultUnlocked]);

  useEffect(() => aoMudar(() => setPersonalizados(locais())), []);

  const canais = useMemo(() => {
    const base = doLink ?? VAZIO;
    const comRestritos = isAdultUnlocked && restritosDoLink.length ? [...base, ...restritosDoLink] : base;
    return personalizados.length ? [...comRestritos, ...personalizados] : comRestritos;
  }, [doLink, restritosDoLink, isAdultUnlocked, personalizados]);

  /*
   * O guia procura a programação pelo nome do canal, então só pode começar
   * depois de a grade existir.
   */
  useEffect(() => {
    if (!canais.length) return;
    registerChannels(canais);
    if (doLink) void fetchRealEPG();
  }, [canais, doLink]);

  return canais;
}
