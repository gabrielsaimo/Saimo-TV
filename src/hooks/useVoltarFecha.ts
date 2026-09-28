import { useEffect, useRef } from 'react';

/*
 * O "voltar" do celular (gesto ou botão) fecha a camada de cima — ficha, player,
 * guia — em vez de sair da página, que é o que todo app faz e o que a pessoa
 * espera. Cada camada aberta empilha uma entrada no histórico, no mesmo
 * endereço; o voltar a consome e fecha a camada.
 *
 * Fechar pelo X ou pelo Esc também tira a entrada da pilha, para o voltar
 * seguinte não "fechar" algo que já está fechado. Vários fechamentos no mesmo
 * instante (a ficha com um ator aberto dentro) viram um único history.go.
 */

let pendentes = 0;
let agendado = false;

function recuarDepois() {
  pendentes += 1;
  if (agendado) return;
  agendado = true;
  setTimeout(() => {
    const quantos = pendentes;
    pendentes = 0;
    agendado = false;
    if (quantos > 0) window.history.go(-quantos);
  }, 0);
}

let proximaMarca = 1;

export function useVoltarFecha(aberta: boolean, fechar: () => void): void {
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  });

  useEffect(() => {
    if (!aberta) return;
    const marca = proximaMarca++;
    // O estado do roteador vai junto: ele lê o próprio índice do histórico,
    // e uma entrada sem ele o confundiria no voltar.
    const atual = (window.history.state ?? {}) as Record<string, unknown>;
    window.history.pushState({ ...atual, saimoCamada: marca }, '');
    let fechouPeloVoltar = false;

    const aoVoltar = () => {
      const estado = window.history.state as { saimoCamada?: number } | null;
      // Voltou para antes desta camada: ela fecha.
      if (!estado || estado.saimoCamada === undefined || estado.saimoCamada < marca) {
        fechouPeloVoltar = true;
        fecharRef.current();
      }
    };
    window.addEventListener('popstate', aoVoltar);

    return () => {
      window.removeEventListener('popstate', aoVoltar);
      if (!fechouPeloVoltar) recuarDepois();
    };
  }, [aberta]);
}
