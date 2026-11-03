import engineer from '../assets/heroes/engineer.png';
import guardian from '../assets/heroes/guardian.png';
import gunner from '../assets/heroes/gunner.png';
import overclocker from '../assets/heroes/overclocker.png';
import stoker from '../assets/heroes/stoker.png';

// ── 주인공 그림 — 직접 받은 일러스트를 잘라 쓴다 (src/assets/heroes) ─────────

/** 원본 이미지 크기. 모두 같은 원화에서 잘라 발끝 높이가 같다 */
const SOURCES: Record<string, { url: string; w: number; h: number }> = {
  engineer: { url: engineer, w: 411, h: 509 },
  stoker: { url: stoker, w: 383, h: 506 },
  gunner: { url: gunner, w: 388, h: 519 },
  guardian: { url: guardian, w: 433, h: 521 },
  overclocker: { url: overclocker, w: 347, h: 535 },
};

/** 원본 픽셀 → 도트 단위. 가장 큰 그림이 도트 62칸 높이가 되게 맞춰 다른 스프라이트와 같은 배율로 쓴다 */
const UNIT = 62 / 535;

export const HERO_IMAGES: Record<string, { url: string; w: number; h: number }> = Object.fromEntries(
  Object.entries(SOURCES).map(([id, s]) => [id, { url: s.url, w: s.w * UNIT, h: s.h * UNIT }]),
);
