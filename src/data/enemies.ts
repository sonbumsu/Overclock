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
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(ENEMY_LIST.map((e) => [e.id, e]));
