import { useState, useEffect, useRef, memo, useCallback } from 'react';
import type { Channel } from '../types/channel';
import type { Program } from '../types/epg';
import { getChannelEPG, fetchRealEPG, onEPGUpdate } from '../services/epgService';
import './ProgramGuide.css';

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Cores por categoria de programa
const getCategoryColor = (category: string | undefined): string => {
  if (!category) return '';
  const cat = category.toLowerCase();
  
  if (cat.includes('esport') || cat.includes('sport') || cat.includes('futebol')) return 'category-sports';
  if (cat.includes('filme') || cat.includes('movie') || cat.includes('cinema')) return 'category-movies';
  if (cat.includes('notícia') || cat.includes('news') || cat.includes('jornal')) return 'category-news';
  if (cat.includes('série') || cat.includes('series')) return 'category-series';
  if (cat.includes('infantil') || cat.includes('kids') || cat.includes('desenho')) return 'category-kids';
  if (cat.includes('document') || cat.includes('doc')) return 'category-documentary';
  if (cat.includes('música') || cat.includes('music') || cat.includes('show')) return 'category-music';
  if (cat.includes('reality') || cat.includes('entretenimento')) return 'category-entertainment';
  
  return '';
};

// Calcular progresso do programa atual
const getProgressPercentage = (program: Program, currentTime: Date): number => {
  if (currentTime < program.startTime || currentTime > program.endTime) return 0;
  
  const totalDuration = program.endTime.getTime() - program.startTime.getTime();
  const elapsed = currentTime.getTime() - program.startTime.getTime();
  
  return Math.min(100, (elapsed / totalDuration) * 100);
};

interface ProgramGuideProps {
  channels: Channel[];
  currentChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onClose: () => void;
  isOpen: boolean;
}

// Skeleton Loading Component
const ProgramSkeleton = memo(function ProgramSkeleton() {
  return (
    <div className="program-skeleton">
      <div className="skeleton-block" style={{ width: '180px' }} />
      <div className="skeleton-block" style={{ width: '250px' }} />
      <div className="skeleton-block" style={{ width: '150px' }} />
      <div className="skeleton-block" style={{ width: '200px' }} />
      <div className="skeleton-block" style={{ width: '300px' }} />
    </div>
  );
});

export const ProgramGuide = memo(function ProgramGuide({
  channels,
  currentChannel,
  onSelectChannel,
  onClose,
  isOpen,
}: ProgramGuideProps) {
  // Inicializa com a data de hoje às 0h
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [hoveredProgram, setHoveredProgram] = useState<Program | null>(null);
  const [hoveredChannel, setHoveredChannel] = useState<Channel | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [focusedProgramId, setFocusedProgramId] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  // Refs para sincronização de scroll
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const programsGridRef = useRef<HTMLDivElement>(null);
  const channelsColumnRef = useRef<HTMLDivElement>(null);

  // Carrega EPG e registra listener
  useEffect(() => {
    if (isOpen) {
      // Só mostra loading se não tiver dados ainda
      const hasAnyData = channels.some(ch => getChannelEPG(ch.id).programs.length > 0);
      if (!hasAnyData) {
        setIsLoading(true);
      }
      
      fetchRealEPG().finally(() => {
        setIsLoading(false);
      });
      
      // Listener para atualizar quando EPG carrega (apenas força re-render, NÃO muda loading)
      const unsubscribe = onEPGUpdate(() => {
        forceUpdate(n => n + 1);
        // NÃO setar isLoading aqui - causa o bug de sumir os programas
      });
      
      // Auto-focus no botão de fechar
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
      
      return () => unsubscribe();
    }
  }, [isOpen, channels]);

  // Handler para fechar com Escape
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Atualiza horário a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll para horário atual ao abrir
  useEffect(() => {
    if (isOpen && programsGridRef.current && timelineHeaderRef.current) {
      setTimeout(() => {
        const now = new Date();
        // Calcula posição baseada na hora atual (200px por hora)
        // Subtrai 200px para mostrar um pouco antes do horário atual
        const scrollPosition = Math.max(0, (now.getHours() + now.getMinutes() / 60) * 200 - 200);
        
        if (programsGridRef.current) {
          programsGridRef.current.scrollLeft = scrollPosition;
        }
        if (timelineHeaderRef.current) {
          timelineHeaderRef.current.scrollLeft = scrollPosition;
        }
      }, 150);
    }
  }, [isOpen]);

  // Scroll para o canal atual
  useEffect(() => {
    if (isOpen && currentChannel && channelsColumnRef.current && programsGridRef.current) {
      setTimeout(() => {
        const channelIndex = channels.findIndex(ch => ch.id === currentChannel.id);
        if (channelIndex > 0) {
          const scrollTop = Math.max(0, channelIndex * 60 - 120);
          if (channelsColumnRef.current) channelsColumnRef.current.scrollTop = scrollTop;
          if (programsGridRef.current) programsGridRef.current.scrollTop = scrollTop;
        }
      }, 200);
    }
  }, [isOpen, currentChannel, channels]);

  // Sincronizar scroll horizontal
  const handleGridScroll = useCallback(() => {
    if (programsGridRef.current && timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = programsGridRef.current.scrollLeft;
    }
  }, []);

  // Sincronizar scroll vertical
  const handleVerticalScroll = useCallback(() => {
    if (programsGridRef.current && channelsColumnRef.current) {
      channelsColumnRef.current.scrollTop = programsGridRef.current.scrollTop;
    }
  }, []);

  // Scroll rápido para horário atual
  const scrollToNow = useCallback(() => {
    const now = new Date();
    const scrollPosition = Math.max(0, (now.getHours() + now.getMinutes() / 60) * 200 - 150);
    
    if (programsGridRef.current) {
      programsGridRef.current.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
    if (timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
  }, []);

  // Ir para hoje
  const goToToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
    
    setTimeout(() => scrollToNow(), 150);
  }, [scrollToNow]);

  if (!isOpen) return null;

  // Gerar slots de horário (0h às 23h do dia)
  const timeSlots: Date[] = [];
  for (let i = 0; i < 24; i++) {
    const time = new Date(selectedDate);
    time.setHours(i, 0, 0, 0);
    timeSlots.push(time);
  }

  // Início e fim do período de exibição
  const periodStart = new Date(selectedDate);
  periodStart.setHours(0, 0, 0, 0);
  
  const periodEnd = new Date(selectedDate);
  periodEnd.setHours(23, 59, 59, 999);

  // Verificar se é hoje
  const isToday = new Date().toDateString() === selectedDate.toDateString();

  // Filtrar programas que estão dentro do período de exibição
  const filterProgramsForDate = (programs: Program[]): Program[] => {
    // Filtra apenas programas que têm alguma parte no dia selecionado
    const filtered = programs.filter(program => {
      // Programa termina depois do início do dia E começa antes do fim do dia
      return program.endTime > periodStart && program.startTime < periodEnd;
    });
    
    return filtered;
  };

  // Posição do marcador "AGORA"
  const getNowPosition = () => {
    const now = currentTime;
    // Posição baseada na hora (0h = 0, 24h = 4800px)
    return (now.getHours() + now.getMinutes() / 60) * 200;
  };

  // Estilo do programa (posição e largura) - considera a data corretamente
  const getProgramStyle = (program: Program) => {
    // Hora de início do programa
    const startHour = program.startTime.getHours();
    const startMinutes = program.startTime.getMinutes();
    const left = (startHour + startMinutes / 60) * 200;

    // Duração em horas
    const durationMs = program.endTime.getTime() - program.startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const width = Math.max(80, durationHours * 200);

    return { left: `${left}px`, width: `${width}px` };
  };

  // Verificar se está no ar
  const isCurrentlyAiring = (program: Program) => {
    const now = currentTime;
    return now >= program.startTime && now < program.endTime;
  };

  return (
    <div className="program-guide-overlay" onClick={onClose}>
      <div className="program-guide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="guide-header">
          <div className="guide-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18M9 4v18" />
            </svg>
            <h2>Guia de Programação</h2>
          </div>

          <div className="guide-actions">
            {/* Botão Ir para Agora */}
            <button 
              className="go-to-now-btn"
              onClick={goToToday}
              data-focusable="true"
              data-focus-key="guide-go-now"
              title="Ir para agora"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>AGORA</span>
            </button>

            <div className="guide-date-nav">
              <button 
                className="date-nav-btn"
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() - 1);
                  setSelectedDate(newDate);
                }}
                data-focusable="true"
                data-focus-key="guide-date-prev"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              
              <span className={`current-date ${isToday ? 'is-today' : ''}`}>
                {isToday && <span className="today-badge">HOJE</span>}
                {selectedDate.toLocaleDateString('pt-BR', { 
                  weekday: 'short', 
                  day: 'numeric', 
                  month: 'short' 
                })}
              </span>
              
              <button 
                className="date-nav-btn"
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setSelectedDate(newDate);
                }}
                data-focusable="true"
                data-focus-key="guide-date-next"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <button 
            ref={closeButtonRef}
            className="guide-close-btn" 
            onClick={onClose}
            data-focusable="true"
            data-focus-key="guide-close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Timeline Header */}
        <div className="guide-timeline-header">
          <div className="channel-column-header">Canal</div>
          <div 
            className="timeline-scroll" 
            ref={timelineHeaderRef}
          >
            <div className="timeline-times">
              {timeSlots.map((time, index) => (
                <div key={index} className={`time-slot ${time.getHours() === currentTime.getHours() && isToday ? 'current-hour' : ''}`}>
                  {formatTime(time)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grid de Programação */}
        <div className="guide-content">
          {/* Coluna de Canais */}
          <div 
            className="channels-column" 
            ref={channelsColumnRef}
          >
            {channels.map((channel, index) => (
              <div 
                key={channel.id} 
                className={`guide-channel ${channel.id === currentChannel?.id ? 'active' : ''}`}
                onClick={() => {
                  onSelectChannel(channel);
                  onClose();
                }}
                role="button"
                tabIndex={0}
                data-focusable="true"
                data-focus-key={`guide-channel-${channel.id}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectChannel(channel);
                    onClose();
                  }
                }}
              >
                <span className="guide-channel-number">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {channel.logo && (
                  <img 
                    src={channel.logo} 
                    alt={channel.name} 
                    className="guide-channel-logo"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <span className="guide-channel-name">{channel.name}</span>
                {channel.id === currentChannel?.id && (
                  <span className="watching-badge">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                      <circle cx="12" cy="12" r="5" />
                    </svg>
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Grid de Programas */}
          <div 
            className="programs-grid" 
            ref={programsGridRef}
            onScroll={() => {
              handleGridScroll();
              handleVerticalScroll();
            }}
          >
            {/* Marcador AGORA */}
            {isToday && (
              <div 
                className="now-marker" 
                style={{ 
                  left: `${getNowPosition()}px`,
                  height: `${channels.length * 60}px`
                }}
              >
                <div className="now-marker-line" />
                <div className="now-marker-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  AGORA
                </div>
              </div>
            )}

            {/* Linhas de programação por canal */}
            {channels.map((channel) => {
              const epg = getChannelEPG(channel.id);
              const filteredPrograms = filterProgramsForDate(epg.programs);
              
              return (
                <div key={channel.id} className="channel-programs">
                  {isLoading ? (
                    <ProgramSkeleton />
                  ) : filteredPrograms.length === 0 ? (
                    <div 
                      className="program-block no-epg" 
                      style={{ left: '0px', width: '4800px' }}
                    >
                      <span className="program-block-title">Sem programação disponível</span>
                    </div>
                  ) : (
                    filteredPrograms.map((program: Program) => {
                      const style = getProgramStyle(program);
                      const isCurrent = isCurrentlyAiring(program);
                      const categoryClass = getCategoryColor(program.category);
                      const progress = isCurrent ? getProgressPercentage(program, currentTime) : 0;
                      
                      return (
                        <div
                          key={program.id}
                          className={`program-block ${isCurrent ? 'current' : ''} ${categoryClass} ${focusedProgramId === program.id ? 'focused' : ''}`}
                          style={style}
                          onMouseEnter={() => {
                            setHoveredProgram(program);
                            setHoveredChannel(channel);
                          }}
                          onMouseLeave={() => {
                            setHoveredProgram(null);
                            setHoveredChannel(null);
                          }}
                          onFocus={() => {
                            setFocusedProgramId(program.id);
                            setHoveredProgram(program);
                            setHoveredChannel(channel);
                          }}
                          onBlur={() => {
                            setFocusedProgramId(null);
                          }}
                          onClick={() => {
                            onSelectChannel(channel);
                            onClose();
                          }}
                          tabIndex={0}
                          data-focusable="true"
                          data-focus-key={`program-${program.id}`}
                          role="button"
                          aria-label={`${program.title} - ${formatTime(program.startTime)} às ${formatTime(program.endTime)}${isCurrent ? ' - No ar agora' : ''}`}
                        >
                          {isCurrent && (
                            <div className="program-progress" style={{ width: `${progress}%` }} />
                          )}
                          <span className="program-block-title">{program.title}</span>
                          <span className="program-block-time">
                            {formatTime(program.startTime)}
                            {isCurrent && <span className="live-indicator">● AO VIVO</span>}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tooltip Melhorado */}
        {hoveredProgram && (
          <div className="program-tooltip">
            <div className="tooltip-header">
              <h4>{hoveredProgram.title}</h4>
              {isCurrentlyAiring(hoveredProgram) && (
                <span className="tooltip-live-badge">● AO VIVO</span>
              )}
            </div>
            
            {hoveredChannel && (
              <p className="tooltip-channel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <rect x="2" y="7" width="20" height="15" rx="2" />
                  <path d="M17 2l-5 5-5-5" />
                </svg>
                {hoveredChannel.name}
              </p>
            )}
            
            <p className="tooltip-time">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {formatTime(hoveredProgram.startTime)} - {formatTime(hoveredProgram.endTime)}
              <span className="tooltip-duration">
                ({Math.round((hoveredProgram.endTime.getTime() - hoveredProgram.startTime.getTime()) / 60000)} min)
              </span>
            </p>
            
            {isCurrentlyAiring(hoveredProgram) && (
              <div className="tooltip-progress-bar">
                <div 
                  className="tooltip-progress-fill" 
                  style={{ width: `${getProgressPercentage(hoveredProgram, currentTime)}%` }}
                />
              </div>
            )}
            
            {hoveredProgram.category && (
              <span className={`tooltip-category ${getCategoryColor(hoveredProgram.category)}`}>
                {hoveredProgram.category}
              </span>
            )}
            
            {hoveredProgram.description && (
              <p className="tooltip-description">{hoveredProgram.description}</p>
            )}
          </div>
        )}

        {/* Legenda de Categorias */}
        <div className="category-legend">
          <span className="legend-item category-sports">Esportes</span>
          <span className="legend-item category-movies">Filmes</span>
          <span className="legend-item category-news">Notícias</span>
          <span className="legend-item category-series">Séries</span>
          <span className="legend-item category-kids">Infantil</span>
          <span className="legend-item category-entertainment">Entretenimento</span>
        </div>
      </div>
    </div>
  );
});
