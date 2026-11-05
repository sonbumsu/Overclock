import type { EnemyDef } from '../core/types';

const ENEMY_LIST: EnemyDef[] = [
  {
    id: 'automaton', name: '고장난 자동인형', hp: [38, 44], pattern: 'cycle',
    moves: [
      { id: 'punch', name: '태엽 주먹', effects: [{ kind: 'attack', amount: 8 }] },
      { id: 'plating', name: '장갑 전개', effects: [{ kind: 'block', amount: 6 }, { kind: 'attack', amount: 5 }] },
      { id: 'overspin', name: '과회전 강타', effects: [{ kind: 'attack', amount: 12 }] },
    ],
  },
  {
    id: 'spider', name: '증기 거미', hp: [20, 25], pattern: 'random',
    moves: [
      { id: 'pincer', name: '집게 연타', effects: [{ kind: 'attack', amount: 4, times: 2 }] },
      { id: 'corrode', name: '부식 증기', effects: [
        { kind: 'applyStatus', status: 'vulnerable', amount: 2, target: 'player' },
        { kind: 'attack', amount: 3 },
      ] },
    ],
  },
  {
    id: 'guard', name: '녹슨 경비병', hp: [68, 72], pattern: 'cycle',
    moves: [
      { id: 'power_up', name: '출력 상승', effects: [{ kind: 'applyStatus', status: 'strength', amount: 3, target: 'self' }] },
      { id: 'mace', name: '철퇴', effects: [{ kind: 'attack', amount: 14 }] },
      { id: 'slashes', name: '연속 베기', effects: [{ kind: 'attack', amount: 6, times: 2 }] },
    ],
  },
  {
    id: 'warden', name: '멈춘 시계의 수호자', hp: [150, 150], pattern: 'cycle',
    moves: [
      { id: 'second_hand', name: '초침 베기', effects: [{ kind: 'attack', amount: 10 }] },
      { id: 'time_warp', name: '시간 왜곡', effects: [
        { kind: 'applyStatus', status: 'weak', amount: 2, target: 'player' },
        { kind: 'applyStatus', status: 'vulnerable', amount: 2, target: 'player' },
      ] },
      { id: 'barrier', name: '태엽 장벽', effects: [
        { kind: 'block', amount: 15 },
        { kind: 'applyStatus', status: 'strength', amount: 2, target: 'self' },
      ] },
      { id: 'noon_bell', name: '정오의 종', effects: [{ kind: 'attack', amount: 6, times: 3 }] },
    ],
  },
  {
    id: 'rat', name: '태엽 쥐', hp: [11, 14], pattern: 'random',
    moves: [
      { id: 'bite', name: '물어뜯기', effects: [{ kind: 'attack', amount: 5 }] },
      { id: 'scurry', name: '종종걸음', effects: [{ kind: 'block', amount: 4 }, { kind: 'attack', amount: 3 }] },
    ],
  },

  // 기믹: 3턴 안에 부수지 못하면 터진다
  {
    id: 'boiler_bomb', name: '폭주 보일러', hp: [26, 30], pattern: 'cycle', statuses: { fuse: 3 },
    moves: [
      { id: 'fuse3', name: '도화선 — 3', effects: [{ kind: 'block', amount: 5 }] },
      { id: 'fuse2', name: '도화선 — 2', effects: [{ kind: 'block', amount: 5 }] },
      { id: 'fuse1', name: '도화선 — 1', effects: [{ kind: 'block', amount: 5 }] },
      { id: 'boom', name: '증기 대폭발', effects: [{ kind: 'attack', amount: 26 }, { kind: 'selfDestruct' }] },
    ],
  },
  // 기믹: 체력이 절반 이하가 되면 녹 방울 둘로 갈라진다
  {
    id: 'rust_blob', name: '녹 덩어리', hp: [50, 56], pattern: 'random', statuses: { split: 1 }, splitInto: 'rust_droplet',
    moves: [
      { id: 'slam', name: '덮치기', effects: [{ kind: 'attack', amount: 9 }] },
      { id: 'ooze', name: '녹물 끼얹기', effects: [{ kind: 'applyStatus', status: 'weak', amount: 2, target: 'player' }, { kind: 'attack', amount: 4 }] },
    ],
  },
  {
    id: 'rust_droplet', name: '녹 방울', hp: [12, 12], pattern: 'random',
    moves: [
      { id: 'splash', name: '튀기기', effects: [{ kind: 'attack', amount: 5 }] },
      { id: 'stain', name: '녹 얼룩', effects: [{ kind: 'applyStatus', status: 'weak', amount: 1, target: 'player' }, { kind: 'attack', amount: 2 }] },
    ],
  },

  // ── 2구역: 증기 배관망 ──
  {
    id: 'golem', name: '증기 골렘', hp: [74, 80], pattern: 'cycle',
    moves: [
      { id: 'charge', name: '증기 충전', effects: [{ kind: 'block', amount: 12 }, { kind: 'applyStatus', status: 'strength', amount: 2, target: 'self' }] },
      { id: 'punch', name: '압력 펀치', effects: [{ kind: 'attack', amount: 16 }] },
      { id: 'exhaust', name: '배기', effects: [{ kind: 'attack', amount: 6 }, { kind: 'addCard', cardId: 'jammed_gear', count: 1 }] },
    ],
  },
  {
    id: 'bat', name: '톱니 박쥐', hp: [26, 30], pattern: 'random',
    moves: [
      { id: 'rotor', name: '회전 날개', effects: [{ kind: 'attack', amount: 3, times: 3 }] },
      { id: 'dive', name: '급강하', effects: [{ kind: 'attack', amount: 10 }] },
    ],
  },
  {
    id: 'imp', name: '보일러 도깨비', hp: [34, 38], pattern: 'cycle',
    moves: [
      { id: 'embers', name: '불씨 뿌리기', effects: [{ kind: 'applyStatus', status: 'burn', amount: 4, target: 'player' }] },
      { id: 'claw', name: '할퀴기', effects: [{ kind: 'attack', amount: 8 }] },
      { id: 'breath', name: '불꽃 숨결', effects: [{ kind: 'attack', amount: 5 }, { kind: 'applyStatus', status: 'burn', amount: 2, target: 'player' }] },
    ],
  },
  {
    id: 'steam_knight', name: '증기 기사', hp: [108, 114], pattern: 'cycle',
    moves: [
      { id: 'raise', name: '방패 들기', effects: [{ kind: 'block', amount: 20 }, { kind: 'attack', amount: 6 }] },
      { id: 'lance', name: '증기 창', effects: [{ kind: 'attack', amount: 18 }] },
      { id: 'charge', name: '돌진', effects: [{ kind: 'attack', amount: 8, times: 2 }, { kind: 'applyStatus', status: 'vulnerable', amount: 2, target: 'player' }] },
    ],
  },
  {
    id: 'colossus', name: '보일러 거인', hp: [250, 250], pattern: 'cycle',
    moves: [
      { id: 'vent', name: '증기 분출', effects: [{ kind: 'attack', amount: 8, times: 3 }] },
      { id: 'overheat', name: '과열', effects: [
        { kind: 'applyStatus', status: 'strength', amount: 3, target: 'self' },
        { kind: 'applyStatus', status: 'burn', amount: 5, target: 'player' },
      ] },
      { id: 'smash', name: '용광로 강타', effects: [{ kind: 'attack', amount: 26 }] },
      { id: 'cool', name: '긴급 냉각', effects: [{ kind: 'block', amount: 30 }, { kind: 'addCard', cardId: 'jammed_gear', count: 2 }] },
    ],
  },

  // 기믹: 동료에게 방어도와 출력을 나눠 준다 — 먼저 부숴야 한다
  {
    id: 'relay_coil', name: '배전 코일', hp: [30, 34], pattern: 'cycle',
    moves: [
      { id: 'shield', name: '방어 전류', effects: [{ kind: 'blockAllies', amount: 9 }] },
      { id: 'overcharge', name: '과충전', effects: [{ kind: 'buffAllies', status: 'strength', amount: 2 }] },
      { id: 'discharge', name: '방전', effects: [{ kind: 'attack', amount: 7 }] },
    ],
  },
  // 기믹: 카드를 쓸 때마다 방어도가 붙는다 — 적은 장수로 크게 때려야 한다
  {
    id: 'pressure_gauge', name: '증기 계측기', hp: [56, 62], pattern: 'cycle', statuses: { reactive: 2 },
    moves: [
      { id: 'press', name: '압착', effects: [{ kind: 'attack', amount: 11 }] },
      { id: 'measure', name: '계측', effects: [{ kind: 'applyStatus', status: 'vulnerable', amount: 2, target: 'player' }, { kind: 'attack', amount: 5 }] },
      { id: 'burst', name: '압력 분출', effects: [{ kind: 'attack', amount: 5, times: 3 }] },
    ],
  },

  // ── 3구역: 마력 시계핵 ──
  {
    id: 'puppet', name: '마력 인형', hp: [44, 50], pattern: 'cycle',
    moves: [
      { id: 'strings', name: '실 당기기', effects: [{ kind: 'applyStatus', status: 'weak', amount: 2, target: 'player' }, { kind: 'attack', amount: 7 }] },
      { id: 'dance', name: '칼날 춤', effects: [{ kind: 'attack', amount: 4, times: 3 }] },
      { id: 'ward', name: '보호 술식', effects: [{ kind: 'block', amount: 12 }, { kind: 'applyStatus', status: 'strength', amount: 1, target: 'self' }] },
    ],
  },
  {
    id: 'wraith', name: '시간의 망령', hp: [40, 46], pattern: 'random',
    moves: [
      { id: 'drain', name: '시간 흡수', effects: [{ kind: 'attack', amount: 10 }, { kind: 'addCard', cardId: 'rusted_part', count: 1 }] },
      { id: 'blur', name: '흐릿해지기', effects: [{ kind: 'block', amount: 15 }] },
      { id: 'reap', name: '시간 베기', effects: [{ kind: 'attack', amount: 15 }] },
    ],
  },
  {
    id: 'sentinel', name: '시간 감시자', hp: [150, 155], pattern: 'cycle',
    moves: [
      { id: 'volley', name: '정밀 사격', effects: [{ kind: 'attack', amount: 9, times: 2 }] },
      { id: 'slow', name: '감속장', effects: [
        { kind: 'applyStatus', status: 'weak', amount: 2, target: 'player' },
        { kind: 'applyStatus', status: 'vulnerable', amount: 2, target: 'player' },
      ] },
      { id: 'focus', name: '집중', effects: [{ kind: 'block', amount: 15 }, { kind: 'applyStatus', status: 'strength', amount: 4, target: 'self' }] },
      { id: 'execute', name: '처형', effects: [{ kind: 'attack', amount: 28 }] },
    ],
  },
  {
    id: 'heart', name: '시계탑의 심장', hp: [360, 360], pattern: 'cycle',
    moves: [
      { id: 'pulse', name: '맥동', effects: [{ kind: 'attack', amount: 3, times: 6 }] },
      { id: 'rewind', name: '역행', effects: [{ kind: 'block', amount: 35 }, { kind: 'applyStatus', status: 'strength', amount: 3, target: 'self' }] },
      { id: 'weight', name: '시간의 무게', effects: [
        { kind: 'applyStatus', status: 'weak', amount: 2, target: 'player' },
        { kind: 'applyStatus', status: 'vulnerable', amount: 2, target: 'player' },
        { kind: 'addCard', cardId: 'rusted_part', count: 2 },
      ] },
      { id: 'doom', name: '종말의 종', effects: [{ kind: 'attack', amount: 40 }] },
    ],
  },
  // 기믹: 한 번 쓰러뜨려도 절반 체력으로 되살아난다
  {
    id: 'rewinder', name: '역행 인형', hp: [36, 40], pattern: 'random', statuses: { rewind: 1 },
    moves: [
      { id: 'tick', name: '초침 찌르기', effects: [{ kind: 'attack', amount: 10 }] },
      { id: 'tock', name: '거꾸로 도는 춤', effects: [{ kind: 'attack', amount: 4, times: 3 }] },
      { id: 'mend', name: '태엽 감기', effects: [{ kind: 'block', amount: 10 }, { kind: 'applyStatus', status: 'strength', amount: 1, target: 'self' }] },
    ],
  },
  // 기믹: 오버클록할 때마다 강해진다 — 과열 덱의 천적
  {
    id: 'heat_eater', name: '열 포식자', hp: [60, 66], pattern: 'cycle', statuses: { heatHunter: 3 },
    moves: [
      { id: 'gulp', name: '열 들이켜기', effects: [{ kind: 'attack', amount: 12 }] },
      { id: 'radiate', name: '방열', effects: [{ kind: 'block', amount: 12 }, { kind: 'applyStatus', status: 'burn', amount: 3, target: 'player' }] },
      { id: 'flare', name: '불꽃 토하기', effects: [{ kind: 'attack', amount: 6, times: 2 }] },
    ],
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(ENEMY_LIST.map((e) => [e.id, e]));
