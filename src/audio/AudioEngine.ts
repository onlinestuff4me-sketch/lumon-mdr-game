import type { Temper } from "../game/types";

/**
 * Procedural Lumon terminal synthesiser.
 *
 * Design rules, in priority order:
 *  1. Zero external assets — every sound is generated from oscillators.
 *  2. Zero per-frame allocation — the four temper voices are built once at
 *     unlock and live for the session; proximity only moves AudioParams.
 *  3. Zero clipping — everything lands on a bus with a limiter before the
 *     destination, and voice gains are budgeted so four-at-once still fits.
 */

type VoiceParam = {
  /** Ramps 0..1 with proximity. */
  amp: GainNode;
  /** Opens with proximity. */
  filter: BiquadFilterNode;
  /** Called each engine tick with (intensity, now). Optional. */
  tick?: (intensity: number, now: number) => void;
  oscillators: OscillatorNode[];
  baseCutoff: number;
  peakCutoff: number;
  peakGain: number;
};

const SMOOTH = 0.05; // setTargetAtTime time-constant for proximity moves

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = amount;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private voices = new Map<Temper, VoiceParam>();
  private intensities: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
  private muted = false;
  private arpStep = 0;
  private nextArpAt = 0;
  private nextKickAt = 0;
  private visibilityBound = false;

  get isReady(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /**
   * Must be called from inside a user-gesture handler. Safe to call often —
   * it builds once and thereafter only nudges a suspended context awake.
   */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor({ latencyHint: "interactive" });
      } catch {
        this.ctx = null;
        return;
      }
      this.buildGraph();
      this.bindVisibility();
    }
    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch {
        /* iOS throws if the gesture has already expired; next tap retries. */
      }
    }
  }

  private buildGraph(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    const bus = ctx.createGain();
    bus.gain.value = 0.55;

    bus.connect(limiter);
    limiter.connect(ctx.destination);
    this.bus = bus;
    this.limiter = limiter;

    this.voices.set("WO", this.buildWoe(ctx, bus));
    this.voices.set("FC", this.buildFrolic(ctx, bus));
    this.voices.set("DR", this.buildDread(ctx, bus));
    this.voices.set("MA", this.buildMalice(ctx, bus));
  }

  /** WOE — a 60 Hz minor drone that sags. */
  private buildWoe(ctx: AudioContext, out: GainNode): VoiceParam {
    const amp = ctx.createGain();
    amp.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;
    filter.Q.value = 2;

    const root = ctx.createOscillator();
    root.type = "sine";
    root.frequency.value = 60;
    // A minor third above the root: the interval of institutional sorrow.
    const third = ctx.createOscillator();
    third.type = "sine";
    third.frequency.value = 60 * Math.pow(2, 3 / 12);
    const sub = ctx.createOscillator();
    sub.type = "triangle";
    sub.frequency.value = 30;

    const mix = ctx.createGain();
    mix.gain.value = 0.34;
    root.connect(mix);
    third.connect(mix);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    sub.connect(subGain).connect(mix);

    // Slow sigh: an LFO that drags the cutoff down and back.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.22;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 55;
    lfo.connect(lfoDepth).connect(filter.frequency);

    mix.connect(filter).connect(amp).connect(out);
    [root, third, sub, lfo].forEach((o) => o.start());

    return {
      amp,
      filter,
      oscillators: [root, third, sub, lfo],
      baseCutoff: 110,
      peakCutoff: 320,
      peakGain: 0.85,
    };
  }

  /** FROLIC — an 880 Hz arpeggiated chime, all sugar and no weight. */
  private buildFrolic(ctx: AudioContext, out: GainNode): VoiceParam {
    const amp = ctx.createGain();
    amp.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    filter.Q.value = 1.1;

    // One persistent oscillator; the arpeggio is scheduled onto its params,
    // so a long probe never allocates a single node.
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 880;
    const pluck = ctx.createGain();
    pluck.gain.value = 0;

    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 880 * 2;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.18;
    shimmer.connect(shimmerGain).connect(pluck);

    osc.connect(pluck).connect(filter).connect(amp).connect(out);
    osc.start();
    shimmer.start();

    // A-major-ish sparkle above 880: A5 C#6 E6 A6 C#6 E6.
    const steps = [1, 1.26, 1.5, 2, 1.5, 1.26];

    const tick = (intensity: number, now: number) => {
      if (intensity <= 0.02) return;
      const interval = 0.26 - 0.14 * intensity;
      if (now < this.nextArpAt) return;
      const t = Math.max(now, this.nextArpAt || now);
      const f = 880 * steps[this.arpStep % steps.length];
      osc.frequency.setValueAtTime(f, t);
      shimmer.frequency.setValueAtTime(f * 2, t);
      pluck.gain.cancelScheduledValues(t);
      pluck.gain.setValueAtTime(0.0001, t);
      pluck.gain.linearRampToValueAtTime(0.7, t + 0.012);
      pluck.gain.exponentialRampToValueAtTime(0.0001, t + interval * 0.95);
      this.arpStep++;
      this.nextArpAt = t + interval;
    };

    return {
      amp,
      filter,
      tick,
      oscillators: [osc, shimmer],
      baseCutoff: 900,
      peakCutoff: 2600,
      peakGain: 0.5,
    };
  }

  /** DREAD — 150 Hz against 212 Hz. A tritone that will not resolve. */
  private buildDread(ctx: AudioContext, out: GainNode): VoiceParam {
    const amp = ctx.createGain();
    amp.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 3.5;

    const a = ctx.createOscillator();
    a.type = "sawtooth";
    a.frequency.value = 150;
    const b = ctx.createOscillator();
    b.type = "sawtooth";
    // Exactly 212 Hz against 150 Hz — a tritone, near enough to 1.414 that
    // it beats against itself without any help from detune.
    b.frequency.value = 212;

    const mix = ctx.createGain();
    mix.gain.value = 0.22;
    a.connect(mix);
    b.connect(mix);

    // 30 Hz amplitude shiver, matched to the visual X-axis tremor.
    const trem = ctx.createOscillator();
    trem.type = "square";
    trem.frequency.value = 30;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.35;
    const tremTarget = ctx.createGain();
    tremTarget.gain.value = 0.65;
    trem.connect(tremDepth).connect(tremTarget.gain);

    mix.connect(tremTarget).connect(filter).connect(amp).connect(out);
    [a, b, trem].forEach((o) => o.start());

    return {
      amp,
      filter,
      oscillators: [a, b, trem],
      baseCutoff: 380,
      peakCutoff: 1500,
      peakGain: 0.62,
    };
  }

  /** MALICE — sawtooth driven into a shaper, with a heavy kick. */
  private buildMalice(ctx: AudioContext, out: GainNode): VoiceParam {
    const amp = ctx.createGain();
    amp.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 1.4;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 82;
    const growl = ctx.createOscillator();
    growl.type = "square";
    growl.frequency.value = 41.5;

    const pre = ctx.createGain();
    pre.gain.value = 0.45;
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(28);
    shaper.oversample = "2x";

    const kick = ctx.createGain();
    kick.gain.value = 0.35;

    osc.connect(pre);
    growl.connect(pre);
    pre.connect(shaper).connect(kick).connect(filter).connect(amp).connect(out);
    osc.start();
    growl.start();

    const tick = (intensity: number, now: number) => {
      if (intensity <= 0.02) return;
      const interval = 0.62 - 0.26 * intensity;
      if (now < this.nextKickAt) return;
      const t = Math.max(now, this.nextKickAt || now);
      kick.gain.cancelScheduledValues(t);
      kick.gain.setValueAtTime(0.35, t);
      kick.gain.linearRampToValueAtTime(1, t + 0.02);
      kick.gain.exponentialRampToValueAtTime(0.35, t + interval * 0.8);
      osc.frequency.cancelScheduledValues(t);
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(82, t + 0.16);
      this.nextKickAt = t + interval;
    };

    return {
      amp,
      filter,
      tick,
      oscillators: [osc, growl],
      baseCutoff: 500,
      peakCutoff: 2200,
      peakGain: 0.55,
    };
  }

  /** Set a temper's proximity intensity, 0..1. Cheap; call every frame. */
  setProximity(temper: Temper, intensity: number): void {
    const clamped = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
    this.intensities[temper] = clamped;
    const voice = this.voices.get(temper);
    const ctx = this.ctx;
    if (!voice || !ctx || ctx.state !== "running") return;

    const now = ctx.currentTime;
    // Perceptual curve: quiet until the reticle is genuinely close.
    const shaped = clamped * clamped * (3 - 2 * clamped);
    const target = this.muted ? 0 : shaped * voice.peakGain;
    voice.amp.gain.setTargetAtTime(target, now, SMOOTH);
    voice.filter.frequency.setTargetAtTime(
      voice.baseCutoff + (voice.peakCutoff - voice.baseCutoff) * shaped,
      now,
      SMOOTH,
    );
  }

  /** Drive the scheduled elements (arpeggio, kick). Call once per frame. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.muted) return;
    const now = ctx.currentTime;
    for (const [temper, voice] of this.voices) {
      voice.tick?.(this.intensities[temper], now);
    }
  }

  /** Silence every temper voice (used on phase changes). */
  silenceAll(): void {
    for (const t of Object.keys(this.intensities) as Temper[]) {
      this.setProximity(t, 0);
    }
  }

  // ── One-shot terminal SFX ────────────────────────────────────────────

  private blip(
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    gain: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.muted || !this.bus) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    // Break the graph reference as soon as the note is done so the node is
    // collectable; without this a long session accretes dead GainNodes.
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
      osc.onended = null;
    };
  }

  private noise(dur: number, gain: number, cutoff: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.muted || !this.bus) return;
    const t = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.bus);
    src.start(t);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
      src.onended = null;
    };
  }

  /** Tactile click for the mode switch. */
  click(): void {
    this.blip("square", 1200, 700, 0.045, 0.16);
  }

  /** Packet lifts off the grid. */
  lift(): void {
    this.blip("sine", 420, 1250, 0.22, 0.2);
    this.blip("triangle", 840, 2100, 0.18, 0.1, 0.03);
  }

  /** Correct bin — the Lumon confirmation chime. */
  chime(): void {
    this.blip("sine", 784, 784, 0.16, 0.22);
    this.blip("sine", 1046.5, 1046.5, 0.2, 0.18, 0.08);
    this.blip("sine", 1568, 1568, 0.34, 0.14, 0.16);
  }

  /** Wrong bin — harsh static and a dead-end buzz. */
  buzz(): void {
    this.noise(0.34, 0.3, 900);
    this.blip("sawtooth", 160, 70, 0.36, 0.24);
    this.blip("square", 96, 96, 0.3, 0.16, 0.04);
  }

  /** File complete accolade. */
  fanfare(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.blip("triangle", n, n, 0.5, 0.16, i * 0.11));
  }

  /** Shift expired. */
  alarm(): void {
    for (let i = 0; i < 3; i++) {
      this.blip("square", 220, 180, 0.24, 0.2, i * 0.3);
      this.blip("square", 165, 130, 0.24, 0.16, i * 0.3 + 0.12);
    }
  }

  /** Terminal boot sweep. */
  boot(): void {
    this.blip("sine", 90, 900, 0.5, 0.14);
    this.noise(0.3, 0.08, 2400);
  }

  /** Last-ten-seconds clock tick. */
  tock(urgent: boolean): void {
    this.blip("square", urgent ? 1500 : 900, urgent ? 900 : 700, 0.04, 0.1);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      for (const voice of this.voices.values()) {
        const ctx = this.ctx;
        if (ctx) voice.amp.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      }
    } else {
      for (const t of Object.keys(this.intensities) as Temper[]) {
        this.setProximity(t, this.intensities[t]);
      }
    }
  }

  private onVisibility = (): void => {
    const ctx = this.ctx;
    if (!ctx) return;
    if (document.hidden) {
      this.silenceAll();
      void ctx.suspend().catch(() => {});
    } else if (!this.muted) {
      void ctx.resume().catch(() => {});
    }
  };

  private bindVisibility(): void {
    if (this.visibilityBound) return;
    document.addEventListener("visibilitychange", this.onVisibility);
    this.visibilityBound = true;
  }

  /** Tear the whole graph down. Called on unmount / hot reload. */
  dispose(): void {
    if (this.visibilityBound) {
      document.removeEventListener("visibilitychange", this.onVisibility);
      this.visibilityBound = false;
    }
    for (const voice of this.voices.values()) {
      for (const osc of voice.oscillators) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
        osc.disconnect();
      }
      voice.amp.disconnect();
      voice.filter.disconnect();
    }
    this.voices.clear();
    this.bus?.disconnect();
    this.limiter?.disconnect();
    this.bus = null;
    this.limiter = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
  }
}

let singleton: AudioEngine | null = null;

export function getAudio(): AudioEngine {
  if (!singleton) singleton = new AudioEngine();
  return singleton;
}

export function disposeAudio(): void {
  singleton?.dispose();
  singleton = null;
}
