import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './EventsModal.css';
import { cachedChannels, fetchChannels } from '../services/catalogService';
import { linkCanais } from '../services/listas';
import { acabou, aoVivo, buscarJogos, type Jogo } from '../services/eventos';
import type { Channel } from '../types/channel';

interface EventsModalProps {
  onClose: () => void;
  onWatch: (channelId: string) => void;
}

const HORA = 3_600_000;
/** O placar anda: com o painel aberto e a aba à vista, busca de novo a cada minuto. */
// Três minutos: a agenda do monitor é cobrada por pedido, e o placar não
// precisa de mais que isso.
const INTERVALO = 180_000;
const GRUPOS = ['Ao vivo agora', 'Começa em breve', 'Hoje mais tarde', 'Amanhã', 'Próximos dias'];

function diaDe(ms: number): number {
  const d = new Date(ms);
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
}

const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "21:30", "amanhã 16:00" ou "sáb 16:00". */
function quando(inicio: number, agora: number): string {
  const d = diaDe(inicio) - diaDe(agora);
  if (d <= 0) return hora(inicio);
  if (d === 1) return `amanhã ${hora(inicio)}`;
  const semana = new Date(inicio).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${semana} ${hora(inicio)}`;
}

function grupoDe(j: Jogo, agora: number): number {
  if (aoVivo(j, agora)) return 0;
  if (j.inicio - agora <= 2 * HORA) return 1;
  const d = diaDe(j.inicio) - diaDe(agora);
  if (d <= 0) return 2;
  return d === 1 ? 3 : 4;
}

/** A lista de canais que o site já tem; sem ela, a publicada; sem endereço ou sem rede, vazia. */
async function carregarCanais(): Promise<Channel[]> {
  if (!linkCanais()) return [];
  const canais = cachedChannels() ?? await fetchChannels() ?? [];
  // Canal adulto não entra na agenda.
  return canais.filter((c) => c.category !== 'Adulto' && c.category !== 'ADULTOS');
}

function Escudo({ src, nome }: { src: string; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  if (!src || falhou) {
    return <div className="team-sem-escudo" aria-hidden="true">{nome.slice(0, 1)}</div>;
  }
  return <img src={src} alt={nome} referrerPolicy="no-referrer" onError={() => setFalhou(true)} />;
}

function CartaoJogo({ jogo, agora, onAbrir }: { jogo: Jogo; agora: number; onAbrir: (j: Jogo) => void }) {
  const vivo = aoVivo(jogo, agora);
  return (
    <button
      type="button"
      className={`event-card ${vivo ? 'is-live' : ''}`}
      onClick={() => onAbrir(jogo)}
      aria-label={`${jogo.casa} x ${jogo.fora}, no canal ${jogo.canal.name}`}
    >
      <div className="event-card-header">
        <div className="event-league">
          {jogo.ligaLogo && <img src={jogo.ligaLogo} alt="" referrerPolicy="no-referrer" />}
          <span>{jogo.liga}</span>
        </div>
        {vivo ? (
          <div className="event-badge live">
            <span className="pulse" />AO VIVO{jogo.tempo ? ` ${jogo.tempo}` : ''}
          </div>
        ) : (
          <div className="event-badge upnext">{quando(jogo.inicio, agora)}</div>
        )}
      </div>

      <div className="event-teams">
        <div className="team home">
          <Escudo src={jogo.casaLogo} nome={jogo.casa} />
          <span>{jogo.casa}</span>
        </div>
        {jogo.placar
          ? <div className={`team-placar ${vivo ? 'vivo' : ''}`}>{jogo.placar}</div>
          : <div className="team-vs">X</div>}
        <div className="team away">
          <Escudo src={jogo.foraLogo} nome={jogo.fora} />
          <span>{jogo.fora}</span>
        </div>
      </div>

      <div className="event-canal">
        {jogo.canal.logo
          ? <img src={jogo.canal.logo} alt="" referrerPolicy="no-referrer" />
          : <span className="event-canal-sem-logo" aria-hidden="true" />}
        <span className="event-canal-nome">{jogo.canal.name}</span>
        <span className="btn-watch">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          Assistir
        </span>
      </div>
    </button>
  );
}

export function EventsModal({ onClose, onWatch }: EventsModalProps) {
  const [jogos, setJogos] = useState<Jogo[] | null>(null);
  const [erro, setErro] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const canaisRef = useRef<Channel[] | null>(null);
  const buscando = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const carregar = useCallback(async () => {
    if (buscando.current) return;
    buscando.current = true;
    try {
      canaisRef.current ??= await carregarCanais();
      // Sem canais não há jogo para casar, e nada é pedido à agenda.
      if (!canaisRef.current.length) {
        setJogos([]);
        setErro(false);
        return;
      }
      const lidos = await buscarJogos(canaisRef.current);
      setAgora(Date.now());
      if (lidos) {
        setJogos(lidos);
        setErro(false);
      } else {
        setErro(true);
      }
    } finally {
      buscando.current = false;
    }
  }, []);

  useEffect(() => {
    void carregar();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void carregar();
    }, INTERVALO);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void carregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [carregar]);

  const { grupos, total, vivos } = useMemo(() => {
    const restantes = (jogos ?? []).filter((j) => !acabou(j, agora)).sort((a, b) => a.inicio - b.inicio);
    const porGrupo: Jogo[][] = GRUPOS.map(() => []);
    for (const j of restantes) porGrupo[grupoDe(j, agora)].push(j);
    return { grupos: porGrupo, total: restantes.length, vivos: porGrupo[0].length };
  }, [jogos, agora]);

  const abrir = useCallback((j: Jogo) => {
    onWatch(j.canal.id);
    onClose();
  }, [onWatch, onClose]);

  const carregando = jogos === null && !erro;

  return (
    <div className="events-modal-overlay" onClick={onClose}>
      <div className="events-modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="events-close-btn" onClick={onClose} aria-label="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        <div className="events-header">
          <h1>Eventos</h1>
          <p>
            {jogos === null
              ? 'Os jogos que passam nos canais da lista, com placar ao vivo.'
              : `${total} ${total === 1 ? 'jogo' : 'jogos'} nos canais da lista · ${vivos} ao vivo`}
          </p>
        </div>

        <div className="events-content">
          {carregando && <div className="events-loading">Carregando a agenda…</div>}
          {erro && jogos === null && (
            <div className="events-error">Não deu para carregar a agenda agora. Tentando de novo em um minuto.</div>
          )}
          {jogos !== null && total === 0 && (
            <div className="events-empty">
              {linkCanais()
                ? 'Nenhum jogo nos canais da lista agora. A agenda se atualiza sozinha.'
                : 'Nenhum jogo. Informe o endereço da lista de canais em Ajustes > Listas.'}
            </div>
          )}

          {grupos.map((lista, i) => lista.length > 0 && (
            <section key={GRUPOS[i]} className="events-grupo">
              <h2 className="events-grupo-titulo">
                {i === 0 && <span className="pulse" />}
                {GRUPOS[i]}
              </h2>
              <div className="events-grid">
                {lista.map((j) => (
                  <CartaoJogo key={`${j.casa}-${j.fora}-${j.inicio}`} jogo={j} agora={agora} onAbrir={abrir} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
