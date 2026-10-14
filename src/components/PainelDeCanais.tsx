import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import type { Channel } from '../types/channel';
import { categoryOrder } from '../data/channels';
import { ChannelIcon } from './ChannelIcon';
import { getCurrentProgram, onEPGUpdate } from '../services/epgService';
import './PainelDeCanais.css';

interface PainelDeCanaisProps {
  channels: Channel[];
  activeChannelId: string | null;
  favorites: string[];
  isOpen: boolean;
  onClose: () => void;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  onSelectVariant?: (channel: Channel, variantIndex: number) => void;
  onOpenOtherScreen?: (channel: Channel) => void;
  isMultiScreen?: boolean;
}

interface LinhaDeCanalProps {
  channel: Channel;
  numero: number;
  noAr: boolean;
  isFav: boolean;
  onSelect: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, channel: Channel) => void;
}

const LinhaDeCanal = memo(function LinhaDeCanal({
  channel,
  numero,
  noAr,
  isFav,
  onSelect,
  onToggleFav,
  onContextMenu,
}: LinhaDeCanalProps) {
  const [prog, setProg] = useState(() => getCurrentProgram(channel.id));

  useEffect(() => {
    const atualizar = () => setProg(getCurrentProgram(channel.id));
    atualizar();
    const unsub = onEPGUpdate(atualizar);
    return () => unsub();
  }, [channel.id]);

  const current = prog?.current;
  const progress = prog?.progress ?? 0;

  return (
    <div
      className={`painel-linha-canal ${noAr ? 'no-ar' : ''}`}
      onClick={onSelect}
      onContextMenu={(e) => onContextMenu(e, channel)}
      role="button"
      tabIndex={0}
      data-channel-id={channel.id}
    >
      <span className={`painel-canal-numero ${noAr ? 'no-ar' : ''}`}>
        {numero}
      </span>

      <ChannelIcon channel={channel} size={46} />

      <div className="painel-canal-info">
        <span className="painel-canal-nome" title={channel.name}>
          {channel.name}
        </span>
        {current && (
          <>
            <span className="painel-canal-programa" title={current.title}>
              {current.title}
            </span>
            <div className="painel-canal-progresso-trilho">
              <div
                className="painel-canal-progresso-barra"
                style={{ width: `${Math.min(100, Math.max(0, Math.round(progress)))}%` }}
              />
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        className={`painel-btn-estrela ${isFav ? 'favorito' : ''}`}
        onClick={onToggleFav}
        title={isFav ? 'Remover dos favoritos' : 'Favoritar'}
        aria-label="Favorito"
      >
        <svg viewBox="0 0 24 24" fill={isFav ? '#facc15' : 'none'} stroke={isFav ? '#facc15' : 'currentColor'} strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
    </div>
  );
});

export const PainelDeCanais = memo(function PainelDeCanais({
  channels,
  activeChannelId,
  favorites,
  isOpen,
  onClose,
  onSelectChannel,
  onToggleFavorite,
  onSelectVariant,
  onOpenOtherScreen,
  isMultiScreen = false,
}: PainelDeCanaisProps) {
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('Todos');
  const [menuContexto, setMenuContexto] = useState<{ x: number; y: number; channel: Channel } | null>(null);

  const listaRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  // Mapeamento de números 1-indexed dos canais
  const numeros = useMemo(() => {
    const mapa = new Map<string, number>();
    channels.forEach((c, idx) => {
      mapa.set(c.id, idx + 1);
    });
    return mapa;
  }, [channels]);

  const activeChannelIndex = useMemo(() => {
    if (!activeChannelId) return null;
    return numeros.get(activeChannelId) ?? null;
  }, [activeChannelId, numeros]);

  // Fecha no Esc
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Foco no input ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => buscaRef.current?.focus(), 120);
    }
  }, [isOpen]);

  // Scroll até o canal ativo ao abrir
  useEffect(() => {
    if (isOpen && activeChannelId && listaRef.current) {
      setTimeout(() => {
        const el = listaRef.current?.querySelector(`[data-channel-id="${activeChannelId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, [isOpen, activeChannelId]);

  // Fecha menu de contexto ao clicar fora
  useEffect(() => {
    const handleOutsideClick = () => setMenuContexto(null);
    if (menuContexto) {
      window.addEventListener('click', handleOutsideClick);
      return () => window.removeEventListener('click', handleOutsideClick);
    }
  }, [menuContexto]);

  const handleContextMenu = useCallback((e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuContexto({
      x: Math.min(e.clientX, window.innerWidth - 240),
      y: Math.min(e.clientY, window.innerHeight - 200),
      channel,
    });
  }, []);

  // Categorias disponíveis
  const categorias = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    const ordenadas = categoryOrder.filter((cat) => set.has(cat));
    const extras = [...set].filter((cat) => !categoryOrder.includes(cat)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['Todos', 'Favoritos', ...ordenadas, ...extras];
  }, [channels]);

  // Canais filtrados e agrupados
  const canaisFiltrados = useMemo(() => {
    let result = channels;

    if (categoriaAtiva === 'Favoritos') {
      result = result.filter((ch) => favorites.includes(ch.id));
    } else if (categoriaAtiva !== 'Todos') {
      result = result.filter((ch) => ch.category === categoriaAtiva);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase();
      result = result.filter(
        (ch) => ch.name.toLowerCase().includes(q) || ch.category?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [channels, categoriaAtiva, busca, favorites]);

  const grupos = useMemo(() => {
    if (categoriaAtiva !== 'Todos' && categoriaAtiva !== 'Favoritos') {
      return [{ categoria: categoriaAtiva, canais: canaisFiltrados }];
    }
    const mapa = new Map<string, Channel[]>();
    canaisFiltrados.forEach((c) => {
      const cat = c.category || 'Outros';
      const arr = mapa.get(cat) || [];
      arr.push(c);
      mapa.set(cat, arr);
    });

    const out: { categoria: string; canais: Channel[] }[] = [];
    categoryOrder.forEach((cat) => {
      const list = mapa.get(cat);
      if (list && list.length > 0) {
        out.push({ categoria: cat, canais: list });
        mapa.delete(cat);
      }
    });

    const restantes = [...mapa.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    restantes.forEach((cat) => {
      const list = mapa.get(cat);
      if (list && list.length > 0) out.push({ categoria: cat, canais: list });
    });

    return out;
  }, [canaisFiltrados, categoriaAtiva]);

  const handleCategoryClick = (cat: string) => {
    setCategoriaAtiva(cat);
    if (cat === 'Todos' || cat === 'Favoritos') {
      listaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setTimeout(() => {
        const header = listaRef.current?.querySelector(`[data-cat-header="${cat}"]`);
        if (header) {
          header.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="painel-de-canais-container" aria-label="Painel de Canais" onClick={(e) => e.stopPropagation()}>
      {/* Topo do painel */}
      <div className="painel-topo">
        <h2 className="painel-titulo">Canais</h2>
        <div className="painel-topo-direita">
          {activeChannelIndex !== null && (
            <span className="painel-numero-ativo">{activeChannelIndex}</span>
          )}
          <span className="painel-contagem-total">{channels.length}</span>
          <button
            type="button"
            className="painel-btn-fechar"
            onClick={onClose}
            title="Fechar a lista (Esc)"
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Caixa de Busca */}
      <div className="painel-busca-box">
        <svg className="painel-busca-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={buscaRef}
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar canal"
          className="painel-busca-input"
        />
        {busca && (
          <button
            type="button"
            className="painel-busca-limpar"
            onClick={() => { setBusca(''); buscaRef.current?.focus(); }}
            title="Limpar busca"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" opacity="0.3" />
              <path d="m15 9-6 6M9 9l6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Pílulas de Categoria horizontais */}
      <div className="painel-pilulas-scroll">
        {categorias.map((cat) => {
          const ativa = categoriaAtiva === cat;
          return (
            <button
              key={cat}
              type="button"
              className={`painel-pilula ${ativa ? 'ativa' : ''}`}
              onClick={() => handleCategoryClick(cat)}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Lista de Canais com grupos */}
      <div className="painel-lista-rolagem" ref={listaRef}>
        {grupos.length === 0 ? (
          <div className="painel-vazio">Nenhum canal encontrado</div>
        ) : (
          grupos.map((grupo) => (
            <div key={grupo.categoria} className="painel-grupo-secao">
              <div className="painel-grupo-titulo" data-cat-header={grupo.categoria}>
                {grupo.categoria.toUpperCase()}
              </div>
              <div className="painel-grupo-linhas">
                {grupo.canais.map((c) => (
                  <LinhaDeCanal
                    key={c.id}
                    channel={c}
                    numero={numeros.get(c.id) || 0}
                    noAr={c.id === activeChannelId}
                    isFav={favorites.includes(c.id)}
                    onSelect={() => onSelectChannel(c)}
                    onToggleFav={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(c.id);
                    }}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rodapé explicativo */}
      <div className="painel-rodape">
        Clique assiste · botão direito: fontes e favoritos · ⌘↑ ⌘↓ trocam de canal
      </div>

      {/* Menu de Contexto (botão direito) */}
      {menuContexto && (
        <div
          className="painel-menu-contexto"
          style={{ top: menuContexto.y, left: menuContexto.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {menuContexto.channel.sources && menuContexto.channel.sources.length > 1 && (
            <div className="painel-menu-item-com-submenu">
              <div className="painel-menu-item">
                <span>Escolher Fonte</span>
                <span className="painel-menu-seta">›</span>
              </div>
              <div className="painel-submenu">
                {menuContexto.channel.sources.map((src, sIdx) => {
                  let host = '';
                  try { host = new URL(src.url).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
                  const rotulo = [
                    src.name || `Fonte ${sIdx + 1}`,
                    src.quality && src.quality !== 'Qualidade não informada' ? src.quality : null,
                    host,
                  ].filter(Boolean).join(' · ');

                  return (
                    <button
                      key={src.url + sIdx}
                      className="painel-submenu-item"
                      onClick={() => {
                        onSelectVariant?.(menuContexto.channel, sIdx);
                        setMenuContexto(null);
                      }}
                    >
                      {rotulo}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            className="painel-menu-item"
            onClick={() => {
              onToggleFavorite(menuContexto.channel.id);
              setMenuContexto(null);
            }}
          >
            {favorites.includes(menuContexto.channel.id) ? 'Remover dos favoritos' : 'Favoritar'}
          </button>

          {isMultiScreen && onOpenOtherScreen && (
            <button
              className="painel-menu-item"
              onClick={() => {
                onOpenOtherScreen(menuContexto.channel);
                setMenuContexto(null);
              }}
            >
              Abrir na outra tela
            </button>
          )}
        </div>
      )}
    </aside>
  );
});
