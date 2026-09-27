import { useEffect, useState } from 'react';

/**
 * A tecla "?" mostra os atalhos de teclado. Eles existiam (F, M, P, setas,
 * números…), mas nada na tela dizia — ninguém descobria.
 */
const ATALHOS: [string, string][] = [
  ['Espaço', 'Pausar / continuar'],
  ['← →', 'Canal anterior / seguinte (TV) · voltar / avançar (filme)'],
  ['↑ ↓', 'Volume'],
  ['0–9', 'Ir para o canal pelo número'],
  ['F', 'Tela cheia'],
  ['M', 'Sem som'],
  ['P', 'Imagem na imagem'],
  ['T', 'Modo cinema'],
  ['N / B', 'Próximo / episódio anterior'],
  ['E', 'Lista de episódios'],
  ['?', 'Mostrar ou esconder esta ajuda'],
];

export function AtalhosAjuda() {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?') { e.preventDefault(); setAberta((a) => !a); }
      else if (e.key === 'Escape') setAberta(false);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);
  if (!aberta) return null;
  return (
    <div className="atalhos-fundo" onClick={() => setAberta(false)} role="dialog" aria-label="Atalhos de teclado">
      <div className="atalhos-caixa" onClick={(e) => e.stopPropagation()}>
        <h2>Atalhos de teclado</h2>
        <dl>
          {ATALHOS.map(([tecla, acao]) => (
            <div key={tecla} className="atalhos-linha">
              <dt><kbd>{tecla}</kbd></dt>
              <dd>{acao}</dd>
            </div>
          ))}
        </dl>
        <button onClick={() => setAberta(false)}>Fechar</button>
      </div>
    </div>
  );
}
