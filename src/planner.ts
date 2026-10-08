import { extraRest, lowImpact, noBarbell } from './body';
import { EX, EXERCISES } from './data/exercises';
import { swapFor } from './data/injury';
import { getLocale, type Locale } from './i18n';
import type { DayPlan, Equip, Exercise, Pattern, PlannedExercise, Plan, Profile } from './types';

/** Free users get this many training days per week; the rest are premium. */
export const FREE_DAYS = 3;

const DAY_TEMPLATES: Record<string, { title: string; slots: Pattern[] }> = {
  fullA: { title: 'تمام بدن ۱', slots: ['squat', 'push', 'hinge', 'pull', 'core', 'cardio', 'press'] },
  fullB: { title: 'تمام بدن ۲', slots: ['lunge', 'push', 'hinge', 'pull', 'core', 'press', 'cardio'] },
  fullC: { title: 'تمام بدن ۳', slots: ['squat', 'pull', 'hinge', 'push', 'cardio', 'core', 'lunge'] },
  lower: { title: 'پایین‌تنه', slots: ['squat', 'hinge', 'lunge', 'core', 'cardio', 'squat', 'core'] },
  upper: { title: 'بالاتنه', slots: ['push', 'pull', 'press', 'core', 'push', 'pull', 'cardio'] },
  cond: { title: 'هوازی و استقامت', slots: ['cardio', 'squat', 'push', 'cardio', 'core', 'lunge', 'cardio'] },
};

const DAY_TITLES: Record<string, Record<Locale, string>> = {
  fullA: { fa: 'تمام بدن ۱', en: 'Full body 1', tr: 'Tüm vücut 1' },
  fullB: { fa: 'تمام بدن ۲', en: 'Full body 2', tr: 'Tüm vücut 2' },
  fullC: { fa: 'تمام بدن ۳', en: 'Full body 3', tr: 'Tüm vücut 3' },
  lower: { fa: 'پایین‌تنه', en: 'Lower body', tr: 'Alt vücut' },
  upper: { fa: 'بالاتنه', en: 'Upper body', tr: 'Üst vücut' },
  cond: { fa: 'هوازی و استقامت', en: 'Cardio & conditioning', tr: 'Kardiyo ve kondisyon' },
};

/** A day's title in the user's language. */
export function dayTitle(day: DayPlan, locale: Locale = getLocale()): string {
  const key = day.key ?? Object.keys(DAY_TITLES).find((k) => DAY_TITLES[k].fa === day.title);
  return (key && DAY_TITLES[key]?.[locale]) || day.title;
}

const SPLITS: Record<number, string[]> = {
  2: ['fullA', 'fullB'],
  3: ['fullA', 'fullB', 'fullC'],
  4: ['lower', 'upper', 'fullA', 'cond'],
  5: ['lower', 'upper', 'cond', 'lower', 'upper'],
};

const EQUIP_FOR_PLACE: Record<Profile['place'], Equip[]> = {
  bodyweight: ['none'],
  dumbbell: ['none', 'dumbbell'],
  gym: ['none', 'dumbbell', 'barbell'],
};

const ITEMS_FOR_MINUTES: Record<number, number> = { 20: 4, 35: 5, 50: 7 };

const sore = (e: Exercise, p: Profile): boolean => e.avoid.some((l) => p.limits.includes(l));

/** Right for the user's equipment, level and body, leaving sore areas aside. */
function fits(e: Exercise, p: Profile): boolean {
  return (
    EQUIP_FOR_PLACE[p.place].includes(e.equip) &&
    e.level <= p.level &&
    !(e.impact && lowImpact(p)) &&
    !(e.equip === 'barbell' && noBarbell(p))
  );
}

export function usable(e: Exercise, p: Profile): boolean {
  return fits(e, p) && !sore(e, p);
}

/** When every move of a pattern loads a sore area: the gentler stand-in for one of them. */
function standIn(pattern: Pattern, p: Profile, taken: Set<string>): { ex: Exercise; of: string } | null {
  for (const e of EXERCISES) {
    if (e.pattern !== pattern || !fits(e, p) || !sore(e, p)) continue;
    const alt = swapFor(e.id, p.limits);
    if (alt && usable(EX[alt], p) && !taken.has(alt)) return { ex: EX[alt], of: e.id };
  }
  return null;
}

/** Candidates for a pattern, best fit first: prefer loaded moves when equipment exists. */
function candidates(pattern: Pattern, p: Profile, freeOnly: boolean): Exercise[] {
  const weight: Record<Equip, number> = { barbell: 2, dumbbell: 1, none: 0 };
  return EXERCISES.filter((e) => e.pattern === pattern && usable(e, p) && (!freeOnly || !e.premium)).sort(
    (a, b) => weight[b.equip] - weight[a.equip] || b.level - a.level,
  );
}

function dose(e: Exercise, p: Profile): Omit<PlannedExercise, 'id' | 'freeAlt'> {
  const d = baseDose(e, p);
  return { ...d, rest: d.rest + extraRest(p) };
}

function baseDose(e: Exercise, p: Profile): Omit<PlannedExercise, 'id' | 'freeAlt'> {
  const lv = p.level;
  if (e.timed) {
    const secs = e.pattern === 'cardio' ? [30, 40, 45][lv - 1] : [20, 30, 45][lv - 1];
    return { timed: true, reps: secs, sets: lv === 1 ? 2 : 3, rest: p.goal === 'fatloss' ? 20 : 30 };
  }
  switch (p.goal) {
    case 'fatloss':
      return { timed: false, sets: lv === 1 ? 2 : 3, reps: 15, rest: 30 };
    case 'muscle':
      return { timed: false, sets: lv === 1 ? 3 : 4, reps: lv === 3 ? 8 : 10, rest: 75 };
    default:
      return { timed: false, sets: lv === 1 ? 2 : 3, reps: 12, rest: 45 };
  }
}

export function buildPlan(p: Profile, cycle = 0): Plan {
  const split = SPLITS[p.days] ?? SPLITS[3];
  const count = ITEMS_FOR_MINUTES[p.minutes] ?? 5;
  const used = new Map<string, number>(); // spreads variety across the week

  const days: DayPlan[] = split.map((key, dayIdx) => {
    const tpl = DAY_TEMPLATES[key];
    const slots = [...tpl.slots];
    // Fat-loss plans pull cardio earlier so short sessions still include it.
    if (p.goal === 'fatloss' && !slots.slice(0, count).includes('cardio')) slots.splice(count - 1, 0, 'cardio');
    const items: PlannedExercise[] = [];
    const today = new Set<string>();

    for (const pattern of slots) {
      if (items.length >= count) break;
      let all = candidates(pattern, p, false).filter((e) => !today.has(e.id));
      if (!all.length) {
        // an injury never empties a slot: the move's gentler stand-in is trained instead
        const sub = standIn(pattern, p, today);
        if (sub) {
          today.add(sub.ex.id);
          items.push({ id: sub.ex.id, insteadOf: sub.of, ...dose(sub.ex, p) });
        }
        continue;
      }
      // each new training block rotates which variation leads, so the body gets a fresh stimulus
      const r = cycle % all.length;
      all = [...all.slice(r), ...all.slice(0, r)];
      all.sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0)); // stable: keeps best fit among least used
      const pick = all[0];
      const free = pick.premium ? candidates(pattern, p, true).find((e) => !today.has(e.id)) : undefined;
      today.add(pick.id);
      used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
      items.push({ id: pick.id, freeAlt: free?.id, ...dose(pick, p) });
    }
    const day: DayPlan = { key, title: tpl.title, items, premiumOnly: dayIdx >= FREE_DAYS };
    // fill the time the user said they have: add sets round-robin (max 5 per move)
    for (let k = 0; items.length && estimateMinutes(day) < p.minutes * 0.85 && k < items.length * 3; k++) {
      const it = items[k % items.length];
      if (it.sets < 5) it.sets++;
    }
    return day;
  });

  return { days, createdAt: Date.now(), cycle };
}

/** Which exercise a given user actually performs for a planned slot. */
export function resolve(item: PlannedExercise, premium: boolean): { ex: Exercise; locked: boolean } {
  const ex = EX[item.id];
  if (!ex.premium || premium) return { ex, locked: false };
  if (item.freeAlt) return { ex: EX[item.freeAlt], locked: false };
  return { ex, locked: true };
}

export function estimateMinutes(day: DayPlan): number {
  let s = 0;
  for (const it of day.items) s += it.sets * (it.timed ? it.reps : it.reps * 3) + (it.sets - 1) * it.rest + 40;
  return Math.max(5, Math.round(s / 60));
}

/** Adaptive progression (premium): nudges reps/seconds by how the last session felt. */
export function progressionDelta(feel: 'easy' | 'ok' | 'hard', timed: boolean): number {
  if (feel === 'easy') return timed ? 5 : 2;
  if (feel === 'hard') return timed ? -5 : -2;
  return 0;
}

/* ---------- warm-up and cool-down ---------- */

export interface ExtraStep { id: string; secs: number }

const LOWER: Exercise['pattern'][] = ['squat', 'hinge', 'lunge'];
const UPPER: Exercise['pattern'][] = ['push', 'pull', 'press'];
const dayHas = (day: DayPlan, pats: Exercise['pattern'][]) => day.items.some((i) => pats.includes(EX[i.id].pattern));

/** About 2½ minutes: pulse up, then the joints the session is about to load. */
export function warmupFor(day: DayPlan, p: Profile): ExtraStep[] {
  const out: ExtraStep[] = [{ id: 'march', secs: 45 }, { id: 'armcircle', secs: 30 }, { id: 'catcow', secs: 30 }];
  if (dayHas(day, LOWER)) out.push({ id: 'legswing', secs: 40 });
  return out.filter((s) => usable(EX[s.id], p));
}

/** About 2–3 minutes of easy stretching for what was just trained. */
export function cooldownFor(day: DayPlan, p: Profile): ExtraStep[] {
  const out: ExtraStep[] = [{ id: 'hamstretch', secs: 30 }];
  if (dayHas(day, LOWER)) out.push({ id: 'quadstretch', secs: 60 });
  if (dayHas(day, UPPER)) out.push({ id: 'chestopen', secs: 30 });
  out.push({ id: 'childpose', secs: 40 });
  return out.filter((s) => usable(EX[s.id], p));
}
