import { useState, useEffect } from 'react';
import './AppDownload.css';

const APK_DOWNLOAD_URL = 'https://github.com/gabrielsaimo/free-tv/releases/download/v13.1/Saimo-TV-V13.1.apk';
const APP_VERSION = '13.1';

export function AppDownload() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleDownload = () => {
    window.open(APK_DOWNLOAD_URL, '_blank');
  };

  return (
    <div className={`app-download-page ${isLoaded ? 'loaded' : ''}`}>
      {/* Background animado */}
      <div className="download-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="noise-overlay" />
      </div>

      {/* Header */}
      <header className="download-header">
        <a href="/" className="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Voltar</span>
        </a>
      </header>

      {/* Main Content */}
      <main className="download-main">
        <div className="app-showcase">
          {/* App Icon */}
          <div className="app-icon-large">
            <svg viewBox="0 0 48 48" fill="none">
              <path d="M8 12C8 9.79086 9.79086 8 12 8H36C38.2091 8 40 9.79086 40 12V32C40 34.2091 38.2091 36 36 36H12C9.79086 36 8 34.2091 8 32V12Z" fill="url(#paint0_linear)" />
              <path d="M18 18L32 24L18 30V18Z" fill="white" />
              <path d="M16 40H32" stroke="url(#paint1_linear)" strokeWidth="3" strokeLinecap="round" />
              <path d="M24 36V40" stroke="url(#paint2_linear)" strokeWidth="3" strokeLinecap="round" />
              <defs>
                <linearGradient id="paint0_linear" x1="8" y1="8" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#EC4899" />
                </linearGradient>
                <linearGradient id="paint1_linear" x1="16" y1="40" x2="32" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#EC4899" />
                </linearGradient>
                <linearGradient id="paint2_linear" x1="24" y1="36" x2="24" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* App Info */}
          <div className="app-info">
            <h1>Saimo<span>TV</span></h1>
            <p className="app-tagline">Entretenimento sem limites</p>
            <span className="app-version">Versão {APP_VERSION}</span>
          </div>

          {/* Download Button */}
          <button className="download-button" onClick={handleDownload}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Baixar APK para Android</span>
          </button>

          {/* Features */}
          <div className="app-features">
            <div className="feature">
              <div className="feature-icon">📺</div>
              <div className="feature-text">
                <h3>TV ao Vivo</h3>
                <p>Centenas de canais</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">🎬</div>
              <div className="feature-text">
                <h3>Filmes & Séries</h3>
                <p>Catálogo completo</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">📱</div>
              <div className="feature-text">
                <h3>Android TV</h3>
                <p>Suporte a controle remoto</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">🆓</div>
              <div className="feature-text">
                <h3>100% Gratuito</h3>
                <p>Sem anúncios</p>
              </div>
            </div>
          </div>
        </div>

        {/* Installation Guide */}
        <div className="install-guide">
          <h2>Como instalar</h2>
          <ol className="install-steps">
            <li>
              <span className="step-number">1</span>
              <div className="step-content">
                <h3>Baixe o APK</h3>
                <p>Clique no botão acima para baixar o arquivo</p>
              </div>
            </li>
            <li>
              <span className="step-number">2</span>
              <div className="step-content">
                <h3>Permita fontes desconhecidas</h3>
                <p>Nas configurações do Android, habilite instalação de apps externos</p>
              </div>
            </li>
            <li>
              <span className="step-number">3</span>
              <div className="step-content">
                <h3>Instale o app</h3>
                <p>Abra o arquivo baixado e siga as instruções</p>
              </div>
            </li>
            <li>
              <span className="step-number">4</span>
              <div className="step-content">
                <h3>Aproveite!</h3>
                <p>Abra o SaimoTV e comece a assistir</p>
              </div>
            </li>
          </ol>
        </div>

        {/* Requirements */}
        <div className="requirements">
          <h2>Requisitos</h2>
          <ul>
            <li>Android 5.0 ou superior</li>
            <li>Conexão com internet</li>
            <li>~50MB de espaço livre</li>
          </ul>
        </div>

        {/* FAQ */}
        <div className="faq-section">
          <h2>Perguntas Frequentes</h2>
          
          <details className="faq-item">
            <summary>É seguro instalar o APK?</summary>
            <p>Sim! O app é open-source e você pode verificar o código no GitHub. Não coletamos dados pessoais.</p>
          </details>
          
          <details className="faq-item">
            <summary>Funciona em Smart TV?</summary>
            <p>Sim! O app foi otimizado para Android TV e pode ser controlado com o controle remoto.</p>
          </details>
          
          <details className="faq-item">
            <summary>Precisa de cadastro?</summary>
            <p>Não! Basta instalar e começar a usar. Sem login, sem assinatura.</p>
          </details>
          
          <details className="faq-item">
            <summary>Como atualizar o app?</summary>
            <p>Volte a esta página e baixe a versão mais recente. Instale por cima da versão atual.</p>
          </details>
        </div>
      </main>

      {/* Footer */}
      <footer className="download-footer">
        <p>© 2025 SaimoTV - Todos os direitos reservados</p>
        <div className="footer-links">
          <a href="https://github.com/gabrielsaimo/free-tv" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
