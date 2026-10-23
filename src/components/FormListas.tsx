/**
 * Os dois campos de endereço das listas (canais e filmes e séries), com a
 * validação por teste de rede. Serve ao diálogo da primeira abertura e a
 * Ajustes > Listas: mesma normalização, mesmo teste, mesmas mensagens.
 */
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  apagarDadosDa, definirLink, linkCanais, linkFilmes, normalizarEndereco, PADRAO, restaurarPadrao, testarEndereco,
  useListas, type Lista,
} from '../services/listas';
import './Listas.css';

const CAMPOS: { lista: Lista; rotulo: string; ajuda: string }[] = [
  { lista: 'canais', rotulo: 'Canais', ajuda: 'Lista de canais, rádios e guia de programação.' },
  { lista: 'filmes', rotulo: 'Filmes e séries', ajuda: 'Lista de filmes, séries, animes e doramas.' },
];

type Fase =
  | { tipo: 'editando' }
  | { tipo: 'testando' }
  | { tipo: 'erro'; falhas: Lista[]; invalidos: Lista[] };

interface Props {
  /** Chamado depois de salvar (ou de apagar tudo). */
  aoSalvar: () => void;
  /** Mostra "Apagar" ao lado de cada endereço salvo (Ajustes). */
  permitirApagar?: boolean;
  aoApagar?: (lista: Lista) => void;
  aoRestaurar?: (lista: Lista) => void;
  /** Botão extra, ao lado de Salvar: "Agora não" no diálogo da primeira abertura. */
  secundario?: ReactNode;
}

export function FormListas({ aoSalvar, secundario, permitirApagar, aoApagar, aoRestaurar }: Props) {
  const atuais = useListas();
  const [valores, setValores] = useState<Record<Lista, string>>(() => ({ canais: atuais.canais, filmes: atuais.filmes }));
  const [fase, setFase] = useState<Fase>({ tipo: 'editando' });
  const id = useId();
  // A resposta de um teste antigo não pode vencer um clique mais novo.
  const rodada = useRef(0);

  const normalizados = (): Record<Lista, string | null> => ({
    canais: normalizarEndereco(valores.canais),
    filmes: normalizarEndereco(valores.filmes),
  });

  const aplicar = (n: Record<Lista, string | null>) => {
    for (const lista of ['canais', 'filmes'] as const) {
      const novo = n[lista] ?? '';
      const velho = lista === 'canais' ? linkCanais() : linkFilmes();
      if (novo === velho) continue;
      // Endereço trocado ou apagado: o que veio do anterior sai do cache.
      apagarDadosDa(lista);
      definirLink(lista, novo);
    }
    aoSalvar();
  };

  const salvar = async () => {
    const n = normalizados();
    const invalidos = (['canais', 'filmes'] as const).filter((l) => n[l] === null);
    if (invalidos.length) {
      setFase({ tipo: 'erro', falhas: invalidos, invalidos });
      return;
    }
    // Só se testa o que a pessoa mudou: um endereço já salvo não precisa provar de novo.
    const aTestar = (['canais', 'filmes'] as const).filter((l) => n[l] && n[l] !== (l === 'canais' ? linkCanais() : linkFilmes()));
    if (!aTestar.length) { aplicar(n); return; }

    const minha = ++rodada.current;
    setFase({ tipo: 'testando' });
    const resultados = await Promise.all(aTestar.map((l) => testarEndereco(l, n[l] as string)));
    if (minha !== rodada.current) return;
    const falhas = aTestar.filter((_, i) => !resultados[i]);
    if (falhas.length) setFase({ tipo: 'erro', falhas, invalidos: [] });
    else aplicar(n);
  };

  const apagar = (lista: Lista) => {
    rodada.current++;
    apagarDadosDa(lista);
    definirLink(lista, '');
    setValores((atual) => ({ ...atual, [lista]: '' }));
    setFase({ tipo: 'editando' });
    aoApagar?.(lista);
  };

  const restaurar = (lista: Lista) => {
    rodada.current++;
    apagarDadosDa(lista);
    restaurarPadrao(lista);
    setValores((atual) => ({ ...atual, [lista]: PADRAO[lista] }));
    setFase({ tipo: 'editando' });
    aoRestaurar?.(lista);
  };

  const testando = fase.tipo === 'testando';
  const erro = fase.tipo === 'erro' ? fase : null;
  const muda = (lista: Lista, v: string) => {
    setValores((atual) => ({ ...atual, [lista]: v }));
    if (fase.tipo === 'erro') setFase({ tipo: 'editando' });
  };

  return (
    <form className="listas-form" onSubmit={(e) => { e.preventDefault(); void salvar(); }} noValidate>
      {CAMPOS.map((c) => {
        const comErro = !!erro?.falhas.includes(c.lista);
        return (
          <div className="listas-campo" key={c.lista}>
            <div className="listas-rotulo">
              <label htmlFor={`${id}-${c.lista}`}>{c.rotulo}</label>
              <span className="listas-acoes">
                {atuais[c.lista] !== PADRAO[c.lista] && (
                  <button type="button" className="listas-apagar neutro" onClick={() => restaurar(c.lista)} disabled={testando}>Restaurar padrão</button>
                )}
                {permitirApagar && atuais[c.lista] && (
                  <button type="button" className="listas-apagar" onClick={() => apagar(c.lista)} disabled={testando}>Apagar</button>
                )}
              </span>
            </div>
            <input
              id={`${id}-${c.lista}`}
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://…"
              value={valores[c.lista]}
              disabled={testando}
              aria-invalid={comErro}
              aria-describedby={`${id}-${c.lista}-ajuda`}
              onChange={(e) => muda(c.lista, e.target.value)}
              className={comErro ? 'invalido' : ''}
            />
            <small id={`${id}-${c.lista}-ajuda`}>{c.ajuda}</small>
          </div>
        );
      })}

      {erro && (
        <div className="listas-erro" role="alert">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>Não consegui abrir este endereço. Confira o link.</span>
        </div>
      )}

      <div className="listas-botoes">
        {erro ? (
          <>
            <button type="submit" className="listas-botao principal">Tentar de novo</button>
            {!erro.invalidos.length && (
              <button type="button" className="listas-botao" onClick={() => aplicar(normalizados())}>Salvar mesmo assim</button>
            )}
          </>
        ) : (
          <button type="submit" className="listas-botao principal" disabled={testando}>
            {testando ? 'Testando…' : 'Salvar'}
          </button>
        )}
        {secundario}
      </div>
    </form>
  );
}
