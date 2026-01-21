import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, memo, useRef } from 'react';
import './AppHeader.css';

interface AppHeaderProps {
  transparent?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  title?: string;
  isAdultUnlocked?: boolean;
  onUnlockAdult?: () => void;
  onLockAdult?: () => void;
}

export const AppHeader = memo(function AppHeader({ 
  transparent = false,
  showBackButton = false,
  onBack,
  title,
  isAdultUnlocked = false,
  onUnlockAdult,
  onLockAdult
}: AppHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronizar modo adultos ao navegar entre /tv e /movies
  useEffect(() => {
    const handleStorageChange = () => {
      // Quando voltar da outra página, verifica se o estado mudou
      const isCurrentlyAdultMode = localStorage.getItem('adult-mode-global') === 'true';
      // Força re-render ao comparar com prop
      if (isCurrentlyAdultMode !== isAdultUnlocked) {
        // As props vão atualizar quando o contexto mudar
      }
    };

    // Listener para mudanças em outra aba/janela
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isAdultUnlocked]);

  // Detecta scroll para mudar aparência do header
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Header fica sólido após scroll
      setIsScrolled(currentScrollY > 50);
      
      // Hide/show header baseado na direção do scroll
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleLogoClick = () => {
    // Se modo adulto está ativo, um clique desativa
    if (isAdultUnlocked) {
      onLockAdult?.();
      return;
    }

    // Reset timeout se existir
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    const newCount = clickCount + 1;
    setClickCount(newCount);

    // Se chegou a 20 cliques, abre modal de PIN
    if (newCount >= 20 && !isAdultUnlocked) {
      setShowPinModal(true);
      setClickCount(0);
    }

    // Reset contador após 3 segundos sem cliques
    clickTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
    }, 3000);
  };

  const handlePinSubmit = () => {
    if (pin === '0000') {
      onUnlockAdult?.();
      setShowPinModal(false);
      setPin('');
    } else {
      setPin('');
    }
  };

  const isHome = location.pathname === '/';
  const isTV = location.pathname === '/tv';
  const isMovies = location.pathname === '/movies';

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  // Não renderiza header na home
  if (isHome) return null;

  return (
    <>
      <header 
        className={`app-header ${transparent ? 'transparent' : ''} ${isScrolled ? 'scrolled' : ''} ${isVisible ? 'visible' : 'hidden'}`}
      >
        <div className="header-container">
          {/* Logo e Voltar */}
          <div className="header-left">
            {showBackButton ? (
              <button 
                className="header-back-btn" 
                onClick={handleBack}
                data-focusable="true"
                data-focus-key="header-back"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
            ) : (
              <button 
                className="header-logo" 
                onClick={handleLogoClick}
                data-focusable="true"
                data-focus-key="header-logo"
              >
                <div className="logo-icon">
                  <svg viewBox="0 0 32 32" fill="none">
                    <path d="M5 8C5 6.34315 6.34315 5 8 5H24C25.6569 5 27 6.34315 27 8V21C27 22.6569 25.6569 24 24 24H8C6.34315 24 5 22.6569 5 21V8Z" fill="url(#logoGrad)" />
                    <path d="M12 12L21 16L12 20V12Z" fill="white" />
                    <defs>
                      <linearGradient id="logoGrad" x1="5" y1="5" x2="27" y2="24" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#8B5CF6" />
                        <stop offset="1" stopColor="#EC4899" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <span className="logo-text">Saimo<span>TV</span></span>
                {isAdultUnlocked && <span className="adult-badge">+18</span>}
              </button>
            )}

            {title && <h1 className="header-title">{title}</h1>}
          </div>

            {/* Navegação Central */}
          <nav className="header-nav">
          <button 
            className={`nav-link ${isTV ? 'active' : ''}`}
            onClick={() => handleNavigation('/tv')}
            data-focusable="true"
            data-focus-key="nav-tv"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span>TV ao Vivo</span>
          </button>
          
          <button 
            className={`nav-link ${isMovies ? 'active' : ''}`}
            onClick={() => handleNavigation('/movies')}
            data-focusable="true"
            data-focus-key="nav-movies"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="2" />
              <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>
            </svg>
            <span>Filmes & Séries</span>
          </button>
        </nav>

        {/* Ações da Direita */}
        <div className="header-right">
          <button 
            className="header-home-btn" 
            onClick={() => handleNavigation('/')}
            data-focusable="true"
            data-focus-key="nav-home"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    {/* Modal de PIN para adultos */}
    {showPinModal && (
      <div className="pin-modal-backdrop" onClick={() => setShowPinModal(false)}>
        <div className="pin-modal" onClick={e => e.stopPropagation()}>
          <div className="pin-modal-header">
            <div className="pin-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
            </div>
            <h2>Modo Adulto (+18)</h2>
            <p>Digite o PIN para desbloquear</p>
          </div>
          
          <div className="pin-modal-content">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="pin-input"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && pin.length === 4) {
                  handlePinSubmit();
                }
              }}
            />
            
            <div className="pin-hint">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
            </div>
          </div>
          
          <div className="pin-modal-actions">
            <button 
              className="cancel-btn"
              onClick={() => {
                setShowPinModal(false);
                setPin('');
              }}
            >
              Cancelar
            </button>
            <button 
              className="unlock-btn"
              onClick={handlePinSubmit}
              disabled={pin.length !== 4}
            >
              Desbloquear
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
});
