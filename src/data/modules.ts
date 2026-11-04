import type { Statuses } from '../core/types';

/**
 * 모듈 — 런 내내 효과가 이어지는 장착 부품(유물).
 * 효과는 아래 필드를 run.ts가 모아서 적용한다. 필드가 없는 효과는 0으로 본다.
 */
export interface ModuleDef {
  id: string;
  name: string;
  text: string;
  rarity: 'common' | 'rare';
  /** 아이콘 색 — 공격 · 방어 · 지원 */
  tone: 'copper' | 'steel' | 'brass' | 'arcane';
  /** 전투 시작 시 기관사에게 */
  statuses?: Statuses;
  /** 전투 시작 시 모든 적에게 */
  enemyStatuses?: Statuses;
  startBlock?: number;
  firstTurnDraw?: number;
  firstTurnSteam?: number;
  maxHeat?: number;
  /** 전투에서 이기면 회복 */
  healAfterCombat?: number;
  /** 전투로 얻는 주화 비율 보너스 */
  goldBonus?: number;
  /** 휴식 회복 비율 보너스 */
  restBonus?: number;
  /** 상점 할인 비율 */
  shopDiscount?: number;
  /** 얻는 순간 최대 체력 증가 */
  maxHpOnPickup?: number;
  /** 카드 보상 선택지 추가 */
  rewardChoices?: number;
  /** 필살기 충전에 필요한 전투 수 감소 */
  skillRecharge?: number;
}

const MODULE_LIST: ModuleDef[] = [
  // ── 일반 ──
  { id: 'brass_cog', name: '황동 톱니', rarity: 'common', tone: 'copper',
    text: '전투 시작 시 출력 +1.', statuses: { strength: 1 } },
  { id: 'rivet_plating', name: '리벳 장갑판', rarity: 'common', tone: 'steel',
    text: '전투 시작 시 방어도 10.', startBlock: 10 },
  { id: 'barbed_coil', name: '가시 철조망', rarity: 'common', tone: 'steel',
    text: '전투 시작 시 가시 +3.', statuses: { thorns: 3 } },
  { id: 'corrosion_sprayer', name: '부식 분무기', rarity: 'common', tone: 'arcane',
    text: '전투 시작 시 모든 적에게 부식 2.', enemyStatuses: { vulnerable: 2 } },
  { id: 'igniter', name: '점화 장치', rarity: 'common', tone: 'copper',
    text: '전투 시작 시 모든 적에게 화상 5.', enemyStatuses: { burn: 5 } },
  { id: 'galvanic_cell', name: '갈바니 전지', rarity: 'common', tone: 'arcane',
    text: '전투 시작 시 모든 적에게 감전 6.', enemyStatuses: { shock: 6 } },
  { id: 'pressure_tank', name: '압력 탱크', rarity: 'common', tone: 'steel',
    text: '전투 시작 시 압력 +6.', statuses: { pressure: 6 } },
  { id: 'cooling_fins', name: '냉각 핀', rarity: 'common', tone: 'steel',
    text: '과열 한계 +3.', maxHeat: 3 },
  { id: 'repair_kit', name: '응급 수리 키트', rarity: 'common', tone: 'brass',
    text: '전투에서 이기면 체력 6 회복.', healAfterCombat: 6 },
  { id: 'gilded_scale', name: '금도금 저울', rarity: 'common', tone: 'brass',
    text: '전투에서 얻는 주화 +50%.', goldBonus: 0.5 },
  { id: 'steam_bed', name: '증기 침대', rarity: 'common', tone: 'brass',
    text: '휴식할 때 체력을 15% 더 회복.', restBonus: 0.15 },
  { id: 'life_spring', name: '생명 태엽', rarity: 'common', tone: 'brass',
    text: '얻을 때 최대 체력 +10.', maxHpOnPickup: 10 },
  { id: 'spare_spring', name: '예비 태엽', rarity: 'common', tone: 'copper',
    text: '전투 첫 턴에 카드를 2장 더 드로우.', firstTurnDraw: 2 },

  // ── 희귀 ──
  { id: 'spare_boiler', name: '예비 보일러', rarity: 'rare', tone: 'copper',
    text: '전투 첫 턴에 증기압 +2.', firstTurnSteam: 2 },
  { id: 'inertia_weight', name: '관성 추', rarity: 'rare', tone: 'copper',
    text: '매 턴 회전 +1로 시작.', statuses: { flywheel: 1 } },
  { id: 'guild_seal', name: '상인 조합 인장', rarity: 'rare', tone: 'brass',
    text: '상점 가격 30% 할인.', shopDiscount: 0.3 },
  { id: 'precision_lens', name: '정밀 렌즈', rarity: 'rare', tone: 'arcane',
    text: '카드 보상 선택지 +1.', rewardChoices: 1 },
  { id: 'capacitor', name: '마력 축전지', rarity: 'rare', tone: 'arcane',
    text: '필살기가 전투 1번 더 빨리 충전된다.', skillRecharge: 1 },
];

export const MODULES: Record<string, ModuleDef> = Object.fromEntries(MODULE_LIST.map((m) => [m.id, m]));
export const MODULE_IDS = MODULE_LIST.map((m) => m.id);
