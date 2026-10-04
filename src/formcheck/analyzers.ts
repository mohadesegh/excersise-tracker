/**
 * Form analysis from body landmarks (BlazePose / MediaPipe 33-point layout).
 * Pure functions with no camera or ML dependency, so they can be tested with
 * synthetic poses from our own 3D mannequin.
 *
 * Coordinates: x, y normalised to the image (y grows downward), plus a
 * visibility score. Pass the image aspect ratio so angles aren't distorted.
 */

import { getLocale, type Locale } from '../i18n';

export interface Lm { x: number; y: number; visibility?: number }

export const P = {
  nose: 0,
  lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
} as const;

export type Level = 'ok' | 'warn' | 'bad';

export interface Feedback {
  /** enough of the body is visible to judge */
  ready: boolean;
  reps: number;
  /** seconds of good-form hold (plank) */
  hold?: number;
  cue: string | null;
  level: Level;
  /** landmarks to draw in the warning colour */
  flag: number[];
}

export interface Analyzer {
  /** where to put the phone */
  view: 'front' | 'side';
  update(lms: Lm[], t: number): Feedback;
}

/* ---------- geometry ---------- */

let aspect = 4 / 3;
export const setAspect = (a: number): void => {
  aspect = a;
};
const vx = (a: Lm, b: Lm) => [(b.x - a.x) * aspect, b.y - a.y];

/** Angle ABC in degrees (0–180). */
export function angle(a: Lm, b: Lm, c: Lm): number {
  const [x1, y1] = vx(b, a), [x2, y2] = vx(b, c);
  const d = Math.hypot(x1, y1) * Math.hypot(x2, y2) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (x1 * x2 + y1 * y2) / d))) * 180) / Math.PI;
}

/** Signed distance of point p from line a→c (positive = below the line on screen), relative to the line's length. */
function sag(a: Lm, p: Lm, c: Lm): number {
  const [dx, dy] = vx(a, c);
  const len = Math.hypot(dx, dy) || 1;
  const [px, py] = vx(a, p);
  // project p onto the line, then measure how far below that point it sits
  const t = (px * dx + py * dy) / (len * len);
  const ly = a.y + (c.y - a.y) * t;
  return (p.y - ly) / len;
}

/** Torso lean from vertical in degrees (0 = upright). */
const lean = (shoulder: Lm, hip: Lm) => {
  const [dx, dy] = vx(hip, shoulder);
  return (Math.atan2(Math.abs(dx), -dy) * 180) / Math.PI;
};

const vis = (l?: Lm) => l?.visibility ?? 1;
const mid = (a: Lm, b: Lm): Lm => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, visibility: Math.min(vis(a), vis(b)) });

/** Pick the body side the camera sees best (for side-view exercises). */
function side(l: Lm[]) {
  const left = vis(l[P.lShoulder]) + vis(l[P.lHip]) + vis(l[P.lKnee]) + vis(l[P.lAnkle]) + vis(l[P.lElbow]);
  const right = vis(l[P.rShoulder]) + vis(l[P.rHip]) + vis(l[P.rKnee]) + vis(l[P.rAnkle]) + vis(l[P.rElbow]);
  const L = left >= right;
  return {
    shoulder: L ? P.lShoulder : P.rShoulder, elbow: L ? P.lElbow : P.rElbow, wrist: L ? P.lWrist : P.rWrist,
    hip: L ? P.lHip : P.rHip, knee: L ? P.lKnee : P.rKnee, ankle: L ? P.lAnkle : P.rAnkle,
  };
}

const visible = (l: Lm[], idx: number[]) => idx.every((i) => l[i] && vis(l[i]) > 0.5);

/* ---------- rep counting ---------- */

/**
 * Counts one rep each time a metric leaves its resting zone, passes the
 * working threshold, and comes back. Hysteresis avoids double counts from
 * landmark jitter.
 */
class Reps {
  reps = 0;
  phase: 'rest' | 'work' = 'rest';
  /** most extreme value reached in the current rep */
  peak = 0;
  private smooth: number | null = null;
  constructor(private restAbove: boolean, private restAt: number, private workAt: number) {}

  /** Returns 'rep' when a rep just completed, 'start' when one just began. */
  push(v: number): 'rep' | 'start' | null {
    this.smooth = this.smooth === null ? v : this.smooth * 0.6 + v * 0.4;
    const m = this.smooth;
    const inRest = this.restAbove ? m > this.restAt : m < this.restAt;
    const inWork = this.restAbove ? m < this.workAt : m > this.workAt;
    if (this.phase === 'rest' && inWork) {
      this.phase = 'work';
      this.peak = m;
      return 'start';
    }
    if (this.phase === 'work') {
      this.peak = this.restAbove ? Math.min(this.peak, m) : Math.max(this.peak, m);
      if (inRest) {
        this.phase = 'rest';
        this.reps++;
        return 'rep';
      }
    }
    return null;
  }
  get value(): number {
    return this.smooth ?? 0;
  }
}

const notReady = (reps: number): Feedback => ({ ready: false, reps, cue: 'کل بدنت را در کادر بیاور', level: 'warn', flag: [] });

/** Keep a cue on screen for a moment after the error, so the user can read it. */
class Hold {
  private until = 0;
  private cue: string | null = null;
  private level: Level = 'ok';
  private flag: number[] = [];
  set(cue: string, level: Level, flag: number[], t: number, secs = 1.6) {
    this.cue = cue; this.level = level; this.flag = flag; this.until = t + secs;
  }
  get(t: number): Pick<Feedback, 'cue' | 'level' | 'flag'> {
    return t < this.until ? { cue: this.cue, level: this.level, flag: this.flag } : { cue: null, level: 'ok', flag: [] };
  }
}

/* ---------- exercises ---------- */

/** Squat family, phone in front: depth, knees caving in, chest dropping. */
function squatLike(depthAngle = 110): Analyzer {
  const reps = new Reps(true, 160, 135);
  const msg = new Hold();
  let caved = false;
  return {
    view: 'front',
    update(l, t) {
      const need = [P.lHip, P.rHip, P.lKnee, P.rKnee, P.lAnkle, P.rAnkle, P.lShoulder, P.rShoulder];
      if (!visible(l, need)) return notReady(reps.reps);
      const knee = (angle(l[P.lHip], l[P.lKnee], l[P.lAnkle]) + angle(l[P.rHip], l[P.rKnee], l[P.rAnkle])) / 2;
      const ev = reps.push(knee);
      if (ev === 'start') caved = false;

      // knees caving in: at depth, knees much closer together than the ankles
      const kneeGap = Math.abs(l[P.lKnee].x - l[P.rKnee].x);
      const ankleGap = Math.abs(l[P.lAnkle].x - l[P.rAnkle].x);
      if (reps.phase === 'work' && knee < 150 && ankleGap > 0.02 && kneeGap / ankleGap < 0.78) {
        caved = true;
        msg.set('زانوها رو به بیرون', 'bad', [P.lKnee, P.rKnee], t);
      }
      if (ev === 'rep' && !caved && reps.peak > depthAngle) msg.set('کمی پایین‌تر برو', 'warn', [P.lHip, P.rHip], t);
      else if (ev === 'rep' && !caved) msg.set('عالی', 'ok', [], t, 0.8);
      return { ready: true, reps: reps.reps, ...msg.get(t) };
    },
  };
}

/** Push-up family, phone at the side: body line and range. `anchor` is the ankle (full) or knee (kneeling). */
function pushLike(anchor: 'ankle' | 'knee'): Analyzer {
  const reps = new Reps(true, 150, 115);
  const msg = new Hold();
  return {
    view: 'side',
    update(l, t) {
      const s = side(l);
      const a = anchor === 'ankle' ? s.ankle : s.knee;
      if (!visible(l, [s.shoulder, s.elbow, s.wrist, s.hip, a])) return notReady(reps.reps);
      const elbow = angle(l[s.shoulder], l[s.elbow], l[s.wrist]);
      const ev = reps.push(elbow);
      const off = sag(l[s.shoulder], l[s.hip], l[a]);
      if (off > 0.08) msg.set('باسن را بالا نگه دار؛ بدن صاف', 'bad', [s.hip], t);
      else if (off < -0.1) msg.set('باسن را پایین بیاور', 'warn', [s.hip], t);
      else if (ev === 'rep' && reps.peak > 105) msg.set('سینه را پایین‌تر ببر', 'warn', [s.shoulder], t);
      else if (ev === 'rep') msg.set('عالی', 'ok', [], t, 0.8);
      return { ready: true, reps: reps.reps, ...msg.get(t) };
    },
  };
}

/** Plank: no reps, counts seconds of good alignment. */
function plank(): Analyzer {
  const msg = new Hold();
  let hold = 0, last = 0;
  return {
    view: 'side',
    update(l, t) {
      const s = side(l);
      if (!visible(l, [s.shoulder, s.hip, s.ankle])) return { ...notReady(0), hold };
      const off = sag(l[s.shoulder], l[s.hip], l[s.ankle]);
      const good = Math.abs(off) <= 0.07;
      if (good && last) hold += Math.min(0.2, t - last);
      last = t;
      if (off > 0.07) msg.set('کمر نیفتد؛ باسن را منقبض کن', 'bad', [s.hip], t, 0.6);
      else if (off < -0.09) msg.set('باسن را پایین بیاور', 'warn', [s.hip], t, 0.6);
      return { ready: true, reps: 0, hold, ...msg.get(t) };
    },
  };
}

/** Hip hinge (RDL / deadlift), side view: counts hinges, warns when it turns into a squat. */
function hinge(strictKnees: boolean): Analyzer {
  const reps = new Reps(true, 160, 130);
  const msg = new Hold();
  return {
    view: 'side',
    update(l, t) {
      const s = side(l);
      if (!visible(l, [s.shoulder, s.hip, s.knee, s.ankle])) return notReady(reps.reps);
      const hip = angle(l[s.shoulder], l[s.hip], l[s.knee]);
      const knee = angle(l[s.hip], l[s.knee], l[s.ankle]);
      const ev = reps.push(hip);
      if (strictKnees && reps.phase === 'work' && knee < 135) msg.set('زانوها را کمتر خم کن؛ لگن به عقب', 'bad', [s.knee], t);
      else if (ev === 'rep') msg.set('عالی', 'ok', [], t, 0.8);
      return { ready: true, reps: reps.reps, ...msg.get(t) };
    },
  };
}

/** Glute bridge, side view. */
function bridge(): Analyzer {
  const reps = new Reps(false, 150, 165);
  const msg = new Hold();
  return {
    view: 'side',
    update(l, t) {
      const s = side(l);
      if (!visible(l, [s.shoulder, s.hip, s.knee])) return notReady(reps.reps);
      const hip = angle(l[s.shoulder], l[s.hip], l[s.knee]);
      const ev = reps.push(hip);
      if (ev === 'rep' && reps.peak < 170) msg.set('باسن را کمی بالاتر ببر', 'warn', [s.hip], t);
      else if (ev === 'rep') msg.set('عالی', 'ok', [], t, 0.8);
      return { ready: true, reps: reps.reps, ...msg.get(t) };
    },
  };
}

/** Bent-over row, side view: counts pulls, warns when the torso swings up. */
function row(): Analyzer {
  const reps = new Reps(true, 150, 110);
  const msg = new Hold();
  let startLean = 0;
  return {
    view: 'side',
    update(l, t) {
      const s = side(l);
      if (!visible(l, [s.shoulder, s.elbow, s.wrist, s.hip])) return notReady(reps.reps);
      const elbow = angle(l[s.shoulder], l[s.elbow], l[s.wrist]);
      const tl = lean(l[s.shoulder], l[s.hip]);
      const ev = reps.push(elbow);
      if (ev === 'start') startLean = tl;
      if (reps.phase === 'work' && startLean - tl > 18) msg.set('تنه را ثابت نگه دار', 'bad', [s.shoulder, s.hip], t);
      else if (ev === 'rep') msg.set('عالی', 'ok', [], t, 0.8);
      return { ready: true, reps: reps.reps, ...msg.get(t) };
    },
  };
}

/** Overhead press, side view: counts presses, warns about leaning back. */
function press(): Analyzer {
  const reps = new Reps(false, 110, 150);
  const msg = new Hold();
  return {
    view: 'side',
    update(l, t) {
      const s = side(l);
      if (!visible(l, [s.shoulder, s.elbow, s.wrist, s.hip])) return notReady(reps.reps);
      const elbow = angle(l[s.shoulder], l[s.elbow], l[s.wrist]);
      const ev = reps.push(elbow);
      if (lean(l[s.shoulder], l[s.hip]) > 14) msg.set('کمر را قوس نده؛ شکم سفت', 'bad', [s.hip], t);
      else if (ev === 'rep') msg.set('عالی', 'ok', [], t, 0.8);
      return { ready: true, reps: reps.reps, ...msg.get(t) };
    },
  };
}

/** Jumping jacks, front view: hands above the head and back down. */
function jacks(): Analyzer {
  const reps = new Reps(true, 0.05, -0.02);
  return {
    view: 'front',
    update(l) {
      if (!visible(l, [P.lWrist, P.rWrist, P.nose])) return notReady(reps.reps);
      // positive when the wrists are below the nose
      reps.push(Math.min(l[P.lWrist].y, l[P.rWrist].y) - l[P.nose].y);
      return { ready: true, reps: reps.reps, cue: null, level: 'ok', flag: [] };
    },
  };
}

/** Lunge, side view: counts reps on the front knee, warns when the torso tips forward. */
function lunge(): Analyzer {
  const reps = new Reps(true, 155, 120);
  const msg = new Hold();
  return {
    view: 'side',
    update(l, t) {
      if (!visible(l, [P.lHip, P.rHip, P.lKnee, P.rKnee, P.lAnkle, P.rAnkle])) return notReady(reps.reps);
      const k = Math.min(angle(l[P.lHip], l[P.lKnee], l[P.lAnkle]), angle(l[P.rHip], l[P.rKnee], l[P.rAnkle]));
      const ev = reps.push(k);
      const sh = mid(l[P.lShoulder], l[P.rShoulder]), hp = mid(l[P.lHip], l[P.rHip]);
      if (reps.phase === 'work' && lean(sh, hp) > 30) msg.set('تنه را صاف نگه دار', 'warn', [P.lShoulder, P.rShoulder], t);
      else if (ev === 'rep') msg.set('عالی', 'ok', [], t, 0.8);
      return { ready: true, reps: reps.reps, ...msg.get(t) };
    },
  };
}

const FACTORIES: Record<string, () => Analyzer> = {
  squat: () => squatLike(),
  goblet: () => squatLike(),
  backsquat: () => squatLike(),
  lunge,
  pushup: () => pushLike('ankle'),
  kneepush: () => pushLike('knee'),
  plank,
  rdl: () => hinge(true),
  deadlift: () => hinge(false),
  bridge,
  row,
  press,
  jacks,
};

export const hasAnalyzer = (id: string): boolean => id in FACTORIES;
export const makeAnalyzer = (id: string): Analyzer | null => FACTORIES[id]?.() ?? null;

/** The live cues above are written in Persian; this gives them in the app's language. */
export const CUES: Record<string, { en: string; tr: string }> = {
  'کل بدنت را در کادر بیاور': { en: 'Get your whole body in the frame', tr: 'Tüm vücudunu kadraja al' },
  'زانوها رو به بیرون': { en: 'Knees out', tr: 'Dizler dışarı' },
  'کمی پایین‌تر برو': { en: 'Go a little lower', tr: 'Biraz daha aşağı in' },
  'عالی': { en: 'Great', tr: 'Harika' },
  'باسن را بالا نگه دار؛ بدن صاف': { en: 'Keep your hips up; body straight', tr: 'Kalçanı yukarıda tut; vücut düz' },
  'باسن را پایین بیاور': { en: 'Lower your hips', tr: 'Kalçanı indir' },
  'سینه را پایین‌تر ببر': { en: 'Bring your chest lower', tr: 'Göğsünü daha aşağı indir' },
  'کمر نیفتد؛ باسن را منقبض کن': { en: 'Do not let your back sag; squeeze your glutes', tr: 'Belin çökmesin; kalçanı sık' },
  'زانوها را کمتر خم کن؛ لگن به عقب': { en: 'Bend your knees less; hips back', tr: 'Dizlerini daha az bük; kalça geriye' },
  'باسن را کمی بالاتر ببر': { en: 'Lift your hips a little higher', tr: 'Kalçanı biraz daha yukarı kaldır' },
  'تنه را ثابت نگه دار': { en: 'Keep your torso still', tr: 'Gövdeni sabit tut' },
  'کمر را قوس نده؛ شکم سفت': { en: 'Do not arch your back; brace your abs', tr: 'Belini kavislendirme; karnını sık' },
  'تنه را صاف نگه دار': { en: 'Keep your torso upright', tr: 'Gövdeni dik tut' },
};

export const cueText = (cue: string, locale: Locale = getLocale()): string =>
  locale === 'fa' ? cue : (CUES[cue]?.[locale] ?? cue);
