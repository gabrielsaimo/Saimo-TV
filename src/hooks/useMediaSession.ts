import { useEffect } from 'react';

/**
 * Título, capa e botões do vídeo nos controles do sistema: a tela de bloqueio
 * do celular, a notificação de mídia do Android, as teclas de mídia do
 * teclado e o controle do fone Bluetooth.
 */
export function useMediaSession(opcoes: {
  titulo?: string;
  subtitulo?: string;
  capa?: string;
  aoTocar?: () => void;
  aoPausar?: () => void;
  aoVoltar?: () => void;
  aoAvancar?: () => void;
  aoProximo?: () => void;
  aoAnterior?: () => void;
}) {
  const { titulo, subtitulo, capa, aoTocar, aoPausar, aoVoltar, aoAvancar, aoProximo, aoAnterior } = opcoes;
  useEffect(() => {
    if (!('mediaSession' in navigator) || !titulo) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({
      title: titulo,
      artist: subtitulo ?? 'Saimo TV',
      artwork: capa ? [{ src: capa, sizes: '512x512' }] : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
    const acoes: [MediaSessionAction, (() => void) | undefined][] = [
      ['play', aoTocar], ['pause', aoPausar], ['seekbackward', aoVoltar], ['seekforward', aoAvancar],
      ['nexttrack', aoProximo], ['previoustrack', aoAnterior],
    ];
    for (const [acao, fn] of acoes) {
      try { ms.setActionHandler(acao, fn ?? null); } catch { /* ação não suportada */ }
    }
    return () => {
      for (const [acao] of acoes) {
        try { ms.setActionHandler(acao, null); } catch { /* idem */ }
      }
    };
  }, [titulo, subtitulo, capa, aoTocar, aoPausar, aoVoltar, aoAvancar, aoProximo, aoAnterior]);
}
