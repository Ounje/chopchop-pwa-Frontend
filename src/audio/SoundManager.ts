type OscillatorWave = OscillatorType;

interface ToneStep {
  freq: number;
  duration: number;
  wave?: OscillatorWave;
}

const TONES: Record<string, ToneStep[]> = {
  tap: [{ freq: 500, duration: 0.06 }],
  swap: [{ freq: 320, duration: 0.07 }, { freq: 400, duration: 0.07 }],
  bad: [{ freq: 160, duration: 0.15, wave: 'sawtooth' }],
  match: [{ freq: 520, duration: 0.08 }, { freq: 680, duration: 0.1 }],
  combo: [{ freq: 600, duration: 0.07 }, { freq: 800, duration: 0.07 }, { freq: 1000, duration: 0.12 }],
  make: [{ freq: 700, duration: 0.08 }, { freq: 900, duration: 0.08 }, { freq: 1200, duration: 0.18 }],
  cut: [{ freq: 1100, duration: 0.05 }, { freq: 700, duration: 0.12, wave: 'sawtooth' }],
  boom: [{ freq: 90, duration: 0.35, wave: 'sawtooth' }, { freq: 60, duration: 0.4, wave: 'square' }],
  win: [{ freq: 523, duration: 0.12 }, { freq: 659, duration: 0.12 }, { freq: 784, duration: 0.12 }, { freq: 1046, duration: 0.3 }],
  click: [{ freq: 420, duration: 0.04 }]
};

export class SoundManager {
  private static audioCtx: AudioContext | null = null;
  private static enabled = true;

  public static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public static isEnabled(): boolean {
    return this.enabled;
  }

  private static getAudioContext(): AudioContext | null {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public static play(soundName: keyof typeof TONES | string): void {
    if (!this.enabled) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const steps = TONES[soundName];
      if (!steps || !steps.length) return;

      let startTime = ctx.currentTime;

      for (const step of steps) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = step.wave || 'triangle';
        osc.frequency.setValueAtTime(step.freq, startTime);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + step.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + step.duration);

        startTime += step.duration * 0.8;
      }
    } catch {
      // Audio playback fails gracefully if context blocked by policy
    }
  }
}
