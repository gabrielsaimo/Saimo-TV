import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/dpad-navigation.css'
import App from './App.tsx'
import { iniciar as iniciarTelemetria } from './services/telemetria'
import { migrarUmaVez } from './services/listas'
import { iniciarTv } from './plataforma/tv'

// Antes de qualquer tela: esquece o que as versões anteriores guardaram de listas.
migrarUmaVez()
iniciarTv()
iniciarTelemetria()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Casca do app em cache e o site instalável como app (só no site publicado:
// no app de desktop e em desenvolvimento, nada de service worker).
if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_TV && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
