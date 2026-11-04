import { CARDS } from '../data/cards';
import {
  aliveEnemies,
  cardDef,
  getIntents,
  getNextMove,
  getPlayCost,
  isMeshActive,
  MAX_EXTRA_DRAW,
  MAX_HEAT,
  needsTarget,
  type Intent,
} from '../core/combat';
import {
  ACT_MAX_HP_BONUS, canRemoveCard, currentFloor, floorInAct, isFavored, MIN_DECK_SIZE, REST_HEAL_RATIO, runCharacter,
  SKILL_RECHARGE, type RunState,
} from '../core/run';
import { ACTS } from '../data/acts';
import { ARCHETYPES } from '../data/archetypes';
import { CHARACTER_IDS, CHARACTERS } from '../data/characters';
import type { CardDef, Combatant, CombatState, Family, StatusId } from '../core/types';
import logoUrl from '../assets/logo.png';
import { cardArtImg } from './card-art';
import { cardBackImg } from './card-frame';
import { settings } from './sound';
import { backdropURL, iconImg, spriteImg } from './sprites';

const FAMILY_NAME: Record<Family, string> = { gear: '태엽', steam: '증기', arcane: '마력' };
const TYPE_NAME: Record<CardDef['type'], string> = { attack: '작동부', skill: '방호부', power: '동력부', status: '불량' };
export const STATUS_INFO: Record<StatusId, { name: string; desc: string }> = {
  strength: { name: '출력', desc: '주는 피해 +N' },
  vulnerable: { name: '부식', desc: '받는 피해 50% 증가' },
  weak: { name: '녹', desc: '주는 피해 25% 감소' },
  burn: { name: '화상', desc: '턴 시작에 방어도를 무시하는 피해 N, 이후 1 감소' },
  pressure: { name: '압력', desc: '방출 카드의 피해 증가' },
  flywheel: { name: '플라이휠', desc: '매 턴 회전 N으로 시작' },
  amplifier: { name: '증폭', desc: '매 턴 증기압 +N' },
  furnace: { name: '보일러', desc: '매 턴 모든 적에게 화상 N' },
  compressor: { name: '압축기', desc: '매 턴 압력 +N' },
  autoloader: { name: '자동 장전', desc: '카드 3장마다 N장 드로우' },
  spring: { name: '무한 태엽', desc: '매 턴 N장 더 드로우' },
  thorns: { name: '가시', desc: '공격받을 때마다 공격자에게 피해 N' },
  retain: { name: '방벽', desc: '턴이 시작돼도 방어도 유지' },
  heatsink: { name: '열교환', desc: '과열이 오를 때마다 방어도 +N' },
  meltdown: { name: '폭주', desc: '고장 시 모든 적에게 피해 N' },
  stun: { name: '기절', desc: '다음 행동을 건너뜀' },
  kindling: { name: '불씨', desc: '적에게 화상·산성·감전을 걸 때마다 +N' },
  acid: { name: '산성', desc: '턴 시작에 방어도를 무시하는 피해 N, 줄어들지 않음' },
  shock: { name: '감전', desc: '공격에 맞을 때마다 추가 피해 N, 이후 1 감소' },
  acidPump: { name: '산성 순환', desc: '매 턴 모든 적에게 산성 N' },
  generator: { name: '뇌전', desc: '매 턴 모든 적에게 감전 N' },
  residual: { name: '잔압', desc: '압력을 소모해도 절반이 남음' },
  redline: { name: '레드존', desc: '과열이 한계의 절반 이상이면 주는 피해 +N' },
};
const KEYWORDS = /(맞물림\([^)]+\)|맞물림|회전|연동|과열|소멸|부식|녹|출력|증기압|방어도|화상|산성|감전|압력|가시|기절)/g;

/** 마우스를 올리면 설명이 뜨는 속성. 줄바꿈은 \n, 첫 줄은 제목으로 굵게 */
export const tip = (text: string) => `data-tip="${text.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;

/** 카드 글에 나오는 용어 설명 */
const KEYWORD_INFO: Record<string, string> = {
  맞물림: '직전에 쓴 카드가 괄호 속 계열이면 추가 효과가 발동합니다.',
  회전: '이번 턴에 감긴 태엽 수. 카드를 쓸 때마다 +1, 턴이 바뀌면 초기화됩니다.',
  연동: '같은 계열 카드를 연달아 쓴 횟수.',
  과열: `증기압이 모자라도 과열을 쌓아 카드를 강행할 수 있습니다. 한계에 닿으면 고장(체력 -6, 녹슨 부품 추가). 매 턴 2씩 식습니다.`,
  소멸: '사용하면 이번 전투 동안 사라집니다.',
  증기압: '카드를 쓰는 데 드는 에너지. 매 턴 다시 채워집니다.',
  방어도: '받는 피해를 먼저 막아 줍니다. 턴이 시작되면 사라집니다.',
  ...Object.fromEntries(Object.values(STATUS_INFO).map((info) => [info.name, info.desc])),
};

function keywordTip(text: string): string {
  const words = [...new Set([...text.matchAll(KEYWORDS)].map((m) => m[1].replace(/\(.*\)/, '')))];
  return words.map((w) => `${w}: ${KEYWORD_INFO[w] ?? ''}`).join('\n');
}

/** 적 스프라이트 배율 — 크기 차이는 그림 자체에 담겨 있다 */
const ENEMY_SCALE = 3;

/** 현재 구역의 배경 */
const actBackdrop = (run: RunState) => `style="--backdrop:url(${backdropURL(currentFloor(run)?.act ?? ACTS.length - 1)})"`;

function hpBar(c: Combatant): string {
  return `
    <div class="hp-row">
      ${c.block ? `<span class="block-chip">${iconImg('block', 2)}${c.block}</span>` : ''}
      <div class="hpbar ${c.block ? 'shielded' : ''}">
        <div class="hpbar-fill" style="width:${(c.hp / c.maxHp) * 100}%"></div>
        <span>${c.hp}/${c.maxHp}</span>
      </div>
    </div>`;
}

function statusesHtml(c: Combatant): string {
  const chips = Object.entries(c.statuses)
    .map(([id, n]) => {
      const info = STATUS_INFO[id as StatusId];
      return `<span class="chip st-${id}" ${tip(`${info.name} ${n}\n${info.desc}`)}>${info.name} ${n}</span>`;
    })
    .join('');
  return `<div class="chips">${chips}</div>`;
}

function intentHtml(intent: Intent, move: string): string {
  const t = (body: string) => tip(`${move}\n${body}`);
  switch (intent.kind) {
    case 'attack':
      return `<span class="intent attack" ${t(`공격: 피해 ${intent.damage}${intent.times > 1 ? `을 ${intent.times}회` : ''}`)}>${iconImg('attack', 2)}${intent.damage}${intent.times > 1 ? `×${intent.times}` : ''}</span>`;
    case 'block':
      return `<span class="intent block" ${t(`방어: 방어도 ${intent.amount}`)}>${iconImg('block', 2)}${intent.amount}</span>`;
    case 'buff':
      return `<span class="intent buff" ${t('강화: 자신을 강화합니다.')}>${iconImg('buff', 2)}</span>`;
    case 'debuff':
      return `<span class="intent debuff" ${t('방해: 기관사에게 해로운 효과를 걸거나 불량 카드를 섞습니다.')}>${iconImg('debuff', 2)}</span>`;
    case 'stun':
      return `<span class="intent stun" ${tip('기절\n이번 턴에는 행동하지 못합니다.')}>기절</span>`;
  }
}

export function cardHtml(
  def: CardDef,
  opts: { uid?: number; action?: string; extraClass?: string; badge?: string; index?: number; total?: number } = {},
): string {
  const family = def.family ?? 'none';
  const attrs = opts.action
    ? `data-action="${opts.action}" ${opts.uid !== undefined ? `data-uid="${opts.uid}"` : ''} data-card="${def.id}"`
    : '';
  // 손패를 부채꼴로 펼친다
  let fan = '';
  if (opts.index !== undefined && opts.total) {
    const mid = (opts.total - 1) / 2;
    const off = opts.index - mid;
    // 장수가 많으면 곡선을 완만하게 해서 가장자리 카드가 화면 밖으로 내려가지 않게 한다
    const curve = 4 * Math.min(1, 25 / (opts.total * opts.total));
    fan = `style="--lift:${Math.round(off * off * curve)}px; --i:${opts.index}"`;
  }
  const keywords = keywordTip(def.text);
  return `
    <div class="card fam-${family} type-${def.type} rarity-${def.rarity} ${opts.extraClass ?? ''}" ${attrs} ${fan} ${keywords ? tip(`${def.name}\n${keywords}`) : ''}>
      <div class="card-cost">${def.cost ?? '×'}</div>
      ${opts.badge ? `<div class="card-badge">${opts.badge}</div>` : ''}
      <div class="card-name">${def.name}</div>
      <div class="card-art-wrap">${cardArtImg(def.id, def.family, 4)}</div>
      <div class="card-meta">${def.family ? FAMILY_NAME[def.family] + ' · ' : ''}${TYPE_NAME[def.type]}</div>
      <div class="card-text"><span>${def.text.replace(KEYWORDS, '<b>$1</b>').replace(/\n/g, '<br>')}</span></div>
    </div>`;
}

const FLOOR_LABEL = { normal: '전투', elite: '정예', boss: '보스' } as const;

export function soundButtons(): string {
  const control = (kind: 'sfx' | 'music', label: string, vol: number) => `
    <span class="sound-ctl">
      <button class="tb-btn sound-btn ${settings[kind] ? '' : 'off'}" data-action="toggle-${kind}" ${tip(`${label}\n켜기/끄기`)}>${label}</button>
      <input type="range" class="vol-slider" data-volume="${kind}" min="0" max="100" step="5" value="${Math.round(vol * 100)}" aria-label="${label} 음량" ${tip(`${label} 음량`)}>
    </span>`;
  return control('sfx', '효과음', settings.sfxVol) + control('music', '배경음', settings.musicVol);
}

function topBar(run: RunState, hp: number): string {
  const floor = currentFloor(run);
  const floorLabel = !floor ? '' : floor.kind === 'rest' ? '정비소' : floor.kind === 'actStart' ? '구역 입구' : FLOOR_LABEL[floor.tier];
  const { act, index, total } = floorInAct(run);
  return `
    <header class="topbar">
      <span class="logo-small">${iconImg('gear', 2)}오버클록</span>
      <span class="tb-item act-name">${act + 1}구역 · ${ACTS[act].name.split(' — ')[1]}</span>
      <span class="tb-item">${iconImg('floor', 2)}${index > 0 ? `${index}/${total}층 ` : ''}<em>${floorLabel}</em></span>
      <span class="tb-item" ${tip(`체력\n${runCharacter(run).name} · ${runCharacter(run).passive.name}: ${runCharacter(run).passive.text}`)}>${iconImg('heart', 2)}${hp}/${run.maxHp}</span>
      <button class="tb-item tb-btn" data-action="view-pile" data-pile="deck" ${tip('덱 보기\n지금 가진 카드 전체')}>${iconImg('deck', 2)}${run.deck.length}장</button>
      <span class="tb-spacer"></span>
      ${soundButtons()}
    </header>`;
}

export function renderTitle(): string {
  return `
    <header class="topbar"><span class="tb-spacer"></span>${soundButtons()}</header>
    <div class="stage title-stage">
      <div class="title-gear">${spriteImg('bigGear', 6, 'spin')}</div>
      <div class="title-hero">${spriteImg('engineer', 4, 'bob')}</div>
      <div class="title-text">
        <h1 class="logo-img"><img src="${logoUrl}" width="815" height="370" alt="오버클록 (Overclock)"></h1>
        <p class="tagline">멈춰버린 세계의 시간을 다시 돌리기 위해<br>마도공학 시계탑을 오른다</p>
        <button class="btn big" data-action="start">태엽 감기</button>
      </div>
    </div>
    <div class="panel howto">
      <h3>${iconImg('gear', 2)} 조작 원리</h3>
      <ul>
        <li>${iconImg('steamFull', 2)}<span><b>증기압</b>을 써서 부품 카드를 사용한다. 매 턴 다시 채워진다.</span></li>
        <li>${iconImg('gear', 2)}<span><b>회전</b> — 카드를 쓸 때마다 태엽이 1칸 감긴다. 회전에 비례해 강해지는 카드가 있다.</span></li>
        <li>${iconImg('chain', 2)}<span><b>맞물림</b> — 특정 계열 카드 바로 다음에 쓰면 추가 효과. <b>연동</b> — 같은 계열을 연속으로 쓰면 연쇄가 쌓인다.</span></li>
        <li>${iconImg('heat', 2)}<span><b>오버클록</b> — 증기압이 모자라도 <b>과열</b>을 쌓아 강행할 수 있다. 과열 ${MAX_HEAT} 도달 시 고장!</span></li>
      </ul>
      <p class="hint">단축키 — E: 턴 종료 · Esc: 선택 취소 · 아이콘이나 카드에 마우스를 올리면 설명이 나옵니다</p>
    </div>`;
}

/**
 * dying: 이번 행동으로 쓰러진 적 — 타격 연출이 끝날 때까지 보이게 둔다
 * fresh: 이번 행동으로 새로 손에 들어온 카드 — 올라오는 애니메이션
 */
export function renderCombat(
  run: RunState, state: CombatState, selectedUid: number | null, skillTargeting: boolean,
  dying: ReadonlySet<number>, fresh: ReadonlySet<number>,
): string {
  const p = state.player;
  const targeting = selectedUid !== null || skillTargeting;

  const enemies = state.enemies
    .map((e) => {
      const dead = e.hp <= 0 && !dying.has(e.uid);
      if (dead) return `<div class="unit enemy dead" data-enemy="${e.uid}">${spriteImg(e.defId, ENEMY_SCALE, 'dead-sprite')}</div>`;
      return `
      <div class="unit enemy ${e.hp <= 0 ? 'dying' : targeting ? 'targetable' : ''}" ${e.hp > 0 ? `data-action="target" data-uid="${e.uid}"` : ''} data-enemy="${e.uid}">
        <div class="intent-bubble ${e.hp <= 0 ? 'hidden' : ''}">${getIntents(state, e).map((i) => intentHtml(i, getNextMove(e).name)).join('')}</div>
        <div class="sprite-wrap">${spriteImg(e.defId, ENEMY_SCALE, 'bob')}</div>
        <div class="nameplate">${e.name}</div>
        ${hpBar(e)}
        ${statusesHtml(e)}
      </div>`;
    })
    .join('');

  const steamIcons = Array.from({ length: Math.max(p.maxSteam, p.steam) }, (_, i) =>
    iconImg(i < p.steam ? 'steamFull' : 'steamEmpty', 3),
  ).join('');
  const heatCells = Array.from({ length: p.maxHeat }, (_, i) => `<i class="${i < p.heat ? `on h${Math.floor((i / p.maxHeat) * 3)}` : ''}"></i>`).join('');

  const hand = state.hand
    .map((card, index) => {
      const def = cardDef(card);
      const cost = getPlayCost(state, def);
      const mesh = isMeshActive(state, def);
      const classes = [
        cost === null ? 'unplayable' : '',
        cost && cost.heat > 0 ? 'overclock' : '',
        mesh ? 'mesh-ready' : '',
        card.uid === selectedUid ? 'selected' : '',
        fresh.has(card.uid) ? 'fresh' : '',
      ].join(' ');
      const badge = cost && cost.heat > 0 ? `과열+${cost.heat}` : mesh ? '맞물림!' : undefined;
      return cardHtml(def, { uid: card.uid, action: 'play', extraClass: classes, badge, index, total: state.hand.length });
    })
    .join('');

  const selectedDef = selectedUid !== null ? CARDS[state.hand.find((c) => c.uid === selectedUid)?.defId ?? ''] : undefined;
  const prompt = skillTargeting && state.skill
    ? `★ ${state.skill.name} — 대상을 선택하세요`
    : selectedDef && needsTarget(selectedDef) && aliveEnemies(state).length > 1 ? `▶ ${selectedDef.name} — 대상을 선택하세요` : '';

  return `
    ${topBar(run, p.hp)}
    <div class="stage combat-stage" ${actBackdrop(run)}>
      <div class="log">${state.log.slice(-5).map((l) => `<div>${l}</div>`).join('')}</div>
      ${prompt ? `<div class="prompt">${prompt}</div>` : ''}
      <div class="unit player" data-player>
        <div class="sprite-wrap">${spriteImg(run.character, 3, 'bob')}</div>
        <div class="nameplate" ${tip(`${runCharacter(run).name}\n${runCharacter(run).passive.name}: ${runCharacter(run).passive.text}`)}>${runCharacter(run).name}</div>
        ${hpBar(p)}
        ${statusesHtml(p)}
      </div>
      <div class="enemies">${enemies}</div>
    </div>
    <div class="hud">
      <div class="panel gauge" ${tip(`증기압\n${KEYWORD_INFO.증기압}`)}>
        <div class="gauge-label">증기압 ${p.steam}/${p.maxSteam}</div>
        <div class="steam-icons">${steamIcons}</div>
      </div>
      <div class="panel gauge" ${tip(`회전\n${KEYWORD_INFO.회전}`)}>
        <div class="gauge-label">회전</div>
        <div class="gauge-value">${iconImg('gear', 3, state.rotation > 0 ? 'spin-fast' : '')}<span>${state.rotation}</span></div>
      </div>
      <div class="panel gauge" ${tip(`연동\n${KEYWORD_INFO.연동}`)}>
        <div class="gauge-label">연동${state.lastFamily ? ` · ${FAMILY_NAME[state.lastFamily]}` : ''}</div>
        <div class="gauge-value fam-text-${state.lastFamily ?? 'none'}">${iconImg('chain', 3)}<span>${state.chain}</span></div>
      </div>
      <div class="panel gauge heat-gauge ${p.heat >= p.maxHeat * 0.7 ? 'danger' : ''}" ${tip(`과열 ${p.heat}/${p.maxHeat}\n${KEYWORD_INFO.과열}`)}>
        <div class="gauge-label">${iconImg('heat', 2)} 과열 ${p.heat}/${p.maxHeat}</div>
        <div class="heat-cells">${heatCells}</div>
      </div>
      <div class="hud-right">
        <div class="piles tension ${state.extraDrawn >= MAX_EXTRA_DRAW ? 'spent' : ''}" ${tip(`태엽 장력\n한 턴에 카드 효과로 뽑을 수 있는 남은 장수. 다음 턴에 다시 ${MAX_EXTRA_DRAW}장이 됩니다.`)}>태엽 장력 ${MAX_EXTRA_DRAW - state.extraDrawn}/${MAX_EXTRA_DRAW}</div>
        <div class="hud-buttons">
          ${skillButton(run, state, skillTargeting)}
          <button class="btn" data-action="end-turn">턴 종료 [E]</button>
        </div>
      </div>
    </div>
    <div class="hand-row">
      ${pileButton('draw', '덱', state.drawPile.length, '뽑을 카드 더미 (순서는 가려집니다)')}
      <section class="hand" style="--overlap:${handOverlap(state.hand.length)}px">${hand}</section>
      <div class="pile-col">
        ${pileButton('exhaust', '소멸', state.exhaustPile.length, '이번 전투에서 사라진 카드', 2)}
        ${pileButton('discard', '묘지', state.discardPile.length, '쓰고 버린 카드. 덱이 비면 섞어서 다시 덱이 됩니다.')}
      </div>
    </div>`;
}

/** 필살기 버튼 — 쓸 수 있으면 빛나고, 아니면 충전 칸을 보여 준다 */
function skillButton(run: RunState, state: CombatState, active: boolean): string {
  const skill = state.skill;
  if (!skill) return '';
  const used = state.skillUsed;
  const charge = used ? 0 : run.skillCharge;
  const pips = Array.from({ length: SKILL_RECHARGE }, (_, i) => `<i class="${state.skillReady || i < charge ? 'on' : ''}"></i>`).join('');
  const status = state.skillReady
    ? '지금 쓸 수 있습니다. [Q]'
    : used ? `이번 전투에서 사용했습니다. 전투 ${SKILL_RECHARGE}번을 마치면 다시 충전됩니다.`
    : `충전 중 — 전투를 ${SKILL_RECHARGE - charge}번 더 마치면 쓸 수 있습니다.`;
  return `
    <button class="skill-btn ${state.skillReady ? 'ready' : 'charging'} ${active ? 'active' : ''} skill-${run.character}"
      data-action="skill" ${state.skillReady ? '' : 'aria-disabled="true"'} ${tip(`★ 필살기 · ${skill.name}\n${skill.text}\n\n${status}`)}>
      <span class="skill-star">★</span>
      <span class="skill-name">${skill.name}</span>
      <span class="skill-pips">${pips}</span>
    </button>`;
}

/** 손패가 많으면 카드를 겹쳐서 한 줄에 맞춘다 */
function handOverlap(count: number): number {
  const room = 900, width = 160;
  return count <= 1 ? 0 : Math.max(0, Math.ceil((count * width - room) / (count - 1)));
}

/** 카드 뒷면이 쌓인 더미. 장수에 따라 두께가 달라진다 */
function pileButton(pile: 'draw' | 'discard' | 'exhaust', label: string, count: number, desc: string, scale = 3): string {
  const layers = count === 0 ? 0 : Math.min(3, Math.ceil(count / 5));
  const under = Array.from({ length: layers }, (_, i) =>
    `<span class="pile-layer" style="--n:${layers - i}">${cardBackImg(pile, scale)}</span>`).join('');
  return `
    <button class="pile-stack pile-${pile} ${count === 0 ? 'empty' : ''}" data-action="view-pile" data-pile="${pile}" ${tip(`${label} ${count}장\n${desc}\n클릭해서 보기`)}>
      <span class="pile-cards">${under}<span class="pile-top">${cardBackImg(pile, scale)}</span></span>
      <span class="pile-count">${count}</span>
      <span class="pile-label">${label}</span>
    </button>`;
}

export type PileKind = 'draw' | 'discard' | 'exhaust' | 'deck';
const PILE_TITLE: Record<PileKind, string> = { draw: '덱 — 뽑을 카드', discard: '묘지 — 버린 카드', exhaust: '소멸한 카드', deck: '전체 덱' };

/** 카드 더미를 펼쳐 보는 창. 뽑을 더미는 순서를 감추려고 정렬해서 보여 준다 */
export function renderPileOverlay(pile: PileKind, cardIds: string[]): string {
  const sorted = pile === 'draw' || pile === 'deck' ? [...cardIds].sort() : [...cardIds].reverse();
  return `
    <div class="overlay" data-action="close-overlay">
      <div class="overlay-box panel">
        <h2>${PILE_TITLE[pile]} <small>${cardIds.length}장</small></h2>
        ${pile === 'draw' ? '<p class="hint">순서는 가려져 있습니다.</p>' : pile === 'discard' ? '<p class="hint">최근에 버린 카드부터.</p>' : ''}
        <div class="deck-grid view">${sorted.map((id) => cardHtml(CARDS[id])).join('') || '<p class="hint">비어 있습니다.</p>'}</div>
        <div class="center-row"><button class="btn" data-action="close-overlay">닫기 [Esc]</button></div>
      </div>
    </div>`;
}

export function renderReward(run: RunState, options: string[], rerolled: boolean): string {
  return `
    ${topBar(run, run.hp)}
    <div class="stage short-stage" ${actBackdrop(run)}>
      <div class="stage-title">${iconImg('gear', 3)} 승리! 부품을 하나 고르세요</div>
    </div>
    <div class="reward-cards">${options
      .map((id) => {
        const favored = isFavored(run, id);
        return cardHtml(CARDS[id], { action: 'pick', extraClass: favored ? 'favored' : '', badge: favored ? '★ 어울림' : undefined });
      })
      .join('')}</div>
    <div class="center-row">
      <button class="btn reroll" data-action="reroll" ${rerolled ? 'disabled' : ''}>⟳ 재배치 ${rerolled ? '(사용함)' : '(1회)'}</button>
      <button class="btn dim" data-action="skip">건너뛰기</button>
    </div>`;
}

export function renderSelect(): string {
  const panels = CHARACTER_IDS.map((id) => {
    const c = CHARACTERS[id];
    // 기본 타격·방어를 뺀 대표 카드
    const signature = [...new Set(c.deck.filter((d) => d !== 'cog_strike' && d !== 'brass_guard'))].map((d) => CARDS[d].name);
    return `
      <div class="panel char-card" data-action="choose" data-char="${id}">
        <div class="char-sprite">${spriteImg(id, 3, 'bob')}</div>
        <h3>${c.name}</h3>
        <p class="char-title">${c.title}</p>
        <div class="char-stats">${iconImg('heart', 2)}${c.maxHp} <span class="arch arch-${c.archetype}">${ARCHETYPES[c.archetype].name} 덱</span></div>
        <div class="char-passive"><b>${c.passive.name}</b><br>${c.passive.text}</div>
        <div class="char-skill"><b>★ 필살기 · ${c.skill.name}</b><br>${c.skill.text}<br><small>전투 ${SKILL_RECHARGE}번마다 한 번</small></div>
        <p class="char-desc">${c.desc}</p>
        <div class="char-deck">${signature.map((n) => `<span>${n}</span>`).join('')}</div>
      </div>`;
  }).join('');
  return `
    <header class="topbar"><span class="tb-spacer"></span>${soundButtons()}</header>
    <div class="stage short-stage">
      <div class="stage-title">${iconImg('gear', 3)} 시계탑에 오를 사람을 고르세요</div>
    </div>
    <div class="char-grid">${panels}</div>
    <p class="hint center">선택한 캐릭터의 덱 유형에 어울리는 카드가 보상에 더 자주 나옵니다.</p>`;
}

export function renderActStart(run: RunState): string {
  const { act } = floorInAct(run);
  const [title, place] = ACTS[act].name.split(' — ');
  return `
    ${topBar(run, run.hp)}
    <div class="stage title-stage act-stage" ${actBackdrop(run)}>
      <div class="title-hero">${spriteImg(run.character, 4, 'bob')}</div>
      <div class="title-text">
        <p class="act-no">${act + 1}구역 · ${title}</p>
        <h1 class="logo">${place}</h1>
        <p class="tagline">${ACTS[act].desc}</p>
        <button class="btn big" data-action="enter-act">계단을 오른다 — 최대 체력 +${ACT_MAX_HP_BONUS}, 완전 회복</button>
      </div>
    </div>`;
}

export function renderRest(run: RunState, removing: boolean): string {
  const stage = `
    ${topBar(run, run.hp)}
    <div class="stage rest-stage ${removing ? 'short-stage' : ''}" ${actBackdrop(run)}>
      ${removing
        ? `<div class="stage-title">${iconImg('gear', 3)} 분해할 부품을 고르세요</div>`
        : `<div class="title-hero">${spriteImg(run.character, 3, 'bob')}</div>
      <div class="rest-boiler">${spriteImg('boiler', 4, 'puff')}</div>`}
    </div>`;
  if (removing) {
    // 같은 카드끼리 모아서 보여 준다
    const deck = [...run.deck].sort((a, b) => a.defId.localeCompare(b.defId) || a.uid - b.uid);
    return `${stage}
    <div class="deck-grid">${deck.map((c) => cardHtml(CARDS[c.defId], { uid: c.uid, action: 'remove' })).join('')}</div>
    <div class="center-row">
      <button class="btn dim" data-action="remove-back">돌아가기</button>
    </div>`;
  }
  const canRemove = canRemoveCard(run);
  return `${stage}
    <div class="panel center-panel">
      <h2>정비소</h2>
      <p>증기 배관 사이로 잠시 숨을 돌린다. 보일러의 온기가 기계 팔다리를 데운다.<br>둘 중 하나만 할 수 있다.</p>
      <div class="rest-choices">
        <button class="btn big" data-action="rest">정비하기 — 체력 ${Math.round(REST_HEAL_RATIO * 100)}% 회복</button>
        <button class="btn big" data-action="remove-menu" ${canRemove ? '' : 'disabled'}>분해하기 — 덱에서 카드 1장 제거</button>
      </div>
      ${canRemove ? '' : `<p class="hint">덱이 ${MIN_DECK_SIZE}장 이하라 더 분해할 수 없습니다.</p>`}
    </div>`;
}

export function renderEnd(run: RunState, won: boolean): string {
  return `
    <div class="stage title-stage">
      <div class="title-gear">${spriteImg(won ? 'bigGear' : 'warden', won ? 6 : 3, won ? 'spin' : '')}</div>
      <div class="title-hero">${spriteImg(run.character, 4, won ? 'bob' : 'fallen')}</div>
      <div class="title-text">
        <h1 class="logo ${won ? '' : 'lose'}">${won ? '시간이 다시 흐른다' : '태엽이 멈췄다'}</h1>
        <p class="tagline">${won ? '시계탑의 심장이 다시 뛰기 시작했다.' : `${floorInAct(run).act + 1}구역 ${floorInAct(run).index}층에서 쓰러졌다.`}<br>시드 ${run.seed} · 덱 ${run.deck.length}장</p>
        <button class="btn big" data-action="restart">다시 오르기</button>
      </div>
    </div>`;
}
