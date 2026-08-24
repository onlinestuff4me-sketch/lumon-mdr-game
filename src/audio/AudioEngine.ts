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
  /** How much of the ambient bed this voice takes, relative to the others.
   *  Malice's distorted body carries much further than the same gain of
   *  woe's sine drone, so it steps further back. Default 1. */
  bedScale?: number;
};

const SMOOTH = 0.05; // setTargetAtTime time-constant for proximity moves
/**
 * The ambient bed: the temper of the group the refiner is looking at,
 * playing under everything at a fraction of probe volume. Loud enough to
 * colour the room, quiet enough that finding a group with the lens is
 * still unmistakably louder than not having found one.
 */
const AMBIENT_GAIN = 0.09;
/** Slower than SMOOTH, so one group's temper dissolves into the next
 *  rather than switching. */
const AMBIENT_SMOOTH = 0.8;
/**
 * The electric hum the whole terminal sits in: mains frequency and its
 * first harmonics, always on while the audio is unmuted. It exists so the
 * temper bed has something to hide in — a lone quiet voice in silence is
 * still a voice you listen to, but the same voice folded into room tone
 * is an atmosphere. Two slightly detuned fundamentals beat against each
 * other so the hum breathes instead of being a test tone.
 */
const HUM_GAIN = 0.05;
const HUM_SMOOTH = 0.6;
/** How far the bed steps back while a probe is live, so the two never
 *  argue over which temper the refiner is being told about. */
const AMBIENT_DUCK = 0.4;

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
  private voices = new Map<Temper, VoiceParam>();
  /** Combined level per temper, read by the scheduled voice ticks. */
  private intensities: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
  /** What the lens is finding right now. */
  private proximity: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
  /** What is on screen, playing underneath. */
  private ambient: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
  private muted = false;
  private arpStep = 0;
  private nextArpAt = 0;
  private nextKickAt = 0;
  /** One second of white noise, generated once and replayed with different
   *  filters. Synthesising 16k samples inside a pointerup handler was a
   *  guaranteed frame hitch at the exact moment of negative feedback. */
  private noiseBuffer: AudioBuffer | null = null;
  private humAmp: GainNode | null = null;

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

    const frames = Math.floor(ctx.sampleRate);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    this.voices.set("WO", this.buildWoe(ctx, bus));
    this.voices.set("FC", this.buildFrolic(ctx, bus));
    this.voices.set("DR", this.buildDread(ctx, bus));
    this.voices.set("MA", this.buildMalice(ctx, bus));

    // ── the mains hum ────────────────────────────────────────────────
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 260;
    const humAmp = ctx.createGain();
    humAmp.gain.value = 0;
    humFilter.connect(humAmp);
    humAmp.connect(bus);
    // 50 and 50.4Hz together beat at a third of a hertz — the slow swell
    // of a transformer, free, with no LFO to leak through a mute.
    const partials: [number, number][] = [
      [50, 0.55],
      [50.4, 0.55],
      [100, 0.4],
      [150, 0.15],
    ];
    for (const [freq, g] of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const og = ctx.createGain();
      og.gain.value = g;
      osc.connect(og).connect(humFilter);
      osc.start();
    }
    this.humAmp = humAmp;
    this.refreshHum();
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

    // Frolic's continuous body. With no finger down the arpeggio never
    // fires, and the pluck chain rests at zero — so without this, frolic's
    // bed would be silence. A low tone rippling at ballast speed: the
    // flutter is what carries the bright, quick character, so the carrier
    // can sit right down among the hum's own harmonics — at 1180Hz it cut
    // through everything it was supposed to hide in. Wired straight to
    // `amp`, past the bandpass, so its pitch is not at the mercy of the
    // probe filter; the amp still rules it and a mute still kills it dead.
    const whine = ctx.createOscillator();
    whine.type = "sine";
    whine.frequency.value = 190;
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.34;
    const flutter = ctx.createOscillator();
    flutter.type = "sine";
    flutter.frequency.value = 6.7;
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.22;
    flutter.connect(flutterDepth).connect(whineGain.gain);
    whine.connect(whineGain).connect(amp);
    whine.start();
    flutter.start();

    // A-major-ish sparkle above 880: A5 C#6 E6 A6 C#6 E6.
    const steps = [1, 1.26, 1.5, 2, 1.5, 1.26];

    const tick = (intensity: number, now: number) => {
      if (intensity <= 0.02) return;
      // Below a real probe the arpeggio slows right down: at bed level it
      // is one distant note most of a second apart, not a melody. The two
      // curves meet at 0.2 so a rising probe never hears the tempo jump.
      const interval =
        intensity >= 0.2 ? 0.26 - 0.14 * intensity : 0.9 - 3.34 * intensity;
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
      oscillators: [osc, shimmer, whine, flutter],
      baseCutoff: 900,
      peakCutoff: 2600,
      peakGain: 0.5,
      bedScale: 0.85,
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
      // Same whisper-level stretch as frolic's arpeggio, meeting the probe
      // curve at 0.2: the bed gets a slow distant pulse, not a heartbeat.
      const interval =
        intensity >= 0.2 ? 0.62 - 0.26 * intensity : 1.2 - 3.16 * intensity;
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
      // Distortion survives quietness: at the same gain as woe's clean
      // drone, malice's rasp still reads as a voice. It sits well behind.
      bedScale: 0.5,
    };
  }

  private refreshHum(): void {
    const ctx = this.ctx;
    if (!ctx || !this.humAmp) return;
    this.humAmp.gain.setTargetAtTime(
      this.muted ? 0 : HUM_GAIN,
      ctx.currentTime,
      HUM_SMOOTH,
    );
  }

  /** Set a temper's proximity intensity, 0..1. Cheap; call every frame. */
  setProximity(temper: Temper, intensity: number): void {
    this.proximity[temper] = clamp01(intensity);
    this.apply(temper, SMOOTH);
  }

  /**
   * The bed: which temper the groups currently on screen are giving off.
   *
   * One group and it is that group's; several and it is the one nearest
   * the middle of the board, until the refiner takes hold of one, at which
   * point it is that one's. Only ever one temper at a time — a chord of
   * four tempers is not a feeling, it is noise — and the crossfade between
   * them is slow enough to be a change of mood rather than a cut.
   */
  setAmbient(temper: Temper | null, level = 1): void {
    const want = clamp01(level);
    for (const t of Object.keys(this.ambient) as Temper[]) {
      const next = t === temper ? want : 0;
      if (this.ambient[t] === next) continue;
      this.ambient[t] = next;
      this.apply(t, AMBIENT_SMOOTH);
    }
  }

  private apply(temper: Temper, smooth: number): void {
    const voice = this.voices.get(temper);
    const near = this.proximity[temper];
    // The bed ducks under a live probe: the lens is the thing answering
    // the question, and it must always be the louder answer.
    const duck = this.anyProbe() ? AMBIENT_DUCK : 1;
    const bed =
      this.ambient[temper] * AMBIENT_GAIN * duck * (voice?.bedScale ?? 1);
    const shaped = near * near * (3 - 2 * near);
    const level = Math.max(shaped, bed);
    this.intensities[temper] = level;

    const ctx = this.ctx;
    if (!voice || !ctx || ctx.state !== "running") return;

    const now = ctx.currentTime;
    const target = this.muted ? 0 : level * voice.peakGain;
    voice.amp.gain.setTargetAtTime(target, now, smooth);
    voice.filter.frequency.setTargetAtTime(
      voice.baseCutoff + (voice.peakCutoff - voice.baseCutoff) * level,
      now,
      smooth,
    );
  }

  private anyProbe(): boolean {
    for (const t of Object.keys(this.proximity) as Temper[]) {
      if (this.proximity[t] > 0.02) return true;
    }
    return false;
  }

  /** Drive the scheduled elements (arpeggio, kick). Call once per frame. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.muted) return;
    // Re-asserted every frame so the hum comes back after a hardStop —
    // one setTargetAtTime on an already-settled param costs nothing.
    this.refreshHum();
    const now = ctx.currentTime;
    for (const [temper, voice] of this.voices) {
      // Driven by the probe alone, never by the bed. The scheduled
      // elements are notes — frolic's arpeggio, malice's pulse — and a
      // note is a performance however quietly it is played. The bed is
      // the room, and rooms do not perform: at bed level each voice is
      // only its continuous body, one more electrical disturbance folded
      // into the hum.
      const p = this.proximity[temper];
      voice.tick?.(p * p * (3 - 2 * p), now);
    }
  }

  /** Drop the probe voices. The bed is not a probe and survives this —
   *  it answers to what is on the board, not to what a finger is doing. */
  silenceAll(): void {
    for (const t of Object.keys(this.proximity) as Temper[]) {
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
    if (!this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.5, dur);
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

  /**
   * Packet lifts off the grid.
   *
   * A flat mechanical click, not a rising chime. The rising pair read as
   * congratulation, and lifting a packet is not an achievement — it is the
   * middle of a gesture, and it happens twenty times a file.
   */
  lift(): void {
    this.blip("square", 900, 640, 0.05, 0.16);
    this.noise(0.035, 0.05, 3200);
  }

  /**
   * Packet let go without binning it. The lift click played backwards —
   * lower, softer, falling. It has to read as "put down", not as the buzz
   * that means you got it wrong, because nothing went wrong.
   */
  release(): void {
    this.blip("square", 620, 840, 0.045, 0.11);
    this.noise(0.03, 0.045, 2200);
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

  /** Deliberately silent. A file arriving is not an event the refiner did,
   *  and a sting on every one of them — 46 in a full queue — reads as the
   *  terminal congratulating itself. Left as a named no-op so the call site
   *  stays legible and a sound can be dropped in later. */
  fileLoaded(): void {
    /* no sound */
  }

  /** Last-ten-seconds clock tick. */
  tock(urgent: boolean): void {
    this.blip("square", urgent ? 1500 : 900, urgent ? 900 : 700, 0.04, 0.1);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.refreshHum();
    if (muted) {
      for (const voice of this.voices.values()) {
        const ctx = this.ctx;
        if (ctx) voice.amp.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      }
    } else {
      for (const t of Object.keys(this.proximity) as Temper[]) {
        this.apply(t, SMOOTH);
      }
    }
  }

  /**
   * Bring every voice to silence immediately. This is the host's tool for
   * hiding the tab or tearing down: the graph is deliberately *not*
   * suspended, because iOS will not resume a context outside a user gesture
   * and a silently un-resumed context reads to the player as broken audio.
   */
  hardStop(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const voice of this.voices.values()) {
      voice.amp.gain.cancelScheduledValues(ctx.currentTime);
      voice.amp.gain.setValueAtTime(0, ctx.currentTime);
    }
    if (this.humAmp) {
      this.humAmp.gain.cancelScheduledValues(ctx.currentTime);
      this.humAmp.gain.setValueAtTime(0, ctx.currentTime);
    }
    for (const t of Object.keys(this.intensities) as Temper[]) {
      this.intensities[t] = 0;
      this.proximity[t] = 0;
      this.ambient[t] = 0;
    }
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

let singleton: AudioEngine | null = null;

export function getAudio(): AudioEngine {
  if (!singleton) singleton = new AudioEngine();
  return singleton;
}

