/**
 * A barra do topo, a mesma do app do Mac e da TV Box: o ícone, as abas
 * (Buscar, Início, Ao vivo, Eventos, On Demand, Favoritos, Rádios), a engrenagem
 * dos ajustes e o relógio. A aba aberta é uma cápsula que desliza até a
 * escolhida; Alt+1 a Alt+8 levam a cada uma (⌘ não serve: o navegador a usa).
 *
 * Vinte cliques no ícone abrem o PIN do modo adulto, como no site de sempre.
 */
import { memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdultMode } from '../contexts/adultoContexto';
import { assinar, atual as atualRadio, parar as pararRadio } from '../services/radioPlayer';
import './AppHeader.css';
import './BarraTopo.css';

interface Aba {
  rota: string;
  rotulo: string;
  /** Caminhos que também deixam esta aba acesa. */
  prefixos?: string[];
  icone: React.ReactNode;
  destacada?: boolean;
}

const tr = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ABAS: Aba[] = [
  { rota: '/busca', rotulo: 'Buscar', icone: <svg viewBox="0 0 24 24" {...tr}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg> },
  { rota: '/', rotulo: 'Início', icone: <svg viewBox="0 0 24 24" {...tr}><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /></svg> },
  { rota: '/tv', rotulo: 'Ao vivo', prefixos: ['/tv/'], icone: <svg viewBox="0 0 24 24" {...tr}><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></svg> },
  { rota: '/eventos', rotulo: 'Eventos', icone: <svg viewBox="0 0 24 24" {...tr}><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 5h-5L8 10z" /></svg> },
  { rota: '/movies', rotulo: 'On Demand', icone: <svg viewBox="0 0 24 24" {...tr}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" /></svg> },
  { rota: '/favoritos', rotulo: 'Favoritos', icone: <svg viewBox="0 0 24 24" {...tr}><path d="M12 21s-8-4.9-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.1-8 11-8 11z" /></svg> },
  { rota: '/radios', rotulo: 'Rádios', icone: <svg viewBox="0 0 24 24" {...tr}><rect x="3" y="8" width="18" height="12" rx="2" /><circle cx="15" cy="14" r="3" /><path d="M7 12h3M7 16h3M5 8l11-5" /></svg> },
  {
    rota: '/app',
    rotulo: 'Baixar app',
    destacada: true,
    icone: (
      <svg viewBox="0 0 24 24" {...tr}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
];

/** Alt+1…Alt+9: as oito abas e depois os Ajustes. */
const ATALHOS = [...ABAS.map((a) => a.rota), '/ajustes'];

const relogio = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const ativa = (a: Aba, caminho: string) =>
  caminho === a.rota || (a.prefixos?.some((p) => caminho.startsWith(p)) ?? false);

interface BarraTopoProps {
  /** Se `false`, força a barra a ficar oculta independente do mouse. Se omitido, auto-esconde apenas se estiver em rota com player. */
  visible?: boolean;
  /** Se `true`, auto-esconde quando o mouse se afasta. Se `false`, fica fixa na tela. Se omitido, auto-esconde apenas se estiver em rota de player (/tv). */
  autoHide?: boolean;
}

export const BarraTopo = memo(function BarraTopo({ visible: visibleProp, autoHide }: BarraTopoProps = {}) {
  const { isAdultUnlocked, unlockAdult, lockAdult } = useAdultMode();
  const navigate = useNavigate();
  const radio = useSyncExternalStore(assinar, atualRadio);
  const { pathname } = useLocation();
  const [hora, setHora] = useState(relogio);
  const [cliques, setCliques] = useState(0);
  const [pedePin, setPedePin] = useState(false);
  const [pin, setPin] = useState('');
  const zerar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trilho = useRef<HTMLElement>(null);
  const [capsula, setCapsula] = useState<{ x: number; w: number } | null>(null);

  // O nav bar só auto-esconde quando um player estiver sendo usado (/tv ou autoHide=true).
  // Fora isso (catálogos, início, busca, eventos, favoritos, rádios, etc.), ele fica fixo e visível na tela.
  const deveAutoEsconder = autoHide ?? pathname.startsWith('/tv');

  const [mouseNoTopo, setMouseNoTopo] = useState(() => !deveAutoEsconder);
  const hoverRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!deveAutoEsconder) {
      setMouseNoTopo(true);
      return;
    }

    const limparTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      // Perto do topo: mouse nos primeiros 68px da tela ou sobre a barra
      const perto = (e.clientY >= 0 && e.clientY <= 68) || hoverRef.current;
      if (perto) {
        limparTimer();
        setMouseNoTopo(true);
      } else {
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            setMouseNoTopo(false);
            timerRef.current = null;
          }, 300);
        }
      }
    };

    const onMouseLeaveDoc = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        limparTimer();
        timerRef.current = setTimeout(() => {
          setMouseNoTopo(false);
          timerRef.current = null;
        }, 350);
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeaveDoc);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeaveDoc);
      limparTimer();
    };
  }, [deveAutoEsconder]);

  // Quando o usuário clica em uma aba e a rota muda, se for tela com player, esconde após um breve delay
  useEffect(() => {
    hoverRef.current = false;
    if (deveAutoEsconder) {
      const t = window.setTimeout(() => {
        setMouseNoTopo(false);
      }, 1200);
      return () => window.clearTimeout(t);
    } else {
      setMouseNoTopo(true);
    }
  }, [pathname, deveAutoEsconder]);

  const isVisivel = visibleProp === false ? false : (deveAutoEsconder ? (pedePin || mouseNoTopo) : true);

  useEffect(() => {
    if (!isVisivel) {
      document.body.classList.add('barra-topo-oculta');
    } else {
      document.body.classList.remove('barra-topo-oculta');
    }
    return () => {
      document.body.classList.remove('barra-topo-oculta');
    };
  }, [isVisivel]);

  useEffect(() => {
    const id = window.setInterval(() => setHora(relogio()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  // A cápsula acompanha a aba aberta, inclusive quando a janela muda de tamanho.
  useLayoutEffect(() => {
    const medir = () => {
      const botao = trilho.current?.querySelector<HTMLElement>('[data-ativa="1"]');
      setCapsula(botao ? { x: botao.offsetLeft, w: botao.offsetWidth } : null);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [pathname]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const n = /^Digit([1-9])$/.exec(e.code);
      if (!n) return;
      e.preventDefault();
      navigate(ATALHOS[Number(n[1]) - 1]);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [navigate]);

  const aoClicarLogo = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement)?.blur();
    navigate('/');
    if (isAdultUnlocked) { lockAdult(); return; }
    if (zerar.current) clearTimeout(zerar.current);
    const n = cliques + 1;
    setCliques(n);
    if (n >= 20) { setPedePin(true); setCliques(0); }
    zerar.current = setTimeout(() => setCliques(0), 3000);
  };

  const enviarPin = () => {
    if (pin === '0000') { unlockAdult(); setPedePin(false); }
    setPin('');
  };

  return (
    <>
      <header
        className={`barra-topo ${!isVisivel ? 'oculta' : ''}`}
        role="banner"
        onMouseEnter={() => {
          hoverRef.current = true;
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          setMouseNoTopo(true);
        }}
        onMouseLeave={() => {
          hoverRef.current = false;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setMouseNoTopo(false);
            timerRef.current = null;
          }, 300);
        }}
      >
        <button className="barra-logo" onClick={aoClicarLogo} aria-label="Saimo TV — início">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="barraLogoGrad" x1="5" y1="5" x2="27" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4ff3e0" /><stop offset="1" stopColor="#a35cf0" />
              </linearGradient>
            </defs>
            <path d="M5 8a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8Z" fill="url(#barraLogoGrad)" />
            <path d="M12 12l9 4-9 4V12Z" fill="#fff" />
          </svg>
          <span>Saimo<b>TV</b></span>
          {isAdultUnlocked && <em className="adult-badge">+18</em>}
        </button>

        <nav className="barra-abas" ref={trilho} aria-label="Seções">
          {capsula && <span className="barra-capsula" style={{ transform: `translateX(${capsula.x}px)`, width: capsula.w }} />}
          {ABAS.map((a, i) => (
            <button
              key={a.rota}
              className={`${ativa(a, pathname) ? 'on' : ''} ${a.destacada ? 'destacada' : ''}`}
              data-ativa={ativa(a, pathname) ? '1' : '0'}
              onClick={(e) => {
                navigate(a.rota);
                (e.currentTarget as HTMLElement)?.blur();
              }}
              title={`${a.rotulo} (Alt+${i + 1})`}
            >
              {a.icone}
              <span>{a.rotulo}</span>
              {a.destacada && <span className="barra-aba-dot" aria-hidden="true" />}
            </button>
          ))}
        </nav>

        <div className="barra-direita">
          {radio.radio && radio.estado !== 'erro' && (
            <div className="barra-radio" title={radio.radio.nome}>
              <button
                className="barra-radio-nome"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement)?.blur();
                  navigate('/radios');
                }}
              >
                <span className="equalizador"><i /><i /><i /></span>
                <span>{radio.radio.nome}</span>
              </button>
              <button className="barra-radio-parar" onClick={pararRadio} aria-label="Parar a rádio">■</button>
            </div>
          )}
          <button
            className={`barra-engrenagem ${pathname === '/ajustes' ? 'on' : ''}`}
            onClick={(e) => {
              (e.currentTarget as HTMLElement)?.blur();
              navigate('/ajustes');
            }}
            title="Ajustes (Alt+8)"
            aria-label="Ajustes"
          >
            <svg viewBox="0 0 24 24" {...tr}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </button>
          <time className="barra-relogio">{hora}</time>
        </div>
      </header>

      {pedePin && (
        <div className="pin-modal-backdrop" onClick={() => setPedePin(false)}>
          <div className="pin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pin-modal-header">
              <h2>Modo Adulto (+18)</h2>
              <p>Digite o PIN para desbloquear</p>
            </div>
            <div className="pin-modal-content">
              <input
                type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="••••"
                value={pin} className="pin-input" autoFocus
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => { if (e.key === 'Enter' && pin.length === 4) enviarPin(); }}
              />
            </div>
            <div className="pin-modal-actions">
              <button className="cancel-btn" onClick={() => { setPedePin(false); setPin(''); }}>Cancelar</button>
              <button className="unlock-btn" onClick={enviarPin} disabled={pin.length !== 4}>Desbloquear</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
