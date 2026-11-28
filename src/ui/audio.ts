/**
 * ÂM THANH tổng hợp bằng Web Audio - không có file âm thanh, không thư viện.
 * - Hiệu ứng (SFX): mỗi tên trong `Sfx` là một công thức nhỏ (sóng + bao biên độ + quét tần số / nhiễu).
 * - Nhạc nền: tự sinh giai điệu ngũ cung nhẹ nhàng trên vòng hợp âm I–vi–IV–V, lặp vô tận.
 * - Tiếng mưa: nhiễu lọc thấp, to nhỏ theo env.rain.
 * Trình duyệt chỉ cho phát tiếng sau thao tác đầu tiên của người chơi → gọi unlock() trong pointerdown.
 * Bật/tắt nhạc và hiệu ứng lưu trong localStorage (mỗi máy một cài đặt, không nằm trong save game).
 */

export type Sfx = 'click' | 'pop' | 'coin' | 'harvest' | 'dig' | 'water' | 'plant' | 'ripe' | 'serve' | 'bell' | 'sad' | 'error' | 'levelup' | 'dayEnd' | 'buy' | 'fanfare' | 'firework';

const PREFS_KEY = 'quan-nha-vuon/audio';
/** Khoảng cách tối thiểu (giây) giữa hai lần phát cùng một âm - tránh ồn khi nhiều chuyện xảy ra cùng lúc. */
const MIN_GAP = 0.07;

// Nốt (Hz): ngũ cung Đô trưởng qua nhiều quãng tám
const NOTE = (semi: number) => 261.63 * 2 ** (semi / 12); // semi tính từ C4
const PENTA = [0, 2, 4, 7, 9];
const CHORDS = [
  [0, 4, 7], // C
  [-3, 0, 4], // Am
  [-7, -3, 0], // F
  [-5, -1, 2], // G
];
const BPM = 84;

interface Prefs {
  music: boolean;
  sfx: boolean;
}

/** Âm lượng mặc định: tổng, hiệu ứng, nhạc nền (nhạc trước đây 0.22 - nhỏ quá trên máy tính). */
const MASTER = 1;
const SFX = 0.6;
const MUSIC = 0.5;

export class Sound {
  prefs: Prefs = { music: true, sfx: true };
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private rainGain!: GainNode;
  private noise!: AudioBuffer;
  private last = new Map<Sfx, number>();
  private nextBeat = 0;
  private beat = 0;
  private melodyNote = 2;

  constructor() {
    try {
      Object.assign(this.prefs, JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'));
    } catch {
      /* không đọc được thì dùng mặc định */
    }
  }

  /** Gọi trong sự kiện thao tác của người chơi (pointerdown) để trình duyệt cho phép phát tiếng. */
  unlock(): void {
    if (this.ctx) {
      // iOS / Android có thể tạm dừng (hoặc 'interrupted') khi chuyển app, khoá màn hình: thao tác kế tiếp thì bật lại
      if (this.ctx.state !== 'running') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());
    // Âm lượng tổng to hơn; bộ nén chặn vỡ tiếng khi nhiều âm cùng lúc
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = MASTER;
    this.master.connect(comp);
    this.sfxBus = this.bus(this.prefs.sfx ? SFX : 0);
    this.musicBus = this.bus(this.prefs.music ? MUSIC : 0);
    // iOS Safari chỉ thật sự "mở tiếng" khi có một âm phát ra ngay trong thao tác chạm: phát một mẫu im lặng
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, 22050);
    silent.connect(ctx.destination);
    silent.start(0);
    void ctx.resume();

    // Nhiễu trắng dùng chung (cuốc đất, tưới, mưa)
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Mưa: nhiễu lặp qua bộ lọc thấp, âm lượng chỉnh theo thời tiết
    const rain = ctx.createBufferSource();
    rain.buffer = this.noise;
    rain.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(lp).connect(this.rainGain).connect(this.sfxBus);
    rain.start();

    this.nextBeat = ctx.currentTime + 0.2;
    setInterval(() => this.scheduleMusic(), 120);
  }

  setMusic(on: boolean): void {
    this.prefs.music = on;
    this.savePrefs();
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? MUSIC : 0, this.ctx.currentTime, 0.3);
  }

  setSfx(on: boolean): void {
    this.prefs.sfx = on;
    this.savePrefs();
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? SFX : 0, this.ctx.currentTime, 0.05);
  }

  /** 0..1 - gọi mỗi khung hình với env.rain. */
  setRain(amount: number): void {
    if (this.ctx) this.rainGain.gain.setTargetAtTime(amount * 0.12, this.ctx.currentTime, 0.5);
  }

  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || !this.prefs.sfx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < MIN_GAP) return;
    this.last.set(name, now);
    const t = now + 0.005;
    switch (name) {
      case 'click':
        this.tone(1400, t, 0.035, { type: 'triangle', vol: 0.18 });
        break;
      case 'pop':
        this.tone(520, t, 0.09, { to: 980, vol: 0.35 });
        break;
      case 'plant':
        this.tone(440, t, 0.1, { to: 760, vol: 0.3 });
        this.tone(880, t + 0.07, 0.1, { to: 1200, vol: 0.18 });
        break;
      case 'coin':
        this.tone(1318.5, t, 0.07, { type: 'square', vol: 0.09 });
        this.tone(1975.5, t + 0.06, 0.22, { type: 'square', vol: 0.08 });
        break;
      case 'buy':
        this.tone(988, t, 0.06, { type: 'triangle', vol: 0.2 });
        this.tone(740, t + 0.05, 0.1, { type: 'triangle', vol: 0.18 });
        break;
      case 'harvest':
        [0, 4, 7, 12].forEach((s, i) => this.tone(NOTE(12 + s), t + i * 0.055, 0.16, { type: 'triangle', vol: 0.25 }));
        break;
      case 'ripe':
        this.tone(NOTE(28), t, 0.25, { vol: 0.12 });
        this.tone(NOTE(31), t + 0.08, 0.3, { vol: 0.1 });
        break;
      case 'dig':
        this.noiseBurst(t, 0.16, { type: 'lowpass', freq: 500, vol: 0.6 });
        this.tone(140, t, 0.1, { to: 70, vol: 0.35 });
        break;
      case 'water':
        this.noiseBurst(t, 0.35, { type: 'bandpass', freq: 2400, to: 900, vol: 0.35 });
        for (let i = 0; i < 3; i++) this.tone(700 + Math.random() * 500, t + 0.05 + i * 0.07, 0.06, { to: 1500, vol: 0.12 });
        break;
      case 'serve':
        this.tone(NOTE(24), t, 0.35, { type: 'triangle', vol: 0.22 });
        this.tone(NOTE(31), t, 0.35, { vol: 0.08 });
        break;
      case 'bell':
        this.tone(NOTE(28), t, 0.3, { vol: 0.14 });
        this.tone(NOTE(24), t + 0.13, 0.4, { vol: 0.14 });
        break;
      case 'sad':
        this.tone(330, t, 0.35, { to: 220, type: 'triangle', vol: 0.18 });
        break;
      case 'error':
        this.tone(200, t, 0.12, { type: 'square', vol: 0.06 });
        this.tone(170, t + 0.1, 0.14, { type: 'square', vol: 0.06 });
        break;
      case 'levelup':
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone(NOTE(12 + s), t + i * 0.09, i === 4 ? 0.6 : 0.18, { type: 'triangle', vol: 0.25 }));
        break;
      case 'fanfare':
        // Kèn mừng quán lên hạng: hai hợp âm rộn ràng + nốt ngân dài
        [0, 4, 7].forEach((s) => this.tone(NOTE(12 + s), t, 0.16, { type: 'square', vol: 0.07 }));
        [0, 4, 7].forEach((s) => this.tone(NOTE(12 + s), t + 0.18, 0.12, { type: 'square', vol: 0.07 }));
        [5, 9, 12].forEach((s) => this.tone(NOTE(12 + s), t + 0.32, 0.16, { type: 'square', vol: 0.07 }));
        [7, 12, 16, 19].forEach((s) => this.tone(NOTE(12 + s), t + 0.52, 0.9, { type: 'triangle', vol: 0.16 }));
        break;
      case 'firework':
        // Pháo hoa: tiếng rít bay lên rồi nổ lép bép
        this.tone(500, t, 0.35, { to: 1700, type: 'sine', vol: 0.05 });
        this.noiseBurst(t + 0.36, 0.3, { type: 'lowpass', freq: 1800, to: 300, vol: 0.45 });
        for (let i = 0; i < 6; i++) this.noiseBurst(t + 0.45 + i * 0.06 + Math.random() * 0.04, 0.04, { type: 'highpass', freq: 3000, vol: 0.18 });
        break;
      case 'dayEnd':
        [12, 7, 4, 0].forEach((s, i) => this.tone(NOTE(12 + s), t + i * 0.18, 0.5, { vol: 0.16 }));
        break;
    }
  }

  // ---------- Nội bộ ----------

  private bus(gain: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = gain;
    g.connect(this.master);
    return g;
  }

  private savePrefs(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      /* bỏ qua */
    }
  }

  /** Một nốt: tấn công nhanh, tắt dần theo hàm mũ; `to` = quét tần số tới. */
  private tone(freq: number, at: number, dur: number, o: { type?: OscillatorType; to?: number; vol?: number; out?: AudioNode } = {}): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + dur);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env).connect(o.out ?? this.sfxBus);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private noiseBurst(at: number, dur: number, o: { type: BiquadFilterType; freq: number; to?: number; vol: number }): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type;
    filter.frequency.setValueAtTime(o.freq, at);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, at + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(o.vol, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(env).connect(this.sfxBus);
    src.start(at, Math.random());
    src.stop(at + dur);
  }

  /** Lên lịch nhạc trước ~0.4 giây (chạy mỗi 120ms). Mỗi ô nhịp 8 phách móc, mỗi ô một hợp âm. */
  private scheduleMusic(): void {
    const ctx = this.ctx!;
    if (ctx.state !== 'running' || !this.prefs.music) {
      this.nextBeat = Math.max(this.nextBeat, ctx.currentTime + 0.1);
      return;
    }
    const step = 60 / BPM / 2;
    while (this.nextBeat < ctx.currentTime + 0.4) {
      const t = this.nextBeat;
      const bar = Math.floor(this.beat / 8) % CHORDS.length;
      const pos = this.beat % 8;
      const chord = CHORDS[bar];
      // Nền: hợp âm rải chậm, tiếng tròn
      if (pos === 0) chord.forEach((s, i) => this.tone(NOTE(s), t + i * 0.03, step * 7.5, { type: 'triangle', vol: 0.09, out: this.musicBus }));
      if (pos === 0 || pos === 4) this.tone(NOTE(chord[0] - 12), t, step * 3.5, { vol: 0.16, out: this.musicBus });
      // Giai điệu: đi từng bậc trong thang ngũ cung, thỉnh thoảng nghỉ
      if (Math.random() < (pos % 2 === 0 ? 0.7 : 0.3)) {
        this.melodyNote = Math.max(0, Math.min(9, this.melodyNote + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        const semi = 12 + PENTA[this.melodyNote % 5] + 12 * Math.floor(this.melodyNote / 5);
        this.tone(NOTE(semi), t, step * 1.6, { vol: 0.11, out: this.musicBus });
      }
      this.nextBeat += step;
      this.beat++;
    }
  }
}
