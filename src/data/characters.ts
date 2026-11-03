import type { Statuses } from '../core/types';
import type { ArchetypeId } from './archetypes';

export interface CharacterDef {
  id: string;
  name: string;
  /** 한 줄 소개 */
  title: string;
  desc: string;
  maxHp: number;
  deck: string[];
  /** 보상에서 더 자주 나오는 덱 유형 */
  archetype: ArchetypeId;
  passive: {
    name: string;
    text: string;
    /** 전투 시작 시 기관사에게 걸리는 상태 */
    statuses?: Statuses;
    maxHeat?: number;
  };
}

const basics = (strikes: number, guards: number) => [
  ...Array<string>(strikes).fill('cog_strike'),
  ...Array<string>(guards).fill('brass_guard'),
];

const CHARACTER_LIST: CharacterDef[] = [
  {
    id: 'engineer', name: '기관사', title: '태엽을 감는 손',
    desc: '시계탑을 가장 잘 아는 정비공. 카드를 쉴 새 없이 돌려 회전을 쌓는다.',
    maxHp: 70, archetype: 'rapid',
    deck: [...basics(4, 4), 'wind_up', 'rapid_cog'],
    passive: { name: '태엽 장인', text: '매 턴 회전 1로 시작한다.', statuses: { flywheel: 1 } },
  },
  {
    id: 'stoker', name: '보일러공', title: '꺼지지 않는 불씨',
    desc: '시계탑의 화로를 지켜 온 화부. 불과 산과 번개로 적을 천천히, 확실하게 녹인다.',
    maxHp: 66, archetype: 'burn',
    deck: [...basics(3, 4), 'poker_jab', 'acid_flask', 'boiling_pipe'],
    passive: { name: '불씨', text: '적에게 화상·산성·감전을 걸 때마다 1 더 건다.', statuses: { kindling: 1 } },
  },
  {
    id: 'gunner', name: '증기 포수', title: '한 발이면 충분하다',
    desc: '증기 대포를 등에 멘 전직 포병. 압력을 모았다가 한 번에 쏜다.',
    maxHp: 72, archetype: 'pressure',
    deck: [...basics(3, 3), 'gauge_strike', 'load_shell', 'load_shell', 'steam_cannon'],
    passive: { name: '축압 탱크', text: '매 턴 압력 +3.', statuses: { compressor: 3 } },
  },
  {
    id: 'guardian', name: '황동 수호자', title: '움직이는 성벽',
    desc: '황동 갑주를 두른 시계탑 수비대장. 맞을수록 상대가 아프다.',
    maxHp: 85, archetype: 'barrier',
    deck: [...basics(4, 3), 'spiked_guard', 'spiked_guard', 'shield_bash'],
    passive: { name: '가시 외피', text: '가시 3을 두르고 싸운다.', statuses: { thorns: 3 } },
  },
  {
    id: 'overclocker', name: '오버클러커', title: '한계 따위는 없다',
    desc: '마도 기관 팔을 단 폭주 기술자. 과열을 연료 삼아 싸운다.',
    maxHp: 64, archetype: 'overheat',
    deck: [...basics(4, 4), 'spark_plug', 'heat_release'],
    passive: {
      name: '냉각 코어', text: '과열 한계 15. 과열이 오를 때마다 방어도 +2.',
      maxHeat: 15, statuses: { heatsink: 2 },
    },
  },
];

export const CHARACTERS: Record<string, CharacterDef> = Object.fromEntries(CHARACTER_LIST.map((c) => [c.id, c]));
export const CHARACTER_IDS = CHARACTER_LIST.map((c) => c.id);
