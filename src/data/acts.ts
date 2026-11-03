/** 시계탑의 구역 — 구역마다 등장하는 적 무리가 다르다 */
export interface ActDef {
  name: string;
  desc: string;
  /** 구역 첫 두 전투에 쓰는 쉬운 무리 */
  easy: string[][];
  normal: string[][];
  elite: string[][];
  boss: string[];
}

export const ACTS: ActDef[] = [
  {
    name: '하층 — 녹슨 기관실',
    desc: '멈춰 선 톱니바퀴 사이로 녹슨 기계들이 배회한다.',
    easy: [['automaton'], ['spider', 'spider'], ['rat', 'rat', 'rat']],
    normal: [['automaton', 'spider'], ['rat', 'rat', 'spider'], ['automaton', 'rat'], ['spider', 'spider', 'rat']],
    elite: [['guard']],
    boss: ['warden'],
  },
  {
    name: '중층 — 증기 배관망',
    desc: '끓어 넘친 보일러가 배관을 달군다. 뜨거운 증기에 조심할 것.',
    easy: [['golem'], ['bat', 'bat'], ['imp', 'bat']],
    normal: [['golem', 'bat'], ['imp', 'imp'], ['bat', 'bat', 'bat'], ['imp', 'golem']],
    elite: [['steam_knight'], ['steam_knight', 'bat']],
    boss: ['colossus'],
  },
  {
    name: '상층 — 마력 시계핵',
    desc: '시간이 뒤틀린 꼭대기. 세계의 심장이 멈춘 채 고동치고 있다.',
    easy: [['puppet', 'puppet'], ['wraith'], ['wraith', 'puppet']],
    normal: [['puppet', 'puppet', 'wraith'], ['wraith', 'wraith'], ['puppet', 'wraith', 'bat'], ['golem', 'puppet']],
    elite: [['sentinel'], ['sentinel', 'puppet']],
    boss: ['heart'],
  },
];

/** 한 구역의 층 구성 */
export const ACT_LAYOUT = ['easy', 'easy', 'normal', 'rest', 'elite', 'normal', 'normal', 'elite', 'rest', 'boss'] as const;
