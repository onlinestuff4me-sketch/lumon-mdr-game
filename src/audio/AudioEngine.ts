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
  oscillators: OscillatorNode[];
  baseCutoff: number;
  peakCutoff: number;
  peakGain: number;
  /**
   * The intensity this voice plays at while its temper is merely present
   * on screen, 0..1 on the same scale a probe drives. Bench-tuned: woe
   * and dread run at full probe level even un-probed, frolic and malice
   * stay genuinely ambient.
   */
  bed: number;
};

const SMOOTH = 0.05; // setTargetAtTime time-constant for proximity moves
/** Slower than SMOOTH, so a temper leaving the screen dissolves out
 *  rather than switching off. The bed's LEVEL now lives per voice (see
 *  VoiceParam.bed) — bench-tuned, not derived from one global gain. */
const AMBIENT_SMOOTH = 0.8;
/**
 * The electric hum the whole terminal sits in: mains frequency and its
 * first harmonics, always on while the audio is unmuted. It exists so the
 * temper bed has something to hide in — a lone quiet voice in silence is
 * still a voice you listen to, but the same voice folded into room tone
 * is an atmosphere. Two slightly detuned fundamentals beat against each
 * other so the hum breathes instead of being a test tone.
 */
const HUM_GAIN = 0.075;
const HUM_SMOOTH = 0.6;
/**
 * The buzz: the hum's dirty edge. A sawtooth on the mains frequency,
 * bandpassed well above the hum's fundamentals so it reads as electrical
 * fizz rather than more bass. Level is relative to the hum, so turning
 * the room up keeps its character.
 */
const HUM_BUZZ = 0.25;
const HUM_BUZZ_TONE = 1580;
/**
 * The keyboards: the rest of the office, typing. Synthesised, not
 * sampled — each key is a noise click plus a low thump, matching the
 * measured profile of the reference recording (a broad click centred
 * near 3kHz over a thump at 150Hz), fired in human bursts with pauses.
 * Very soft: it should be noticed only when it stops.
 */
const TYPING_GAIN = 0.145;
const TYPING_RATE = 12; // keys per second inside a burst
const TYPING_THUMP = 0.2; // low-body weight, 0..1
const TYPING_CLICK_HZ = 2150; // click bandpass centre
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
  /** Combined bed+probe level per temper, kept for mute restores. */
  private intensities: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
  /** What the lens is finding right now. */
  private proximity: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
  /** What is on screen, playing underneath. */
  private ambient: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
  private muted = false;
  /** One second of white noise, generated once and replayed with different
   *  filters. Synthesising 16k samples inside a pointerup handler was a
   *  guaranteed frame hitch at the exact moment of negative feedback. */
  private noiseBuffer: AudioBuffer | null = null;
  private humAmp: GainNode | null = null;
  private typingAmp: GainNode | null = null;
  private typingClick: BiquadFilterNode | null = null;
  private typingNextAt = 0;
  private typingBurstLeft = 0;

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
    humFilter.frequency.value = 360;
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
    // The buzz joins past the warmth lowpass — warmth is for the hum's
    // body, and a buzz that the lowpass strangles is no buzz at all. It
    // still lives behind humAmp, so level and mute rule it.
    const buzz = ctx.createOscillator();
    buzz.type = "sawtooth";
    buzz.frequency.value = 50;
    const buzzFilter = ctx.createBiquadFilter();
    buzzFilter.type = "bandpass";
    buzzFilter.frequency.value = HUM_BUZZ_TONE;
    buzzFilter.Q.value = 0.8;
    const buzzGain = ctx.createGain();
    buzzGain.gain.value = HUM_BUZZ;
    buzz.connect(buzzFilter).connect(buzzGain).connect(humAmp);
    buzz.start();

    // ── the keyboards ────────────────────────────────────────────────
    // A shared click filter and amp; each keystroke is a one-shot noise
    // burst through them plus a thump blip, scheduled from tick().
    const typingClick = ctx.createBiquadFilter();
    typingClick.type = "bandpass";
    typingClick.frequency.value = TYPING_CLICK_HZ;
    typingClick.Q.value = 0.9;
    const typingAmp = ctx.createGain();
    typingAmp.gain.value = 0;
    typingClick.connect(typingAmp);
    typingAmp.connect(bus);
    this.typingClick = typingClick;
    this.typingAmp = typingAmp;

    this.humAmp = humAmp;
    this.refreshHum();
  }

  /** WOE — a 60 Hz minor drone that sags. */
  /**
   * The four tempers, rebuilt as disturbances of the mains hum.
   *
   * Everything below is made from the hum's own family — 50Hz, its
   * harmonics, and near-neighbours of them — so a temper never sounds
   * like an instrument playing over the room tone: it sounds like the
   * room tone going slightly wrong. What tells the four apart is not
   * pitch or melody but *time*: how the disturbance moves.
   *
   *   WO  the hum grown heavy   — a slow 1.6Hz mourning beat, low.
   *   FC  the hum flickering    — bright harmonics chattering at 7Hz.
   *   DR  the hum straining     — a tense 3Hz waver with an 11Hz shiver.
   *   MA  the hum fouled        — a distorted buzz surging in and out.
   *
   * The probe drives the same disturbance harder (apply() opens each
   * voice's filter and raises its gain with intensity), so what you hear
   * under the lens is recognisably the thing you half-heard in the room —
   * louder and closer, never a different sound.
   */
  private buildWoe(ctx: AudioContext, out: GainNode): VoiceParam {
    const amp = ctx.createGain();
    amp.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 140;
    filter.Q.value = 1.4;

    // 50 against 48.4: a 1.6Hz beat, the transformer swelling and sagging
    // like slow breathing. The 25Hz sub gives it weight without pitch.
    const a = ctx.createOscillator();
    a.type = "sine";
    a.frequency.value = 50;
    const b = ctx.createOscillator();
    b.type = "sine";
    b.frequency.value = 50 - 1.8;
    const sub = ctx.createOscillator();
    sub.type = "triangle";
    sub.frequency.value = 25;

    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    a.connect(mix);
    b.connect(mix);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.6;
    sub.connect(subGain).connect(mix);

    // And the whole thing sighs: the cutoff drags down and back, slower
    // than the beat, so no two swells are quite alike.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.51;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 40;
    lfo.connect(lfoDepth).connect(filter.frequency);

    mix.connect(filter).connect(amp).connect(out);
    [a, b, sub, lfo].forEach((o) => o.start());

    return {
      amp,
      filter,
      oscillators: [a, b, sub, lfo],
      baseCutoff: 120,
      peakCutoff: 340,
      peakGain: 1.0,
      // Bench-tuned: most of the probe level while merely present, the
      // last stretch saved for the lens itself.
      bed: 0.8,
    };
  }

  private buildFrolic(ctx: AudioContext, out: GainNode): VoiceParam {
    const amp = ctx.createGain();
    amp.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1000;
    filter.Q.value = 0.9;

    // The hum's 6th and 8th harmonics, chattering at ballast speed. High
    // enough to sit clearly above the 50-150Hz floor — the previous 190Hz
    // carrier vanished into it — and still the same electricity, because
    // they are exact multiples of the mains. The flicker is nearly full
    // depth: frolic's character is the chatter, not the tone.
    const h6 = ctx.createOscillator();
    h6.type = "sine";
    h6.frequency.value = 300;
    const h8 = ctx.createOscillator();
    h8.type = "sine";
    h8.frequency.value = 400;

    const mix = ctx.createGain();
    // Twice the drive of the low voices: at equal energy a fluttering
    // 300Hz pair still measures barely above the hum floor, and the whole
    // failure mode this rig exists for is frolic quietly vanishing.
    mix.gain.value = 1.0;
    h6.connect(mix);
    // Bench-zeroed: the 400Hz harmonic came out entirely — tuned frolic
    // is the bare 300Hz alone, slower and shallower than built. The node
    // stays wired at zero so brightness remains one number away.
    const h8Gain = ctx.createGain();
    h8Gain.gain.value = 0;
    h8.connect(h8Gain).connect(mix);

    const flicker = ctx.createGain();
    flicker.gain.value = 0.5;
    const flutter = ctx.createOscillator();
    flutter.type = "sine";
    flutter.frequency.value = 1.6;
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.12;
    flutter.connect(flutterDepth).connect(flicker.gain);

    mix.connect(flicker).connect(filter).connect(amp).connect(out);
    [h6, h8, flutter].forEach((o) => o.start());

    return {
      amp,
      filter,
      oscillators: [h6, h8, flutter],
      baseCutoff: 900,
      peakCutoff: 2400,
      peakGain: 0.3,
      bed: 0.2,
    };
  }

  private buildDread(ctx: AudioContext, out: GainNode): VoiceParam {
    const amp = ctx.createGain();
    amp.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;
    filter.Q.value = 1.6;

    // The hum's second harmonic against a neighbour 3Hz off — too fast to
    // breathe with, too slow to be a texture: an uneasy waver. The 11Hz
    // shiver on top is the sound of something held too tight, matched in
    // spirit to the visual tremor without trying to race the display.
    const a = ctx.createOscillator();
    a.type = "sine";
    a.frequency.value = 100;
    const b = ctx.createOscillator();
    b.type = "sine";
    b.frequency.value = 100 + 8;

    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    a.connect(mix);
    b.connect(mix);

    const trem = ctx.createOscillator();
    trem.type = "sine";
    trem.frequency.value = 11.5;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.5;
    const tremTarget = ctx.createGain();
    tremTarget.gain.value = 0.5;
    trem.connect(tremDepth).connect(tremTarget.gain);

    mix.connect(tremTarget).connect(filter).connect(amp).connect(out);
    [a, b, trem].forEach((o) => o.start());

    return {
      amp,
      filter,
      oscillators: [a, b, trem],
      baseCutoff: 260,
      peakCutoff: 1000,
      // Above 1 on purpose: the bench's slider topped out and playtesting
      // asked for more. The limiter is what keeps four beds honest.
      peakGain: 1.3,
      bed: 0.65,
    };
  }

  private buildMalice(ctx: AudioContext, out: GainNode): VoiceParam {
    const amp = ctx.createGain();
    amp.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    filter.Q.value = 1.2;

    // The hum fouled: its second harmonic squared off and its own root a
    // fifth-ish below as a saw, pushed through the distortion curve so the
    // result is grain rather than tone, surging in and out slower than
    // breathing — something leaning on the line, then easing off.
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 100;
    const growl = ctx.createOscillator();
    growl.type = "sawtooth";
    growl.frequency.value = 55;

    const pre = ctx.createGain();
    pre.gain.value = 0.4;
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(60);
    shaper.oversample = "2x";

    const surge = ctx.createGain();
    surge.gain.value = 0.69;
    const surgeLfo = ctx.createOscillator();
    surgeLfo.type = "sine";
    surgeLfo.frequency.value = 0.75;
    const surgeDepth = ctx.createGain();
    surgeDepth.gain.value = 0.31;
    surgeLfo.connect(surgeDepth).connect(surge.gain);

    osc.connect(pre);
    growl.connect(pre);
    pre.connect(shaper).connect(surge).connect(filter).connect(amp).connect(out);
    [osc, growl, surgeLfo].forEach((o) => o.start());

    return {
      amp,
      filter,
      oscillators: [osc, growl, surgeLfo],
      baseCutoff: 320,
      peakCutoff: 1500,
      peakGain: 0.5,
      bed: 0.12,
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
    this.typingAmp?.gain.setTargetAtTime(
      this.muted ? 0 : TYPING_GAIN,
      ctx.currentTime,
      HUM_SMOOTH,
    );
  }

  /**
   * One keystroke: a click of noise through the shared bandpass and a low
   * thump, both with fast envelopes. The BufferSource-per-shot pattern is
   * the same one every SFX here uses — sources are one-shot by design.
   */
  private clack(at: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || !this.typingClick) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.6 + Math.random() * 0.4, at + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.035 + Math.random() * 0.03);
    src.connect(env).connect(this.typingClick);
    src.start(at, Math.random() * 0.5, 0.09);

    // The thump under the click: the desk hearing the key.
    if (this.typingAmp && TYPING_THUMP > 0.01) {
      const th = ctx.createOscillator();
      th.type = "sine";
      th.frequency.setValueAtTime(150 + Math.random() * 60, at);
      const thEnv = ctx.createGain();
      thEnv.gain.setValueAtTime(0.0001, at);
      thEnv.gain.linearRampToValueAtTime(TYPING_THUMP * 0.5, at + 0.004);
      thEnv.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      th.connect(thEnv).connect(this.typingAmp);
      th.start(at);
      th.stop(at + 0.07);
    }
  }

  /** Human typing: bursts of keys with thinking pauses between them. */
  private scheduleTyping(now: number): void {
    if (this.muted || !this.typingAmp) return;
    if (now < this.typingNextAt) return;
    if (this.typingBurstLeft > 0) {
      this.clack(now + 0.01);
      this.typingBurstLeft--;
      const interval = 1 / TYPING_RATE;
      this.typingNextAt = now + interval * (0.6 + Math.random() * 0.8);
    } else {
      this.typingBurstLeft = 3 + Math.floor(Math.random() * 9);
      this.typingNextAt = now + 0.4 + Math.random() * 1.8;
    }
  }

  /** Set a temper's proximity intensity, 0..1. Cheap; call every frame. */
  setProximity(temper: Temper, intensity: number): void {
    this.proximity[temper] = clamp01(intensity);
    this.apply(temper, SMOOTH);
  }

  /**
   * The beds: every temper with a group on screen plays at once, each at
   * its own bench-tuned intensity, layered over the hum. Playtesting
   * chose the chord over the soloist — the room sounds like everything
   * that is in it, and a temper dissolves out as its last group is
   * refined. `tempers` is presence; the per-voice `bed` decides how
   * loud presence is.
   */
  setAmbient(tempers: ReadonlySet<Temper> | null): void {
    for (const t of Object.keys(this.ambient) as Temper[]) {
      const next = tempers?.has(t) ? 1 : 0;
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
    const bed = this.ambient[temper] * (voice?.bed ?? 0) * duck;
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

  /**
   * Per-frame upkeep. The voices used to schedule notes from here —
   * frolic's arpeggio, malice's kick — but a note is a performance, and
   * the redesign has no performances: every temper is a continuous
   * disturbance whose LFOs run themselves. Only the hum needs
   * re-asserting, so it comes back after a hardStop; one setTargetAtTime
   * on an already-settled param costs nothing.
   */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.muted) return;
    this.refreshHum();
    this.scheduleTyping(ctx.currentTime);
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

  // ── the dance experience ────────────────────────────────────────────
  //
  // Synthesised like everything else here, and for the same reason: this
  // repository ships no audio files, and a licensed recording is a rights
  // question the canon audit has not answered. What it plays is an
  // original, angular, upright-bass-and-brushes figure — defiant-jazz
  // *inspired*, in the specification's words, never the show's recording.

  /** Walking bass, in semitones over the root, one step per beat. */
  private static readonly WALK = [0, 3, 5, 6, 7, 10, 7, 5];

  /**
   * One beat of the bed. The caller owns the clock — the beat map, the
   * lit digits, the release window and this note all come off the same
   * one, which is what makes the floor feel like it is on the music
   * rather than beside it.
   */
  mdeBeat(step: number, bpm: number): void {
    const beatS = 60 / bpm;
    const semis = AudioEngine.WALK[((step % 8) + 8) % 8];
    const root = 98; // G2, low enough to sit under the phosphor.
    const f = root * Math.pow(2, semis / 12);
    this.blip("triangle", f, f * 0.995, beatS * 0.9, 0.22);
    // Brushes: a soft sweep every beat, an accent on two and four.
    const off = step % 4;
    this.noise(0.06, off === 1 || off === 3 ? 0.05 : 0.028, 7200);
    // A quiet horn on the top of each bar keeps the phrase turning over.
    if (off === 0) this.blip("sawtooth", f * 4, f * 4, 0.18, 0.05, 0.01);
  }

  /** A chain released on the beat. Longer chains climb. */
  mdeMerge(chain: number): void {
    const base = 392 * Math.pow(2, Math.min(4, chain - 3) / 12);
    this.blip("sawtooth", base, base * 1.5, 0.22, 0.12);
    this.blip("triangle", base * 2, base * 2, 0.3, 0.08, 0.05);
    this.noise(0.12, 0.05, 5200);
  }

  /**
   * A release that did not land. Deliberately soft and low: a miss costs
   * a multiplier, and the sound should not cost more than the rule does.
   */
  mdeMiss(): void {
    this.blip("sine", 140, 104, 0.2, 0.09);
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
    if (this.typingAmp) {
      this.typingAmp.gain.cancelScheduledValues(ctx.currentTime);
      this.typingAmp.gain.setValueAtTime(0, ctx.currentTime);
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

