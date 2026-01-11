import { useState, useEffect, useRef, memo, useCallback } from 'react';
import type { Channel } from '../types/channel';
import type { Program } from '../types/epg';
import { getChannelEPG, fetchRealEPG, onEPGUpdate } from '../services/epgService';
import './ProgramGuide.css';

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

interface ProgramGuideProps {
  channels: Channel[];
  currentChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onClose: () => void;
  isOpen: boolean;
}

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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [, forceUpdate] = useState(0);
  
  // Refs para sincronização de scroll
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const programsGridRef = useRef<HTMLDivElement>(null);
  const channelsColumnRef = useRef<HTMLDivElement>(null);

  // Carrega EPG e registra listener
  useEffect(() => {
    if (isOpen) {
      fetchRealEPG();
      
      // Listener para atualizar quando EPG carrega
      const unsubscribe = onEPGUpdate(() => {
        forceUpdate(n => n + 1);
      });
      
      return () => unsubscribe();
    }
  }, [isOpen]);

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

          <div className="guide-date-nav">
            <button 
              className="date-nav-btn"
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedDate(newDate);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            
            <span className="current-date">
              {selectedDate.toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </span>
            
            <button 
              className="date-nav-btn"
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() + 1);
                setSelectedDate(newDate);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <button className="guide-close-btn" onClick={onClose}>
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
                <div key={index} className="time-slot">
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
            <div 
              className="now-marker" 
              style={{ left: `${getNowPosition()}px` }}
            >
              <div className="now-marker-line" />
              <div className="now-marker-label">AGORA</div>
            </div>

            {/* Linhas de programação por canal */}
            {channels.map((channel) => {
              const epg = getChannelEPG(channel.id);
              const filteredPrograms = filterProgramsForDate(epg.programs);
              
              return (
                <div key={channel.id} className="channel-programs">
                  {filteredPrograms.length === 0 ? (
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
                      
                      return (
                        <div
                          key={program.id}
                          className={`program-block ${isCurrent ? 'current' : ''}`}
                          style={style}
                          onMouseEnter={() => setHoveredProgram(program)}
                          onMouseLeave={() => setHoveredProgram(null)}
                          onClick={() => {
                            onSelectChannel(channel);
                            onClose();
                          }}
                        >
                          <span className="program-block-title">{program.title}</span>
                          <span className="program-block-time">
                            {formatTime(program.startTime)}
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

        {/* Tooltip */}
        {hoveredProgram && (
          <div className="program-tooltip">
            <h4>{hoveredProgram.title}</h4>
            <p className="tooltip-time">
              {formatTime(hoveredProgram.startTime)} - {formatTime(hoveredProgram.endTime)}
            </p>
            {hoveredProgram.category && (
              <span className="tooltip-category">{hoveredProgram.category}</span>
            )}
            {hoveredProgram.description && (
              <p className="tooltip-description">{hoveredProgram.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
