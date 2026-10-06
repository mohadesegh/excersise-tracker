/**
 * A tiny skeletal model: joint angles (degrees) → 3D joint positions.
 * No dependencies; a full frame costs a few hundred multiplications.
 *
 * Axes: y up, z = the body's front, x = the body's left.
 * Angles:
 *   rp     whole-body pitch (90 = face down, horizontal; -90 = lying on back)
 *   spine  torso lean forward from the pelvis
 *   *sf/sa/sr/e  shoulder flexion / abduction / rotation, elbow bend
 *   *hf/ha/k     hip flexion / abduction, knee bend
 *   lift   extra height above the floor (jumps)
 */
export interface Pose {
  rp?: number;
  lift?: number;
  spine?: number;
  /** head nod forward (chin to chest) relative to the torso */
  neck?: number;
  lsf?: number; lsa?: number; lsr?: number; le?: number;
  rsf?: number; rsa?: number; rsr?: number; re?: number;
  lhf?: number; lha?: number; lk?: number;
  rhf?: number; rha?: number; rk?: number;
  /** knee sway for valgus demos: negative swings the shin outward under an inward knee */
  lkv?: number; rkv?: number;
}

export type Prop = 'dumbbell' | 'barbell';

/** Body parts that can rest on the floor. */
export type Contact = 'hands' | 'elbows' | 'knees' | 'toes' | 'feet' | 'hips' | 'back' | 'torso';

export interface PoseAnim {
  frames: Pose[];
  /** Seconds for one full loop through all frames. */
  dur: number;
  /** Relative length of each transition (frame i → i+1). Lets a move go down slowly, pause, drive up. */
  beats?: number[];
  prop?: Prop;
  /**
   * Two groups that must both touch the floor (e.g. hands + toes in a push-up).
   * The solver tilts the whole body until they do, so nothing floats or sinks.
   */
  contacts?: [Contact, Contact];
  /**
   * Lying on the back: the torso stays as posed, and every arm or leg that is
   * close to the floor bends just enough to rest on it.
   */
  supine?: boolean;
  /** floor: palms flat on the floor; grip: fists around a weight; free (default): relaxed open hands. */
  hands?: 'free' | 'floor' | 'grip';
  /** flat: soles on the floor (default when upright or on the back); toes: on the toes (face-down). */
  feet?: 'flat' | 'toes' | 'point';
}

export type Vec = [number, number, number];
/** Row-major 3×3 rotation; its columns are where the part's own x (side), y (up) and z (front) axes point. */
export type Mat = [number, number, number, number, number, number, number, number, number];

export type SegName =
  | 'torso' | 'pelvis' | 'shoulders' | 'neck'
  | 'lua' | 'lfa' | 'rua' | 'rfa'
  | 'lth' | 'lsh' | 'lft' | 'rth' | 'rsh' | 'rft';

export interface Skeleton {
  seg: Record<SegName, [Vec, Vec]>;
  head: Vec;
  hands: [Vec, Vec];
  slices: SolvedSlice[];
  /** how each part is turned in the world (a limb hangs along its own -y); for a skinned body */
  frames: Frames;
}

export interface Frames {
  root: Mat; torso: Mat; head: Mat;
  lua: Mat; lfa: Mat; rua: Mat; rfa: Mat;
  lth: Mat; lsh: Mat; rth: Mat; rsh: Mat;
}

const D = Math.PI / 180;
const KEYS: (keyof Pose)[] = [
  'rp', 'lift', 'spine', 'neck',
  'lsf', 'lsa', 'lsr', 'le', 'rsf', 'rsa', 'rsr', 're',
  'lhf', 'lha', 'lk', 'rhf', 'rha', 'rk', 'lkv', 'rkv',
];

export const BASE: Required<Pose> = {
  rp: 0, lift: 0, spine: 0, neck: 0,
  lsf: 0, lsa: 8, lsr: 0, le: 10, rsf: 0, rsa: 8, rsr: 0, re: 10,
  lhf: 0, lha: 5, lk: 0, rhf: 0, rha: 5, rk: 0, lkv: 0, rkv: 0,
};

/* ---------- authoring helpers ---------- */
export const arms = (f = 0, a = 8, r = 0, e = 10): Pose => ({ lsf: f, lsa: a, lsr: r, le: e, rsf: f, rsa: a, rsr: r, re: e });
export const legs = (f = 0, a = 5, k = 0): Pose => ({ lhf: f, lha: a, lk: k, rhf: f, rha: a, rk: k });
export const pose = (...parts: Pose[]): Pose => Object.assign({}, ...parts);

/* ---------- math ---------- */
const rx = (a: number): Mat => { const c = Math.cos(a * D), s = Math.sin(a * D); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = (a: number): Mat => { const c = Math.cos(a * D), s = Math.sin(a * D); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = (a: number): Mat => { const c = Math.cos(a * D), s = Math.sin(a * D); return [c, -s, 0, s, c, 0, 0, 0, 1]; };

function mul(a: Mat, b: Mat): Mat {
  const o = new Array(9) as Mat;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return o;
}
const mv = (m: Mat, v: Vec): Vec => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const DOWN: Vec = [0, -1, 0];

/* ---------- body shape ---------- */

/** One cross-section of the torso, from pelvis (t=0) to shoulders (t=1). */
export interface Slice {
  t: number;
  /** left-right width */
  w: number;
  /** front-back depth */
  d: number;
  /** forward offset of the slice centre from the spine (belly, chest) */
  f: number;
}

/** Everything that makes one person's mannequin look like them. Units ≈ metres. */
export interface BodyShape {
  /** segment-length multiplier; 1 = 170 cm */
  scale: number;
  /** half distance between shoulder joints / hip joints */
  shoulderHalf: number;
  hipHalf: number;
  slices: Slice[];
  arm: number;
  forearm: number;
  thigh: number;
  shin: number;
  neck: number;
  head: number;
  /** per-segment length multipliers on top of `scale` (from a body scan); 1 when absent */
  len?: Partial<Record<keyof typeof BASE_L, number>>;
  /** what the skinned human body is shaped by, beyond the numbers above */
  build?: Build;
}

export interface Build {
  /** 0 = female, 1 = male */
  male: number;
  /** body fat and muscle, 0..1 with 0.5 = average */
  fat: number;
  muscle: number;
  /** how much thicker each limb measured than a body of this build usually is; 1 when not measured */
  limbs: { arm: number; forearm: number; thigh: number; shin: number };
  /** half the measured distance between the shoulder joints (metres), when a scan gave one */
  shoulderHalf?: number;
}

export const DEFAULT_SHAPE: BodyShape = {
  scale: 1,
  shoulderHalf: 0.19,
  hipHalf: 0.09,
  slices: [
    { t: -0.04, w: 0.3, d: 0.19, f: -0.01 },
    { t: 0.14, w: 0.31, d: 0.2, f: 0 },
    { t: 0.38, w: 0.27, d: 0.18, f: 0.01 },
    { t: 0.6, w: 0.3, d: 0.19, f: 0.015 },
    { t: 0.8, w: 0.34, d: 0.21, f: 0.02 },
    { t: 0.97, w: 0.38, d: 0.15, f: 0 },
  ],
  arm: 0.085, forearm: 0.068, thigh: 0.13, shin: 0.09, neck: 0.07, head: 0.1,
};

/* base lengths at 170 cm */
export const BASE_L = { torso: 0.5, ua: 0.29, fa: 0.26, th: 0.43, sh: 0.42, ft: 0.13 };

const ease = (t: number) => t * t * (3 - 2 * t);

/** Interpolated pose at time t (seconds), looping through all frames. */
export function sample(anim: PoseAnim, t: number): Required<Pose> {
  const n = anim.frames.length;
  const out = { ...BASE };
  if (n === 1) return Object.assign(out, anim.frames[0]);
  const u = (((t / anim.dur) % 1) + 1) % 1;
  let i = 0;
  let k = 0;
  if (anim.beats && anim.beats.length === n) {
    const total = anim.beats.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (i = 0; i < n; i++) {
      const span = anim.beats[i] / total;
      if (u < acc + span || i === n - 1) { k = span > 0 ? (u - acc) / span : 1; break; }
      acc += span;
    }
    k = ease(Math.min(1, Math.max(0, k)));
  } else {
    const pos = u * n;
    i = Math.floor(pos);
    k = ease(pos - i);
  }
  const a = { ...BASE, ...anim.frames[i] };
  const b = { ...BASE, ...anim.frames[(i + 1) % n] };
  for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

export interface SolvedSlice { t: number; a: Vec; b: Vec; c: Vec; d: number }

/** Smoothly resample the few authored slices into a dense loft (no visible rings). */
const dense = new WeakMap<BodyShape, Slice[]>();
function loft(shape: BodyShape): Slice[] {
  let out = dense.get(shape);
  if (out) return out;
  const src = shape.slices;
  out = [];
  const t0 = src[0].t, t1 = src[src.length - 1].t;
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N;
    let j = 0;
    while (j < src.length - 2 && src[j + 1].t < t) j++;
    const a = src[j], b = src[j + 1];
    const k = ease(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
    out.push({ t, w: a.w + (b.w - a.w) * k, d: a.d + (b.d - a.d) * k, f: a.f + (b.f - a.f) * k });
  }
  dense.set(shape, out);
  return out;
}

interface Raw {
  pelvis: Vec; shoulderMid: Vec; neckTop: Vec; head: Vec;
  la: { sh: Vec; el: Vec; hand: Vec }; ra: { sh: Vec; el: Vec; hand: Vec };
  ll: { hip: Vec; knee: Vec; ankle: Vec; toe: Vec; heel: Vec };
  rl: { hip: Vec; knee: Vec; ankle: Vec; toe: Vec; heel: Vec };
  slices: SolvedSlice[];
  frames: Frames;
}

const norm3 = (v: Vec): Vec => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

function fk(p: Required<Pose>, shape: BodyShape, tilt: number, feet: 'flat' | 'toes' | 'point'): Raw {
  const sc = shape.scale;
  const m = shape.len ?? {};
  const len = (k: keyof typeof BASE_L) => BASE_L[k] * sc * (m[k] ?? 1);
  const L = { torso: len('torso'), ua: len('ua'), fa: len('fa'), th: len('th'), sh: len('sh'), ft: len('ft') };
  const root = rx(p.rp + tilt);
  const torso = mul(root, rx(p.spine));
  const pelvis: Vec = [0, 0, 0];
  const shoulderMid = mv(torso, [0, L.torso, 0]);
  const neckTop = mv(torso, [0, L.torso + 0.08 * sc, 0]);
  const headM = mul(torso, rx(p.neck));
  const head = add(neckTop, mv(headM, [0, shape.head + 0.02, 0.01]));

  // direction the toes point when the foot is flat: the body's forward, or toward the feet when lying
  const fwd = mv(root, [0, 0, 1]);
  const toward = mv(root, [0, -1, 0]);
  const flatDir = norm3(Math.abs(fwd[1]) < 0.7 ? [fwd[0], 0, fwd[2]] : [toward[0], 0, toward[2]]);

  const arm = (side: 1 | -1, f: number, a: number, r: number, e: number) => {
    const sh = mv(torso, [side * shape.shoulderHalf, L.torso - 0.02, 0]);
    const up = mul(torso, mul(rz(side * a), mul(rx(-f), ry(side * r))));
    const el = add(sh, mv(up, DOWN), L.ua);
    const fore = mul(up, rx(-e));
    const hand = add(el, mv(fore, DOWN), L.fa);
    return { sh, el, hand, up, fore };
  };
  const leg = (side: 1 | -1, f: number, a: number, k: number, kv: number) => {
    const hip = mv(root, [side * shape.hipHalf, 0, 0]);
    // flex first, then abduct in the body's frame: the knees stay apart even when the thigh is horizontal
    const th = mul(root, mul(rx(-f), rz(side * a)));
    const knee = add(hip, mv(th, DOWN), L.th);
    const shinM = mul(th, mul(rz(side * kv), rx(k)));
    const ankle = add(knee, mv(shinM, DOWN), L.sh);
    const shinDir = mv(shinM, DOWN);
    let toe: Vec, heel: Vec;
    if (feet === 'point') {
      toe = add(ankle, shinDir, L.ft);
      heel = ankle;
    } else if (feet === 'toes') {
      // on the toes: foot continues the shin line, bent down toward the floor
      const d = norm3([shinDir[0] * 0.5, -1, shinDir[2] * 0.5]);
      toe = add(ankle, d, L.ft);
      heel = add(ankle, [-d[0] * 0.3, 0.02, -d[2] * 0.3]);
    } else if (shinDir[1] < -0.35) {
      // foot under the knee, shin roughly vertical: sole flat on the floor, ankle above the arch
      toe = add(add(ankle, flatDir, L.ft), [0, -0.05, 0]);
      heel = add(add(ankle, flatDir, -0.05), [0, -0.05, 0]);
    } else {
      // leg horizontal / in the air: foot keeps a right angle to the shin
      toe = add(ankle, mv(shinM, [0, 0, 1]), L.ft);
      heel = ankle;
    }
    return { hip, knee, ankle, toe, heel, th, shinM };
  };

  const la = arm(1, p.lsf, p.lsa + (shape.arm - 0.085) * 60, p.lsr, p.le);
  const ra = arm(-1, p.rsf, p.rsa + (shape.arm - 0.085) * 60, p.rsr, p.re);
  const ll = leg(1, p.lhf, p.lha + (shape.thigh - 0.13) * 25, p.lk, p.lkv);
  const rl = leg(-1, p.rhf, p.rha + (shape.thigh - 0.13) * 25, p.rk, p.rkv);

  const slices: SolvedSlice[] = loft(shape).map((s) => {
    const half = Math.max(0, (s.w - s.d) / 2);
    const y = s.t * L.torso;
    return { t: s.t, c: mv(torso, [0, y, s.f]), a: mv(torso, [half, y, s.f]), b: mv(torso, [-half, y, s.f]), d: s.d };
  });
  const frames: Frames = {
    root, torso, head: headM,
    lua: la.up, lfa: la.fore, rua: ra.up, rfa: ra.fore,
    lth: ll.th, lsh: ll.shinM, rth: rl.th, rsh: rl.shinM,
  };
  return { pelvis, shoulderMid, neckTop, head, la, ra, ll, rl, slices, frames };
}

/** Lowest surface height of a body part. */
function lowest(r: Raw, c: Contact, shape: BodyShape): number {
  const y = (v: Vec, rad: number) => v[1] - rad;
  const sl = (pred: (t: number) => boolean) =>
    Math.min(...r.slices.filter((s) => pred(s.t)).map((s) => Math.min(s.a[1], s.b[1]) - s.d / 2));
  switch (c) {
    case 'hands': return Math.min(y(r.la.hand, 0.03), y(r.ra.hand, 0.03));
    case 'elbows': return Math.min(y(r.la.el, shape.forearm / 2), y(r.ra.el, shape.forearm / 2));
    case 'knees': return Math.min(y(r.ll.knee, shape.shin / 2), y(r.rl.knee, shape.shin / 2));
    case 'toes': return Math.min(y(r.ll.toe, 0.028), y(r.rl.toe, 0.028));
    case 'feet': return Math.min(y(r.ll.toe, 0.028), y(r.rl.toe, 0.028), y(r.ll.heel, 0.036), y(r.rl.heel, 0.036));
    case 'hips': return sl((t) => t < 0.3);
    case 'back': return sl((t) => t > 0.6);
    case 'torso': return sl(() => true);
  }
}

export interface SolveOpts {
  contacts?: [Contact, Contact];
  supine?: boolean;
  feet?: 'flat' | 'toes' | 'point';
}

const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Lying down: rest the limbs on the floor the torso lies on. A foot or hand
 * that is posed near the floor is brought onto it by one joint (the knee of a
 * bent leg, the hip of a straight one, the shoulder of an arm). The pull fades
 * out with height, so a limb that lifts off the floor does so without a jump.
 */
function settle(p: Required<Pose>, shape: BodyShape, feet: 'flat' | 'toes' | 'point'): Required<Pose> {
  const q = { ...p };
  const r0 = fk(q, shape, 0, feet);
  const floor = Math.min(lowest(r0, 'hips', shape), lowest(r0, 'back', shape), r0.head[1] - shape.head);
  const rest = (key: keyof Pose, lo: number, hi: number, share: number, height: (r: Raw) => number) => {
    const from = q[key];
    const at = (v: number) => { q[key] = v; return height(fk(q, shape, 0, feet)) - floor; };
    const pull = share * (1 - smooth(0.12, 0.3, at(from)));
    if (pull <= 0) { q[key] = from; return; }
    let a = from + lo, b = from + hi, ha = at(a), hb = at(b);
    let best = Math.abs(ha) < Math.abs(hb) ? a : b;
    if (Math.sign(ha) !== Math.sign(hb)) {
      for (let i = 0; i < 14; i++) {
        const m = (a + b) / 2, hm = at(m);
        if (Math.sign(hm) === Math.sign(ha)) { a = m; ha = hm; } else { b = m; hb = hm; }
      }
      best = (a + b) / 2;
    }
    q[key] = from + (best - from) * pull;
  };
  const sole = (l: Raw['ll']) => Math.min(l.toe[1] - 0.028, l.heel[1] - 0.036);
  for (const s of ['l', 'r'] as const) {
    const leg = (r: Raw) => sole(s === 'l' ? r.ll : r.rl);
    const bent = smooth(15, 35, q[`${s}k`]);
    rest(`${s}hf`, -25, 8, 1 - bent, leg);
    rest(`${s}k`, -40, 40, bent, leg);
    rest(`${s}sf`, -30, 10, 1, (r) => (s === 'l' ? r.la : r.ra).hand[1] - 0.03);
  }
  return q;
}

/**
 * Forward kinematics with floor contact:
 *  1. if two contact groups are given, tilt the whole body until both touch the floor;
 *  2. rest the lowest surface on the floor (y = 0).
 */
export function solve(p: Required<Pose>, shape: BodyShape = DEFAULT_SHAPE, opts: SolveOpts = {}): Skeleton {
  const feet = opts.feet ?? (p.rp > 40 ? 'toes' : 'flat');
  if (opts.supine) p = settle(p, shape, feet);
  let tilt = 0;
  if (opts.contacts) {
    const [ca, cb] = opts.contacts;
    const gap = (d: number) => { const r = fk(p, shape, d, feet); return lowest(r, ca, shape) - lowest(r, cb, shape); };
    let lo = -40, hi = 40, glo = gap(lo), ghi = gap(hi);
    if (Math.sign(glo) === Math.sign(ghi)) tilt = Math.abs(glo) < Math.abs(ghi) ? lo : hi;
    else {
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2, gm = gap(mid);
        if (Math.sign(gm) === Math.sign(glo)) { lo = mid; glo = gm; } else { hi = mid; ghi = gm; }
      }
      tilt = (lo + hi) / 2;
    }
  }
  const r = fk(p, shape, tilt, feet);

  // rest on the floor: the lowest surface of any part touches y = 0
  const parts: Contact[] = ['hands', 'elbows', 'knees', 'feet', 'hips', 'back'];
  let minY = r.head[1] - shape.head;
  for (const c of parts) minY = Math.min(minY, lowest(r, c, shape));
  const drop = -minY + p.lift;
  const g = (v: Vec): Vec => [v[0], v[1] + drop, v[2]];
  const { la, ra, ll, rl } = r;

  return {
    seg: {
      torso: [g(r.pelvis), g(r.shoulderMid)],
      pelvis: [g(ll.hip), g(rl.hip)],
      shoulders: [g(la.sh), g(ra.sh)],
      neck: [g(r.shoulderMid), g(r.neckTop)],
      lua: [g(la.sh), g(la.el)], lfa: [g(la.el), g(la.hand)],
      rua: [g(ra.sh), g(ra.el)], rfa: [g(ra.el), g(ra.hand)],
      lth: [g(ll.hip), g(ll.knee)], lsh: [g(ll.knee), g(ll.ankle)], lft: [g(ll.heel), g(ll.toe)],
      rth: [g(rl.hip), g(rl.knee)], rsh: [g(rl.knee), g(rl.ankle)], rft: [g(rl.heel), g(rl.toe)],
    },
    head: g(r.head),
    hands: [g(la.hand), g(ra.hand)],
    slices: r.slices.map((s) => ({ ...s, a: g(s.a), b: g(s.b), c: g(s.c) })),
    frames: r.frames,
  };
}
