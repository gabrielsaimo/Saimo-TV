/**
 * Favoritos: canais e filmes/séries marcados, numa grade. Clicar abre; o
 * coração no canto tira da lista.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarraTopo } from '../components/BarraTopo';
import { CartaoCapa, CartaoLargo, Heroi } from '../components/Telas';
import { useCanais } from '../hooks/useCanais';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getCurrentProgram } from '../services/epgService';
import { alternar, aoMudar, lista as vodLista } from '../services/vodFavoritos';
import type { ItemDestaque } from '../services/vodService';
import type { Channel } from '../types/channel';
import { ROTULO_TIPO, useAbrirVod, useHeroiVod } from './compartilhado';

type Filtro = 'tudo' | 'canais' | 'vod';

export function Favoritos() {
  const navigate = useNavigate();
  const abrirVod = useAbrirVod();
  const canais = useCanais();
  const [ids, setIds] = useLocalStorage<string[]>('tv-favorites', []);
  const [vod, setVod] = useState(vodLista);
  const [filtro, setFiltro] = useState<Filtro>('tudo');
  const [sob, setSob] = useState<ItemDestaque | null>(null);

  useEffect(() => aoMudar(() => setVod(vodLista())), []);

  const favCanais = useMemo(
    () => ids.map((id) => canais.find((c) => c.id === id)).filter((c): c is Channel => !!c), [ids, canais]);

  const heroi = useHeroiVod(sob ?? vod[0] ?? null);
  const vazio = favCanais.length === 0 && vod.length === 0;

  return (
    <div className="tela tela-com-barra">
      <BarraTopo />
      {vod.length > 0 && <Heroi item={heroi} />}
      <div className="tela-miolo">
        <h1 className="tela-titulo">Favoritos</h1>
        <p className="tela-sub">{favCanais.length} canais · {vod.length} filmes e séries</p>
        <div className="pilulas">
          {([['tudo', 'Tudo'], ['canais', 'Canais'], ['vod', 'Filmes e séries']] as const).map(([k, r]) => (
            <button key={k} className={filtro === k ? 'on' : ''} onClick={() => setFiltro(k)}>{r}</button>
          ))}
        </div>

        {vazio && (
          <div className="tela-vazio">
            <h2>Nada por aqui ainda</h2>
            <p>Marque canais na lista do Ao vivo e filmes e séries no On Demand para achá-los aqui.</p>
          </div>
        )}

        {filtro !== 'vod' && favCanais.length > 0 && (
          <>
            <h2 className="grade-titulo">Canais</h2>
            <div className="grade">
              {favCanais.map((c) => (
                <div key={c.id} className="grade-item">
                  <CartaoLargo titulo={c.name} logo={c.logo} linha={getCurrentProgram(c.id)?.current?.title ?? c.category}
                    aoAbrir={() => navigate(`/tv/${c.id}`)} />
                  <button className="grade-tirar" title="Tirar dos favoritos"
                    onClick={() => setIds((a) => a.filter((x) => x !== c.id))}>♥</button>
                </div>
              ))}
            </div>
          </>
        )}

        {filtro !== 'canais' && vod.length > 0 && (
          <>
            <h2 className="grade-titulo">Filmes e séries</h2>
            <div className="grade">
              {vod.map((i) => (
                <div key={`${i.tipo}${i.titulo}${i.ano}`} className="grade-item">
                  <CartaoCapa titulo={i.titulo} capa={i.capa} rotulo={ROTULO_TIPO[i.tipo]}
                    aoAbrir={() => abrirVod(i)} aoPassar={() => setSob(i)} />
                  <button className="grade-tirar" title="Tirar dos favoritos" onClick={() => alternar(i)}>♥</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
