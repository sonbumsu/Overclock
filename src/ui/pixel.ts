/** 도트 그래픽용 팔레트 — 모든 스프라이트는 이 색만 쓴다. */
export const C = {
  ink: '#140d08',
  brown0: '#2a1d12', brown1: '#3d2a1a', brown2: '#5c4027', brown3: '#8a6239',
  brass0: '#6e5013', brass1: '#a7801f', brass2: '#d4ad35', brass3: '#f5dc7a',
  copper0: '#5e2d1b', copper1: '#97502c', copper2: '#c87442', copper3: '#eba36b',
  steel0: '#2c333c', steel1: '#4d5966', steel2: '#7b8a97', steel3: '#b7c6cf',
  steam0: '#5d8799', steam1: '#8fb8c9', steam2: '#d8eef4',
  arc0: '#3b2158', arc1: '#6a3fa0', arc2: '#a77bd9', arc3: '#e2cbff',
  red0: '#6e1d18', red1: '#b8342a', red2: '#ff6a4d',
  heat: '#f08a24', glow: '#ffe066', cyan: '#7ff3ff', water: '#3fa9d6',
  skin0: '#a8694a', skin1: '#e0a77c',
  cream: '#efe3c8', rust0: '#6b3418', rust1: '#9c5226', rust2: '#c97b3a',
  green0: '#3f7a2c', green1: '#7fc65a', white: '#fffaf0',
  acid0: '#3d6b12', acid1: '#8fd42e', acid2: '#d9ff7a',
} as const;

type Color = string | null;

/** 저해상도 픽셀 버퍼. 그린 뒤 outline()으로 외곽선을 두르고 toURL()로 이미지로 만든다. */
export class Pix {
  readonly data: Color[];

  constructor(readonly w: number, readonly h: number) {
    this.data = new Array(w * h).fill(null);
  }

  get(x: number, y: number): Color {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.data[y * this.w + x];
  }

  set(x: number, y: number, c: Color): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  strokeRect(x: number, y: number, w: number, h: number, c: Color): this {
    this.rect(x, y, w, 1, c).rect(x, y + h - 1, w, 1, c);
    return this.rect(x, y, 1, h, c).rect(x + w - 1, y, 1, h, c);
  }

  /** 이미 칠해진 픽셀만 다시 칠한다 (음영, 액체 표현 등) */
  tint(x: number, y: number, w: number, h: number, c: Color): this {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) if (this.get(x + i, y + j)) this.set(x + i, y + j, c);
    return this;
  }

  private area(cx: number, cy: number, r: number, fn: (x: number, y: number, dx: number, dy: number) => void): void {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) fn(x, y, x - cx, y - cy);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color): this {
    this.area(cx, cy, Math.max(rx, ry), (x, y, dx, dy) => {
      if ((dx / (rx + 0.4)) ** 2 + (dy / (ry + 0.4)) ** 2 <= 1) this.set(x, y, c);
    });
    return this;
  }

  circle(cx: number, cy: number, r: number, c: Color): this {
    return this.ellipse(cx, cy, r, r, c);
  }

  ring(cx: number, cy: number, r: number, thickness: number, c: Color): this {
    this.area(cx, cy, r, (x, y, dx, dy) => {
      const d = Math.hypot(dx, dy);
      if (d <= r + 0.4 && d > r - thickness + 0.4) this.set(x, y, c);
    });
    return this;
  }

  /** 톱니바퀴. inner를 주면 톱니 안쪽 면을 다른 색으로 칠해 테두리 느낌을 낸다. */
  gear(
    cx: number, cy: number, r: number, teeth: number, c: Color,
    opts: { hole?: number; depth?: number; inner?: Color; holeColor?: Color; phase?: number } = {},
  ): this {
    const depth = opts.depth ?? Math.max(1, Math.round(r / 4));
    const hole = opts.hole ?? 0;
    this.area(cx, cy, r, (x, y, dx, dy) => {
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) + (opts.phase ?? 0);
      const edge = Math.cos(a * teeth) > -0.1 ? r : r - depth;
      if (d > edge + 0.3) return;
      if (hole > 0 && d <= hole + 0.3) this.set(x, y, opts.holeColor ?? null);
      else if (opts.inner && d <= r - depth - 1.2 && d > hole + 1.2) this.set(x, y, opts.inner);
      else this.set(x, y, c);
    });
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color): this {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) return this;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  poly(points: [number, number][], c: Color): this {
    for (let i = 1; i < points.length; i++) this.line(...points[i - 1], ...points[i], c);
    return this;
  }

  /** 위가 뾰족한 삼각형 */
  spike(x: number, top: number, height: number, c: Color): this {
    for (let i = 0; i < height; i++) {
      const half = Math.floor(i / 2);
      this.rect(x - half, top + i, half * 2 + 1, 1, c);
    }
    return this;
  }

  /** 글자 격자로 직접 찍기. '.'은 투명 */
  grid(x: number, y: number, rows: string[], map: Record<string, Color>): this {
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && this.set(x + i, y + j, map[ch])));
    return this;
  }

  /** 다른 버퍼를 위에 덮어 그린다 */
  over(src: Pix, ox = 0, oy = 0): this {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c) this.set(x + ox, y + oy, c);
      }
    return this;
  }

  /** 빈 픽셀 중 상하좌우에 그림이 닿은 곳에 외곽선을 두른다 */
  outline(c: Color = C.ink): this {
    const src = [...this.data];
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < this.w && y < this.h && src[y * this.w + x];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!src[y * this.w + x] && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)))
          this.data[y * this.w + x] = c;
    return this;
  }

  toURL(): string {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    this.data.forEach((c, i) => {
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(i % this.w, Math.floor(i / this.w), 1, 1);
    });
    return canvas.toDataURL();
  }
}

const cache = new Map<string, { url: string; w: number; h: number }>();

/** 같은 키는 한 번만 그린다 */
export function bake(key: string, draw: () => Pix): { url: string; w: number; h: number } {
  let hit = cache.get(key);
  if (!hit) {
    const p = draw();
    hit = { url: p.toURL(), w: p.w, h: p.h };
    cache.set(key, hit);
  }
  return hit;
}
