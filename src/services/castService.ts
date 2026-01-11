/**
 * Serviço Universal de Cast/Transmissão
 * 
 * Suporta múltiplas plataformas:
 * - Google Cast (Chromecast) - Chrome, Edge, Android
 * - AirPlay - Safari, iOS, macOS
 * - Remote Playback API - Chrome 121+, Edge, Safari
 * - Presentation API - Smart TVs, dispositivos compatíveis
 * - Web Share API - Compartilhamento nativo
 * - Link externo - VLC, outros apps
 */

// Tipos para o Cast Framework do Google
declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: {
      framework: {
        CastContext: {
          getInstance: () => CastContext;
        };
        CastState: {
          NO_DEVICES_AVAILABLE: string;
          NOT_CONNECTED: string;
          CONNECTING: string;
          CONNECTED: string;
        };
        SessionState: {
          NO_SESSION: string;
          SESSION_STARTING: string;
          SESSION_STARTED: string;
          SESSION_ENDING: string;
          SESSION_ENDED: string;
          SESSION_RESUMED: string;
        };
        RemotePlayerEventType: {
          IS_CONNECTED_CHANGED: string;
          CURRENT_TIME_CHANGED: string;
          MEDIA_INFO_CHANGED: string;
          PLAYER_STATE_CHANGED: string;
        };
        RemotePlayer: new () => RemotePlayer;
        RemotePlayerController: new (player: RemotePlayer) => RemotePlayerController;
      };
    };
    chrome?: {
      cast?: {
        media: {
          MediaInfo: new (contentId: string, contentType: string) => MediaInfo;
          LoadRequest: new (mediaInfo: MediaInfo) => LoadRequest;
          StreamType: {
            LIVE: string;
            BUFFERED: string;
          };
          GenericMediaMetadata: new () => GenericMediaMetadata;
          MetadataType: {
            GENERIC: number;
          };
        };
        AutoJoinPolicy: {
          ORIGIN_SCOPED: string;
        };
      };
    };
  }
}

interface CastContext {
  setOptions: (options: CastOptions) => void;
  getCastState: () => string;
  getSessionState: () => string;
  getCurrentSession: () => CastSession | null;
  requestSession: () => Promise<void>;
  addEventListener: (eventType: string, listener: (event: CastStateEventData) => void) => void;
  removeEventListener: (eventType: string, listener: (event: CastStateEventData) => void) => void;
}

interface CastOptions {
  receiverApplicationId: string;
  autoJoinPolicy: string;
}

interface CastSession {
  getSessionId: () => string;
  getCastDevice: () => { friendlyName: string };
  loadMedia: (request: LoadRequest) => Promise<void>;
  endSession: (stopCasting: boolean) => void;
}

interface MediaInfo {
  streamType: string;
  metadata: GenericMediaMetadata;
  contentType: string;
}

interface LoadRequest {
  autoplay: boolean;
}

interface GenericMediaMetadata {
  metadataType: number;
  title: string;
  images: Array<{ url: string }>;
}

interface RemotePlayer {
  isConnected: boolean;
  currentTime: number;
  duration: number;
  volumeLevel: number;
  isMuted: boolean;
  isPaused: boolean;
}

interface RemotePlayerController {
  playOrPause: () => void;
  stop: () => void;
  seek: () => void;
  setVolumeLevel: () => void;
  muteOrUnmute: () => void;
  addEventListener: (eventType: string, listener: () => void) => void;
  removeEventListener: (eventType: string, listener: () => void) => void;
}

interface CastStateEventData {
  castState: string;
  sessionState?: string;
}

export type CastMethod = 
  | 'chromecast'
  | 'airplay'
  | 'remotePlayback'
  | 'presentation'
  | 'share'
  | 'copyLink'
  | 'openExternal';

export interface CastDevice {
  id: string;
  name: string;
  type: CastMethod;
  available: boolean;
}

export interface CastState {
  isConnected: boolean;
  deviceName: string | null;
  method: CastMethod | null;
}

export interface CastCapabilities {
  chromecast: boolean;
  airplay: boolean;
  remotePlayback: boolean;
  presentation: boolean;
  share: boolean;
  copyLink: boolean;
  openExternal: boolean;
}

type CastStateChangeCallback = (state: CastState) => void;

class CastService {
  private castContext: CastContext | null = null;
  private remotePlayer: RemotePlayer | null = null;
  private remotePlayerController: RemotePlayerController | null = null;
  private stateChangeCallbacks: CastStateChangeCallback[] = [];
  private currentState: CastState = {
    isConnected: false,
    deviceName: null,
    method: null,
  };
  private chromecastInitialized = false;

  constructor() {
    this.initGoogleCast();
  }

  /**
   * Inicializa o Google Cast SDK
   */
  private initGoogleCast(): void {
    if (typeof window === 'undefined') return;

    // Aguarda o SDK do Google Cast carregar
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable && window.cast && window.chrome?.cast) {
        this.setupGoogleCast();
      }
    };

    // Se já estiver carregado
    if (window.cast?.framework) {
      this.setupGoogleCast();
    }
  }

  /**
   * Configura o Google Cast Framework
   */
  private setupGoogleCast(): void {
    if (this.chromecastInitialized || !window.cast?.framework || !window.chrome?.cast) return;

    try {
      this.castContext = window.cast.framework.CastContext.getInstance();
      
      // Usa o receiver padrão do Chrome para mídia (não precisa de registro)
      this.castContext.setOptions({
        receiverApplicationId: 'CC1AD845', // Default Media Receiver - funciona sem registro
        autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      // Configura player remoto
      this.remotePlayer = new window.cast.framework.RemotePlayer();
      this.remotePlayerController = new window.cast.framework.RemotePlayerController(
        this.remotePlayer
      );

      // Escuta mudanças de estado
      this.castContext.addEventListener(
        'caststatechanged',
        this.handleCastStateChange.bind(this)
      );

      if (this.remotePlayerController) {
        this.remotePlayerController.addEventListener(
          window.cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
          this.handleConnectionChange.bind(this)
        );
      }

      this.chromecastInitialized = true;
      console.log('Google Cast inicializado com sucesso');
    } catch (error) {
      console.warn('Erro ao inicializar Google Cast:', error);
    }
  }

  /**
   * Handle cast state changes
   */
  private handleCastStateChange(event: CastStateEventData): void {
    const state = event.castState;
    const framework = window.cast?.framework;
    
    if (!framework) return;

    if (state === framework.CastState.CONNECTED) {
      const session = this.castContext?.getCurrentSession();
      this.updateState({
        isConnected: true,
        deviceName: session?.getCastDevice().friendlyName || 'Chromecast',
        method: 'chromecast',
      });
    } else if (state === framework.CastState.NOT_CONNECTED || 
               state === framework.CastState.NO_DEVICES_AVAILABLE) {
      if (this.currentState.method === 'chromecast') {
        this.updateState({
          isConnected: false,
          deviceName: null,
          method: null,
        });
      }
    }
  }

  /**
   * Handle connection changes
   */
  private handleConnectionChange(): void {
    if (this.remotePlayer?.isConnected) {
      const session = this.castContext?.getCurrentSession();
      this.updateState({
        isConnected: true,
        deviceName: session?.getCastDevice().friendlyName || 'Chromecast',
        method: 'chromecast',
      });
    } else if (this.currentState.method === 'chromecast') {
      this.updateState({
        isConnected: false,
        deviceName: null,
        method: null,
      });
    }
  }

  /**
   * Atualiza estado e notifica listeners
   */
  private updateState(newState: CastState): void {
    this.currentState = newState;
    this.stateChangeCallbacks.forEach(callback => callback(newState));
  }

  /**
   * Verifica capacidades de cast disponíveis
   */
  getCapabilities(): CastCapabilities {
    const video = document.createElement('video');
    
    return {
      // Chromecast - Chrome, Edge em desktop e Android
      chromecast: this.chromecastInitialized && !!window.cast?.framework,
      
      // AirPlay - Safari (Mac e iOS)
      airplay: 'webkitShowPlaybackTargetPicker' in video,
      
      // Remote Playback API - Chrome 121+, Safari 13.1+, Edge 121+
      remotePlayback: 'remote' in video,
      
      // Presentation API - Chrome, Edge (menos comum)
      presentation: 'presentation' in navigator && !!(navigator as any).presentation?.defaultRequest,
      
      // Web Share API - Mobile principalmente
      share: 'share' in navigator,
      
      // Sempre disponível
      copyLink: true,
      
      // Sempre disponível (abre em app externo)
      openExternal: true,
    };
  }

  /**
   * Retorna os métodos de cast disponíveis com informações
   */
  getAvailableMethods(): Array<{
    method: CastMethod;
    name: string;
    description: string;
    icon: string;
    available: boolean;
  }> {
    const capabilities = this.getCapabilities();
    
    const methods: Array<{
      method: CastMethod;
      name: string;
      description: string;
      icon: string;
      available: boolean;
    }> = [
      {
        method: 'chromecast' as CastMethod,
        name: 'Chromecast',
        description: 'Transmitir para Chromecast ou TV com Google Cast',
        icon: 'chromecast',
        available: capabilities.chromecast,
      },
      {
        method: 'airplay' as CastMethod,
        name: 'AirPlay',
        description: 'Transmitir para Apple TV, Mac ou dispositivos AirPlay',
        icon: 'airplay',
        available: capabilities.airplay,
      },
      {
        method: 'remotePlayback' as CastMethod,
        name: 'Dispositivo remoto',
        description: 'Transmitir via conexão do navegador',
        icon: 'tv',
        available: capabilities.remotePlayback && !capabilities.chromecast && !capabilities.airplay,
      },
      {
        method: 'share' as CastMethod,
        name: 'Compartilhar',
        description: 'Enviar para outro app ou dispositivo',
        icon: 'share',
        available: capabilities.share,
      },
      {
        method: 'copyLink' as CastMethod,
        name: 'Copiar link',
        description: 'Copiar URL para colar em Smart TV ou player',
        icon: 'copy',
        available: true,
      },
      {
        method: 'openExternal' as CastMethod,
        name: 'Abrir em player externo',
        description: 'Abrir em VLC, IINA ou outro player',
        icon: 'external',
        available: true,
      },
    ];
    
    return methods.filter(m => m.available || m.method === 'copyLink' || m.method === 'openExternal');
  }

  /**
   * Inicia transmissão via Chromecast
   */
  async castToChromecast(mediaUrl: string, title: string, imageUrl?: string): Promise<boolean> {
    if (!this.castContext || !window.chrome?.cast) {
      console.warn('Google Cast não disponível');
      return false;
    }

    try {
      // Primeiro, solicita sessão (mostra picker de dispositivos)
      await this.castContext.requestSession();
      
      const session = this.castContext.getCurrentSession();
      if (!session) {
        throw new Error('Nenhuma sessão de cast criada');
      }

      // Cria informação de mídia
      const mediaInfo = new window.chrome.cast.media.MediaInfo(mediaUrl, 'application/x-mpegURL');
      mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
      
      // Metadados
      const metadata = new window.chrome.cast.media.GenericMediaMetadata();
      metadata.metadataType = window.chrome.cast.media.MetadataType.GENERIC;
      metadata.title = title;
      if (imageUrl) {
        metadata.images = [{ url: imageUrl }];
      }
      mediaInfo.metadata = metadata;

      // Request de carregamento
      const loadRequest = new window.chrome.cast.media.LoadRequest(mediaInfo);
      loadRequest.autoplay = true;

      await session.loadMedia(loadRequest);
      
      this.updateState({
        isConnected: true,
        deviceName: session.getCastDevice().friendlyName,
        method: 'chromecast',
      });

      return true;
    } catch (error: any) {
      // Erro "cancel" é normal quando usuário fecha o picker
      if (error?.code !== 'cancel') {
        console.error('Erro ao transmitir para Chromecast:', error);
      }
      return false;
    }
  }

  /**
   * Inicia transmissão via AirPlay
   */
  async castToAirPlay(videoElement: HTMLVideoElement): Promise<boolean> {
    if (!('webkitShowPlaybackTargetPicker' in videoElement)) {
      console.warn('AirPlay não disponível');
      return false;
    }

    try {
      // Safari/iOS AirPlay
      (videoElement as any).webkitShowPlaybackTargetPicker();
      
      // Monitora se conectou
      const checkConnection = () => {
        const isPlaying = (videoElement as any).webkitCurrentPlaybackTargetIsWireless;
        if (isPlaying) {
          this.updateState({
            isConnected: true,
            deviceName: 'AirPlay',
            method: 'airplay',
          });
        }
      };

      // Verifica periodicamente
      videoElement.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', () => {
        const isWireless = (videoElement as any).webkitCurrentPlaybackTargetIsWireless;
        this.updateState({
          isConnected: isWireless,
          deviceName: isWireless ? 'AirPlay' : null,
          method: isWireless ? 'airplay' : null,
        });
      });

      setTimeout(checkConnection, 1000);
      return true;
    } catch (error) {
      console.error('Erro ao transmitir via AirPlay:', error);
      return false;
    }
  }

  /**
   * Usa Remote Playback API nativa
   */
  async castViaRemotePlayback(videoElement: HTMLVideoElement): Promise<boolean> {
    if (!('remote' in videoElement)) {
      console.warn('Remote Playback API não disponível');
      return false;
    }

    try {
      const remote = (videoElement as any).remote;
      
      // Configura listeners
      remote.addEventListener('connecting', () => {
        console.log('Conectando a dispositivo remoto...');
      });

      remote.addEventListener('connect', () => {
        this.updateState({
          isConnected: true,
          deviceName: 'Dispositivo remoto',
          method: 'remotePlayback',
        });
      });

      remote.addEventListener('disconnect', () => {
        this.updateState({
          isConnected: false,
          deviceName: null,
          method: null,
        });
      });

      // Mostra picker de dispositivos
      await remote.prompt();
      return true;
    } catch (error: any) {
      // NotFoundError significa que usuário cancelou
      if (error?.name !== 'NotFoundError') {
        console.error('Erro na Remote Playback:', error);
      }
      return false;
    }
  }

  /**
   * Compartilha via Web Share API
   */
  async shareMedia(title: string, mediaUrl: string): Promise<boolean> {
    if (!navigator.share) {
      console.warn('Web Share API não disponível');
      return false;
    }

    try {
      await navigator.share({
        title: `Assistir ${title}`,
        text: `Assista ${title} ao vivo`,
        url: mediaUrl,
      });
      return true;
    } catch (error: any) {
      // AbortError significa que usuário cancelou
      if (error?.name !== 'AbortError') {
        console.error('Erro ao compartilhar:', error);
      }
      return false;
    }
  }

  /**
   * Copia link para clipboard
   */
  async copyLink(mediaUrl: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(mediaUrl);
      } else {
        // Fallback para navegadores antigos
        const textArea = document.createElement('textarea');
        textArea.value = mediaUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      return true;
    } catch (error) {
      console.error('Erro ao copiar link:', error);
      return false;
    }
  }

  /**
   * Gera links para abrir em players externos
   */
  getExternalPlayerLinks(mediaUrl: string): Array<{
    name: string;
    url: string;
    icon: string;
    platforms: string[];
  }> {
    const encodedUrl = encodeURIComponent(mediaUrl);
    
    return [
      {
        name: 'VLC',
        url: `vlc://${mediaUrl}`,
        icon: 'vlc',
        platforms: ['ios', 'android', 'windows', 'macos', 'linux'],
      },
      {
        name: 'IINA',
        url: `iina://weblink?url=${encodedUrl}`,
        icon: 'iina',
        platforms: ['macos'],
      },
      {
        name: 'Infuse',
        url: `infuse://x-callback-url/play?url=${encodedUrl}`,
        icon: 'infuse',
        platforms: ['ios', 'macos', 'tvos'],
      },
      {
        name: 'MX Player',
        url: `intent:${mediaUrl}#Intent;package=com.mxtech.videoplayer.ad;end`,
        icon: 'mx',
        platforms: ['android'],
      },
      {
        name: 'nPlayer',
        url: `nplayer-${mediaUrl}`,
        icon: 'nplayer',
        platforms: ['ios'],
      },
      {
        name: 'Potplayer',
        url: `potplayer://${mediaUrl}`,
        icon: 'potplayer',
        platforms: ['windows'],
      },
    ];
  }

  /**
   * Abre mídia em player externo
   */
  openInExternalPlayer(playerUrl: string): void {
    // Tenta abrir via iframe oculto primeiro (não muda foco)
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = playerUrl;
    document.body.appendChild(iframe);
    
    // Remove após 3 segundos
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 3000);
  }

  /**
   * Método principal de cast - tenta o melhor método disponível
   */
  async cast(
    method: CastMethod,
    mediaUrl: string,
    title: string,
    videoElement?: HTMLVideoElement,
    imageUrl?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      switch (method) {
        case 'chromecast':
          const chromecastSuccess = await this.castToChromecast(mediaUrl, title, imageUrl);
          return {
            success: chromecastSuccess,
            message: chromecastSuccess 
              ? 'Transmitindo para Chromecast' 
              : 'Não foi possível conectar ao Chromecast',
          };

        case 'airplay':
          if (!videoElement) {
            return { success: false, message: 'Elemento de vídeo necessário para AirPlay' };
          }
          const airplaySuccess = await this.castToAirPlay(videoElement);
          return {
            success: airplaySuccess,
            message: airplaySuccess 
              ? 'Selecione um dispositivo AirPlay' 
              : 'AirPlay não disponível',
          };

        case 'remotePlayback':
          if (!videoElement) {
            return { success: false, message: 'Elemento de vídeo necessário' };
          }
          const remoteSuccess = await this.castViaRemotePlayback(videoElement);
          return {
            success: remoteSuccess,
            message: remoteSuccess 
              ? 'Conectado a dispositivo remoto' 
              : 'Não foi possível conectar',
          };

        case 'share':
          const shareSuccess = await this.shareMedia(title, mediaUrl);
          return {
            success: shareSuccess,
            message: shareSuccess ? 'Link compartilhado' : 'Compartilhamento cancelado',
          };

        case 'copyLink':
          const copySuccess = await this.copyLink(mediaUrl);
          return {
            success: copySuccess,
            message: copySuccess 
              ? 'Link copiado! Cole na sua Smart TV ou player' 
              : 'Erro ao copiar link',
          };

        case 'openExternal':
          return {
            success: true,
            message: 'Escolha um player externo',
          };

        default:
          return { success: false, message: 'Método de cast não suportado' };
      }
    } catch (error) {
      console.error('Erro no cast:', error);
      return { success: false, message: 'Erro ao iniciar transmissão' };
    }
  }

  /**
   * Para a transmissão atual
   */
  stopCasting(): void {
    if (this.currentState.method === 'chromecast') {
      const session = this.castContext?.getCurrentSession();
      session?.endSession(true);
    }
    
    this.updateState({
      isConnected: false,
      deviceName: null,
      method: null,
    });
  }

  /**
   * Obtém estado atual
   */
  getState(): CastState {
    return this.currentState;
  }

  /**
   * Adiciona listener de mudança de estado
   */
  onStateChange(callback: CastStateChangeCallback): () => void {
    this.stateChangeCallbacks.push(callback);
    
    // Retorna função de cleanup
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Verifica se Chromecast está disponível
   */
  isChromecastAvailable(): boolean {
    if (!this.castContext || !window.cast?.framework) return false;
    const state = this.castContext.getCastState();
    return state !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE;
  }

  /**
   * Detecta plataforma atual
   */
  detectPlatform(): {
    os: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'unknown';
    browser: 'chrome' | 'safari' | 'firefox' | 'edge' | 'samsung' | 'unknown';
    isMobile: boolean;
    isTV: boolean;
  } {
    const ua = navigator.userAgent.toLowerCase();
    
    // Detecta OS
    let os: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'unknown' = 'unknown';
    if (/iphone|ipad|ipod/.test(ua)) os = 'ios';
    else if (/android/.test(ua)) os = 'android';
    else if (/mac/.test(ua)) os = 'macos';
    else if (/win/.test(ua)) os = 'windows';
    else if (/linux/.test(ua)) os = 'linux';

    // Detecta browser
    let browser: 'chrome' | 'safari' | 'firefox' | 'edge' | 'samsung' | 'unknown' = 'unknown';
    if (/edg/.test(ua)) browser = 'edge';
    else if (/samsungbrowser/.test(ua)) browser = 'samsung';
    else if (/chrome/.test(ua)) browser = 'chrome';
    else if (/safari/.test(ua)) browser = 'safari';
    else if (/firefox/.test(ua)) browser = 'firefox';

    // Detecta mobile
    const isMobile = /iphone|ipad|ipod|android|mobile/.test(ua);

    // Detecta TV (heurísticas)
    const isTV = /tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast|tizen|webos/.test(ua);

    return { os, browser, isMobile, isTV };
  }

  /**
   * Obtém métodos recomendados para a plataforma atual
   */
  getRecommendedMethods(): CastMethod[] {
    const platform = this.detectPlatform();
    const capabilities = this.getCapabilities();
    const recommended: CastMethod[] = [];

    // iOS - AirPlay é prioritário
    if (platform.os === 'ios') {
      if (capabilities.airplay) recommended.push('airplay');
      if (capabilities.share) recommended.push('share');
      recommended.push('copyLink', 'openExternal');
    }
    // Android - Chromecast é prioritário
    else if (platform.os === 'android') {
      if (capabilities.chromecast) recommended.push('chromecast');
      if (capabilities.remotePlayback) recommended.push('remotePlayback');
      if (capabilities.share) recommended.push('share');
      recommended.push('copyLink', 'openExternal');
    }
    // macOS - Depende do browser
    else if (platform.os === 'macos') {
      if (platform.browser === 'safari' && capabilities.airplay) {
        recommended.push('airplay');
      }
      if (capabilities.chromecast) recommended.push('chromecast');
      recommended.push('copyLink', 'openExternal');
    }
    // Windows/Linux - Chromecast ou Remote Playback
    else {
      if (capabilities.chromecast) recommended.push('chromecast');
      if (capabilities.remotePlayback) recommended.push('remotePlayback');
      recommended.push('copyLink', 'openExternal');
    }

    return recommended;
  }
}

// Singleton
export const castService = new CastService();
export default castService;
