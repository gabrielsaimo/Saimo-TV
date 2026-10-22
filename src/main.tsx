import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/dpad-navigation.css'
import './styles/webos.css'
import App from './App.tsx'
import { iniciar as iniciarTelemetria } from './services/telemetria'
import { migrarUmaVez } from './services/listas'
import { iniciarTv } from './plataforma/tv'
import { sondarProxy } from './utils/streamUrl'

// Antes de qualquer tela: esquece o que as versões anteriores guardaram de listas.
migrarUmaVez()
iniciarTv()
// O proxy do site pode estar cortado pela cota do dia: confere ao abrir e a cada 10 minutos.
window.setInterval(() => { void sondarProxy() }, 10 * 60 * 1000)
iniciarTelemetria()

// A tela só abre depois da sondagem do proxy (no máximo 1,5 s): o player monta as tentativas de cada
// canal ao abrir, e precisa saber se o proxy do site está de pé ou cortado pela cota do dia.
const sondagem = Promise.race([sondarProxy(), new Promise<void>((ok) => window.setTimeout(ok, 1500))])
void sondagem.finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

// Casca do app em cache e o site instalável como app (só no site publicado:
// no app de desktop e em desenvolvimento, nada de service worker).
if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_TV && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
