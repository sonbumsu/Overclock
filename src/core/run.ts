import { ACT_LAYOUT, ACTS } from '../data/acts';
import { ARCHETYPES } from '../data/archetypes';
import { REWARD_POOL } from '../data/cards';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { createCombat } from './combat';
import { Rng } from './rng';
import type { CardInstance, CombatState, Rarity } from './types';

export type CombatTier = 'normal' | 'elite' | 'boss';

/** act는 0부터 시작하는 구역 번호 */
export type Floor =
  | { kind: 'combat'; tier: CombatTier; enemies: string[]; act: number }
  | { kind: 'rest'; act: number }
  /** 새 구역 입구 — 최대 체력이 늘고 완전히 회복 */
  | { kind: 'actStart'; act: number };

export const REST_HEAL_RATIO = 0.3;
export const ACT_MAX_HP_BONUS = 8;
/** 분해로 덱을 이보다 작게 줄일 수는 없다 */
export const MIN_DECK_SIZE = 5;

/** 필살기를 쓰고 나면 이만큼의 전투를 지나야 다시 쓸 수 있다 */
export const SKILL_RECHARGE = 3;

/** 캐릭터에 어울리는 카드가 보상에 나올 가중치 (나머지는 1) */
export const FAVORED_WEIGHT = 4;

const REWARD_WEIGHTS: Record<CombatTier, Record<Exclude<Rarity, 'starter'>, number>> = {
  normal: { common: 65, precision: 30, masterwork: 5 },
  elite: { common: 40, precision: 45, masterwork: 15 },
  boss: { common: 0, precision: 55, masterwork: 45 },
};

export interface RunState {
  seed: number;
  character: string;
  rng: Rng;
  hp: number;
  maxHp: number;
  deck: CardInstance[];
  floors: Floor[];
  floor: number;
  nextCardUid: number;
  /** 필살기 충전 — SKILL_RECHARGE이면 다음 전투에서 쓸 수 있다 */
  skillCharge: number;
}

/** 구역마다 ACT_LAYOUT에 따라 적 무리를 뽑아 층을 만든다. 같은 무리가 연달아 나오지 않게 한다. */
export function generateFloors(rng: Rng): Floor[] {
  const floors: Floor[] = [];
  ACTS.forEach((act, a) => {
    if (a > 0) floors.push({ kind: 'actStart', act: a });
    let last: string[] | undefined;
    for (const slot of ACT_LAYOUT) {
      if (slot === 'rest') {
        floors.push({ kind: 'rest', act: a });
        continue;
      }
      if (slot === 'boss') {
        floors.push({ kind: 'combat', tier: 'boss', enemies: act.boss, act: a });
        continue;
      }
      const pool = act[slot];
      const options = pool.length > 1 ? pool.filter((g) => g !== last) : pool;
      last = rng.pick(options);
      floors.push({ kind: 'combat', tier: slot === 'elite' ? 'elite' : 'normal', enemies: last, act: a });
    }
  });
  return floors;
}

export function createRun(seed: number, characterId = 'engineer'): RunState {
  const rng = new Rng(seed);
  const character = CHARACTERS[characterId];
  const run: RunState = {
    seed,
    character: characterId,
    rng,
    hp: character.maxHp,
    maxHp: character.maxHp,
    deck: [],
    floors: generateFloors(rng),
    floor: 0,
    nextCardUid: 1,
    skillCharge: SKILL_RECHARGE,
  };
  for (const id of character.deck) addCard(run, id);
  return run;
}

export const runCharacter = (run: RunState): CharacterDef => CHARACTERS[run.character];

/** 이 캐릭터의 보상에서 우대받는 카드인지 */
export const isFavored = (run: RunState, cardId: string): boolean =>
  ARCHETYPES[runCharacter(run).archetype].cards.includes(cardId);

export const currentFloor = (run: RunState): Floor => run.floors[run.floor];

/** 현재 층이 속한 구역에서 몇 번째 층인지 (1부터, 구역 입구는 0) */
export function floorInAct(run: RunState): { act: number; index: number; total: number } {
  const act = currentFloor(run)?.act ?? ACTS.length - 1;
  const inAct = run.floors.filter((f) => f.act === act && f.kind !== 'actStart');
  return { act, index: inAct.indexOf(currentFloor(run)) + 1, total: inAct.length };
}

export function addCard(run: RunState, defId: string): void {
  run.deck.push({ uid: run.nextCardUid++, defId });
}

export function startFloorCombat(run: RunState): CombatState {
  const floor = currentFloor(run);
  if (floor.kind !== 'combat') throw new Error('전투 층이 아닙니다');
  return startCustomCombat(run, floor.enemies);
}

/** 층과 상관없이 정한 적들과 싸운다 (개발자 모드) */
export function startCustomCombat(run: RunState, enemyIds: string[]): CombatState {
  const { passive, skill } = runCharacter(run);
  return createCombat({
    hp: run.hp, maxHp: run.maxHp, deck: run.deck, enemyIds, rng: run.rng,
    statuses: passive.statuses, maxHeat: passive.maxHeat,
    skill, skillReady: run.skillCharge >= SKILL_RECHARGE,
  });
}

/**
 * 전투가 끝나면 필살기 충전을 정산한다.
 * 쓴 전투를 포함해 전투를 마칠 때마다 1씩 차므로, N번째 전투에서 쓰면 N+3번째 전투에서 다시 쓸 수 있다.
 */
export function settleSkill(run: RunState, combat: CombatState): void {
  if (combat.skillUsed) run.skillCharge = 0;
  run.skillCharge = Math.min(SKILL_RECHARGE, run.skillCharge + 1);
}

/**
 * 서로 다른 카드 count장을 뽑는다. 등급을 먼저 정하고, 그 등급 안에서는
 * 캐릭터에 어울리는 카드가 FAVORED_WEIGHT배 더 잘 나온다. exclude에 든 카드는 다시 나오지 않는다.
 */
export function rollCardRewards(run: RunState, tier: CombatTier, count = 3, exclude: string[] = []): string[] {
  const picked: string[] = [];
  while (picked.length < count) {
    const rarity = run.rng.weighted(REWARD_WEIGHTS[tier]);
    const options = REWARD_POOL.filter((c) => c.rarity === rarity && !picked.includes(c.id) && !exclude.includes(c.id));
    if (options.length === 0) continue;
    const weights = Object.fromEntries(options.map((c) => [c.id, isFavored(run, c.id) ? FAVORED_WEIGHT : 1]));
    picked.push(run.rng.weighted(weights));
  }
  return picked;
}

export function rest(run: RunState): number {
  const healed = Math.min(run.maxHp - run.hp, Math.ceil(run.maxHp * REST_HEAL_RATIO));
  run.hp += healed;
  return healed;
}

export function canRemoveCard(run: RunState): boolean {
  return run.deck.length > MIN_DECK_SIZE;
}

/** 정비소의 분해 — 덱에서 카드 한 장을 영구히 뺀다 */
export function removeCard(run: RunState, uid: number): boolean {
  const i = run.deck.findIndex((c) => c.uid === uid);
  if (i < 0 || !canRemoveCard(run)) return false;
  run.deck.splice(i, 1);
  return true;
}

export function enterAct(run: RunState): void {
  run.maxHp += ACT_MAX_HP_BONUS;
  run.hp = run.maxHp;
}
