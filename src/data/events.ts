import type { Rarity } from '../core/types';

/** 이벤트 선택의 결과 하나 */
export type EventOutcome =
  | { kind: 'gold'; amount: number }
  /** 양수는 회복, 음수는 피해 (이벤트로는 쓰러지지 않는다) */
  | { kind: 'hp'; amount: number }
  | { kind: 'maxHp'; amount: number }
  | { kind: 'healFull' }
  /** 이 등급의 무작위 카드 */
  | { kind: 'card'; rarity: Exclude<Rarity, 'starter'> }
  | { kind: 'curse'; cardId: string; count: number }
  | { kind: 'upgradeRandom'; count: number }
  | { kind: 'module' }
  /** 덱에서 카드를 골라 강화하거나 제거 — 고르는 화면이 이어진다 */
  | { kind: 'pick'; mode: 'upgrade' | 'remove' }
  /** 확률로 둘 중 하나 */
  | { kind: 'gamble'; chance: number; win: EventOutcome[]; lose: EventOutcome[]; winText: string; loseText: string };

export interface EventChoice {
  label: string;
  /** 버튼 아래 작은 설명 — 결과를 미리 알려 준다 */
  desc: string;
  /** 이만큼 주화가 있어야 고를 수 있고, 고르면 낸다 */
  goldCost?: number;
  outcomes: EventOutcome[];
  /** 고른 뒤 나오는 이야기 */
  result: string;
}

export interface EventDef {
  id: string;
  name: string;
  text: string;
  /** 그림 — sprites.ts의 스프라이트 키 */
  sprite: string;
  choices: EventChoice[];
}

const LEAVE: EventChoice = { label: '지나친다', desc: '아무 일도 일어나지 않는다.', outcomes: [], result: '괜한 일에 휘말리지 않기로 했다.' };

const EVENT_LIST: EventDef[] = [
  {
    id: 'toolbox', name: '버려진 공구함', sprite: 'toolbox',
    text: '계단참 구석에 기름때 묻은 공구함이 열린 채 놓여 있다.\n아직 쓸 만한 연장과 값나가는 고철이 섞여 있다.',
    choices: [
      { label: '연장을 챙긴다', desc: '무작위 카드 2장 강화', outcomes: [{ kind: 'upgradeRandom', count: 2 }],
        result: '손에 익은 렌치로 부품 몇 개를 다시 조였다. 훨씬 매끄럽게 돌아간다.' },
      { label: '고철을 판다', desc: '주화 +55', outcomes: [{ kind: 'gold', amount: 55 }],
        result: '고철을 자루에 담았다. 다음 상점에서 꽤 받을 수 있겠다.' },
    ],
  },
  {
    id: 'steam_leak', name: '증기 누출', sprite: 'boiler',
    text: '배관 이음매가 터져 뜨거운 증기가 뿜어져 나온다.\n새어 나오는 증기 너머로 반짝이는 부품이 보인다.',
    choices: [
      { label: '밸브를 잠근다', desc: '체력 -9, 무작위 모듈 획득', outcomes: [{ kind: 'hp', amount: -9 }, { kind: 'module' }],
        result: '손이 데었지만 밸브를 끝까지 돌렸다. 증기가 걷히자 쓸 만한 모듈이 드러났다.' },
      LEAVE,
    ],
  },
  {
    id: 'clocksmith', name: '떠돌이 시계공', sprite: 'clocksmith',
    text: '등에 거대한 태엽 상자를 멘 노인이 손짓한다.\n"젊은이, 부품이 덜컹거리는구먼. 내가 봐 줄까?"',
    choices: [
      { label: '수리를 맡긴다', desc: '주화 40 — 카드 1장을 골라 강화', goldCost: 40, outcomes: [{ kind: 'pick', mode: 'upgrade' }],
        result: '노인이 돋보기를 끼고 부품 하나를 정성껏 다듬었다.' },
      { label: '불량 부품을 넘긴다', desc: '체력 -5 — 카드 1장을 골라 제거', outcomes: [{ kind: 'hp', amount: -5 }, { kind: 'pick', mode: 'remove' }],
        result: '부품을 억지로 뜯어내느라 손을 베였다. 노인은 흐뭇하게 받아 갔다.' },
      LEAVE,
    ],
  },
  {
    id: 'mana_spring', name: '마력 샘', sprite: 'mana_spring',
    text: '갈라진 바닥 틈에서 푸른 마력이 샘처럼 솟는다.\n따뜻하지만, 어딘가 금속이 녹스는 냄새가 난다.',
    choices: [
      { label: '들이켠다', desc: '체력 완전 회복, 녹슨 부품 1장 추가', outcomes: [{ kind: 'healFull' }, { kind: 'curse', cardId: 'rusted_part', count: 1 }],
        result: '온몸에 힘이 차오른다. 다만 장갑 틈새에 녹이 슬기 시작했다.' },
      { label: '병에 담는다', desc: '최대 체력 +5', outcomes: [{ kind: 'maxHp', amount: 5 }],
        result: '조심스레 담은 마력을 심장 태엽에 조금씩 흘려 넣었다.' },
      LEAVE,
    ],
  },
  {
    id: 'gamble', name: '태엽 도박기', sprite: 'slot_machine',
    text: '"한 판에 주화 30! 대박이면 세 배!"\n녹슨 도박 기계가 요란하게 종을 울린다.',
    choices: [
      { label: '한 판 한다', desc: '주화 30 — 절반 확률로 주화 +90', goldCost: 30,
        outcomes: [{ kind: 'gamble', chance: 0.5, win: [{ kind: 'gold', amount: 90 }], lose: [],
          winText: '톱니 세 개가 나란히 섰다! 주화가 쏟아진다.', loseText: '기계가 덜컹거리더니 주화를 꿀꺽 삼켰다.' }],
        result: '' },
      { label: '발로 찬다', desc: '체력 -4, 주화 +25', outcomes: [{ kind: 'hp', amount: -4 }, { kind: 'gold', amount: 25 }],
        result: '튕겨 나온 레버에 정강이를 맞았지만, 동전 몇 닢이 굴러 나왔다.' },
      LEAVE,
    ],
  },
  {
    id: 'broken_automaton', name: '쓰러진 자동인형', sprite: 'automaton',
    text: '전투 중에 부서진 듯한 자동인형이 바닥에 쓰러져 있다.\n가슴의 정밀 부품이 아직 희미하게 빛난다.',
    choices: [
      { label: '해체한다', desc: '무작위 정밀 카드 1장, 녹슨 부품 1장', outcomes: [{ kind: 'card', rarity: 'precision' }, { kind: 'curse', cardId: 'rusted_part', count: 1 }],
        result: '정밀 부품을 빼냈다. 녹슨 찌꺼기까지 함께 딸려 왔다.' },
      { label: '고쳐 준다', desc: '체력 -7, 무작위 걸작 카드 1장', outcomes: [{ kind: 'hp', amount: -7 }, { kind: 'card', rarity: 'masterwork' }],
        result: '자동인형이 덜컹 일어나 고개를 숙이더니, 품에서 설계도 한 장을 꺼내 건넸다.' },
      LEAVE,
    ],
  },
  {
    id: 'gear_shrine', name: '톱니 성소', sprite: 'bigGear',
    text: '벽면 가득 맞물린 톱니들이 경건하게 돈다.\n시계탑 사람들이 기도를 올리던 곳이다.',
    choices: [
      { label: '기도한다', desc: '카드 1장을 골라 강화', outcomes: [{ kind: 'pick', mode: 'upgrade' }],
        result: '톱니 소리에 맞춰 숨을 고르자 손끝이 정교해진다.' },
      { label: '헌금한다', desc: '주화 50 — 최대 체력 +8', goldCost: 50, outcomes: [{ kind: 'maxHp', amount: 8 }],
        result: '동전이 톱니 사이로 굴러 들어가자 따뜻한 증기가 몸을 감쌌다.' },
      LEAVE,
    ],
  },
  {
    id: 'pressure_lab', name: '압력 실험실', sprite: 'boiler',
    text: '"피험자 모집! 부품 성능 보장!"\n깨진 유리 너머로 계측기 바늘이 미친 듯이 흔들린다.',
    choices: [
      { label: '실험에 참여한다', desc: '무작위 카드 3장 강화, 최대 체력 -4', outcomes: [{ kind: 'upgradeRandom', count: 3 }, { kind: 'maxHp', amount: -4 }],
        result: '고압 증기가 온몸을 훑고 지나갔다. 부품은 좋아졌지만 몸이 조금 상했다.' },
      { label: '자료를 훔친다', desc: '무작위 일반 카드 1장, 주화 +20', outcomes: [{ kind: 'card', rarity: 'common' }, { kind: 'gold', amount: 20 }],
        result: '책상 위 설계도와 동전 주머니를 슬쩍 챙겼다.' },
      LEAVE,
    ],
  },
];

export const EVENTS: Record<string, EventDef> = Object.fromEntries(EVENT_LIST.map((e) => [e.id, e]));
export const EVENT_IDS = EVENT_LIST.map((e) => e.id);
