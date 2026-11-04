import type { Rng } from './rng';

/** 시계탑 지도 — 구역마다 아래에서 위로 오르는 갈림길 지도를 새로 만든다 */
export type RoomKind = 'combat' | 'elite' | 'rest' | 'shop' | 'event' | 'treasure' | 'boss';

export interface MapNode {
  id: number;
  /** 0이 맨 아래. 보스는 MAP_ROWS */
  row: number;
  col: number;
  kind: RoomKind;
  /** 다음 줄에서 갈 수 있는 방 id */
  next: number[];
  /** 격자에서 살짝 비껴 놓는 정도 (-1~1) — 손으로 그린 지도처럼 보이게 */
  dx: number;
  dy: number;
}

export const MAP_COLS = 6;
/** 보스 앞까지의 줄 수 */
export const MAP_ROWS = 12;
/** 갈림길을 만드는 경로 수 — 겹치는 곳에서 합쳐진다 */
const PATHS = 6;
/** 모든 길이 지나는 고정 방 */
const FIXED_ROWS: Record<number, RoomKind> = { 0: 'combat', 6: 'treasure', [MAP_ROWS - 1]: 'rest' };
/** 같은 길에서 연달아 나오지 않게 하는 방 */
const NO_REPEAT: RoomKind[] = ['elite', 'rest', 'shop', 'treasure'];

function roomWeights(row: number): Partial<Record<RoomKind, number>> {
  return {
    combat: 46,
    event: 22,
    elite: row >= 4 ? 15 : 0,
    rest: row >= 4 && row <= MAP_ROWS - 3 ? 10 : 0,
    shop: row >= 2 ? 8 : 0,
  };
}

export function generateMap(rng: Rng): MapNode[] {
  const key = (row: number, col: number) => `${row}:${col}`;
  const cells = new Map<string, { row: number; col: number; next: Set<number> }>();
  const touch = (row: number, col: number) => {
    const k = key(row, col);
    if (!cells.has(k)) cells.set(k, { row, col, next: new Set() });
    return cells.get(k)!;
  };

  // 1) 아래에서 위로 경로를 여러 번 긋는다. 길끼리 X자로 엇갈리지 않게 한다.
  let firstStart = -1;
  for (let p = 0; p < PATHS; p++) {
    let col = rng.int(0, MAP_COLS - 1);
    if (p === 1) while (col === firstStart) col = rng.int(0, MAP_COLS - 1);
    if (p === 0) firstStart = col;
    for (let row = 0; row < MAP_ROWS - 1; row++) {
      let nc = Math.max(0, Math.min(MAP_COLS - 1, col + rng.int(-1, 1)));
      // (row, nc) → (row+1, col) 길이 이미 있으면 엇갈리므로 곧장 위로 간다
      if (nc !== col && cells.get(key(row, nc))?.next.has(col)) nc = col;
      touch(row, col).next.add(nc);
      col = nc;
    }
    touch(MAP_ROWS - 1, col);
  }

  // 2) 줄 순서대로 번호를 붙인다
  const sorted = [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  const idOf = new Map(sorted.map((c, i) => [key(c.row, c.col), i]));
  const nodes: MapNode[] = sorted.map((c, id) => ({
    id, row: c.row, col: c.col, kind: 'combat',
    next: [...c.next].sort((a, b) => a - b).map((nc) => idOf.get(key(c.row + 1, nc))!),
    dx: rng.next() * 2 - 1, dy: rng.next() * 2 - 1,
  }));
  const boss: MapNode = { id: nodes.length, row: MAP_ROWS, col: (MAP_COLS - 1) / 2, kind: 'boss', next: [], dx: 0, dy: 0 };
  for (const n of nodes) if (n.row === MAP_ROWS - 1) n.next = [boss.id];

  // 3) 방 종류를 정한다 — 부모 방과 겹치면 안 되는 종류는 피한다
  const parents = (n: MapNode) => nodes.filter((p) => p.next.includes(n.id));
  for (const n of nodes) {
    const fixed = FIXED_ROWS[n.row];
    if (fixed) {
      n.kind = fixed;
      continue;
    }
    const banned = new Set(parents(n).map((p) => p.kind).filter((k) => NO_REPEAT.includes(k)));
    const weights = Object.fromEntries(Object.entries(roomWeights(n.row)).filter(([k, w]) => w! > 0 && !banned.has(k as RoomKind)));
    n.kind = rng.weighted(weights as Record<RoomKind, number>);
  }

  // 4) 지도마다 상점 · 정예가 적어도 하나는 있게 한다
  for (const kind of ['shop', 'elite'] as const) {
    if (nodes.some((n) => n.kind === kind)) continue;
    const minRow = kind === 'shop' ? 2 : 4;
    const options = nodes.filter((n) => (n.kind === 'combat' || n.kind === 'event') && n.row >= minRow && n.row < MAP_ROWS - 1 && !FIXED_ROWS[n.row]
      && !parents(n).some((p) => p.kind === kind) && !n.next.some((id) => nodes[id]?.kind === kind));
    if (options.length) rng.pick(options).kind = kind;
  }

  return [...nodes, boss];
}
