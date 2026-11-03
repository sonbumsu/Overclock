import { expect, it } from 'vitest';
import { CHARACTER_IDS } from '../src/data/characters';
import { aliveEnemies, cardDef, endTurn, getPlayCost, playCard } from '../src/core/combat';
import { addCard, createRun, currentFloor, enterAct, rest, rollCardRewards, startFloorCombat } from '../src/core/run';

/** 단순한 봇으로 런 전체를 돌려 예외나 무한 루프가 없는지 확인한다. */
function simulate(seed: number): { won: boolean; floor: number } {
  const run = createRun(seed, CHARACTER_IDS[seed % CHARACTER_IDS.length]);
  while (run.floor < run.floors.length) {
    const floor = currentFloor(run);
    if (floor.kind === 'rest' || floor.kind === 'actStart') {
      if (floor.kind === 'rest') rest(run);
      else enterAct(run);
      run.floor++;
      continue;
    }
    const combat = startFloorCombat(run);
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
    if (combat.outcome === 'lost') return { won: false, floor: run.floor };
    addCard(run, rollCardRewards(run, floor.tier)[0]);
    run.floor++;
  }
  return { won: true, floor: run.floor };
}

it('봇이 여러 시드로 런을 끝까지 진행할 수 있다', () => {
  const results = Array.from({ length: 50 }, (_, i) => simulate(i + 1));
  const wins = results.filter((r) => r.won).length;
  console.log(`봇 승률: ${wins}/50, 평균 도달 층: ${(results.reduce((s, r) => s + r.floor, 0) / 50).toFixed(1)}`);
  expect(results.length).toBe(50);
});
