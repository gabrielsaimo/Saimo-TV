/**
 * Áudio Inteligente (Normalização Dinâmica de Volume / Dynamic Range Compression).
 *
 * Nivela automaticamente o volume entre diferentes fontes e canais,
 * amplificando canais com transmissão baixa e aplicando compressão suave em picos.
 */

export const CHAVE_AUDIO_INTELIGENTE = 'saimo-audio-inteligente';

class AudioInteligenteService {
  private audioCtx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private makeupGain: GainNode | null = null;
  private connectedElements = new WeakSet<HTMLMediaElement>();

  public isAtivo(): boolean {
    const salvo = localStorage.getItem(CHAVE_AUDIO_INTELIGENTE);
    return salvo === null ? true : salvo === 'true';
  }

  public setAtivo(ativo: boolean): void {
    localStorage.setItem(CHAVE_AUDIO_INTELIGENTE, ativo ? 'true' : 'false');
    this.aplicarParametros();
    window.dispatchEvent(new Event('saimo-audio-inteligente-mudou'));
  }

  private obterAudioContext(): AudioContext | null {
    if (this.audioCtx) return this.audioCtx;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      this.audioCtx = new AudioContextClass();
      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.makeupGain = this.audioCtx.createGain();

      this.compressor.connect(this.makeupGain);
      this.makeupGain.connect(this.audioCtx.destination);

      this.aplicarParametros();
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private aplicarParametros(): void {
    if (!this.audioCtx || !this.compressor || !this.makeupGain) return;
    const ativo = this.isAtivo();
    const t = this.audioCtx.currentTime;

    if (ativo) {
      this.compressor.threshold.setValueAtTime(-24, t);
      this.compressor.knee.setValueAtTime(30, t);
      this.compressor.ratio.setValueAtTime(12, t);
      this.compressor.attack.setValueAtTime(0.003, t);
      this.compressor.release.setValueAtTime(0.25, t);
      this.makeupGain.gain.setValueAtTime(1.8, t); // +5 dB ganho dinâmico para canais baixos
    } else {
      this.compressor.threshold.setValueAtTime(0, t);
      this.makeupGain.gain.setValueAtTime(1.0, t);
    }
  }

  public conectar(video: HTMLMediaElement | null): void {
    if (!video) return;
    if (this.connectedElements.has(video)) return;

    try {
      const ctx = this.obterAudioContext();
      if (!ctx || !this.compressor) return;

      const source = ctx.createMediaElementSource(video);
      source.connect(this.compressor);
      this.connectedElements.add(video);

      const retomar = () => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      };
      video.addEventListener('play', retomar, { passive: true });
    } catch {
      // Ignora falhas em navegadores sem suporte ou restrições de mídia
    }
  }
}

export const audioInteligenteService = new AudioInteligenteService();
