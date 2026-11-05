// ── 개발자 패널 ─────────────────────────────────────
// 개발 서버(또는 ?dev)에서만 실린다. ` 또는 F2로 연다.
// 게임 화면(#app) 바깥에 붙여서, 게임이 화면을 다시 그려도 패널은 그대로 남는다.

import { aliveEnemies, settleCombat } from '../core/combat';
import { addCard, currentNode, gainModule, runCharacter, skillRecharge, type RunState } from '../core/run';
import type { CombatEvent, CombatState, StatusId } from '../core/types';
import { ACTS } from '../data/acts';
import { canUpgradeCard, CARDS } from '../data/cards';
import { EVENT_IDS, EVENTS } from '../data/events';
import { MODULE_IDS, MODULES } from '../data/modules';
import { CHARACTER_IDS, CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { FX_KINDS, spawnFx, type FxKind } from '../ui/effects';
import { STATUS_INFO } from '../ui/render';
import { SFX_NAMES, sfx, unlock, type Sfx } from '../ui/sound';

export type DevGoto =
  | 'title' | 'select' | 'map' | 'reward' | 'rest' | 'shop' | 'event' | 'treasure' | 'actStart' | 'won' | 'lost'
  /** arg: 구역 번호(1~3) — 그 구역의 새 지도로 */
  | 'act'
  /** arg: 지도의 방 id — 길과 상관없이 바로 들어간다 */
  | 'node';

/** main.ts가 넘겨주는 게임 조작 창구 */
export interface DevApi {
  run(): RunState | null;
  combat(): CombatState | null;
  screenKind(): string;
  busy(): boolean;
  newRun(char: string, seed?: number): void;
  startCombat(enemyIds: string[]): void;
  goto(target: DevGoto, arg?: string | number): void;
  /** 연출이 재생되는 행동으로 실행 (상태를 바꾸고 이벤트를 쌓으면 그대로 재생된다) */
  act(fn: () => void): void;
  render(): void;
  /** 상태는 건드리지 않고 연출만 재생 */
  playEvents(events: CombatEvent[]): Promise<void>;
  hooks(afterAction: (combat: CombatState) => void, afterRender: () => void): void;
}

const cheats = { god: false, steam: false, noHeat: false, skill: false };
const STORE_KEY = 'overclock:dev';

const ui = {
  open: false,
  char: 'engineer',
  enemies: ['automaton'] as string[],
  cardFilter: '',
  fxTarget: 'enemy' as 'enemy' | 'player',
  sections: {} as Record<string, boolean>,
};

function load(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
    Object.assign(cheats, saved.cheats);
    Object.assign(ui, { ...saved.ui, open: saved.ui?.open ?? false });
  } catch {
    // 저장소를 못 쓰면 기본값
  }
}

function save(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ cheats, ui }));
  } catch {
    // 무시
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

let api: DevApi;
let panel: HTMLDivElement;
let toggleBtn: HTMLButtonElement;

export function installDevPanel(devApi: DevApi): void {
  api = devApi;
  load();
  toggleBtn = document.body.appendChild(document.createElement('button'));
  toggleBtn.className = 'dev-toggle';
  toggleBtn.textContent = 'DEV';
  toggleBtn.title = '개발자 패널 (` 또는 F2)';
  toggleBtn.addEventListener('click', () => setOpen(!ui.open));

  panel = document.body.appendChild(document.createElement('div'));
  panel.className = 'dev-panel';
  panel.addEventListener('click', onClick);
  panel.addEventListener('input', onInput);
  panel.addEventListener('change', onChange);
  panel.addEventListener('toggle', onToggle, true);

  window.addEventListener('keydown', (ev) => {
    if ((ev.target as HTMLElement).closest?.('input, select, textarea')) return;
    if (ev.key === '`' || ev.key === 'F2') {
      ev.preventDefault();
      setOpen(!ui.open);
    }
  });

  api.hooks(applyCheats, () => {
    // 입력 중인 칸이 지워지지 않게, 패널 안에 포커스가 있으면 다시 그리지 않는다
    if (ui.open && !panel.contains(document.activeElement)) renderPanel();
  });
  setOpen(ui.open);
}

function setOpen(open: boolean): void {
  ui.open = open;
  save();
  panel.hidden = !open;
  toggleBtn.classList.toggle('on', open);
  document.body.classList.toggle('dev-open', open);
  if (open) renderPanel();
}

/** 매 행동 뒤에 치트를 다시 건다 */
function applyCheats(c: CombatState): void {
  c.god = cheats.god;
  const p = c.player;
  if (cheats.god) p.hp = p.maxHp;
  if (cheats.steam) p.steam = Math.max(p.steam, p.maxSteam);
  if (cheats.noHeat) p.heat = 0;
  if (cheats.skill && c.skill) c.skillReady = true;
}

// ── 그리기 ──────────────────────────────────────────

function section(id: string, title: string, body: string): string {
  const open = ui.sections[id] ?? ['start', 'cheat', 'combat'].includes(id);
  return `<details data-sec="${id}" ${open ? 'open' : ''}><summary>${title}</summary><div class="dev-body">${body}</div></details>`;
}

const btn = (action: string, label: string, extra = '') => `<button data-dev="${action}" ${extra}>${label}</button>`;
const num = (id: string, value: number, w = 56) => `<input type="number" data-field="${id}" value="${value}" style="width:${w}px">`;

function renderPanel(): void {
  const run = api.run();
  const combat = api.combat();
  panel.innerHTML = `
    <div class="dev-head">
      <b>개발자 패널</b>
      <span class="dev-dim">${api.screenKind()}${run ? ` · ${run.act + 1}구역 ${(currentNode(run)?.row ?? -1) + 1}층 · seed ${run.seed}` : ''}</span>
      ${btn('close', '✕')}
    </div>
    ${section('start', '빠른 전투', startSection())}
    ${section('cheat', '치트', cheatSection())}
    ${combat ? section('combat', '전투 상태', combatSection(combat)) : ''}
    ${combat ? section('enemies', '적', enemySection(combat)) : ''}
    ${section('cards', '카드', `
      <input type="search" data-field="cardFilter" placeholder="카드 이름 / id 검색" value="${esc(ui.cardFilter)}">
      <div class="dev-cards">${cardList()}</div>`)}
    ${section('screens', '화면 · 지도 이동', screenSection(run))}
    ${section('fx', '연출 실험', fxSection())}
    ${run ? section('run', '런', runSection(run)) : ''}`;
}

function startSection(): string {
  const chars = CHARACTER_IDS.map((id) => `<option value="${id}" ${id === ui.char ? 'selected' : ''}>${CHARACTERS[id].name}</option>`).join('');
  const enemyOpts = Object.values(ENEMIES).map((e) => `<option value="${e.id}">${e.name} (${e.id})</option>`).join('');
  const presets = ACTS.flatMap((act, a) =>
    (['easy', 'normal', 'elite'] as const).flatMap((slot) => act[slot].map((g) => ({ label: `${a + 1}구역 ${slot}: ${g.join(', ')}`, g })))
      .concat([{ label: `${a + 1}구역 보스: ${act.boss.join(', ')}`, g: act.boss }]),
  ).map((p) => `<option value="${p.g.join(',')}">${p.label}</option>`).join('');
  const chips = ui.enemies.map((id, i) => `<span class="dev-chip" data-dev="enemy-remove" data-i="${i}" title="빼기">${ENEMIES[id]?.name ?? id} ✕</span>`).join('');
  return `
    <label>캐릭터 <select data-field="char">${chars}</select></label>
    <label>프리셋 <select data-field="preset"><option value="">— 구역 무리 고르기 —</option>${presets}</select></label>
    <div class="dev-row"><select data-field="enemyPick">${enemyOpts}</select>${btn('enemy-add', '+ 적 추가')}</div>
    <div class="dev-chips">${chips || '<span class="dev-dim">적을 추가하세요</span>'}</div>
    <div class="dev-row">
      ${btn('fight', '▶ 이 캐릭터로 새 런 + 전투', 'class="primary"')}
      ${btn('fight-keep', '▶ 지금 덱으로 전투')}
    </div>`;
}

function cheatSection(): string {
  const box = (id: keyof typeof cheats, label: string) =>
    `<label class="dev-check"><input type="checkbox" data-cheat="${id}" ${cheats[id] ? 'checked' : ''}> ${label}</label>`;
  return `
    ${box('god', '무적 (체력 항상 가득, 죽지 않음)')}
    ${box('steam', '무한 증기압')}
    ${box('noHeat', '과열 없음')}
    ${box('skill', '필살기 무제한')}
    <p class="dev-dim">치트는 다음 행동부터 적용됩니다.</p>`;
}

function combatSection(c: CombatState): string {
  const p = c.player;
  const statusOpts = (Object.keys(STATUS_INFO) as StatusId[]).map((s) => `<option value="${s}">${STATUS_INFO[s].name} (${s})</option>`).join('');
  const targets = [`<option value="player">플레이어</option>`, `<option value="all">모든 적</option>`]
    .concat(c.enemies.map((e) => `<option value="${e.uid}">${e.name} #${e.uid}</option>`)).join('');
  return `
    <div class="dev-grid">
      <label>체력 ${num('hp', p.hp)}</label><label>최대 ${num('maxHp', p.maxHp)}</label>
      <label>증기압 ${num('steam', p.steam)}</label><label>최대 ${num('maxSteam', p.maxSteam)}</label>
      <label>과열 ${num('heat', p.heat)}</label><label>한계 ${num('maxHeat', p.maxHeat)}</label>
      <label>방어도 ${num('block', p.block)}</label><label>회전 ${num('rotation', c.rotation)}</label>
    </div>
    ${btn('player-apply', '수치 적용', 'class="primary"')}
    <div class="dev-row">
      ${btn('draw', '카드 1장 드로우')}${btn('draw5', '5장 드로우')}${btn('discard-hand', '손패 버리기')}
    </div>
    <div class="dev-row">
      ${btn('skill-ready', `필살기 충전 ${c.skillReady ? '✓' : ''}`)}${btn('heal-full', '체력 회복')}
    </div>
    <hr>
    <div class="dev-row"><select data-field="status">${statusOpts}</select>${num('statusAmt', 3, 48)}</div>
    <div class="dev-row"><select data-field="statusTarget">${targets}</select>${btn('status-add', '상태 부여')}${btn('status-clear', '모두 제거')}</div>`;
}

function enemySection(c: CombatState): string {
  const rows = c.enemies.map((e) => {
    const def = ENEMIES[e.defId];
    const moves = def.moves.map((m, i) => `<option value="${i}" ${m.id === e.nextMoveId ? 'selected' : ''}>${m.name}</option>`).join('');
    return `
      <div class="dev-enemy ${e.hp <= 0 ? 'dead' : ''}">
        <b>${e.name} #${e.uid}</b>
        <div class="dev-row">체력 ${num(`ehp-${e.uid}`, e.hp)}/${num(`emax-${e.uid}`, e.maxHp)} 방어 ${num(`eblock-${e.uid}`, e.block, 44)}</div>
        <div class="dev-row">
          ${btn('enemy-apply', '적용', `data-uid="${e.uid}"`)}
          ${btn('enemy-hit', '10 피해', `data-uid="${e.uid}"`)}
          ${btn('enemy-kill', '처치', `data-uid="${e.uid}"`)}
          ${btn('enemy-stun', '기절', `data-uid="${e.uid}"`)}
        </div>
        <label>다음 행동 <select data-field="move-${e.uid}" data-uid="${e.uid}">${moves}</select></label>
      </div>`;
  }).join('');
  return `${rows}<div class="dev-row">${btn('win', '모두 처치 (승리)', 'class="primary"')}${btn('lose', '패배')}</div>`;
}

function cardList(): string {
  const q = ui.cardFilter.trim().toLowerCase();
  const list = Object.values(CARDS).filter((c) => !q || c.name.toLowerCase().includes(q) || c.id.includes(q));
  const inCombat = !!api.combat();
  return list.map((c) => `
    <div class="dev-card fam-${c.family ?? 'none'}" title="${esc(c.text)}">
      <span class="dev-cost">${c.cost ?? '-'}</span>
      <span class="dev-card-name">${c.name}<small>${c.id} · ${c.rarity}</small></span>
      ${inCombat ? btn('card-hand', '손', `data-card="${c.id}"`) : ''}
      ${btn('card-deck', '덱', `data-card="${c.id}"`)}
    </div>`).join('') || '<p class="dev-dim">없음</p>';
}

const ROOM_NAME: Record<string, string> = { combat: '전투', elite: '정예', rest: '정비소', shop: '상점', event: '사건', treasure: '보물', boss: '보스' };

function screenSection(run: RunState | null): string {
  const nodes = run?.map.map((n) =>
    `<option value="${n.id}" ${n.id === run.node ? 'selected' : ''}>${n.row + 1}층 · ${ROOM_NAME[n.kind]} (#${n.id})</option>`).join('') ?? '';
  const events = EVENT_IDS.map((id) => `<option value="${id}">${EVENTS[id].name}</option>`).join('');
  return `
    <div class="dev-row">${btn('go-title', '타이틀')}${btn('go-select', '캐릭터 선택')}${btn('go-map', '지도')}${btn('go-actStart', '구역 입구')}</div>
    <div class="dev-row">${btn('go-rest', '정비소')}${btn('go-shop', '상점')}${btn('go-treasure', '보물')}</div>
    <div class="dev-row">${btn('go-reward-normal', '보상(일반)')}${btn('go-reward-elite', '보상(정예)')}${btn('go-reward-boss', '보상(보스)')}</div>
    <div class="dev-row">${btn('go-won', '엔딩: 승리')}${btn('go-lost', '엔딩: 패배')}</div>
    <div class="dev-row"><select data-field="event">${events}</select>${btn('go-event', '이 사건으로')}</div>
    <div class="dev-row">${btn('go-act-1', '1구역 새 지도')}${btn('go-act-2', '2구역 새 지도')}${btn('go-act-3', '3구역 새 지도')}</div>
    ${run ? `<label>방 이동 <select data-field="node">${nodes}</select></label>${btn('go-node', '이 방으로 (길 무시)')}` : '<p class="dev-dim">런을 시작하면 방 이동을 쓸 수 있습니다.</p>'}`;
}

function fxSection(): string {
  const skills = CHARACTER_IDS.map((id) => btn('cutin', CHARACTERS[id].skill.name, `data-skill="${CHARACTERS[id].skill.id}"`)).join('');
  return `
    <label>대상 <select data-field="fxTarget">
      <option value="enemy" ${ui.fxTarget === 'enemy' ? 'selected' : ''}>첫 번째 적</option>
      <option value="player" ${ui.fxTarget === 'player' ? 'selected' : ''}>플레이어</option>
    </select></label>
    <p class="dev-dim">이펙트 (전투 화면에서)</p>
    <div class="dev-wrap">${FX_KINDS.map((k) => btn('fx', k, `data-fx="${k}"`)).join('')}</div>
    <p class="dev-dim">타격 숫자 · 연출 (상태는 바뀌지 않음)</p>
    <div class="dev-wrap">${btn('fake-hit', '피해 5', 'data-dmg="5"')}${btn('fake-hit', '피해 20', 'data-dmg="20"')}${btn('fake-hit', '치명 45', 'data-dmg="45"')}${btn('fake-break', '고장')}</div>
    <p class="dev-dim">필살기 컷인 (연출만)</p>
    <div class="dev-wrap">${skills}</div>
    <p class="dev-dim">효과음</p>
    <div class="dev-wrap">${SFX_NAMES.map((n) => btn('sfx', n, `data-sfx="${n}"`)).join('')}</div>`;
}

function runSection(run: RunState): string {
  const ch = runCharacter(run);
  const node = currentNode(run);
  const free = MODULE_IDS.filter((id) => !run.modules.includes(id));
  return `
    <p>${ch.name} · 덱 ${run.deck.length}장 · ${node ? ROOM_NAME[node.kind] : '구역 입구'}</p>
    <div class="dev-grid">
      <label>체력 ${num('runHp', run.hp)}</label><label>최대 ${num('runMaxHp', run.maxHp)}</label>
      <label>주화 ${num('gold', run.gold)}</label>
      <label>필살기 충전 ${num('skillCharge', run.skillCharge, 44)}/${skillRecharge(run)}</label>
    </div>
    ${btn('run-apply', '런 수치 적용', 'class="primary"')}
    <p class="dev-dim">모듈</p>
    <div class="dev-row"><select data-field="module">${free.map((id) => `<option value="${id}">${MODULES[id].name} — ${MODULES[id].text}</option>`).join('')}</select>${btn('module-add', '+ 모듈')}</div>
    <div class="dev-chips">${run.modules.map((id) => `<span class="dev-chip" data-dev="module-remove" data-id="${id}" title="${esc(MODULES[id]?.text ?? '')} — 클릭해서 빼기">${MODULES[id]?.name ?? id} ✕</span>`).join('') || '<span class="dev-dim">없음</span>'}</div>
    <p class="dev-dim">덱 — 클릭: 빼기 · ⬆: 강화</p>
    <div class="dev-row">${btn('upgrade-all', '덱 전체 강화')}</div>
    <div class="dev-deck">${run.deck.map((c) => `<span class="dev-chip"><span data-dev="deck-remove" data-uid="${c.uid}" title="덱에서 빼기">${CARDS[c.defId]?.name ?? c.defId} ✕</span>${canUpgradeCard(c.defId) ? ` <span data-dev="deck-upgrade" data-uid="${c.uid}" title="강화">⬆</span>` : ''}</span>`).join('')}</div>`;
}

// ── 입력 처리 ───────────────────────────────────────

const field = (id: string) => panel.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${id}"]`);
const fieldNum = (id: string, fallback = 0) => {
  const v = Number(field(id)?.value);
  return Number.isFinite(v) ? v : fallback;
};

function onToggle(ev: Event): void {
  const el = ev.target as HTMLDetailsElement;
  if (el.dataset?.sec) {
    ui.sections[el.dataset.sec] = el.open;
    save();
  }
}

function onInput(ev: Event): void {
  const el = ev.target as HTMLInputElement;
  if (el.dataset.field === 'cardFilter') {
    ui.cardFilter = el.value;
    panel.querySelector('.dev-cards')!.innerHTML = cardList();
  }
}

function onChange(ev: Event): void {
  const el = ev.target as HTMLInputElement;
  if (el.dataset.cheat) {
    cheats[el.dataset.cheat as keyof typeof cheats] = el.checked;
    save();
    const c = api.combat();
    if (c) api.act(() => applyCheats(c));
    return;
  }
  const f = el.dataset.field;
  if (f === 'char') ui.char = el.value;
  else if (f === 'fxTarget') ui.fxTarget = el.value as 'enemy' | 'player';
  else if (f === 'preset' && el.value) ui.enemies = el.value.split(',');
  else if (f?.startsWith('move-')) {
    const c = api.combat();
    const enemy = c?.enemies.find((e) => e.uid === Number(el.dataset.uid));
    if (c && enemy) {
      enemy.moveIndex = Number(el.value);
      enemy.nextMoveId = ENEMIES[enemy.defId].moves[enemy.moveIndex].id;
      (document.activeElement as HTMLElement | null)?.blur();
      api.render();
      return;
    }
  } else return;
  save();
  renderPanel();
}

function onClick(ev: MouseEvent): void {
  unlock();
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-dev]');
  if (!el) return;
  const action = el.dataset.dev!;
  const run = api.run();
  const c = api.combat();
  const uid = Number(el.dataset.uid);
  const enemy = c?.enemies.find((e) => e.uid === uid);
  // 버튼을 누른 뒤엔 포커스를 풀어 게임이 다시 그려질 때 패널도 갱신되게 한다
  (document.activeElement as HTMLElement | null)?.blur();

  switch (action) {
    case 'close': return setOpen(false);
    case 'enemy-add': {
      const pick = field('enemyPick')?.value;
      if (pick && ui.enemies.length < 5) ui.enemies.push(pick);
      break;
    }
    case 'enemy-remove': ui.enemies.splice(Number(el.dataset.i), 1); break;
    case 'fight':
      if (!ui.enemies.length) return;
      api.newRun(ui.char);
      api.startCombat([...ui.enemies]);
      break;
    case 'fight-keep':
      if (!ui.enemies.length) return;
      if (!run) api.newRun(ui.char);
      api.startCombat([...ui.enemies]);
      break;

    case 'player-apply':
      if (!c) return;
      api.act(() => {
        const p = c.player;
        p.maxHp = Math.max(1, fieldNum('maxHp', p.maxHp));
        p.hp = Math.max(1, Math.min(p.maxHp, fieldNum('hp', p.hp)));
        p.maxSteam = Math.max(0, fieldNum('maxSteam', p.maxSteam));
        p.steam = Math.max(0, fieldNum('steam', p.steam));
        p.maxHeat = Math.max(1, fieldNum('maxHeat', p.maxHeat));
        p.heat = Math.max(0, Math.min(p.maxHeat - 1, fieldNum('heat', p.heat)));
        p.block = Math.max(0, fieldNum('block', p.block));
        c.rotation = Math.max(0, fieldNum('rotation', c.rotation));
      });
      break;
    case 'draw':
    case 'draw5':
      if (!c) return;
      api.act(() => {
        for (let i = 0; i < (action === 'draw5' ? 5 : 1); i++) {
          if (c.drawPile.length === 0) {
            c.drawPile = c.rng.shuffle(c.discardPile);
            c.discardPile = [];
          }
          const card = c.drawPile.pop();
          if (card) c.hand.push(card);
        }
      });
      break;
    case 'discard-hand':
      if (!c) return;
      api.act(() => {
        c.discardPile.push(...c.hand);
        c.hand = [];
      });
      break;
    case 'skill-ready':
      if (!c) return;
      api.act(() => (c.skillReady = !!c.skill));
      break;
    case 'heal-full':
      if (!c) return;
      api.act(() => {
        const amount = c.player.maxHp - c.player.hp;
        c.player.hp = c.player.maxHp;
        if (amount > 0) c.events.push({ kind: 'heal', target: 'player', amount, hp: c.player.hp });
      });
      break;
    case 'status-add': {
      if (!c) return;
      const status = field('status')!.value as StatusId;
      const amount = fieldNum('statusAmt', 1);
      const target = field('statusTarget')!.value;
      api.act(() => {
        const units = target === 'player' ? [['player', c.player] as const]
          : target === 'all' ? aliveEnemies(c).map((e) => [e.uid, e] as const)
          : c.enemies.filter((e) => e.uid === Number(target)).map((e) => [e.uid, e] as const);
        for (const [ref, unit] of units) {
          unit.statuses[status] = (unit.statuses[status] ?? 0) + amount;
          if (unit.statuses[status]! <= 0) delete unit.statuses[status];
          c.events.push({ kind: 'status', target: ref, status, amount });
        }
      });
      break;
    }
    case 'status-clear': {
      if (!c) return;
      const target = field('statusTarget')!.value;
      api.act(() => {
        if (target === 'player') c.player.statuses = {};
        else for (const e of c.enemies) if (target === 'all' || e.uid === Number(target)) e.statuses = {};
      });
      break;
    }

    case 'enemy-apply':
      if (!c || !enemy) return;
      api.act(() => {
        enemy.maxHp = Math.max(1, fieldNum(`emax-${uid}`, enemy.maxHp));
        enemy.hp = Math.max(0, Math.min(enemy.maxHp, fieldNum(`ehp-${uid}`, enemy.hp)));
        enemy.block = Math.max(0, fieldNum(`eblock-${uid}`, enemy.block));
        finishIfDone(c);
      });
      break;
    case 'enemy-hit':
    case 'enemy-kill':
      if (!c || !enemy || enemy.hp <= 0) return;
      api.act(() => {
        const damage = action === 'enemy-kill' ? enemy.hp : Math.min(10, enemy.hp);
        enemy.hp -= damage;
        c.events.push({ kind: 'hit', source: 'player', target: enemy.uid, damage, blocked: 0, hp: enemy.hp });
        finishIfDone(c);
      });
      break;
    case 'enemy-stun':
      if (!c || !enemy) return;
      api.act(() => {
        enemy.statuses.stun = (enemy.statuses.stun ?? 0) + 1;
        c.events.push({ kind: 'status', target: enemy.uid, status: 'stun', amount: 1 });
      });
      break;
    case 'win':
      if (!c) return;
      api.act(() => {
        for (const e of aliveEnemies(c)) {
          c.events.push({ kind: 'hit', source: 'player', target: e.uid, damage: e.hp, blocked: 0, hp: 0 });
          e.hp = 0;
        }
        c.outcome = 'won';
      });
      break;
    case 'lose':
      if (!c) return;
      api.act(() => {
        c.player.hp = 0;
        c.outcome = 'lost';
      });
      break;

    case 'card-hand':
      if (!c) return;
      api.act(() => c.hand.push({ uid: c.nextCardUid++, defId: el.dataset.card! }));
      break;
    case 'card-deck':
      if (!run) api.newRun(ui.char);
      addCard(api.run()!, el.dataset.card!);
      sfx('reward');
      api.render();
      break;
    case 'deck-remove':
      if (!run) return;
      run.deck = run.deck.filter((card) => card.uid !== uid);
      api.render();
      break;

    case 'go-node': return api.goto('node', fieldNum('node'));
    case 'go-event': return api.goto('event', field('event')?.value);
    case 'go-act-1': case 'go-act-2': case 'go-act-3': return api.goto('act', Number(action.slice(-1)));
    case 'go-reward-normal': return api.goto('reward', 'normal');
    case 'go-reward-elite': return api.goto('reward', 'elite');
    case 'go-reward-boss': return api.goto('reward', 'boss');
    case 'go-title': case 'go-select': case 'go-actStart': case 'go-rest': case 'go-won': case 'go-lost':
    case 'go-map': case 'go-shop': case 'go-treasure':
      return api.goto(action.slice(3) as DevGoto);

    case 'fx': {
      const host = fxHost();
      if (host) spawnFx(host, el.dataset.fx as FxKind, 4);
      break;
    }
    case 'fake-hit': {
      if (!c) return;
      const damage = Number(el.dataset.dmg);
      const target = ui.fxTarget === 'player' ? 'player' : aliveEnemies(c)[0]?.uid;
      if (target === undefined) return;
      const hp = target === 'player' ? c.player.hp : c.enemies.find((e) => e.uid === target)!.hp;
      void api.playEvents([{ kind: 'hit', source: target === 'player' ? 0 : 'player', target, damage, blocked: 0, hp }]);
      break;
    }
    case 'fake-break':
      if (!c) return;
      void api.playEvents([{ kind: 'breakdown', damage: 0, hp: c.player.hp }]);
      break;
    case 'cutin':
      if (!c) return;
      void api.playEvents([{ kind: 'skill', skillId: el.dataset.skill! }]);
      break;
    case 'sfx': sfx(el.dataset.sfx as Sfx); break;

    case 'run-apply':
      if (!run) return;
      run.maxHp = Math.max(1, fieldNum('runMaxHp', run.maxHp));
      run.hp = Math.max(1, Math.min(run.maxHp, fieldNum('runHp', run.hp)));
      run.skillCharge = Math.max(0, Math.min(skillRecharge(run), fieldNum('skillCharge', run.skillCharge)));
      run.gold = Math.max(0, fieldNum('gold', run.gold));
      api.render();
      break;
    case 'module-add': {
      const id = field('module')?.value;
      if (!run || !id) return;
      gainModule(run, id);
      sfx('reward');
      api.render();
      break;
    }
    case 'module-remove':
      if (!run) return;
      run.modules = run.modules.filter((id) => id !== el.dataset.id);
      api.render();
      break;
    case 'deck-upgrade':
    case 'upgrade-all':
      if (!run) return;
      for (const card of run.deck)
        if ((action === 'upgrade-all' || card.uid === uid) && canUpgradeCard(card.defId)) card.defId = `${card.defId}+`;
      sfx('reward');
      api.render();
      break;
  }
  save();
  renderPanel();
}

/** 적 체력을 직접 깎았을 때 승패를 확정한다 */
/** 기믹(분열 · 되감기)까지 반영해 승패를 정한다 */
function finishIfDone(c: CombatState): void {
  settleCombat(c);
}

function fxHost(): HTMLElement | null {
  const sel = ui.fxTarget === 'player' ? '[data-player] .sprite-wrap' : '.unit.enemy:not(.dead) .sprite-wrap';
  return document.querySelector<HTMLElement>(sel);
}

// 브라우저 콘솔에서 window.__dev.combat() 처럼 상태를 직접 들여다볼 수 있게 노출
Object.assign(window, { __dev: { run: () => api.run(), combat: () => api.combat(), cheats } });
