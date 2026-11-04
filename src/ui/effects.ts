import { CARDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { HERO_IMAGES } from './sprite-heroes';
import type { CombatEvent, DotId, UnitRef } from '../core/types';
import { bake, C, Pix } from './pixel';
import { STATUS_INFO } from './render';
import { sfx, type Sfx } from './sound';

// ── 이펙트 스프라이트 시트 ──────────────────────────
// 프레임을 가로로 이어 붙인 시트를 만들고, CSS steps()로 한 칸씩 넘긴다.

export type FxKind =
  | 'slash' | 'steam' | 'arcane' | 'cogs' | 'bolt' | 'impact' | 'explosion' | 'shield'
  | 'flame' | 'charge' | 'powerup' | 'acid' | 'zap' | 'shockwave' | 'burst' | 'pillar';

interface Sheet {
  size: number;
  frames: number;
  ms: number;
  draw: (p: Pix, f: number) => void;
}

/** 프레임마다 같은 위치에 나오도록 고정된 난수 */
const jitter = (i: number) => (Math.sin(i * 12.9898) * 43758.5453) % 1;

/** 0~1 구간을 따라가는 호 위의 점 */
function arcPoint(s: number, cx: number, cy: number, r: number, a0: number, a1: number): [number, number] {
  const a = a0 + (a1 - a0) * s;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

function slash(p: Pix, f: number, edge: string): void {
  const head = Math.min(1, (f + 1) / 3);
  const tail = Math.max(0, (f - 1) / 3.5);
  const fade = f >= 3 ? 0.5 : 1;
  for (const [pass, color] of [[1, edge], [0, C.white]] as const) {
    for (let s = tail; s <= head; s += 0.02) {
      const [x, y] = arcPoint(s, 31, 31, 26, Math.PI * 1.02, Math.PI * 1.5);
      const w = Math.sin(Math.PI * s) * 3.6 * fade;
      if (w + pass > 0.4) p.circle(x, y, w + pass, color);
    }
  }
  if (f >= 3)
    for (let i = 0; i < 8; i++) {
      const [x, y] = arcPoint(i / 8, 30, 30, 24 - (f - 2) * 3 * jitter(i + 1), Math.PI * 1.02, Math.PI * 1.5);
      p.set(x + (f - 3) * 3, y - (f - 3) * 2, i % 2 ? edge : C.white);
    }
}

const SHEETS: Record<FxKind, Sheet> = {
  slash: { size: 32, frames: 6, ms: 300, draw: (p, f) => slash(p, f, C.brass3) },

  steam: {
    size: 32, frames: 6, ms: 360,
    draw: (p, f) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const d = 3 + f * 2.4;
        const r = 2.5 + f * 0.7 - (f >= 4 ? (f - 3) * 1.2 : 0);
        p.circle(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, r, f < 3 ? C.steam2 : C.steam1);
      }
      if (f < 3) p.circle(16, 16, 5 - f, C.white);
      if (f >= 4) for (let i = 0; i < p.data.length; i++) if ((i + Math.floor(i / 32)) % 2) p.data[i] = null;
    },
  },

  arcane: {
    size: 32, frames: 6, ms: 360,
    draw: (p, f) => {
      p.ring(16, 16, 3 + f * 2.4, f < 4 ? 2 : 1, f < 3 ? C.arc2 : C.arc1);
      if (f < 4) {
        const len = 8 - f * 2;
        p.line(16 - len, 16, 16 + len, 16, C.arc3).line(16, 16 - len, 16, 16 + len, C.arc3).circle(16, 16, 2 - f * 0.5, C.white);
      }
      for (let i = 0; i < 10; i++) {
        if (f < 1 || jitter(i + f) < 0.2) continue;
        const a = (i / 10) * Math.PI * 2;
        const d = 4 + f * 2.2 + jitter(i) * 3;
        p.set(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, i % 3 ? C.arc3 : C.cyan);
      }
    },
  },

  cogs: {
    size: 48, frames: 6, ms: 380,
    draw: (p, f) => {
      if (f < 2) p.circle(24, 24, 5 + f * 4, f ? C.brass3 : C.white);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const d = 5 + f * 3.6;
        const r = i % 2 ? 4 : 5;
        const [c, inner] = i % 2 ? [C.copper2, C.copper1] : [C.brass2, C.brass1];
        if (f < 5) p.gear(24 + Math.cos(a) * d, 24 + Math.sin(a) * d, r, 6, c, { depth: 2, hole: 1, inner, phase: f * 0.5 });
      }
      p.outline();
    },
  },

  bolt: {
    size: 32, frames: 6, ms: 340,
    draw: (p, f) => {
      const path: [number, number][] = [[18, 0], [13, 9], [19, 12], [12, 22], [17, 25], [14, 31]];
      const shown = Math.min(path.length, f * 2 + 2);
      if (f < 4) {
        const pts = path.slice(0, shown);
        p.poly(pts.map(([x, y]) => [x - 1, y] as [number, number]), C.heat).poly(pts.map(([x, y]) => [x + 1, y] as [number, number]), C.heat);
        p.poly(pts, f === 2 ? C.white : C.glow);
      }
      if (f >= 2) p.ring(15, 28, (f - 1) * 3, 1, f < 4 ? C.glow : C.heat);
      if (f === 2) p.circle(15, 28, 3, C.white);
    },
  },

  impact: {
    size: 32, frames: 5, ms: 260,
    draw: (p, f) => {
      const r = [3, 7, 10, 12, 13][f];
      const spikes = 8;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + 0.2;
        const len = r + (i % 2 ? 2 : 5);
        if (f < 4) p.line(16 + Math.cos(a) * (f > 1 ? r - 4 : 0), 16 + Math.sin(a) * (f > 1 ? r - 4 : 0), 16 + Math.cos(a) * len, 16 + Math.sin(a) * len, f < 2 ? C.white : C.red2);
        else p.set(16 + Math.cos(a) * len, 16 + Math.sin(a) * len, C.red2);
      }
      if (f < 2) p.circle(16, 16, r - 1, f ? C.glow : C.white);
      if (f === 2) p.ring(16, 16, r - 3, 2, C.heat);
    },
  },

  explosion: {
    size: 48, frames: 7, ms: 560,
    draw: (p, f) => {
      const smoke = f >= 4;
      const r = [5, 10, 14, 16, 17, 18, 19][f];
      if (!smoke) {
        p.circle(24, 24, r, C.red1).circle(24, 23, r - 3, C.heat).circle(23, 22, Math.max(1, r - 7), f < 2 ? C.white : C.glow);
      } else {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          p.circle(24 + Math.cos(a) * (r - 8), 22 + Math.sin(a) * (r - 8) - (f - 4) * 2, 6 - (f - 4), f === 4 ? C.steel1 : C.steel0);
        }
        if (f === 4) p.circle(24, 24, 5, C.heat);
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + jitter(i);
        const d = r + 3 + jitter(i + 7) * 4;
        if (f >= 1 && f < 6) p.set(24 + Math.cos(a) * d, 24 + Math.sin(a) * d, i % 2 ? C.glow : C.heat);
      }
      if (f >= 5) for (let i = 0; i < p.data.length; i++) if ((i + Math.floor(i / 48)) % 2) p.data[i] = null;
      p.outline();
    },
  },

  shield: {
    size: 32, frames: 5, ms: 320,
    draw: (p, f) => {
      const grow = [0.6, 1, 1.1, 1.1, 1.15][f];
      const w = Math.round(9 * grow), h = Math.round(10 * grow);
      const color = f === 1 ? C.white : f < 3 ? C.steam2 : C.steam1;
      for (let y = -h; y <= h; y++) {
        const half = y < 2 ? w : Math.round(w * (1 - (y - 2) / (h - 1)));
        if (f >= 3 && (y + f) % 2) continue;
        p.set(16 - half, 16 + y, color).set(16 + half, 16 + y, color);
      }
      p.line(16 - w, 16 - h, 16 + w, 16 - h, color);
      if (f === 1) p.circle(16, 14, 3, C.steam2);
    },
  },

  flame: {
    size: 32, frames: 7, ms: 440,
    draw: (p, f) => {
      const grow = [0.4, 0.8, 1, 1, 0.85, 0.6, 0.3][f];
      const tongues: [number, number][] = [[9, 0.7], [16, 1.2], [23, 0.8], [12, 0.9], [20, 0.95]];
      const outer = f >= 5 ? C.red1 : C.heat;
      tongues.forEach(([x, k], i) => {
        const h = Math.round(20 * k * grow * (0.85 + jitter(i + f) * 0.3));
        if (h < 2) return;
        p.spike(x, 29 - h, h, outer).ellipse(x, 27, Math.max(2, h / 3), 2, outer);
        const inner = Math.round(h * 0.55);
        if (inner > 1) p.spike(x, 29 - inner, inner, C.glow);
      });
      for (let i = 0; i < 6; i++) if (f >= 2) p.set(7 + i * 3.6, 22 - f * 3 - jitter(i) * 6, i % 2 ? C.glow : C.heat);
      p.outline(C.red0);
    },
  },

  acid: {
    size: 32, frames: 7, ms: 460,
    draw: (p, f) => {
      // 위에서 쏟아진 산이 바닥에 고이며 거품이 끓어오른다
      const pool = Math.min(1, f / 3);
      p.ellipse(16, 27, 4 + pool * 10, 1 + pool * 2.5, f >= 5 ? C.acid0 : C.acid1);
      for (let i = 0; i < 5; i++) {
        const x = 6 + i * 5;
        const y = 2 + f * 4 - jitter(i) * 8;
        if (y < 26 && f < 5) p.rect(x, y, 2, 3, i % 2 ? C.acid2 : C.acid1);
      }
      for (let i = 0; i < 6; i++) {
        if (f < 2) continue;
        const r = 1 + ((i + f) % 3);
        const y = 25 - (f - 2) * 3 - jitter(i + 3) * 6;
        if (f - 2 < 4) p.ring(5 + i * 4.4, y, r, 1, i % 2 ? C.acid2 : C.acid1);
      }
      p.outline(C.acid0);
    },
  },

  zap: {
    size: 32, frames: 6, ms: 320,
    draw: (p, f) => {
      // 사방으로 갈라지는 전류
      for (let i = 0; i < 5; i++) {
        if (f > 4) break;
        const a = (i / 5) * Math.PI * 2 + f * 0.9;
        let [x, y] = [16, 16];
        for (let s = 0; s < 4; s++) {
          const nx = x + Math.cos(a + (jitter(i * 7 + s + f) - 0.5) * 1.6) * 4;
          const ny = y + Math.sin(a + (jitter(i * 3 + s + f) - 0.5) * 1.6) * 4;
          p.line(x, y, nx, ny, s < 2 ? C.white : C.cyan);
          [x, y] = [nx, ny];
        }
      }
      if (f < 3) p.circle(16, 16, 3 - f, C.white);
      if (f >= 3) p.ring(16, 16, f * 2.5, 1, C.cyan);
      p.outline(C.arc0);
    },
  },

  charge: {
    size: 32, frames: 6, ms: 380,
    draw: (p, f) => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + f * 0.25;
        const d = 15 - f * 2.6;
        if (d > 1) p.rect(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, 2, 2, i % 2 ? C.steam2 : C.white);
      }
      if (f >= 3) p.circle(16, 16, f - 1.5, C.steam1).circle(16, 16, f - 3, C.white);
      if (f === 5) p.ring(16, 16, 9, 1, C.white);
    },
  },

  powerup: {
    size: 32, frames: 7, ms: 560,
    draw: (p, f) => {
      for (let k = 0; k < 3; k++) {
        const y = 30 - ((f * 4 + k * 9) % 27);
        const rx = 13 - k * 2;
        p.ellipse(16, y, rx, 3, k ? C.brass3 : C.glow).ellipse(16, y, rx - 2, 1.5, null);
      }
      for (let i = 0; i < 6; i++) {
        const y = 28 - ((f * 5 + i * 7) % 28);
        p.set(4 + i * 5, y, i % 2 ? C.white : C.glow).set(4 + i * 5, y + 1, C.brass2);
      }
    },
  },

  // 퍼져 나가는 충격파 고리 — 큰 타격 밑에 깐다
  shockwave: {
    size: 64, frames: 7, ms: 420,
    draw: (p, f) => {
      const r = 4 + f * 4.4;
      const t = f < 2 ? 4 : f < 4 ? 3 : 2;
      p.ring(32, 32, r, t, f < 2 ? C.white : f < 4 ? C.glow : C.heat);
      if (f < 3) p.ring(32, 32, Math.max(1, r - t - 2), 1, C.white);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + jitter(i) * 0.3;
        const d = r + 3 + jitter(i + f) * 4;
        if (f >= 1 && f < 6 && jitter(i * 5 + f) > 0.25) p.rect(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 2, 2, i % 3 ? C.glow : C.white);
      }
      if (f >= 5) for (let i = 0; i < p.data.length; i++) if ((i + Math.floor(i / 64)) % 2) p.data[i] = null;
    },
  },

  // 별처럼 뻗는 섬광 — 강타의 순간
  burst: {
    size: 48, frames: 5, ms: 240,
    draw: (p, f) => {
      const len = [10, 20, 23, 22, 16][f];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.13;
        const l = i % 2 ? len * 0.55 : len;
        const start = f >= 3 ? l * 0.5 : 0;
        p.line(24 + Math.cos(a) * start, 24 + Math.sin(a) * start, 24 + Math.cos(a) * l, 24 + Math.sin(a) * l, f < 2 ? C.white : C.glow);
      }
      if (f < 3) p.circle(24, 24, [6, 9, 5][f], C.white).circle(24, 24, [3, 5, 2][f], C.glow);
    },
  },

  // 바닥에서 치솟는 불기둥
  pillar: {
    size: 48, frames: 8, ms: 560,
    draw: (p, f) => {
      const h = [10, 30, 46, 48, 48, 40, 26, 12][f];
      const w = [6, 9, 11, 11, 10, 8, 6, 4][f];
      for (let y = 0; y < h; y++) {
        const yy = 47 - y;
        const wob = Math.round(Math.sin((y + f * 3) * 0.6) * 2);
        const ww = w * (1 - (y / 48) * 0.5);
        p.rect(24 - ww + wob, yy, ww * 2, 1, C.red1);
        p.rect(24 - ww * 0.65 + wob, yy, ww * 1.3, 1, C.heat);
        p.rect(24 - ww * 0.3 + wob, yy, ww * 0.6, 1, f < 5 ? C.glow : C.heat);
      }
      for (let i = 0; i < 8; i++) if (f >= 2) p.set(14 + jitter(i) * 20, 44 - ((f * 6 + i * 7) % 44), i % 2 ? C.glow : C.white);
      p.outline(C.red0);
    },
  },
};

export const FX_KINDS = Object.keys(SHEETS) as FxKind[];

function sheetURL(kind: FxKind): string {
  return bake(`fx:${kind}`, () => {
    const d = SHEETS[kind];
    const strip = new Pix(d.size * d.frames, d.size);
    for (let f = 0; f < d.frames; f++) {
      const frame = new Pix(d.size, d.size);
      d.draw(frame, f);
      strip.over(frame, f * d.size);
    }
    return strip;
  }).url;
}

/** 시트를 미리 구워 첫 타격 때 끊기지 않게 한다 */
export function preloadFx(): void {
  for (const kind of Object.keys(SHEETS) as FxKind[]) sheetURL(kind);
}

export function spawnFx(host: HTMLElement, kind: FxKind, scale = 4, dx = 0, dy = 0): void {
  const d = SHEETS[kind];
  const size = d.size * scale;
  const el = document.createElement('div');
  el.className = 'fx';
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`,
    `background-image:url(${sheetURL(kind)})`,
    `background-size:${size * d.frames}px ${size}px`,
    `--end:-${size * d.frames}px`,
    `animation-duration:${d.ms}ms`,
    `animation-timing-function:steps(${d.frames})`,
    `margin-left:${dx}px`, `margin-top:${dy}px`,
    `--glow:${FX_GLOW[kind]}`,
  ].join(';');
  host.appendChild(el);
  setTimeout(() => el.remove(), d.ms + 50);
}

/** 카드마다 어떤 타격 이펙트를 쓸지 — 기본은 계열별 */
const CARD_FX: Record<string, FxKind> = {
  gear_storm: 'cogs', grand_clock: 'cogs', overload_strike: 'bolt',
  heat_wave: 'flame', combustion: 'explosion', scald: 'flame',
  heat_release: 'flame', shield_bash: 'impact', hand_throw: 'slash', ether_drain: 'arcane',
  acid_flask: 'acid', dissolve: 'acid', tesla_coil: 'zap', arc_lash: 'zap', total_detonation: 'explosion',
  thermal_lance: 'flame', exhaust_blast: 'flame', gauge_strike: 'impact',
  // 카드가 아닌 피해원
  thorns: 'cogs', meltdown: 'explosion',
};
const DOT_FX: Record<DotId, FxKind> = { burn: 'flame', acid: 'acid', shock: 'zap' };
const FAMILY_SFX: Record<string, Sfx> = { gear: 'cardGear', steam: 'cardSteam', arcane: 'cardArcane' };
const DOT_SFX: Record<DotId, Sfx> = { burn: 'burn', acid: 'acid', shock: 'shock' };
const FAMILY_FX: Record<string, FxKind> = { gear: 'slash', steam: 'steam', arcane: 'arcane' };
/** 시전자에서 대상까지 증기 광선을 쏘는 카드 */
const BEAM_CARDS = new Set(['steam_cannon', 'steam_ram', 'skill:full_barrage']);

const FX_COLORS: Record<FxKind, string[]> = {
  slash: [C.white, C.brass3, C.brass2], steam: [C.steam2, C.white, C.steam1], arcane: [C.arc3, C.arc2, C.cyan],
  cogs: [C.brass2, C.copper2, C.brass3], bolt: [C.glow, C.white, C.heat], impact: [C.red2, C.heat, C.white],
  explosion: [C.heat, C.glow, C.red2], shield: [C.steam2, C.white], flame: [C.heat, C.glow, C.red2],
  charge: [C.steam2, C.white], powerup: [C.glow, C.brass3, C.white],
  acid: [C.acid1, C.acid2, C.acid0], zap: [C.cyan, C.white, C.arc3],
  shockwave: [C.white, C.glow, C.heat], burst: [C.white, C.glow], pillar: [C.heat, C.glow, C.red2],
};
/** 이펙트 뒤에 번지는 빛 색 */
const FX_GLOW: Record<FxKind, string> = {
  slash: '#f5dc7a', steam: '#d8eef4', arcane: '#a77bd9', cogs: '#f5dc7a', bolt: '#ffe066', impact: '#ff6a4d',
  explosion: '#f08a24', shield: '#8fb8c9', flame: '#f08a24', charge: '#d8eef4', powerup: '#ffe066',
  acid: '#8fd42e', zap: '#7ff3ff', shockwave: '#ffe066', burst: '#fffaf0', pillar: '#f08a24',
};
const FAMILY_COLOR: Record<string, string> = { gear: C.brass3, steam: C.steam2, arcane: C.arc3 };

const POSITIVE = new Set([
  'strength', 'flywheel', 'amplifier', 'furnace', 'compressor', 'autoloader', 'spring', 'pressure',
  'thorns', 'retain', 'heatsink', 'meltdown', 'kindling', 'acidPump', 'generator', 'residual', 'redline',
]);

function hitFx(ev: Extract<CombatEvent, { kind: 'hit' }>): FxKind {
  if (ev.source !== 'player') return 'impact';
  if (ev.cardId?.startsWith('skill:')) return SKILL_STYLE[ev.cardId.slice(6)]?.hit ?? 'explosion';
  const def = ev.cardId ? CARDS[ev.cardId] : undefined;
  return (ev.cardId && CARD_FX[ev.cardId]) || FAMILY_FX[def?.family ?? ''] || 'slash';
}

// ── 연출 조각들 ─────────────────────────────────────

/** 도트 파편이 사방으로 튀었다가 떨어진다 */
function sparks(host: HTMLElement, colors: string[], count: number, power = 1): void {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i');
    const a = Math.random() * Math.PI * 2;
    const d = (30 + Math.random() * 60) * power;
    const size = Math.random() < 0.3 ? 8 : 4;
    el.className = 'spark';
    el.style.cssText = [
      `--dx:${Math.round(Math.cos(a) * d / 4) * 4}px`,
      `--dy:${Math.round((Math.sin(a) * d - 24 * power) / 4) * 4}px`,
      `width:${size}px`, `height:${size}px`,
      `background:${colors[i % colors.length]}`,
      `animation-duration:${320 + Math.random() * 320}ms`,
    ].join(';');
    host.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }
}

function flashStage(stage: HTMLElement | null, color: string, ms = 160): void {
  if (!stage) return;
  const el = document.createElement('div');
  el.className = 'stage-flash';
  el.style.background = color;
  el.style.animationDuration = `${ms}ms`;
  stage.appendChild(el);
  setTimeout(() => el.remove(), ms + 20);
}

function banner(stage: HTMLElement | null, text: string, cls: string): void {
  if (!stage) return;
  stage.querySelector(`.banner.${cls}`)?.remove();
  const el = document.createElement('div');
  el.className = `banner ${cls}`;
  el.textContent = text;
  stage.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function comboCounter(stage: HTMLElement | null, n: number): void {
  if (!stage || n < 3) return;
  let el = stage.querySelector<HTMLElement>('.combo');
  if (!el) {
    el = document.createElement('div');
    el.className = 'combo';
    stage.appendChild(el);
  }
  el.innerHTML = `<span>${n}</span> 연속!`;
  el.style.fontSize = `${24 + Math.min(n, 12) * 3}px`;
  el.dataset.tier = n >= 8 ? '3' : n >= 5 ? '2' : '1';
  restartClass(el, 'pop', 300);
}

function castLabel(unit: HTMLElement, text: string, color: string): void {
  const el = document.createElement('div');
  el.className = 'cast';
  el.textContent = text;
  el.style.color = color;
  unit.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/** 시전자에서 대상까지 뻗는 증기 광선 */
function beam(stage: HTMLElement | null, from: HTMLElement, to: HTMLElement, cls = ''): void {
  if (!stage) return;
  const s = stage.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const x1 = a.right - s.left - 24;
  const el = document.createElement('div');
  el.className = `beam ${cls}`;
  el.style.left = `${x1}px`;
  el.style.top = `${b.top - s.top + b.height * 0.5}px`;
  el.style.width = `${Math.max(40, b.left - s.left + b.width / 2 - x1)}px`;
  stage.appendChild(el);
  setTimeout(() => el.remove(), 560);
}

/** 날아가는 투사체 스프라이트 */
const PROJECTILES: Record<string, () => Pix> = {
  arcane: () => new Pix(12, 12).circle(6, 6, 5, C.arc1).circle(6, 6, 4, C.arc2).circle(5, 5, 2, C.white).outline(C.arc0),
  steam: () => new Pix(12, 12).circle(6, 6, 5, C.steam1).circle(5, 5, 3, C.steam2).circle(4, 4, 1, C.white).outline(C.steam0),
  gear: () => new Pix(14, 14).gear(7, 7, 5, 6, C.brass2, { depth: 2, hole: 1, inner: C.brass1 }).outline(),
};

/** 시전자에서 대상으로 투사체를 날린다. 도착할 때 끝난다 */
function projectile(stage: HTMLElement | null, from: HTMLElement, to: HTMLElement, kind: keyof typeof PROJECTILES, ms = 170): Promise<void> {
  if (!stage) return Promise.resolve();
  const s = stage.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `projectile proj-${kind}`;
  const x0 = a.right - s.left - 20, y0 = a.top - s.top + a.height * 0.45;
  const x1 = b.left - s.left + b.width / 2, y1 = b.top - s.top + b.height * 0.5;
  el.style.cssText = [
    `left:${x0}px`, `top:${y0}px`, `--dx:${x1 - x0}px`, `--dy:${y1 - y0}px`,
    `background-image:url(${bake(`proj:${kind}`, PROJECTILES[kind]).url})`, `animation-duration:${ms}ms`,
  ].join(';');
  stage.appendChild(el);
  setTimeout(() => el.remove(), ms + 30);
  return wait(ms);
}

/** 필살기마다의 색과 연출. after는 컷인 직후, 효과가 터지기 전에 재생된다 */
interface SkillStyle {
  color: string;
  hit: FxKind;
  after: (stage: HTMLElement | null, player: HTMLElement, enemies: HTMLElement[]) => Promise<void>;
}

const SKILL_STYLE: Record<string, SkillStyle> = {
  clockwork_frenzy: {
    color: C.brass2, hit: 'cogs',
    after: async (stage, player) => {
      spawnFx(player, 'cogs', 7);
      spawnFx(player, 'powerup', 6);
      spawnFx(player, 'shockwave', 5);
      sparks(player, [C.brass3, C.glow, C.copper2, C.white], 36, 1.8);
      flashStage(stage, '#f5dc7a66', 260);
      sfx('power');
      await wait(380);
    },
  },
  furnace_burst: {
    color: C.heat, hit: 'flame',
    after: async (stage, player, enemies) => {
      spawnFx(player, 'flame', 6);
      flashStage(stage, '#f08a2477', 280);
      if (stage) restartClass(stage, 'quake-hard', 450);
      sfx('burn');
      for (const e of enemies) {
        spawnFx(e, 'pillar', 6);
        sparks(e, [C.heat, C.glow, C.red2], 24, 1.6);
        await wait(90);
      }
      await wait(260);
    },
  },
  full_barrage: {
    color: C.steam1, hit: 'explosion',
    after: async (stage, player) => {
      spawnFx(player, 'charge', 7);
      sparks(player, [C.steam2, C.white, C.steam1], 24, 1.2);
      sfx('overclock');
      await wait(300);
      flashStage(stage, '#d8eef499', 180);
    },
  },
  brass_fortress: {
    color: C.brass3, hit: 'impact',
    after: async (stage, player) => {
      spawnFx(player, 'shield', 9);
      spawnFx(player, 'shockwave', 6);
      sparks(player, [C.brass3, C.steam2, C.white], 30, 1.5);
      flashStage(stage, '#f5dc7a55', 240);
      if (stage) restartClass(stage, 'quake', 320);
      sfx('block');
      await wait(380);
    },
  },
  critical_break: {
    color: C.arc2, hit: 'bolt',
    after: async (stage, player, enemies) => {
      spawnFx(player, 'zap', 7);
      sparks(player, [C.cyan, C.arc3, C.heat], 30, 1.6);
      sfx('shock');
      flashStage(stage, '#a77bd988', 220);
      for (const e of enemies) {
        spawnFx(e, 'bolt', 6);
        spawnFx(e, 'shockwave', 4);
      }
      if (stage) restartClass(stage, 'quake-hard', 450);
      await wait(320);
    },
  },
};

/** 필살기 컷인 — 화면이 어두워지고, 띠가 가로지르며 캐릭터와 기술 이름이 들어온다 */
async function cutIn(stage: HTMLElement | null, skillId: string, color: string): Promise<void> {
  if (!stage) return;
  const owner = Object.values(CHARACTERS).find((c) => c.skill.id === skillId);
  const hero = owner ? HERO_IMAGES[owner.id] : undefined;
  const el = document.createElement('div');
  el.className = 'cutin';
  el.style.setProperty('--c', color);
  el.innerHTML = `
    <div class="cutin-dim"></div>
    <div class="cutin-band"><div class="cutin-lines"></div></div>
    ${hero ? `<img class="cutin-hero" src="${hero.url}" alt="">` : ''}
    <div class="cutin-text"><small>필살기</small><b>${owner?.skill.name ?? ''}</b></div>`;
  stage.appendChild(el);
  sfx('ultimate');
  setTimeout(() => el.remove(), 1150);
  await wait(950);
}

// ── 이벤트 재생 ─────────────────────────────────────

export interface UnitSnapshot {
  hp: number;
  maxHp: number;
  block: number;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const unitSelector = (ref: UnitRef) => (ref === 'player' ? '[data-player]' : `[data-enemy="${ref}"]`);

/** 애니메이션 클래스를 다시 붙였다가 끝나면 뗀다 (다른 애니메이션을 가리지 않도록) */
function restartClass(el: Element, cls: string, ms = 400): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

function floatText(unit: HTMLElement, cls: string, text: string): void {
  const stack = unit.querySelectorAll('.float').length;
  const pop = document.createElement('div');
  pop.className = `float ${cls}`;
  pop.textContent = text;
  pop.style.marginTop = `${stack * 26}px`;
  pop.style.marginLeft = `${(stack % 2 ? 1 : -1) * stack * 10}px`;
  unit.appendChild(pop);
  setTimeout(() => pop.remove(), 1100);
}

function setBar(unit: HTMLElement, hp: number, maxHp: number): void {
  const fill = unit.querySelector<HTMLElement>('.hpbar-fill');
  const label = unit.querySelector<HTMLElement>('.hpbar span');
  if (fill) fill.style.width = `${(hp / maxHp) * 100}%`;
  if (label) label.textContent = `${hp}/${maxHp}`;
}

/**
 * 전투 이벤트를 순서대로 연출한다.
 * 화면은 이미 최종 상태로 그려져 있으므로, 맞는 대상의 체력바를 행동 전 값으로 되돌려 놓고 한 대씩 깎는다.
 */
export async function playEvents(root: HTMLElement, events: CombatEvent[], before: Map<UnitRef, UnitSnapshot>): Promise<void> {
  const stage = root.querySelector<HTMLElement>('.stage');
  const unit = (ref: UnitRef) => root.querySelector<HTMLElement>(unitSelector(ref));
  const host = (el: HTMLElement) => el.querySelector<HTMLElement>('.sprite-wrap') ?? el;

  for (const ev of events) {
    if (ev.kind !== 'hit' && ev.kind !== 'breakdown' && ev.kind !== 'dot' && ev.kind !== 'heal') continue;
    const ref = ev.kind === 'breakdown' ? 'player' : ev.target;
    const snap = before.get(ref);
    const el = unit(ref);
    if (snap && el) setBar(el, snap.hp, snap.maxHp);
  }

  let hitsInCard = 0;
  let beamed = false;
  for (const ev of events) {
    switch (ev.kind) {
      case 'card': {
        hitsInCard = 0;
        beamed = false;
        const player = unit('player');
        const def = CARDS[ev.cardId];
        if (!player) break;
        castLabel(player, def.name, FAMILY_COLOR[def.family ?? ''] ?? C.cream);
        sfx(FAMILY_SFX[def.family ?? ''] ?? 'card');
        comboCounter(stage, ev.combo);
        if (ev.overclock) {
          sfx('overclock');
          banner(stage, '오버클록!', 'overclock');
          flashStage(stage, '#f08a2455', 200);
          sparks(host(player), [C.heat, C.glow, C.red2], 14, 1.2);
          await wait(160);
        }
        if (ev.mesh) {
          sfx('mesh');
          banner(stage, '⚙ 맞물림! ⚙', 'mesh');
          spawnFx(host(player), 'cogs', 3);
          flashStage(stage, '#f5dc7a33', 160);
          await wait(140);
        }
        if (ev.power) {
          sfx('power');
          spawnFx(host(player), 'powerup', 5);
          sparks(host(player), FX_COLORS.powerup, 10, 0.8);
          await wait(220);
        }
        if (ev.attack) {
          restartClass(player, 'lunge');
          await wait(110);
        }
        break;
      }
      case 'skill': {
        hitsInCard = 0;
        beamed = false;
        const style = SKILL_STYLE[ev.skillId];
        await cutIn(stage, ev.skillId, style?.color ?? C.glow);
        const player = unit('player');
        const enemies = [...root.querySelectorAll<HTMLElement>('.unit.enemy:not(.dead)')].map(host);
        if (player && style) await style.after(stage, host(player), enemies);
        break;
      }
      case 'enemyMove': {
        hitsInCard = 0;
        const el = unit(ev.enemy);
        if (el) restartClass(el, 'lunge');
        sfx('enemyMove');
        await wait(220);
        break;
      }
      case 'hit': {
        const el = unit(ev.target);
        if (!el) break;
        const player = unit('player');
        const skillHit = ev.cardId?.startsWith('skill:') ?? false;
        if (ev.cardId && BEAM_CARDS.has(ev.cardId) && player && !beamed) {
          beamed = true;
          sfx('beam');
          beam(stage, host(player), host(el), skillHit ? 'mega' : '');
          flashStage(stage, skillHit ? '#ffffffaa' : '#d8eef466', 140);
          await wait(skillHit ? 220 : 140);
        } else if (ev.source === 'player' && player && hitsInCard === 0 && ev.cardId && !skillHit) {
          // 원거리 계열은 투사체가 날아간 뒤에 맞는다
          const fam = CARDS[ev.cardId]?.family;
          if (fam === 'arcane' || fam === 'steam') await projectile(stage, host(player), host(el), fam);
          else if (ev.cardId === 'thorns') await projectile(stage, host(player), host(el), 'gear', 120);
        }
        const fx = hitFx(ev);
        const spread = hitsInCard++ * 18;
        const dx = spread * (hitsInCard % 2 ? 1 : -1), dy = -spread / 2;
        // 섬광 → 본 이펙트 → (세게 맞으면) 충격파 순으로 겹친다
        if (ev.damage > 0) spawnFx(host(el), 'burst', skillHit ? 5 : 3, dx, dy);
        spawnFx(host(el), fx, skillHit ? 6 : 4, dx, dy);
        if (skillHit || ev.damage >= 10) spawnFx(host(el), 'shockwave', skillHit ? 5 : 3, dx, dy);
        sparks(host(el), FX_COLORS[fx], (skillHit ? 16 : 8) + Math.min(ev.damage, 24) / 2, 0.9 + ev.damage / 25);
        restartClass(el, 'hit');
        if (ev.damage > 0) restartClass(el, ev.target === 'player' ? 'knock-left' : 'knock', 260);
        setBar(el, ev.hp, before.get(ev.target)?.maxHp ?? 1);

        const big = ev.damage >= 15 || (skillHit && ev.damage > 0);
        const crit = ev.damage >= 30;
        if (ev.damage === 0 && ev.blocked > 0) sfx('blocked');
        else if (ev.target === 'player') sfx('hurt');
        else sfx(crit ? 'hitCrit' : big ? 'hitBig' : 'hit');
        if (ev.damage > 0) floatText(el, crit ? 'dmg crit' : big ? 'dmg big' : 'dmg', crit ? `-${ev.damage}!` : `-${ev.damage}`);
        else if (ev.blocked > 0) floatText(el, 'shield', '막음');
        if (ev.damage + ev.blocked >= 12) restartClass(stage!, crit ? 'quake-hard' : 'quake');
        if (big) {
          flashStage(stage, crit ? '#ffffffaa' : '#ffffff55', crit ? 220 : 140);
          await wait(crit ? 180 : 90); // 히트 스톱
        }

        if (ev.target !== 'player' && ev.hp === 0) {
          spawnFx(host(el), 'explosion', 5);
          sparks(host(el), [C.heat, C.glow, C.white, C.steel2], 28, 2);
          flashStage(stage, '#ffe06644', 200);
          floatText(el, 'ko', '격파!');
          sfx('kill');
          await wait(200);
        }
        await wait(ev.target === 'player' ? 280 : Math.max(70, 170 - hitsInCard * 20));
        break;
      }
      case 'dot': {
        const el = unit(ev.target);
        if (!el) break;
        const fx = DOT_FX[ev.status];
        sfx(DOT_SFX[ev.status]);
        spawnFx(host(el), fx, 4);
        sparks(host(el), FX_COLORS[fx], 12, 1);
        restartClass(el, 'hit');
        floatText(el, ev.status, `${STATUS_INFO[ev.status].name} -${ev.damage}`);
        setBar(el, ev.hp, before.get(ev.target)?.maxHp ?? 1);
        if (ev.hp === 0) {
          spawnFx(host(el), 'explosion', 5);
          sparks(host(el), [C.heat, C.glow, C.red2], 24, 1.8);
          floatText(el, 'ko', '격파!');
        }
        await wait(ev.status === 'shock' ? 160 : 320);
        break;
      }
      case 'stunned': {
        const el = unit(ev.enemy);
        if (!el) break;
        floatText(el, 'debuff', '기절!');
        sfx('stun');
        sparks(host(el), [C.glow, C.white, C.arc3], 10, 0.6);
        spawnFx(host(el), 'arcane', 3);
        await wait(300);
        break;
      }
      case 'heal': {
        const el = unit(ev.target);
        if (!el) break;
        floatText(el, 'heal', `+${ev.amount}`);
        sfx('heal');
        sparks(host(el), [C.green1, C.white, C.green0], 10, 0.7);
        setBar(el, ev.hp, before.get(ev.target)?.maxHp ?? 1);
        await wait(160);
        break;
      }
      case 'cardAdded': {
        const el = unit('player');
        if (!el) break;
        floatText(el, 'debuff', `${CARDS[ev.cardId]?.name ?? ev.cardId} +${ev.count}`);
        sfx('debuff');
        await wait(160);
        break;
      }
      case 'block': {
        const el = unit(ev.target);
        if (!el) break;
        spawnFx(host(el), 'shield');
        floatText(el, 'shield', `+${ev.amount}`);
        sfx('block');
        await wait(140);
        break;
      }
      case 'status': {
        const el = unit(ev.target);
        if (!el) break;
        const info = STATUS_INFO[ev.status];
        const positive = POSITIVE.has(ev.status);
        const dot = ev.status in DOT_FX ? (ev.status as DotId) : null;
        floatText(el, dot ?? (positive ? 'buff' : 'debuff'), `${info.name} +${ev.amount}`);
        sfx(dot ? DOT_SFX[dot] : positive ? 'buff' : 'debuff');
        if (dot) spawnFx(host(el), DOT_FX[dot], 3);
        else if (ev.status === 'pressure') {
          spawnFx(host(el), 'charge', 5);
          sparks(host(el), FX_COLORS.charge, 8, 0.7);
        } else if (!positive) spawnFx(host(el), 'arcane', 3);
        await wait(140);
        break;
      }
      case 'breakdown': {
        const el = unit('player');
        if (!el) break;
        banner(stage, '고장!', 'overclock');
        sfx('breakdown');
        spawnFx(host(el), 'explosion', 5);
        sparks(host(el), [C.heat, C.glow, C.steel2, C.steel1], 24, 1.6);
        restartClass(el, 'hit');
        if (ev.damage > 0) floatText(el, 'dmg big', `-${ev.damage}`);
        else banner(stage, '폭주!', 'overclock');
        setBar(el, ev.hp, before.get('player')?.maxHp ?? 1);
        flashStage(stage, '#e0402a66', 240);
        if (stage) restartClass(stage, 'quake-hard');
        await wait(420);
        break;
      }
    }
  }
}
