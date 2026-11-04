import type { Rng } from './rng';

/** 카드 계열 — 계열 간 맞물림이 시너지의 핵심 */
export type Family = 'gear' | 'steam' | 'arcane';
export type CardType = 'attack' | 'skill' | 'power' | 'status';
export type Rarity = 'starter' | 'common' | 'precision' | 'masterwork';

/**
 * strength(출력): 주는 피해 +N
 * vulnerable(부식): 받는 피해 50% 증가 (턴마다 감소)
 * weak(녹): 주는 피해 25% 감소 (턴마다 감소)
 * burn(화상): 자기 턴 시작에 방어도를 무시하는 피해 N, 그 뒤 1 감소
 * pressure(압력): 방출 카드의 피해를 키운다
 * flywheel(플라이휠): 매 턴 회전 N으로 시작
 * amplifier(증폭): 매 턴 증기압 +N
 * furnace(화염 보일러): 매 턴 모든 적에게 화상 N
 * compressor(압축기): 매 턴 압력 +N
 * autoloader(자동 장전): 카드를 3장 쓸 때마다 N장 드로우
 * spring(무한 태엽): 매 턴 N장 더 드로우
 * thorns(가시): 공격받을 때마다 공격자에게 피해 N
 * retain(증기 방벽): 턴이 시작돼도 방어도가 사라지지 않음
 * heatsink(열교환기): 과열이 오를 때마다 방어도 +N
 * meltdown(폭주 기관): 고장 시 자신 대신 모든 적에게 피해 N
 * stun(기절): 다음 행동을 건너뜀
 * kindling(불씨): 적에게 지속 피해(화상·산성·감전)를 걸 때마다 +N
 * acid(산성): 자기 턴 시작에 방어도를 무시하는 피해 N. 줄어들지 않는다
 * shock(감전): 공격에 맞을 때마다 방어도를 무시하는 추가 피해 N, 그 뒤 1 감소
 * acidPump(산성 순환기): 매 턴 모든 적에게 산성 N
 * generator(뇌전 발생기): 매 턴 모든 적에게 감전 N
 * residual(잔압 밸브): 압력을 소모해도 절반이 남는다
 * redline(레드존): 과열이 한계의 절반 이상이면 주는 피해 +N
 */
export type StatusId =
  | 'strength' | 'vulnerable' | 'weak' | 'burn' | 'pressure' | 'stun'
  | 'flywheel' | 'amplifier' | 'furnace' | 'compressor' | 'autoloader' | 'spring'
  | 'thorns' | 'retain' | 'heatsink' | 'meltdown' | 'kindling'
  | 'acid' | 'shock' | 'acidPump' | 'generator' | 'residual' | 'redline';
/** 지속 피해 상태 */
export type DotId = 'burn' | 'acid' | 'shock';
export type Statuses = Partial<Record<StatusId, number>>;

export type Effect =
  | {
      kind: 'damage'; amount: number; times?: number;
      perRotation?: number; perChain?: number; perPressure?: number;
      /** 대상에게 걸린 상태 1당 추가 피해 */
      perTargetStatus?: { status: StatusId; amount: number };
      /** 현재 방어도 · 과열 1당 추가 피해 */
      perBlock?: number; perHeat?: number;
      /** 회전 1당 추가 타격 횟수 */
      hitsPerRotation?: number;
      /** 막히지 않은 피해만큼 회복 */
      lifesteal?: boolean;
    }
  | { kind: 'damageAll'; amount: number; perRotation?: number; perHeat?: number }
  | { kind: 'block'; amount: number }
  | { kind: 'draw'; amount: number }
  | { kind: 'steam'; amount: number }
  | { kind: 'wind'; amount: number }
  | { kind: 'heat'; amount: number }
  | { kind: 'applyStatus'; status: StatusId; amount: number; target: 'self' | 'enemy' | 'allEnemies' }
  | { kind: 'multiplyStatus'; status: StatusId; factor: number; target: 'self' | 'enemy' }
  | { kind: 'clearStatus'; status: StatusId }
  /** 대상에게 걸린 지속 피해 합 × factor만큼 방어도를 무시하는 피해 (상태는 그대로) */
  | { kind: 'detonate'; statuses: DotId[]; factor?: number }
  /** 과열을 모두 없애고, 없앤 과열 1당 방어도 */
  | { kind: 'vent'; blockPerHeat: number }
  /** 버린 더미에 카드를 넣는다 */
  | { kind: 'addCard'; cardId: string; count: number };

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  family?: Family;
  rarity: Rarity;
  /** null이면 사용할 수 없는 카드 */
  cost: number | null;
  text: string;
  effects: Effect[];
  /** 직전에 사용한 카드가 `after` 계열이면 추가로 발동 */
  mesh?: { after: Family; effects: Effect[] };
  exhaust?: boolean;
  /** 정비로 강화된 카드 */
  upgraded?: boolean;
}

/** 캐릭터 필살기 — 증기압을 쓰지 않고, 몇 번의 전투마다 한 번 쓸 수 있다 */
export interface SkillDef {
  id: string;
  name: string;
  text: string;
  effects: Effect[];
}

export interface CardInstance {
  uid: number;
  defId: string;
}

export type EnemyEffect =
  | { kind: 'attack'; amount: number; times?: number }
  | { kind: 'block'; amount: number }
  | { kind: 'applyStatus'; status: StatusId; amount: number; target: 'self' | 'player' }
  /** 기관사의 버린 더미에 불량 카드를 섞는다 */
  | { kind: 'addCard'; cardId: string; count: number };

export interface EnemyMove {
  id: string;
  name: string;
  effects: EnemyEffect[];
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: [min: number, max: number];
  pattern: 'cycle' | 'random';
  moves: EnemyMove[];
}

export interface Combatant {
  hp: number;
  maxHp: number;
  block: number;
  statuses: Statuses;
}

export interface PlayerState extends Combatant {
  steam: number;
  maxSteam: number;
  heat: number;
  maxHeat: number;
}

export interface EnemyState extends Combatant {
  uid: number;
  defId: string;
  name: string;
  moveIndex: number;
  nextMoveId: string;
}

export type UnitRef = 'player' | number;

/** 화면 연출용 기록 — 규칙에는 영향이 없고, UI가 읽은 뒤 비운다. */
export type CombatEvent =
  | { kind: 'card'; cardId: string; attack: boolean; power: boolean; overclock: boolean; mesh: boolean; combo: number }
  | { kind: 'skill'; skillId: string }
  | { kind: 'enemyMove'; enemy: number }
  | { kind: 'hit'; source: UnitRef; target: UnitRef; damage: number; blocked: number; hp: number; cardId?: string }
  | { kind: 'block'; target: UnitRef; amount: number }
  | { kind: 'status'; target: UnitRef; status: StatusId; amount: number }
  /** 지속 피해가 터짐 */
  | { kind: 'dot'; status: DotId; target: UnitRef; damage: number; hp: number }
  | { kind: 'stunned'; enemy: number }
  | { kind: 'heal'; target: UnitRef; amount: number; hp: number }
  | { kind: 'cardAdded'; cardId: string; count: number }
  | { kind: 'breakdown'; damage: number; hp: number };

export interface CombatState {
  player: PlayerState;
  enemies: EnemyState[];
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  turn: number;
  /** 이번 턴에 감긴 태엽 수 */
  rotation: number;
  /** 같은 계열 카드를 연속으로 사용한 횟수 */
  chain: number;
  /** 이번 턴에 사용한 카드 수 */
  cardsPlayed: number;
  /** 이번 턴에 카드 효과로 뽑은 장수 (턴 시작 드로우 제외) */
  extraDrawn: number;
  lastFamily: Family | null;
  rng: Rng;
  log: string[];
  events: CombatEvent[];
  outcome: 'ongoing' | 'won' | 'lost';
  nextCardUid: number;
  /** 이 전투에서 쓸 수 있는 필살기 (없으면 null) */
  skill: SkillDef | null;
  /** 필살기를 지금 쓸 수 있는지 — 한 전투에 한 번 */
  skillReady: boolean;
  /** 이번 전투에서 필살기를 썼는지 (런의 충전 계산용) */
  skillUsed: boolean;
  /** 개발자 모드 무적 — 체력이 1 아래로 내려가지 않는다 */
  god?: boolean;
}
