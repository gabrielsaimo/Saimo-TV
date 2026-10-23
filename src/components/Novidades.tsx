/**
 * Novidades: o que entrou e o que mudou em cada rodada da atualização do
 * acervo (11h e 18h), com data, hora e capa. Página só de consulta, sem link
 * em lugar nenhum: o endereço é /novidades.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useListas } from '../services/listas';
import './Novidades.css';

interface Titulo {
  t: string;
  tp: 'f' | 's';
  ano: string;
  capa: string;
  de?: number;
  para?: number;
}

interface Rodada {
  em: string;
  adicionados: Titulo[];
  adicionados_total: number;
  atualizados: Titulo[];
  atualizados_total: number;
}

interface Arquivo {
  capa: string;
  rodadas: Rodada[];
}

function quando(iso: string): { dia: string; hora: string; turno: string } {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const h = d.getHours();
  const turno = h >= 10 && h < 14 ? 'Rodada das 11h' : h >= 17 && h < 21 ? 'Rodada das 18h' : 'Rodada manual';
  return { dia, hora, turno };
}

function Cartao({ item, base }: { item: Titulo; base: string }) {
  const capa = item.capa ? `${base.replace('/w342', '/w185')}${item.capa}` : '';
  return (
    <li className="nov-cartao">
      <div className="nov-capa">
        {capa ? <img src={capa} alt="" loading="lazy" /> : <span aria-hidden="true">{item.t.slice(0, 1)}</span>}
        {item.de !== undefined && item.para !== undefined && (
          <span className="nov-faixa">+{item.para - item.de} ep.</span>
        )}
      </div>
      <div className="nov-nome" title={item.t}>{item.t}</div>
      <div className="nov-tipo">{item.tp === 's' ? 'Série' : 'Filme'}{item.ano ? ` · ${item.ano}` : ''}</div>
    </li>
  );
}

function Lista({ titulo, itens, total, base }: { titulo: string; itens: Titulo[]; total: number; base: string }) {
  if (!total) return null;
  return (
    <section className="nov-secao">
      <h3>{titulo} <span>{total}</span></h3>
      <ul className="nov-grade">{itens.map(i => <Cartao key={`${i.tp}-${i.t}`} item={i} base={base} />)}</ul>
      {total > itens.length && <p className="nov-resto">e mais {total - itens.length}</p>}
    </section>
  );
}

export function Novidades() {
  const [dados, setDados] = useState<Arquivo | null>(null);
  const [erro, setErro] = useState(false);
  const { filmes } = useListas();

  useEffect(() => {
    document.title = 'Novidades · Saimo TV';
    const robo = document.createElement('meta');
    robo.name = 'robots';
    robo.content = 'noindex';
    document.head.appendChild(robo);
    let vivo = true;
    // Sem endereço de filmes não há o que buscar.
    if (!filmes) return () => { vivo = false; robo.remove(); };
    fetch(`${filmes}novidades.json`, { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((d: Arquivo) => vivo && setDados(d))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
      robo.remove();
    };
  }, [filmes]);

  return (
    <main className="nov-pagina">
      <header>
        <h1>Novidades</h1>
        <p>O que entrou e o que mudou em cada rodada da atualização (11h e 18h).</p>
      </header>
      {erro && <p className="nov-aviso">Não deu para carregar agora. Tente de novo em instantes.</p>}
      {!filmes && (
        <p className="nov-aviso">
          Nenhum título. Informe o endereço da lista de filmes e séries em <Link to="/ajustes">Ajustes &gt; Listas</Link>.
        </p>
      )}
      {filmes && !dados && !erro && <p className="nov-aviso">Carregando…</p>}
      {dados?.rodadas.map((r, i) => {
        const q = quando(r.em);
        const vazio = !r.adicionados_total && !r.atualizados_total;
        return (
          <details key={r.em} className="nov-rodada" open={i < 2}>
            <summary>
              <span className="nov-quando">
                <strong>{q.dia}</strong> · {q.hora}
              </span>
              <span className="nov-turno">{q.turno}</span>
              <span className="nov-contagem">
                {vazio ? 'sem novidades' : `${r.adicionados_total} novos · ${r.atualizados_total} com episódios novos`}
              </span>
            </summary>
            <Lista titulo="Adicionados" itens={r.adicionados} total={r.adicionados_total} base={dados.capa} />
            <Lista titulo="Atualizados" itens={r.atualizados} total={r.atualizados_total} base={dados.capa} />
          </details>
        );
      })}
    </main>
  );
}
