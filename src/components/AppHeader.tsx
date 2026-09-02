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
          {/* Onde a lista é publicada e onde se pede um canal que falta:
              o mesmo repositório e o mesmo grupo que o aplicativo aponta. */}
          <a
            className="header-link-btn discord"
            href="https://discord.gg/8DKqT3xJvD"
            target="_blank"
            rel="noreferrer noopener"
            title="Comunidade no Discord"
            aria-label="Comunidade no Discord"
            data-focusable="true"
            data-focus-key="header-discord"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3c-.164.293-.355.686-.487.998a18.27 18.27 0 0 0-4.14 0A12.6 12.6 0 0 0 11.437 3a19.74 19.74 0 0 0-3.76 1.369C3.29 10.02 2.24 15.53 2.76 20.96a19.9 19.9 0 0 0 5.99 3.04c.484-.66.915-1.362 1.286-2.1a12.9 12.9 0 0 1-2.025-.973c.17-.124.336-.254.496-.388 3.9 1.79 8.12 1.79 11.973 0 .162.134.328.264.497.388-.647.38-1.325.706-2.03.974.372.737.802 1.439 1.286 2.099a19.86 19.86 0 0 0 5.994-3.04c.6-6.28-1.06-11.74-4.91-16.59ZM9.68 17.65c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.951-2.42 2.157-2.42 1.213 0 2.18 1.096 2.157 2.42 0 1.334-.951 2.42-2.157 2.42Zm7.64 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.951-2.42 2.157-2.42 1.213 0 2.18 1.096 2.157 2.42 0 1.334-.944 2.42-2.157 2.42Z" />
            </svg>
          </a>

          <a
            className="header-link-btn github"
            href="https://github.com/gabrielsaimo/SaimoPlayer"
            target="_blank"
            rel="noreferrer noopener"
            title="Lista de canais no GitHub"
            aria-label="Lista de canais no GitHub"
            data-focusable="true"
            data-focus-key="header-github"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.1c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.15v3.19c0 .31.21.67.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
            </svg>
          </a>

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
