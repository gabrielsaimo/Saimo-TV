/**
 * Peças das telas em fileiras (Início, Eventos, Rádios, Favoritos, Busca):
 * o destaque do alto, a fileira que corre para o lado com setas de vidro, e os
 * cartões. É a mesma linguagem visual do Mac e da TV Box, feita para o mouse.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
    setBorda({ esq: el.scrollLeft > 4, dir: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  });

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
