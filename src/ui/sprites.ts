import { bake, C, Pix } from './pixel';
import { ENEMY_SPRITES } from './sprite-enemies';
import { HERO_IMAGES } from './sprite-heroes';

// 주인공은 sprite-heroes.ts, 적은 sprite-enemies.ts에 있다.

/** 정비소의 증기 보일러 */
function boiler(): Pix {
  const p = new Pix(40, 37);
  p.rect(10, 30, 3, 5, C.steel0).rect(25, 30, 3, 5, C.steel0);
  p.rect(8, 12, 22, 19, C.copper1).ellipse(19, 12, 11, 3, C.copper2);
  p.rect(8, 12, 2, 19, C.copper2).rect(28, 12, 2, 19, C.copper0);
  p.rect(8, 17, 22, 1, C.brass1).rect(8, 29, 22, 1, C.brass1);
  p.rect(13, 22, 12, 6, C.ink).rect(14, 24, 10, 4, C.heat).rect(16, 23, 2, 2, C.glow).rect(20, 24, 2, 2, C.glow).set(22, 23, C.glow);
  p.circle(19, 18, 3, C.cream).ring(19, 18, 3, 1, C.brass2).line(19, 18, 21, 16, C.red1);
  p.rect(30, 20, 6, 2, C.brass1).rect(34, 20, 2, 10, C.brass1).rect(32, 29, 6, 2, C.brass2);
  p.rect(23, 5, 4, 8, C.steel1).rect(22, 5, 6, 2, C.steel0).rect(23, 7, 1, 6, C.steel2);
  p.circle(27, 2, 1.5, C.steam2).circle(31, 3, 1, C.steam2);
  return p.outline();
}

/** 제목 화면의 큰 톱니 */
function bigGear(): Pix {
  const p = new Pix(44, 44);
  p.gear(22, 22, 19, 14, C.brass1, { hole: 4, inner: C.brass0, depth: 3 });
  p.ring(22, 22, 9, 2, C.brass2);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    p.line(22 + Math.cos(a) * 5, 22 + Math.sin(a) * 5, 22 + Math.cos(a) * 14, 22 + Math.sin(a) * 14, C.brass2);
  }
  return p.outline();
}

/** 이벤트 — 버려진 공구함 */
function toolbox(): Pix {
  const p = new Pix(34, 26);
  p.rect(3, 10, 28, 14, C.red1).rect(3, 10, 28, 2, C.red2).rect(3, 22, 28, 2, C.red0);
  p.rect(5, 6, 24, 5, C.red0).rect(5, 6, 24, 1, C.red1);
  p.rect(13, 1, 8, 2, C.steel2).rect(12, 2, 2, 5, C.steel2).rect(20, 2, 2, 5, C.steel2);
  p.rect(15, 14, 4, 3, C.brass2).set(17, 15, C.ink);
  // 튀어나온 연장
  p.line(7, 8, 9, 0, C.steel3).rect(8, 0, 3, 2, C.steel2);
  p.line(25, 9, 29, 2, C.brass1).circle(29, 2, 2, C.steel2).set(29, 2, null);
  p.gear(27, 18, 3, 6, C.brass2, { hole: 1 });
  return p.outline();
}

/** 이벤트 — 떠돌이 시계공 */
function clocksmith(): Pix {
  const p = new Pix(30, 42);
  // 등에 멘 태엽 상자
  p.rect(16, 8, 12, 16, C.brown2).rect(16, 8, 12, 2, C.brown3).gear(22, 16, 4, 6, C.brass2, { hole: 1.2, inner: C.brass1 });
  // 몸 · 망토
  p.rect(7, 16, 13, 18, C.brown1).rect(7, 16, 2, 18, C.brown2).rect(6, 30, 15, 4, C.brown1);
  p.rect(9, 34, 3, 6, C.ink).rect(15, 34, 3, 6, C.ink);
  // 머리 · 모자 · 수염
  p.circle(13, 11, 5, C.skin1).rect(7, 3, 12, 3, C.ink).rect(9, 0, 8, 4, C.ink).rect(9, 3, 8, 1, C.brass2);
  p.rect(9, 13, 9, 5, C.cream).rect(10, 18, 7, 2, C.cream);
  p.set(11, 10, C.ink).set(15, 10, C.ink).circle(15, 10, 2, null).ring(15, 10, 2, 1, C.brass3).set(15, 10, C.cyan);
  // 지팡이
  p.line(4, 14, 4, 40, C.brass1).circle(4, 13, 2, C.brass2);
  return p.outline();
}

/** 이벤트 — 마력 샘 */
function mana_spring(): Pix {
  const p = new Pix(40, 30);
  p.ellipse(20, 24, 17, 5, C.steel0).ellipse(20, 23, 14, 3, C.arc1).ellipse(18, 22, 7, 1, C.arc2);
  p.rect(2, 22, 5, 5, C.steel1).rect(33, 21, 5, 6, C.steel1).rect(9, 26, 4, 3, C.steel1).rect(27, 26, 5, 3, C.steel1);
  // 솟는 마력 줄기
  p.rect(18, 6, 4, 16, C.arc2).rect(19, 3, 2, 4, C.arc3).rect(19, 8, 1, 12, C.arc3);
  for (const [x, y] of [[12, 8], [27, 6], [9, 15], [31, 13], [15, 2], [25, 1]]) p.set(x, y, C.arc3).set(x + 1, y, C.arc2);
  return p.outline();
}

/** 이벤트 — 태엽 도박기 */
function slot_machine(): Pix {
  const p = new Pix(30, 38);
  p.rect(3, 6, 22, 30, C.copper1).rect(3, 6, 22, 2, C.copper2).rect(3, 34, 22, 2, C.copper0).rect(3, 6, 2, 30, C.copper2);
  p.rect(5, 1, 18, 6, C.brass1).rect(7, 2, 14, 3, C.red1).set(9, 3, C.glow).set(14, 3, C.glow).set(19, 3, C.glow);
  p.rect(6, 11, 16, 9, C.ink);
  for (const x of [7, 12, 17]) p.rect(x, 12, 4, 7, C.cream).gear(x + 2, 15, 1.5, 5, C.brass1);
  p.rect(8, 24, 12, 3, C.ink).rect(10, 25, 8, 1, C.brass2);
  p.rect(26, 12, 2, 12, C.steel2).circle(27, 11, 2, C.red2);
  return p.outline();
}

const SPRITES: Record<string, () => Pix> = {
  ...ENEMY_SPRITES,
  boiler, bigGear, toolbox, clocksmith, mana_spring, slot_machine,
};

export function spriteImg(key: string, scale = 4, cls = ''): string {
  const hero = HERO_IMAGES[key];
  if (hero) return `<img class="hero-img ${cls}" src="${hero.url}" width="${Math.round(hero.w * scale)}" height="${Math.round(hero.h * scale)}" alt="">`;
  const s = bake(`sprite:${key}`, SPRITES[key]);
  return `<img class="px ${cls}" src="${s.url}" width="${s.w * scale}" height="${s.h * scale}" alt="">`;
}

// ── 배경 ────────────────────────────────────────────

interface BackdropPalette {
  bg: string; bricks: [string, string, string]; brickHi: string;
  gear: string; gearInner: string;
  pipe: string; pipeHi: string; flange: string; flangeHi: string; vpipe: string;
  lamp: string; glowNear: string; glowFar: string;
  floor: string; floorHi: string; seam: string; dark: string;
  /** 구역 특색 장식 */
  extra?: (p: Pix) => void;
}

/** 구역별 배경 색 — 1: 녹슨 기관실, 2: 증기 배관망, 3: 마력 시계핵 */
const BACKDROPS: BackdropPalette[] = [
  {
    bg: '#1c140d', bricks: ['#2b1f15', '#30231a', '#271c13'], brickHi: '#37291d',
    gear: '#150f09', gearInner: '#1a120b',
    pipe: '#3b2c1f', pipeHi: '#5a432c', flange: '#4a3826', flangeHi: '#6a5238', vpipe: '#33261b',
    lamp: C.glow, glowNear: '#5a4220', glowFar: '#3d2c18',
    floor: '#2a2119', floorHi: '#4a3a2a', seam: '#1b140d', dark: '#0e0905',
  },
  {
    bg: '#0f1719', bricks: ['#1c2a2c', '#20302f', '#18262a'], brickHi: '#2a3b3c',
    gear: '#0a1113', gearInner: '#0e1719',
    pipe: '#6b3a20', pipeHi: '#b8693a', flange: '#8a4a2a', flangeHi: '#c87442', vpipe: '#5e3220',
    lamp: '#ffb066', glowNear: '#4a3020', glowFar: '#2a2420',
    floor: '#1e2628', floorHi: '#3a4a4c', seam: '#121a1c', dark: '#070c0d',
    extra: (p) => {
      // 배관에서 새는 증기
      for (const [x, y] of [[60, 52], [150, 50], [250, 53], [106, 20], [208, 30]])
        for (let i = 0; i < 4; i++) p.circle(x + i * 2, y - i * 3, 2 + i * 0.6, i % 2 ? '#3d5a66' : '#4f7280');
      // 두 번째 배관
      p.rect(0, 70, 300, 3, '#5e3220').rect(0, 70, 300, 1, '#97502c');
    },
  },
  {
    bg: '#120d1c', bricks: ['#221a35', '#271e3c', '#1e1730'], brickHi: '#30264a',
    gear: '#0c0816', gearInner: '#120d1e',
    pipe: '#3a2a55', pipeHi: '#6a3fa0', flange: '#4a3570', flangeHi: '#a77bd9', vpipe: '#2e2245',
    lamp: '#e2cbff', glowNear: '#3a2a5a', glowFar: '#261d3d',
    floor: '#1d1729', floorHi: '#3d3060', seam: '#120d1c', dark: '#08060e',
    extra: (p) => {
      // 떠다니는 마력 입자와 룬 고리
      for (let i = 0; i < 40; i++) p.set((i * 73) % 300, (i * 37) % 70, i % 3 ? '#6a3fa0' : '#a77bd9');
      p.ring(160, 34, 18, 1, '#3b2158').ring(160, 34, 12, 1, '#2c1a45');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        p.set(160 + Math.cos(a) * 15, 34 + Math.sin(a) * 15, '#6a3fa0');
      }
    },
  },
];

function backdrop(pal: BackdropPalette): Pix {
  const W = 300, H = 100;
  const p = new Pix(W, H);
  p.rect(0, 0, W, H, pal.bg);
  for (let row = 0; row * 6 < 78; row++) {
    const y = row * 6;
    for (let bx = -(row % 2) * 6; bx < W; bx += 12) {
      p.rect(bx + 1, y + 1, 11, 5, pal.bricks[Math.abs(bx * 7 + row * 13) % 3]);
      p.rect(bx + 1, y + 1, 11, 1, pal.brickHi);
    }
  }
  p.gear(48, 34, 30, 14, pal.gear, { hole: 9, inner: pal.gearInner, depth: 4 });
  p.gear(252, 26, 22, 12, pal.gear, { hole: 6, inner: pal.gearInner, depth: 3 });
  p.gear(160, 8, 14, 10, pal.gear, { hole: 4 });
  // 배관
  p.rect(0, 60, W, 5, pal.pipe).rect(0, 60, W, 1, pal.pipeHi).rect(0, 64, W, 1, C.ink);
  for (let x = 20; x < W; x += 50) p.rect(x, 59, 4, 7, pal.flange).rect(x, 59, 4, 1, pal.flangeHi);
  p.rect(104, 0, 4, 60, pal.vpipe).rect(104, 0, 1, 60, pal.flange);
  p.rect(206, 0, 4, 60, pal.vpipe).rect(206, 0, 1, 60, pal.flange);
  pal.extra?.(p);
  // 벽 램프 — 디더링으로 번지는 빛
  for (const lx of [80, 228]) {
    for (let y = -7; y <= 7; y++)
      for (let x = -7; x <= 7; x++) {
        const d = Math.hypot(x, y);
        if (d < 7 && (x + y) % 2 === 0) p.set(lx + x, 40 + y, d < 4 ? pal.glowNear : pal.glowFar);
      }
    p.rect(lx - 1, 35, 3, 2, C.brass0).circle(lx, 40, 2, pal.lamp).set(lx - 1, 39, C.white).rect(lx - 2, 43, 5, 1, C.brass0);
  }
  // 바닥
  p.rect(0, 78, W, 22, pal.floor).rect(0, 78, W, 2, pal.floorHi).rect(0, 80, W, 1, C.ink);
  for (let x = 0; x < W; x += 20) p.rect(x, 81, 1, 8, pal.seam).rect(x + 10, 90, 1, 10, pal.seam);
  p.rect(0, 89, W, 1, pal.seam);
  // 위쪽 어둠
  for (let y = 0; y < 10; y++) for (let x = 0; x < W; x++) if ((x + y) % 2 === 0 && y < 10 - (x % 3)) p.set(x, y, pal.dark);
  return p;
}

export const backdropURL = (act = 0) => bake(`backdrop:${act}`, () => backdrop(BACKDROPS[act] ?? BACKDROPS[0])).url;

// ── UI 프레임 (9-slice) ─────────────────────────────

function frame(fill: string, rim: string, light: string, dark: string, rivet: string): Pix {
  const p = new Pix(12, 12);
  p.rect(0, 0, 12, 12, C.ink);
  p.rect(1, 1, 10, 10, rim).rect(1, 1, 10, 1, light).rect(1, 1, 1, 10, light).rect(1, 10, 10, 1, dark).rect(10, 1, 1, 10, dark);
  p.rect(2, 2, 8, 8, C.ink).rect(3, 3, 6, 6, fill);
  p.set(0, 0, null).set(11, 0, null).set(0, 11, null).set(11, 11, null);
  p.set(2, 2, rivet).set(9, 2, rivet).set(2, 9, rivet).set(9, 9, rivet);
  return p;
}

const FRAMES: Record<string, () => Pix> = {
  panel: () => frame('#2a1e14', C.brass1, C.brass2, C.brass0, C.brass3),
  dark: () => frame('#18110b', C.brown2, C.brown3, C.brown1, C.brass2),
  gear: () => frame('#2b2014', C.brass2, C.brass3, C.brass0, C.white),
  steam: () => frame('#1c2328', C.steam0, C.steam1, C.steel0, C.steam2),
  arcane: () => frame('#22172e', C.arc1, C.arc2, C.arc0, C.arc3),
  none: () => frame('#211812', C.rust1, C.rust2, C.rust0, C.rust2),
  button: () => frame(C.brass2, C.brass1, C.brass3, C.brass0, C.white),
  buttonHot: () => frame(C.heat, C.copper1, C.copper3, C.copper0, C.glow),
};

/** 프레임 이미지를 CSS 변수(--frame-이름)로 등록한다 */
export function installFrames(): void {
  for (const [name, draw] of Object.entries(FRAMES))
    document.documentElement.style.setProperty(`--frame-${name}`, `url(${bake(`frame:${name}`, draw).url})`);
  document.documentElement.style.setProperty('--backdrop', `url(${backdropURL()})`);
}

// ── 아이콘 ──────────────────────────────────────────

const ICONS: Record<string, () => Pix> = {
  attack: () => {
    const p = new Pix(12, 12);
    p.line(3, 8, 9, 2, C.white).line(4, 8, 10, 2, C.steel3).set(10, 1, C.white);
    p.line(2, 6, 5, 9, C.brass2).set(2, 9, C.brown2).set(1, 10, C.brass1);
    return p.outline();
  },
  block: () => {
    const p = new Pix(12, 12);
    p.rect(2, 1, 8, 6, C.steam1).rect(3, 7, 6, 1, C.steam1).rect(4, 8, 4, 1, C.steam1).rect(5, 9, 2, 1, C.steam1);
    p.rect(2, 1, 8, 1, C.steam2).rect(2, 1, 1, 6, C.steam2).rect(5, 2, 2, 7, C.steam0);
    return p.outline();
  },
  buff: () => {
    const p = new Pix(12, 12);
    p.spike(6, 1, 6, C.green1).rect(5, 7, 3, 4, C.green1).rect(5, 7, 1, 4, C.green0);
    return p.outline();
  },
  debuff: () => {
    const p = new Pix(12, 12);
    p.circle(6, 5, 4, C.arc3).rect(4, 8, 5, 3, C.arc3);
    p.rect(3, 4, 2, 2, C.arc0).rect(7, 4, 2, 2, C.arc0).set(5, 10, C.arc1).set(7, 10, C.arc1);
    return p.outline();
  },
  heart: () => new Pix(11, 10).grid(1, 1, [
    '.rr.rr.',
    'rhhrrrr',
    'rhrrrrr',
    'rrrrrrd',
    '.rrrrd.',
    '..rrd..',
    '...d...',
  ], { r: C.red1, h: C.red2, d: C.red0 }).outline(),
  steamFull: () => {
    const p = new Pix(10, 13);
    p.rect(2, 3, 6, 8, C.steam1).rect(2, 3, 2, 8, C.steam2).rect(7, 3, 1, 8, C.steam0);
    p.rect(3, 1, 4, 2, C.brass2).rect(2, 11, 6, 1, C.brass1).rect(2, 6, 6, 1, C.brass1);
    return p.outline();
  },
  steamEmpty: () => {
    const p = new Pix(10, 13);
    p.rect(2, 3, 6, 8, C.steel0).rect(2, 3, 1, 8, C.steel1);
    p.rect(3, 1, 4, 2, C.brass0).rect(2, 11, 6, 1, C.brass0).rect(2, 6, 6, 1, C.brass0);
    return p.outline();
  },
  gear: () => new Pix(14, 14).gear(7, 7, 6, 8, C.brass2, { hole: 1.5, inner: C.brass1 }).outline(),
  chain: () => {
    const p = new Pix(14, 12);
    p.strokeRect(1, 2, 7, 5, C.steel3).strokeRect(6, 5, 7, 5, C.steel2);
    return p.outline();
  },
  heat: () => {
    const p = new Pix(12, 12);
    p.ellipse(6, 7, 4, 4, C.heat).spike(6, 1, 5, C.heat).ellipse(6, 8, 2, 2, C.glow);
    return p.outline();
  },
  deck: () => {
    const p = new Pix(12, 12);
    p.rect(3, 1, 7, 9, C.brown2).rect(1, 2, 7, 9, C.brass1).rect(2, 3, 5, 7, C.brown1).set(4, 6, C.brass3);
    return p.outline();
  },
  floor: () => {
    const p = new Pix(12, 12);
    p.rect(3, 2, 6, 9, C.copper1).spike(6, 0, 3, C.copper2).rect(5, 5, 2, 2, C.glow).rect(2, 10, 8, 1, C.copper0);
    return p.outline();
  },
  coin: () => {
    const p = new Pix(11, 11);
    p.circle(5, 5, 4.6, C.brass2).ring(5, 5, 4.6, 1, C.brass1).rect(4, 3, 3, 5, C.brass3).rect(5, 4, 1, 3, C.brass1);
    return p.outline();
  },
  // ── 지도 방 ──
  roomCombat: () => {
    const p = new Pix(14, 14);
    p.line(2, 11, 10, 3, C.steel3).line(3, 11, 11, 3, C.white).set(11, 2, C.white);
    p.line(11, 11, 3, 3, C.steel2).line(12, 11, 4, 3, C.steel3).set(3, 2, C.steel3);
    p.rect(1, 10, 3, 3, C.brass1).rect(10, 10, 3, 3, C.brass1);
    return p.outline();
  },
  roomElite: () => new Pix(15, 14).grid(1, 1, [
    'h.........h',
    'hh.sssss.hh',
    '.hsssssssh.',
    '.sssssssss.',
    '.srrsssrrs.',
    '.srrsssrrs.',
    '.sssssssss.',
    '..sss.sss..',
    '..sdsdsds..',
    '...sssss...',
  ], { h: C.red1, s: C.steel3, r: C.red2, d: C.ink }).outline(),
  roomRest: () => {
    const p = new Pix(14, 14);
    p.rect(2, 11, 10, 2, C.brown2).line(2, 12, 11, 9, C.brown3);
    p.ellipse(7, 8, 3, 3, C.heat).spike(7, 2, 5, C.heat).ellipse(7, 9, 1.5, 1.5, C.glow);
    return p.outline();
  },
  roomShop: () => {
    const p = new Pix(14, 14);
    p.rect(2, 5, 10, 8, C.brown3).rect(2, 5, 10, 2, C.brass1).rect(4, 2, 6, 4, null).strokeRect(4, 2, 6, 4, C.brass2);
    p.circle(7, 9, 2.2, C.brass2).rect(6, 8, 2, 2, C.brass3);
    return p.outline();
  },
  roomEvent: () => new Pix(12, 14).grid(1, 1, [
    '..aaaa..',
    '.aa..aa.',
    '.aa..aa.',
    '....aa..',
    '...aa...',
    '...aa...',
    '........',
    '...aa...',
    '...aa...',
  ], { a: C.arc3 }).outline(),
  roomTreasure: () => {
    const p = new Pix(15, 13);
    p.rect(1, 5, 13, 7, C.brown3).rect(1, 2, 13, 4, C.brown2).rect(1, 2, 13, 1, C.brown3);
    p.rect(1, 5, 13, 1, C.brass2).rect(3, 2, 1, 10, C.brass1).rect(11, 2, 1, 10, C.brass1).rect(6, 5, 3, 3, C.brass3).set(7, 6, C.ink);
    return p.outline();
  },
  roomBoss: () => {
    const p = new Pix(18, 18);
    p.circle(9, 9, 8, C.brass1).circle(9, 9, 6.5, C.cream);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      p.set(9 + Math.cos(a) * 5.5, 9 + Math.sin(a) * 5.5, C.brown2);
    }
    p.line(9, 9, 9, 4, C.ink).line(9, 9, 12, 11, C.red1).set(9, 9, C.red2);
    return p.outline();
  },
};

/** 모듈 아이콘 — 모양은 id로, 색은 계열(tone)로 정한다 */
const TONES: Record<string, [string, string, string]> = {
  copper: [C.copper0, C.copper2, C.copper3],
  steel: [C.steel1, C.steel2, C.steel3],
  brass: [C.brass1, C.brass2, C.brass3],
  arcane: [C.arc1, C.arc2, C.arc3],
};

export function moduleImg(id: string, tone: string, scale = 2, cls = ''): string {
  const s = bake(`module:${id}`, () => {
    const [dark, mid, light] = TONES[tone] ?? TONES.brass;
    const p = new Pix(16, 16);
    const shape = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 4;
    if (shape === 0) p.gear(8, 8, 6, 8, mid, { hole: 0, inner: dark }).circle(8, 8, 2.5, light).set(7, 7, C.white);
    else if (shape === 1) {
      p.rect(2, 3, 12, 10, dark).rect(3, 4, 10, 8, mid).rect(3, 4, 10, 1, light);
      for (const [x, y] of [[3, 4], [12, 4], [3, 11], [12, 11]]) p.set(x, y, C.steel3);
      p.circle(8, 8, 2, light).set(8, 8, C.white);
    } else if (shape === 2) {
      p.rect(4, 2, 8, 12, mid).rect(4, 2, 2, 12, light).rect(11, 2, 1, 12, dark).rect(3, 2, 10, 2, C.brass2).rect(3, 12, 10, 2, C.brass2);
      p.rect(7, 6, 2, 4, C.white);
    } else {
      p.circle(8, 8, 6, dark).ring(8, 8, 6, 1, mid).ring(8, 8, 3.5, 1, light).circle(8, 8, 1.5, C.white);
    }
    return p.outline();
  });
  return `<img class="px icon module-icon ${cls}" src="${s.url}" width="${s.w * scale}" height="${s.h * scale}" alt="">`;
}

export function iconImg(key: keyof typeof ICONS | string, scale = 2, cls = ''): string {
  const s = bake(`icon:${key}`, ICONS[key]);
  return `<img class="px icon ${cls}" src="${s.url}" width="${s.w * scale}" height="${s.h * scale}" alt="">`;
}
