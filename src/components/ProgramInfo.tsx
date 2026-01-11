import { useState, useEffect, memo, useCallback } from 'react';
import type { Channel } from '../types/channel';
import type { CurrentProgram, Program } from '../types/epg';
import { getCurrentProgram, getChannelEPG, fetchRealEPG, onEPGUpdate, getCurrentProgramAsync } from '../services/epgService';
import './ProgramInfo.css';

// Funções auxiliares de formatação
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatDuration = (start: Date, end: Date): string => {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
};

interface ProgramInfoProps {
  channel: Channel;
  isVisible: boolean;
  onOpenGuide: () => void;
}

export const ProgramInfo = memo(function ProgramInfo({ 
  channel, 
  isVisible,
  onOpenGuide 
}: ProgramInfoProps) {
  const [currentProgram, setCurrentProgram] = useState<CurrentProgram | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, forceUpdate] = useState(0);

  // Atualiza dados quando EPG é carregado
  const updateProgramData = useCallback(() => {
    if (!channel) return;
    
    const program = getCurrentProgram(channel.id);
    setCurrentProgram(program);
    
    if (isExpanded) {
      const epg = getChannelEPG(channel.id);
      const now = new Date();
      const upcoming = epg.programs.filter((p: Program) => p.startTime > now).slice(0, 5);
      setUpcomingPrograms(upcoming);
    }
  }, [channel, isExpanded]);

  // Inicializa e registra listener para atualizações de EPG
  useEffect(() => {
    fetchRealEPG();
    
    // Listener que atualiza quando EPG de qualquer canal é carregado
    const unsubscribe = onEPGUpdate((channelId: string) => {
      if (channel && channelId === channel.id) {
        console.log(`[ProgramInfo] EPG atualizado para ${channelId}`);
        updateProgramData();
        setIsLoading(false);
        forceUpdate(n => n + 1);
      }
    });
    
    return () => unsubscribe();
  }, [channel, updateProgramData]);

  // Busca EPG quando canal muda
  useEffect(() => {
    if (!channel) return;
    
    setIsLoading(true);
    
    // Busca assíncrona
    getCurrentProgramAsync(channel.id).then((program: CurrentProgram | null) => {
      setCurrentProgram(program);
      setIsLoading(false);
    });

    // Também tenta sync caso já esteja em cache
    updateProgramData();
    
    // Atualiza a cada 30 segundos
    const interval = setInterval(updateProgramData, 30000);
    return () => clearInterval(interval);
  }, [channel, updateProgramData]);

  // Atualiza programas futuros quando expande
  useEffect(() => {
    if (isExpanded && channel) {
      const epg = getChannelEPG(channel.id);
      const now = new Date();
      const upcoming = epg.programs.filter((p: Program) => p.startTime > now).slice(0, 5);
      setUpcomingPrograms(upcoming);
    }
  }, [isExpanded, channel]);

  // Mostra loading ou ao vivo se não tiver programa
  if (!currentProgram?.current) {
    return (
      <div className={`program-info ${isVisible ? 'visible' : ''}`}>
        <div className="program-content">
          <div className="current-program">
            <div className="program-now-badge">
              <span className="live-dot" />
              {isLoading ? 'CARREGANDO...' : 'AO VIVO'}
            </div>
            <div className="program-details">
              <h3 className="program-title">
                {isLoading ? 'Buscando programação...' : 'Transmissão ao vivo'}
              </h3>
              <p className="program-description">
                {isLoading ? 'Aguarde...' : 'Sem informação de programação'}
              </p>
            </div>
          </div>
          
          <div className="program-actions">
            <button 
              className="program-btn guide-btn"
              onClick={onOpenGuide}
              title="Guia de programação"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M3 10h18M9 4v18" />
              </svg>
              <span>Guia</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { current, next, progress } = currentProgram;

  return (
    <div className={`program-info ${isVisible ? 'visible' : ''} ${isExpanded ? 'expanded' : ''}`}>
      {/* Barra de progresso do programa */}
      <div className="program-progress-bar">
        <div className="program-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="program-content">
        {/* Programa atual */}
        <div className="current-program">
          <div className="program-now-badge">
            <span className="live-dot" />
            AGORA
          </div>
          
          <div className="program-details">
            <h3 className="program-title">{current.title}</h3>
            <div className="program-meta">
              <span className="program-time">
                {formatTime(current.startTime)} - {formatTime(current.endTime)}
              </span>
              <span className="program-duration">
                {formatDuration(current.startTime, current.endTime)}
              </span>
              {current.category && (
                <span className="program-category">{current.category}</span>
              )}
              {current.rating && (
                <span className={`program-rating rating-${current.rating}`}>
                  {current.rating}
                </span>
              )}
            </div>
            {current.description && (
              <p className="program-description">{current.description}</p>
            )}
          </div>
        </div>

        {/* Próximo programa */}
        {next && (
          <div className="next-program">
            <div className="program-next-badge">A SEGUIR</div>
            <div className="program-details">
              <h4 className="program-title-small">{next.title}</h4>
              <span className="program-time-small">
                {formatTime(next.startTime)}
              </span>
            </div>
          </div>
        )}

        {/* Botões de ação */}
        <div className="program-actions">
          <button 
            className="program-btn expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Recolher' : 'Ver mais'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isExpanded ? (
                <path d="M18 15l-6-6-6 6" />
              ) : (
                <path d="M6 9l6 6 6-6" />
              )}
            </svg>
          </button>
          
          <button 
            className="program-btn guide-btn"
            onClick={onOpenGuide}
            title="Guia de programação"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18M9 4v18" />
            </svg>
            <span>Guia</span>
          </button>
        </div>
      </div>

      {/* Lista expandida de programas */}
      {isExpanded && (
        <div className="upcoming-programs">
          <h4 className="upcoming-title">Próximos Programas</h4>
          <div className="upcoming-list">
            {upcomingPrograms.slice(1).map((program) => (
              <div key={program.id} className="upcoming-item">
                <span className="upcoming-time">{formatTime(program.startTime)}</span>
                <div className="upcoming-info">
                  <span className="upcoming-name">{program.title}</span>
                  {program.category && (
                    <span className="upcoming-category">{program.category}</span>
                  )}
                </div>
                <span className="upcoming-duration">
                  {formatDuration(program.startTime, program.endTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
