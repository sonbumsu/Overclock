import { ACTS } from '../data/acts';
import { ARCHETYPES } from '../data/archetypes';
import { canUpgradeCard, CARDS, REWARD_POOL } from '../data/cards';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { EVENT_IDS, EVENTS, type EventOutcome } from '../data/events';
import { MODULE_IDS, MODULES, type ModuleDef } from '../data/modules';
import { createCombat, MAX_HEAT } from './combat';
import { generateMap, MAP_ROWS, type MapNode, type RoomKind } from './map';
import { Rng } from './rng';
import type { CardInstance, CombatState, Rarity, Statuses } from './types';

export type CombatTier = 'normal' | 'elite' | 'boss';

export const REST_HEAL_RATIO = 0.3;
export const ACT_MAX_HP_BONUS = 8;
/** 분해로 덱을 이보다 작게 줄일 수는 없다 */
export const MIN_DECK_SIZE = 5;
export const START_GOLD = 60;

/** 필살기를 쓰고 나면 이만큼의 전투를 지나야 다시 쓸 수 있다 (모듈로 줄어들 수 있다) */
export const SKILL_RECHARGE = 3;

/** 캐릭터에 어울리는 카드가 보상에 나올 가중치 (나머지는 1) */
export const FAVORED_WEIGHT = 4;

const REWARD_WEIGHTS: Record<CombatTier, Record<Exclude<Rarity, 'starter'>, number>> = {
  normal: { common: 65, precision: 30, masterwork: 5 },
  elite: { common: 40, precision: 45, masterwork: 15 },
  boss: { common: 0, precision: 55, masterwork: 45 },
};

const GOLD_REWARD: Record<CombatTier, [number, number]> = { normal: [14, 22], elite: [30, 40], boss: [75, 90] };

export const CARD_PRICE: Record<Exclude<Rarity, 'starter'>, [number, number]> = {
  common: [45, 55], precision: [70, 85], masterwork: [105, 125],
};
export const MODULE_PRICE: Record<ModuleDef['rarity'], [number, number]> = { common: [120, 140], rare: [175, 200] };
export const REMOVE_PRICE = 60;
export const REMOVE_PRICE_STEP = 25;

export interface RunState {
  seed: number;
  character: string;
  rng: Rng;
  hp: number;
  maxHp: number;
  deck: CardInstance[];
  nextCardUid: number;
  /** 필살기 충전 — skillRecharge(run)이면 다음 전투에서 쓸 수 있다 */
  skillCharge: number;
  /** 0부터 시작하는 구역 번호 */
  act: number;
  /** 지금 구역의 지도 */
  map: MapNode[];
  /** 지금 있는(마지막으로 들어간) 방. 구역에 막 들어왔으면 null */
  node: number | null;
  /** 이번 구역에서 지나온 방 */
  visited: number[];
  gold: number;
  modules: string[];
  /** 상점에서 카드를 분해한 횟수 — 할 때마다 비싸진다 */
  removeCount: number;
  /** 이번 구역에서 치른 일반 전투 수 — 처음 두 번은 쉬운 무리 */
  combatsInAct: number;
  /** 바로 전 일반 전투의 적 무리 — 연달아 같은 무리가 나오지 않게 */
  lastGroup: string;
  /** 이미 본 이벤트 — 다 보기 전에는 다시 나오지 않는다 */
  seenEvents: string[];
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
    nextCardUid: 1,
    skillCharge: SKILL_RECHARGE,
    act: 0,
    map: generateMap(rng),
    node: null,
    visited: [],
    gold: START_GOLD,
    modules: [],
    removeCount: 0,
    combatsInAct: 0,
    lastGroup: '',
    seenEvents: [],
  };
  for (const id of character.deck) addCard(run, id);
  return run;
}

export const runCharacter = (run: RunState): CharacterDef => CHARACTERS[run.character];

/** 이 캐릭터의 보상에서 우대받는 카드인지 */
export const isFavored = (run: RunState, cardId: string): boolean =>
  ARCHETYPES[runCharacter(run).archetype].cards.includes(cardId);

export function addCard(run: RunState, defId: string): void {
  run.deck.push({ uid: run.nextCardUid++, defId });
}

// ── 지도 ──────────────────────────────────────────

export const currentNode = (run: RunState): MapNode | null => (run.node === null ? null : run.map[run.node]);

/** 지금 갈 수 있는 방 — 구역 시작이면 맨 아랫줄 전부 */
export function reachableNodes(run: RunState): MapNode[] {
  const here = currentNode(run);
  if (!here) return run.map.filter((n) => n.row === 0);
  return here.next.map((id) => run.map[id]);
}

export function moveTo(run: RunState, nodeId: number): MapNode | null {
  if (!reachableNodes(run).some((n) => n.id === nodeId)) return null;
  run.node = nodeId;
  run.visited.push(nodeId);
  return run.map[nodeId];
}

/** 지금 구역에서 몇 번째 층인지 (1부터, 구역에 막 들어왔으면 0) */
export function floorInAct(run: RunState): { act: number; index: number; total: number } {
  return { act: run.act, index: (currentNode(run)?.row ?? -1) + 1, total: MAP_ROWS + 1 };
}

export const isFinalAct = (run: RunState): boolean => run.act >= ACTS.length - 1;

/** 보스를 잡고 다음 구역으로 — 새 지도, 최대 체력 증가와 완전 회복은 enterAct에서 */
export function advanceAct(run: RunState): void {
  run.act += 1;
  run.map = generateMap(run.rng);
  run.node = null;
  run.visited = [];
  run.combatsInAct = 0;
  run.lastGroup = '';
}

export function enterAct(run: RunState): void {
  run.maxHp += ACT_MAX_HP_BONUS;
  run.hp = run.maxHp;
}

export const ROOM_TIER: Partial<Record<RoomKind, CombatTier>> = { combat: 'normal', elite: 'elite', boss: 'boss' };

// ── 모듈 ──────────────────────────────────────────

export const runModules = (run: RunState): ModuleDef[] => run.modules.map((id) => MODULES[id]).filter(Boolean);

type NumericModuleKey = { [K in keyof ModuleDef]-?: ModuleDef[K] extends number | undefined ? K : never }[keyof ModuleDef];
/** 가진 모듈들의 수치 효과 합 */
export const moduleSum = (run: RunState, key: NumericModuleKey): number =>
  runModules(run).reduce((sum, m) => sum + ((m[key] as number | undefined) ?? 0), 0);

function sumStatuses(list: (Statuses | undefined)[]): Statuses {
  const out: Statuses = {};
  for (const s of list) for (const [id, n] of Object.entries(s ?? {})) out[id as keyof Statuses] = (out[id as keyof Statuses] ?? 0) + n;
  return out;
}

export function gainModule(run: RunState, id: string): void {
  if (run.modules.includes(id) || !MODULES[id]) return;
  run.modules.push(id);
  const bonus = MODULES[id].maxHpOnPickup ?? 0;
  run.maxHp += bonus;
  run.hp += bonus;
}

/** 아직 없는 모듈 하나. rare를 주면 그 등급에서 먼저 찾는다. 다 모았으면 null */
export function rollModule(run: RunState, rarity?: ModuleDef['rarity'], exclude: string[] = []): string | null {
  const free = MODULE_IDS.filter((id) => !run.modules.includes(id) && !exclude.includes(id));
  if (free.length === 0) return null;
  const preferred = rarity ? free.filter((id) => MODULES[id].rarity === rarity) : [];
  return run.rng.pick(preferred.length ? preferred : free);
}

/** 필살기 충전에 필요한 전투 수 */
export const skillRecharge = (run: RunState): number => Math.max(1, SKILL_RECHARGE - moduleSum(run, 'skillRecharge'));

// ── 전투 ──────────────────────────────────────────

/** 지금 방의 적과 싸운다. 일반 전투는 구역 처음 두 번이 쉬운 무리 */
export function startRoomCombat(run: RunState): CombatState {
  const node = currentNode(run);
  const act = ACTS[run.act];
  if (!node || !ROOM_TIER[node.kind]) throw new Error('전투 방이 아닙니다');
  let enemies: string[];
  if (node.kind === 'boss') enemies = act.boss;
  else {
    const pool = node.kind === 'elite' ? act.elite : run.combatsInAct < 2 ? act.easy : act.normal;
    const options = pool.length > 1 ? pool.filter((g) => g.join() !== run.lastGroup) : pool;
    enemies = run.rng.pick(options);
    if (node.kind === 'combat') {
      run.combatsInAct += 1;
      run.lastGroup = enemies.join();
    }
  }
  return startCustomCombat(run, enemies);
}

/** 방과 상관없이 정한 적들과 싸운다 (개발자 모드 · 테스트) */
export function startCustomCombat(run: RunState, enemyIds: string[]): CombatState {
  const { passive, skill } = runCharacter(run);
  const mods = runModules(run);
  return createCombat({
    hp: run.hp, maxHp: run.maxHp, deck: run.deck, enemyIds, rng: run.rng,
    statuses: sumStatuses([passive.statuses, ...mods.map((m) => m.statuses)]),
    maxHeat: (passive.maxHeat ?? MAX_HEAT) + moduleSum(run, 'maxHeat'),
    skill, skillReady: run.skillCharge >= skillRecharge(run),
    enemyStatuses: sumStatuses(mods.map((m) => m.enemyStatuses)),
    startBlock: moduleSum(run, 'startBlock'),
    firstTurnDraw: moduleSum(run, 'firstTurnDraw'),
    firstTurnSteam: moduleSum(run, 'firstTurnSteam'),
  });
}

/**
 * 전투가 끝나면 필살기 충전을 정산한다.
 * 쓴 전투를 포함해 전투를 마칠 때마다 1씩 차므로, N번째 전투에서 쓰면 N+3번째 전투에서 다시 쓸 수 있다.
 */
export function settleSkill(run: RunState, combat: CombatState): void {
  if (combat.skillUsed) run.skillCharge = 0;
  run.skillCharge = Math.min(skillRecharge(run), run.skillCharge + 1);
}

export interface CombatSpoils {
  gold: number;
  module: string | null;
  healed: number;
}

/** 이긴 전투의 주화 · 모듈 · 수리 키트 회복을 런에 반영하고 무엇을 얻었는지 돌려준다 */
export function claimCombatSpoils(run: RunState, tier: CombatTier): CombatSpoils {
  const [lo, hi] = GOLD_REWARD[tier];
  const gold = Math.round(run.rng.int(lo, hi) * (1 + moduleSum(run, 'goldBonus')));
  run.gold += gold;
  const module = tier === 'normal' ? null : rollModule(run, tier === 'boss' ? 'rare' : undefined);
  if (module) gainModule(run, module);
  const healed = heal(run, moduleSum(run, 'healAfterCombat'));
  return { gold, module, healed };
}

/**
 * 서로 다른 카드 count장을 뽑는다. 등급을 먼저 정하고, 그 등급 안에서는
 * 캐릭터에 어울리는 카드가 FAVORED_WEIGHT배 더 잘 나온다. exclude에 든 카드는 다시 나오지 않는다.
 */
export function rollCardRewards(run: RunState, tier: CombatTier, count = 3, exclude: string[] = []): string[] {
  const picked: string[] = [];
  while (picked.length < count) {
    const rarity = run.rng.weighted(REWARD_WEIGHTS[tier]);
    picked.push(rollCardOfRarity(run, rarity, [...picked, ...exclude]));
  }
  return picked;
}

/** 카드 보상 선택지 수 (정밀 렌즈로 늘어난다) */
export const rewardChoiceCount = (run: RunState): number => 3 + moduleSum(run, 'rewardChoices');

function rollCardOfRarity(run: RunState, rarity: Exclude<Rarity, 'starter'>, exclude: string[]): string {
  let options = REWARD_POOL.filter((c) => c.rarity === rarity && !exclude.includes(c.id));
  if (options.length === 0) options = REWARD_POOL.filter((c) => !exclude.includes(c.id));
  const weights = Object.fromEntries(options.map((c) => [c.id, isFavored(run, c.id) ? FAVORED_WEIGHT : 1]));
  return run.rng.weighted(weights);
}

// ── 정비소 · 덱 손질 ─────────────────────────────

export function heal(run: RunState, amount: number): number {
  const healed = Math.max(0, Math.min(run.maxHp - run.hp, amount));
  run.hp += healed;
  return healed;
}

export const restHealAmount = (run: RunState): number =>
  Math.ceil(run.maxHp * (REST_HEAL_RATIO + moduleSum(run, 'restBonus')));

export function rest(run: RunState): number {
  return heal(run, restHealAmount(run));
}

export function canRemoveCard(run: RunState): boolean {
  return run.deck.length > MIN_DECK_SIZE;
}

/** 분해 — 덱에서 카드 한 장을 영구히 뺀다 */
export function removeCard(run: RunState, uid: number): boolean {
  const i = run.deck.findIndex((c) => c.uid === uid);
  if (i < 0 || !canRemoveCard(run)) return false;
  run.deck.splice(i, 1);
  return true;
}

export const upgradableCards = (run: RunState): CardInstance[] => run.deck.filter((c) => canUpgradeCard(c.defId));

/** 정비 — 카드 한 장을 강화한다 */
export function upgradeCard(run: RunState, uid: number): boolean {
  const card = run.deck.find((c) => c.uid === uid);
  if (!card || !canUpgradeCard(card.defId)) return false;
  card.defId = `${card.defId}+`;
  return true;
}

// ── 상점 ──────────────────────────────────────────

export interface ShopItem {
  id: string;
  price: number;
  sold: boolean;
}

export interface ShopStock {
  cards: ShopItem[];
  modules: ShopItem[];
  /** 이 상점에서 분해 서비스를 썼는지 — 상점마다 한 번 */
  removeUsed: boolean;
}

const discounted = (run: RunState, price: number) => Math.round(price * (1 - moduleSum(run, 'shopDiscount')));
const priceIn = (run: RunState, [lo, hi]: [number, number]) => discounted(run, run.rng.int(lo, hi));

export function createShop(run: RunState): ShopStock {
  const normal = rollCardRewards(run, 'normal', 3);
  const fancy = rollCardRewards(run, 'elite', 2, normal);
  const cards = [...normal, ...fancy].map((id) => {
    const rarity = CARDS[id].rarity as Exclude<Rarity, 'starter'>;
    return { id, price: priceIn(run, CARD_PRICE[rarity]), sold: false };
  });
  const modules: ShopItem[] = [];
  for (let i = 0; i < 2; i++) {
    const id = rollModule(run, undefined, modules.map((m) => m.id));
    if (id) modules.push({ id, price: priceIn(run, MODULE_PRICE[MODULES[id].rarity]), sold: false });
  }
  return { cards, modules, removeUsed: false };
}

export const removePrice = (run: RunState): number => discounted(run, REMOVE_PRICE + REMOVE_PRICE_STEP * run.removeCount);

export function buyShopItem(run: RunState, item: ShopItem, kind: 'card' | 'module'): boolean {
  if (item.sold || run.gold < item.price) return false;
  run.gold -= item.price;
  item.sold = true;
  if (kind === 'card') addCard(run, item.id);
  else gainModule(run, item.id);
  return true;
}

export function shopRemove(run: RunState, shop: ShopStock, uid: number): boolean {
  const price = removePrice(run);
  if (shop.removeUsed || run.gold < price || !removeCard(run, uid)) return false;
  run.gold -= price;
  run.removeCount += 1;
  shop.removeUsed = true;
  return true;
}

// ── 이벤트 ────────────────────────────────────────

export function rollEvent(run: RunState): string {
  let options = EVENT_IDS.filter((id) => !run.seenEvents.includes(id));
  if (options.length === 0) {
    run.seenEvents = [];
    options = EVENT_IDS;
  }
  const id = run.rng.pick(options);
  run.seenEvents.push(id);
  return id;
}

export interface EventResult {
  text: string;
  /** 일어난 일 한 줄씩 */
  lines: string[];
  /** 이어서 덱에서 카드를 골라야 하면 */
  pick?: 'upgrade' | 'remove';
}

export const canChoose = (run: RunState, eventId: string, index: number): boolean =>
  run.gold >= (EVENTS[eventId].choices[index]?.goldCost ?? 0);

export function chooseEvent(run: RunState, eventId: string, index: number): EventResult | null {
  const choice = EVENTS[eventId]?.choices[index];
  if (!choice || !canChoose(run, eventId, index)) return null;
  const result: EventResult = { text: choice.result, lines: [] };
  if (choice.goldCost) {
    run.gold -= choice.goldCost;
    result.lines.push(`주화 -${choice.goldCost}`);
  }
  applyOutcomes(run, choice.outcomes, result);
  return result;
}

function applyOutcomes(run: RunState, outcomes: EventOutcome[], result: EventResult): void {
  for (const o of outcomes) {
    switch (o.kind) {
      case 'gold':
        run.gold = Math.max(0, run.gold + o.amount);
        result.lines.push(`주화 ${o.amount >= 0 ? '+' : ''}${o.amount}`);
        break;
      case 'hp':
        if (o.amount >= 0) result.lines.push(`체력 +${heal(run, o.amount)}`);
        else {
          const lost = Math.min(-o.amount, run.hp - 1);
          run.hp -= lost;
          result.lines.push(`체력 -${lost}`);
        }
        break;
      case 'maxHp':
        run.maxHp = Math.max(1, run.maxHp + o.amount);
        run.hp = Math.max(1, Math.min(run.maxHp, run.hp + Math.max(0, o.amount)));
        result.lines.push(`최대 체력 ${o.amount >= 0 ? '+' : ''}${o.amount}`);
        break;
      case 'healFull':
        result.lines.push(`체력 +${heal(run, run.maxHp)}`);
        break;
      case 'card': {
        const id = rollCardOfRarity(run, o.rarity, []);
        addCard(run, id);
        result.lines.push(`카드 획득: ${CARDS[id].name}`);
        break;
      }
      case 'curse':
        for (let i = 0; i < o.count; i++) addCard(run, o.cardId);
        result.lines.push(`덱에 추가: ${CARDS[o.cardId].name}${o.count > 1 ? ` ×${o.count}` : ''}`);
        break;
      case 'upgradeRandom': {
        const picks = run.rng.shuffle(upgradableCards(run)).slice(0, o.count);
        for (const c of picks) {
          upgradeCard(run, c.uid);
          result.lines.push(`강화: ${CARDS[c.defId].name}`);
        }
        if (picks.length === 0) result.lines.push('강화할 카드가 없다');
        break;
      }
      case 'module': {
        const id = rollModule(run);
        if (id) {
          gainModule(run, id);
          result.lines.push(`모듈 획득: ${MODULES[id].name}`);
        } else {
          run.gold += 50;
          result.lines.push('주화 +50');
        }
        break;
      }
      case 'pick':
        if (o.mode === 'upgrade' ? upgradableCards(run).length > 0 : canRemoveCard(run)) result.pick = o.mode;
        else result.lines.push(o.mode === 'upgrade' ? '강화할 카드가 없다' : '덱이 너무 얇아 뺄 카드가 없다');
        break;
      case 'gamble': {
        const won = run.rng.next() < o.chance;
        result.text = won ? o.winText : o.loseText;
        applyOutcomes(run, won ? o.win : o.lose, result);
        break;
      }
    }
  }
}

// ── 보물 ──────────────────────────────────────────

/** 보물 방 — 모듈 하나. 다 모았으면 주화 */
export function openTreasure(run: RunState): { module: string | null; gold: number } {
  const module = rollModule(run);
  if (module) {
    gainModule(run, module);
    return { module, gold: 0 };
  }
  run.gold += 75;
  return { module: null, gold: 75 };
}
