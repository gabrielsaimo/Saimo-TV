/**
 * Rádios: a mesma lista da TV (`vod/radios.txt`), em fileiras de ouvidas por
 * último, por estilo e de A a Z. A que toca aparece no alto com o equalizador.
 * Toca num player só dela (um <audio>), e para ao sair da tela.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { BarraTopo } from '../components/BarraTopo';
import { CampoBusca, Fileira } from '../components/Telas';
import { baixar, chave, ESTILOS, estiloDe, locais, ouviu, recentes, type Radio } from '../services/radios';
import { needsProxy, proxyUrl } from '../utils/streamUrl';
import './Radios.css';

function CartaoRadio({ radio, tocando, aoTocar }: { radio: Radio; tocando: boolean; aoTocar: () => void }) {
  return (
    <button className={`cartao-radio ${tocando ? 'tocando' : ''}`} onClick={aoTocar} title={radio.nome}>
      <div className="cartao-radio-logo">
        {radio.logo
          ? <img src={radio.logo} alt="" loading="lazy" referrerPolicy="no-referrer" />
          : <span>{radio.nome.charAt(0)}</span>}
        {tocando && <Equalizador />}
      </div>
      <strong>{radio.nome}</strong>
    </button>
  );
}

function Equalizador() {
  return <span className="equalizador" aria-label="Tocando"><i /><i /><i /><i /></span>;
}

export function Radios() {
  const [lista, setLista] = useState<Radio[]>(locais);
  const [termo, setTermo] = useState('');
  const [atual, setAtual] = useState<Radio | null>(null);
  const [estado, setEstado] = useState<'parado' | 'carregando' | 'tocando' | 'erro'>('parado');
  const [ouvidas, setOuvidas] = useState(recentes);
  const audio = useRef<HTMLAudioElement>(null);
  const hls = useRef<Hls | null>(null);

  useEffect(() => { void baixar().then((l) => { if (l) setLista(l); }); }, []);

  const parar = useCallback(() => {
    hls.current?.destroy();
    hls.current = null;
    const a = audio.current;
    if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
  }, []);
  useEffect(() => parar, [parar]);

  const tocar = useCallback((radio: Radio) => {
    const a = audio.current;
    if (!a) return;
    parar();
    setAtual(radio);
    setEstado('carregando');
    const url = needsProxy({ url: radio.url }) ? proxyUrl({ url: radio.url }) : radio.url;
    const ehHls = /\.m3u8(\?|$)/i.test(radio.url);
    if (ehHls && !a.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
      const h = new Hls();
      hls.current = h;
      h.loadSource(url);
      h.attachMedia(a);
      h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setEstado('erro'); });
    } else {
      a.src = url;
    }
    a.play().then(() => { ouviu(radio.nome); setOuvidas(recentes()); }).catch(() => setEstado('erro'));
  }, [parar]);

  const filtradas = useMemo(() => {
    const t = chave(termo.trim());
    return t ? lista.filter((r) => chave(r.nome).includes(t)) : lista;
  }, [lista, termo]);

  const recentesLista = useMemo(
    () => ouvidas.map((n) => lista.find((r) => r.nome === n)).filter((r): r is Radio => !!r), [ouvidas, lista]);

  const porEstilo = useMemo(() => {
    const mapa = new Map<string, Radio[]>();
    for (const r of filtradas) {
      const e = estiloDe(r)?.titulo ?? 'Outras';
      mapa.set(e, [...(mapa.get(e) ?? []), r]);
    }
    return [...ESTILOS.map((e) => e.titulo), 'Outras']
      .map((t) => [t, mapa.get(t)] as const).filter((x): x is [string, Radio[]] => !!x[1]);
  }, [filtradas]);

  const deAaZ = useMemo(() => [...filtradas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [filtradas]);

  const cartao = (r: Radio) => (
    <CartaoRadio key={r.nome} radio={r} tocando={atual?.nome === r.nome && estado !== 'erro'}
      aoTocar={() => (atual?.nome === r.nome && estado !== 'erro' ? (parar(), setAtual(null), setEstado('parado')) : tocar(r))} />
  );

  return (
    <div className="tela tela-com-barra">
      <BarraTopo />
      <audio ref={audio} onPlaying={() => setEstado('tocando')} onError={() => atual && setEstado('erro')} />
      <div className="tela-miolo">
        <section className="radio-topo">
          <div className="radio-agora">
            {atual ? (
              <>
                <div className="radio-agora-logo">
                  {atual.logo ? <img src={atual.logo} alt="" referrerPolicy="no-referrer" /> : <span>{atual.nome.charAt(0)}</span>}
                </div>
                <div>
                  <small>{estado === 'erro' ? 'Não foi possível tocar' : estado === 'carregando' ? 'Conectando…' : 'Tocando agora'}</small>
                  <h1>{atual.nome}</h1>
                  <p>{estiloDe(atual)?.titulo ?? 'Rádio'}</p>
                </div>
                {estado === 'tocando' && <Equalizador />}
                <button className="radio-parar" onClick={() => { parar(); setAtual(null); setEstado('parado'); }}>Parar</button>
              </>
            ) : (
              <div><small>Rádios</small><h1>Escolha uma rádio</h1><p>{lista.length} estações ao vivo</p></div>
            )}
          </div>
          <CampoBusca valor={termo} aoMudar={setTermo} placeholder="Buscar rádio" />
        </section>
      </div>

      {lista.length === 0 && <p className="tela-vazio">Carregando as rádios…</p>}
      {!termo && recentesLista.length > 0 && <Fileira titulo="Ouvidas por último">{recentesLista.map(cartao)}</Fileira>}
      {porEstilo.map(([titulo, rs]) => <Fileira key={titulo} titulo={titulo}>{rs.map(cartao)}</Fileira>)}
      {deAaZ.length > 0 && <Fileira titulo="Todas, de A a Z">{deAaZ.map(cartao)}</Fileira>}
      {lista.length > 0 && filtradas.length === 0 && <p className="tela-vazio">Nenhuma rádio com “{termo}”.</p>}
    </div>
  );
}
