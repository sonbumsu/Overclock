import 'galmuri/dist/galmuri.css';
import './style.css';
import { aliveEnemies, cardDef, endTurn, needsTarget, playCard } from './core/combat';
import {
  addCard, createRun, currentFloor, enterAct, removeCard, rest, rollCardRewards, startFloorCombat,
  type CombatTier, type RunState,
} from './core/run';
import type { CombatState, UnitRef } from './core/types';
import { playEvents, preloadFx, type UnitSnapshot } from './ui/effects';
import {
  renderActStart, renderCombat, renderEnd, renderPileOverlay, renderRest, renderReward, renderSelect, renderTitle,
  type PileKind,
} from './ui/render';
import { playMusic, sfx, toggle, unlock, type MusicId } from './ui/sound';
import { installCardFrames } from './ui/card-frame';
import { installFrames } from './ui/sprites';
import { hideTooltip, installTooltips } from './ui/tooltip';

type Screen =
  | { kind: 'title' }
  | { kind: 'select' }
  | { kind: 'combat'; combat: CombatState }
  | { kind: 'reward'; options: string[]; tier: CombatTier; rerolled: boolean }
  /** removing: 분해할 카드를 고르는 중 */
  | { kind: 'rest'; removing: boolean }
  | { kind: 'actStart' }
  | { kind: 'end'; won: boolean };

const root = document.querySelector<HTMLDivElement>('#app')!;
let run: RunState | null = null;
let screen: Screen = { kind: 'title' };
let selectedUid: number | null = null;
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
  if (screen.kind === 'rest' || screen.kind === 'actStart') return 'rest';
  const floor = run && run.floor < run.floors.length ? currentFloor(run) : null;
  if (floor?.kind === 'combat' && floor.tier === 'boss') return 'boss';
  return (['act0', 'act1', 'act2'] as const)[floor?.act ?? 0];
}

function render(): void {
  hideTooltip();
  renderScreen();
  if (overlay) root.insertAdjacentHTML('beforeend', renderPileOverlay(overlay, pileCards(overlay)));
  playMusic(screenMusic());
}

function renderScreen(): void {
  switch (screen.kind) {
    case 'title':
      root.innerHTML = renderTitle();
      return;
    case 'select':
      root.innerHTML = renderSelect();
      return;
    case 'combat':
      root.innerHTML = renderCombat(run!, screen.combat, selectedUid, dying, fresh);
      return;
    case 'reward':
      root.innerHTML = renderReward(run!, screen.options, screen.rerolled);
      return;
    case 'actStart':
      root.innerHTML = renderActStart(run!);
      return;
    case 'rest':
      root.innerHTML = renderRest(run!, screen.removing);
      return;
    case 'end':
      root.innerHTML = renderEnd(run!, screen.won);
      return;
  }
}

function enterFloor(): void {
  if (!run) return;
  if (run.floor >= run.floors.length) {
    screen = { kind: 'end', won: true };
    return;
  }
  const floor = currentFloor(run);
  if (floor.kind === 'rest') screen = { kind: 'rest', removing: false };
  else if (floor.kind === 'actStart') screen = { kind: 'actStart' };
  else screen = { kind: 'combat', combat: startFloorCombat(run) };
}

function nextFloor(): void {
  run!.floor += 1;
  enterFloor();
}

function afterCombatAction(combat: CombatState): void {
  if (combat.outcome === 'ongoing' || !run) return;
  run.hp = combat.player.hp;
  selectedUid = null;
  const floor = currentFloor(run);
  overlay = null;
  if (combat.outcome === 'lost') {
    sfx('defeat');
    screen = { kind: 'end', won: false };
  } else if (run.floor === run.floors.length - 1) {
    sfx('victory');
    run.floor += 1;
    screen = { kind: 'end', won: true };
  } else {
    sfx('victory');
    const tier = floor.kind === 'combat' ? floor.tier : 'normal';
    screen = { kind: 'reward', options: rollCardRewards(run, tier), tier, rerolled: false };
  }
}

function onCardClick(combat: CombatState, uid: number): void {
  const card = combat.hand.find((c) => c.uid === uid);
  if (!card) return;
  const def = cardDef(card);
  if (def.cost === null) return;
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
    case 'choose':
      run = createRun(Date.now() % 1_000_000, data.char);
      enterFloor();
      return;
    case 'play':
      if (screen.kind === 'combat') onCardClick(screen.combat, Number(data.uid));
      break;
    case 'target':
      if (screen.kind === 'combat' && selectedUid !== null) {
        playCard(screen.combat, selectedUid, Number(data.uid));
        selectedUid = null;
      }
      break;
    case 'end-turn':
      if (screen.kind === 'combat') {
        selectedUid = null;
        endTurn(screen.combat);
      }
      break;
    case 'pick':
      sfx('reward');
      addCard(run!, data.card!);
      nextFloor();
      return;
    case 'skip':
      nextFloor();
      return;
    case 'reroll':
      sfx('cardGear');
      // 보상 화면마다 한 번, 지금 보이는 카드는 빼고 다시 뽑는다
      if (screen.kind === 'reward' && !screen.rerolled)
        screen = { ...screen, options: rollCardRewards(run!, screen.tier, 3, screen.options), rerolled: true };
      return;
    case 'enter-act':
      enterAct(run!);
      nextFloor();
      return;
    case 'rest':
      sfx('rest');
      rest(run!);
      nextFloor();
      return;
    case 'remove-menu':
    case 'remove-back':
      if (screen.kind === 'rest') screen = { kind: 'rest', removing: action === 'remove-menu' };
      return;
    case 'remove':
      if (removeCard(run!, Number(data.uid))) {
        sfx('remove');
        nextFloor();
      }
      return;
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

window.addEventListener('keydown', (ev) => {
  unlock();
  if (overlay && ev.key === 'Escape') {
    overlay = null;
    render();
    return;
  }
  if (screen.kind !== 'combat' || overlay) return;
  if (ev.key === 'e' || ev.key === 'E') void act(() => handle('end-turn', {}));
  else if (ev.key === 'Escape') void act(() => (selectedUid = null));
});

installFrames();
installCardFrames();
preloadFx();
installTooltips();

// 개발용: ?floor=N 으로 해당 층에서 바로 시작
// (&seed= 시드 고정, &char=캐릭터id, &deck=카드id,카드id 덱 지정, &screen=reward|end 화면 확인)
if (import.meta.env.DEV) {
  const params = new URLSearchParams(location.search);
  if (params.has('floor')) {
    run = createRun(Number(params.get('seed') ?? 1), params.get('char') ?? undefined);
    run.floor = Number(params.get('floor'));
    const deck = params.get('deck');
    if (deck) {
      run.deck = [];
      for (const id of deck.split(',')) addCard(run, id);
    }
    enterFloor();
    const debugScreen = params.get('screen');
    if (debugScreen === 'reward') screen = { kind: 'reward', options: rollCardRewards(run, 'elite'), tier: 'elite', rerolled: false };
    if (debugScreen === 'end') screen = { kind: 'end', won: params.get('won') === '1' };
  }
}

render();
