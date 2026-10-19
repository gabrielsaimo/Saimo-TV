/**
 * Peças das telas em fileiras (Início, Eventos, Rádios, Favoritos, Busca):
 * o destaque do alto, a fileira que corre para o lado com setas de vidro, e os
 * cartões. É a mesma linguagem visual do Mac e da TV Box, feita para o mouse.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import './Telas.css';

export interface Destaque {
  titulo: string;
  selos?: string[];
  sinopse?: string;
  /** Imagem larga do fundo; sem ela, a capa borrada. */
  fundo?: string | null;
  capa?: string | null;
}

export function Heroi({ item }: { item: Destaque | null }) {
  if (!item) return <div className="heroi heroi-vazio" />;
  const imagem = item.fundo || item.capa;
  return (
    <section className="heroi">
      {imagem && <img key={imagem} className={`heroi-fundo ${item.fundo ? '' : 'borrado'}`} src={imagem} alt="" referrerPolicy="no-referrer" />}
      <div className="heroi-vinheta" />
      <div className="heroi-texto">
        {!!item.selos?.length && (
          <div className="heroi-selos">{item.selos.map((s) => <span key={s}>{s}</span>)}</div>
        )}
        <h1>{item.titulo}</h1>
        {item.sinopse && <p>{item.sinopse}</p>}
      </div>
    </section>
  );
}

export function Fileira({ titulo, children, aoVerTodos, rotuloVerTodos = 'Ver todos' }: {
  titulo: string;
  children: ReactNode;
  aoVerTodos?: () => void;
  rotuloVerTodos?: string;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  const [borda, setBorda] = useState({ esq: false, dir: true });

  const medir = () => {
    const el = trilho.current;
    if (!el) return;
    const esq = el.scrollLeft > 4;
    const dir = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setBorda((prev) => (prev.esq !== esq || prev.dir !== dir ? { esq, dir } : prev));
  };

  useEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  const rolar = (sentido: number) =>
    trilho.current?.scrollBy({ left: sentido * trilho.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <section className="fileira">
      <header>
        <h2>{titulo}</h2>
        {aoVerTodos && <button className="fileira-ver" onClick={aoVerTodos}>{rotuloVerTodos} ›</button>}
      </header>
      <div className="fileira-corpo">
        {borda.esq && <button className="fileira-seta esq" onClick={() => rolar(-1)} aria-label="Anterior">‹</button>}
        <div className="fileira-trilho" ref={trilho} onScroll={medir}>{children}</div>
        {borda.dir && <button className="fileira-seta dir" onClick={() => rolar(1)} aria-label="Próximo">›</button>}
      </div>
    </section>
  );
}

/** Capa vertical de filme/série, com o título embaixo. */
export function CartaoCapa({ titulo, capa, rotulo, progresso, aoAbrir, aoPassar, extra }: {
  titulo: string;
  capa?: string | null;
  rotulo?: string;
  /** 0 a 1: a barrinha do "Continue assistindo". */
  progresso?: number;
  aoAbrir: () => void;
  aoPassar?: () => void;
  extra?: ReactNode;
}) {
  return (
    <button className="cartao-capa" onClick={aoAbrir} onMouseEnter={aoPassar} onFocus={aoPassar} title={titulo}>
      <div className="cartao-capa-img">
        {capa
          ? <img src={capa} alt="" loading="lazy" referrerPolicy="no-referrer" />
          : <span aria-hidden="true">{titulo.charAt(0)}</span>}
        {progresso != null && <i className="cartao-capa-prog"><b style={{ width: `${Math.round(progresso * 100)}%` }} /></i>}
        {extra}
      </div>
      <strong>{titulo}</strong>
      {rotulo && <small>{rotulo}</small>}
    </button>
  );
}

/** Cartão largo de canal ao vivo: logo, selo e o programa no ar. */
export function CartaoLargo({ titulo, linha, logo, selo, progresso, aoAbrir, aoPassar }: {
  titulo: string;
  linha?: string;
  logo?: string;
  selo?: string;
  progresso?: number;
  aoAbrir: () => void;
  aoPassar?: () => void;
}) {
  return (
    <button className="cartao-largo" onClick={aoAbrir} onMouseEnter={aoPassar} onFocus={aoPassar} title={titulo}>
      {selo && <em className="selo-vivo"><i />{selo}</em>}
      <div className="cartao-largo-logo">
        {logo ? <img src={logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>{titulo.charAt(0)}</span>}
      </div>
      <strong>{titulo}</strong>
      {linha && <small>{linha}</small>}
      {progresso != null && <i className="cartao-largo-prog"><b style={{ width: `${Math.round(progresso)}%` }} /></i>}
    </button>
  );
}

/** Campo de busca de vidro. */
export function CampoBusca({ valor, aoMudar, placeholder, autoFocus }: {
  valor: string; aoMudar: (v: string) => void; placeholder: string; autoFocus?: boolean;
}) {
  return (
    <label className="campo-busca">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
      {valor && <button onClick={() => aoMudar('')} aria-label="Limpar">×</button>}
    </label>
  );
}

const TEXTOS_SEM_LISTA = {
  canais: ['Nenhum canal', 'Informe o endereço da lista de canais em Ajustes > Listas.'],
  filmes: ['Nenhum filme ou série', 'Informe o endereço da lista de filmes e séries em Ajustes > Listas.'],
  radios: ['Nenhuma rádio', 'Informe o endereço da lista de canais em Ajustes > Listas.'],
  eventos: ['Nenhum jogo', 'Os jogos aparecem nos canais da lista. Informe o endereço da lista de canais em Ajustes > Listas.'],
  guia: ['Sem guia de programação', 'Informe o endereço da lista de canais em Ajustes > Listas.'],
} as const;

/**
 * Estado vazio de quem ainda não informou o endereço da lista: diz o que falta
 * e leva a Ajustes. A tela não faz pedido nenhum de rede enquanto isso.
 */
export function SemLista({ tipo }: { tipo: keyof typeof TEXTOS_SEM_LISTA }) {
  const navigate = useNavigate();
  const [titulo, texto] = TEXTOS_SEM_LISTA[tipo];
  return (
    <div className="tela-vazio sem-lista" role="status">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden="true">
        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
      </svg>
      <h2>{titulo}</h2>
      <p>{texto}</p>
      <button type="button" className="sem-lista-acao" onClick={() => navigate('/ajustes')}>Abrir Ajustes</button>
    </div>
  );
}
