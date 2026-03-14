import { useState, useMemo, memo, useEffect, useRef } from 'react';
import type { Channel } from '../types/channel';
import { categoryOrder } from '../data/channels';
import { ChannelCard } from './ChannelCard';
import './Sidebar.css';

interface SidebarProps {
  channels: Channel[];
  activeChannelId: string | null;
  favorites: string[];
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileView?: boolean;
  isProMode?: boolean;
  isLoadingPro?: boolean;
  proChannelsCount?: number;
  onToggleProMode?: () => void;
}

type FilterType = 'all' | 'favorites';

export const Sidebar = memo(function Sidebar({
  channels,
  activeChannelId,
  favorites,
  onSelectChannel,
  onToggleFavorite,
  isCollapsed,
  onToggleCollapse,
  isMobileView = false,
  isProMode = false,
  isLoadingPro = false,
  proChannelsCount = 0,
  onToggleProMode,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const channelsListRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<HTMLDivElement>(null);

  // Scroll para o canal ativo quando ele mudar
  useEffect(() => {
    if (activeChannelId && activeChannelRef.current && channelsListRef.current) {
      // Pequeno delay para garantir que o DOM foi atualizado
      setTimeout(() => {
        activeChannelRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
    }
  }, [activeChannelId]);

  const filteredChannels = useMemo(() => {
    let result = channels;

    if (filter === 'favorites') {
      result = result.filter((ch) => favorites.includes(ch.id));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (ch) =>
          ch.name.toLowerCase().includes(query) ||
          ch.category?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [channels, favorites, filter, searchQuery]);

  // Agrupa canais por categoria mantendo a ordem definida
  const groupedChannels = useMemo(() => {
    const groups: Record<string, Channel[]> = {};
    
    // Inicializa grupos na ordem correta
    categoryOrder.forEach(cat => {
      groups[cat] = [];
    });
    
    // Distribui canais nos grupos
    filteredChannels.forEach(channel => {
      const category = channel.category || 'Outros';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(channel);
    });
    
    // Coleta categorias extras (ex: PRO) que não estão em categoryOrder
    const extraCategories = Object.keys(groups)
      .filter(cat => !categoryOrder.includes(cat) && groups[cat].length > 0)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    // Remove categorias vazias e retorna como array
    return [...categoryOrder, ...extraCategories]
      .filter(cat => groups[cat] && groups[cat].length > 0)
      .map(cat => ({ category: cat, channels: groups[cat] }));
  }, [filteredChannels]);

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileView ? 'mobile-view' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <svg viewBox="0 0 24 24" fill="none" className="logo-icon">
            <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
          </svg>
          {!isCollapsed && (
            <span className="logo-text">
              Tv Ao Vivo
            </span>
          )}
        </div>
        <button 
          className="collapse-btn" 
          onClick={onToggleCollapse} 
          aria-label="Toggle sidebar"
          data-focusable="true"
          data-focus-key="sidebar-collapse"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isCollapsed ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="search-container">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Buscar canal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              data-focusable="true"
              data-focus-key="search-input"
            />
            {searchQuery && (
              <button 
                className="clear-search" 
                onClick={() => setSearchQuery('')}
                data-focusable="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
              data-focusable="true"
              data-focus-key="filter-all"
            >
              Todos
              <span className="count">{channels.length}</span>
            </button>
            <button
              className={`filter-tab ${filter === 'favorites' ? 'active' : ''}`}
              onClick={() => setFilter('favorites')}
              data-focusable="true"
              data-focus-key="filter-favorites"
            >
              Favoritos
              <span className="count">{favorites.length}</span>
            </button>
          </div>
        </>
      )}

      <div className="channels-list" ref={channelsListRef}>
        {filteredChannels.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p>Nenhum canal encontrado</p>
          </div>
        ) : (
          groupedChannels.map(({ category, channels: categoryChannels }) => (
            <div key={category} className="category-group">
              {!isCollapsed && (
                <div className="category-header">
                  <span className="category-name">{category}</span>
                  <span className="category-count">{categoryChannels.length}</span>
                </div>
              )}
              <div className="category-channels">
                {categoryChannels.map((channel) => (
                  <div 
                    key={channel.id} 
                    ref={channel.id === activeChannelId ? activeChannelRef : null}
                  >
                    <ChannelCard
                      id={channel.id}
                      name={isCollapsed ? channel.name.slice(0, 2) : channel.name}
                      category={isCollapsed ? undefined : undefined}
                      logo={channel.logo}
                      channelNumber={isCollapsed ? undefined : channel.channelNumber}
                      isActive={channel.id === activeChannelId}
                      isFavorite={favorites.includes(channel.id)}
                      onSelect={() => onSelectChannel(channel)}
                      onToggleFavorite={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(channel.id);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        {onToggleProMode && (
          <div className={`pro-mode-toggle ${isCollapsed ? 'collapsed' : ''}`}>
            {isCollapsed ? (
              <button
                className={`pro-toggle-compact ${isProMode ? 'pro-active' : ''}`}
                onClick={onToggleProMode}
                title={isProMode ? 'Modo PRO ativo' : 'Ativar PRO'}
              >
                {isLoadingPro ? '⏳' : isProMode ? 'P' : 'L'}
              </button>
            ) : (
              <div className="pro-toggle-row">
                <span className={`pro-label lite ${!isProMode ? 'active' : ''}`}>Lite</span>
                <button
                  className={`pro-toggle-switch ${isProMode ? 'on' : ''}`}
                  onClick={onToggleProMode}
                  aria-label="Alternar entre Lite e PRO"
                >
                  <span className="pro-toggle-thumb" />
                </button>
                <span className={`pro-label pro ${isProMode ? 'active' : ''}`}>
                  {isLoadingPro ? '⏳' : 'PRO'}
                  {isProMode && proChannelsCount > 0 && (
                    <span className="pro-count">{proChannelsCount}</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
        {!isCollapsed && (
          <div className="shortcuts-hint">
            <span>F: tela cheia • M: mudo • T: teatro</span>
          </div>
        )}
      </div>
    </aside>
  );
});
