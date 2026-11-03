import type { CardDef, Effect, StatusId } from '../core/types';

const dmg = (amount: number, extra: Partial<Extract<Effect, { kind: 'damage' }>> = {}): Effect => ({
  kind: 'damage',
  amount,
  ...extra,
});
const block = (amount: number): Effect => ({ kind: 'block', amount });
const draw = (amount: number): Effect => ({ kind: 'draw', amount });
const wind = (amount: number): Effect => ({ kind: 'wind', amount });
const heat = (amount: number): Effect => ({ kind: 'heat', amount });
const status = (id: StatusId, amount: number, target: 'self' | 'enemy' | 'allEnemies'): Effect => ({
  kind: 'applyStatus', status: id, amount, target,
});

const CARD_LIST: CardDef[] = [
  // ── 기본 ──
  { id: 'cog_strike', name: '톱니 타격', type: 'attack', family: 'gear', rarity: 'starter', cost: 1,
    text: '피해 6.', effects: [dmg(6)] },
  { id: 'brass_guard', name: '황동 방패', type: 'skill', family: 'gear', rarity: 'starter', cost: 1,
    text: '방어도 5.', effects: [block(5)] },
  { id: 'steam_jet', name: '증기 분사', type: 'attack', family: 'steam', rarity: 'starter', cost: 1,
    text: '피해 5.\n맞물림(태엽): 방어도 4.', effects: [dmg(5)], mesh: { after: 'gear', effects: [block(4)] } },
  { id: 'wind_up', name: '태엽 감기', type: 'skill', family: 'gear', rarity: 'starter', cost: 0,
    text: '회전 +2.\n카드 1장 드로우.', effects: [wind(2), draw(1)] },

  // ── 캐릭터 전용 기본 카드 ──
  { id: 'poker_jab', name: '부지깽이 찌르기', type: 'attack', family: 'steam', rarity: 'starter', cost: 1,
    text: '피해 6.\n화상 5.', effects: [dmg(6), status('burn', 5, 'enemy')] },
  { id: 'load_shell', name: '포탄 장전', type: 'skill', family: 'steam', rarity: 'starter', cost: 1,
    text: '방어도 6.\n압력 +5.', effects: [block(6), status('pressure', 5, 'self')] },
  { id: 'spiked_guard', name: '가시 방패', type: 'skill', family: 'gear', rarity: 'starter', cost: 1,
    text: '방어도 7.\n가시 +1.', effects: [block(7), status('thorns', 1, 'self')] },
  { id: 'spark_plug', name: '점화 플러그', type: 'attack', family: 'steam', rarity: 'starter', cost: 0,
    text: '피해 7.\n과열 +2.', effects: [dmg(7), heat(2)] },

  // ── 일반 ──
  { id: 'linked_cogs', name: '연쇄 톱니', type: 'attack', family: 'gear', rarity: 'common', cost: 1,
    text: '피해 4.\n회전마다 피해 +2.', effects: [dmg(4, { perRotation: 2 })] },
  { id: 'chain_drive', name: '연동 사슬', type: 'attack', family: 'gear', rarity: 'common', cost: 1,
    text: '피해 3을 2회.\n연동마다 피해 +2.', effects: [dmg(3, { times: 2, perChain: 2 })] },
  { id: 'piston', name: '증기 피스톤', type: 'attack', family: 'steam', rarity: 'common', cost: 2,
    text: '피해 12.\n맞물림(태엽): 피해 6.', effects: [dmg(12)], mesh: { after: 'gear', effects: [dmg(6)] } },
  { id: 'pressure_release', name: '압력 방출', type: 'skill', family: 'steam', rarity: 'common', cost: 1,
    text: '방어도 8.\n과열 -3.', effects: [block(8), heat(-3)] },
  { id: 'coolant', name: '냉각수', type: 'skill', family: 'steam', rarity: 'common', cost: 0,
    text: '과열 -5.\n소멸.', effects: [heat(-5)], exhaust: true },
  { id: 'arcane_ignite', name: '마력 점화', type: 'attack', family: 'arcane', rarity: 'common', cost: 1,
    text: '피해 7.\n맞물림(증기): 부식 2.', effects: [dmg(7)],
    mesh: { after: 'steam', effects: [{ kind: 'applyStatus', status: 'vulnerable', amount: 2, target: 'enemy' }] } },
  { id: 'rune_circuit', name: '룬 회로', type: 'skill', family: 'arcane', rarity: 'common', cost: 1,
    text: '카드 2장 드로우.\n맞물림(마력): 증기압 +1.', effects: [draw(2)],
    mesh: { after: 'arcane', effects: [{ kind: 'steam', amount: 1 }] } },

  // ── 정밀 ──
  { id: 'overload_strike', name: '과부하 일격', type: 'attack', family: 'steam', rarity: 'precision', cost: 0,
    text: '피해 10.\n과열 +4.', effects: [dmg(10), heat(4)] },
  { id: 'gear_storm', name: '톱니 폭풍', type: 'attack', family: 'gear', rarity: 'precision', cost: 2,
    text: '모든 적에게 피해 6.\n회전마다 피해 +1.', effects: [{ kind: 'damageAll', amount: 6, perRotation: 1 }] },
  { id: 'rust_hex', name: '녹의 술식', type: 'skill', family: 'arcane', rarity: 'precision', cost: 1,
    text: '적에게 녹 2, 부식 2.', effects: [
      { kind: 'applyStatus', status: 'weak', amount: 2, target: 'enemy' },
      { kind: 'applyStatus', status: 'vulnerable', amount: 2, target: 'enemy' },
    ] },
  { id: 'flywheel', name: '관성 플라이휠', type: 'power', family: 'gear', rarity: 'precision', cost: 1,
    text: '매 턴 회전 +1 상태로 시작.', effects: [{ kind: 'applyStatus', status: 'flywheel', amount: 1, target: 'self' }] },
  { id: 'turbocharger', name: '과급기', type: 'power', family: 'steam', rarity: 'precision', cost: 1,
    text: '출력 +2.', effects: [{ kind: 'applyStatus', status: 'strength', amount: 2, target: 'self' }] },

  // ── 걸작 ──
  { id: 'grand_clock', name: '대시계 일격', type: 'attack', family: 'gear', rarity: 'masterwork', cost: 2,
    text: '피해 8.\n회전마다 피해 +4.', effects: [dmg(8, { perRotation: 4 })] },
  { id: 'time_reverse', name: '역행 톱니', type: 'skill', family: 'arcane', rarity: 'masterwork', cost: 2,
    text: '방어도 10.\n회전 +3.\n카드 2장 드로우.', effects: [block(10), wind(3), draw(2)] },
  { id: 'mana_amplifier', name: '마도 증폭기', type: 'power', family: 'arcane', rarity: 'masterwork', cost: 2,
    text: '매 턴 증기압 +1.', effects: [{ kind: 'applyStatus', status: 'amplifier', amount: 1, target: 'self' }] },

  // ══ 화상 덱 — 지속 피해 ══
  { id: 'scald', name: '증기 화상', type: 'attack', family: 'steam', rarity: 'common', cost: 1,
    text: '피해 6.\n화상 4.', effects: [dmg(6), status('burn', 4, 'enemy')] },
  { id: 'boiling_pipe', name: '끓는 배관', type: 'skill', family: 'steam', rarity: 'common', cost: 1,
    text: '모든 적에게 화상 8.', effects: [status('burn', 8, 'allEnemies')] },
  { id: 'heat_wave', name: '열풍 분사', type: 'attack', family: 'steam', rarity: 'precision', cost: 2,
    text: '모든 적에게 피해 7,\n화상 6.', effects: [{ kind: 'damageAll', amount: 7 }, status('burn', 6, 'allEnemies')] },
  { id: 'combustion', name: '연소 촉진', type: 'skill', family: 'arcane', rarity: 'precision', cost: 1,
    text: '대상의 화상 2배만큼\n즉시 피해.\n(방어도 무시)', effects: [{ kind: 'detonate', statuses: ['burn'], factor: 2 }] },
  { id: 'rekindle', name: '재점화 술식', type: 'skill', family: 'arcane', rarity: 'precision', cost: 0,
    text: '대상의 화상 2배.\n소멸.', effects: [{ kind: 'multiplyStatus', status: 'burn', factor: 2, target: 'enemy' }], exhaust: true },
  { id: 'furnace', name: '화염 보일러', type: 'power', family: 'steam', rarity: 'masterwork', cost: 2,
    text: '매 턴 시작 시\n모든 적에게 화상 6.', effects: [status('furnace', 6, 'self')] },

  // ══ 산성 — 줄지 않는 지속 피해 ══
  { id: 'acid_flask', name: '산성 플라스크', type: 'attack', family: 'arcane', rarity: 'common', cost: 1,
    text: '피해 6.\n산성 3.', effects: [dmg(6), status('acid', 3, 'enemy')] },
  { id: 'acid_spray', name: '산성 분무', type: 'skill', family: 'arcane', rarity: 'common', cost: 1,
    text: '모든 적에게 산성 3.', effects: [status('acid', 3, 'allEnemies')] },
  { id: 'dissolve', name: '용해', type: 'attack', family: 'arcane', rarity: 'precision', cost: 1,
    text: '피해 5.\n대상의 산성 1당\n피해 +4.', effects: [dmg(5, { perTargetStatus: { status: 'acid', amount: 4 } })] },
  { id: 'acid_catalyst', name: '촉매 투입', type: 'skill', family: 'arcane', rarity: 'precision', cost: 0,
    text: '대상의 산성 2배.\n소멸.', effects: [{ kind: 'multiplyStatus', status: 'acid', factor: 2, target: 'enemy' }], exhaust: true },
  { id: 'acid_pump', name: '산성 순환기', type: 'power', family: 'arcane', rarity: 'masterwork', cost: 2,
    text: '매 턴 시작 시\n모든 적에게 산성 3.', effects: [status('acidPump', 3, 'self')] },

  // ══ 감전 — 맞을 때마다 터지는 지속 피해 ══
  { id: 'tesla_coil', name: '테슬라 코일', type: 'attack', family: 'arcane', rarity: 'common', cost: 1,
    text: '감전 5.\n피해 3을 2회.', effects: [status('shock', 5, 'enemy'), dmg(3, { times: 2 })] },
  { id: 'static_charge', name: '정전기 축적', type: 'skill', family: 'arcane', rarity: 'common', cost: 0,
    text: '감전 5.', effects: [status('shock', 5, 'enemy')] },
  { id: 'arc_lash', name: '방전 채찍', type: 'attack', family: 'arcane', rarity: 'precision', cost: 1,
    text: '피해 2를 5회.', effects: [dmg(2, { times: 5 })] },
  { id: 'storm_generator', name: '뇌전 발생기', type: 'power', family: 'arcane', rarity: 'masterwork', cost: 2,
    text: '매 턴 시작 시\n모든 적에게 감전 4.', effects: [status('generator', 4, 'self')] },

  // ══ 지속 피해 복합 ══
  { id: 'chain_reaction', name: '연쇄 반응', type: 'skill', family: 'arcane', rarity: 'masterwork', cost: 1,
    text: '대상의 화상·산성·\n감전을 모두 2배.\n소멸.', exhaust: true, effects: [
      { kind: 'multiplyStatus', status: 'burn', factor: 2, target: 'enemy' },
      { kind: 'multiplyStatus', status: 'acid', factor: 2, target: 'enemy' },
      { kind: 'multiplyStatus', status: 'shock', factor: 2, target: 'enemy' },
    ] },
  { id: 'total_detonation', name: '총폭발', type: 'skill', family: 'steam', rarity: 'precision', cost: 1,
    text: '대상의 화상·산성·\n감전 합만큼 피해.\n(방어도 무시)', effects: [{ kind: 'detonate', statuses: ['burn', 'acid', 'shock'] }] },

  // ══ 압력 덱 — 한방딜 ══
  { id: 'charge_pressure', name: '압력 충전', type: 'skill', family: 'steam', rarity: 'common', cost: 1,
    text: '압력 +8.\n카드 1장 드로우.', effects: [status('pressure', 8, 'self'), draw(1)] },
  { id: 'valve_lock', name: '밸브 잠금', type: 'skill', family: 'steam', rarity: 'common', cost: 1,
    text: '방어도 8.\n압력 +6.', effects: [block(8), status('pressure', 6, 'self')] },
  { id: 'steam_cannon', name: '증기 대포', type: 'attack', family: 'steam', rarity: 'common', cost: 2,
    text: '피해 12.\n압력 1당 피해 +3.\n압력을 모두 소모.',
    effects: [dmg(12, { perPressure: 3 }), { kind: 'clearStatus', status: 'pressure' }] },
  { id: 'double_compress', name: '이중 압축', type: 'skill', family: 'steam', rarity: 'precision', cost: 0,
    text: '압력 2배.\n과열 +2.', effects: [{ kind: 'multiplyStatus', status: 'pressure', factor: 2, target: 'self' }, heat(2)] },
  { id: 'compressor', name: '압축기', type: 'power', family: 'gear', rarity: 'precision', cost: 1,
    text: '매 턴 시작 시\n압력 +5.', effects: [status('compressor', 5, 'self')] },
  { id: 'steam_ram', name: '증기 공성추', type: 'attack', family: 'steam', rarity: 'masterwork', cost: 2,
    text: '피해 20.\n압력 1당 피해 +4.\n압력을 모두 소모.',
    effects: [dmg(20, { perPressure: 4 }), { kind: 'clearStatus', status: 'pressure' }] },
  { id: 'gauge_strike', name: '계기 타격', type: 'attack', family: 'gear', rarity: 'common', cost: 1,
    text: '피해 6.\n압력 1당 피해 +1.\n(압력은 그대로)', effects: [dmg(6, { perPressure: 1 })] },
  { id: 'overpressure', name: '과압 주입', type: 'skill', family: 'steam', rarity: 'precision', cost: 1,
    text: '압력 +14.\n과열 +3.', effects: [status('pressure', 14, 'self'), heat(3)] },
  { id: 'residual_valve', name: '잔압 밸브', type: 'power', family: 'gear', rarity: 'precision', cost: 1,
    text: '압력을 소모해도\n절반이 남는다.', effects: [status('residual', 1, 'self')] },

  // ══ 연사 덱 — 계속 드로우해서 때리기 ══
  { id: 'rapid_cog', name: '톱니 연사', type: 'attack', family: 'gear', rarity: 'common', cost: 0,
    text: '피해 3.\n카드 1장 드로우.', effects: [dmg(3), draw(1)] },
  { id: 'gear_magazine', name: '태엽 탄창', type: 'skill', family: 'gear', rarity: 'common', cost: 1,
    text: '카드 3장 드로우.', effects: [draw(3)] },
  { id: 'high_gear', name: '고속 기어', type: 'skill', family: 'gear', rarity: 'common', cost: 0,
    text: '회전 +1.\n카드 2장 드로우.\n소멸.', effects: [wind(1), draw(2)], exhaust: true },
  { id: 'cog_barrage', name: '톱니 난사', type: 'attack', family: 'gear', rarity: 'precision', cost: 1,
    text: '피해 2를 1회.\n회전마다 1회 추가.', effects: [dmg(2, { hitsPerRotation: 1 })] },
  { id: 'autoloader', name: '자동 장전기', type: 'power', family: 'gear', rarity: 'precision', cost: 1,
    text: '3장 쓸 때마다\n카드 1장 드로우.', effects: [status('autoloader', 1, 'self')] },
  { id: 'endless_spring', name: '무한 태엽', type: 'power', family: 'gear', rarity: 'masterwork', cost: 2,
    text: '매 턴 카드를\n2장 더 드로우.', effects: [status('spring', 2, 'self')] },

  // ══ 오버클록 덱 — 과열을 무기로 ══
  { id: 'heat_release', name: '과열 방출', type: 'attack', family: 'steam', rarity: 'common', cost: 1,
    text: '피해 6.\n과열 1당 피해 +2.', effects: [dmg(6, { perHeat: 2 })] },
  { id: 'critical_boost', name: '임계 가동', type: 'skill', family: 'steam', rarity: 'common', cost: 0,
    text: '증기압 +2.\n과열 +5.\n카드 1장 드로우.', effects: [{ kind: 'steam', amount: 2 }, heat(5), draw(1)] },
  { id: 'coolant_cycle', name: '냉각 순환', type: 'skill', family: 'steam', rarity: 'common', cost: 1,
    text: '과열을 모두 없애고\n없앤 과열 1당\n방어도 3.', effects: [{ kind: 'vent', blockPerHeat: 3 }] },
  { id: 'heatsink', name: '열교환기', type: 'power', family: 'steam', rarity: 'precision', cost: 1,
    text: '과열이 오를 때마다\n방어도 +4.', effects: [status('heatsink', 4, 'self')] },
  { id: 'meltdown_engine', name: '폭주 기관', type: 'power', family: 'gear', rarity: 'masterwork', cost: 2,
    text: '고장 나면 피해를 받는\n대신 모든 적에게\n피해 22.', effects: [status('meltdown', 22, 'self')] },
  { id: 'thermal_lance', name: '열선 창', type: 'attack', family: 'steam', rarity: 'precision', cost: 2,
    text: '피해 8.\n과열 1당 피해 +3.\n과열을 모두 없앤다.', effects: [dmg(8, { perHeat: 3 }), { kind: 'vent', blockPerHeat: 0 }] },
  { id: 'exhaust_blast', name: '배기 폭풍', type: 'attack', family: 'steam', rarity: 'common', cost: 1,
    text: '모든 적에게 피해 4.\n과열 1당 피해 +1.', effects: [{ kind: 'damageAll', amount: 4, perHeat: 1 }] },
  { id: 'afterburner', name: '애프터버너', type: 'skill', family: 'steam', rarity: 'common', cost: 0,
    text: '과열 +3.\n카드 2장 드로우.', effects: [heat(3), draw(2)] },
  { id: 'redline', name: '레드존', type: 'power', family: 'steam', rarity: 'precision', cost: 1,
    text: '과열이 한계의 절반\n이상이면 주는 피해 +4.', effects: [status('redline', 4, 'self')] },

  // ══ 방벽 덱 — 막고 되받아치기 ══
  { id: 'iron_wall', name: '철벽', type: 'skill', family: 'gear', rarity: 'common', cost: 2,
    text: '방어도 16.', effects: [block(16)] },
  { id: 'counter_stance', name: '반격 태세', type: 'skill', family: 'gear', rarity: 'common', cost: 1,
    text: '방어도 6.\n가시 +2.', effects: [block(6), status('thorns', 2, 'self')] },
  { id: 'shield_bash', name: '방패 강타', type: 'attack', family: 'gear', rarity: 'common', cost: 1,
    text: '현재 방어도만큼\n피해.', effects: [dmg(0, { perBlock: 1 })] },
  { id: 'spike_armor', name: '가시 톱니 갑옷', type: 'power', family: 'gear', rarity: 'precision', cost: 1,
    text: '가시 4.\n(공격받을 때마다\n공격자에게 피해)', effects: [status('thorns', 4, 'self')] },
  { id: 'steam_barrier', name: '증기 방벽', type: 'power', family: 'steam', rarity: 'masterwork', cost: 2,
    text: '턴이 시작돼도\n방어도가 사라지지\n않는다.', effects: [status('retain', 1, 'self')] },

  // ══ 마력 술식 — 제어와 흡수 ══
  { id: 'hand_throw', name: '시곗바늘 투척', type: 'attack', family: 'arcane', rarity: 'common', cost: 1,
    text: '피해 4를 2회.\n부식 1.', effects: [dmg(4, { times: 2 }), status('vulnerable', 1, 'enemy')] },
  { id: 'rust_mist', name: '녹 안개', type: 'skill', family: 'arcane', rarity: 'common', cost: 1,
    text: '모든 적에게 녹 2.', effects: [status('weak', 2, 'allEnemies')] },
  { id: 'ether_drain', name: '에테르 흡수', type: 'attack', family: 'arcane', rarity: 'precision', cost: 2,
    text: '피해 11.\n입힌 피해만큼 회복.', effects: [dmg(11, { lifesteal: true })] },
  { id: 'overload_circuit', name: '회로 과부하', type: 'skill', family: 'arcane', rarity: 'precision', cost: 0,
    text: '카드 3장 드로우.\n녹슨 부품 1장을\n버린 더미에 추가.', effects: [draw(3), { kind: 'addCard', cardId: 'rusted_part', count: 1 }] },
  { id: 'time_stop', name: '시간 정지', type: 'skill', family: 'arcane', rarity: 'masterwork', cost: 2,
    text: '모든 적 기절 1.\n(다음 행동을 건너뜀)\n소멸.', effects: [status('stun', 1, 'allEnemies')], exhaust: true },

  // ── 상태이상 ──
  { id: 'jammed_gear', name: '걸린 톱니', type: 'status', rarity: 'starter', cost: 1,
    text: '효과 없음.\n소멸.', effects: [], exhaust: true },
  { id: 'rusted_part', name: '녹슨 부품', type: 'status', rarity: 'starter', cost: null,
    text: '사용할 수 없음.\n고장으로 생긴 불량 부품.', effects: [] },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]));

export const REWARD_POOL = CARD_LIST.filter((c) => c.rarity !== 'starter');
