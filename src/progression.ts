import { EX } from './data/exercises';
import { isPremium, state } from './store';
import type { Exercise, Feel, Goal, Plan, Profile, Session, SetLog } from './types';

/** A training block: 4 building weeks, then 1 lighter week to recover. */
export const CYCLE_WEEKS = 5;
const WEEK = 7 * 86_400_000;

export interface WeekInfo {
  /** 1..CYCLE_WEEKS, or > CYCLE_WEEKS when the block is finished */
  week: number;
  deload: boolean;
  finished: boolean;
}

export function weekInfo(plan: Plan, now = Date.now()): WeekInfo {
  const week = Math.floor((now - plan.createdAt) / WEEK) + 1;
  return { week, deload: week === CYCLE_WEEKS, finished: week > CYCLE_WEEKS };
}

/** Sets for this week: one fewer in the recovery week. */
export const setsThisWeek = (sets: number, w: WeekInfo): number => (w.deload ? Math.max(1, sets - 1) : sets);

/** Rep range used for double progression: reach the top on every set, then add weight. */
export function repRange(goal: Goal): [number, number] {
  if (goal === 'muscle') return [8, 12];
  if (goal === 'fatloss') return [12, 15];
  return [10, 15];
}

export const isLoaded = (e: Exercise): boolean => e.equip !== 'none';
const step = (e: Exercise): number => (e.equip === 'barbell' ? 2.5 : 1);
const round = (kg: number, e: Exercise) => Math.max(step(e), Math.round(kg / step(e)) * step(e));

/** A sensible first weight when we have no history. Per dumbbell for dumbbell moves. */
export function starterKg(e: Exercise, p: Profile): number {
  if (e.equip === 'barbell') return 20; // empty Olympic bar
  const base = p.sex === 'm' ? 6 : p.sex === 'f' ? 3 : 4;
  const lower = ['squat', 'hinge', 'lunge'].includes(e.pattern) ? 2 : 0;
  return base + (p.level - 1) * 2 + lower;
}

/** Working weight to show today: last used, minus 10 % in the recovery week. */
export function todayKg(e: Exercise, p: Profile, w: WeekInfo): number {
  const kg = state.loads[e.id] ?? starterKg(e, p);
  return w.deload ? round(kg * 0.9, e) : kg;
}

export interface LoadChange { id: string; from: number; to: number }

/**
 * Double progression on one exercise's sets from the last session:
 * every set at the top of the range (and it didn't feel hard) → add one step;
 * two or more sets below the bottom → drop 10 %; otherwise keep.
 */
export function nextKg(e: Exercise, sets: SetLog[], goal: Goal, feel: Feel): number | null {
  const kgs = sets.map((s) => s.kg).filter((k): k is number => typeof k === 'number');
  if (!kgs.length) return null;
  const kg = Math.max(...kgs);
  const [lo, hi] = repRange(goal);
  const heavy = sets.filter((s) => s.kg === kg);
  if (heavy.every((s) => s.reps >= hi) && feel !== 'hard') return kg + step(e);
  if (sets.filter((s) => s.reps < lo).length >= 2) return round(kg * 0.9, e);
  return kg;
}

/** Store weights from a finished session. Premium users also get automatic progression. */
export function applyLoads(session: Session, goal: Goal, w: WeekInfo): LoadChange[] {
  const changes: LoadChange[] = [];
  const byEx = new Map<string, SetLog[]>();
  for (const l of session.logs ?? []) if (l.kg !== undefined) byEx.set(l.id, [...(byEx.get(l.id) ?? []), l]);
  for (const [id, sets] of byEx) {
    const e = EX[id];
    const used = Math.max(...sets.map((s) => s.kg!));
    // the recovery week never moves the working weight
    if (w.deload) continue;
    const to = isPremium() ? nextKg(e, sets, goal, session.feel) ?? used : used;
    const from = state.loads[id] ?? used;
    state.loads[id] = to;
    if (to !== from) changes.push({ id, from, to });
  }
  return changes;
}

export interface HistoryPoint { ts: number; kg?: number; reps: number }

/** Best set of each past session for one exercise (heaviest, then most reps). */
export function history(id: string): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const s of state.sessions) {
    const sets = (s.logs ?? []).filter((l) => l.id === id);
    if (!sets.length) continue;
    const best = sets.reduce((a, b) => ((b.kg ?? 0) > (a.kg ?? 0) || ((b.kg ?? 0) === (a.kg ?? 0) && b.reps > a.reps) ? b : a));
    out.push({ ts: s.ts, kg: best.kg, reps: best.reps });
  }
  return out;
}

/** Personal records: heaviest set per loaded move, most reps per bodyweight move. */
export function records(): { id: string; kg?: number; reps: number; ts: number }[] {
  const best = new Map<string, { id: string; kg?: number; reps: number; ts: number }>();
  for (const s of state.sessions)
    for (const l of s.logs ?? []) {
      const cur = best.get(l.id);
      const better = !cur || (l.kg ?? 0) > (cur.kg ?? 0) || ((l.kg ?? 0) === (cur.kg ?? 0) && l.reps > cur.reps);
      if (better) best.set(l.id, { id: l.id, kg: l.kg, reps: l.reps, ts: s.ts });
    }
  return [...best.values()].filter((r) => EX[r.id] && !EX[r.id].kind);
}
