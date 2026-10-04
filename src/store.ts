import type { AppState } from './types';

const KEY = 'varzideh:v1';

const fresh = (): AppState => ({
  v: 1,
  profile: null,
  plan: null,
  sessions: [],
  sub: null,
  trialUsed: false,
  adjust: {},
  weights: [],
  loads: {},
});

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...fresh(), ...parsed, v: 1 };
  } catch {
    return fresh();
  }
}

export const state: AppState = load();

const hooks = new Set<() => void>();
/** Run after every save (used by cloud sync). */
export const onSave = (fn: () => void): void => {
  hooks.add(fn);
};

export function save(): void {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: the app keeps working in memory */
  }
  hooks.forEach((f) => f());
}

export function update(fn: (s: AppState) => void): void {
  fn(state);
  save();
}

export function resetAll(): void {
  Object.assign(state, fresh());
  save();
}

export const isPremium = (): boolean => !!state.sub && state.sub.until > Date.now();
