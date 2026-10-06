import { useLocation, useNavigate } from 'react-router-dom';
import './NavegacaoMobile.css';

/*
 * A barra de baixo do celular, a mesma em todas as telas — como nos apps.
 *
 * Antes cada tela tinha o seu topo, parte só com ícones, e para ir da TV ao
 * catálogo era preciso achar a casinha, voltar ao início e escolher de novo.
 * Aqui as seções ficam a um toque do polegar, com nome escrito.
 *
 * Some sozinha (pelo CSS) quando um vídeo ocupa a tela inteira.
 */

interface Item {
  caminho: string;
  rotulo: string;
  icone: React.ReactNode;
}

const ICONE = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

const ITENS: Item[] = [
  {
    caminho: '/',
    rotulo: 'Início',
    icone: <svg {...ICONE}><path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" /></svg>,
  },
  {
    caminho: '/tv',
    rotulo: 'Ao vivo',
    icone: <svg {...ICONE}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="m17 2-5 5-5-5" /></svg>,
  },
  {
    caminho: '/movies',
    rotulo: 'Filmes e séries',
    icone: <svg {...ICONE}><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5" /></svg>,
  },
  {
    caminho: '/app',
    rotulo: 'Baixar app',
    icone: <svg {...ICONE}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>,
  },
];

export function NavegacaoMobile() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="navegacao-mobile" aria-label="Seções">
      {ITENS.map((item) => {
        const ativa = item.caminho === '/' ? pathname === '/' : pathname.startsWith(item.caminho);
        return (
          <button
            key={item.caminho}
            type="button"
            className={`navegacao-mobile-item${ativa ? ' ativa' : ''}`}
            aria-current={ativa ? 'page' : undefined}
            onClick={() => {
              if (ativa) {
                // Tocar na seção em que já se está volta ao topo dela.
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
              }
              navigate(item.caminho);
            }}
          >
            {item.icone}
            <span>{item.rotulo}</span>
          </button>
        );
      })}
    </nav>
  );
}
