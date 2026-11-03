// ── 소리 ────────────────────────────────────────────
// 음원 파일 없이 WebAudio로 칩튠풍 효과음과 배경음을 합성한다.
// 브라우저는 사용자가 한 번 클릭하기 전까지 소리를 막으므로 첫 클릭에서 unlock()한다.

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

const SETTINGS_KEY = 'overclock:sound';
export const settings = { sfx: true, music: true };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'));
} catch {
  // 저장소를 못 쓰면 기본값
}

function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 무시
  }
}

export function unlock(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = settings.sfx ? 1 : 0;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = settings.music ? 0.32 : 0;
  musicBus.connect(master);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  if (pendingMusic) startMusic(pendingMusic);
}

export function toggle(kind: 'sfx' | 'music'): void {
  settings[kind] = !settings[kind];
  saveSettings();
  if (kind === 'sfx' && sfxBus) sfxBus.gain.value = settings.sfx ? 1 : 0;
  if (kind === 'music' && musicBus) musicBus.gain.value = settings.music ? 0.32 : 0;
}

// ── 합성 도구 ──

interface ToneOpts {
  type?: OscillatorType;
  /** 시작·끝 주파수 (끝을 주면 미끄러진다) */
  from: number;
  to?: number;
  dur: number;
  vol?: number;
  delay?: number;
  bus?: GainNode | null;
}

function tone({ type = 'square', from, to, dur, vol = 0.2, delay = 0, bus = sfxBus }: ToneOpts): void {
  if (!ctx || !bus) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, opts: { vol?: number; delay?: number; filter?: BiquadFilterType; freq?: number; to?: number; bus?: GainNode | null } = {}): void {
  const bus = opts.bus === undefined ? sfxBus : opts.bus;
  if (!ctx || !bus || !noiseBuffer) return;
  const t = ctx.currentTime + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter ?? 'lowpass';
  filter.frequency.setValueAtTime(opts.freq ?? 2000, t);
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(opts.vol ?? 0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(bus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

const note = (n: number) => 440 * 2 ** ((n - 69) / 12);

// ── 효과음 ──

export type Sfx =
  | 'click' | 'card' | 'cardGear' | 'cardSteam' | 'cardArcane' | 'draw'
  | 'hit' | 'hitBig' | 'hitCrit' | 'hurt' | 'blocked' | 'block' | 'kill'
  | 'burn' | 'acid' | 'shock' | 'heal' | 'buff' | 'debuff' | 'stun'
  | 'mesh' | 'overclock' | 'breakdown' | 'beam' | 'power' | 'enemyMove'
  | 'turn' | 'victory' | 'defeat' | 'reward' | 'remove' | 'rest';

const SFX: Record<Sfx, () => void> = {
  click: () => tone({ from: 1400, to: 900, dur: 0.05, vol: 0.08 }),
  card: () => noise(0.08, { vol: 0.15, filter: 'highpass', freq: 2500 }),
  // 태엽: 째깍째깍 톱니
  cardGear: () => {
    for (let i = 0; i < 3; i++) tone({ from: 2200 - i * 300, dur: 0.025, vol: 0.12, delay: i * 0.035 });
  },
  // 증기: 칙 하는 바람 소리
  cardSteam: () => noise(0.22, { vol: 0.22, filter: 'bandpass', freq: 4000, to: 1200 }),
  // 마력: 반짝이는 상승음
  cardArcane: () => {
    tone({ type: 'triangle', from: note(76), to: note(88), dur: 0.18, vol: 0.14 });
    tone({ type: 'sine', from: note(83), dur: 0.2, vol: 0.08, delay: 0.06 });
  },
  draw: () => noise(0.04, { vol: 0.07, filter: 'highpass', freq: 5000 }),
  hit: () => {
    noise(0.1, { vol: 0.35, freq: 1800, to: 300 });
    tone({ from: 220, to: 70, dur: 0.1, vol: 0.18 });
  },
  hitBig: () => {
    noise(0.22, { vol: 0.5, freq: 2500, to: 150 });
    tone({ from: 160, to: 40, dur: 0.22, vol: 0.3 });
  },
  hitCrit: () => {
    noise(0.4, { vol: 0.6, freq: 3500, to: 80 });
    tone({ from: 130, to: 30, dur: 0.4, vol: 0.38 });
    tone({ type: 'sawtooth', from: 900, to: 200, dur: 0.15, vol: 0.12 });
  },
  hurt: () => {
    noise(0.15, { vol: 0.4, freq: 900, to: 150 });
    tone({ type: 'sawtooth', from: 180, to: 60, dur: 0.18, vol: 0.18 });
  },
  blocked: () => {
    tone({ from: 1800, to: 1200, dur: 0.08, vol: 0.12 });
    tone({ type: 'triangle', from: 600, dur: 0.12, vol: 0.12 });
  },
  block: () => {
    tone({ type: 'triangle', from: 300, to: 500, dur: 0.12, vol: 0.2 });
    noise(0.06, { vol: 0.1, filter: 'highpass', freq: 3000, delay: 0.02 });
  },
  kill: () => {
    noise(0.6, { vol: 0.55, freq: 1600, to: 60 });
    tone({ from: 110, to: 30, dur: 0.5, vol: 0.3 });
    for (let i = 0; i < 4; i++) tone({ from: 1800 + i * 400, dur: 0.03, vol: 0.06, delay: 0.1 + i * 0.05 });
  },
  burn: () => {
    noise(0.3, { vol: 0.28, filter: 'bandpass', freq: 1200, to: 400 });
    for (let i = 0; i < 4; i++) noise(0.02, { vol: 0.15, filter: 'highpass', freq: 4000, delay: Math.random() * 0.25 });
  },
  // 산성: 보글보글
  acid: () => {
    for (let i = 0; i < 5; i++) tone({ type: 'sine', from: 300 + Math.random() * 300, to: 900, dur: 0.06, vol: 0.14, delay: i * 0.05 });
    noise(0.25, { vol: 0.12, filter: 'bandpass', freq: 700 });
  },
  // 감전: 찌직
  shock: () => {
    for (let i = 0; i < 6; i++) tone({ type: 'square', from: 1500 + Math.random() * 1500, dur: 0.02, vol: 0.1, delay: i * 0.025 });
    noise(0.15, { vol: 0.2, filter: 'highpass', freq: 3000 });
  },
  heal: () => [72, 76, 79, 84].forEach((n, i) => tone({ type: 'triangle', from: note(n), dur: 0.14, vol: 0.14, delay: i * 0.06 })),
  buff: () => [67, 74, 79].forEach((n, i) => tone({ type: 'square', from: note(n), dur: 0.1, vol: 0.07, delay: i * 0.05 })),
  debuff: () => [70, 66, 61].forEach((n, i) => tone({ type: 'square', from: note(n), dur: 0.1, vol: 0.07, delay: i * 0.06 })),
  stun: () => {
    tone({ type: 'triangle', from: note(84), to: note(72), dur: 0.3, vol: 0.12 });
    tone({ type: 'triangle', from: note(88), to: note(76), dur: 0.3, vol: 0.08, delay: 0.08 });
  },
  mesh: () => {
    tone({ from: note(79), dur: 0.08, vol: 0.12 });
    tone({ from: note(86), dur: 0.16, vol: 0.12, delay: 0.07 });
  },
  overclock: () => {
    tone({ type: 'sawtooth', from: 200, to: 1200, dur: 0.25, vol: 0.14 });
    noise(0.25, { vol: 0.15, filter: 'bandpass', freq: 3000 });
  },
  breakdown: () => {
    for (let i = 0; i < 3; i++) tone({ type: 'square', from: 880, to: 660, dur: 0.12, vol: 0.12, delay: i * 0.16 });
    noise(0.7, { vol: 0.5, freq: 1200, to: 60, delay: 0.1 });
  },
  beam: () => {
    tone({ type: 'sawtooth', from: 120, to: 60, dur: 0.45, vol: 0.2 });
    noise(0.45, { vol: 0.4, filter: 'bandpass', freq: 2500, to: 600 });
  },
  power: () => [60, 64, 67, 72, 76].forEach((n, i) => tone({ type: 'square', from: note(n), dur: 0.09, vol: 0.08, delay: i * 0.045 })),
  enemyMove: () => tone({ type: 'triangle', from: 140, to: 90, dur: 0.1, vol: 0.14 }),
  // 턴 시작: 시계 종
  turn: () => {
    tone({ type: 'triangle', from: note(72), dur: 0.35, vol: 0.12 });
    tone({ type: 'sine', from: note(79), dur: 0.35, vol: 0.06, delay: 0.01 });
  },
  victory: () => [60, 64, 67, 72, 67, 72, 76].forEach((n, i) => tone({ type: 'square', from: note(n + 12), dur: 0.16, vol: 0.1, delay: i * 0.11 })),
  defeat: () => [67, 63, 60, 55].forEach((n, i) => tone({ type: 'triangle', from: note(n), dur: 0.4, vol: 0.16, delay: i * 0.25 })),
  reward: () => [72, 79].forEach((n, i) => tone({ type: 'square', from: note(n), dur: 0.12, vol: 0.09, delay: i * 0.08 })),
  remove: () => {
    noise(0.3, { vol: 0.3, filter: 'bandpass', freq: 2000, to: 300 });
    for (let i = 0; i < 4; i++) tone({ from: 1600 - i * 250, dur: 0.03, vol: 0.08, delay: i * 0.05 });
  },
  rest: () => [60, 67, 72].forEach((n, i) => tone({ type: 'triangle', from: note(n), dur: 0.5, vol: 0.12, delay: i * 0.15 })),
};

/** 같은 소리가 한 프레임에 겹쳐 터지는 것을 막는다 */
const lastPlayed = new Map<Sfx, number>();

export function sfx(name: Sfx): void {
  if (!ctx || !settings.sfx) return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? 0) < 30) return;
  lastPlayed.set(name, now);
  SFX[name]();
}

// ── 배경음 ──
// 16분음표 단위 순차 재생기. 구역마다 조성과 분위기가 다르다.

export type MusicId = 'title' | 'act0' | 'act1' | 'act2' | 'boss' | 'rest';

interface Song {
  bpm: number;
  /** 마디마다의 근음 (MIDI) — 4마디 반복 */
  roots: number[];
  /** 근음 기준 아르페지오 음정 */
  arp: number[];
  lead: 'square' | 'triangle';
  /** 째깍 소리(하이햇) 패턴 */
  tick: boolean;
  kick: boolean;
}

const SONGS: Record<MusicId, Song> = {
  title: { bpm: 84, roots: [57, 53, 55, 52], arp: [0, 7, 12, 15, 12, 7], lead: 'triangle', tick: true, kick: false },
  act0: { bpm: 104, roots: [45, 45, 41, 43], arp: [0, 3, 7, 10, 7, 3], lead: 'square', tick: true, kick: true },
  act1: { bpm: 112, roots: [43, 46, 41, 38], arp: [0, 7, 3, 7, 10, 7], lead: 'square', tick: true, kick: true },
  act2: { bpm: 96, roots: [47, 43, 45, 42], arp: [0, 6, 12, 15, 18, 12], lead: 'triangle', tick: true, kick: true },
  boss: { bpm: 132, roots: [40, 40, 41, 39], arp: [0, 12, 3, 12, 7, 12, 6, 12], lead: 'square', tick: true, kick: true },
  rest: { bpm: 72, roots: [48, 53, 45, 52], arp: [0, 4, 7, 12, 7, 4], lead: 'triangle', tick: false, kick: false },
};

let current: MusicId | null = null;
let pendingMusic: MusicId | null = null;
let timer: number | null = null;
let step = 0;
let nextTime = 0;

export function playMusic(id: MusicId): void {
  if (id === current) return;
  pendingMusic = id;
  if (ctx) startMusic(id);
}

function startMusic(id: MusicId): void {
  current = id;
  step = 0;
  if (timer !== null) clearInterval(timer);
  nextTime = ctx!.currentTime + 0.1;
  timer = window.setInterval(schedule, 50);
}

/** 조금 앞서서 음을 예약해 둔다 (타이머가 밀려도 박자가 흔들리지 않게) */
function schedule(): void {
  if (!ctx || !current) return;
  const song = SONGS[current];
  const sixteenth = 60 / song.bpm / 4;
  while (nextTime < ctx.currentTime + 0.2) {
    const delay = nextTime - ctx.currentTime;
    const bar = Math.floor(step / 16) % song.roots.length;
    const root = song.roots[bar];
    const s = step % 16;
    if (s % 4 === 0) tone({ type: 'triangle', from: note(root), dur: sixteenth * 3.5, vol: 0.5, delay, bus: musicBus });
    if (s % 2 === 0) {
      const n = root + 24 + song.arp[(step / 2) % song.arp.length];
      tone({ type: song.lead, from: note(n), dur: sixteenth * 1.6, vol: song.lead === 'square' ? 0.07 : 0.16, delay, bus: musicBus });
    }
    if (song.tick && s % 4 === 2) noise(0.03, { vol: 0.12, filter: 'highpass', freq: 7000, delay, bus: musicBus });
    if (song.kick && (s === 0 || s === 8)) tone({ type: 'sine', from: 150, to: 45, dur: 0.15, vol: 0.5, delay, bus: musicBus });
    nextTime += sixteenth;
    step++;
  }
}
