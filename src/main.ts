import 'galmuri/dist/galmuri.css';
import './style.css';
import { aliveEnemies, cardDef, endTurn, needsTarget, playCard, useSkill } from './core/combat';
import {
  advanceAct, buyShopItem, chooseEvent, claimCombatSpoils, createRun, createShop, currentNode, enterAct, isFinalAct, moveTo,
  openTreasure, removeCard, rest, rewardChoiceCount, rollCardRewards, rollEvent, ROOM_TIER, settleSkill, shopRemove,
  startCustomCombat, startRoomCombat, upgradeCard, addCard,
  type CombatSpoils, type CombatTier, type EventResult, type RunState, type ShopStock,
} from './core/run';
import { clearSave, loadGame, saveGame } from './core/save';
import { CARDS } from './data/cards';
import type { CombatEvent, CombatState, UnitRef } from './core/types';
import type { DevApi } from './dev/panel';
import { playEvents, preloadFx, type UnitSnapshot } from './ui/effects';
import {
  renderActStart, renderCombat, renderDeckPick, renderEnd, renderEvent, renderMap, renderPileOverlay, renderRest, renderReward,
  renderSelect, renderShop, renderTitle, renderTreasure,
  type PileKind, type RestMode,
} from './ui/render';
import { playMusic, setVolume, sfx, toggle, unlock, type MusicId } from './ui/sound';
import { installCardFrames } from './ui/card-frame';
import { installFrames } from './ui/sprites';
import { hideTooltip, installTooltips } from './ui/tooltip';

type Screen =
  | { kind: 'title' }
  | { kind: 'select' }
  | { kind: 'map' }
  | { kind: 'combat'; combat: CombatState }
  | { kind: 'reward'; options: string[]; tier: CombatTier; rerolled: boolean; spoils: CombatSpoils }
  | { kind: 'rest'; mode: RestMode }
  /** removing: 분해 서비스로 카드를 고르는 중 */
  | { kind: 'shop'; shop: ShopStock; removing: boolean }
  /** picking: 선택 결과로 덱에서 카드를 고르는 중 */
  | { kind: 'event'; id: string; result: EventResult | null; picking: 'upgrade' | 'remove' | null }
  | { kind: 'treasure'; loot: { module: string | null; gold: number } }
  | { kind: 'actStart' }
  | { kind: 'end'; won: boolean };

const root = document.querySelector<HTMLDivElement>('#app')!;
let run: RunState | null = null;
let screen: Screen = { kind: 'title' };
let selectedUid: number | null = null;
/** 필살기 대상을 고르는 중 */
let skillTargeting = false;
/** 이벤트 연출 중에는 입력을 받지 않는다 */
let busy = false;
let dying = new Set<number>();
let fresh = new Set<number>();
/** 펼쳐 보고 있는 카드 더미 */
let overlay: PileKind | null = null;

function pileCards(pile: PileKind): string[] {
  if (pile === 'deck') return run?.deck.map((c) => c.defId) ?? [];
  if (screen.kind !== 'combat') return [];
  const c = screen.combat;
  return (pile === 'draw' ? c.drawPile : pile === 'discard' ? c.discardPile : c.exhaustPile).map((card) => card.defId);
}

/** 화면에 맞는 배경음 */
function screenMusic(): MusicId {
  if (screen.kind === 'title' || screen.kind === 'select' || screen.kind === 'end') return 'title';
  if (screen.kind === 'rest' || screen.kind === 'actStart' || screen.kind === 'shop' || screen.kind === 'treasure') return 'rest';
  if (screen.kind === 'combat' && run && currentNode(run)?.kind === 'boss') return 'boss';
  return (['act0', 'act1', 'act2'] as const)[Math.min(2, run?.act ?? 0)];
}

/** 개발자 패널이 걸어 두는 훅 — 행동 직후(치트 적용)와 화면을 그린 뒤(패널 갱신) */
let devAfterAction: ((combat: CombatState) => void) | null = null;
let devAfterRender: (() => void) | null = null;

function render(): void {
  hideTooltip();
  renderScreen();
  if (overlay) root.insertAdjacentHTML('beforeend', renderPileOverlay(overlay, pileCards(overlay)));
  if (screen.kind === 'map') scrollMap();
  playMusic(screenMusic());
  persist();
  devAfterRender?.();
}

/** 화면이 바뀔 때마다 자동 저장. 런이 끝나면 저장을 지운다 */
function persist(): void {
  if (!run) return;
  if (screen.kind === 'end') clearSave();
  else if (screen.kind !== 'title' && screen.kind !== 'select') saveGame(run, screen);
}

/** 지도를 지금 위치(없으면 갈 수 있는 방)가 보이게 스크롤한다 */
function scrollMap(): void {
  const box = root.querySelector<HTMLElement>('[data-map-scroll]');
  const focus = root.querySelector<HTMLElement>('.map-node.current') ?? root.querySelector<HTMLElement>('.map-node.reachable');
  if (box && focus) box.scrollTop = focus.offsetTop - box.clientHeight * 0.55;
}

function saveSummary() {
  const data = loadGame<Screen>();
  if (!data) return null;
  const { run: r } = data;
  return { char: r.character, act: r.act, floor: r.node === null ? 0 : r.map[r.node].row + 1, hp: r.hp, maxHp: r.maxHp };
}

/** 저장된 런을 불러온다. 전투가 끝난 직후에 저장됐다면 결과 처리부터 한다 */
function continueRun(): void {
  const data = loadGame<Screen>();
  if (!data) {
    screen = { kind: 'title' };
    return;
  }
  run = data.run;
  screen = data.screen;
  selectedUid = null;
  skillTargeting = false;
  overlay = null;
  if (screen.kind === 'combat') {
    // 런과 전투는 같은 난수 생성기를 쓴다
    screen.combat.rng = run.rng;
    screen.combat.events = [];
    if (screen.combat.outcome !== 'ongoing') afterCombatAction(screen.combat);
  }
}

function renderScreen(): void {
  switch (screen.kind) {
    case 'title':
      root.innerHTML = renderTitle(saveSummary());
      return;
    case 'map':
      root.innerHTML = renderMap(run!);
      return;
    case 'shop':
      root.innerHTML = renderShop(run!, screen.shop, screen.removing);
      return;
    case 'event':
      root.innerHTML = screen.picking ? renderDeckPick(run!, screen.picking, null) : renderEvent(run!, screen);
      return;
    case 'treasure':
      root.innerHTML = renderTreasure(run!, screen.loot);
      return;
    case 'select':
      root.innerHTML = renderSelect();
      return;
    case 'combat':
      root.innerHTML = renderCombat(run!, screen.combat, selectedUid, skillTargeting, dying, fresh);
      return;
    case 'reward':
      root.innerHTML = renderReward(run!, screen.options, screen.rerolled, screen.spoils);
      return;
    case 'actStart':
      root.innerHTML = renderActStart(run!);
      return;
    case 'rest':
      root.innerHTML = renderRest(run!, screen.mode);
      return;
    case 'end':
      root.innerHTML = renderEnd(run!, screen.won);
      return;
  }
}

/** 지도에서 고른 방으로 들어간다 */
function enterRoom(nodeId: number, force = false): void {
  if (!run) return;
  if (force && run.map[nodeId]) {
    run.node = nodeId;
    run.visited.push(nodeId);
  }
  const node = force ? run.map[nodeId] : moveTo(run, nodeId);
  if (!node) return;
  switch (node.kind) {
    case 'combat':
    case 'elite':
    case 'boss':
      screen = { kind: 'combat', combat: startRoomCombat(run) };
      return;
    case 'rest':
      screen = { kind: 'rest', mode: 'menu' };
      return;
    case 'shop':
      screen = { kind: 'shop', shop: createShop(run), removing: false };
      return;
    case 'event':
      screen = { kind: 'event', id: rollEvent(run), result: null, picking: null };
      return;
    case 'treasure':
      sfx('reward');
      screen = { kind: 'treasure', loot: openTreasure(run) };
      return;
  }
}

/** 방을 마치고 지도로. 보스 방이었다면 다음 구역 입구로 */
function leaveRoom(): void {
  if (!run) return;
  overlay = null;
  if (currentNode(run)?.kind === 'boss') {
    advanceAct(run);
    screen = { kind: 'actStart' };
  } else screen = { kind: 'map' };
}

function afterCombatAction(combat: CombatState): void {
  if (combat.outcome === 'ongoing' || !run) return;
  skillTargeting = false;
  run.hp = combat.player.hp;
  settleSkill(run, combat);
  selectedUid = null;
  overlay = null;
  const node = currentNode(run);
  if (combat.outcome === 'lost') {
    sfx('defeat');
    screen = { kind: 'end', won: false };
  } else if (node?.kind === 'boss' && isFinalAct(run)) {
    sfx('victory');
    screen = { kind: 'end', won: true };
  } else {
    sfx('victory');
    const tier = (node && ROOM_TIER[node.kind]) ?? 'normal';
    const spoils = claimCombatSpoils(run, tier);
    screen = { kind: 'reward', options: rollCardRewards(run, tier, rewardChoiceCount(run)), tier, rerolled: false, spoils };
  }
}

/** 덱에서 카드를 골랐을 때 — 정비소 · 상점 · 사건 중 어디서 골랐는지에 따라 */
function onPickCard(uid: number): void {
  if (!run) return;
  if (screen.kind === 'rest' && screen.mode !== 'menu') {
    const ok = screen.mode === 'upgrade' ? upgradeCard(run, uid) : removeCard(run, uid);
    if (!ok) return;
    sfx(screen.mode === 'upgrade' ? 'reward' : 'remove');
    leaveRoom();
  } else if (screen.kind === 'shop' && screen.removing) {
    if (!shopRemove(run, screen.shop, uid)) return;
    sfx('remove');
    screen = { ...screen, removing: false };
  } else if (screen.kind === 'event' && screen.picking && screen.result) {
    const before = run.deck.find((c) => c.uid === uid)?.defId;
    const ok = screen.picking === 'upgrade' ? upgradeCard(run, uid) : removeCard(run, uid);
    if (!ok || !before) return;
    sfx(screen.picking === 'upgrade' ? 'reward' : 'remove');
    const line = screen.picking === 'upgrade' ? `강화: ${CARDS[`${before}+`].name}` : `제거: ${CARDS[before].name}`;
    screen = { ...screen, picking: null, result: { ...screen.result, lines: [...screen.result.lines, line] } };
  }
}

function onCardClick(combat: CombatState, uid: number): void {
  const card = combat.hand.find((c) => c.uid === uid);
  if (!card) return;
  const def = cardDef(card);
  if (def.cost === null) return;
  skillTargeting = false;
  if (needsTarget(def) && aliveEnemies(combat).length > 1) {
    selectedUid = selectedUid === uid ? null : uid;
    return;
  }
  selectedUid = null;
  playCard(combat, uid);
}

function handle(action: string, data: DOMStringMap): void {
  switch (action) {
    case 'view-pile':
      overlay = data.pile as PileKind;
      sfx('click');
      return;
    case 'close-overlay':
      overlay = null;
      return;
    case 'toggle-sfx':
    case 'toggle-music':
      toggle(action === 'toggle-sfx' ? 'sfx' : 'music');
      return;
    case 'start':
    case 'restart':
      screen = { kind: 'select' };
      return;
    case 'continue':
      continueRun();
      return;
    case 'choose':
      run = createRun(Date.now() % 1_000_000, data.char);
      screen = { kind: 'map' };
      return;
    case 'go-node':
      sfx('cardGear');
      enterRoom(Number(data.node));
      return;
    case 'leave':
      leaveRoom();
      return;
    case 'play':
      if (screen.kind === 'combat') onCardClick(screen.combat, Number(data.uid));
      break;
    case 'skill': {
      if (screen.kind !== 'combat' || !screen.combat.skillReady || !screen.combat.skill) return;
      selectedUid = null;
      if (needsTarget(screen.combat.skill) && aliveEnemies(screen.combat).length > 1) skillTargeting = !skillTargeting;
      else useSkill(screen.combat);
      break;
    }
    case 'target':
      if (screen.kind === 'combat' && skillTargeting) {
        skillTargeting = false;
        useSkill(screen.combat, Number(data.uid));
      } else if (screen.kind === 'combat' && selectedUid !== null) {
        playCard(screen.combat, selectedUid, Number(data.uid));
        selectedUid = null;
      }
      break;
    case 'end-turn':
      if (screen.kind === 'combat') {
        selectedUid = null;
        skillTargeting = false;
        endTurn(screen.combat);
      }
      break;
    case 'pick':
      if (screen.kind !== 'reward') return;
      sfx('reward');
      addCard(run!, data.card!);
      leaveRoom();
      return;
    case 'skip':
      if (screen.kind === 'reward') leaveRoom();
      return;
    case 'reroll':
      sfx('cardGear');
      // 보상 화면마다 한 번, 지금 보이는 카드는 빼고 다시 뽑는다
      if (screen.kind === 'reward' && !screen.rerolled)
        screen = { ...screen, options: rollCardRewards(run!, screen.tier, screen.options.length, screen.options), rerolled: true };
      return;
    case 'enter-act':
      enterAct(run!);
      screen = { kind: 'map' };
      return;
    case 'rest':
      sfx('rest');
      rest(run!);
      leaveRoom();
      return;
    case 'rest-upgrade':
    case 'rest-remove':
    case 'rest-back':
      if (screen.kind === 'rest')
        screen = { kind: 'rest', mode: action === 'rest-upgrade' ? 'upgrade' : action === 'rest-remove' ? 'remove' : 'menu' };
      return;
    case 'pick-card':
      onPickCard(Number(data.uid));
      return;
    case 'buy-card':
    case 'buy-module': {
      if (screen.kind !== 'shop') return;
      const list = action === 'buy-card' ? screen.shop.cards : screen.shop.modules;
      const item = list[Number(data.index)];
      if (item && buyShopItem(run!, item, action === 'buy-card' ? 'card' : 'module')) sfx('reward');
      return;
    }
    case 'shop-remove':
    case 'shop-back':
      if (screen.kind === 'shop') screen = { ...screen, removing: action === 'shop-remove' };
      return;
    case 'event-choice': {
      if (screen.kind !== 'event' || screen.result) return;
      const result = chooseEvent(run!, screen.id, Number(data.index));
      if (!result) return;
      sfx('reward');
      screen = { ...screen, result, picking: result.pick ?? null };
      return;
    }
  }
}

// ── 타격 연출 ──

function snapshot(): Map<UnitRef, UnitSnapshot> {
  const snap = new Map<UnitRef, UnitSnapshot>();
  if (screen.kind !== 'combat') return snap;
  const { player, enemies } = screen.combat;
  snap.set('player', { hp: player.hp, maxHp: player.maxHp, block: player.block });
  for (const e of enemies) snap.set(e.uid, { hp: e.hp, maxHp: e.maxHp, block: e.block });
  return snap;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function act(action: () => void): Promise<void> {
  if (busy) return;
  const before = snapshot();
  const handBefore = new Set(screen.kind === 'combat' ? screen.combat.hand.map((c) => c.uid) : []);
  const turnBefore = screen.kind === 'combat' ? screen.combat.turn : -1;
  action();
  if (screen.kind !== 'combat') {
    render();
    return;
  }
  const combat = screen.combat;
  devAfterAction?.(combat);
  const events = combat.events;
  combat.events = [];
  dying = new Set(combat.enemies.filter((e) => e.hp <= 0 && (before.get(e.uid)?.hp ?? 0) > 0).map((e) => e.uid));
  fresh = new Set(combat.hand.filter((c) => !handBefore.has(c.uid)).map((c) => c.uid));
  render();
  busy = true;
  try {
    await playEvents(root, events, before);
    if (combat.outcome === 'ongoing') {
      if (combat.turn !== turnBefore) sfx('turn');
      else if (fresh.size > 0) sfx('draw');
    }
    fresh = new Set();
    root.querySelectorAll('.unit.dying').forEach((el) => el.classList.add('gone'));
    dying = new Set();
    if (combat.outcome !== 'ongoing') {
      await wait(800);
      afterCombatAction(combat);
      render();
    }
  } finally {
    busy = false;
  }
}

root.addEventListener('click', (ev) => {
  unlock();
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el) return;
  // 창 안쪽을 누르면 닫히지 않게 — 바깥 배경과 닫기 버튼만 닫는다
  if (el.dataset.action === 'close-overlay' && el.classList.contains('overlay') && ev.target !== el) return;
  if (el.tagName === 'BUTTON' && el.dataset.action !== 'view-pile') sfx('click');
  void act(() => handle(el.dataset.action!, el.dataset));
});

// 음량 슬라이더 — 끌어도 화면을 다시 그리지 않고 소리만 바꾼다 (다시 그리면 드래그가 끊긴다)
root.addEventListener('input', (ev) => {
  const el = ev.target as HTMLInputElement;
  const kind = el.dataset.volume as 'sfx' | 'music' | undefined;
  if (!kind) return;
  unlock();
  setVolume(kind, Number(el.value) / 100);
  el.parentElement?.querySelector('.sound-btn')?.classList.remove('off');
});
root.addEventListener('change', (ev) => {
  // 효과음은 손을 뗄 때 한 번 들려줘서 크기를 가늠하게 한다
  if ((ev.target as HTMLElement).dataset.volume === 'sfx') sfx('hit');
});

window.addEventListener('keydown', (ev) => {
  // 개발자 패널 입력칸에 타이핑할 때는 단축키를 쓰지 않는다
  if ((ev.target as HTMLElement).closest?.('input, select, textarea')) return;
  unlock();
  if (overlay && ev.key === 'Escape') {
    overlay = null;
    render();
    return;
  }
  if (screen.kind !== 'combat' || overlay) return;
  if (ev.key === 'e' || ev.key === 'E') void act(() => handle('end-turn', {}));
  else if (ev.key === 'q' || ev.key === 'Q') void act(() => handle('skill', {}));
  else if (ev.key === 'Escape') void act(() => { selectedUid = null; skillTargeting = false; });
});

installFrames();
installCardFrames();
preloadFx();
installTooltips();

// ── 개발자 모드 — 개발 서버이거나 주소에 ?dev가 있을 때만 ──
if (import.meta.env.DEV || new URLSearchParams(location.search).has('dev')) {
  const api: DevApi = {
    run: () => run,
    combat: () => (screen.kind === 'combat' ? screen.combat : null),
    screenKind: () => screen.kind,
    busy: () => busy,
    newRun: (char, seed = Date.now() % 1_000_000) => {
      run = createRun(seed, char);
    },
    startCombat: (enemyIds) => {
      run ??= createRun(Date.now() % 1_000_000);
      run.hp = Math.max(1, run.hp);
      selectedUid = null;
      skillTargeting = false;
      overlay = null;
      screen = { kind: 'combat', combat: startCustomCombat(run, enemyIds) };
      void act(() => {});
    },
    goto: (target, arg) => {
      run ??= createRun(Date.now() % 1_000_000);
      overlay = null;
      selectedUid = null;
      skillTargeting = false;
      switch (target) {
        case 'title': screen = { kind: 'title' }; break;
        case 'select': screen = { kind: 'select' }; break;
        case 'map': screen = { kind: 'map' }; break;
        case 'reward': {
          const tier = (arg as CombatTier) ?? 'normal';
          const spoils = claimCombatSpoils(run, tier);
          screen = { kind: 'reward', options: rollCardRewards(run, tier, rewardChoiceCount(run)), tier, rerolled: false, spoils };
          break;
        }
        case 'rest': screen = { kind: 'rest', mode: 'menu' }; break;
        case 'shop': screen = { kind: 'shop', shop: createShop(run), removing: false }; break;
        case 'event': screen = { kind: 'event', id: String(arg ?? rollEvent(run)), result: null, picking: null }; break;
        case 'treasure': screen = { kind: 'treasure', loot: openTreasure(run) }; break;
        case 'actStart': screen = { kind: 'actStart' }; break;
        case 'won': screen = { kind: 'end', won: true }; break;
        case 'lost': screen = { kind: 'end', won: false }; break;
        case 'act': {
          // 정한 구역의 새 지도 맨 아래로
          run.act = Math.max(0, Math.min(2, Number(arg)) - 1);
          advanceAct(run);
          screen = { kind: 'map' };
          break;
        }
        case 'node':
          // 갈 수 있는지 따지지 않고 그 방으로 들어간다
          enterRoom(Number(arg), true);
          break;
      }
      void act(() => {});
    },
    act: (fn) => void act(fn),
    render,
    playEvents: async (events: CombatEvent[]) => {
      if (busy) return;
      busy = true;
      try {
        await playEvents(root, events, snapshot());
      } finally {
        busy = false;
      }
    },
    hooks: (afterAction, afterRender) => {
      devAfterAction = afterAction;
      devAfterRender = afterRender;
    },
  };
  void import('./dev/panel').then((m) => m.installDevPanel(api));
}

render();
