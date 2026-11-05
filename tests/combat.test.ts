import { describe, expect, it } from 'vitest';
import {
  BASE_STEAM,
  BREAKDOWN_CARD,
  BREAKDOWN_DAMAGE,
  createCombat,
  endTurn,
  HAND_SIZE,
  HEAT_PER_MISSING_STEAM,
  MAX_EXTRA_DRAW,
  playCard,
  useSkill,
} from '../src/core/combat';
import { Rng } from '../src/core/rng';
import {
  buyShopItem, chooseEvent, claimCombatSpoils, createRun, createShop, gainModule, MIN_DECK_SIZE, moveTo, reachableNodes, removeCard,
  removePrice, rest, restHealAmount, rollCardRewards, settleSkill, shopRemove, SKILL_RECHARGE, skillRecharge, startCustomCombat,
  startRoomCombat, upgradeCard, advanceAct, type RunState,
} from '../src/core/run';
import { generateMap, MAP_COLS, MAP_ROWS } from '../src/core/map';
import { loadGame, saveGame } from '../src/core/save';
import { EVENTS } from '../src/data/events';
import { MODULES } from '../src/data/modules';
import { ARCHETYPES } from '../src/data/archetypes';
import { CARDS } from '../src/data/cards';
import { CHARACTER_IDS, CHARACTERS } from '../src/data/characters';
import { ACTS } from '../src/data/acts';
import type { CombatState } from '../src/core/types';

/** 손패를 원하는 카드로 고정한 전투를 만든다. */
function setup(hand: string[], enemyIds = ['automaton']): CombatState {
  const deck = Array.from({ length: 10 }, (_, i) => ({ uid: i + 1, defId: 'brass_guard' }));
  const state = createCombat({ hp: 70, maxHp: 70, deck, enemyIds, rng: new Rng(1) });
  state.hand = hand.map((defId, i) => ({ uid: 100 + i, defId }));
  return state;
}

describe('전투 기본', () => {
  it('첫 턴에 증기압이 차고 카드를 드로우한다', () => {
    const state = setup([]);
    expect(state.player.steam).toBe(BASE_STEAM);
    expect(state.drawPile.length).toBe(10 - HAND_SIZE);
  });

  it('공격 카드는 방어도를 먼저 깎고 체력을 깎는다', () => {
    const state = setup(['cog_strike']);
    const enemy = state.enemies[0];
    enemy.block = 4;
    const hp = enemy.hp;
    playCard(state, 100);
    expect(enemy.block).toBe(0);
    expect(enemy.hp).toBe(hp - 2);
    expect(state.player.steam).toBe(BASE_STEAM - 1);
  });

  it('적이 여럿이면 대상 없이 공격할 수 없다', () => {
    const state = setup(['cog_strike'], ['spider', 'spider']);
    expect(playCard(state, 100)).toBe(false);
    expect(playCard(state, 100, 1)).toBe(true);
  });

  it('드로우 더미가 비면 버린 더미를 섞어 다시 쓴다', () => {
    const state = setup([]);
    state.discardPile = state.drawPile;
    state.drawPile = [];
    endTurn(state);
    expect(state.hand.length).toBe(HAND_SIZE);
  });

  it('적 체력이 0이 되면 승리한다', () => {
    const state = setup(['cog_strike']);
    state.enemies[0].hp = 3;
    playCard(state, 100);
    expect(state.outcome).toBe('won');
  });
});

describe('태엽 맞물림', () => {
  it('회전: 카드를 쓸수록 회전 비례 카드가 강해진다', () => {
    const state = setup(['wind_up', 'cog_strike', 'linked_cogs']);
    const enemy = state.enemies[0];
    playCard(state, 100); // 회전 +2, 사용으로 +1 → 3
    playCard(state, 101); // → 4
    const hp = enemy.hp;
    playCard(state, 102); // 4 + 2×4 = 12
    expect(hp - enemy.hp).toBe(12);
  });

  it('맞물림: 지정 계열 직후에 쓰면 추가 효과가 발동한다', () => {
    const state = setup(['cog_strike', 'steam_jet']);
    playCard(state, 100);
    playCard(state, 101);
    expect(state.player.block).toBe(4);
  });

  it('맞물림: 다른 계열 직후에는 발동하지 않는다', () => {
    const state = setup(['steam_jet']);
    playCard(state, 100);
    expect(state.player.block).toBe(0);
  });

  it('연동: 같은 계열을 연속으로 쓰면 연동 보너스가 붙는다', () => {
    const state = setup(['cog_strike', 'brass_guard', 'chain_drive']);
    const enemy = state.enemies[0];
    playCard(state, 100);
    playCard(state, 101);
    const hp = enemy.hp;
    playCard(state, 102); // 연동 3 → (3 + 2×2) × 2
    expect(hp - enemy.hp).toBe(14);
  });
});

describe('오버클록', () => {
  it('증기압이 모자라면 과열을 쌓고 사용한다', () => {
    const state = setup(['piston', 'piston']);
    playCard(state, 100);
    playCard(state, 101); // 증기압 1 남음, 1 부족
    expect(state.player.steam).toBe(0);
    expect(state.player.heat).toBe(HEAT_PER_MISSING_STEAM);
  });

  it('과열이 한계에 닿으면 고장 난다', () => {
    const state = setup(['overload_strike', 'overload_strike', 'overload_strike']);
    state.enemies[0].hp = 999;
    playCard(state, 100);
    playCard(state, 101); // 과열 8
    playCard(state, 102); // 12 → 고장
    expect(state.player.heat).toBe(0);
    expect(state.player.hp).toBe(70 - BREAKDOWN_DAMAGE);
    expect(state.discardPile.some((c) => c.defId === BREAKDOWN_CARD)).toBe(true);
  });

  it('녹슨 부품은 사용할 수 없다', () => {
    const state = setup([BREAKDOWN_CARD]);
    expect(playCard(state, 100)).toBe(false);
  });

  it('턴이 시작되면 과열이 식는다', () => {
    const state = setup([]);
    state.player.heat = 5;
    endTurn(state);
    expect(state.player.heat).toBe(3);
  });
});

describe('상태', () => {
  it('부식된 대상은 50% 더 많은 피해를 받는다', () => {
    const state = setup(['cog_strike']);
    const enemy = state.enemies[0];
    enemy.statuses.vulnerable = 1;
    const hp = enemy.hp;
    playCard(state, 100);
    expect(hp - enemy.hp).toBe(9);
  });

  it('플라이휠은 매 턴 회전을 미리 감아 둔다', () => {
    const state = setup(['flywheel']);
    playCard(state, 100);
    endTurn(state);
    expect(state.rotation).toBe(1);
  });
});

describe('화상 덱', () => {
  it('화상은 적 턴 시작에 방어도를 무시하고 피해를 준 뒤 1 줄어든다', () => {
    const state = setup(['scald']);
    const enemy = state.enemies[0];
    playCard(state, 100);
    const hp = enemy.hp;
    enemy.block = 50;
    endTurn(state);
    expect(enemy.hp).toBe(hp - 4);
    expect(enemy.statuses.burn).toBe(3);
  });

  it('화상으로 쓰러진 적은 행동하지 않는다', () => {
    const state = setup([]);
    state.enemies[0].hp = 2;
    state.enemies[0].statuses.burn = 5;
    endTurn(state);
    expect(state.outcome).toBe('won');
    expect(state.player.hp).toBe(70);
  });

  it('연소 촉진은 화상 2배만큼 즉시 피해, 재점화는 화상 2배', () => {
    const state = setup(['rekindle', 'combustion']);
    const enemy = state.enemies[0];
    enemy.statuses.burn = 5;
    enemy.block = 99;
    playCard(state, 100);
    expect(enemy.statuses.burn).toBe(10);
    const hp = enemy.hp;
    playCard(state, 101);
    expect(enemy.hp).toBe(hp - 20);
  });

  it('화염 보일러는 매 턴 모든 적에게 화상을 건다', () => {
    const state = setup(['furnace'], ['spider', 'spider']);
    playCard(state, 100);
    endTurn(state);
    expect(state.enemies.every((e) => e.statuses.burn === 6)).toBe(true);
  });
});

describe('압력 덱', () => {
  it('증기 대포는 압력만큼 강해지고 압력을 모두 소모한다', () => {
    const state = setup(['charge_pressure', 'steam_cannon']);
    const enemy = state.enemies[0];
    enemy.hp = 999;
    playCard(state, 100);
    playCard(state, 101);
    expect(999 - enemy.hp).toBe(12 + 3 * 8);
    expect(state.player.statuses.pressure).toBeUndefined();
  });

  it('이중 압축은 압력을 두 배로 만든다', () => {
    const state = setup(['valve_lock', 'double_compress']);
    playCard(state, 100);
    playCard(state, 101);
    expect(state.player.statuses.pressure).toBe(12);
  });
});

describe('연사 덱', () => {
  it('톱니 난사는 회전마다 한 번 더 때린다', () => {
    const state = setup(['wind_up', 'cog_barrage']);
    playCard(state, 100); // 회전 3
    playCard(state, 101);
    expect(state.events.filter((e) => e.kind === 'hit').length).toBe(4);
  });

  it('자동 장전기는 카드 3장마다 1장 드로우한다', () => {
    const state = setup(['autoloader', 'rapid_cog', 'wind_up']);
    state.enemies[0].hp = 999;
    state.drawPile = Array.from({ length: 10 }, (_, i) => ({ uid: 200 + i, defId: 'brass_guard' }));
    playCard(state, 100);
    playCard(state, 101); // +1 드로우
    const before = state.hand.length;
    playCard(state, 102); // +1 드로우, 자동 장전 +1
    expect(state.hand.length).toBe(before - 1 + 1 + 1);
  });

  it('무한 태엽은 다음 턴부터 2장 더 드로우한다', () => {
    const state = setup(['endless_spring']);
    state.drawPile = Array.from({ length: 10 }, (_, i) => ({ uid: 200 + i, defId: 'brass_guard' }));
    playCard(state, 100);
    endTurn(state);
    expect(state.hand.length).toBe(HAND_SIZE + 2);
  });
});

describe('오버클록 · 방벽 · 술식', () => {
  it('과열 방출은 과열 1당 피해 +2', () => {
    const state = setup(['heat_release']);
    state.player.heat = 6;
    const hp = state.enemies[0].hp;
    playCard(state, 100);
    expect(hp - state.enemies[0].hp).toBe(6 + 12);
  });

  it('냉각 순환은 과열을 방어도로 바꾼다', () => {
    const state = setup(['coolant_cycle']);
    state.player.heat = 7;
    playCard(state, 100);
    expect(state.player.heat).toBe(0);
    expect(state.player.block).toBe(21);
  });

  it('폭주 기관이 있으면 고장 시 자신 대신 모든 적이 피해를 입는다', () => {
    const state = setup(['meltdown_engine', 'overload_strike', 'overload_strike', 'overload_strike'], ['golem', 'golem']);
    playCard(state, 100);
    for (const e of state.enemies) e.hp = 999;
    for (const uid of [101, 102, 103]) playCard(state, uid, 0);
    expect(state.player.hp).toBe(70);
    expect(state.enemies[1].hp).toBe(999 - 22);
  });

  it('방패 강타는 현재 방어도만큼 피해', () => {
    const state = setup(['shield_bash']);
    state.player.block = 13;
    const hp = state.enemies[0].hp;
    playCard(state, 100);
    expect(hp - state.enemies[0].hp).toBe(13);
  });

  it('가시는 공격한 적에게 되돌려준다', () => {
    const state = setup(['spike_armor']);
    playCard(state, 100);
    const hp = state.enemies[0].hp;
    endTurn(state); // 자동인형: 태엽 주먹 1회
    expect(state.enemies[0].hp).toBe(hp - 4);
  });

  it('증기 방벽이 있으면 방어도가 다음 턴까지 남는다', () => {
    const state = setup(['steam_barrier']);
    playCard(state, 100);
    state.player.block = 20;
    state.enemies[0].nextMoveId = 'punch'; // 공격 8
    endTurn(state);
    expect(state.player.block).toBe(12);
  });

  it('시간 정지로 기절한 적은 행동하지 않는다', () => {
    const state = setup(['time_stop']);
    playCard(state, 100);
    endTurn(state);
    expect(state.player.hp).toBe(70);
    expect(state.events.some((e) => e.kind === 'stunned')).toBe(true);
  });

  it('에테르 흡수는 입힌 피해만큼 회복', () => {
    const state = setup(['ether_drain']);
    state.player.hp = 50;
    playCard(state, 100);
    expect(state.player.hp).toBe(61);
  });

  it('적이 건 화상은 기관사 턴 시작에 피해를 준다', () => {
    const state = setup([]);
    state.player.statuses.burn = 4;
    state.enemies[0].statuses.stun = 1;
    endTurn(state);
    expect(state.player.hp).toBe(66);
    expect(state.player.statuses.burn).toBe(3);
  });
});

describe('캐릭터', () => {
  it('모든 캐릭터의 시작 덱은 10장이고 존재하는 카드로만 이루어진다', () => {
    for (const id of CHARACTER_IDS) {
      const run = createRun(1, id);
      expect(run.deck.length).toBe(10);
      expect(run.deck.every((c) => CARDS[c.defId])).toBe(true);
      expect(run.hp).toBe(CHARACTERS[id].maxHp);
    }
  });

  it('캐릭터 고유 능력이 전투 시작 상태에 걸린다', () => {
    const gunner = startCustomCombat(createRun(1, 'gunner'), ['automaton']);
    expect(gunner.player.statuses.compressor).toBe(3);
    expect(gunner.player.statuses.pressure).toBe(3); // 첫 턴 시작에 이미 +3
    expect(startCustomCombat(createRun(1, 'overclocker'), ['automaton']).player.maxHeat).toBe(15);
  });

  it('보일러공의 불씨는 화상을 1 더 건다', () => {
    const state = setup(['scald']);
    state.player.statuses.kindling = 1;
    playCard(state, 100);
    expect(state.enemies[0].statuses.burn).toBe(5);
  });

  it('보상에는 캐릭터에 어울리는 카드가 더 자주 나온다', () => {
    const share = (char: string) => {
      const run = createRun(11, char);
      let hits = 0, total = 0;
      for (let i = 0; i < 300; i++)
        for (const id of rollCardRewards(run, 'normal')) {
          total++;
          if (ARCHETYPES.burn.cards.includes(id)) hits++;
        }
      return hits / total;
    };
    expect(share('stoker')).toBeGreaterThan(share('guardian') * 2);
  });
});

describe('연출 이벤트', () => {
  it('공격 카드는 카드 사용과 타격 이벤트를 남긴다', () => {
    const state = setup(['chain_drive']);
    playCard(state, 100);
    expect(state.events.map((e) => e.kind)).toEqual(['card', 'hit', 'hit']);
    const hit = state.events[1];
    expect(hit.kind === 'hit' && hit.hp).toBe(state.enemies[0].hp + 3);
  });

  it('적 턴에는 적 행동과 기관사 피격 이벤트가 남는다', () => {
    const state = setup([]);
    endTurn(state);
    expect(state.events[0]).toEqual({ kind: 'enemyMove', enemy: 0 });
    expect(state.events.some((e) => e.kind === 'hit' && e.target === 'player')).toBe(true);
  });

  it('고장 나면 고장 이벤트가 남는다', () => {
    const state = setup(['overload_strike', 'overload_strike', 'overload_strike']);
    state.enemies[0].hp = 999;
    for (const uid of [100, 101, 102]) playCard(state, uid);
    expect(state.events.some((e) => e.kind === 'breakdown')).toBe(true);
  });
});

describe('런', () => {
  it('보상은 서로 다른 카드 3장', () => {
    const run = createRun(42);
    const rewards = rollCardRewards(run, 'normal');
    expect(new Set(rewards).size).toBe(3);
  });

  it('재배치는 지금 보이는 카드를 다시 내놓지 않는다', () => {
    const run = createRun(3);
    const first = rollCardRewards(run, 'normal');
    const second = rollCardRewards(run, 'normal', 3, first);
    expect(second.some((id) => first.includes(id))).toBe(false);
  });
});

describe('분해', () => {
  it('덱에서 고른 카드 한 장만 빠진다', () => {
    const run = createRun(1);
    const target = run.deck[0];
    const size = run.deck.length;
    expect(removeCard(run, target.uid)).toBe(true);
    expect(run.deck.length).toBe(size - 1);
    expect(run.deck.some((c) => c.uid === target.uid)).toBe(false);
  });

  it('최소 덱 크기 아래로는 분해할 수 없다', () => {
    const run = createRun(1);
    run.deck = run.deck.slice(0, MIN_DECK_SIZE);
    expect(removeCard(run, run.deck[0].uid)).toBe(false);
    expect(run.deck.length).toBe(MIN_DECK_SIZE);
  });
});

describe('지속 피해 — 산성 · 감전', () => {
  it('산성은 턴마다 피해를 주고 줄어들지 않는다', () => {
    const state = setup(['acid_spray'], ['golem']);
    const enemy = state.enemies[0];
    enemy.hp = 999;
    playCard(state, 100);
    endTurn(state);
    expect(enemy.hp).toBe(999 - 3);
    expect(enemy.statuses.acid).toBe(3);
    endTurn(state);
    expect(enemy.hp).toBe(999 - 6);
  });

  it('감전은 공격에 맞을 때마다 터지고 1씩 줄어든다', () => {
    const state = setup(['static_charge', 'arc_lash']);
    const enemy = state.enemies[0];
    enemy.hp = 999;
    playCard(state, 100);
    playCard(state, 101);
    // 피해 2 × 5회 + 감전 5 + 4 + 3 + 2 + 1
    expect(999 - enemy.hp).toBe(10 + 15);
    expect(enemy.statuses.shock).toBeUndefined();
  });

  it('용해는 대상의 산성 1당 피해 +4', () => {
    const state = setup(['dissolve']);
    const enemy = state.enemies[0];
    enemy.hp = 999;
    enemy.statuses.acid = 4;
    playCard(state, 100);
    expect(999 - enemy.hp).toBe(5 + 16);
  });

  it('총폭발은 화상·산성·감전의 합만큼 방어도를 무시하고 피해', () => {
    const state = setup(['total_detonation']);
    const enemy = state.enemies[0];
    enemy.hp = 999;
    enemy.block = 50;
    Object.assign(enemy.statuses, { burn: 3, acid: 4, shock: 5 });
    playCard(state, 100);
    expect(enemy.hp).toBe(999 - 12);
  });

  it('불씨는 산성과 감전에도 붙는다', () => {
    const state = setup(['acid_flask', 'static_charge']);
    state.player.statuses.kindling = 1;
    playCard(state, 100);
    playCard(state, 101);
    expect(state.enemies[0].statuses.acid).toBe(4);
    expect(state.enemies[0].statuses.shock).toBe(6);
  });
});

describe('압력 · 과열 신규 카드', () => {
  it('잔압 밸브가 있으면 대포를 쏴도 압력이 절반 남는다', () => {
    const state = setup(['residual_valve', 'overpressure', 'steam_cannon']);
    state.enemies[0].hp = 999;
    for (const uid of [100, 101, 102]) playCard(state, uid);
    expect(state.player.statuses.pressure).toBe(7);
  });

  it('레드존은 과열이 한계의 절반 이상일 때만 피해를 더한다', () => {
    const state = setup(['redline', 'cog_strike', 'cog_strike']);
    const enemy = state.enemies[0];
    enemy.hp = 999;
    playCard(state, 100);
    playCard(state, 101);
    expect(999 - enemy.hp).toBe(6);
    state.player.heat = 5;
    playCard(state, 102);
    expect(999 - enemy.hp).toBe(6 + 10);
  });

  it('열선 창은 과열을 피해로 바꾸고 과열을 없앤다', () => {
    const state = setup(['thermal_lance']);
    state.enemies[0].hp = 999;
    state.player.heat = 6;
    playCard(state, 100);
    expect(999 - state.enemies[0].hp).toBe(8 + 18);
    expect(state.player.heat).toBe(0);
  });
});

describe('태엽 장력', () => {
  it('0코스트 드로우 카드로 무한히 돌 수 없다', () => {
    const deck = [1, 2, 3].map((uid) => ({ uid, defId: 'rapid_cog' }));
    const state = createCombat({ hp: 70, maxHp: 70, deck, enemyIds: ['golem'], rng: new Rng(1) });
    state.enemies[0].hp = 9999;
    let plays = 0;
    while (state.hand.length > 0 && plays < 1000) {
      playCard(state, state.hand[0].uid);
      plays++;
    }
    expect(state.extraDrawn).toBe(MAX_EXTRA_DRAW);
    expect(plays).toBe(3 + MAX_EXTRA_DRAW);
  });

  it('다음 턴이 되면 장력이 다시 감긴다', () => {
    const state = setup(['gear_magazine']);
    playCard(state, 100);
    expect(state.extraDrawn).toBe(3);
    endTurn(state);
    expect(state.extraDrawn).toBe(0);
  });
});

describe('필살기', () => {
  /** 맨 아래 전투 방에 들어간 런 */
  function combatRun(char: string) {
    const run = createRun(5, char);
    moveTo(run, reachableNodes(run)[0].id);
    return run;
  }

  it('모든 캐릭터에게 필살기가 있고, 첫 전투부터 쓸 수 있다', () => {
    for (const id of CHARACTER_IDS) {
      const combat = startRoomCombat(combatRun(id));
      expect(combat.skill?.id).toBe(CHARACTERS[id].skill.id);
      expect(combat.skillReady).toBe(true);
    }
  });

  it('한 전투에 한 번만 쓰고, 증기압을 쓰지 않는다', () => {
    const combat = startRoomCombat(combatRun('guardian'));
    const steam = combat.player.steam;
    expect(useSkill(combat)).toBe(true);
    expect(combat.player.block).toBeGreaterThanOrEqual(20);
    expect(combat.player.steam).toBe(steam);
    expect(combat.events[0]).toEqual({ kind: 'skill', skillId: 'brass_fortress' });
    expect(useSkill(combat)).toBe(false);
  });

  it(`쓰고 나면 스테이지 ${SKILL_RECHARGE}개를 지나야 다시 쓸 수 있다 (전투가 아닌 방도 센다)`, () => {
    const run = combatRun('engineer');
    const used = startRoomCombat(run);
    useSkill(used);
    settleSkill(run, used);
    expect(run.skillCharge).toBe(0);
    const ready: boolean[] = [];
    for (let i = 0; i < SKILL_RECHARGE; i++) {
      moveTo(run, reachableNodes(run)[0].id);
      ready.push(run.skillCharge >= skillRecharge(run));
    }
    expect(ready).toEqual([false, false, false, false, true]);
    const c = startCustomCombat(run, ['automaton']);
    expect(c.skillReady).toBe(true);
  });

  it('쓰지 않은 전투는 충전을 비우지 않는다', () => {
    const run = combatRun('engineer');
    const c = startRoomCombat(run);
    settleSkill(run, c);
    expect(run.skillCharge).toBe(skillRecharge(run));
  });

  it('대상 지정 필살기는 적이 여럿이면 대상이 필요하다', () => {
    const state = createCombat({
      hp: 70, maxHp: 70, deck: [], enemyIds: ['automaton', 'automaton'], rng: new Rng(1), skill: CHARACTERS.gunner.skill,
    });
    expect(useSkill(state)).toBe(false);
    const hp = state.enemies[1].hp;
    expect(useSkill(state, 1)).toBe(true);
    expect(state.enemies[1].hp).toBeLessThan(hp);
    expect(state.player.statuses.pressure).toBe(6);
  });

  it('임계 돌파는 과열에 비례해 모두를 치고 과열을 비운다', () => {
    const state = createCombat({
      hp: 70, maxHp: 70, deck: [], enemyIds: ['automaton', 'automaton'], rng: new Rng(1), skill: CHARACTERS.overclocker.skill,
    });
    for (const e of state.enemies) e.hp = e.maxHp = 200;
    state.player.heat = 5;
    useSkill(state);
    expect(state.enemies.map((e) => e.hp)).toEqual([200 - 27, 200 - 27]);
    expect(state.player.heat).toBe(0);
    expect(state.player.block).toBe(10);
  });
});

// ══ 지도 ══

describe('시계탑 지도', () => {
  const maps = Array.from({ length: 40 }, (_, i) => generateMap(new Rng(i + 1)));

  it('맨 아래 방에서 출발한 모든 길은 보스로 이어진다', () => {
    for (const map of maps) {
      const boss = map[map.length - 1];
      expect(boss.kind).toBe('boss');
      expect(boss.row).toBe(MAP_ROWS);
      for (const n of map) {
        if (n.kind === 'boss') continue;
        expect(n.next.length).toBeGreaterThan(0);
        for (const id of n.next) expect(map[id].row).toBe(n.row + 1);
      }
    }
  });

  it('갈림길이 있고, 첫 줄은 전투 · 중간은 보물 · 보스 앞은 정비소다', () => {
    for (const map of maps) {
      expect(map.filter((n) => n.row === 0).length).toBeGreaterThanOrEqual(2);
      expect(map.some((n) => n.next.length >= 2)).toBe(true);
      expect(map.filter((n) => n.row === 0).every((n) => n.kind === 'combat')).toBe(true);
      expect(map.filter((n) => n.row === 6).every((n) => n.kind === 'treasure')).toBe(true);
      expect(map.filter((n) => n.row === MAP_ROWS - 1).every((n) => n.kind === 'rest')).toBe(true);
      expect(map.every((n) => n.kind === 'boss' || (n.col >= 0 && n.col < MAP_COLS))).toBe(true);
    }
  });

  it('지도마다 상점과 정예가 있고, 초반 3줄에는 정예가 없다', () => {
    for (const map of maps) {
      expect(map.some((n) => n.kind === 'shop')).toBe(true);
      expect(map.some((n) => n.kind === 'elite')).toBe(true);
      expect(map.some((n) => n.kind === 'elite' && n.row < 4)).toBe(false);
    }
  });

  it('정예 · 정비소 · 상점은 한 길에서 연달아 나오지 않는다', () => {
    for (const map of maps)
      for (const n of map)
        for (const id of n.next)
          if (['elite', 'shop'].includes(n.kind)) expect(map[id].kind).not.toBe(n.kind);
  });

  it('길끼리 엇갈리지(X자로 교차하지) 않는다', () => {
    for (const map of maps) {
      const edges = map.flatMap((n) => n.next.map((id) => ({ row: n.row, a: n.col, b: map[id].col })))
        .filter((e) => e.row < MAP_ROWS - 1);
      for (const e of edges)
        for (const f of edges)
          if (e.row === f.row && e.a < f.a) expect(e.b <= f.b).toBe(true);
    }
  });

  it('이어진 방으로만 이동할 수 있다', () => {
    const run = createRun(3);
    const first = reachableNodes(run)[0];
    expect(moveTo(run, first.id)).not.toBeNull();
    const unreachable = run.map.find((n) => n.row === 2)!;
    expect(moveTo(run, unreachable.id)).toBeNull();
    expect(moveTo(run, first.next[0])).not.toBeNull();
    expect(run.visited).toEqual([first.id, first.next[0]]);
  });

  it('구역 처음 두 일반 전투는 쉬운 무리다', () => {
    const run = createRun(8);
    moveTo(run, reachableNodes(run)[0].id);
    const easy = ACTS[0].easy.map((g) => g.join());
    for (let i = 0; i < 2; i++) expect(easy).toContain(startRoomCombat(run).enemies.map((e) => e.defId).join());
  });

  it('다음 구역으로 가면 새 지도에서 다시 시작한다', () => {
    const run = createRun(2);
    moveTo(run, reachableNodes(run)[0].id);
    advanceAct(run);
    expect(run.act).toBe(1);
    expect(run.node).toBeNull();
    expect(run.visited).toEqual([]);
  });
});

// ══ 정비(강화) ══

describe('정비', () => {
  it('강화하면 카드 id에 +가 붙고 수치가 오른다', () => {
    const run = createRun(1);
    const strike = run.deck.find((c) => c.defId === 'cog_strike')!;
    expect(upgradeCard(run, strike.uid)).toBe(true);
    expect(strike.defId).toBe('cog_strike+');
    expect(CARDS['cog_strike+'].name).toBe('톱니 타격+');
    expect(upgradeCard(run, strike.uid)).toBe(false);
    const state = setup(['cog_strike+']);
    const hp = state.enemies[0].hp;
    playCard(state, 100);
    expect(hp - state.enemies[0].hp).toBe(9);
  });

  it('불량 카드를 뺀 모든 카드에 강화판이 있다', () => {
    const missing = Object.values(CARDS).filter((c) => !c.upgraded && c.type !== 'status' && !CARDS[`${c.id}+`]);
    expect(missing.map((c) => c.id)).toEqual([]);
  });

  it('강화한 동력부는 비용이 줄어든다', () => {
    expect(CARDS['mana_amplifier+'].cost).toBe(1);
    expect(CARDS['mana_amplifier+'].effects).toEqual(CARDS.mana_amplifier.effects);
  });

  it('강화 카드는 보상에 나오지 않는다', () => {
    const run = createRun(4);
    for (let i = 0; i < 100; i++) expect(rollCardRewards(run, 'boss').some((id) => id.endsWith('+'))).toBe(false);
  });
});

// ══ 모듈 ══

describe('모듈', () => {
  const withModules = (...ids: string[]): RunState => {
    const run = createRun(6);
    for (const id of ids) gainModule(run, id);
    return run;
  };

  it('전투 시작 효과가 걸린다', () => {
    const run = withModules('brass_cog', 'rivet_plating', 'corrosion_sprayer', 'cooling_fins', 'spare_boiler');
    const c = startCustomCombat(run, ['automaton', 'rat']);
    expect(c.player.statuses.strength).toBe(1);
    expect(c.player.block).toBe(10);
    expect(c.enemies.every((e) => e.statuses.vulnerable === 2)).toBe(true);
    expect(c.player.maxHeat).toBe(13);
    expect(c.player.steam).toBe(c.player.maxSteam + 2);
  });

  it('예비 태엽은 첫 턴에만 2장 더 뽑는다', () => {
    const c = startCustomCombat(withModules('spare_spring'), ['automaton']);
    expect(c.hand.length).toBe(HAND_SIZE + 2);
  });

  it('생명 태엽은 최대 체력을 올리고, 같은 모듈은 두 번 얻지 않는다', () => {
    const run = createRun(6);
    const max = run.maxHp;
    gainModule(run, 'life_spring');
    gainModule(run, 'life_spring');
    expect(run.maxHp).toBe(max + 10);
    expect(run.modules).toEqual(['life_spring']);
  });

  it('정예는 모듈을 주고, 일반 전투는 주화만 준다', () => {
    const run = createRun(9);
    const before = run.gold;
    const normal = claimCombatSpoils(run, 'normal');
    expect(normal.module).toBeNull();
    expect(run.gold).toBe(before + normal.gold);
    const elite = claimCombatSpoils(run, 'elite');
    expect(elite.module).not.toBeNull();
    expect(run.modules).toContain(elite.module);
  });

  it('수리 키트 · 증기 침대 · 축전지', () => {
    const run = withModules('repair_kit', 'steam_bed', 'capacitor');
    run.hp = 10;
    expect(claimCombatSpoils(run, 'normal').healed).toBe(6);
    expect(restHealAmount(run)).toBe(Math.ceil(run.maxHp * 0.45));
    expect(skillRecharge(run)).toBe(SKILL_RECHARGE - 1);
    rest(run);
    expect(run.hp).toBe(16 + Math.ceil(run.maxHp * 0.45));
  });

  it('모든 모듈 설명이 있고 id가 일치한다', () => {
    for (const [id, m] of Object.entries(MODULES)) {
      expect(m.id).toBe(id);
      expect(m.text.length).toBeGreaterThan(0);
    }
  });
});

// ══ 상점 ══

describe('상점', () => {
  it('카드 5장과 모듈 2개를 판다', () => {
    const shop = createShop(createRun(12));
    expect(shop.cards.length).toBe(5);
    expect(new Set(shop.cards.map((c) => c.id)).size).toBe(5);
    expect(shop.modules.length).toBe(2);
  });

  it('주화가 모자라면 살 수 없고, 사면 주화가 줄고 덱에 들어간다', () => {
    const run = createRun(12);
    const shop = createShop(run);
    const item = shop.cards[0];
    run.gold = item.price - 1;
    expect(buyShopItem(run, item, 'card')).toBe(false);
    run.gold = item.price;
    const size = run.deck.length;
    expect(buyShopItem(run, item, 'card')).toBe(true);
    expect(run.gold).toBe(0);
    expect(run.deck.length).toBe(size + 1);
    expect(buyShopItem(run, item, 'card')).toBe(false);
  });

  it('분해 서비스는 상점마다 한 번, 쓸 때마다 비싸진다', () => {
    const run = createRun(12);
    run.gold = 999;
    const shop = createShop(run);
    const price = removePrice(run);
    expect(shopRemove(run, shop, run.deck[0].uid)).toBe(true);
    expect(run.gold).toBe(999 - price);
    expect(shopRemove(run, shop, run.deck[0].uid)).toBe(false);
    expect(removePrice(run)).toBeGreaterThan(price);
  });

  it('상인 조합 인장은 가격을 깎는다', () => {
    const plain = createShop(createRun(20));
    const run = createRun(20);
    gainModule(run, 'guild_seal');
    const cheap = createShop(run);
    expect(cheap.cards.reduce((s, c) => s + c.price, 0)).toBeLessThan(plain.cards.reduce((s, c) => s + c.price, 0));
  });
});

// ══ 사건 ══

describe('사건', () => {
  it('주화가 모자란 선택지는 고를 수 없다', () => {
    const run = createRun(1);
    run.gold = 10;
    expect(chooseEvent(run, 'clocksmith', 0)).toBeNull();
    run.gold = 40;
    const result = chooseEvent(run, 'clocksmith', 0)!;
    expect(run.gold).toBe(0);
    expect(result.pick).toBe('upgrade');
  });

  it('사건으로는 쓰러지지 않는다', () => {
    const run = createRun(1);
    run.hp = 3;
    chooseEvent(run, 'steam_leak', 0);
    expect(run.hp).toBe(1);
    expect(run.modules.length).toBe(1);
  });

  it('모든 사건의 모든 선택지를 고를 수 있다', () => {
    for (const ev of Object.values(EVENTS))
      ev.choices.forEach((_, i) => {
        const run = createRun(30 + i);
        run.gold = 200;
        const result = chooseEvent(run, ev.id, i);
        expect(result).not.toBeNull();
        expect(result!.text.length).toBeGreaterThan(0);
      });
  });
});

// ══ 저장 ══

describe('저장', () => {
  it('런과 전투를 저장했다가 그대로 불러온다', () => {
    const store = new Map<string, string>();
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
    });
    const run = createRun(77, 'stoker');
    moveTo(run, reachableNodes(run)[0].id);
    const combat = startRoomCombat(run);
    saveGame(run, { kind: 'combat', combat });
    const loaded = loadGame<{ kind: 'combat'; combat: typeof combat }>()!;
    expect(loaded.run.deck).toEqual(run.deck);
    expect(loaded.run.map).toEqual(run.map);
    expect(loaded.run.rng).toBeInstanceOf(Rng);
    expect(loaded.run.rng.state).toBe(run.rng.state);
    // 불러온 뒤에도 같은 난수가 이어진다
    expect(loaded.run.rng.next()).toBe(run.rng.next());
    expect(loaded.screen.combat.hand).toEqual(combat.hand);
    expect(loaded.screen.combat.enemies).toEqual(combat.enemies);
  });
});

describe('기믹 적', () => {
  it('폭주 보일러는 도화선 셋이 지나면 터지고 스스로 부서진다', () => {
    const state = setup([], ['boiler_bomb', 'automaton']);
    const hp = state.player.hp;
    expect(state.enemies[0].statuses.fuse).toBe(3);
    for (let i = 0; i < 3; i++) endTurn(state);
    expect(state.enemies[0].statuses.fuse).toBeUndefined();
    expect(state.enemies[0].nextMoveId).toBe('boom');
    state.player.block = 0;
    endTurn(state);
    expect(state.enemies[0].hp).toBe(0);
    expect(state.player.hp).toBeLessThanOrEqual(hp - 26);
    expect(state.events.some((e) => e.kind === 'gimmick' && e.text === '자폭!')).toBe(true);
  });

  it('녹 덩어리는 체력이 절반 이하가 되면 남은 체력을 가진 녹 방울 둘로 갈라진다', () => {
    const state = setup(['cog_strike'], ['rust_blob']);
    const blob = state.enemies[0];
    blob.hp = Math.floor(blob.maxHp / 2) + 3;
    playCard(state, 100, 0);
    expect(blob.hp).toBe(0);
    expect(state.outcome).toBe('ongoing');
    const drops = state.enemies.filter((e) => e.defId === 'rust_droplet');
    expect(drops).toHaveLength(2);
    expect(drops[0].hp).toBe(drops[0].maxHp);
    expect(drops[0].hp).toBeLessThanOrEqual(blob.maxHp / 2);
    expect(drops.map((d) => d.uid)).toEqual([1, 2]);
  });

  it('역행 인형은 한 번 되살아나고, 두 번째에는 쓰러진다', () => {
    const state = setup(['cog_strike', 'cog_strike'], ['rewinder']);
    const doll = state.enemies[0];
    doll.hp = 1;
    playCard(state, 100, 0);
    expect(doll.hp).toBe(Math.ceil(doll.maxHp / 2));
    expect(doll.statuses.rewind).toBeUndefined();
    expect(state.outcome).toBe('ongoing');
    doll.hp = 1;
    playCard(state, 101, 0);
    expect(state.outcome).toBe('won');
  });

  it('증기 계측기는 카드를 쓸 때마다 방어도를 얻는다', () => {
    const state = setup(['brass_guard', 'brass_guard'], ['pressure_gauge']);
    playCard(state, 100);
    playCard(state, 101);
    expect(state.enemies[0].block).toBe(4);
  });

  it('열 포식자는 오버클록할 때만 출력을 얻는다', () => {
    const state = setup(['brass_guard', 'brass_guard', 'brass_guard', 'brass_guard'], ['heat_eater']);
    for (let i = 0; i < 3; i++) playCard(state, 100 + i);
    expect(state.enemies[0].statuses.strength).toBeUndefined();
    playCard(state, 103);
    expect(state.enemies[0].statuses.strength).toBe(3);
  });

  it('배전 코일은 모든 동료에게 방어도와 출력을 나눠 준다', () => {
    const state = setup([], ['relay_coil', 'automaton']);
    endTurn(state);
    expect(state.enemies.every((e) => e.block === 9)).toBe(true);
    endTurn(state);
    expect(state.enemies.every((e) => e.statuses.strength === 2)).toBe(true);
  });
});
