import { C, Pix } from './pixel';

// ── 적 스프라이트 ───────────────────────────────────
// 부위를 마스크(도형 함수)로 정의하고, 빛 방향(왼쪽 위)으로 4단계 음영을 입혀 쌓는다.
// 세부(눈, 리벳, 문양)는 직접 찍고, 마지막에 막(act)별 어두운 색으로 외곽선을 두른다.

type Mask = (x: number, y: number) => boolean;
type Ramp = readonly string[]; // [어둠, 그늘, 중간, 밝음, 반사광?]

/** 색 단계 — 그림자는 차갑게/붉게 색조를 틀었다 */
const R = {
  brass: ['#4a2c12', '#8c5c1f', '#c99433', '#f0cb5e', '#fff4bf'],
  copper: ['#3f1a16', '#7b3525', '#b65f3a', '#e09862', '#ffd6a8'],
  iron: ['#231d27', '#463e4a', '#6f6873', '#a29ca0', '#e2ddd4'],
  rust: ['#3a1810', '#6d2f16', '#9f4f22', '#cc7a37'],
  leather: ['#1d1012', '#3a1f1c', '#5e3526', '#88563a'],
  steel: ['#141c29', '#2b3b4f', '#536e87', '#91afc2', '#e6f6ff'],
  gunmetal: ['#0f131b', '#1f2733', '#36414f', '#55626f'],
  steam: ['#5a8194', '#93bccb', '#d2e9f0', '#f6fdff'],
  fire: ['#6e1610', '#c63a1b', '#f2832a', '#ffd04a', '#fff8cc'],
  arc: ['#160b2a', '#34195c', '#5f36a0', '#9d72dc', '#e6d5ff'],
  arcIron: ['#100b1a', '#262036', '#433b5a', '#6d6490', '#a9a2cc'],
  bone: ['#4b3c5c', '#8f7f9f', '#cdc1d6', '#f4eef3', '#ffffff'],
  dial: ['#8a7352', '#c4ad82', '#e9dbb6', '#fff8e4'],
  flesh: ['#1b0a28', '#41174f', '#702a80', '#a64fae', '#e39ade'],
  cyan: ['#0b4256', '#1597b0', '#5fe6ff', '#d6fcff'],
} as const;

const OUT = ['#1c110c', '#0d1219', '#12091d'] as const; // 막별 외곽선

// ── 색/도형 도구 ─────────────────────────────────────

const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)] / 16;

const ell = (cx: number, cy: number, rx: number, ry: number): Mask => (x, y) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const box = (x0: number, y0: number, w: number, h: number, r = 0): Mask => (x, y) => {
  if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false;
  const dx = Math.max(x0 + r - x, 0, x - (x0 + w - r)), dy = Math.max(y0 + r - y, 0, y - (y0 + h - r));
  return dx * dx + dy * dy <= r * r + 0.01;
};
/** 두 점을 잇는 굵은 막대 — 끝으로 갈수록 가늘게 할 수 있다 */
const cap = (x0: number, y0: number, x1: number, y1: number, r0: number, r1 = r0): Mask => (x, y) => {
  const vx = x1 - x0, vy = y1 - y0, L = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / L));
  const r = r0 + (r1 - r0) * t;
  return (x - x0 - vx * t) ** 2 + (y - y0 - vy * t) ** 2 <= r * r;
};
const poly = (pts: number[][]): Mask => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const or = (...ms: Mask[]): Mask => (x, y) => ms.some((m) => m(x, y));
const and = (...ms: Mask[]): Mask => (x, y) => ms.every((m) => m(x, y));
const sub = (a: Mask, b: Mask): Mask => (x, y) => a(x, y) && !b(x, y);
const ringM = (cx: number, cy: number, r: number, t: number) => sub(ell(cx, cy, r, r), ell(cx, cy, r - t, r - t));
/** 기울어진 타원 고리. half: 'back'은 위쪽 절반(몸 뒤), 'front'는 아래쪽 절반 */
const tiltRing = (cx: number, cy: number, rx: number, ry: number, t: number, ang: number, half?: 'back' | 'front'): Mask => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    if (half === 'back' && v > 0) return false;
    if (half === 'front' && v <= 0) return false;
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1 && (u / (rx - t)) ** 2 + (v / (ry - t)) ** 2 > 1;
  };
};
const gearM = (cx: number, cy: number, r: number, teeth: number, depth = 2, phase = 0): Mask => (x, y) => {
  const d = Math.hypot(x - cx, y - cy);
  const a = Math.atan2(y - cy, x - cx) + phase;
  return d <= (Math.cos(a * teeth) > -0.15 ? r : r - depth);
};
/** 위로 솟는 불꽃 혀 */
const flameM = (cx: number, base: number, w: number, h: number, lean = 0): Mask => (x, y) => {
  const t = (base - y) / h; // 0 아래 ~ 1 꼭대기
  if (t < -0.35 || t > 1) return false;
  const half = t < 0 ? w * Math.sqrt(1 - (t / 0.35) ** 2) : w * (1 - t) ** 0.8;
  return Math.abs(x - cx - lean * Math.max(0, t) ** 2 * h) <= half;
};

interface Shade {
  light?: [number, number]; // 빛이 오는 방향
  th?: number[]; // 밝음/중간/그늘 경계
  sep?: boolean; // 뒤 부위와 닿는 곳에 그림자 선
  core?: number[]; // 안쪽일수록 밝게 (불꽃, 발광체) — 가장자리로부터 거리 경계
}
const BACK = { th: [0.1, 0.32, 0.64] }; // 뒤쪽 부위는 한 단계 어둡게

/** 마스크를 칠한다. 빛 방향으로 가장자리까지의 거리 비율을 4단계 색으로 바꾼다. */
function solid(p: Pix, m: Mask, ramp: Ramp, o: Shade = {}): void {
  const [lx0, ly0] = o.light ?? [-0.55, -0.84];
  const n = Math.hypot(lx0, ly0), lx = lx0 / n, ly = ly0 / n;
  const th = o.th ?? [0.24, 0.55, 0.83];
  const run = (x: number, y: number, dx: number, dy: number) => {
    let d = 0, fx = x + 0.5, fy = y + 0.5;
    while (d < 220) {
      fx += dx * 0.5; fy += dy * 0.5;
      if (!m(fx, fy)) break;
      d++;
    }
    return d / 2;
  };
  const px: [number, number, string][] = [];
  const mine = new Set<number>();
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!m(x + 0.5, y + 0.5)) continue;
      let idx: number;
      if (o.core) {
        let d = 99;
        for (let k = 0; k < 8; k++) d = Math.min(d, run(x, y, Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)));
        idx = o.core.filter((c) => d >= c).length;
      } else {
        const d1 = run(x, y, lx, ly), d2 = run(x, y, -lx, -ly);
        const t = (d1 + 0.5) / (d1 + d2 + 1);
        idx = t < th[0] ? 3 : t < th[1] ? 2 : t < th[2] ? 1 : 0;
      }
      px.push([x, y, ramp[Math.min(idx, ramp.length - 1)]]);
      mine.add(y * p.w + x);
    }
  if (o.sep !== false) {
    const done = new Set<number>();
    for (const [x, y] of px)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = ny * p.w + nx;
        const c = p.get(nx, ny);
        if (!c || mine.has(k) || done.has(k)) continue;
        done.add(k);
        p.set(nx, ny, mix(c, '#12080f', 0.55));
      }
  }
  for (const [x, y, c] of px) p.set(x, y, c);
}

/** 발광 — 주변 픽셀을 빛 색으로 물들인다 */
function halo(p: Pix, cx: number, cy: number, r: number, c: string, k = 0.6): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), cur = p.get(x, y);
      if (cur && d < r) p.set(x, y, mix(cur, c, k * (1 - d / r) ** 1.3));
    }
}
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), s = (t: number) => t * t * (3 - 2 * t);
  const fx = s(x - xi), fy = s(y - yi);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};
/** 녹/얼룩 — 덩어리진 무늬로 기존 음영 위에 섞는다 */
function rust(p: Pix, m: Mask, amount: number, seed = 1, cs: Ramp = R.rust): void {
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const cur = p.get(x, y);
      if (!cur || !m(x + 0.5, y + 0.5)) continue;
      const n = vnoise(x / 3.2 + seed * 7.3, y / 3.2 + seed);
      if (n < 1 - amount) continue;
      const deep = n > 1 - amount * 0.45;
      if (!deep && bayer(x, y) > 0.5) continue;
      p.set(x, y, mix(cur, deep ? cs[1] : cs[2], 0.65));
    }
}
/** 리벳 — 밝은 점과 아래 그림자 */
function rivet(p: Pix, x: number, y: number, ramp: Ramp): void {
  p.set(x, y, ramp[4] ?? ramp[3]).set(x + 1, y, ramp[1]).set(x, y + 1, ramp[1]).set(x + 1, y + 1, ramp[0]);
}
function px(p: Pix, list: number[][], c: string): void {
  for (const [x, y] of list) p.set(x, y, c);
}
/** 아래쪽을 바이어 디더로 지워 흩어지게 */
function fade(p: Pix, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < p.w; x++) if (bayer(x, y) < (y - y0) / (y1 - y0 + 1)) p.set(x, y, null);
}
/** 빛나는 눈 — 중심 백열, 둘레 색, 주변 물들임 */
function eye(p: Pix, x: number, y: number, w: number, h: number, glow: Ramp, r = 4): void {
  halo(p, x + w / 2, y + h / 2, r, glow[2], 0.55);
  p.rect(x, y, w, h, glow[2]);
  if (w > 1 && h > 1) p.rect(x, y, w - 1, h - 1, glow[3]);
  p.set(x, y, glow[4] ?? glow[3]);
}
const AMBER: Ramp = ['#6e1a0c', '#c9471c', '#ff9a2e', '#ffe27a', '#fffbe0'];
const RED: Ramp = ['#4a0a0a', '#a8201a', '#ff4a32', '#ffa58a', '#fff0e6'];
const CYANG: Ramp = ['#0b4256', '#1597b0', '#4fdcf5', '#b6f7ff', '#ffffff'];
const VIOLET: Ramp = ['#2c0c4a', '#7a2ac0', '#c070ff', '#ecc4ff', '#ffffff'];

/** 시계 문자판 — 눈금과 바늘 */
function dial(p: Pix, cx: number, cy: number, r: number, hands: [number, number], ink: string, hand2: string): void {
  solid(p, ell(cx, cy, r, r), R.dial, { sep: false });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6, rr = r - 1.6;
    const x = cx + Math.sin(a) * rr, y = cy - Math.cos(a) * rr;
    p.set(Math.floor(x), Math.floor(y), ink);
    if (i % 3 === 0 && r > 7) p.set(Math.floor(cx + Math.sin(a) * (rr - 1)), Math.floor(cy - Math.cos(a) * (rr - 1)), ink);
  }
  const [a1, a2] = hands;
  p.line(Math.floor(cx), Math.floor(cy), Math.floor(cx + Math.sin(a1) * r * 0.75), Math.floor(cy - Math.cos(a1) * r * 0.75), ink);
  p.line(Math.floor(cx), Math.floor(cy), Math.floor(cx + Math.sin(a2) * r * 0.5), Math.floor(cy - Math.cos(a2) * r * 0.5), hand2);
  p.set(Math.floor(cx), Math.floor(cy), C.brass2);
}

// ── 1막: 녹슨 기관실 ────────────────────────────────

/** 태엽 자동인형 — 외눈 렌즈, 등에 큰 태엽 열쇠, 주먹을 치켜든 자세 */
function automaton(): Pix {
  const p = new Pix(46, 52);
  const W = p.w;
  // 뒤팔
  solid(p, cap(32, 26, 37, 33, 2.6), R.iron, BACK);
  solid(p, cap(37, 33, 37, 40, 2.6), R.iron, BACK);
  solid(p, ell(37, 42, 3.5, 3.2), R.iron, BACK);
  // 등의 태엽 열쇠
  solid(p, box(31, 27, 9, 3), R.brass);
  const bow = or(ell(42.5, 22, 3.4, 5), ell(42.5, 35, 3.4, 5), box(40, 25, 4, 8));
  solid(p, sub(bow, or(ell(42.5, 21.5, 1.2, 2.2), ell(42.5, 35.5, 1.2, 2.2))), R.brass);
  // 다리와 발
  solid(p, cap(27, 38, 28, 45, 3), R.iron, BACK);
  solid(p, and(ell(28.5, 48, 6, 3.6), box(0, 0, W, 51)), R.iron, BACK);
  solid(p, cap(17, 38, 16, 45, 3.2), R.iron);
  solid(p, and(ell(14.5, 48, 6.8, 3.8), box(0, 0, W, 51)), R.iron);
  // 몸통 — 구리 통
  const torso = ell(22.5, 30, 11.5, 10.5);
  solid(p, torso, R.copper);
  solid(p, and(torso, box(0, 33, W, 3)), R.brass, { sep: false });
  solid(p, gearM(20.5, 26.5, 4.6, 8, 1.4), R.brass);
  solid(p, ell(20.5, 26.5, 1.5, 1.5), R.iron, { sep: false });
  rivet(p, 14, 24, R.copper); rivet(p, 29, 24, R.copper); rivet(p, 22, 37, R.copper);
  // 목과 머리
  solid(p, box(18, 18, 7, 4), R.iron);
  const head = ell(21, 12.5, 8.6, 7.6);
  solid(p, head, R.brass);
  solid(p, and(head, box(0, 13, W, 8)), R.iron, { th: [0.1, 0.4, 0.75] });
  for (let x = 17; x <= 26; x += 2) p.rect(x, 17, 1, 2, R.iron[0]);
  solid(p, box(20, 2, 3, 3), R.brass);
  // 외눈 렌즈
  solid(p, ell(15.5, 12.5, 4.4, 4.4), R.brass, { light: [-1, -1] });
  solid(p, ell(15.5, 12.5, 3, 3), ['#3a0c06', '#7a1d0c', '#c9471c', '#ff9a2e'], { core: [0.6, 1.4, 2.2] });
  p.rect(14, 11, 2, 2, AMBER[3]).set(14, 11, AMBER[4]);
  halo(p, 15.5, 12.5, 7, AMBER[2], 0.35);
  // 앞팔 — 주먹을 치켜든 가드
  solid(p, cap(13, 27, 7, 32, 2.6), R.iron);
  solid(p, cap(7, 32, 6, 25, 2.9), R.iron);
  solid(p, ell(14, 24.5, 4.8, 4.2), R.brass);
  solid(p, ell(6, 22, 4.2, 3.8), R.iron);
  px(p, [[3, 21], [4, 21], [3, 23], [4, 23]], R.iron[1]);
  return p.outline(OUT[0]);
}

/** 톱니 거미 — 등에 세운 톱날 바퀴, 붉은 겹눈, 앞다리를 쳐든 자세 */
function spider(): Pix {
  const p = new Pix(50, 36);
  const leg = (pts: number[][], back: boolean) => {
    const sh = back ? BACK : {};
    for (let i = 1; i < pts.length; i++) {
      const last = i === pts.length - 1;
      solid(p, cap(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], last ? 1.5 : 1.8, last ? 0.6 : 1.5), R.iron, sh);
    }
    solid(p, ell(pts[1][0], pts[1][1], 1.9, 1.9), R.brass, { ...sh, light: [-1, -1] });
  };
  // 먼 쪽 다리
  leg([[20, 23], [12, 11], [5, 33]], true);
  leg([[31, 22], [41, 8], [48, 31]], true);
  // 톱날 바퀴
  solid(p, gearM(29, 12.5, 10.5, 12, 2.2), R.brass);
  solid(p, ell(29, 12.5, 6.6, 6.6), R.copper);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.4;
    solid(p, ell(29 + Math.cos(a) * 4, 12.5 + Math.sin(a) * 4, 1.3, 1.3), R.leather, { sep: false });
  }
  solid(p, ell(29, 12.5, 2, 2), R.iron);
  // 몸통과 머리
  solid(p, ell(24, 24, 9.5, 5.6), R.copper);
  rivet(p, 21, 20, R.copper); rivet(p, 27, 20, R.copper);
  solid(p, ell(13, 25, 5.6, 4.8), R.iron);
  for (const [x, y, s] of [[9, 22, 2], [12, 21, 2], [8, 25, 1], [11, 25, 1], [14, 24, 1]]) eye(p, x, y, s, s, RED, 3);
  solid(p, cap(9, 28, 7, 31, 1.2, 0.6), R.brass);
  solid(p, cap(12, 29, 12, 32, 1.2, 0.6), R.brass);
  // 가까운 쪽 다리
  leg([[17, 23], [9, 7], [2, 14]], false);
  leg([[21, 27], [15, 17], [11, 34]], false);
  leg([[28, 27], [34, 17], [37, 34]], false);
  leg([[32, 25], [43, 13], [48, 34]], false);
  return p.outline(OUT[0]);
}

/** 태엽 쥐 — 황동 몸에 열쇠, 용수철 꼬리, 붉은 눈 */
function rat(): Pix {
  const p = new Pix(38, 26);
  // 용수철 꼬리
  const tail = [[29, 18], [32, 19], [35, 18], [36, 15], [35, 12], [33, 11], [31, 12], [31, 14], [33, 15]];
  for (let i = 1; i < tail.length; i++) solid(p, cap(tail[i - 1][0], tail[i - 1][1], tail[i][0], tail[i][1], 0.9), R.copper, { sep: false });
  // 뒷바퀴
  solid(p, ell(27, 22, 2.8, 2.5), R.iron, BACK);
  // 몸통
  const body = or(ell(21, 16, 9.5, 6.5), ell(26, 16, 5.5, 6));
  solid(p, body, R.brass);
  p.line(17, 11, 17, 21, R.brass[1]);
  rivet(p, 23, 13, R.brass);
  // 머리
  solid(p, or(ell(11, 15.5, 5.5, 4.6), poly([[1.5, 18], [9, 11.5], [10, 20]])), R.brass);
  solid(p, ell(14, 8, 3.4, 4.4), R.copper);
  solid(p, ell(13.6, 8.6, 1.6, 2.6), ['#5a1f22', '#8a3a35', '#b85a50', '#d98070'], { sep: false });
  eye(p, 8, 14, 2, 2, RED, 3);
  px(p, [[1, 17], [2, 17]], '#3a1418');
  // 앞바퀴
  solid(p, ell(13, 22, 2.8, 2.5), R.iron);
  p.set(13, 22, R.iron[4]);
  p.set(27, 22, R.iron[3]);
  // 태엽 열쇠
  solid(p, box(21, 5, 2, 5), R.iron);
  solid(p, or(ell(18.5, 4, 2.8, 2), ell(25.5, 4, 2.8, 2)), R.iron);
  return p.outline(OUT[0]);
}

/** 기관실 경비병 — 방독면 투구, 가시 견갑, 가시 철퇴를 치켜든 녹슨 거구 */
function guard(): Pix {
  const p = new Pix(62, 64);
  const W = p.w;
  // 뒤팔
  solid(p, cap(48, 27, 53, 37, 4), R.iron, BACK);
  solid(p, cap(53, 37, 51, 45, 4.4), R.iron, BACK);
  solid(p, ell(51, 47, 5, 4.6), R.iron, BACK);
  // 다리
  solid(p, cap(40, 44, 41, 54, 4.6), R.iron, BACK);
  solid(p, and(ell(43, 58.5, 8, 4.5), box(0, 0, W, 63)), R.iron, BACK);
  solid(p, cap(25, 44, 23, 54, 5), R.iron);
  solid(p, and(ell(21, 58.5, 8.6, 4.6), box(0, 0, W, 63)), R.iron);
  solid(p, ell(24, 51, 3.4, 3), R.brass);
  // 허리 갑주
  solid(p, box(19, 39, 27, 8, 2), R.iron, { th: [0.15, 0.4, 0.7] });
  solid(p, box(19, 39, 27, 2), R.leather, { sep: false });
  solid(p, box(29, 38, 6, 4, 1), R.brass);
  // 몸통
  const torso = or(poly([[17, 21], [50, 21], [45, 41], [21, 41]]), ell(33.5, 24, 17, 8));
  solid(p, torso, R.iron);
  solid(p, poly([[22, 22], [46, 22], [43, 33], [25, 33]]), R.iron, { th: [0.3, 0.6, 0.9] });
  for (const x of [28, 34, 40]) p.line(x, 23, x - 1, 32, R.iron[1]);
  solid(p, ell(33, 35, 5.5, 4), R.brass);
  solid(p, ell(33, 35, 3.8, 2.6), R.leather, { sep: false });
  for (let x = 30; x <= 36; x += 2) p.rect(x, 33, 1, 5, '#ff6a32');
  halo(p, 33, 35, 8, '#ff5a2a', 0.35);
  rust(p, sub(torso, ell(33, 35, 6, 5)), 0.3, 3);
  // 뒤 어깨
  solid(p, ell(47, 23, 8, 6.5), R.iron, BACK);
  solid(p, and(ell(47, 23, 8, 6.5), box(0, 26, W, 2)), R.brass, { ...BACK, sep: false });
  // 방독면 투구
  solid(p, ell(33, 12, 8.5, 8), R.iron);
  solid(p, box(24, 11, 14, 10, 4), R.leather);
  for (const x of [26, 31.5]) {
    solid(p, ell(x, 13.5, 2.8, 2.8), R.brass, { light: [-1, -1] });
    solid(p, ell(x, 13.5, 1.6, 1.6), RED, { core: [0.5, 1.2], sep: false });
    p.set(Math.floor(x) - 1, 12, RED[4]);
    halo(p, x, 13.5, 4, RED[2], 0.3);
  }
  solid(p, cap(27, 18, 22, 21, 2.4), R.iron);
  solid(p, ell(20.5, 21.5, 3.2, 3.2), R.brass);
  px(p, [[19, 20], [19, 22], [20, 23]], R.brass[1]);
  // 앞팔과 철퇴
  solid(p, cap(17, 27, 13, 35, 4), R.iron);
  solid(p, cap(13, 35, 14, 41, 4.6), R.iron);
  solid(p, cap(17, 48, 6, 10, 1.4), R.leather);
  solid(p, ell(14, 41, 5, 5), R.iron);
  px(p, [[10, 39], [10, 41], [11, 43]], R.iron[1]);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    solid(p, cap(7 + Math.cos(a) * 5, 9 + Math.sin(a) * 5, 7 + Math.cos(a) * 9, 9 + Math.sin(a) * 9, 1.6, 0.5), R.iron, { sep: false });
  }
  solid(p, ell(7, 9, 6.4, 6.4), R.iron, { light: [-1, -1] });
  solid(p, and(ell(7, 9, 6.4, 6.4), box(0, 8, 20, 3)), R.brass, { sep: false });
  p.set(4, 5, R.iron[4]).set(5, 5, R.iron[3]);
  // 앞 가시 견갑
  for (const [x, h] of [[13, 7], [18, 8], [23, 6]]) solid(p, poly([[x - 2, 19], [x + 2, 19], [x - 1, 19 - h]]), R.iron, { light: [-1, -0.3] });
  const pad = ell(18, 23, 9, 7);
  solid(p, pad, R.iron);
  solid(p, and(pad, box(0, 27, W, 2)), R.brass, { sep: false });
  rivet(p, 14, 21, R.iron); rivet(p, 21, 20, R.iron);
  rust(p, or(pad, cap(25, 44, 23, 54, 5)), 0.26, 7);
  return p.outline(OUT[0]);
}

/** 시계탑 감시자 — 시계 문자판 가슴, 첨탑 달린 종 투구, 두 개의 시곗바늘 칼날 */
function warden(): Pix {
  const p = new Pix(88, 92);
  const W = p.w;
  // 등 뒤 톱니
  solid(p, sub(gearM(70, 19, 13, 12, 2.5), ell(70, 19, 4, 4)), R.copper, BACK);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + 0.2;
    solid(p, ell(70 + Math.cos(a) * 7.5, 19 + Math.sin(a) * 7.5, 1.9, 1.9), R.leather, { sep: false });
  }
  solid(p, sub(gearM(56, 9, 7, 9, 2), ell(56, 9, 2, 2)), R.copper, BACK);
  // 뒤팔 — 시침 칼날을 치켜든다
  solid(p, cap(64, 36, 73, 46, 4.4), R.iron, BACK);
  solid(p, cap(73, 46, 76, 32, 4.4), R.iron, BACK);
  solid(p, poly([[76, 36], [79, 33], [86, 4], [84, 3], [80, 6], [77, 26], [73, 31]]), R.steel, { light: [-1, -0.2] });
  solid(p, ell(84, 5, 3, 3), R.brass);
  solid(p, ell(76, 31, 4.6, 4.4), R.iron, BACK);
  // 코트
  const coat = poly([[28, 50], [62, 50], [74, 87], [14, 87]]);
  solid(p, coat, R.leather, { light: [-1, -0.3] });
  solid(p, and(coat, box(0, 83, W, 4)), R.brass, { sep: false });
  solid(p, poly([[45, 60], [53, 87], [37, 87]]), ['#0e0809', '#1b1012', '#2a1a1a', '#3a2420'], { sep: false });
  solid(p, box(44, 58, 2, 22), R.brass, { sep: false });
  solid(p, ell(45, 81, 4.5, 4.5), R.brass, { light: [-1, -1] });
  halo(p, 45, 81, 3, AMBER[3], 0.3);
  // 발
  solid(p, and(ell(28, 88.5, 7, 3.5), box(0, 0, W, 91)), R.iron);
  solid(p, and(ell(61, 88.5, 7, 3.5), box(0, 0, W, 91)), R.iron, BACK);
  // 몸통
  const torso = ell(44, 44, 19.5, 16);
  solid(p, torso, R.iron);
  rust(p, torso, 0.25, 11);
  solid(p, ell(42, 44, 13.2, 13.2), R.brass, { light: [-1, -1] });
  dial(p, 42, 44, 10.8, [-0.5, 1.9], '#3a2216', '#b8342a');
  p.poly([[50, 36], [47, 41], [50, 44], [47, 49]], '#5a3a26');
  halo(p, 42, 44, 12, '#fff2c0', 0.18);
  // 뒤 어깨
  solid(p, ell(62, 31, 8.5, 6.5), R.iron, BACK);
  solid(p, and(ell(62, 31, 8.5, 6.5), box(0, 34, W, 2)), R.brass, { ...BACK, sep: false });
  // 종 투구와 첨탑
  solid(p, poly([[41, 9], [45, 9], [43, 1]]), R.brass, { light: [-1, -0.2] });
  solid(p, ell(43, 1.5, 1.5, 1.5), R.brass, { sep: false });
  const helm = or(poly([[34, 12], [52, 12], [54, 20], [59, 28], [27, 28], [32, 20]]), ell(43, 13, 9.5, 5.5));
  solid(p, helm, R.iron);
  solid(p, and(helm, box(0, 25, W, 3)), R.brass, { sep: false });
  solid(p, and(helm, box(0, 10, W, 2)), R.brass, { sep: false });
  for (const x of [30, 37, 49, 56]) if (p.get(x, 26)) p.set(x, 26, R.brass[4]);
  solid(p, box(30, 17, 20, 5, 2), R.leather, { sep: false });
  eye(p, 32, 18, 4, 2, AMBER, 5);
  eye(p, 40, 18, 4, 2, AMBER, 5);
  // 앞팔 — 분침 칼날
  solid(p, cap(24, 36, 17, 47, 4.6), R.iron);
  solid(p, cap(17, 47, 13, 57, 4.6), R.iron);
  solid(p, poly([[11, 66], [14, 66], [11, 18], [14, 13], [9, 3], [5, 13], [8, 18]]), R.steel, { light: [-1, -0.2] });
  solid(p, sub(ell(9, 12, 3.4, 4), ell(9, 12, 1.4, 2)), R.brass);
  solid(p, ell(12.5, 68, 2.5, 2.5), R.brass);
  solid(p, ell(13, 58, 5.2, 4.8), R.iron);
  const pad = ell(25, 33, 10.5, 7.5);
  solid(p, pad, R.brass);
  solid(p, and(pad, box(0, 37, W, 3)), R.iron, { sep: false });
  rivet(p, 20, 30, R.brass); rivet(p, 28, 29, R.brass);
  return p.outline(OUT[0]);
}

// ── 2막: 증기 공장 ──────────────────────────────────

/** 증기 골렘 — 웅크린 강철 거구, 배의 화로, 등의 굴뚝 두 개 */
function golem(): Pix {
  const p = new Pix(64, 66);
  const W = p.w;
  // 굴뚝과 증기
  solid(p, cap(46, 22, 46, 7, 3), R.steel, BACK);
  solid(p, box(42, 5, 8, 3, 1), R.steel, BACK);
  solid(p, cap(55, 24, 55, 11, 2.5), R.steel, BACK);
  solid(p, box(52, 9, 7, 3, 1), R.steel, BACK);
  solid(p, or(ell(44, 2.5, 4, 2.5), ell(49, 1.8, 3, 1.8)), R.steam, { sep: false });
  solid(p, ell(56, 6, 2.5, 2), R.steam, { sep: false });
  // 뒤팔
  solid(p, cap(52, 32, 56, 46, 5), R.steel, BACK);
  solid(p, ell(55, 50, 7, 6), R.steel, BACK);
  // 다리
  solid(p, cap(44, 50, 45, 58, 5.2), R.gunmetal);
  solid(p, and(ell(47, 61, 8.5, 4), box(0, 0, W, 65)), R.steel, BACK);
  solid(p, cap(26, 50, 24, 58, 5.4), R.gunmetal);
  solid(p, and(ell(22, 61, 9, 4), box(0, 0, W, 65)), R.steel);
  // 몸통
  const body = or(ell(36, 36, 20, 16), ell(41, 26, 14, 10));
  solid(p, body, R.steel);
  solid(p, and(body, box(0, 46, W, 3)), R.copper, { sep: false });
  for (let x = 20; x < 52; x += 5) rivet(p, x, 46, R.copper);
  for (const [x, y] of [[38, 19], [46, 18], [52, 24]]) rivet(p, x, y, R.steel);
  // 화로
  solid(p, ell(33, 37, 8.5, 7.5), R.gunmetal);
  solid(p, ell(33, 37.5, 6, 5.2), R.fire, { core: [1, 2, 3, 4.5] });
  for (let x = 29; x <= 37; x += 3) p.rect(x, 32, 1, 12, R.gunmetal[1]);
  halo(p, 33, 37.5, 11, R.fire[2], 0.35);
  // 머리 — 어깨 사이로 내민 투구
  solid(p, box(13, 22, 16, 5, 2), R.copper);
  solid(p, or(box(12, 9, 17, 15, 5), ell(20.5, 10, 8, 4)), R.steel);
  solid(p, box(11, 14, 15, 4, 1), R.gunmetal, { sep: false });
  eye(p, 12, 15, 12, 2, AMBER, 7);
  for (let x = 15; x <= 23; x += 2) p.rect(x, 20, 1, 3, R.steel[0]);
  rivet(p, 25, 11, R.steel);
  // 앞팔
  solid(p, cap(18, 34, 13, 44, 5.6), R.steel);
  const sh = ell(21, 31, 8.5, 6.5);
  solid(p, sh, R.steel);
  solid(p, and(sh, box(0, 35, W, 3)), R.copper, { sep: false });
  rivet(p, 17, 28, R.steel); rivet(p, 23, 27, R.steel);
  solid(p, ell(12, 51, 8.5, 7), R.steel);
  px(p, [[5, 48], [5, 51], [6, 54], [8, 56]], R.steel[1]);
  p.set(9, 46, R.steel[4]).set(10, 46, R.steel[3]);
  return p.outline(OUT[1]);
}

/** 증기 박쥐 — 강철 막 날개, 등 배기관의 증기, 불씨 같은 눈 */
function bat(): Pix {
  const p = new Pix(60, 40);
  const memb = ['#121620', '#232a38', '#384257', '#55617a'] as const;
  for (const s of [-1, 1]) {
    const mx = (x: number) => (s === 1 ? x : 56 - x);
    const pts = [[24, 17], [17, 5], [6, 1], [1, 8], [2, 22], [7, 18], [10, 27], [15, 21], [19, 28], [24, 22]];
    const wing = poly(pts.map(([x, y]) => [mx(x), y]));
    const sh = s === 1 ? { light: [-0.3, -1] as [number, number] } : { ...BACK, light: [-0.3, -1] as [number, number] };
    solid(p, wing, memb, sh);
    for (const [x, y] of [[2, 22], [10, 27], [19, 28]]) p.line(mx(23), 16, mx(x), y, s === 1 ? R.steel[2] : R.steel[1]);
    p.line(mx(23), 15, mx(17), 5, s === 1 ? R.steel[3] : R.steel[2]).line(mx(17), 5, mx(6), 1, s === 1 ? R.steel[3] : R.steel[2]);
    solid(p, ell(mx(17), 5, 1.7, 1.7), R.brass, { sep: false });
    solid(p, poly([[mx(6), 1], [mx(3), 0], [mx(5), 3]]), R.brass, { sep: false });
  }
  // 몸통과 배기관
  solid(p, cap(32, 17, 37, 9, 1.6), R.copper);
  solid(p, or(ell(38, 6, 2.6, 2), ell(41, 3.5, 2.2, 1.7)), R.steam, { sep: false });
  solid(p, ell(28, 23, 6.5, 8.5), R.steel);
  solid(p, and(ell(28, 23, 6.5, 8.5), box(0, 25, 60, 2)), R.copper, { sep: false });
  // 머리
  solid(p, or(poly([[20, 11], [20, 2], [25, 9]]), poly([[27, 9], [31, 2], [32, 11]])), R.steel);
  solid(p, ell(26, 13.5, 6, 5), R.steel);
  solid(p, box(20, 12, 9, 3), R.gunmetal, { sep: false });
  eye(p, 21, 12, 2, 2, AMBER, 3);
  eye(p, 26, 12, 2, 2, AMBER, 3);
  p.rect(22, 16, 4, 1, R.gunmetal[0]);
  px(p, [[22, 17], [25, 17]], R.steel[4]);
  // 발톱
  solid(p, cap(26, 31, 25, 34, 1), R.gunmetal);
  solid(p, cap(30, 31, 31, 34, 1), R.gunmetal);
  return p.outline(OUT[1]);
}

/** 화염 임프 — 무쇠 머리에 불꽃 갈기와 쇠뿔, 이빨 사이로 새는 불, 손에 불덩이 */
function imp(): Pix {
  const p = new Pix(40, 44);
  // 꼬리
  const tail = [[26, 36], [31, 37], [35, 34], [36, 29], [35, 25]];
  for (let i = 1; i < tail.length; i++) solid(p, cap(tail[i - 1][0], tail[i - 1][1], tail[i][0], tail[i][1], 1.1), R.gunmetal, { sep: false });
  solid(p, flameM(35, 25, 2.6, 8, 1.5), R.fire, { core: [0.6, 1.2, 2] });
  // 뒤팔
  solid(p, cap(26, 28, 31, 32, 1.6), R.steel, BACK);
  solid(p, ell(32, 33, 2, 2), R.steel, BACK);
  // 다리
  solid(p, cap(17, 36, 15, 41, 1.8), R.steel);
  solid(p, cap(24, 36, 25, 41, 1.8), R.steel, BACK);
  solid(p, cap(12, 41, 17, 41, 1.2), R.steel);
  solid(p, cap(23, 41, 28, 41, 1.2), R.steel, BACK);
  // 난로 몸통
  const body = ell(21, 31, 8.5, 7.5);
  solid(p, body, R.gunmetal);
  solid(p, ell(20, 32, 5, 4), R.fire, { core: [0.5, 1.5, 2.5] });
  for (let x = 17; x <= 23; x += 2) p.rect(x, 28, 1, 8, R.gunmetal[0]);
  halo(p, 20, 32, 7, R.fire[2], 0.4);
  solid(p, and(body, box(0, 24, 40, 2)), R.copper, { sep: false });
  // 불꽃 갈기
  solid(p, or(flameM(22, 14, 6.5, 14, 2), flameM(15, 15, 4, 10, -2.5), flameM(29, 15, 3.6, 11, 2.5)), R.fire, { core: [0.6, 1.5, 2.8, 4.5] });
  // 쇠뿔
  solid(p, poly([[13, 16], [16, 13], [9, 5], [10, 11]]), R.steel);
  solid(p, poly([[26, 13], [29, 16], [34, 7], [30, 10]]), R.steel, BACK);
  // 무쇠 머리
  solid(p, ell(20.5, 19, 7.5, 6.5), R.steel);
  p.grid(13, 16, [
    'ee.....ee.',
    '.eyy..yye.',
    '..yw..wy..',
    '..........',
    '.mmmmmmm..',
    '.mtftftm..',
    '..mmmmm...',
  ], { e: '#0d1016', y: R.fire[3], w: R.fire[4], m: '#120608', t: '#f5e6c8', f: R.fire[2] });
  halo(p, 16, 18, 3, R.fire[3], 0.4);
  halo(p, 21, 18, 3, R.fire[3], 0.4);
  // 앞팔과 불덩이
  solid(p, cap(14, 28, 9, 24, 1.6), R.steel);
  solid(p, or(ell(6, 20, 3.8, 3.8), flameM(6, 19, 3, 9, -1)), R.fire, { core: [0.6, 1.5, 2.5, 3.2] });
  return p.outline('#1c0a08');
}

/** 증기 기사 — 톱니 문장 탑방패, 증기 피스톤 창, 등의 보일러 */
function steamKnight(): Pix {
  const p = new Pix(66, 70);
  const W = p.w;
  // 창 (뒤쪽, 세워 듦)
  solid(p, box(55, 12, 3, 56), R.leather, { light: [-1, 0] });
  solid(p, poly([[56.5, 0], [60, 12], [53, 12]]), R.steel, { light: [-1, -0.2] });
  solid(p, box(53, 26, 7, 10, 1), R.brass, { light: [-1, 0] });
  // 등 보일러
  solid(p, box(40, 18, 12, 20, 4), R.copper, { light: [-1, -0.3] });
  solid(p, cap(48, 18, 48, 8, 2.4), R.steel, BACK);
  solid(p, or(ell(49, 5, 3, 2.5), ell(52, 2.5, 2.4, 2)), R.steam, { sep: false });
  // 다리
  solid(p, cap(40, 48, 41, 60, 4.2), R.steel, BACK);
  solid(p, and(ell(43, 64, 7.5, 3.8), box(0, 0, W, 67)), R.steel, BACK);
  solid(p, cap(27, 48, 26, 60, 4.4), R.steel);
  solid(p, and(ell(25, 64, 8, 4), box(0, 0, W, 67)), R.steel);
  solid(p, ell(27, 55, 3, 2.6), R.brass);
  // 몸통
  const torso = or(box(21, 24, 23, 20, 6), poly([[23, 40], [43, 40], [41, 49], [25, 49]]));
  solid(p, torso, R.steel);
  solid(p, and(torso, box(0, 40, W, 2)), R.brass, { sep: false });
  solid(p, ell(33, 31, 6, 5), R.brass);
  solid(p, ell(33, 31, 3, 2.5), CYANG, { core: [0.5, 1.2, 2] });
  halo(p, 33, 31, 6, CYANG[2], 0.3);
  // 뒤팔
  solid(p, ell(45, 26, 6, 5), R.steel, BACK);
  solid(p, cap(46, 29, 51, 36, 3.4), R.steel, BACK);
  solid(p, ell(55, 37, 3.6, 3.6), R.steel);
  // 투구
  const helm = or(box(25, 7, 17, 17, 6), ell(33.5, 8, 7.5, 5));
  solid(p, helm, R.steel);
  solid(p, box(24, 14, 12, 3), R.gunmetal, { sep: false });
  eye(p, 25, 14, 10, 2, CYANG, 7);
  for (let y = 19; y <= 21; y += 2) for (let x = 27; x <= 33; x += 2) p.set(x, y, R.steel[0]);
  solid(p, poly([[30, 7], [33, 1], [42, 0], [39, 4], [41, 7]]), R.copper, { light: [-0.6, -1] });
  // 탑방패
  const shield = poly([[3, 22], [21, 19], [22, 50], [13, 60], [3, 51]]);
  solid(p, shield, R.steel, { light: [-1, -0.5] });
  const face = poly([[5, 24], [19, 21.5], [20, 49], [13, 57], [5, 49.5]]);
  solid(p, face, R.brass, { light: [-1, -0.5], sep: false });
  solid(p, gearM(12.5, 37, 7, 8, 1.8), R.steel, { light: [-1, -1] });
  solid(p, ell(12.5, 37, 3, 3), R.gunmetal, { sep: false });
  solid(p, ell(12.5, 37, 1.8, 1.8), CYANG, { core: [0.5, 1.2], sep: false });
  halo(p, 12.5, 37, 5, CYANG[2], 0.25);
  for (const [x, y] of [[6, 25], [17, 23], [7, 47], [17, 47]]) rivet(p, x, y, R.steel);
  return p.outline(OUT[1]);
}

/** 보일러 거상 — 용광로 입, 쌍둥이 굴뚝, 피스톤 팔의 거대한 강철 주먹 */
function colossus(): Pix {
  const p = new Pix(100, 96);
  const W = p.w;
  const fist = (x: number, y: number, back: boolean) => {
    const sh = back ? BACK : {};
    solid(p, box(x, y, 20, 17, 5), R.steel, sh);
    for (const fx of [5, 10, 15]) p.line(x + fx, y + 6, x + fx, y + 16, back ? R.steel[0] : R.steel[1]);
    for (const fx of [2, 7, 12]) p.rect(x + fx, y + 3, 2, 1, back ? R.steel[2] : R.steel[4]);
    solid(p, ell(x + 18, y + 4, 4, 3.4), R.steel, sh);
  };
  // 굴뚝
  solid(p, cap(62, 30, 62, 9, 4.2), R.steel, BACK);
  solid(p, box(56, 6, 12, 4, 1), R.steel, BACK);
  solid(p, cap(76, 32, 76, 13, 3.6), R.steel, BACK);
  solid(p, box(71, 10, 10, 4, 1), R.steel, BACK);
  solid(p, or(ell(60, 3, 5, 3), ell(66, 2, 4, 2), ell(56, 4.5, 3, 2.2)), R.steam, { sep: false });
  solid(p, or(ell(78, 6.5, 4, 2.6), ell(82, 4.5, 3, 2)), R.steam, { sep: false });
  // 뒤팔
  solid(p, cap(84, 44, 88, 58, 5.5), R.copper, BACK);
  solid(p, cap(88, 58, 88, 68, 2.6), R.steel, { light: [-1, 0] });
  fist(78, 67, true);
  // 다리
  solid(p, cap(64, 74, 66, 84, 8), R.gunmetal);
  solid(p, and(ell(68, 89.5, 12, 5), box(0, 0, W, 95)), R.steel, BACK);
  solid(p, cap(38, 74, 36, 84, 8.4), R.gunmetal);
  solid(p, and(ell(33, 89.5, 13, 5), box(0, 0, W, 95)), R.steel);
  // 보일러 몸통
  const body = or(box(22, 26, 62, 50, 14), ell(53, 28, 28, 8));
  solid(p, body, R.copper, { light: [-1, -0.35] });
  for (const y of [34, 66]) {
    solid(p, and(body, box(0, y, W, 3)), R.brass, { sep: false, light: [-1, -0.3] });
    for (let x = 26; x < 82; x += 6) p.set(x, y + 1, R.brass[4]);
  }
  rust(p, body, 0.18, 21, [R.copper[0], R.copper[1], R.rust[2]]);
  for (const x of [30, 64, 78]) {
    p.line(x, 38, x, 65, R.copper[1]).line(x + 1, 38, x + 1, 65, R.copper[3]);
    for (let y = 40; y < 64; y += 5) p.set(x - 1, y, R.copper[4]);
  }
  for (let x = 32; x < 78; x += 6) p.set(x, 24, R.copper[4]).set(x, 25, R.copper[1]);
  // 압력계
  solid(p, ell(72, 46, 5.5, 5.5), R.brass);
  dial(p, 72, 46, 4, [1.2, 2.2], '#3a2216', '#b8342a');
  // 눈
  for (const x of [36, 52]) {
    solid(p, ell(x, 43, 5, 3.6), R.brass);
    solid(p, ell(x, 43, 3.6, 2.2), R.gunmetal, { sep: false });
    eye(p, x - 3, 42, 6, 2, AMBER, 6);
  }
  solid(p, poly([[29, 36], [43, 40], [57, 36], [60, 39], [44, 43], [26, 39]]), R.gunmetal, { light: [-0.3, -1] });
  // 용광로 입
  solid(p, box(27, 50, 34, 14, 4), R.gunmetal);
  solid(p, box(29, 53, 30, 10, 2), R.fire, { core: [0.5, 1.5, 3, 4] });
  halo(p, 44, 57, 20, R.fire[2], 0.3);
  for (let x = 31; x < 58; x += 4) {
    solid(p, poly([[x, 52], [x + 3, 52], [x + 1.5, 56]]), R.steel, { sep: false });
    solid(p, poly([[x + 1, 63], [x + 4, 63], [x + 2.5, 59]]), R.steel, { sep: false });
  }
  // 앞팔
  solid(p, cap(19, 48, 14, 58, 6), R.copper);
  solid(p, and(cap(19, 48, 14, 58, 6), box(0, 52, W, 2)), R.brass, { sep: false });
  for (const [x, h] of [[14, 8], [21, 10], [28, 7]]) solid(p, poly([[x - 2.5, 34], [x + 2.5, 34], [x - 1, 34 - h]]), R.steel, { light: [-1, -0.3] });
  const sh = or(ell(21, 41, 13, 10), box(8, 41, 26, 7, 3));
  solid(p, sh, R.steel);
  solid(p, and(sh, box(0, 45, W, 3)), R.brass, { sep: false });
  for (let x = 11; x < 32; x += 5) p.set(x, 46, R.brass[4]);
  rivet(p, 15, 37, R.steel); rivet(p, 22, 35, R.steel); rivet(p, 29, 37, R.steel);
  solid(p, cap(13, 58, 13, 68, 2.8), R.steel, { light: [-1, 0] });
  fist(2, 67, false);
  return p.outline(OUT[1]);
}

// ── 3막: 마도 시계 중심부 ────────────────────────────

/** 마도 인형 — 십자 조종대에 매달린 금 간 도자기 얼굴, 광대 모자, 칼날 손 */
function puppet(): Pix {
  const p = new Pix(46, 64);
  const W = p.w;
  // 조종대와 실
  solid(p, box(9, 1, 28, 2), R.leather);
  solid(p, box(21, 0, 3, 7), R.leather);
  const str = '#b896f0';
  p.line(10, 3, 6, 37, str).line(36, 3, 40, 29, str).line(22, 6, 22, 8, str);
  // 다리
  solid(p, cap(20, 53, 19, 59, 1.6), R.bone, BACK);
  solid(p, cap(27, 53, 29, 58, 1.6), R.bone);
  solid(p, poly([[14, 61], [21, 58], [21, 62]]), R.arc);
  solid(p, poly([[26, 58], [32, 58], [35, 55]]), R.arc, BACK);
  // 치마
  const skirt = poly([[16, 39], [30, 39], [37, 51], [33, 49], [29, 54], [25, 49], [21, 54], [17, 49], [10, 53]]);
  solid(p, skirt, R.arc);
  solid(p, and(skirt, box(0, 39, W, 2)), R.brass, { sep: false });
  for (const [x0, x1] of [[20, 17], [26, 28]]) p.line(x0, 42, x1, 51, R.arc[1]);
  // 몸통
  const torso = poly([[16, 25], [30, 25], [27, 33], [30, 40], [16, 40], [19, 33]]);
  solid(p, torso, R.arc);
  p.line(23, 26, 23, 39, R.arc[1]);
  for (const y of [28, 32, 36]) rivet(p, 24, y, R.brass);
  // 뒤팔
  solid(p, cap(29, 27, 35, 33, 2), R.arc, BACK);
  solid(p, cap(35, 33, 39, 28, 1.4), R.bone, BACK);
  solid(p, ell(35, 33, 1.9, 1.9), R.brass, BACK);
  solid(p, poly([[39, 29], [43, 14], [41, 28]]), R.steel, { light: [-1, 0] });
  // 주름 깃
  solid(p, or(...[14, 18.5, 23, 27.5, 32].map((x) => ell(x, 24, 2.7, 2.4))), R.bone);
  // 광대 모자와 머리
  solid(p, poly([[13, 12], [33, 12], [41, 5], [29, 6], [23, 1], [17, 6], [5, 4]]), R.arc);
  solid(p, ell(5, 4.5, 2, 2), R.brass);
  solid(p, ell(41, 5.5, 2, 2), R.brass);
  solid(p, ell(23, 1.5, 1.6, 1.6), R.brass, { sep: false });
  solid(p, ell(23, 16, 7.5, 7.8), R.bone);
  solid(p, box(15, 10, 16, 2), R.brass, { sep: false });
  // 얼굴 (왼쪽을 본다)
  p.grid(16, 14, [
    '.aa..aa..',
    'baa.baa..',
    '.aa..aa..',
    '......e..',
    'c.....e.c',
    '.cdcdcdc.',
  ], { a: '#1a0c26', b: VIOLET[3], c: '#5a1030', d: '#c0405a', e: R.bone[1] });
  halo(p, 16.5, 15.5, 3, VIOLET[2], 0.6);
  halo(p, 20.5, 15.5, 3, VIOLET[2], 0.6);
  px(p, [[15, 19], [27, 19]], '#e88aa8');
  p.line(26, 11, 28, 15, R.bone[1]).line(28, 15, 27, 18, R.bone[1]);
  // 앞팔과 칼날
  solid(p, cap(16, 27, 11, 33, 2), R.arc);
  solid(p, ell(11, 33, 1.9, 1.9), R.brass);
  solid(p, cap(11, 33, 6, 37, 1.4), R.bone);
  solid(p, poly([[6, 36], [1, 51], [4, 50], [7, 39]]), R.steel, { light: [-1, 0] });
  return p.outline(OUT[2]);
}

/** 시간 망령 — 텅 빈 두건 속 청록 눈, 시곗바늘 낫, 가슴의 깨진 시계, 흩어지는 옷자락 */
function wraith(): Pix {
  const p = new Pix(56, 60);
  // 뒤팔
  solid(p, poly([[40, 22], [51, 33], [48, 37], [37, 28]]), R.arc, BACK);
  for (const [x, y] of [[48, 41], [50, 40], [53, 38]]) solid(p, cap(49, 36, x, y, 1, 0.4), R.bone, BACK);
  // 옷자락
  const robe = poly([[23, 16], [39, 16], [44, 30], [48, 46], [46, 59], [39, 50], [34, 59], [28, 50], [22, 59], [17, 48], [19, 30]]);
  solid(p, robe, R.arc, { light: [-0.8, -0.5] });
  for (const [x0, y0, x1, y1] of [[29, 34, 27, 52], [37, 32, 40, 52], [23, 36, 20, 48]]) p.line(x0, y0, x1, y1, R.arc[1]);
  fade(p, 46, 59);
  // 가슴 시계
  solid(p, ell(33, 30, 5.5, 5.5), R.brass);
  solid(p, ell(33, 30, 4, 4), R.cyan, { core: [0.5, 1.5, 3] });
  p.line(33, 30, 33, 27, R.arc[0]).line(33, 30, 35, 31, R.arc[0]);
  p.poly([[30, 26], [32, 29], [31, 31], [33, 34]], R.arc[1]);
  halo(p, 33, 30, 10, CYANG[2], 0.3);
  // 두건
  const hood = or(ell(30, 14, 9, 9.5), poly([[32, 6], [46, 2], [39, 12]]));
  solid(p, hood, R.arc);
  solid(p, ell(27, 15.5, 5.8, 6.4), ['#06030c', '#0c0618', '#140a24', '#1d0f33'], { sep: false });
  eye(p, 23, 14, 2, 2, CYANG, 4);
  eye(p, 28, 14, 2, 2, CYANG, 4);
  // 시곗바늘 낫
  solid(p, cap(19, 4, 21, 57, 1.3), R.leather, { light: [-1, 0] });
  const blade = and(sub(ell(10, 11, 11, 6.5), ell(11, 14.5, 11, 6.2)), (x) => x < 20);
  solid(p, blade, R.steel, { light: [-0.3, -1] });
  solid(p, sub(gearM(20, 7, 3.6, 7, 1.2), ell(20, 7, 1.2, 1.2)), R.brass);
  // 앞팔
  solid(p, poly([[23, 20], [17, 28], [21, 32], [29, 25]]), R.arc);
  solid(p, ell(20, 30, 2.6, 2.4), R.bone);
  px(p, [[18, 29], [18, 31]], R.bone[1]);
  return p.outline(OUT[2]);
}

/** 마도 감시안 — 기울어진 혼천의 고리 속 거대한 기계 눈 */
function sentinel(): Pix {
  const p = new Pix(70, 72);
  const cx = 35, cy = 32;
  // 뒤쪽 고리
  solid(p, tiltRing(cx, cy, 33, 11, 2.4, -0.35, 'back'), R.brass, BACK);
  solid(p, tiltRing(cx, cy, 30, 9, 2, 0.5, 'back'), R.arcIron, BACK);
  // 아래로 늘어진 케이블
  for (const [x0, x1, y1] of [[28, 22, 60], [35, 35, 66], [42, 47, 60]]) {
    solid(p, cap(x0, 46, x1, y1, 1.6, 1.2), R.arcIron);
    solid(p, poly([[x1 - 2, y1], [x1 + 2, y1], [x1, y1 + 5]]), R.arc, { core: [0.5, 1] });
  }
  // 눈 몸체
  solid(p, ell(cx, cy, 19, 18), R.arcIron);
  for (const a of [0.9, 2.2, 4.0, 5.4]) rivet(p, Math.round(cx + Math.cos(a) * 16), Math.round(cy + Math.sin(a) * 15.5), R.arcIron);
  // 흰자와 눈꺼풀
  const lid: Mask = (x, y) => y > cy - 8 + (cx - x) * 0.22 && y < cy + 8.5 - (cx - x) * 0.08;
  const lens = and(ell(cx - 1, cy, 15.5, 15), lid);
  solid(p, lens, R.bone, { light: [-0.5, -1] });
  solid(p, and(lens, ell(cx - 6, cy + 0.5, 8, 8)), R.arc, { core: [0.6, 1.5, 3, 5] });
  solid(p, and(lens, ell(cx - 6, cy + 0.5, 4.5, 4.5)), R.cyan, { core: [0.5, 1.5, 2.5] });
  solid(p, and(lens, box(cx - 7, cy - 4, 2, 9)), ['#06030c', '#06030c', '#140a24', '#140a24'], { sep: false });
  p.rect(cx - 10, cy - 4, 2, 2, C.white);
  halo(p, cx - 6, cy, 12, CYANG[2], 0.2);
  // 눈꺼풀 날
  const shell = ell(cx, cy, 19, 18);
  solid(p, and(shell, (x, y) => y < cy && !lid(x, y)), R.arcIron, { th: [0.25, 0.55, 0.85] });
  solid(p, and(shell, (x, y) => y > cy && !lid(x, y)), R.arcIron, { th: [0.1, 0.35, 0.7] });
  for (let x = cx - 16; x <= cx + 15; x++) {
    const y = Math.floor(cy - 9 + (cx - x) * 0.22);
    if (shell(x + 0.5, y + 0.5)) p.set(x, y, x < cx - 4 ? R.brass[3] : R.brass[2]);
  }
  // 왕관 수정
  solid(p, poly([[cx - 3, 13], [cx, 2], [cx + 3, 13]]), R.arc, { core: [0.5, 1.2, 2] });
  solid(p, poly([[cx - 10, 16], [cx - 10, 8], [cx - 6, 14]]), R.arc, { core: [0.5, 1.2] });
  solid(p, poly([[cx + 10, 16], [cx + 10, 8], [cx + 6, 14]]), R.arc, { core: [0.5, 1.2] });
  // 앞쪽 고리
  solid(p, tiltRing(cx, cy, 33, 11, 2.4, -0.35, 'front'), R.brass);
  solid(p, tiltRing(cx, cy, 30, 9, 2, 0.5, 'front'), R.arcIron);
  for (const a of [0.6, 1.6, 2.6]) {
    const x = cx + Math.cos(a) * 31.5 * Math.cos(-0.35) - Math.sin(a) * 10 * Math.sin(-0.35);
    const y = cy + Math.cos(a) * 31.5 * Math.sin(-0.35) + Math.sin(a) * 10 * Math.cos(-0.35);
    solid(p, ell(x, y, 2.2, 2.2), R.cyan, { core: [0.5, 1.2] });
  }
  return p.outline(OUT[2]);
}

/** 시계탑의 심장 — 황동 띠로 묶인 마도 심장, 박힌 문자판, 위로 솟은 대동맥 관 */
function heart(): Pix {
  const p = new Pix(100, 98);
  const pipe = (pts: number[][], r: number, ramp: Ramp) => {
    solid(p, or(...pts.slice(1).map((q, i) => cap(pts[i][0], pts[i][1], q[0], q[1], r))), ramp, { light: [-1, -0.6] });
  };
  const flange = (x: number, y: number, dx: number, dy: number, r: number, ramp: Ramp) => {
    const n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n, w = r + 1.5;
    solid(p, poly([[x - ux * 1.5 - uy * w, y - uy * 1.5 + ux * w], [x + ux * 1.5 - uy * w, y + uy * 1.5 + ux * w],
      [x + ux * 1.5 + uy * w, y + uy * 1.5 - ux * w], [x - ux * 1.5 + uy * w, y - uy * 1.5 - ux * w]]), ramp, { light: [-1, -0.6] });
  };
  // 뒤쪽 궤도 고리
  solid(p, tiltRing(50, 60, 48, 13, 1.6, -0.12, 'back'), R.cyan, { sep: false, core: [0.5] });
  // 관
  const arch: number[][] = [[45, 34]];
  for (let a = 0; a <= Math.PI; a += Math.PI / 10) arch.push([32 + 13 * Math.cos(a), 18 - 12 * Math.sin(a)]);
  arch.push([19, 24]);
  pipe(arch, 4.6, R.brass);
  flange(45, 28, 0, 1, 4.6, R.brass);
  flange(19, 25, 0, 1, 5.2, R.brass);
  pipe([[63, 34], [66, 6]], 4.2, R.copper);
  flange(65.5, 4, 0.1, 1, 5, R.copper);
  flange(64.5, 20, 0.1, 1, 4.2, R.copper);
  pipe([[76, 42], [90, 30]], 2.8, R.copper);
  flange(90, 30, 0.76, -0.65, 3.2, R.copper);
  // 심장
  const body = or(ell(52, 60, 28, 26), ell(36, 42, 15, 13), ell(68, 40, 13, 12), poly([[26, 66], [78, 64], [56, 94]]));
  solid(p, body, R.flesh);
  solid(p, and(body, ell(60, 80, 30, 16)), R.flesh, { th: [0.05, 0.25, 0.55] });
  solid(p, and(body, poly([[24, 40], [40, 28], [52, 34], [36, 50], [26, 54]])), R.flesh, { th: [0.4, 0.75, 0.95], sep: false });
  p.poly([[62, 34], [66, 50], [62, 70], [57, 90]], R.flesh[0]);
  p.poly([[63, 36], [67, 50], [63, 70]], R.flesh[3]);
  p.poly([[50, 30], [52, 36]], R.flesh[0]);
  for (const [x, y] of [[30, 34], [34, 31], [70, 32], [74, 35]]) p.set(x, y, R.flesh[4]);
  // 황동 띠
  for (const r of [24, 36]) {
    solid(p, and(body, ringM(56, 30, r, 3)), R.brass, { light: [-1, -1] });
  }
  for (const [x, y] of [[33, 44], [42, 51], [74, 47], [30, 60], [80, 58]]) if (p.get(x, y)) rivet(p, x, y, R.brass);
  // 청록 혈관
  for (const v of [[[30, 34], [24, 46], [28, 58], [22, 66]], [[72, 40], [80, 52], [74, 62], [76, 72]], [[52, 72], [50, 84]]]) {
    p.poly(v as [number, number][], R.cyan[2]);
    for (const [x, y] of v) halo(p, x, y, 5, R.cyan[2], 0.35);
  }
  // 박힌 톱니
  solid(p, sub(gearM(74, 62, 9, 9, 2), ell(74, 62, 2.5, 2.5)), R.brass);
  solid(p, sub(gearM(28, 70, 7, 8, 2, 0.3), ell(28, 70, 2, 2)), R.copper);
  // 중심 문자판
  solid(p, ell(50, 54, 14, 14), R.brass, { light: [-1, -1] });
  dial(p, 50, 54, 11.5, [0, 2.4], '#2a1a3a', R.cyan[1]);
  p.poly([[56, 44], [53, 49], [56, 53], [52, 59]], R.cyan[1]);
  halo(p, 50, 54, 14, R.cyan[2], 0.15);
  // 앞쪽 궤도 고리
  solid(p, tiltRing(50, 60, 48, 13, 1.6, -0.12, 'front'), R.cyan, { core: [0.5] });
  for (const a of [0.3, 1.5, 2.7]) {
    const x = 50 + Math.cos(a) * 47, y = 60 + Math.sin(a) * 12.5 - Math.cos(a) * 47 * 0.12;
    solid(p, poly([[x, y - 3], [x + 2, y], [x, y + 3], [x - 2, y]]), R.arc, { core: [0.5, 1.2] });
  }
  return p.outline(OUT[2]);
}

export const ENEMY_SPRITES: Record<string, () => Pix> = {
  automaton, spider, rat, guard, warden,
  golem, bat, imp, steam_knight: steamKnight, colossus,
  puppet, wraith, sentinel, heart,
};
