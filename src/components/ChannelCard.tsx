import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentProgram, onEPGUpdate } from '../services/epgService';
import './ChannelCard.css';

interface ChannelCardProps {
  id: string;
  name: string;
  category?: string;
  logo?: string;
  channelNumber?: number;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

type ImageState = 'loading' | 'loaded' | 'error';

export const ChannelCard = memo(function ChannelCard({
  id,
  name,
  category,
  logo,
  channelNumber,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: ChannelCardProps) {
  const [imageState, setImageState] = useState<ImageState>(logo ? 'loading' : 'error');
  const [isFocused, setIsFocused] = useState(false);
  const [showSuccessIndicator, setShowSuccessIndicator] = useState(false);
  const prevLogoRef = useRef<string | undefined>(logo);
  const [agora, setAgora] = useState<string | null>(() => getCurrentProgram(id)?.current?.title ?? null);

  /*
   * O que está passando agora, igual ao app e ao Mac. Reage a três coisas: o
   * guia chegou (listener), o programa acabou e o próximo começou (relógio de
   * minuto em minuto) e o cartão virou de um canal para outro (o id mudou).
   */
  useEffect(() => {
    const atualizar = () => setAgora(getCurrentProgram(id)?.current?.title ?? null);
    atualizar();
    // O evento não recorta por canal aqui: comparar a chave normalizada do
    // guia com este id (que pode ter sufixo de desempate, "-2") custaria mais
    // do que a própria consulta, que já é um Map.get.
    const unsubscribe = onEPGUpdate(atualizar);
    const relogio = window.setInterval(atualizar, 60_000);
    return () => {
      unsubscribe();
      window.clearInterval(relogio);
    };
  }, [id]);

  const initials = name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Detecta mudança de imagem e mostra indicador de sucesso
  useEffect(() => {
    if (prevLogoRef.current !== logo && logo) {
      setImageState('loading');
      if (prevLogoRef.current) {
        setShowSuccessIndicator(true);
        const timer = setTimeout(() => setShowSuccessIndicator(false), 2000);
        return () => clearTimeout(timer);
      }
    }
    prevLogoRef.current = logo;
  }, [logo]);

  const handleImageLoad = () => {
    setImageState('loaded');
  };

  const handleImageError = () => {
    setImageState('error');
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
    // Tecla F para favoritar via D-pad
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      onToggleFavorite(e as unknown as React.MouseEvent);
    }
  }, [onSelect, onToggleFavorite]);

  const isLoading = imageState === 'loading';
  const hasImage = imageState === 'loaded' && logo;

  return (
    <div
      className={`channel-card ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      data-focusable="true"
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {channelNumber && (
        <span className="channel-number">{String(channelNumber).padStart(2, '0')}</span>
      )}
      
      <div className="channel-logo">
        {logo && imageState !== 'error' && (
          <img 
            src={logo} 
            alt={name} 
            className={`channel-logo-img ${hasImage ? 'loaded' : ''} ${isLoading ? 'loading' : ''}`}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
        
        {/* Indicador de carregamento */}
        {isLoading && (
          <div className="channel-loading-overlay">
            <div className="channel-loading-spinner" />
          </div>
        )}

        {/* Indicador de sucesso quando imagem é atualizada */}
        {showSuccessIndicator && hasImage && (
          <div className="channel-success-indicator">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        {/* Fallback para iniciais */}
        {imageState === 'error' && (
          <span className="channel-initials">{initials}</span>
        )}

        {isActive && <div className="live-indicator" />}
      </div>
      
      <div className="channel-info">
        <h3 className="channel-name" title={name}>{name}</h3>
        {agora
          ? <span className="channel-now" title={agora}>{agora}</span>
          : category && <span className="channel-category">{category}</span>}
      </div>
      
      <button
        className={`favorite-btn ${isFavorite ? 'is-favorite' : ''}`}
        onClick={onToggleFavorite}
        aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        tabIndex={-1}
        data-focusable="false"
      >
        <svg
          viewBox="0 0 24 24"
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </button>
    </div>
  );
});
