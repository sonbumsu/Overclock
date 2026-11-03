import { bake, C, Pix } from './pixel';

// ── 카드 테두리 · 비용 톱니 · 카드 뒷면 ──────────────────

type Metal = { rim: string; light: string; dark: string; gem: string; gemLight: string };

const METALS: Record<string, Metal> = {
  basic: { rim: C.copper1, light: C.copper3, dark: C.copper0, gem: C.brass2, gemLight: C.brass3 },
  precision: { rim: C.steel2, light: C.steel3, dark: C.steel0, gem: C.water, gemLight: C.cyan },
  masterwork: { rim: C.brass2, light: C.brass3, dark: C.brass0, gem: C.red1, gemLight: C.red2 },
  junk: { rim: C.rust0, light: C.rust1, dark: C.brown1, gem: C.brown2, gemLight: C.rust1 },
};

/** 카드 테두리 9-slice 원본 (16×16, 모서리 6). 가운데는 비워 두고 바탕은 CSS가 칠한다 */
function cardFrame(m: Metal): Pix {
  const p = new Pix(16, 16);
  p.strokeRect(0, 0, 16, 16, C.ink);
  p.strokeRect(1, 1, 14, 14, m.rim);
  p.rect(1, 1, 14, 1, m.light).rect(1, 1, 1, 14, m.light);
  p.rect(1, 14, 14, 1, m.dark).rect(14, 1, 1, 14, m.dark);
  p.strokeRect(2, 2, 12, 12, m.rim).strokeRect(3, 3, 10, 10, C.ink);
  p.rect(2, 2, 12, 1, m.light);
  // 모서리 보석
  for (const [x, y] of [[1, 1], [12, 1], [1, 12], [12, 12]]) {
    p.rect(x, y, 3, 3, C.ink).set(x + 1, y + 1, m.gem);
    p.set(x + 1, y, m.gem).set(x, y + 1, m.gem).set(x + 2, y + 1, m.gem).set(x + 1, y + 2, m.gem);
    p.set(x + 1, y, m.gemLight);
  }
  p.set(0, 0, null).set(15, 0, null).set(0, 15, null).set(15, 15, null);
  return p;
}

/** 비용 톱니 — 가운데에 숫자가 들어간다 */
function costGear(core: string, coreLight: string, coreDark: string): Pix {
  const p = new Pix(23, 23);
  p.gear(11, 11, 10, 10, C.brass1, { depth: 2 });
  p.circle(11, 11, 7.5, C.brass2).circle(11, 11, 6.5, C.ink);
  p.circle(11, 11, 5.8, core).ellipse(10, 9, 4, 2.5, coreLight).ellipse(12, 14.5, 4, 1.5, coreDark);
  p.set(8, 7, C.white).set(9, 7, C.white);
  return p.outline();
}

type Back = { fill: string; pattern: string; rim: string; light: string; dark: string; emblem: (p: Pix) => void };

const BACKS: Record<string, Back> = {
  draw: {
    fill: '#17262c', pattern: '#1f343c', rim: C.brass1, light: C.brass3, dark: C.brass0,
    emblem: (p) => {
      p.gear(12, 17, 7, 9, C.brass2, { hole: 2.5, inner: C.brass1, depth: 2 });
      p.circle(12, 17, 2.5, C.steam0).circle(12, 17, 1.5, C.cyan).set(11, 16, C.white);
    },
  },
  discard: {
    fill: '#21160f', pattern: '#2c1e14', rim: C.rust1, light: C.rust2, dark: C.rust0,
    emblem: (p) => {
      p.gear(12, 17, 7, 9, C.copper1, { hole: 2.5, inner: C.copper0, depth: 2 });
      // 금 간 톱니
      p.line(9, 10, 11, 14, '#21160f').line(11, 14, 10, 17, '#21160f').line(15, 21, 13, 24, '#21160f');
      p.circle(12, 17, 1.5, C.brown1);
    },
  },
  exhaust: {
    fill: '#1a1024', pattern: '#24163a', rim: C.arc1, light: C.arc2, dark: C.arc0,
    emblem: (p) => {
      p.ring(12, 17, 7, 1, C.arc1);
      p.ellipse(12, 20, 4, 3, C.arc2).spike(12, 10, 9, C.arc2);
      p.ellipse(12, 21, 2, 2, C.arc3).spike(12, 14, 6, C.arc3).set(12, 21, C.white);
    },
  },
};

/** 더미에 쌓인 카드 뒷면 (24×34) */
function cardBack(b: Back): Pix {
  const p = new Pix(24, 34);
  p.rect(1, 1, 22, 32, b.fill);
  for (let y = 4; y < 30; y++) for (let x = 4; x < 20; x++) if ((x + y) % 4 === 0) p.set(x, y, b.pattern);
  p.strokeRect(1, 1, 22, 32, b.rim).rect(1, 1, 22, 1, b.light).rect(1, 1, 1, 32, b.light);
  p.rect(1, 32, 22, 1, b.dark).rect(22, 1, 1, 32, b.dark);
  p.strokeRect(3, 3, 18, 28, b.dark);
  // 위아래 장식 마름모
  for (const y of [5, 28]) p.set(12, y - 1, b.light).rect(11, y, 3, 1, b.rim).set(12, y + 1, b.dark);
  b.emblem(p);
  return p.outline();
}

export function cardBackImg(kind: keyof typeof BACKS, scale = 3, cls = ''): string {
  const s = bake(`back:${kind}`, () => cardBack(BACKS[kind]));
  return `<img class="px ${cls}" src="${s.url}" width="${s.w * scale}" height="${s.h * scale}" alt="">`;
}

/** 카드 테두리와 비용 톱니를 CSS 변수(--card-…)로 등록한다 */
export function installCardFrames(): void {
  const root = document.documentElement.style;
  for (const [name, m] of Object.entries(METALS)) root.setProperty(`--card-${name}`, `url(${bake(`cardframe:${name}`, () => cardFrame(m)).url})`);
  root.setProperty('--cost-steam', `url(${bake('cost:steam', () => costGear(C.steam1, C.steam2, C.steam0)).url})`);
  root.setProperty('--cost-heat', `url(${bake('cost:heat', () => costGear(C.heat, C.glow, C.copper1)).url})`);
}
