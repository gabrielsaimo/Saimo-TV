/**
 * Eventos: o jogo sob o ponteiro em destaque e fileiras por horário (ao vivo
 * agora, em breve, hoje, amanhã, próximos dias), com selo, logo da liga,
 * escudos, placar e o canal — a mesma tela do Mac e da TV Box. Clicar abre o
 * canal ao vivo. Com a tela aberta, atualiza a cada minuto.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarraTopo } from '../components/BarraTopo';
import { Fileira, Heroi, SemLista, type Destaque } from '../components/Telas';
import { useCanais } from '../hooks/useCanais';
import { useListas } from '../services/listas';
import { acabou, aoVivo, buscarJogos, type Jogo } from '../services/eventos';
import './Eventos.css';

const HORA = 3_600_000;
// Três minutos: a agenda do monitor é cobrada por pedido, e o placar não
// precisa de mais que isso.
const INTERVALO = 180_000;
const GRUPOS = ['Ao vivo agora', 'Começa em breve', 'Hoje mais tarde', 'Amanhã', 'Próximos dias'];

const diaDe = (ms: number) => {
  const d = new Date(ms);
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
};
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

function Escudo({ src, nome }: { src: string; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  if (!src || falhou) return <div className="ev-sem-escudo" aria-hidden="true">{nome.slice(0, 1)}</div>;
  return <img src={src} alt={nome} referrerPolicy="no-referrer" onError={() => setFalhou(true)} />;
}

function CartaoJogo({ jogo, agora, aoAbrir, aoPassar }: {
  jogo: Jogo; agora: number; aoAbrir: () => void; aoPassar: () => void;
}) {
  const vivo = aoVivo(jogo, agora);
  return (
    <button className={`ev-cartao ${vivo ? 'vivo' : ''}`} onClick={aoAbrir} onMouseEnter={aoPassar} onFocus={aoPassar}
      aria-label={`${jogo.casa} x ${jogo.fora}, no canal ${jogo.canal.name}`}>
      <header>
        <span className="ev-liga">
          {jogo.ligaLogo && <img src={jogo.ligaLogo} alt="" referrerPolicy="no-referrer" />}
          {jogo.liga}
        </span>
        {vivo
          ? <em className="ev-selo vivo"><i />AO VIVO{jogo.tempo ? ` ${jogo.tempo}` : ''}</em>
          : <em className="ev-selo">{quando(jogo.inicio, agora)}</em>}
      </header>
      <div className="ev-times">
        <div><Escudo src={jogo.casaLogo} nome={jogo.casa} /><span>{jogo.casa}</span></div>
        <b>{jogo.placar || 'x'}</b>
        <div><Escudo src={jogo.foraLogo} nome={jogo.fora} /><span>{jogo.fora}</span></div>
      </div>
      <footer>
        {jogo.canal.logo && <img src={jogo.canal.logo} alt="" referrerPolicy="no-referrer" />}
        <span>{jogo.canal.name}</span>
      </footer>
    </button>
  );
}

export function Eventos() {
  const navigate = useNavigate();
  const canais = useCanais();
  const { canais: link } = useListas();
  const [jogos, setJogos] = useState<Jogo[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [agora, setAgora] = useState(Date.now);
  const [sob, setSob] = useState<Jogo | null>(null);

  // Canal adulto não entra na agenda.
  const abertos = useMemo(
    () => canais.filter((c) => c.category !== 'Adulto' && c.category !== 'ADULTOS'), [canais]);

  const carregar = useCallback(async () => {
    if (!abertos.length) return;
    const lista = await buscarJogos(abertos).catch(() => null);
    setAgora(Date.now());
    if (lista) { setJogos(lista); setFalhou(false); } else if (!jogos) setFalhou(true);
  }, [abertos, jogos]);

  useEffect(() => {
    const primeira = window.setTimeout(() => void carregar(), 0);
    const id = window.setInterval(() => { if (!document.hidden) void carregar(); }, INTERVALO);
    return () => { window.clearTimeout(primeira); window.clearInterval(id); };
  }, [carregar]);

  const grupos = useMemo(() => {
    const saida: Jogo[][] = GRUPOS.map(() => []);
    (jogos ?? []).filter((j) => !acabou(j, agora))
      .sort((a, b) => a.inicio - b.inicio)
      .forEach((j) => saida[grupoDe(j, agora)].push(j));
    return saida;
  }, [jogos, agora]);

  const primeiro = grupos.flat()[0] ?? null;
  const destaque: Destaque | null = useMemo(() => {
    const j = sob ?? primeiro;
    if (!j) return null;
    return {
      titulo: `${j.casa} x ${j.fora}`,
      selos: [j.liga, aoVivo(j, agora) ? `AO VIVO${j.tempo ? ` ${j.tempo}` : ''}` : quando(j.inicio, agora), j.canal.name],
      sinopse: j.placar ? `Placar: ${j.placar}` : undefined,
    };
  }, [sob, primeiro, agora]);

  const total = grupos.reduce((n, g) => n + g.length, 0);

  return (
    <div className="tela tela-com-barra">
      <BarraTopo />
      <Heroi item={destaque} />
      {!link && <SemLista tipo="eventos" />}
      {link && jogos === null && !falhou && <p className="tela-vazio">Buscando os jogos…</p>}
      {falhou && (
        <div className="tela-vazio"><h2>Não deu para carregar os jogos</h2>
          <p>Confira a conexão; a tela tenta de novo sozinha a cada minuto.</p></div>
      )}
      {jogos !== null && total === 0 && (
        <div className="tela-vazio"><h2>Nenhum jogo agora</h2>
          <p>Só aparecem jogos que passam em algum canal da lista.</p></div>
      )}
      {GRUPOS.map((nome, i) => grupos[i].length > 0 && (
        <Fileira key={nome} titulo={nome}>
          {grupos[i].map((j) => (
            <CartaoJogo key={`${j.casa}${j.fora}${j.inicio}${j.canal.id}`} jogo={j} agora={agora}
              aoAbrir={() => navigate(`/tv/${j.canal.id}`)} aoPassar={() => setSob(j)} />
          ))}
        </Fileira>
      ))}
    </div>
  );
}
