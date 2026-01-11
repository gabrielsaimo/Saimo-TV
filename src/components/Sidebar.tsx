import { useState, useMemo, memo, useEffect, useRef } from 'react';
import type { Channel } from '../types/channel';
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
          block: 'center',
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

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <svg viewBox="0 0 24 24" fill="none" className="logo-icon">
            <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
          </svg>
          {!isCollapsed && <span className="logo-text">Saimo TV</span>}
        </div>
        <button className="collapse-btn" onClick={onToggleCollapse} aria-label="Toggle sidebar">
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
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
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
            >
              Todos
              <span className="count">{channels.length}</span>
            </button>
            <button
              className={`filter-tab ${filter === 'favorites' ? 'active' : ''}`}
              onClick={() => setFilter('favorites')}
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
          filteredChannels.map((channel) => (
            <div 
              key={channel.id} 
              ref={channel.id === activeChannelId ? activeChannelRef : null}
            >
              <ChannelCard
                id={channel.id}
                name={isCollapsed ? channel.name.slice(0, 2) : channel.name}
                category={isCollapsed ? undefined : channel.category}
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
          ))
        )}
      </div>

      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="shortcuts-hint">
            <span>⌨️ Atalhos: F (tela cheia) • M (mudo) • T (teatro)</span>
          </div>
        </div>
      )}
    </aside>
  );
});
