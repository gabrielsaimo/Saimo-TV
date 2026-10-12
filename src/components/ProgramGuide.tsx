/**
 * Guia de programação: uma grade de canais por horário, de uma hora atrás até
 * um dia adiante.
 *
 * A grade é um único elemento rolável nos dois eixos. A coluna de canais e a
 * régua de horários ficam presas com `position: sticky`, então não há rolagem
 * sincronizada por script — era ela que fazia a régua escorregar da grade e a
 * coluna de canais ficar parada enquanto os programas desciam.
 *
 * Só o que está na tela (e uma margem) é desenhado: com trezentos canais e uma
 * grade inteira por dia, a versão anterior montava catorze mil elementos de uma
 * vez e refazia todos a cada passada do mouse.
 */

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { Channel } from '../types/channel';
import type { Program } from '../types/epg';
import {
  getChannelEPG, fetchRealEPG, onEPGUpdate, isEPGReady, firstEndingAfter,
} from '../services/epgService';
import { normalise } from '../utils/nomes';
import { useVoltarFecha } from '../hooks/useVoltarFecha';
import './ProgramGuide.css';

// ============================================================
// MEDIDAS E TEMPO
// ============================================================

const MINUTO = 60_000;
const MEIA_HORA = 30 * MINUTO;
const HORA = 60 * MINUTO;
/** A grade começa uma hora antes de agora (arredondada à meia hora) e vai 25 horas. */
const PASSADO_MS = HORA;
const DURACAO_MS = 25 * HORA;
/** Linhas extras desenhadas acima e abaixo da tela, e a quantização da faixa. */
const LINHAS_MARGEM = 4;
/** Minutos extras desenhados à esquerda e à direita da tela. */
const MINUTOS_MARGEM = 60;

interface Medidas {
  /** Largura da coluna de canais. */
  canal: number;
  linha: number;
  regua: number;
  /** Pixels por minuto. */
  ppm: number;
}

const MEDIDAS_DESKTOP: Medidas = { canal: 208, linha: 64, regua: 48, ppm: 4 };
const MEDIDAS_CELULAR: Medidas = { canal: 104, linha: 60, regua: 46, ppm: 3 };

function medidasDaTela(): Medidas {
  return window.innerWidth <= 640 ? MEDIDAS_CELULAR : MEDIDAS_DESKTOP;
}

const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

function hora(ms: number): string {
  return fmtHora.format(ms);
}

/** Meia-noite local do dia de `ms`, para comparar dias no fuso de quem vê. */
function inicioDoDia(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Hoje", "Amanhã", "Ontem" ou "seg., 13/10". */
function diaRelativo(ms: number, agora: number): string {
  const dias = Math.round((inicioDoDia(ms) - inicioDoDia(agora)) / (24 * HORA));
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  if (dias === -1) return 'Ontem';
  return fmtDia.format(ms);
}

function duracao(p: Program): string {
  const min = Math.round((p.endTime.getTime() - p.startTime.getTime()) / MINUTO);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h}h${String(resto).padStart(2, '0')}` : `${h}h`;
}

function episodio(p: Program): string | null {
  const e = p.episodeInfo;
  if (!e) return null;
  const partes = [e.season !== undefined ? `T${e.season}` : '', e.episode !== undefined ? `E${e.episode}` : ''];
  const texto = partes.filter(Boolean).join(' ');
  return texto || null;
}

/** Faixa desenhada: linhas [r0, r1) e minutos [m0, m1) desde o início da grade. */
interface Faixa { r0: number; r1: number; m0: number; m1: number }

function mesmaFaixa(a: Faixa, b: Faixa): boolean {
  return a.r0 === b.r0 && a.r1 === b.r1 && a.m0 === b.m0 && a.m1 === b.m1;
}

/**
 * A faixa é arredondada para blocos de linhas e de hora: rolar alguns pixels
 * não muda nada e não custa uma renderização.
 */
function calcularFaixa(el: HTMLElement, m: Medidas, total: number): Faixa {
  const { scrollTop, scrollLeft, clientHeight, clientWidth } = el;
  const primeira = Math.floor(scrollTop / m.linha);
  const ultima = Math.ceil((scrollTop + clientHeight) / m.linha);
  const r0 = Math.max(0, Math.floor(primeira / LINHAS_MARGEM) * LINHAS_MARGEM - LINHAS_MARGEM);
  const r1 = Math.min(total, Math.ceil(ultima / LINHAS_MARGEM) * LINHAS_MARGEM + LINHAS_MARGEM);
  const minEsq = scrollLeft / m.ppm;
  const minDir = (scrollLeft + clientWidth - m.canal) / m.ppm;
  const m0 = Math.max(0, Math.floor(minEsq / MINUTOS_MARGEM) * MINUTOS_MARGEM - MINUTOS_MARGEM);
  const m1 = Math.ceil(minDir / MINUTOS_MARGEM) * MINUTOS_MARGEM + MINUTOS_MARGEM;
  return { r0, r1, m0, m1 };
}

// ============================================================
// PEÇAS
// ============================================================

/** Logos que já falharam nesta visita: a linha some e volta ao rolar, e não vale tentar de novo. */
const logosQuebrados = new Set<string>();

function iniciais(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

const LogoCanal = memo(function LogoCanal({ canal }: { canal: Channel }) {
  const [quebrado, setQuebrado] = useState(() => !canal.logo || logosQuebrados.has(canal.logo));
  if (quebrado || !canal.logo) {
    return <span className="eg-logo eg-logo-iniciais" aria-hidden="true">{iniciais(canal.name)}</span>;
  }
  return (
    <img
      className="eg-logo"
      src={canal.logo}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        if (canal.logo) logosQuebrados.add(canal.logo);
        setQuebrado(true);
      }}
    />
  );
});

interface CelulaCanalProps {
  canal: Channel;
  numero: number;
  topo: number;
  ativo: boolean;
  onEscolher: (canal: Channel) => void;
}

const CelulaCanal = memo(function CelulaCanal({ canal, numero, topo, ativo, onEscolher }: CelulaCanalProps) {
  return (
    <button
      type="button"
      className={`eg-canal${ativo ? ' ativo' : ''}`}
      style={{ transform: `translateY(${topo}px)` }}
      onClick={() => onEscolher(canal)}
      title={`Assistir ${canal.name}`}
      data-focusable="true"
      data-focus-key={`guide-channel-${canal.id}`}
    >
      <span className="eg-canal-num">{String(numero).padStart(2, '0')}</span>
      <LogoCanal canal={canal} />
      <span className="eg-canal-nome">{canal.name}</span>
      {ativo && <span className="eg-canal-ativo" aria-label="Assistindo" />}
    </button>
  );
});

interface LinhaProps {
  canal: Channel;
  programas: Program[];
  topo: number;
  inicio: number;
  fim: number;
  /** Janela desenhada, em ms. */
  de: number;
  ate: number;
  ppm: number;
  agora: number;
  pronto: boolean;
  selecionado: string | null;
  onAbrir: (canal: Channel, programa: Program) => void;
}

const LinhaProgramas = memo(function LinhaProgramas({
  canal, programas, topo, inicio, fim, de, ate, ppm, agora, pronto, selecionado, onAbrir,
}: LinhaProps) {
  const px = (ms: number) => ((ms - inicio) / MINUTO) * ppm;
  const blocos: ReactNode[] = [];
  const temNaGrade = programas.length > 0
    && programas[programas.length - 1].endTime.getTime() > inicio
    && programas[0].startTime.getTime() < fim;

  if (temNaGrade) {
    for (let i = firstEndingAfter(programas, de); i < programas.length; i++) {
      const p = programas[i];
      const ini = p.startTime.getTime();
      const fin = p.endTime.getTime();
      if (ini >= ate) break;
      const esquerda = px(Math.max(ini, inicio));
      const largura = px(Math.min(fin, fim)) - esquerda - 2;
      if (largura < 2) continue;
      const noAr = ini <= agora && fin > agora;
      const passou = fin <= agora;
      const progresso = noAr ? ((agora - ini) / (fin - ini)) * 100 : 0;
      const classes = ['eg-prog'];
      if (noAr) classes.push('no-ar');
      if (passou) classes.push('passou');
      // Bloco curto perde primeiro o horário, depois a palavra "ao vivo" (fica o ponto).
      if (largura < 44) classes.push('estreito');
      else if (largura < 84) classes.push('mini');
      else if (largura < 128) classes.push('curto');
      if (selecionado === p.id) classes.push('selecionado');
      blocos.push(
        <button
          key={p.id}
          type="button"
          className={classes.join(' ')}
          style={{ left: esquerda, width: largura }}
          onClick={() => onAbrir(canal, p)}
          data-focusable="true"
          data-focus-key={`program-${p.id}`}
          aria-label={`${p.title}, ${hora(ini)} às ${hora(fin)}${noAr ? ', no ar agora' : ''}`}
        >
          {noAr && <span className="eg-prog-progresso" style={{ width: `${progresso}%` }} />}
          <span className="eg-prog-texto">
            <span className="eg-prog-titulo">{p.title}</span>
            <span className="eg-prog-hora">
              {noAr && <span className="eg-ao-vivo">Ao vivo</span>}
              <span className="eg-prog-intervalo">{hora(ini)} – {hora(fin)}</span>
            </span>
          </span>
        </button>,
      );
    }
  }

  return (
    <div className="eg-linha" style={{ transform: `translateY(${topo}px)` }}>
      {blocos.length > 0 ? blocos : (
        <div className={`eg-vazio${pronto ? '' : ' carregando'}`}>
          <span className="eg-vazio-texto">{pronto ? 'Sem programação' : ''}</span>
        </div>
      )}
    </div>
  );
});

// ============================================================
// DETALHES
// ============================================================

interface DetalhesProps {
  canal: Channel;
  programa: Program;
  agora: number;
  onAssistir: (canal: Channel) => void;
  onFechar: () => void;
}

function Detalhes({ canal, programa, agora, onAssistir, onFechar }: DetalhesProps) {
  const [semImagem, setSemImagem] = useState(false);
  const ini = programa.startTime.getTime();
  const fin = programa.endTime.getTime();
  const noAr = ini <= agora && fin > agora;
  const passou = fin <= agora;
  const ep = episodio(programa);
  const assistirRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    assistirRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="eg-detalhes" role="dialog" aria-label={programa.title} onClick={(e) => e.stopPropagation()}>
      {programa.thumbnail && !semImagem && (
        <img
          className="eg-detalhes-imagem"
          src={programa.thumbnail}
          alt=""
          decoding="async"
          onError={() => setSemImagem(true)}
        />
      )}
      <div className="eg-detalhes-corpo">
        <div className="eg-detalhes-canal">
          <LogoCanal canal={canal} />
          <span>{canal.name}</span>
          <button type="button" className="eg-icone-btn eg-detalhes-fechar" onClick={onFechar} aria-label="Fechar detalhes">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <h3 className="eg-detalhes-titulo">{programa.title}</h3>
        <p className="eg-detalhes-hora">
          {noAr && <span className="eg-ao-vivo">Ao vivo</span>}
          {passou && <span className="eg-tag">Encerrado</span>}
          <span>{diaRelativo(ini, agora)}, {hora(ini)} – {hora(fin)}</span>
          <span className="eg-sep" aria-hidden="true" />
          <span>{duracao(programa)}</span>
        </p>
        {noAr && (
          <div className="eg-detalhes-barra" aria-hidden="true">
            <span style={{ width: `${((agora - ini) / (fin - ini)) * 100}%` }} />
          </div>
        )}
        {(programa.category || ep) && (
          <p className="eg-detalhes-tags">
            {programa.category && <span className="eg-tag">{programa.category}</span>}
            {ep && <span className="eg-tag">{ep}</span>}
          </p>
        )}
        {programa.description
          ? <p className="eg-detalhes-sinopse">{programa.description}</p>
          : <p className="eg-detalhes-sinopse vazia">Sem sinopse para este programa.</p>}
        <button
          ref={assistirRef}
          type="button"
          className="eg-assistir"
          onClick={() => onAssistir(canal)}
          data-focusable="true"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          Assistir {canal.name}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// GUIA
// ============================================================

interface ProgramGuideProps {
  channels: Channel[];
  currentChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const ProgramGuide = memo(function ProgramGuide(props: ProgramGuideProps) {
  // O voltar do celular (e o Esc) fecha o guia, não a página.
  useVoltarFecha(props.isOpen, props.onClose);
  if (!props.isOpen) return null;
  return <GuiaAberto {...props} />;
});

function GuiaAberto({ channels, currentChannel, onSelectChannel, onClose }: ProgramGuideProps) {
  const [medidas, setMedidas] = useState(medidasDaTela);
  const [agora, setAgora] = useState(() => Date.now());
  // A grade fica fixa enquanto o guia está aberto; abrir de novo recomeça de agora.
  const [inicio] = useState(() => Math.floor((Date.now() - PASSADO_MS) / MEIA_HORA) * MEIA_HORA);
  const fim = inicio + DURACAO_MS;
  const [, setVersao] = useState(0);
  const [pronto, setPronto] = useState(isEPGReady);
  const [busca, setBusca] = useState('');
  const [selecao, setSelecao] = useState<{ canal: Channel; programa: Program } | null>(null);
  const [faixa, setFaixa] = useState<Faixa>({ r0: 0, r1: 20, m0: 0, m1: 240 });
  const rolagemRef = useRef<HTMLDivElement>(null);
  const quadroRef = useRef(0);
  const abriuRef = useRef(false);

  const larguraGrade = (DURACAO_MS / MINUTO) * medidas.ppm;

  const lista = useMemo(() => {
    const termo = normalise(busca);
    const numerados = channels.map((canal, i) => ({ canal, numero: i + 1 }));
    if (!termo) return numerados;
    return numerados.filter(({ canal }) => normalise(canal.name).includes(termo));
  }, [channels, busca]);

  // O guia chega por partes: cada lote redesenha só o que está na tela.
  useEffect(() => {
    void fetchRealEPG();
    return onEPGUpdate(() => {
      setVersao((v) => v + 1);
      setPronto(isEPGReady());
    });
  }, []);

  // A linha do "agora" e o programa no ar andam sozinhos.
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(relogio);
  }, []);

  const atualizarFaixa = useCallback(() => {
    const el = rolagemRef.current;
    if (!el) return;
    const nova = calcularFaixa(el, medidas, lista.length);
    setFaixa((atual) => (mesmaFaixa(atual, nova) ? atual : nova));
  }, [medidas, lista.length]);

  useEffect(() => {
    const aoRedimensionar = () => setMedidas(medidasDaTela());
    window.addEventListener('resize', aoRedimensionar);
    const el = rolagemRef.current;
    const observador = el ? new ResizeObserver(() => atualizarFaixa()) : null;
    if (el) observador?.observe(el);
    return () => {
      window.removeEventListener('resize', aoRedimensionar);
      observador?.disconnect();
    };
  }, [atualizarFaixa]);

  const rolarParaAgora = useCallback((suave: boolean) => {
    const el = rolagemRef.current;
    if (!el) return;
    const alvo = ((Date.now() - inicio) / MINUTO) * medidas.ppm - Math.min(30 * medidas.ppm, (el.clientWidth - medidas.canal) / 4);
    el.scrollTo({ left: Math.max(0, alvo), behavior: suave ? 'smooth' : 'auto' });
  }, [inicio, medidas]);

  // Ao abrir: agora na tela e o canal que está tocando à vista.
  // Só na abertura; depois a rolagem é de quem está vendo.
  useLayoutEffect(() => {
    const el = rolagemRef.current;
    if (!el || abriuRef.current) return;
    abriuRef.current = true;
    rolarParaAgora(false);
    const indice = currentChannel ? channels.findIndex((c) => c.id === currentChannel.id) : -1;
    if (indice > 1) el.scrollTop = (indice - 1) * medidas.linha;
    el.focus({ preventScroll: true });
    atualizarFaixa();
  }, [rolarParaAgora, currentChannel, channels, medidas.linha, atualizarFaixa]);

  // A busca volta a lista para o topo.
  useLayoutEffect(() => {
    const el = rolagemRef.current;
    if (!el || !busca) return;
    el.scrollTop = 0;
    atualizarFaixa();
  }, [busca, atualizarFaixa]);

  const aoRolar = useCallback(() => {
    if (quadroRef.current) return;
    quadroRef.current = requestAnimationFrame(() => {
      quadroRef.current = 0;
      atualizarFaixa();
    });
  }, [atualizarFaixa]);

  useEffect(() => () => cancelAnimationFrame(quadroRef.current), []);

  const escolherCanal = useCallback((canal: Channel) => {
    onSelectChannel(canal);
    onClose();
  }, [onSelectChannel, onClose]);

  const abrirPrograma = useCallback((canal: Channel, programa: Program) => {
    setSelecao({ canal, programa });
  }, []);

  const fecharDetalhes = useCallback(() => {
    setSelecao(null);
    // O foco volta para a grade: solto na página, as teclas iriam para o player.
    rolagemRef.current?.focus({ preventScroll: true });
  }, []);
  // Os detalhes são mais uma camada: o voltar do celular fecha eles antes do guia.
  useVoltarFecha(selecao !== null, fecharDetalhes);

  /*
   * Esc fecha a camada de cima — os detalhes, depois o guia. Fica na captura da
   * janela, antes da navegação por controle, que tratava o Esc como "voltar
   * página" e às vezes não fechava nada.
   */
  useEffect(() => {
    const aoEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (selecao) fecharDetalhes();
      else onClose();
    };
    window.addEventListener('keydown', aoEsc, true);
    return () => window.removeEventListener('keydown', aoEsc, true);
  }, [selecao, fecharDetalhes, onClose]);

  /*
   * As teclas ficam no guia: sem isso, o espaço, os números e as setas iam para
   * o player atrás dele e trocavam de canal ou mexiam no volume. O "g" passa,
   * para o mesmo atalho fechar o guia que o abriu.
   */
  const aoTeclar = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const alvo = e.target as HTMLElement;
    const digitando = alvo.tagName === 'INPUT';
    if (!digitando && (e.key === 'g' || e.key === 'G')) return;
    e.stopPropagation();
  }, []);

  // Régua: uma marca a cada meia hora, com o dia onde ele vira.
  const marcas = useMemo(() => {
    const saida: Array<{ ms: number; meiaNoite: boolean; cheia: boolean }> = [];
    for (let ms = inicio; ms < fim; ms += MEIA_HORA) {
      const d = new Date(ms);
      saida.push({ ms, meiaNoite: d.getHours() === 0 && d.getMinutes() === 0, cheia: d.getMinutes() === 0 });
    }
    return saida;
  }, [inicio, fim]);

  const xAgora = ((agora - inicio) / MINUTO) * medidas.ppm;
  const agoraNaGrade = agora >= inicio && agora < fim;
  const de = inicio + faixa.m0 * MINUTO;
  const ate = inicio + faixa.m1 * MINUTO;
  // O dia mostrado no canto acompanha o que está na borda esquerda da grade.
  const diaNaBorda = diaRelativo(inicio + (faixa.m0 + MINUTOS_MARGEM) * MINUTO, agora);

  const visiveis = lista.slice(faixa.r0, faixa.r1);
  const estilo = {
    '--eg-canal': `${medidas.canal}px`,
    '--eg-linha': `${medidas.linha}px`,
    '--eg-regua': `${medidas.regua}px`,
    '--eg-hora': `${60 * medidas.ppm}px`,
  } as CSSProperties;

  return (
    <div className="eg-overlay" onClick={onClose}>
      <div
        className="eg"
        style={estilo}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={aoTeclar}
        role="dialog"
        aria-modal="true"
        aria-label="Guia de programação"
      >
        <header className="eg-topo">
          <div className="eg-titulo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 4v16" />
            </svg>
            <div>
              <h2>Guia de programação</h2>
              <p className="eg-subtitulo">
                {pronto ? `${diaRelativo(agora, agora)}, ${hora(agora)}` : 'Carregando a programação…'}
              </p>
            </div>
          </div>

          <label className="eg-busca">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar canal"
              aria-label="Buscar canal"
              enterKeyHint="search"
            />
            {busca && (
              <button type="button" className="eg-busca-limpar" onClick={() => setBusca('')} aria-label="Limpar busca">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            )}
          </label>

          <div className="eg-acoes">
            <button type="button" className="eg-agora-btn" onClick={() => rolarParaAgora(true)} data-focusable="true" data-focus-key="guide-go-now">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              Agora
            </button>
            <button type="button" className="eg-icone-btn" onClick={onClose} aria-label="Fechar guia" data-focusable="true" data-focus-key="guide-close">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </header>

        <div className="eg-rolagem" ref={rolagemRef} onScroll={aoRolar} tabIndex={-1}>
          <div
            className="eg-quadro"
            style={{ width: medidas.canal + larguraGrade, height: medidas.regua + lista.length * medidas.linha }}
          >
            <div className="eg-regua">
              <div className="eg-canto">{diaNaBorda}</div>
              <div className="eg-marcas" style={{ width: larguraGrade }}>
                {marcas.map(({ ms, meiaNoite, cheia }) => (
                  <span
                    key={ms}
                    className={`eg-marca${cheia ? ' cheia' : ''}${meiaNoite ? ' dia' : ''}`}
                    style={{ left: ((ms - inicio) / MINUTO) * medidas.ppm }}
                  >
                    {meiaNoite ? diaRelativo(ms, agora) : hora(ms)}
                  </span>
                ))}
                {agoraNaGrade && (
                  <span className="eg-agora-rotulo" style={{ left: xAgora }}>{hora(agora)}</span>
                )}
              </div>
            </div>

            <div className="eg-corpo">
              <div className="eg-canais" style={{ height: lista.length * medidas.linha }}>
                {visiveis.map(({ canal, numero }, i) => (
                  <CelulaCanal
                    key={canal.id}
                    canal={canal}
                    numero={numero}
                    topo={(faixa.r0 + i) * medidas.linha}
                    ativo={canal.id === currentChannel?.id}
                    onEscolher={escolherCanal}
                  />
                ))}
              </div>

              <div className="eg-grade" style={{ width: larguraGrade, height: lista.length * medidas.linha }}>
                {visiveis.map(({ canal }, i) => (
                  <LinhaProgramas
                    key={canal.id}
                    canal={canal}
                    programas={getChannelEPG(canal.id).programs}
                    topo={(faixa.r0 + i) * medidas.linha}
                    inicio={inicio}
                    fim={fim}
                    de={de}
                    ate={ate}
                    ppm={medidas.ppm}
                    agora={agora}
                    pronto={pronto}
                    selecionado={selecao?.programa.id ?? null}
                    onAbrir={abrirPrograma}
                  />
                ))}
                {agoraNaGrade && <div className="eg-agora-linha" style={{ left: xAgora }} />}
              </div>
            </div>

            {lista.length === 0 && (
              <p className="eg-nenhum">Nenhum canal encontrado para “{busca}”.</p>
            )}
          </div>
        </div>

        {selecao && (
          <Detalhes
            key={selecao.programa.id}
            canal={selecao.canal}
            programa={selecao.programa}
            agora={agora}
            onAssistir={escolherCanal}
            onFechar={fecharDetalhes}
          />
        )}
      </div>
    </div>
  );
}
