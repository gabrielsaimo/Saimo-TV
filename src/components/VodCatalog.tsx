/**
 * Catálogo de filmes e séries, lido do mesmo repositório que o aplicativo usa.
 *
 * A navegação é por letra porque o acervo é publicado por letra: trinta mil
 * títulos não cabem numa página, e pedir a letra inteira custa uns cem
 * quilobytes. A busca é a exceção — o índice de nomes é pequeno o bastante para
 * procurar no acervo todo sem baixá-lo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Movie } from '../types/movie';
import {
  LETRAS,
  buscar,
  capa,
  episodios,
  filme as buscarFilme,
  filmes as listarFilmes,
  indice,
  serie as buscarSerie,
  series as listarSeries,
  type Achado,
  type Episodio,
  type Filme,
  type Gaveta,
  type Serie,
} from '../services/vodService';
import './VodCatalog.css';

type Aba = 'filmes' | 'series';

/** Quantos cartões entram por vez ao rolar. */
const PAGINA = 120;

interface VodCatalogProps {
  onSelectMovie: (movie: Movie) => void;
  onBack: () => void;
}

interface Item {
  chave: string;
  titulo: string;
  rotulo: string;
  serie: boolean;
  letra: string;
  filme?: Filme;
  dados?: Serie;
}

/** Capa buscada só quando o cartão aparece: são vinte na tela, não trinta mil. */
function Poster({ titulo, serie }: { titulo: string; serie: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [visivel, setVisivel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisivel(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) return;
    let vivo = true;
    capa(titulo, serie).then((url) => { if (vivo) setSrc(url); });
    return () => { vivo = false; };
  }, [visivel, titulo, serie]);

  return (
    <div className="vod-poster" ref={ref}>
      {src
        ? <img src={src} alt={titulo} loading="lazy" />
        : <div className="vod-poster-vazio">{titulo.slice(0, 2).toUpperCase()}</div>}
    </div>
  );
}

export function VodCatalog({ onSelectMovie, onBack }: VodCatalogProps) {
  const [aba, setAba] = useState<Aba>('filmes');
  const [letra, setLetra] = useState('A');
  const [gavetas, setGavetas] = useState<Gaveta[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState<Achado[] | null>(null);
  const [aberto, setAberto] = useState<Item | null>(null);
  const [episodiosAbertos, setEpisodiosAbertos] = useState<Episodio[] | null>(null);
  const [temporada, setTemporada] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  /*
   * A letra A traz três mil e quinhentos filmes, e três mil e quinhentos
   * cartões de uma vez travam a rolagem antes de a primeira capa aparecer. A
   * lista inteira já está na memória; o que cresce aqui é só o que vai para a
   * tela, conforme a pessoa chega ao fim.
   *
   * A contagem anda junto da lista a que pertence: trocar de letra devolve a
   * primeira página sozinho, sem um efeito que zere o número depois de a lista
   * nova já ter sido desenhada inteira.
   */
  const [pagina, setPagina] = useState({ lista: '', quantos: PAGINA });
  const sentinela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    indice().then(setGavetas).catch(() => setGavetas([]));
  }, []);

  const contagem = useMemo(() => {
    const mapa = new Map<string, Gaveta>();
    gavetas.forEach((g) => mapa.set(g.letra, g));
    return mapa;
  }, [gavetas]);

  // Lista da letra escolhida. A busca, quando ativa, manda na tela.
  useEffect(() => {
    if (busca) return;
    let vivo = true;
    setCarregando(true);
    setErro(null);

    const trabalho = aba === 'filmes'
      ? listarFilmes(letra).then((lista) => lista.map<Item>((f) => ({
        chave: `f:${f.titulo}`,
        titulo: f.titulo,
        rotulo: f.titulo,
        serie: false,
        letra,
        filme: f,
      })))
      : listarSeries(letra).then((lista) => lista.map<Item>((s) => ({
        chave: `s:${s.titulo}:${s.ano}`,
        titulo: s.titulo,
        rotulo: s.nomeCompleto,
        serie: true,
        letra,
        dados: s,
      })));

    trabalho
      .then((lista) => { if (vivo) setItens(lista); })
      .catch(() => { if (vivo) { setItens([]); setErro('Não foi possível carregar esta letra.'); } })
      .finally(() => { if (vivo) setCarregando(false); });

    return () => { vivo = false; };
  }, [aba, letra, busca]);

  // Busca no acervo inteiro, com folga para quem ainda está digitando.
  useEffect(() => {
    const alvo = termo.trim();
    if (alvo.length < 2) { setBusca(null); return; }
    const tempo = window.setTimeout(() => {
      setCarregando(true);
      buscar(alvo)
        .then(setBusca)
        .catch(() => setBusca([]))
        .finally(() => setCarregando(false));
    }, 350);
    return () => window.clearTimeout(tempo);
  }, [termo]);

  const resultados = useMemo<Item[]>(() => {
    if (!busca) return itens;
    return busca
      .filter((a) => (aba === 'filmes' ? !a.serie : a.serie))
      .map((a) => ({
        chave: `${a.serie ? 's' : 'f'}:${a.titulo}:${a.ano}`,
        titulo: a.titulo,
        rotulo: a.nomeCompleto,
        serie: a.serie,
        letra: a.letra,
      }));
  }, [busca, itens, aba]);

  const tocar = useCallback((titulo: string, url: string, tipo: 'movie' | 'series') => {
    onSelectMovie({
      id: `${tipo}-${titulo}-${url}`.slice(0, 200),
      name: titulo,
      url,
      category: tipo === 'series' ? 'Séries' : 'Filmes',
      type: tipo,
    });
  }, [onSelectMovie]);

  /** Abre um cartão: filme toca direto, série mostra os episódios. */
  const abrir = useCallback(async (item: Item) => {
    setErro(null);
    if (!item.serie) {
      const dados = item.filme
        ?? await buscarFilme({ titulo: item.titulo, serie: false, letra: item.letra, ano: '', nomeCompleto: item.titulo });
      const primeira = dados && Object.values(dados.fontes).find((urls) => urls.length);
      if (!primeira?.length) { setErro(`Sem fonte disponível para "${item.titulo}".`); return; }
      tocar(item.titulo, primeira[0], 'movie');
      return;
    }

    const ano = item.dados?.ano ?? item.chave.split(':')[2] ?? '';
    const dados = item.dados
      ?? await buscarSerie({ titulo: item.titulo, serie: true, letra: item.letra, ano, nomeCompleto: item.rotulo });
    if (!dados) { setErro(`Não foi possível abrir "${item.rotulo}".`); return; }

    setAberto({ ...item, dados });
    setEpisodiosAbertos(null);
    const lista = await episodios(item.letra, dados);
    setEpisodiosAbertos(lista);
    setTemporada(lista[0]?.temporada ?? 1);
  }, [tocar]);

  const temporadas = useMemo(() => {
    if (!episodiosAbertos) return [];
    return [...new Set(episodiosAbertos.map((e) => e.temporada))].sort((a, b) => a - b);
  }, [episodiosAbertos]);

  const listaAtual = busca ? `busca:${termo.trim()}:${aba}` : `${aba}:${letra}`;
  const visiveis = pagina.lista === listaAtual ? pagina.quantos : PAGINA;

  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setPagina((atual) => ({
        lista: listaAtual,
        quantos: (atual.lista === listaAtual ? atual.quantos : PAGINA) + PAGINA,
      }));
    }, { rootMargin: '600px' });
    observer.observe(alvo);
    return () => observer.disconnect();
  }, [listaAtual]);

  const daTemporada = useMemo(
    () => (episodiosAbertos ?? [])
      .filter((e) => e.temporada === temporada)
      .sort((a, b) => a.numero - b.numero),
    [episodiosAbertos, temporada],
  );

  return (
    <div className="vod-catalog">
      <header className="vod-header">
        <button className="vod-voltar" onClick={onBack} aria-label="Voltar">←</button>
        <div className="vod-abas">
          <button
            className={aba === 'filmes' ? 'ativa' : ''}
            onClick={() => { setAba('filmes'); setAberto(null); }}
          >
            Filmes
          </button>
          <button
            className={aba === 'series' ? 'ativa' : ''}
            onClick={() => { setAba('series'); setAberto(null); }}
          >
            Séries
          </button>
        </div>
        <input
          className="vod-busca"
          type="search"
          placeholder="Buscar em todo o acervo…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </header>

      {!busca && (
        <nav className="vod-letras">
          {LETRAS.map((l) => {
            const g = contagem.get(l);
            const quantos = aba === 'filmes' ? g?.filmes ?? 0 : g?.series ?? 0;
            return (
              <button
                key={l}
                className={l === letra ? 'ativa' : ''}
                disabled={gavetas.length > 0 && quantos === 0}
                onClick={() => { setLetra(l); setAberto(null); }}
                title={quantos ? `${quantos} títulos` : undefined}
              >
                {l}
              </button>
            );
          })}
        </nav>
      )}

      {erro && <p className="vod-erro">{erro}</p>}

      {aberto && (
        <section className="vod-serie">
          <div className="vod-serie-topo">
            <h2>{aberto.rotulo}</h2>
            <button onClick={() => setAberto(null)}>Fechar</button>
          </div>
          {episodiosAbertos === null && <p className="vod-aviso">Carregando episódios…</p>}
          {episodiosAbertos?.length === 0 && <p className="vod-aviso">Nenhum episódio encontrado.</p>}
          {temporadas.length > 1 && (
            <div className="vod-temporadas">
              {temporadas.map((t) => (
                <button
                  key={t}
                  className={t === temporada ? 'ativa' : ''}
                  onClick={() => setTemporada(t)}
                >
                  T{t}
                </button>
              ))}
            </div>
          )}
          <ul className="vod-episodios">
            {daTemporada.map((e) => (
              <li key={`${e.temporada}-${e.numero}-${e.versao}`}>
                <button onClick={() => tocar(`${aberto.rotulo} — T${e.temporada}E${e.numero}`, e.urls[0], 'series')}>
                  <span className="vod-ep-numero">T{e.temporada}E{e.numero}</span>
                  <span className="vod-ep-versao">{e.versao}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {carregando && <p className="vod-aviso">Carregando…</p>}

      <div className="vod-grade">
        {resultados.slice(0, visiveis).map((item) => (
          <button key={item.chave} className="vod-card" onClick={() => abrir(item)}>
            <Poster titulo={item.rotulo} serie={item.serie} />
            <span className="vod-card-titulo">{item.rotulo}</span>
          </button>
        ))}
      </div>

      <div ref={sentinela} className="vod-sentinela" aria-hidden="true" />

      {!carregando && resultados.length === 0 && (
        <p className="vod-aviso">Nada por aqui. Tente outra letra ou outra busca.</p>
      )}
    </div>
  );
}
