import { useEffect, useRef } from 'react';
import { ehTv } from '../plataforma/tv';
import { useDpad } from '../contexts/dpadContexto';

/**
 * O controle remoto no "Ao vivo" das TVs Samsung/LG.
 *
 * Com o canal em tela cheia os controles somem, e o D-pad não acha nada visível
 * para focar: setas e OK não faziam nada, e o Voltar saía do app. Aqui:
 * - setas cima/baixo trocam de canal (como o CH+/CH− da TV, que também vale);
 * - OK e setas laterais abrem a lista de canais, já com o foco no canal no ar;
 * - Voltar com a lista aberta fecha a lista (vídeo em tela cheia); em tela cheia, volta ao
 *   Início (nunca sai do app daqui).
 */
export function useControleTv(o: {
  ativo: boolean;
  painelAberto: boolean;
  controlesVisiveis: boolean;
  abrirPainel: () => void;
  fecharPainel: () => void;
  proximo: () => void;
  anterior: () => void;
  voltar: () => void;
}) {
  const { registerBackHandler, setFocus } = useDpad();
  const ref = useRef(o);
  useEffect(() => { ref.current = o; });

  // Ao entrar no Ao vivo (lista aberta), o foco já vai para a lista de canais: é o que se
  // quer fazer com o controle ali, e não andar pela barra do topo.
  useEffect(() => {
    if (!ehTv() || !o.painelAberto) return;
    const t = window.setTimeout(() => {
      const atual = document.querySelector('.dpad-focused');
      if (atual?.classList.contains('painel-linha-canal')) return;
      const linha = document.querySelector<HTMLElement>('.painel-linha-canal.no-ar')
        ?? document.querySelector<HTMLElement>('.painel-linha-canal');
      if (linha) setFocus(linha);
    }, 1700);
    return () => window.clearTimeout(t);
  }, [o.painelAberto, setFocus]);

  useEffect(() => {
    if (!ehTv()) return;

    const mostrarControles = () => {
      document.querySelector('.video-player-container')?.dispatchEvent(new CustomEvent('dpad-enter'));
    };
    const abrir = () => {
      ref.current.abrirPainel();
      mostrarControles();
      // O foco vai para o canal no ar (ou o primeiro) assim que a lista aparece.
      window.setTimeout(() => {
        const linha = document.querySelector<HTMLElement>('.painel-linha-canal.no-ar')
          ?? document.querySelector<HTMLElement>('.painel-linha-canal');
        if (linha) setFocus(linha);
      }, 200);
    };

    const aoApertar = (e: KeyboardEvent) => {
      const s = ref.current;
      if (!s.ativo) return;
      const codigo = e.keyCode;
      const consumir = () => { e.preventDefault(); e.stopPropagation(); };
      // CH+/CH−: Samsung 427/428, LG PageUp/PageDown (33/34).
      if (codigo === 427 || codigo === 33) { consumir(); s.proximo(); mostrarControles(); return; }
      if (codigo === 428 || codigo === 34) { consumir(); s.anterior(); mostrarControles(); return; }
      if (s.painelAberto || s.controlesVisiveis) return; // aí o D-pad cuida
      switch (e.key) {
        case 'ArrowUp': consumir(); s.proximo(); mostrarControles(); break;
        case 'ArrowDown': consumir(); s.anterior(); mostrarControles(); break;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Enter': consumir(); abrir(); break;
      }
    };
    window.addEventListener('keydown', aoApertar, true);

    const tirar = registerBackHandler(() => {
      const s = ref.current;
      if (!s.ativo) return false;
      if (s.painelAberto) { s.fecharPainel(); return true; }
      s.voltar();
      return true;
    });
    return () => {
      window.removeEventListener('keydown', aoApertar, true);
      tirar();
    };
  }, [registerBackHandler, setFocus]);
}
