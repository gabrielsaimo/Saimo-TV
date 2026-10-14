/**
 * Início: o mesmo da TV Box e do Mac — o título sob o ponteiro em destaque no
 * alto, e fileiras embaixo: Continue assistindo, Ao vivo agora (cartões largos
 * com o programa no ar), Favoritos e os destaques do catálogo.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Abertura } from '../components/Abertura';
import { BarraTopo } from '../components/BarraTopo';
import { CartaoCapa, CartaoLargo, Fileira, Heroi } from '../components/Telas';
import { useCanais } from '../hooks/useCanais';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { lista as listaAndamento } from '../services/continuar';
import { getCurrentProgram, onEPGUpdate } from '../services/epgService';
import { destaques, type FilaDestaque, type ItemDestaque } from '../services/vodService';
import { ROTULO_TIPO, useAbrirVod, useHeroiVod } from './compartilhado';
import { CHAVE_AO_INICIAR } from './Ajustes';
import { aoMudar as aoMudarVodFav, lista as vodFavoritos } from '../services/vodFavoritos';
import type { Channel } from '../types/channel';

/** Quantos cartões "Ao vivo agora" cabem numa fileira. */
const AO_VIVO_MAX = 30;

export function Inicio() {
  const navigate = useNavigate();
  const abrirVod = useAbrirVod();
  const canais = useCanais();
  const [filas, setFilas] = useState<FilaDestaque[]>([]);
  const [favoritos] = useLocalStorage<string[]>('tv-favorites', []);
  const [tic, tique] = useState(0);
  const [sob, setSob] = useState<ItemDestaque | null>(null);
  const [vodFav, setVodFav] = useState(vodFavoritos);
  const [andamento] = useState(listaAndamento);

  useEffect(() => { void destaques().then(setFilas); }, []);

  // Ajustes > Ao iniciar > último canal: só na entrada da visita, para o botão
  // Início continuar levando ao Início.
  useEffect(() => {
    if (sessionStorage.getItem('saimo-entrada')) return;
    sessionStorage.setItem('saimo-entrada', '1');
    try {
      const ao = JSON.parse(localStorage.getItem(CHAVE_AO_INICIAR) || '"inicio"');
      if (ao === 'ultimo' && localStorage.getItem('tv-last-channel')) navigate('/tv', { replace: true });
    } catch { /* valor ilegível: fica no Início */ }
  }, [navigate]);
  useEffect(() => aoMudarVodFav(() => setVodFav(vodFavoritos())), []);
  // O programa no ar muda sozinho: redesenha quando o guia chega e a cada minuto.
  useEffect(() => {
    const parar = onEPGUpdate(() => tique((n) => n + 1));
    const id = window.setInterval(() => tique((n) => n + 1), 60_000);
    return () => { parar(); window.clearInterval(id); };
  }, []);

  const noAr = useMemo(() => {
    void tic; // o relógio do minuto: refaz a lista quando o programa no ar muda
    const lista: { canal: Channel; titulo: string; progresso: number }[] = [];
    for (const canal of canais) {
      if (lista.length >= AO_VIVO_MAX) break;
      const p = getCurrentProgram(canal.id);
      if (p?.current) lista.push({ canal, titulo: p.current.title, progresso: p.progress });
    }
    return lista;
  }, [canais, tic]);

  const favCanais = useMemo(
    () => favoritos.map((id) => canais.find((c) => c.id === id)).filter((c): c is Channel => !!c),
    [favoritos, canais]);

  const primeiro = filas[0]?.itens[0] ?? null;
  const heroi = useHeroiVod(sob ?? primeiro);

  const abrirCanal = (c: Channel) => navigate(`/tv/${c.id}`);

  return (
    <div className="tela tela-com-barra">
      <Abertura />
      <BarraTopo />
      <Heroi item={heroi} />

      {andamento.length > 0 && (
        <Fileira titulo="Continue assistindo">
          {andamento.map((a) => (
            <CartaoCapa
              key={a.origem.titulo}
              titulo={a.origem.titulo}
              capa={a.origem.capa}
              rotulo={a.rotulo}
              progresso={a.fracao}
              aoAbrir={() => abrirVod(a.origem)}
              aoPassar={() => setSob(a.origem)}
            />
          ))}
        </Fileira>
      )}

      {noAr.length > 0 && (
        <Fileira titulo="Ao vivo agora" aoVerTodos={() => navigate('/tv')} rotuloVerTodos="Abrir Ao vivo">
          {noAr.map(({ canal, titulo, progresso }) => (
            <CartaoLargo
              key={canal.id}
              titulo={canal.name}
              linha={titulo}
              logo={canal.logo}
              selo="AO VIVO"
              progresso={progresso}
              aoAbrir={() => abrirCanal(canal)}
            />
          ))}
        </Fileira>
      )}

      {favCanais.length > 0 && (
        <Fileira titulo="Canais favoritos" aoVerTodos={() => navigate('/favoritos')}>
          {favCanais.map((c) => (
            <CartaoLargo key={c.id} titulo={c.name} logo={c.logo}
              linha={getCurrentProgram(c.id)?.current?.title ?? c.category}
              aoAbrir={() => abrirCanal(c)} />
          ))}
        </Fileira>
      )}

      {vodFav.length > 0 && (
        <Fileira titulo="Filmes e séries favoritos" aoVerTodos={() => navigate('/favoritos')}>
          {vodFav.slice(0, 20).map((i) => (
            <CartaoCapa key={`${i.tipo}${i.titulo}${i.ano}`} titulo={i.titulo} capa={i.capa}
              rotulo={ROTULO_TIPO[i.tipo]} aoAbrir={() => abrirVod(i)} aoPassar={() => setSob(i)} />
          ))}
        </Fileira>
      )}

      {filas.map((fila) => (
        <Fileira key={fila.titulo} titulo={fila.titulo} aoVerTodos={() => navigate('/movies')} rotuloVerTodos="Abrir On Demand">
          {fila.itens.map((i) => (
            <CartaoCapa key={`${i.tipo}${i.titulo}${i.ano}`} titulo={i.titulo} capa={i.capa}
              rotulo={i.ano || ROTULO_TIPO[i.tipo]} aoAbrir={() => abrirVod(i)} aoPassar={() => setSob(i)} />
          ))}
        </Fileira>
      ))}
    </div>
  );
}
