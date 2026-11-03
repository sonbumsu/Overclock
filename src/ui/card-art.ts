import type { Family } from '../core/types';
import { bake, C, Pix } from './pixel';

export const ART_W = 32;
export const ART_H = 20;

const BG: Record<Family | 'none', [string, string]> = {
  gear: ['#3a2a12', '#2c1f0d'],
  steam: ['#1f3038', '#16232a'],
  arcane: ['#2e1d40', '#21152f'],
  none: ['#33201a', '#241712'],
};

/** 아래(base)에서 위로 솟는 불꽃 */
function flame(a: Pix, x: number, base: number, h: number, outer: string, inner: string): void {
  a.spike(x, base - h, h, outer).ellipse(x, base - 2, Math.max(2, h / 3), 2, outer);
  a.spike(x, base - Math.round(h * 0.6), Math.round(h * 0.6), inner);
}

/** 각 카드의 그림 — 32×20 픽셀 */
const ART: Record<string, (a: Pix) => void> = {
  cog_strike: (a) => {
    a.gear(13, 10, 7, 8, C.brass2, { hole: 1.5, inner: C.brass1 });
    a.line(23, 4, 28, 2, C.white).line(23, 10, 29, 10, C.white).line(23, 16, 28, 18, C.white);
  },
  brass_guard: (a) => {
    a.rect(9, 2, 14, 10, C.brass2).rect(10, 12, 12, 2, C.brass2).rect(12, 14, 8, 2, C.brass2).rect(14, 16, 4, 2, C.brass2);
    a.rect(9, 2, 14, 1, C.brass3).rect(9, 2, 1, 10, C.brass3).rect(22, 3, 1, 9, C.brass1);
    a.gear(16, 8, 3, 6, C.brass0, { depth: 1 }).set(16, 8, C.brass3);
  },
  steam_jet: (a) => {
    a.rect(2, 8, 10, 5, C.steel1).rect(2, 8, 10, 1, C.steel2).rect(12, 7, 3, 7, C.steel2).rect(4, 8, 1, 5, C.brass1);
    a.circle(19, 10, 3, C.steam2).circle(24, 7, 3.5, C.steam2).circle(27, 13, 3, C.steam1).circle(22, 14, 2, C.steam1);
  },
  wind_up: (a) => {
    a.circle(8, 6, 4, C.brass2).circle(8, 14, 4, C.brass2).rect(10, 8, 4, 5, C.brass2);
    a.circle(8, 6, 1.2, C.brass0).circle(8, 14, 1.2, C.brass0).set(6, 4, C.brass3).set(6, 12, C.brass3);
    a.rect(14, 9, 13, 2, C.brass1).rect(14, 9, 13, 1, C.brass3).rect(26, 7, 2, 6, C.brass1);
  },
  linked_cogs: (a) => {
    a.gear(9, 11, 6, 8, C.brass2, { hole: 1.5, inner: C.brass1 });
    a.gear(19, 7, 5, 7, C.copper2, { hole: 1.2, inner: C.copper1, phase: 0.3 });
    a.gear(26, 14, 4, 6, C.steel2, { hole: 1, inner: C.steel1 });
  },
  chain_drive: (a) => {
    for (let i = 0; i < 4; i++) a.strokeRect(2 + i * 7, i % 2 ? 9 : 6, 9, 6, i % 2 ? C.steel2 : C.steel3);
    a.gear(28, 4, 3, 6, C.brass2, { depth: 1 });
  },
  piston: (a) => {
    a.rect(3, 5, 12, 10, C.steel1).rect(3, 5, 12, 2, C.steel2).rect(3, 13, 12, 2, C.steel0).rect(6, 5, 1, 10, C.brass1);
    a.rect(15, 8, 8, 4, C.steel3).rect(15, 11, 8, 1, C.steel2).rect(23, 4, 4, 12, C.copper2).rect(23, 4, 1, 12, C.copper3);
    a.set(29, 6, C.white).set(30, 10, C.white).set(29, 14, C.white);
  },
  pressure_release: (a) => {
    a.ring(11, 10, 7, 2, C.red1).line(11, 3, 11, 17, C.red1).line(4, 10, 18, 10, C.red1).circle(11, 10, 1.5, C.brass2);
    a.set(7, 4, C.red2).set(5, 6, C.red2);
    a.circle(23, 5, 3, C.steam2).circle(27, 10, 2.5, C.steam2).circle(23, 15, 2, C.steam1);
  },
  coolant: (a) => {
    a.rect(14, 1, 5, 5, C.steel3).rect(13, 1, 7, 1, C.steel2);
    a.circle(16, 12, 7, C.steam2).tint(9, 12, 15, 8, C.water).tint(9, 11, 15, 1, C.cyan);
    a.set(13, 14, C.white).set(18, 16, C.white).set(15, 17, C.steam2).set(12, 8, C.white).set(12, 9, C.white);
  },
  arcane_ignite: (a) => {
    a.ellipse(16, 13, 6, 5, C.arc1).spike(16, 2, 10, C.arc1).spike(11, 6, 5, C.arc1).spike(21, 5, 6, C.arc1);
    a.ellipse(16, 14, 4, 3, C.arc2).spike(16, 7, 6, C.arc2).ellipse(16, 15, 2, 2, C.arc3);
    a.set(6, 4, C.arc3).set(26, 3, C.arc3).set(27, 12, C.arc2);
  },
  rune_circuit: (a) => {
    a.ring(16, 10, 8, 1, C.arc2).ring(16, 10, 4, 1, C.arc1);
    a.line(16, 2, 16, 6, C.arc1).line(16, 14, 16, 18, C.arc1).line(8, 10, 12, 10, C.arc1).line(20, 10, 24, 10, C.arc1);
    for (const [x, y] of [[15, 1], [15, 17], [7, 9], [23, 9]]) a.rect(x, y, 2, 2, C.arc3);
    a.rect(15, 9, 2, 2, C.cyan);
  },
  overload_strike: (a) => {
    a.poly([[20, 1], [12, 10], [18, 10], [11, 19]], C.heat).poly([[21, 1], [13, 10], [19, 10], [12, 19]], C.heat);
    a.poly([[22, 1], [14, 9], [20, 9]], C.glow);
    a.set(6, 5, C.glow).set(26, 14, C.glow).set(25, 4, C.heat).set(7, 15, C.heat);
  },
  gear_storm: (a) => {
    a.gear(16, 11, 5, 8, C.copper2, { hole: 1.2, inner: C.copper1 });
    a.gear(6, 5, 3, 6, C.brass2, { depth: 1 }).gear(26, 5, 4, 7, C.brass2, { depth: 1 });
    a.gear(26, 16, 3, 6, C.steel2, { depth: 1 }).gear(6, 15, 3, 6, C.steel3, { depth: 1 });
    a.line(10, 2, 12, 2, C.white).line(20, 18, 22, 18, C.white);
  },
  rust_hex: (a) => {
    a.circle(16, 8, 6, C.cream).rect(12, 12, 9, 4, C.cream);
    a.rect(12, 7, 3, 3, C.arc1).rect(18, 7, 3, 3, C.arc1).set(13, 8, C.arc3).set(19, 8, C.arc3).set(16, 11, C.ink);
    for (let x = 13; x <= 19; x += 2) a.set(x, 15, C.ink);
    for (const [x, y] of [[11, 4], [20, 13], [14, 3], [21, 6]]) a.set(x, y, C.rust1);
    a.set(5, 6, C.arc2).set(26, 9, C.arc2).set(7, 15, C.rust2).set(25, 16, C.rust2);
  },
  flywheel: (a) => {
    a.ring(13, 10, 8, 2, C.steel2).ring(13, 10, 8, 1, C.steel3);
    a.line(13, 3, 13, 17, C.steel1).line(6, 10, 20, 10, C.steel1).line(8, 5, 18, 15, C.steel1).line(8, 15, 18, 5, C.steel1);
    a.circle(13, 10, 2, C.brass2);
    a.line(24, 3, 27, 6, C.white).line(26, 9, 29, 10, C.white).line(24, 16, 27, 14, C.white);
  },
  turbocharger: (a) => {
    a.rect(20, 3, 10, 5, C.copper1).rect(20, 3, 10, 1, C.copper2);
    a.circle(13, 10, 8, C.steel1).ring(13, 10, 8, 1, C.steel2);
    for (let i = 0; i < 6; i++) {
      const t = (i * Math.PI) / 3;
      a.line(13, 10, 13 + Math.cos(t) * 6, 10 + Math.sin(t) * 6, C.brass2);
    }
    a.circle(13, 10, 1.5, C.steel3).set(31, 2, C.heat).set(31, 7, C.glow);
  },
  grand_clock: (a) => {
    a.circle(12, 10, 8, C.brass2).circle(12, 10, 6, C.cream);
    a.line(12, 10, 12, 5, C.ink).line(12, 10, 15, 12, C.red1).set(12, 3, C.ink).set(12, 17, C.ink).set(5, 10, C.ink).set(19, 10, C.ink);
    a.line(19, 19, 26, 8, C.brown2).line(20, 19, 27, 8, C.brown3);
    a.rect(23, 2, 8, 6, C.steel2).rect(23, 2, 8, 1, C.steel3).rect(30, 2, 1, 6, C.steel1);
  },
  time_reverse: (a) => {
    a.circle(17, 10, 7, C.arc2).circle(17, 10, 5, C.cream);
    a.line(17, 10, 17, 6, C.ink).line(17, 10, 14, 12, C.arc1);
    a.poly([[8, 3], [5, 6], [4, 10], [5, 14], [8, 17]], C.arc3).set(9, 2, C.arc3).set(9, 4, C.arc3).set(10, 3, C.arc3);
    a.poly([[26, 3], [29, 6], [30, 10]], C.arc1);
  },
  mana_amplifier: (a) => {
    for (let dy = -8; dy <= 8; dy++) {
      const w = Math.round(5 - (Math.abs(dy) * 5) / 8);
      a.rect(16 - w, 10 + dy, 2 * w + 1, 1, C.arc2);
      if (dy < 0) a.rect(16 - w, 10 + dy, w, 1, C.arc3);
    }
    a.rect(8, 11, 17, 1, C.copper2).rect(9, 14, 15, 1, C.copper2).rect(8, 11, 1, 1, C.copper3);
    a.set(5, 4, C.arc3).set(27, 6, C.arc3).set(26, 16, C.cyan);
  },
  // ── 캐릭터 전용 ──
  poker_jab: (a) => {
    a.line(3, 17, 24, 6, C.steel1).line(3, 18, 24, 7, C.steel2).rect(1, 16, 4, 4, C.brown2);
    a.rect(24, 4, 5, 4, C.heat).circle(27, 5, 1.5, C.glow);
    flame(a, 29, 12, 6, C.heat, C.glow);
    a.set(20, 2, C.glow).set(30, 15, C.heat);
  },
  load_shell: (a) => {
    a.rect(6, 6, 14, 8, C.brass1).rect(6, 6, 14, 1, C.brass3).rect(20, 7, 4, 6, C.copper2).spike(25, 7, 3, C.copper2);
    a.rect(8, 6, 2, 8, C.brass0).ring(6, 10, 2, 1, C.brass2);
    a.circle(27, 4, 2, C.steam2).circle(4, 16, 2, C.steam1).circle(29, 15, 1.5, C.steam2);
  },
  spiked_guard: (a) => {
    a.circle(16, 10, 8, C.brass2).ring(16, 10, 8, 1, C.brass0).circle(16, 10, 5, C.copper1).circle(16, 10, 2, C.brass3);
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      a.line(16 + Math.cos(t) * 9, 10 + Math.sin(t) * 9, 16 + Math.cos(t) * 11, 10 + Math.sin(t) * 10, C.steel3);
    }
  },
  spark_plug: (a) => {
    a.rect(12, 2, 8, 6, C.cream).rect(12, 2, 8, 1, C.white).rect(11, 8, 10, 3, C.steel2).rect(13, 11, 6, 4, C.steel1);
    a.rect(15, 15, 2, 2, C.steel3);
    a.poly([[16, 17], [12, 19], [20, 18], [9, 20]], C.glow).set(22, 16, C.heat).set(8, 15, C.glow);
  },

  // ── 화상 ──
  scald: (a) => {
    a.rect(2, 8, 9, 5, C.steel1).rect(2, 8, 9, 1, C.steel2).rect(11, 7, 3, 7, C.steel2);
    a.circle(18, 10, 3, C.red2).circle(23, 8, 3.5, C.heat).circle(26, 13, 3, C.red1).circle(21, 14, 2, C.glow);
    flame(a, 27, 16, 6, C.heat, C.glow);
  },
  boiling_pipe: (a) => {
    a.rect(1, 5, 30, 6, C.copper1).rect(1, 5, 30, 1, C.copper3).rect(1, 10, 30, 1, C.copper0);
    a.rect(8, 4, 2, 8, C.brass1).rect(22, 4, 2, 8, C.brass1);
    a.circle(5, 2, 1.5, C.steam2).circle(15, 2, 1, C.steam2).circle(27, 2, 1.5, C.steam2);
    for (const x of [5, 12, 19, 26]) flame(a, x, 19, 6, C.heat, C.glow);
  },
  heat_wave: (a) => {
    for (let row = 0; row < 3; row++)
      for (let x = 1; x < 31; x++) a.set(x, 5 + row * 5 + Math.round(Math.sin(x / 2.5 + row) * 1.5), [C.glow, C.heat, C.red2][row]);
    a.set(4, 18, C.glow).set(28, 2, C.heat);
  },
  combustion: (a) => {
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      a.line(16, 10, 16 + Math.cos(t) * 13, 10 + Math.sin(t) * 9, i % 2 ? C.heat : C.red2);
    }
    a.circle(16, 10, 5, C.heat).circle(16, 10, 3, C.glow).ring(16, 10, 7, 1, C.arc2).rect(15, 9, 2, 2, C.white);
  },
  rekindle: (a) => {
    flame(a, 10, 18, 14, C.heat, C.glow);
    flame(a, 22, 18, 14, C.arc1, C.arc3);
    a.set(16, 4, C.white).set(15, 5, C.white).set(17, 3, C.white);
  },
  furnace: (a) => {
    a.rect(6, 4, 20, 15, C.steel1).rect(6, 4, 20, 2, C.steel2).rect(24, 6, 2, 13, C.steel0);
    a.rect(10, 9, 12, 8, C.ink);
    flame(a, 13, 16, 7, C.heat, C.glow);
    flame(a, 19, 16, 6, C.red2, C.glow);
    a.rect(21, 0, 4, 4, C.steel0).set(27, 1, C.steam2).rect(8, 6, 2, 1, C.brass2).rect(22, 6, 2, 1, C.brass2);
  },
  // ── 압력 ──
  charge_pressure: (a) => {
    a.circle(16, 11, 8, C.brass2).circle(16, 11, 6, C.cream);
    for (let x = 18; x <= 21; x++) a.set(x, 6, C.red1);
    a.set(21, 7, C.red1).set(22, 8, C.red1);
    a.line(16, 11, 21, 7, C.red1).circle(16, 11, 1, C.ink);
    a.line(2, 4, 6, 8, C.steam2).line(30, 4, 26, 8, C.steam2).line(2, 18, 6, 15, C.steam2).line(30, 18, 26, 15, C.steam2);
  },
  valve_lock: (a) => {
    a.ring(10, 10, 7, 2, C.red1).line(10, 3, 10, 17, C.red1).line(3, 10, 17, 10, C.red1).circle(10, 10, 1.5, C.brass2);
    a.ring(24, 7, 3, 1, C.steel3).rect(19, 9, 10, 9, C.brass2).rect(19, 9, 10, 1, C.brass3).rect(23, 12, 2, 3, C.ink);
  },
  steam_cannon: (a) => {
    a.rect(3, 7, 16, 7, C.steel1).rect(3, 7, 16, 2, C.steel2).rect(17, 6, 3, 9, C.steel0).rect(6, 7, 2, 7, C.brass1);
    a.circle(6, 16, 3, C.brown2).circle(6, 16, 1, C.brass2);
    a.rect(20, 9, 11, 3, C.white).rect(20, 8, 9, 1, C.steam2).rect(20, 12, 9, 1, C.steam2);
    a.circle(28, 10, 3.5, C.steam2).set(29, 9, C.white);
  },
  double_compress: (a) => {
    a.rect(1, 6, 8, 9, C.steel1).rect(1, 6, 8, 1, C.steel2).rect(9, 8, 3, 5, C.steel3);
    a.rect(23, 6, 8, 9, C.steel1).rect(23, 6, 8, 1, C.steel2).rect(20, 8, 3, 5, C.steel3);
    a.circle(16, 10, 3.5, C.steam1).circle(16, 10, 2, C.white);
    a.set(16, 3, C.steam2).set(16, 17, C.steam2);
  },
  compressor: (a) => {
    a.rect(4, 6, 18, 12, C.steel1).rect(4, 6, 18, 2, C.steel2).rect(20, 8, 2, 10, C.steel0);
    a.circle(11, 12, 3.5, C.cream).line(11, 12, 13, 10, C.red1);
    a.rect(16, 10, 3, 6, C.ink).rect(16, 13, 3, 3, C.steam1);
    a.rect(22, 9, 8, 2, C.brass1).rect(28, 2, 2, 8, C.brass1).circle(28, 1, 1, C.steam2);
  },
  steam_ram: (a) => {
    a.rect(2, 8, 18, 5, C.brown2).rect(2, 8, 18, 1, C.brown3);
    a.rect(20, 4, 8, 13, C.steel1).rect(20, 4, 8, 2, C.steel3).rect(28, 6, 3, 9, C.steel2);
    a.rect(6, 7, 2, 7, C.brass1).rect(14, 7, 2, 7, C.brass1);
    a.circle(3, 4, 2, C.steam2).circle(6, 2, 1.5, C.steam2).circle(4, 17, 2, C.steam1);
  },
  // ── 연사 ──
  rapid_cog: (a) => {
    for (let i = 0; i < 3; i++) a.gear(9 + i * 8, 10, 3, 6, [C.brass2, C.copper2, C.steel2][i], { depth: 1 });
    a.line(1, 6, 4, 6, C.white).line(1, 10, 5, 10, C.white).line(1, 14, 4, 14, C.white);
  },
  gear_magazine: (a) => {
    a.rect(9, 2, 14, 17, C.steel1).rect(9, 2, 14, 1, C.steel2).rect(21, 3, 2, 16, C.steel0);
    for (let i = 0; i < 4; i++) a.rect(11, 4 + i * 4, 10, 3, i % 2 ? C.brass1 : C.brass2).set(11, 4 + i * 4, C.brass3);
    a.rect(14, 0, 4, 2, C.steel3);
  },
  high_gear: (a) => {
    a.gear(12, 11, 7, 8, C.brass2, { hole: 1.5, inner: C.brass1 });
    a.spike(25, 2, 7, C.green1).rect(24, 9, 3, 8, C.green1).rect(24, 9, 1, 8, C.green0);
  },
  cog_barrage: (a) => {
    const spots = [[5, 4], [12, 9], [7, 15], [18, 4], [22, 13], [27, 7], [15, 16]];
    spots.forEach(([x, y], i) => {
      a.line(x - 4, y, x - 2, y, C.white);
      a.gear(x, y, 2, 5, i % 2 ? C.copper2 : C.brass2, { depth: 1 });
    });
  },
  autoloader: (a) => {
    a.rect(1, 13, 30, 4, C.steel1).rect(1, 13, 30, 1, C.steel2);
    for (const x of [4, 12, 20, 28]) a.circle(x, 15, 1.5, C.steel0).set(x, 15, C.brass2);
    for (const x of [4, 13, 22]) a.rect(x, 4, 6, 8, C.cream).rect(x, 4, 6, 1, C.white).rect(x + 1, 6, 4, 2, C.brass1);
    a.line(28, 4, 30, 6, C.white).line(30, 6, 28, 8, C.white);
  },
  endless_spring: (a) => {
    for (let t = 0; t < Math.PI * 4; t += 0.08) {
      const x = 16 + Math.cos(t) * (4 + t * 1.6) * 0.9;
      const y = 10 + Math.sin(t) * (2 + t * 0.55);
      a.set(x, y, t > Math.PI * 3 ? C.brass3 : C.brass2);
    }
    a.circle(16, 10, 1.5, C.brass1);
  },
  // ── 오버클록 ──
  heat_release: (a) => {
    a.rect(2, 7, 10, 7, C.steel1).rect(2, 7, 10, 1, C.steel2).rect(4, 8, 2, 5, C.heat);
    for (let i = 0; i < 4; i++) a.line(13, 10, 29, 3 + i * 5, [C.glow, C.heat, C.red2, C.heat][i]);
    a.circle(13, 10, 2.5, C.white);
  },
  critical_boost: (a) => {
    a.circle(16, 11, 8, C.steel1).circle(16, 11, 6, C.cream);
    for (let x = 19; x <= 22; x++) a.set(x, 8, C.red1);
    a.line(16, 11, 22, 8, C.red1).circle(16, 11, 1, C.ink);
    flame(a, 5, 19, 7, C.heat, C.glow);
    flame(a, 27, 19, 8, C.heat, C.glow);
  },
  coolant_cycle: (a) => {
    a.ring(16, 10, 8, 2, C.water).ring(16, 10, 8, 1, C.cyan);
    a.spike(9, 2, 4, C.cyan).spike(23, 15, 4, C.cyan);
    a.rect(13, 6, 6, 9, C.steam1).rect(13, 6, 6, 1, C.steam2).rect(15, 9, 2, 3, C.water);
  },
  heatsink: (a) => {
    for (let x = 4; x < 28; x += 4) a.rect(x, 4, 2, 13, C.steel2).rect(x, 4, 1, 13, C.steel3);
    a.rect(3, 15, 26, 3, C.steel1).rect(3, 15, 26, 1, C.steel2);
    a.line(2, 2, 6, 0, C.heat).line(14, 2, 18, 0, C.heat).line(26, 2, 30, 0, C.heat);
  },
  meltdown_engine: (a) => {
    a.rect(7, 6, 18, 12, C.copper1).rect(7, 6, 18, 2, C.copper2).rect(23, 8, 2, 10, C.copper0);
    a.circle(16, 12, 4, C.heat).circle(16, 12, 2, C.glow).set(16, 12, C.white);
    a.line(10, 7, 13, 11, C.ink).line(21, 9, 19, 15, C.ink);
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      a.set(16 + Math.cos(t) * 13, 10 + Math.sin(t) * 9, i % 2 ? C.glow : C.red2);
    }
  },
  // ── 방벽 ──
  iron_wall: (a) => {
    for (let row = 0; row < 4; row++)
      for (let bx = (row % 2) * 4 - 4; bx < 32; bx += 8) a.rect(bx + 1, 2 + row * 4, 7, 3, row % 2 ? C.steel2 : C.steel1).rect(bx + 1, 2 + row * 4, 7, 1, C.steel3);
    a.rect(0, 18, 32, 2, C.steel0);
  },
  counter_stance: (a) => {
    a.rect(6, 3, 13, 9, C.steel2).rect(7, 12, 11, 2, C.steel2).rect(9, 14, 7, 2, C.steel2).rect(11, 16, 3, 1, C.steel2);
    a.rect(6, 3, 13, 1, C.steel3).rect(12, 4, 1, 12, C.steel1);
    a.line(20, 14, 29, 3, C.white).line(21, 14, 30, 4, C.steel3).line(19, 11, 23, 15, C.brass2);
  },
  shield_bash: (a) => {
    a.rect(4, 3, 12, 9, C.brass2).rect(5, 12, 10, 2, C.brass2).rect(7, 14, 6, 2, C.brass2);
    a.rect(4, 3, 12, 1, C.brass3).gear(10, 8, 2, 5, C.brass0, { depth: 1 });
    a.line(18, 5, 24, 5, C.white).line(18, 9, 27, 9, C.white).line(18, 13, 24, 13, C.white);
    a.circle(28, 9, 2.5, C.glow);
  },
  spike_armor: (a) => {
    a.rect(9, 5, 14, 13, C.steel1).rect(9, 5, 14, 2, C.steel2).rect(13, 9, 6, 6, C.steel0);
    for (const [x, y] of [[8, 4], [24, 4], [6, 11], [26, 11], [8, 18], [24, 18], [16, 1]]) a.spike(x, y - 3, 3, C.steel3);
    a.gear(16, 12, 2, 5, C.brass2, { depth: 1 });
  },
  steam_barrier: (a) => {
    for (let y = 2; y < 19; y++) {
      const x0 = 8 + Math.round(Math.sin(y / 2) * 2);
      a.rect(x0, y, 16, 1, (y + Math.floor(y / 3)) % 2 ? C.steam1 : C.steam2);
    }
    a.rect(6, 2, 2, 17, C.brass1).rect(24, 2, 2, 17, C.brass1).rect(6, 1, 20, 1, C.brass2);
  },
  // ── 마력 술식 ──
  hand_throw: (a) => {
    a.line(4, 15, 18, 5, C.ink).line(4, 16, 18, 6, C.steel3).spike(19, 3, 3, C.steel3);
    a.line(10, 18, 26, 9, C.red1).line(10, 19, 26, 10, C.red2).spike(27, 7, 3, C.red2);
    a.ring(6, 6, 3, 1, C.arc2).set(29, 15, C.arc3);
  },
  rust_mist: (a) => {
    for (let i = 0; i < 9; i++) a.circle(4 + i * 3.2, 8 + Math.sin(i) * 3, 3 + (i % 3), i % 2 ? C.rust1 : C.arc1);
    for (let i = 0; i < 10; i++) a.set(3 + i * 3, 16 + (i % 2) * 2, C.rust2);
  },
  ether_drain: (a) => {
    a.circle(8, 10, 5, C.arc1).circle(8, 10, 3, C.arc3);
    for (let i = 0; i < 5; i++) a.set(14 + i * 3, 10 + Math.round(Math.sin(i * 1.4) * 3), C.arc2);
    a.grid(22, 5, ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], { r: C.green1 });
  },
  overload_circuit: (a) => {
    a.rect(4, 4, 24, 13, C.green0).rect(4, 4, 24, 1, C.green1);
    a.line(6, 8, 14, 8, C.brass2).line(14, 8, 14, 13, C.brass2).line(14, 13, 26, 13, C.brass2).line(18, 6, 18, 11, C.brass2);
    a.rect(8, 11, 3, 3, C.ink).rect(20, 7, 4, 3, C.ink);
    a.poly([[22, 1], [19, 8], [23, 8], [18, 16]], C.glow);
  },
  time_stop: (a) => {
    a.circle(16, 10, 8, C.arc2).circle(16, 10, 6, C.cream).line(16, 10, 16, 5, C.ink).line(16, 10, 19, 10, C.ink);
    a.rect(6, 2, 2, 16, C.arc3).rect(24, 2, 2, 16, C.arc3);
    a.set(3, 6, C.cyan).set(29, 14, C.cyan).set(28, 4, C.arc3);
  },
  // ── 산성 ──
  acid_flask: (a) => {
    a.rect(7, 2, 4, 5, C.steel3).rect(6, 2, 6, 1, C.cream);
    a.ellipse(9, 13, 6, 5, C.steel3).ellipse(9, 14, 5, 3.5, C.acid1).rect(5, 12, 9, 1, C.acid2);
    a.set(7, 15, C.acid2).set(11, 13, C.acid0);
    a.line(17, 8, 23, 5, C.white).line(17, 12, 25, 12, C.white);
    for (const [x, y] of [[24, 15], [28, 9], [27, 17]] as const) a.rect(x, y, 2, 2, C.acid1);
  },
  acid_spray: (a) => {
    a.rect(2, 7, 7, 6, C.brass1).rect(2, 7, 7, 1, C.brass3).rect(9, 9, 3, 2, C.steel2);
    for (let i = 0; i < 14; i++) {
      const x = 13 + i * 1.3;
      const y = 10 + Math.sin(i * 1.7) * (i / 2.5);
      a.rect(x, y, 2, 2, i % 3 ? C.acid1 : C.acid2);
    }
    for (const x of [6, 16, 26]) a.rect(x, 17, 3, 1, C.acid0);
  },
  dissolve: (a) => {
    a.gear(14, 8, 6, 8, C.steel2, { hole: 1.5, inner: C.steel1 });
    a.rect(6, 10, 18, 8, null);
    a.ellipse(14, 12, 9, 2, C.acid1).rect(5, 12, 19, 7, C.acid0).rect(5, 12, 19, 1, C.acid2);
    for (const [x, y] of [[9, 14], [17, 15], [13, 17], [21, 13]] as const) a.ring(x, y, 1, 1, C.acid2);
    a.set(26, 4, C.acid1).set(28, 7, C.acid2);
  },
  acid_catalyst: (a) => {
    a.rect(5, 3, 3, 4, C.steel3).ellipse(6, 12, 4, 5, C.steel3).ellipse(6, 13, 3, 3, C.acid1);
    a.rect(23, 3, 3, 4, C.steel3).ellipse(24, 12, 4, 5, C.steel3).ellipse(24, 13, 3, 3, C.arc2);
    a.line(12, 10, 18, 10, C.glow).line(15, 7, 15, 13, C.glow);
    a.set(15, 3, C.white).set(14, 17, C.acid2).set(16, 17, C.arc3);
  },
  acid_pump: (a) => {
    a.rect(3, 4, 10, 14, C.steel1).rect(3, 4, 10, 1, C.steel2).rect(5, 8, 6, 8, C.acid0).rect(5, 11, 6, 5, C.acid1);
    a.gear(20, 9, 5, 7, C.brass2, { hole: 1.2, inner: C.brass1 });
    a.rect(13, 14, 15, 2, C.copper1).rect(26, 14, 2, 5, C.copper1);
    a.rect(26, 19, 2, 1, C.acid2).set(6, 9, C.acid2).set(9, 12, C.acid2);
  },
  // ── 감전 ──
  tesla_coil: (a) => {
    a.rect(13, 12, 6, 7, C.steel1).rect(12, 18, 8, 2, C.steel0);
    for (let y = 12; y < 18; y += 2) a.rect(13, y, 6, 1, C.copper2);
    a.circle(16, 7, 4, C.steel2).circle(16, 7, 2, C.steel3);
    a.poly([[11, 6], [7, 3], [8, 8], [3, 6]], C.cyan).poly([[21, 6], [25, 2], [24, 8], [29, 5]], C.cyan);
    a.set(5, 2, C.white).set(27, 1, C.white).set(16, 1, C.white);
  },
  static_charge: (a) => {
    a.ring(16, 10, 8, 1, C.arc1).ring(16, 10, 5, 1, C.arc2);
    a.circle(16, 10, 2.5, C.cyan).set(16, 10, C.white);
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * Math.PI * 2;
      a.set(16 + Math.cos(t) * 11, 10 + Math.sin(t) * 7.5, i % 2 ? C.cyan : C.white);
    }
  },
  arc_lash: (a) => {
    a.rect(2, 13, 6, 3, C.brown2).rect(2, 13, 6, 1, C.brown3);
    a.poly([[8, 14], [12, 9], [16, 13], [20, 6], [24, 11], [29, 3]], C.cyan);
    a.poly([[8, 15], [12, 10], [16, 14], [20, 7], [24, 12], [29, 4]], C.white);
    for (const [x, y] of [[13, 4], [22, 16], [28, 9], [18, 2]] as const) a.set(x, y, C.cyan);
  },
  storm_generator: (a) => {
    a.rect(4, 12, 24, 7, C.steel1).rect(4, 12, 24, 1, C.steel2);
    a.gear(10, 15, 3, 6, C.brass2, { depth: 1 }).gear(22, 15, 3, 6, C.brass2, { depth: 1 });
    a.rect(8, 4, 2, 8, C.copper2).rect(22, 4, 2, 8, C.copper2).circle(9, 3, 2, C.steel3).circle(23, 3, 2, C.steel3);
    a.poly([[11, 3], [14, 6], [17, 2], [21, 4]], C.cyan).poly([[11, 4], [14, 7], [17, 3], [21, 5]], C.white);
  },
  // ── 복합 ──
  chain_reaction: (a) => {
    flame(a, 6, 18, 10, C.heat, C.glow);
    a.ellipse(16, 15, 4, 3, C.acid1).rect(14, 6, 4, 6, C.steel3).ellipse(16, 15, 3, 2, C.acid2);
    a.poly([[26, 3], [23, 10], [27, 10], [24, 18]], C.cyan);
    a.line(9, 4, 13, 2, C.white).line(19, 2, 22, 4, C.white);
  },
  total_detonation: (a) => {
    for (let i = 0; i < 9; i++) {
      const t = (i / 9) * Math.PI * 2;
      a.line(16, 10, 16 + Math.cos(t) * 14, 10 + Math.sin(t) * 9, [C.heat, C.acid1, C.cyan][i % 3]);
    }
    a.circle(16, 10, 5, C.red2).circle(16, 10, 3, C.glow).rect(15, 9, 2, 2, C.white);
  },
  // ── 압력 ──
  gauge_strike: (a) => {
    a.circle(11, 10, 7, C.brass1).circle(11, 10, 5.5, C.cream);
    for (let i = 0; i < 5; i++) {
      const t = Math.PI * (0.8 + i * 0.35);
      a.set(11 + Math.cos(t) * 4.5, 10 + Math.sin(t) * 4.5, C.ink);
    }
    a.line(11, 10, 15, 6, C.red1).circle(11, 10, 1, C.ink);
    a.line(20, 4, 28, 2, C.white).line(20, 10, 29, 10, C.white).line(20, 16, 28, 18, C.white);
  },
  overpressure: (a) => {
    a.ellipse(13, 11, 9, 7, C.copper1).ellipse(13, 10, 8, 5, C.copper2).rect(5, 10, 17, 1, C.copper3);
    a.rect(11, 1, 4, 4, C.brass2).rect(10, 1, 6, 1, C.brass3);
    a.line(4, 6, 6, 8, C.white).line(20, 15, 22, 17, C.ink);
    a.circle(26, 6, 3, C.steam2).circle(28, 13, 2.5, C.steam1).circle(24, 17, 2, C.steam2);
  },
  residual_valve: (a) => {
    a.rect(1, 8, 30, 5, C.steel1).rect(1, 8, 30, 1, C.steel2);
    a.rect(13, 5, 6, 11, C.brass1).rect(13, 5, 6, 1, C.brass3);
    a.ring(16, 3, 3, 1, C.red1).line(13, 3, 19, 3, C.red1);
    a.rect(4, 9, 7, 3, C.steam1).rect(21, 9, 4, 3, C.steam1);
  },
  // ── 과열 ──
  thermal_lance: (a) => {
    a.rect(1, 8, 8, 5, C.steel1).rect(1, 8, 8, 1, C.steel2).rect(3, 9, 2, 3, C.heat);
    a.rect(9, 9, 22, 3, C.red2).rect(9, 10, 22, 1, C.glow).rect(9, 10, 6, 1, C.white);
    a.set(14, 6, C.heat).set(22, 14, C.heat).set(27, 7, C.glow);
  },
  exhaust_blast: (a) => {
    a.rect(13, 1, 6, 8, C.steel1).rect(13, 1, 6, 1, C.steel2).rect(12, 8, 8, 2, C.steel2);
    for (const [x, h] of [[4, 7], [10, 9], [16, 10], [22, 9], [28, 7]] as const) flame(a, x, 19, h, C.heat, C.glow);
  },
  afterburner: (a) => {
    a.rect(14, 6, 16, 8, C.steel1).rect(14, 6, 16, 1, C.steel2).rect(14, 13, 16, 1, C.steel0);
    a.ring(14, 10, 4, 1, C.steel2);
    a.ellipse(7, 10, 6, 3, C.heat).ellipse(8, 10, 4, 2, C.glow).ellipse(10, 10, 2, 1, C.white);
    a.set(1, 8, C.heat).set(2, 12, C.red2);
  },
  redline: (a) => {
    a.circle(16, 12, 9, C.steel1).circle(16, 12, 7.5, C.cream);
    for (let i = 0; i < 6; i++) {
      const t = Math.PI * (1 + i * 0.2);
      a.set(16 + Math.cos(t) * 6, 12 + Math.sin(t) * 6, i >= 3 ? C.red1 : C.ink);
    }
    a.ellipse(21, 7, 3, 2, C.red2);
    a.line(16, 12, 22, 7, C.red1).circle(16, 12, 1, C.ink);
    a.set(3, 3, C.heat).set(29, 3, C.heat);
  },
  jammed_gear: (a) => {
    a.gear(12, 10, 6, 8, C.steel1, { hole: 1.5, inner: C.steel0 });
    a.gear(22, 10, 5, 7, C.steel1, { hole: 1.2, inner: C.steel0, phase: 0.2 });
    a.line(5, 3, 28, 17, C.red1).line(5, 4, 28, 18, C.red2);
  },

  rusted_part: (a) => {
    a.gear(15, 10, 7, 8, C.rust1, { hole: 2, inner: C.rust0 });
    for (let y = 0; y < 9; y++) for (let x = 18; x < 26; x++) if (x - 18 > y - 2) a.set(x, y, null);
    a.poly([[11, 6], [13, 9], [12, 12]], C.ink).set(9, 13, C.rust2).set(19, 14, C.rust2).set(16, 16, C.rust2);
    a.rect(24, 13, 3, 2, C.rust1).set(27, 17, C.rust1);
  },
};

export function cardArtImg(id: string, family: Family | undefined, scale = 3): string {
  const fam = family ?? 'none';
  const s = bake(`art:${id}`, () => {
    const [top, bottom] = BG[fam];
    const bg = new Pix(ART_W, ART_H).rect(0, 0, ART_W, ART_H, bottom);
    for (let y = 0; y < ART_H / 2; y++) for (let x = 0; x < ART_W; x++) if (y < 6 || (x + y) % 2 === 0) bg.set(x, y, top);
    const art = new Pix(ART_W, ART_H);
    ART[id]?.(art);
    return bg.over(art.outline());
  });
  return `<img class="px card-art" src="${s.url}" width="${s.w * scale}" height="${s.h * scale}" alt="">`;
}
