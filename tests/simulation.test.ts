import { expect, it } from 'vitest';
import { CHARACTER_IDS } from '../src/data/characters';
import { EVENTS } from '../src/data/events';
import { aliveEnemies, cardDef, endTurn, getPlayCost, playCard } from '../src/core/combat';
import {
  addCard, advanceAct, buyShopItem, canChoose, chooseEvent, claimCombatSpoils, createRun, createShop, enterAct, isFinalAct,
  moveTo, openTreasure, reachableNodes, removeCard, rest, rollCardRewards, rollEvent, ROOM_TIER, startRoomCombat, upgradableCards,
  upgradeCard,
} from '../src/core/run';

/** 단순한 봇으로 런 전체(지도 · 상점 · 사건 포함)를 돌려 예외나 무한 루프가 없는지 확인한다. */
function simulate(seed: number): { won: boolean; act: number; rooms: number } {
  const run = createRun(seed, CHARACTER_IDS[seed % CHARACTER_IDS.length]);
  let rooms = 0;
  for (;;) {
    const options = reachableNodes(run);
    // 갈림길에서는 시드에 따라 아무 데나
    const node = moveTo(run, options[(seed + rooms) % options.length].id)!;
    rooms++;
    if (node.kind === 'rest') {
      const up = upgradableCards(run);
      if (run.hp < run.maxHp * 0.6 || up.length === 0) rest(run);
      else upgradeCard(run, up[0].uid);
    } else if (node.kind === 'shop') {
      const shop = createShop(run);
      for (const item of shop.cards) buyShopItem(run, item, 'card');
      for (const item of shop.modules) buyShopItem(run, item, 'module');
    } else if (node.kind === 'event') {
      const id = rollEvent(run);
      const index = EVENTS[id].choices.findIndex((_, i) => canChoose(run, id, i));
      const result = chooseEvent(run, id, index)!;
      if (result.pick === 'upgrade') upgradeCard(run, upgradableCards(run)[0].uid);
      if (result.pick === 'remove') removeCard(run, run.deck[0].uid);
    } else if (node.kind === 'treasure') {
      openTreasure(run);
    } else {
      const combat = startRoomCombat(run);
      for (let turn = 0; turn < 100 && combat.outcome === 'ongoing'; turn++) {
        // 과열 없이 쓸 수 있는 카드만 사용
        let played = true;
        while (played && combat.outcome === 'ongoing') {
          played = false;
          for (const card of combat.hand) {
            const cost = getPlayCost(combat, cardDef(card));
            if (cost && cost.heat === 0 && playCard(combat, card.uid, aliveEnemies(combat)[0]?.uid)) {
              played = true;
              break;
            }
          }
        }
        endTurn(combat);
      }
      expect(combat.outcome).not.toBe('ongoing');
      run.hp = combat.player.hp;
      if (combat.outcome === 'lost') return { won: false, act: run.act, rooms };
      if (node.kind === 'boss' && isFinalAct(run)) return { won: true, act: run.act, rooms };
      const tier = ROOM_TIER[node.kind]!;
      claimCombatSpoils(run, tier);
      addCard(run, rollCardRewards(run, tier)[0]);
      if (node.kind === 'boss') {
        advanceAct(run);
        enterAct(run);
      }
    }
    expect(run.hp).toBeGreaterThan(0);
    expect(rooms).toBeLessThan(100);
  }
}

it('봇이 여러 시드로 런을 끝까지 진행할 수 있다', () => {
  const results = Array.from({ length: 50 }, (_, i) => simulate(i + 1));
  const wins = results.filter((r) => r.won).length;
  console.log(`봇 승률: ${wins}/50, 평균 도달 구역: ${(results.reduce((s, r) => s + r.act + 1, 0) / 50).toFixed(2)}, 평균 방 수: ${(results.reduce((s, r) => s + r.rooms, 0) / 50).toFixed(1)}`);
  expect(results.length).toBe(50);
});
