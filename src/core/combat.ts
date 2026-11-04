import { CARDS } from '../data/cards';
import { ENEMIES } from '../data/enemies';
import type { Rng } from './rng';
import type {
  CardDef,
  CardInstance,
  Combatant,
  CombatState,
  DotId,
  Effect,
  EnemyMove,
  EnemyState,
  PlayerState,
  SkillDef,
  StatusId,
  Statuses,
  UnitRef,
} from './types';

export const HAND_SIZE = 5;
export const MAX_HAND = 10;
export const BASE_STEAM = 3;
export const MAX_HEAT = 10;
/** 부족한 증기압 1당 쌓이는 과열 */
export const HEAT_PER_MISSING_STEAM = 3;
export const COOLING_PER_TURN = 2;
/** 태엽 장력 — 한 턴에 카드 효과로 뽑을 수 있는 최대 장수. 0코스트 드로우 카드의 무한 반복을 막는다 */
export const MAX_EXTRA_DRAW = 20;
export const BREAKDOWN_DAMAGE = 6;
export const BREAKDOWN_CARD = 'rusted_part';

/** 소유자의 턴이 끝날 때마다 1씩 줄어드는 상태 */
const DECAYING: StatusId[] = ['vulnerable', 'weak'];
/** 적에게 걸면 불씨가 더해지는 지속 피해 */
const DOTS: DotId[] = ['burn', 'acid', 'shock'];
const DOT_NAME: Record<DotId, string> = { burn: '화상', acid: '산성', shock: '감전' };

export interface CombatSetup {
  hp: number;
  maxHp: number;
  deck: CardInstance[];
  enemyIds: string[];
  rng: Rng;
  /** 캐릭터 고유 능력 */
  statuses?: Statuses;
  maxHeat?: number;
  /** 캐릭터 필살기와 이번 전투에서 쓸 수 있는지 */
  skill?: SkillDef;
  skillReady?: boolean;
}

export function createCombat(setup: CombatSetup): CombatState {
  const { rng } = setup;
  const enemies: EnemyState[] = setup.enemyIds.map((defId, i) => {
    const def = ENEMIES[defId];
    const hp = rng.int(def.hp[0], def.hp[1]);
    return { uid: i, defId, name: def.name, hp, maxHp: hp, block: 0, statuses: {}, moveIndex: -1, nextMoveId: '' };
  });
  const state: CombatState = {
    player: {
      hp: setup.hp, maxHp: setup.maxHp, block: 0, statuses: { ...setup.statuses },
      steam: 0, maxSteam: BASE_STEAM, heat: 0, maxHeat: setup.maxHeat ?? MAX_HEAT,
    },
    enemies,
    drawPile: rng.shuffle(setup.deck.map((c) => ({ ...c }))),
    hand: [],
    discardPile: [],
    exhaustPile: [],
    turn: 0,
    rotation: 0,
    chain: 0,
    cardsPlayed: 0,
    extraDrawn: 0,
    lastFamily: null,
    rng,
    log: [],
    events: [],
    outcome: 'ongoing',
    nextCardUid: Math.max(0, ...setup.deck.map((c) => c.uid)) + 1,
    skill: setup.skill ?? null,
    skillReady: !!setup.skill && (setup.skillReady ?? true),
    skillUsed: false,
  };
  for (const enemy of enemies) chooseNextMove(state, enemy);
  startPlayerTurn(state);
  return state;
}

export const cardDef = (card: CardInstance): CardDef => CARDS[card.defId];

export const aliveEnemies = (state: CombatState): EnemyState[] => state.enemies.filter((e) => e.hp > 0);

const targeted = (e: Effect) =>
  e.kind === 'damage' ||
  e.kind === 'detonate' ||
  ((e.kind === 'applyStatus' || e.kind === 'multiplyStatus') && e.target === 'enemy');

export function needsTarget(def: CardDef | SkillDef): boolean {
  return def.effects.some(targeted) || ('mesh' in def && (def.mesh?.effects.some(targeted) ?? false));
}

/** 필살기 사용 — 증기압·회전·연동에 영향을 주지 않는 별도 행동. 한 전투에 한 번 */
export function useSkill(state: CombatState, targetUid?: number): boolean {
  const skill = state.skill;
  if (state.outcome !== 'ongoing' || !skill || !state.skillReady) return false;
  const alive = aliveEnemies(state);
  const target = alive.find((e) => e.uid === targetUid) ?? (alive.length === 1 ? alive[0] : undefined);
  if (needsTarget(skill) && !target) return false;
  state.skillReady = false;
  state.skillUsed = true;
  state.log.push(`★ 필살기 — ${skill.name}!`);
  state.events.push({ kind: 'skill', skillId: skill.id });
  resolveEffects(state, skill.effects, target, `skill:${skill.id}`);
  checkOutcome(state);
  return true;
}

export function isMeshActive(state: CombatState, def: CardDef): boolean {
  return def.mesh !== undefined && state.lastFamily === def.mesh.after;
}

/** 증기압이 부족하면 그만큼 과열을 쌓아 강행 사용(오버클록)한다. */
export function getPlayCost(state: CombatState, def: CardDef): { steam: number; heat: number } | null {
  if (def.cost === null) return null;
  const steam = Math.min(def.cost, state.player.steam);
  return { steam, heat: (def.cost - steam) * HEAT_PER_MISSING_STEAM };
}

export function startPlayerTurn(state: CombatState): void {
  const p = state.player;
  state.turn += 1;
  if (!p.statuses.retain) p.block = 0;
  if (tickDots(state, 'player', p) && checkOutcome(state)) return;
  p.maxSteam = BASE_STEAM + (p.statuses.amplifier ?? 0);
  p.steam = p.maxSteam;
  p.heat = Math.max(0, p.heat - COOLING_PER_TURN);
  state.rotation = p.statuses.flywheel ?? 0;
  state.chain = 0;
  state.cardsPlayed = 0;
  state.extraDrawn = 0;
  state.lastFamily = null;
  if (p.statuses.compressor) gainStatus(state, 'player', p, 'pressure', p.statuses.compressor);
  const perTurn: [StatusId, StatusId][] = [['furnace', 'burn'], ['acidPump', 'acid'], ['generator', 'shock']];
  for (const [source, dot] of perTurn) {
    const amount = p.statuses[source];
    if (amount) for (const enemy of aliveEnemies(state)) gainStatus(state, enemy.uid, enemy, dot, amount);
  }
  drawCards(state, HAND_SIZE + (p.statuses.spring ?? 0), false);
}

export function playCard(state: CombatState, cardUid: number, targetUid?: number): boolean {
  if (state.outcome !== 'ongoing') return false;
  const index = state.hand.findIndex((c) => c.uid === cardUid);
  if (index < 0) return false;
  const card = state.hand[index];
  const def = cardDef(card);
  const cost = getPlayCost(state, def);
  if (!cost) return false;

  const alive = aliveEnemies(state);
  const target = alive.find((e) => e.uid === targetUid) ?? (alive.length === 1 ? alive[0] : undefined);
  if (needsTarget(def) && !target) return false;

  state.hand.splice(index, 1);
  state.player.steam -= cost.steam;
  state.log.push(cost.heat > 0 ? `${def.name} — 오버클록! (과열 +${cost.heat})` : `${def.name} 사용`);
  const meshActive = isMeshActive(state, def);
  state.events.push({
    kind: 'card', cardId: def.id, attack: def.type === 'attack', power: def.type === 'power',
    overclock: cost.heat > 0, mesh: meshActive, combo: state.cardsPlayed + 1,
  });

  if (def.family) state.chain = state.lastFamily === def.family ? state.chain + 1 : 1;

  resolveEffects(state, def.effects, target, def.id);
  if (meshActive && def.mesh) {
    state.log.push('⚙ 맞물림 발동!');
    resolveEffects(state, def.mesh.effects, target, def.id);
  }

  state.rotation += 1;
  state.cardsPlayed += 1;
  if (def.family) state.lastFamily = def.family;
  (def.type === 'power' || def.exhaust ? state.exhaustPile : state.discardPile).push(card);

  const loader = state.player.statuses.autoloader;
  if (loader && state.cardsPlayed % 3 === 0) {
    state.log.push(`자동 장전 — 카드 ${loader}장 드로우`);
    drawCards(state, loader);
  }

  if (cost.heat > 0) addHeat(state, cost.heat);
  checkOutcome(state);
  return true;
}

export function endTurn(state: CombatState): void {
  if (state.outcome !== 'ongoing') return;
  state.discardPile.push(...state.hand);
  state.hand = [];
  tickStatuses(state.player);

  for (const enemy of aliveEnemies(state)) {
    enemy.block = 0;
    if (tickDots(state, enemy.uid, enemy)) {
      if (checkOutcome(state)) return;
      continue;
    }
    if (enemy.statuses.stun) {
      if (enemy.statuses.stun <= 1) delete enemy.statuses.stun;
      else enemy.statuses.stun -= 1;
      state.log.push(`${enemy.name} — 기절해서 움직이지 못한다`);
      state.events.push({ kind: 'stunned', enemy: enemy.uid });
      continue;
    }
    executeMove(state, enemy);
    if (checkOutcome(state)) return;
  }
  for (const enemy of aliveEnemies(state)) {
    tickStatuses(enemy);
    chooseNextMove(state, enemy);
  }
  startPlayerTurn(state);
}

export function getNextMove(enemy: EnemyState): EnemyMove {
  return ENEMIES[enemy.defId].moves.find((m) => m.id === enemy.nextMoveId)!;
}

export type Intent =
  | { kind: 'attack'; damage: number; times: number }
  | { kind: 'block'; amount: number }
  | { kind: 'buff' }
  | { kind: 'debuff' }
  | { kind: 'stun' };

export function getIntents(state: CombatState, enemy: EnemyState): Intent[] {
  if (enemy.statuses.stun) return [{ kind: 'stun' }];
  return getNextMove(enemy).effects.map((e): Intent => {
    switch (e.kind) {
      case 'attack':
        return { kind: 'attack', damage: calcDamage(enemy, state.player, e.amount), times: e.times ?? 1 };
      case 'block':
        return { kind: 'block', amount: e.amount };
      case 'applyStatus':
        return e.target === 'self' ? { kind: 'buff' } : { kind: 'debuff' };
      case 'addCard':
        return { kind: 'debuff' };
    }
  });
}

/** 출력·녹·부식을 반영한 최종 피해 (방어도 적용 전) */
export function calcDamage(attacker: Combatant, target: Combatant, base: number): number {
  let damage = base + (attacker.statuses.strength ?? 0);
  if (attacker.statuses.redline && 'heat' in attacker && (attacker as PlayerState).heat * 2 >= (attacker as PlayerState).maxHeat)
    damage += attacker.statuses.redline;
  if (attacker.statuses.weak) damage = Math.floor(damage * 0.75);
  if (target.statuses.vulnerable) damage = Math.floor(damage * 1.5);
  return Math.max(0, damage);
}

function attack(attacker: Combatant, target: Combatant, base: number): { dealt: number; blocked: number } {
  const damage = calcDamage(attacker, target, base);
  const blocked = Math.min(target.block, damage);
  target.block -= blocked;
  const dealt = damage - blocked;
  target.hp = Math.max(0, target.hp - dealt);
  return { dealt, blocked };
}

/** 기관사가 적을 공격하고 로그·이벤트를 남긴다 */
function playerHits(state: CombatState, target: EnemyState, amount: number, cardId: string): number {
  const { dealt, blocked } = attack(state.player, target, amount);
  state.log.push(`${target.name}에게 피해 ${dealt}`);
  state.events.push({ kind: 'hit', source: 'player', target: target.uid, damage: dealt, blocked, hp: target.hp, cardId });
  const shock = target.statuses.shock;
  if (shock && target.hp > 0) {
    target.hp = Math.max(0, target.hp - shock);
    if (shock <= 1) delete target.statuses.shock;
    else target.statuses.shock = shock - 1;
    state.log.push(`${target.name} — 감전 피해 ${shock}`);
    state.events.push({ kind: 'dot', status: 'shock', target: target.uid, damage: shock, hp: target.hp });
    return dealt + shock;
  }
  return dealt;
}

/** 출력·녹·부식을 무시하는 직접 피해 (가시, 폭주 기관) */
function directHit(state: CombatState, target: EnemyState, amount: number, cardId: string): void {
  target.hp = Math.max(0, target.hp - amount);
  state.events.push({ kind: 'hit', source: 'player', target: target.uid, damage: amount, blocked: 0, hp: target.hp, cardId });
}

function heal(state: CombatState, amount: number): void {
  const p = state.player;
  const healed = Math.min(amount, p.maxHp - p.hp);
  if (healed <= 0) return;
  p.hp += healed;
  state.log.push(`체력 ${healed} 회복`);
  state.events.push({ kind: 'heal', target: 'player', amount: healed, hp: p.hp });
}

function addCards(state: CombatState, cardId: string, count: number): void {
  for (let i = 0; i < count; i++) state.discardPile.push({ uid: state.nextCardUid++, defId: cardId });
  state.events.push({ kind: 'cardAdded', cardId, count });
}

function resolveEffects(state: CombatState, effects: Effect[], target: EnemyState | undefined, cardId: string): void {
  for (const effect of effects) resolveEffect(state, effect, target, cardId);
}

function resolveEffect(state: CombatState, effect: Effect, target: EnemyState | undefined, cardId: string): void {
  const p = state.player;
  switch (effect.kind) {
    case 'damage': {
      if (!target) return;
      const amount =
        effect.amount +
        (effect.perRotation ?? 0) * state.rotation +
        (effect.perChain ?? 0) * Math.max(0, state.chain - 1) +
        (effect.perPressure ?? 0) * (p.statuses.pressure ?? 0) +
        (effect.perBlock ?? 0) * p.block +
        (effect.perHeat ?? 0) * p.heat +
        (effect.perTargetStatus ? effect.perTargetStatus.amount * (target.statuses[effect.perTargetStatus.status] ?? 0) : 0);
      const times = (effect.times ?? 1) + Math.floor((effect.hitsPerRotation ?? 0) * state.rotation);
      let dealt = 0;
      for (let i = 0; i < times && target.hp > 0; i++) dealt += playerHits(state, target, amount, cardId);
      if (effect.lifesteal && dealt > 0) heal(state, dealt);
      return;
    }
    case 'damageAll': {
      const amount = effect.amount + (effect.perRotation ?? 0) * state.rotation + (effect.perHeat ?? 0) * p.heat;
      for (const enemy of aliveEnemies(state)) playerHits(state, enemy, amount, cardId);
      return;
    }
    case 'block':
      p.block += effect.amount;
      state.events.push({ kind: 'block', target: 'player', amount: effect.amount });
      return;
    case 'draw':
      drawCards(state, effect.amount);
      return;
    case 'steam':
      p.steam += effect.amount;
      return;
    case 'wind':
      state.rotation += effect.amount;
      return;
    case 'heat':
      addHeat(state, effect.amount);
      return;
    case 'applyStatus':
      if (effect.target === 'self') gainStatus(state, 'player', p, effect.status, effect.amount);
      else if (effect.target === 'allEnemies')
        for (const enemy of aliveEnemies(state)) gainStatus(state, enemy.uid, enemy, effect.status, effect.amount);
      else if (target) gainStatus(state, target.uid, target, effect.status, effect.amount);
      return;
    case 'multiplyStatus': {
      const who = effect.target === 'self' ? p : target;
      const current = who?.statuses[effect.status];
      if (!who || !current) return;
      gainStatus(state, effect.target === 'self' ? 'player' : target!.uid, who, effect.status, current * (effect.factor - 1));
      return;
    }
    case 'clearStatus': {
      // 잔압 밸브가 있으면 압력이 절반 남는다
      const left = effect.status === 'pressure' && p.statuses.residual ? Math.floor((p.statuses.pressure ?? 0) / 2) : 0;
      if (left > 0) p.statuses.pressure = left;
      else delete p.statuses[effect.status];
      return;
    }
    case 'vent': {
      const vented = p.heat;
      p.heat = 0;
      if (vented > 0) {
        p.block += vented * effect.blockPerHeat;
        state.events.push({ kind: 'block', target: 'player', amount: vented * effect.blockPerHeat });
      }
      return;
    }
    case 'addCard':
      addCards(state, effect.cardId, effect.count);
      return;
    case 'detonate': {
      if (!target) return;
      const total = effect.statuses.reduce((sum, s) => sum + (target.statuses[s] ?? 0), 0) * (effect.factor ?? 1);
      if (total <= 0) return;
      target.hp = Math.max(0, target.hp - total);
      state.log.push(`${target.name} — 지속 피해 폭발! 피해 ${total}`);
      state.events.push({ kind: 'hit', source: 'player', target: target.uid, damage: total, blocked: 0, hp: target.hp, cardId });
      return;
    }
  }
}

function gainStatus(state: CombatState, ref: UnitRef, who: Combatant, status: StatusId, amount: number): void {
  if (ref !== 'player' && (DOTS as StatusId[]).includes(status)) amount += state.player.statuses.kindling ?? 0;
  addStatus(who, status, amount);
  state.events.push({ kind: 'status', target: ref, status, amount });
}

/** 턴 시작 지속 피해 — 화상(1씩 감소), 산성(줄지 않음). 쓰러뜨렸으면 true */
function tickDots(state: CombatState, ref: UnitRef, unit: Combatant): boolean {
  for (const status of ['burn', 'acid'] as const) {
    const amount = unit.statuses[status];
    if (!amount) continue;
    unit.hp = Math.max(0, unit.hp - amount);
    if (status === 'burn') {
      if (amount <= 1) delete unit.statuses.burn;
      else unit.statuses.burn = amount - 1;
    }
    state.log.push(`${ref === 'player' ? '기관사' : (unit as EnemyState).name} — ${DOT_NAME[status]} 피해 ${amount}`);
    state.events.push({ kind: 'dot', status, target: ref, damage: amount, hp: unit.hp });
    if (unit.hp <= 0) return true;
  }
  return false;
}

/** byEffect면 태엽 장력(MAX_EXTRA_DRAW)을 넘겨 뽑지 못한다 */
function drawCards(state: CombatState, count: number, byEffect = true): void {
  if (byEffect) {
    const allowed = Math.min(count, MAX_EXTRA_DRAW - state.extraDrawn);
    if (allowed < count) state.log.push('태엽 장력이 다 풀렸다 — 이번 턴엔 더 뽑을 수 없다');
    count = Math.max(0, allowed);
  }
  for (let i = 0; i < count; i++) {
    if (state.hand.length >= MAX_HAND) return;
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) return;
      state.drawPile = state.rng.shuffle(state.discardPile);
      state.discardPile = [];
    }
    state.hand.push(state.drawPile.pop()!);
    if (byEffect) state.extraDrawn += 1;
  }
}

/** 과열이 한계에 닿으면 고장: 체력 손실 + 녹슨 부품이 버린 더미에 들어가고 과열 초기화 */
function addHeat(state: CombatState, amount: number): void {
  const p = state.player;
  p.heat = Math.max(0, p.heat + amount);
  if (amount > 0 && p.statuses.heatsink) {
    p.block += p.statuses.heatsink;
    state.events.push({ kind: 'block', target: 'player', amount: p.statuses.heatsink });
  }
  if (p.heat < p.maxHeat) return;
  p.heat = 0;
  state.discardPile.push({ uid: state.nextCardUid++, defId: BREAKDOWN_CARD });
  const meltdown = p.statuses.meltdown;
  if (meltdown) {
    state.log.push(`💥 폭주! 모든 적에게 피해 ${meltdown}`);
    state.events.push({ kind: 'breakdown', damage: 0, hp: p.hp });
    for (const enemy of aliveEnemies(state)) directHit(state, enemy, meltdown, 'meltdown');
    return;
  }
  p.hp = Math.max(0, p.hp - BREAKDOWN_DAMAGE);
  state.log.push(`💥 고장! 체력 -${BREAKDOWN_DAMAGE}, 녹슨 부품 추가`);
  state.events.push({ kind: 'breakdown', damage: BREAKDOWN_DAMAGE, hp: p.hp });
}

function executeMove(state: CombatState, enemy: EnemyState): void {
  const move = getNextMove(enemy);
  state.log.push(`${enemy.name}: ${move.name}`);
  state.events.push({ kind: 'enemyMove', enemy: enemy.uid });
  for (const effect of move.effects) {
    switch (effect.kind) {
      case 'attack':
        for (let i = 0; i < (effect.times ?? 1) && state.player.hp > 0 && enemy.hp > 0; i++) {
          const { dealt, blocked } = attack(enemy, state.player, effect.amount);
          state.log.push(`피해 ${dealt}을 받음`);
          state.events.push({ kind: 'hit', source: enemy.uid, target: 'player', damage: dealt, blocked, hp: state.player.hp });
          const thorns = state.player.statuses.thorns;
          if (thorns) directHit(state, enemy, thorns, 'thorns');
        }
        break;
      case 'addCard':
        addCards(state, effect.cardId, effect.count);
        break;
      case 'block':
        enemy.block += effect.amount;
        state.events.push({ kind: 'block', target: enemy.uid, amount: effect.amount });
        break;
      case 'applyStatus':
        if (effect.target === 'self') gainStatus(state, enemy.uid, enemy, effect.status, effect.amount);
        else gainStatus(state, 'player', state.player, effect.status, effect.amount);
        break;
    }
    if (enemy.hp <= 0) break;
  }
}

function chooseNextMove(state: CombatState, enemy: EnemyState): void {
  const def = ENEMIES[enemy.defId];
  if (def.pattern === 'cycle') {
    enemy.moveIndex = (enemy.moveIndex + 1) % def.moves.length;
  } else {
    const candidates = def.moves.map((_, i) => i).filter((i) => def.moves.length === 1 || i !== enemy.moveIndex);
    enemy.moveIndex = state.rng.pick(candidates);
  }
  enemy.nextMoveId = def.moves[enemy.moveIndex].id;
}

function addStatus(target: Combatant, status: StatusId, amount: number): void {
  target.statuses[status] = (target.statuses[status] ?? 0) + amount;
}

function tickStatuses(target: Combatant): void {
  for (const status of DECAYING) {
    const value = target.statuses[status];
    if (!value) continue;
    if (value <= 1) delete target.statuses[status];
    else target.statuses[status] = value - 1;
  }
}

function checkOutcome(state: CombatState): boolean {
  if (state.god) state.player.hp = Math.max(1, state.player.hp);
  if (state.player.hp <= 0) state.outcome = 'lost';
  else if (aliveEnemies(state).length === 0) state.outcome = 'won';
  return state.outcome !== 'ongoing';
}
