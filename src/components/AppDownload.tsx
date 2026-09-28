import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { descreverAparelho } from '../services/telemetria';
import './AppDownload.css';

/**
 * Download dos apps: TV Box, celular e Mac, com o do aparelho já escolhido.
 *
 * Os links usam /releases/latest/download/<arquivo>, que o GitHub redireciona
 * para o release mais novo: a página nunca fica apontando para versão velha.
 * A consulta à API só serve para mostrar número e tamanho; se ela falhar (limite
 * de 60 por hora por IP), os botões continuam funcionando.
 */

const REPO = 'gabrielsaimo/SaimoPlayer';
const LATEST = `https://github.com/${REPO}/releases/latest/download`;

type AppId = 'tvbox' | 'cell' | 'mac' | 'windows';

interface App {
  id: AppId;
  aba: string;
  titulo: string;
  subtitulo: string;
  arquivo: string;
  /** Caminho curto no próprio site (public/_redirects), para digitar na TV. */
  atalho: string;
  botao: string;
  requisitos: string[];
  passos: { titulo: string; texto: string }[];
}

const APPS: App[] = [
  {
    id: 'tvbox',
    aba: 'TV Box',
    titulo: 'Saimo TV para TV Box',
    subtitulo: 'Android TV, Fire TV Stick, Mi Box, Chromecast com Google TV e TV Box Android',
    arquivo: 'SaimoTV.apk',
    atalho: '/tvbox',
    botao: 'Baixar para TV Box',
    requisitos: ['Android 5.0 ou mais novo', 'Controle remoto com setas e OK', 'Conexão com a internet'],
    passos: [
      { titulo: 'Instale o Downloader', texto: 'Na loja do aparelho (Play Store ou Amazon Appstore), procure por “Downloader” e instale.' },
      { titulo: 'Digite o endereço', texto: 'Abra o Downloader e digite o endereço curto mostrado acima. O download começa sozinho.' },
      { titulo: 'Permita a instalação', texto: 'Se o aparelho pedir, ative “Instalar apps desconhecidos” para o Downloader.' },
      { titulo: 'Pronto', texto: 'Instale e abra o Saimo TV. As próximas versões são oferecidas dentro do próprio app.' },
    ],
  },
  {
    id: 'cell',
    aba: 'Celular',
    titulo: 'Saimo TV para celular',
    subtitulo: 'Celulares e tablets Android',
    arquivo: 'SaimoCell.apk',
    atalho: '/celular',
    botao: 'Baixar para celular',
    requisitos: ['Android 7.0 ou mais novo', 'Cerca de 90 MB livres', 'Conexão com a internet'],
    passos: [
      { titulo: 'Baixe o APK', texto: 'Toque no botão acima. O navegador pode avisar que o arquivo é um app: confirme o download.' },
      { titulo: 'Abra o arquivo', texto: 'Toque na notificação de download concluído, ou abra o arquivo pela pasta Downloads.' },
      { titulo: 'Permita a instalação', texto: 'Se o Android pedir, ative “Permitir desta fonte” para o navegador e volte.' },
      { titulo: 'Pronto', texto: 'Instale e abra o Saimo TV. As próximas versões são oferecidas dentro do próprio app.' },
    ],
  },
  {
    id: 'windows',
    aba: 'Windows',
    titulo: 'Saimo TV para Windows',
    subtitulo: 'PC e notebook com Windows 10 ou 11 (64 bits)',
    arquivo: 'SaimoTV-Instalador.msi',
    atalho: '/windows',
    botao: 'Baixar para Windows',
    requisitos: ['Windows 10 ou 11, 64 bits', 'Cerca de 150 MB livres', 'Conexão com a internet'],
    passos: [
      { titulo: 'Baixe o instalador', texto: 'Clique no botão acima. O navegador pode avisar que o arquivo é pouco baixado: mande manter.' },
      { titulo: 'Abra o arquivo baixado', texto: 'Clique duas vezes no “SaimoTV-Instalador.msi”. Ele instala só para o seu usuário, sem pedir senha de administrador.' },
      { titulo: 'Siga o instalador', texto: 'Aceite os termos e clique em Instalar. No fim, o atalho fica no menu Iniciar e na Área de Trabalho.' },
      { titulo: 'Se o Windows avisar', texto: 'Na tela azul do Windows Defender, clique em “Mais informações” e depois em “Executar assim mesmo”: o app não tem assinatura paga da Microsoft.' },
    ],
  },
  {
    id: 'mac',
    aba: 'Mac',
    titulo: 'Saimo TV para Mac',
    subtitulo: 'Macs com chip Apple (M1, M2, M3, M4…)',
    arquivo: 'SaimoTV.dmg',
    atalho: '/mac',
    botao: 'Baixar para Mac',
    requisitos: ['macOS 15 Sequoia ou mais novo', 'Mac com chip Apple (não roda em Mac Intel)', 'Conexão com a internet'],
    passos: [
      { titulo: 'Baixe o DMG', texto: 'Clique no botão acima. O arquivo vai para a pasta Downloads.' },
      { titulo: 'Arraste para Aplicativos', texto: 'Abra o SaimoTV.dmg e arraste o Saimo TV para a pasta Aplicativos, substituindo o antigo se houver.' },
      { titulo: 'Libere na primeira abertura', texto: 'Se o macOS disser que não pode verificar o app, vá em Ajustes do Sistema › Privacidade e Segurança e clique em “Abrir Mesmo Assim”.' },
      { titulo: 'Pronto', texto: 'O app avisa quando sair versão nova e abre o download no navegador.' },
    ],
  },
];

interface Deteccao {
  recomendado: AppId | null;
  aparelho: string;
  aviso: string | null;
}

/** Mac Intel não roda o app; a placa de vídeo que o WebGL anuncia entrega. */
function macIntel(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const placa = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    return /Intel|AMD|Radeon/i.test(placa);
  } catch {
    return false;
  }
}

function detectar(): Deteccao {
  const ua = navigator.userAgent;
  const toques = navigator.maxTouchPoints || 0;
  const { deviceType, model, os } = descreverAparelho(ua, toques);
  const aparelho =
    model.startsWith('Amazon AFT') ? `Fire TV (${model.slice(7)})` :
    model && model !== 'Desconhecido' ? `${model}${os && os !== 'outro' ? ` · ${os}` : ''}` :
    'este aparelho';

  if (/Tizen|Web0S|webOS|NetCast/i.test(ua)) {
    return { recomendado: 'tvbox', aparelho,
      aviso: 'Smart TV Samsung e LG não instalam apps de fora da loja. Assista por este site, ou use um TV Box ou Fire TV Stick ligado na TV.' };
  }
  if (deviceType === 'tv') return { recomendado: 'tvbox', aparelho, aviso: null };
  // Navegador de TV Box Android costuma se anunciar como tablet ("Android 9; X96",
  // sem "Mobile"), mas tablet tem tela de toque e TV Box não.
  if (/Android/.test(ua) && !/Mobile/.test(ua) && toques === 0) {
    return { recomendado: 'tvbox', aparelho, aviso: null };
  }
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && toques > 1)) {
    return { recomendado: null, aparelho,
      aviso: 'Ainda não existe app para iPhone e iPad. Assista por este site: no Safari, toque em Compartilhar › Adicionar à Tela de Início para abrir como app.' };
  }
  if (/Android/.test(ua)) return { recomendado: 'cell', aparelho, aviso: null };
  if (/Windows/.test(ua)) return { recomendado: 'windows', aparelho, aviso: null };
  if (/Macintosh|Mac OS X/.test(ua)) {
    return { recomendado: 'mac', aparelho,
      aviso: macIntel() ? 'Este Mac parece ter processador Intel, e o app só roda em Mac com chip Apple. Neste caso, assista por este site.' : null };
  }
  return { recomendado: null, aparelho,
    aviso: 'Não há app para Linux. No computador, assista por este site mesmo.' };
}

interface Lancamento {
  versao: string;
  tamanhos: Record<string, number>;
}

function megas(bytes?: number): string {
  return bytes ? `${Math.round(bytes / 1024 / 1024)} MB` : '';
}

function Icone({ id }: { id: AppId }) {
  const comum = {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  };
  if (id === 'tvbox') {
    return <svg {...comum}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
  }
  if (id === 'cell') {
    return <svg {...comum}><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>;
  }
  if (id === 'windows') {
    return <svg {...comum}><path d="M3 6.5 10.5 5.2v6.3H3V6.5Zm0 11 7.5 1.3v-6.2H3v4.9Zm9.5 1.6L21 20.5v-8.7h-8.5v7.3ZM12.5 4.9 21 3.5v7.3h-8.5V4.9Z" /></svg>;
  }
  return <svg {...comum}><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M1 20h22" /></svg>;
}

export function AppDownload() {
  const navigate = useNavigate();
  const deteccao = useMemo(() => detectar(), []);
  const [aba, setAba] = useState<AppId>(deteccao.recomendado ?? 'tvbox');
  const [lancamento, setLancamento] = useState<Lancamento | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      signal: controle.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(dados => {
        if (!dados?.tag_name) return;
        const tamanhos: Record<string, number> = {};
        for (const a of dados.assets ?? []) tamanhos[a.name] = a.size;
        setLancamento({ versao: String(dados.tag_name).replace(/^v/i, ''), tamanhos });
      })
      .catch(() => {});
    return () => controle.abort();
  }, []);

  const app = APPS.find(a => a.id === aba)!;
  const linkCurto = `${window.location.host}${app.atalho}`;
  const detalhes = [
    lancamento ? `Versão ${lancamento.versao}` : '',
    megas(lancamento?.tamanhos[app.arquivo]),
  ].filter(Boolean).join(' · ');

  return (
    <div className="app-download-page">
      <div className="download-bg" aria-hidden="true">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
      </div>

      <header className="download-header">
        <button className="back-link" onClick={() => navigate('/')} data-focusable="true" data-focus-key="download-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Voltar</span>
        </button>
      </header>

      <main className="download-main">
        <section className="download-hero">
          <h1>Baixe o Saimo<span>TV</span></h1>
          <p>Grátis e sem cadastro. Escolha onde vai assistir.</p>
          <p className="download-detected">Você está em: <strong>{deteccao.aparelho}</strong></p>
          {deteccao.aviso && <p className="download-aviso">{deteccao.aviso}</p>}
        </section>

        <div className="download-tabs" role="tablist" aria-label="Escolha o aparelho">
          {APPS.map(a => (
            <button
              key={a.id}
              role="tab"
              aria-selected={aba === a.id}
              className={`download-tab ${aba === a.id ? 'active' : ''}`}
              onClick={() => setAba(a.id)}
              data-focusable="true"
              data-focus-key={`download-tab-${a.id}`}
            >
              <span className="download-tab-icon"><Icone id={a.id} /></span>
              <span className="download-tab-label">{a.aba}</span>
              {deteccao.recomendado === a.id && <span className="download-badge">Seu aparelho</span>}
            </button>
          ))}
        </div>

        <section className="download-card" role="tabpanel">
          <div className="download-card-top">
            <div className="download-card-icon"><Icone id={app.id} /></div>
            <div>
              <h2>{app.titulo}</h2>
              <p>{app.subtitulo}</p>
            </div>
          </div>

          <a
            className="download-button"
            href={`${LATEST}/${app.arquivo}`}
            rel="noopener"
            data-focusable="true"
            data-focus-key="download-button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{app.botao}</span>
          </a>
          {detalhes && <p className="download-meta">{detalhes}</p>}

          <p className="download-short">
            {app.id === 'tvbox' ? 'No Downloader, digite:' : 'Para baixar em outro aparelho, abra:'} <code>{linkCurto}</code>
          </p>
          {app.id === 'windows' && (
            <p className="download-short">
              Aplicativo de verdade, não é o site numa janela: a lista, o guia e o vídeo rodam no próprio PC.
            </p>
          )}

          <div className="download-columns">
            <div>
              <h3>Como instalar</h3>
              <ol className="install-steps">
                {app.passos.map((p, i) => (
                  <li key={p.titulo}>
                    <span className="step-number">{i + 1}</span>
                    <div>
                      <strong>{p.titulo}</strong>
                      <p>{p.texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3>Requisitos</h3>
              <ul className="requirements">
                {app.requisitos.map(r => <li key={r}>{r}</li>)}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
