import { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import './StreamTester.css';

interface StreamTesterProps {
  initialUrl?: string;
}

export function StreamTester({ initialUrl = '' }: StreamTesterProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backupVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const backupHlsRef = useRef<Hls | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRefreshingRef = useRef(false);
  
  const [url, setUrl] = useState(initialUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activePlayer, setActivePlayer] = useState<'main' | 'backup'>('main');
  const [stats, setStats] = useState<{
    refreshCount: number;
    playTime: number;
    lastRefresh: Date | null;
  }>({
    refreshCount: 0,
    playTime: 0,
    lastRefresh: null,
  });

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  }, []);

  const destroyAllHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (backupHlsRef.current) {
      backupHlsRef.current.destroy();
      backupHlsRef.current = null;
    }
  }, []);

  // Cria uma instância HLS para um vídeo específico
  const createHlsInstance = useCallback((
    video: HTMLVideoElement,
    streamUrl: string,
    onReady: () => void,
    onError: (error: string) => void
  ): Hls | null => {
    if (!Hls.isSupported()) {
      return null;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
      maxBufferLength: 15,
      maxMaxBufferLength: 30,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 5,
    });

    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      onReady();
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          onError(data.details);
        }
      }
    });

    return hls;
  }, []);

  const loadStream = useCallback((streamUrl: string, isInitial: boolean = true) => {
    if (!streamUrl.trim() || !videoRef.current) return;

    const video = videoRef.current;
    
    if (isInitial) {
      setIsLoading(true);
      setError(null);
      addLog(`Carregando stream: ${streamUrl}`);
      destroyAllHls();
    }
    
    const isMp4 = streamUrl.endsWith('.mp4');

    // Função para iniciar a reprodução
    const playVideo = (videoEl: HTMLVideoElement) => {
      videoEl.play()
        .then(() => {
          setIsPlaying(true);
          addLog('▶️ Reprodução iniciada');
        })
        .catch(() => {
          videoEl.muted = true;
          videoEl.play()
            .then(() => {
              setIsPlaying(true);
              addLog('▶️ Reprodução iniciada (muted)');
            })
            .catch((e) => {
              const errorMessage = e instanceof Error ? e.message : String(e);
              setError('Erro ao iniciar reprodução');
              addLog(`❌ Erro ao iniciar reprodução: ${errorMessage}`);
            });
        });
    };
    
    if (isMp4) {
      addLog('Detectado formato MP4.');
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        addLog('✅ Metadados do MP4 carregados.');
        playVideo(video);
      });
      video.addEventListener('error', () => {
        setIsLoading(false);
        setError('Erro ao carregar vídeo MP4.');
        addLog('❌ Erro ao carregar vídeo MP4.');
      });
      video.load();
    } else if (Hls.isSupported()) {
      addLog('Detectado formato HLS (M3U8).');
      const hls = createHlsInstance(
        video,
        streamUrl,
        () => {
          setIsLoading(false);
          addLog('✅ Manifest HLS carregado com sucesso');
          playVideo(video);
        },
        (errorDetails) => {
          setError(`Erro HLS: ${errorDetails}`);
          setIsLoading(false);
          addLog(`❌ Erro fatal HLS: ${errorDetails}`);
        }
      );

      if (hls) {
        hlsRef.current = hls;
      }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      addLog('Detectado suporte nativo a HLS (Safari).');
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        addLog('✅ Stream carregado (Safari nativo)');
        playVideo(video);
      });
    } else {
      setError('Navegador não suporta HLS');
      addLog('❌ Navegador não suporta HLS');
      setIsLoading(false);
    }
  }, [createHlsInstance, destroyAllHls, addLog]);


  // Refresh invisível usando double-buffering
  const seamlessRefresh = useCallback(() => {
    if (!url.trim() || !backupVideoRef.current || !videoRef.current || isRefreshingRef.current) return;
    
    // Refresh não se aplica a MP4
    if (url.endsWith('.mp4')) {
      addLog('ℹ️ Auto-refresh não aplicável para vídeos MP4.');
      return;
    }

    isRefreshingRef.current = true;
    const currentVideo = activePlayer === 'main' ? videoRef.current : backupVideoRef.current;
    const nextVideo = activePlayer === 'main' ? backupVideoRef.current : videoRef.current;
    
    addLog('🔄 Iniciando refresh invisível em background...');
    
    // Destroi a instância HLS do vídeo de backup anterior
    if (activePlayer === 'main' && backupHlsRef.current) {
      backupHlsRef.current.destroy();
      backupHlsRef.current = null;
    } else if (activePlayer === 'backup' && hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Cria nova instância no vídeo de backup
    const newHls = createHlsInstance(
      nextVideo,
      url,
      () => {
        addLog('✅ Stream de backup pronto');
        
        // Sincroniza volume e mute
        nextVideo.volume = currentVideo.volume;
        nextVideo.muted = currentVideo.muted;
        
        // Inicia reprodução no backup
        nextVideo.play()
          .then(() => {
            // Aguarda um pequeno momento para o buffer encher
            setTimeout(() => {
              // Faz a troca suave
              nextVideo.style.opacity = '1';
              nextVideo.style.zIndex = '2';
              currentVideo.style.opacity = '0';
              currentVideo.style.zIndex = '1';
              
              // Atualiza o player ativo
              setActivePlayer(prev => prev === 'main' ? 'backup' : 'main');
              
              // Atualiza refs
              if (activePlayer === 'main') {
                backupHlsRef.current = newHls;
              } else {
                hlsRef.current = newHls;
              }
              
              setStats(prev => ({
                ...prev,
                refreshCount: prev.refreshCount + 1,
                lastRefresh: new Date(),
              }));
              
              addLog('✨ Troca invisível concluída!');
              isRefreshingRef.current = false;
              
              // Para o vídeo antigo após a troca
              setTimeout(() => {
                currentVideo.pause();
              }, 500);
            }, 300);
          })
          .catch(() => {
            nextVideo.muted = true;
            nextVideo.play().then(() => {
              setTimeout(() => {
                nextVideo.style.opacity = '1';
                nextVideo.style.zIndex = '2';
                currentVideo.style.opacity = '0';
                currentVideo.style.zIndex = '1';
                
                setActivePlayer(prev => prev === 'main' ? 'backup' : 'main');
                
                if (activePlayer === 'main') {
                  backupHlsRef.current = newHls;
                } else {
                  hlsRef.current = newHls;
                }
                
                setStats(prev => ({
                  ...prev,
                  refreshCount: prev.refreshCount + 1,
                  lastRefresh: new Date(),
                }));
                
                addLog('✨ Troca invisível concluída! (muted)');
                isRefreshingRef.current = false;
                
                setTimeout(() => {
                  currentVideo.pause();
                }, 500);
              }, 300);
            }).catch((e) => {
              const errorMessage = e instanceof Error ? e.message : String(e);
              addLog(`❌ Erro no refresh invisível: ${errorMessage}`);
              isRefreshingRef.current = false;
            });
          });
      },
      (errorDetails) => {
        addLog(`❌ Erro no refresh de backup: ${errorDetails}`);
        isRefreshingRef.current = false;
      }
    );

    setCountdown(refreshInterval);
  }, [url, refreshInterval, activePlayer, createHlsInstance, addLog]);

  const refreshStream = useCallback(() => {
    if (!url.trim()) return;
    seamlessRefresh();
  }, [url, seamlessRefresh]);

  // Auto-refresh timer
  useEffect(() => {
    // Desativa para MP4
    const isMp4 = url.endsWith('.mp4');
    if (isPlaying && autoRefresh && refreshInterval > 0 && !isMp4) {
      setCountdown(refreshInterval);
      
      // Countdown timer
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return refreshInterval;
          }
          return prev - 1;
        });
      }, 1000);

      // Refresh timer
      refreshIntervalRef.current = setInterval(() => {
        refreshStream();
      }, refreshInterval * 1000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isPlaying, autoRefresh, refreshInterval, refreshStream, url]);

  // Track play time
  useEffect(() => {
    let playTimeInterval: ReturnType<typeof setInterval> | null = null;
    
    if (isPlaying) {
      playTimeInterval = setInterval(() => {
        setStats(prev => ({
          ...prev,
          playTime: prev.playTime + 1,
        }));
      }, 1000);
    }

    return () => {
      if (playTimeInterval) {
        clearInterval(playTimeInterval);
      }
    };
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyAllHls();
    };
  }, [destroyAllHls]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      setStats({
        refreshCount: 0,
        playTime: 0,
        lastRefresh: null,
      });
      setLogs([]);
      loadStream(url);
    }
  };

  const handleStop = () => {
    destroyAllHls();
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.style.opacity = '1';
      videoRef.current.style.zIndex = '2';
    }
    if (backupVideoRef.current) {
      backupVideoRef.current.src = '';
      backupVideoRef.current.style.opacity = '0';
      backupVideoRef.current.style.zIndex = '1';
    }
    setActivePlayer('main');
    setIsPlaying(false);
    addLog('⏹️ Stream parado');
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    if (m > 0) {
      return `${m}m ${s}s`;
    }
    return `${s}s`;
  };

  return (
    <div className="stream-tester">
      <header className="stream-tester-header">
        <h1>🔧 Stream Tester</h1>
        <p>Teste streams HLS (.m3u8) com auto-refresh ou vídeos MP4 diretos.</p>
      </header>

      <form className="stream-tester-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="stream-url">URL do Stream (M3U8 ou MP4)</label>
          <input
            id="stream-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://example.com/stream.m3u8 ou video.mp4"
            className="stream-url-input"
          />
        </div>

        <div className="settings-row">
          <div className="setting-item">
            <label htmlFor="auto-refresh">
              <input
                id="auto-refresh"
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                disabled={url.endsWith('.mp4')}
              />
              Auto-refresh (apenas HLS)
            </label>
          </div>

          <div className="setting-item">
            <label htmlFor="refresh-interval">Intervalo (segundos)</label>
            <input
              id="refresh-interval"
              type="number"
              min="5"
              max="60"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="interval-input"
              disabled={url.endsWith('.mp4')}
            />
          </div>
        </div>

        <div className="button-row">
          <button type="submit" className="btn btn-primary" disabled={!url.trim()}>
            ▶️ Iniciar
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleStop} disabled={!isPlaying}>
            ⏹️ Parar
          </button>
          <button type="button" className="btn btn-secondary" onClick={refreshStream} disabled={!url.trim() || url.endsWith('.mp4')}>
            🔄 Reiniciar Agora
          </button>
        </div>
      </form>

      <div className="stream-tester-content">
        <div className="player-section">
          <div className="video-container">
            {isLoading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <span>Carregando...</span>
              </div>
            )}
            {error && (
              <div className="error-overlay">
                <span>❌ {error}</span>
              </div>
            )}
            {/* Player principal */}
            <video
              ref={videoRef}
              className="video-player video-main"
              playsInline
              controls
              style={{ opacity: activePlayer === 'main' ? 1 : 0, zIndex: activePlayer === 'main' ? 2 : 1 }}
            />
            {/* Player de backup para troca invisível */}
            <video
              ref={backupVideoRef}
              className="video-player video-backup"
              playsInline
              controls
              style={{ opacity: activePlayer === 'backup' ? 1 : 0, zIndex: activePlayer === 'backup' ? 2 : 1 }}
            />
            {isPlaying && autoRefresh && !url.endsWith('.mp4') && (
              <div className="refresh-indicator seamless">
                ✨ Refresh invisível em: <strong>{countdown}s</strong>
              </div>
            )}
          </div>

          <div className="stats-panel">
            <h3>📊 Estatísticas</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Status</span>
                <span className={`stat-value ${isPlaying ? 'playing' : 'stopped'}`}>
                  {isPlaying ? '▶️ Reproduzindo' : '⏹️ Parado'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Tempo de reprodução</span>
                <span className="stat-value">{formatTime(stats.playTime)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Refreshes realizados</span>
                <span className="stat-value">{stats.refreshCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Último refresh</span>
                <span className="stat-value">
                  {stats.lastRefresh 
                    ? stats.lastRefresh.toLocaleTimeString('pt-BR')
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="logs-section">
          <h3>📝 Logs</h3>
          <div className="logs-container">
            {logs.length === 0 ? (
              <p className="no-logs">Nenhum log ainda. Inicie um stream para ver os logs.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="log-entry">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StreamTester;
