import { Rng } from './rng';
import type { RunState } from './run';

/**
 * 런 저장 — 런과 지금 화면을 통째로 localStorage에 JSON으로 넣는다.
 * 전투 중이면 전투 상태까지 저장되므로 새로고침해도 그 턴 그대로 이어진다.
 * Rng는 state 숫자만 저장하고, 불러올 때 런과 전투가 같은 Rng를 다시 나눠 갖게 한다.
 */
const KEY = 'overclock:run';
const VERSION = 2;

export interface SaveData<S> {
  v: number;
  savedAt: number;
  run: RunState;
  screen: S;
}

export function saveGame<S>(run: RunState, screen: S): void {
  try {
    const data = JSON.stringify({ v: VERSION, savedAt: Date.now(), run, screen }, (_k, value) =>
      value instanceof Rng ? { __rng: value.state } : value);
    localStorage.setItem(KEY, data);
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 저장 없이 진행
  }
}

/** 저장이 없거나 깨졌거나 버전이 다르면 null */
export function loadGame<S>(): SaveData<S> | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    const data = JSON.parse(text, (_k, value) =>
      value && typeof value === 'object' && typeof value.__rng === 'number' ? new Rng(value.__rng) : value) as SaveData<S>;
    if (data.v !== VERSION || !data.run?.map || !(data.run.rng instanceof Rng)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
