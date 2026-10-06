/**
 * A real human body for the mannequin.
 *
 * The mesh, its skin weights and its body-shape targets come from MakeHuman
 * (CC0), packed into /human.bin by scripts/build-human.mjs. Here it is
 *   1. shaped to one person: sex, fat and muscle pick the blend of targets,
 *      then the torso and limbs are scaled to that person's measurements;
 *   2. posed by the app's own skeleton: every body part is placed straight
 *      from the solved joints and blended with the skin weights on the CPU;
 *   3. drawn as plain triangles, which costs a phone far less than the ray
 *      marcher it replaces.
 *
 * One WebGL context is shared by the whole app; each canvas copies the result.
 */
import type { Camera, Cylinder } from './gl';
import type { BodyShape, Build, Mat, SegName, Skeleton, Vec } from './pose';

const FILE = '/human.bin?v=3';

interface Target { name: string; idx: Uint16Array; off: Int16Array; joints: number[][] }
interface Data {
  nv: number; nt: number; quant: number;
  bones: string[]; jointNames: string[]; joints: number[][];
  pos: Float32Array; tris: Uint16Array; kind: Uint8Array; skinB: Uint8Array; skinW: Uint8Array;
  targets: Target[];
}

function parse(buf: ArrayBuffer): Data {
  const len = new DataView(buf).getUint32(0, true);
  const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len)));
  const base = 4 + len;
  return {
    ...h,
    pos: new Float32Array(buf, base + h.pos, h.nv * 3),
    tris: new Uint16Array(buf, base + h.tris, h.nt * 3),
    kind: new Uint8Array(buf, base + h.kind, h.nv),
    skinB: new Uint8Array(buf, base + h.skinB, h.nv * 4),
    skinW: new Uint8Array(buf, base + h.skinW, h.nv * 4),
    targets: h.targets.map((t: { name: string; n: number; idx: number; off: number; joints: number[][] }) => ({
      name: t.name,
      idx: new Uint16Array(buf, base + t.idx, t.n),
      off: new Int16Array(buf, base + t.off, t.n * 3),
      joints: t.joints,
    })),
  };
}

/* ---------- small vector maths (matrices are row-major, like the solver's) ---------- */
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec): Vec => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
/** the part of v at right angles to `axis`, or `fallback` when v runs along it */
const orth = (v: Vec, axis: Vec, fallback: Vec): Vec => {
  const k = dot(v, axis);
  const o: Vec = [v[0] - axis[0] * k, v[1] - axis[1] * k, v[2] - axis[2] * k];
  return len(o) < 1e-3 ? norm(fallback) : norm(o);
};
const fromCols = (x: Vec, y: Vec, z: Vec): Mat => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
const IDENT: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** a · bᵀ */
const mulT = (a: Mat, b: Mat): Mat => {
  const o = new Array(9) as Mat;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j * 3] + a[i * 3 + 1] * b[j * 3 + 1] + a[i * 3 + 2] * b[j * 3 + 2];
  return o;
};
const mul = (a: Mat, b: Mat): Mat => mulT(a, [b[0], b[3], b[6], b[1], b[4], b[7], b[2], b[5], b[8]]);
type Quat = [number, number, number, number];
/** Rotation matrix → quaternion (x, y, z, w) with w >= 0. */
function quat(m: Mat): Quat {
  let x: number, y: number, z: number, w: number;
  const tr = m[0] + m[4] + m[8];
  if (tr > 0) { const k = Math.sqrt(tr + 1) * 2; w = k / 4; x = (m[7] - m[5]) / k; y = (m[2] - m[6]) / k; z = (m[3] - m[1]) / k; }
  else if (m[0] > m[4] && m[0] > m[8]) { const k = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; w = (m[7] - m[5]) / k; x = k / 4; y = (m[1] + m[3]) / k; z = (m[2] + m[6]) / k; }
  else if (m[4] > m[8]) { const k = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; w = (m[2] - m[6]) / k; x = (m[1] + m[3]) / k; y = k / 4; z = (m[5] + m[7]) / k; }
  else { const k = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; w = (m[3] - m[1]) / k; x = (m[2] + m[6]) / k; y = (m[5] + m[7]) / k; z = k / 4; }
  return w < 0 ? [-x, -y, -z, -w] : [x, y, z, w];
}
/** Part of the rotation m: the same axis, `share` of the angle (the shorter way round). */
function partTurn(m: Mat, share: number): Mat {
  let [x, y, z, w] = quat(m);
  const half = Math.acos(Math.min(1, w)), sin = Math.sin(half);
  if (sin < 1e-5) return IDENT;
  const k = Math.sin(half * share) / sin;
  x *= k; y *= k; z *= k; w = Math.cos(half * share);
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ---------- one person's body ---------- */

const B = {
  pelvis: 0, waist: 1, chest: 2, head: 3,
  armUL: 4, armLL: 5, handL: 6, armUR: 7, armLR: 8, handR: 9,
  thighL: 10, shinL: 11, footL: 12, thighR: 13, shinR: 14, footR: 15,
  shoulderL: 16, shoulderR: 17,
} as const;
const NB = 18;

/** Which skeleton segments light up each body part of the mesh. */
const SEGS: SegName[][] = [
  ['pelvis'], ['torso'], ['torso', 'shoulders'], ['neck'],
  ['lua'], ['lfa'], [], ['rua'], ['rfa'], [],
  ['lth'], ['lsh'], ['lft'], ['rth'], ['rsh'], ['rft'],
  ['shoulders'], ['shoulders'],
];

interface Rest { o: Vec; r: Mat; len: number }

export interface Fit {
  /** the shape to solve poses with: the joints sit where this body's joints are */
  shape: BodyShape;
  pos: Float32Array;
  nrm: Float32Array;
  /** per vertex: inside the shorts (>0), inside the shirt (>0), under the hair (>0) */
  cloth: Float32Array;
  rest: Rest[];
  /** hip midpoint → shoulder midpoint, and the head joint, in the rest pose */
  torsoH: number;
  headJoint: Vec;
  /** side and front scale of the three torso parts, and the thickness of every limb */
  torso: [number, number][];
  girth: { arm: number; forearm: number; thigh: number; shin: number; hand: number };
  /** dressed as a woman: leggings, a coloured top and the hair tied up in a bun (centre and radius, rest pose) */
  female: boolean;
  bun: { c: Vec; r: number } | null;
  /**
   * per vertex, around a shoulder: how much it turns about the joint (1, the round top of the
   * shoulder) rather than being pulled straight between chest and arm (0, the skin of the armpit)
   */
  round: Float32Array;
  /** which way each palm faces, in the hand's own rest frame (x, z; the fingers run along -y) */
  palm: [number, number][];
}

/** Which vertices each vertex shares an edge with (built once, on first use). */
const nearBy = new WeakMap<Data, { start: Uint32Array; list: Uint16Array }>();
function neighbours(d: Data): { start: Uint32Array; list: Uint16Array } {
  let n = nearBy.get(d);
  if (n) return n;
  const sets: Set<number>[] = Array.from({ length: d.nv }, () => new Set());
  for (let i = 0; i < d.tris.length; i += 3) {
    const t = [d.tris[i], d.tris[i + 1], d.tris[i + 2]];
    for (let k = 0; k < 3; k++) { sets[t[k]].add(t[(k + 1) % 3]); sets[t[(k + 1) % 3]].add(t[k]); }
  }
  const start = new Uint32Array(d.nv + 1);
  sets.forEach((set, v) => { start[v + 1] = start[v] + set.size; });
  const list = new Uint16Array(start[d.nv]);
  sets.forEach((set, v) => { let k = start[v]; for (const u of set) list[k++] = u; });
  n = { start, list };
  nearBy.set(d, n);
  return n;
}

/** How far the bust is filled out between MakeHuman's average (0) and largest (1) cup. */
const BUST = 0.35;

/** How round the skin of the armpit stays under a lifted arm (0 = pulled flat, 1 = as round as the shoulder's top). */
const ARMPIT = 0.2;

/** How much of the arm's turn the cap of the shoulder takes (1 = all of it; less leaves a corner under a raised arm). */
const CAP = 1;

/**
 * A hand lying on the floor: fingers along `fingers` (level), palm down.
 * `palm` is the palm's direction in the hand's rest frame.
 */
function palmDown(palm: [number, number], fingers: Vec): Mat {
  const y: Vec = [-fingers[0], -fingers[1], -fingers[2]]; // the hand's own y runs from the fingers to the wrist
  const down: Vec = [0, -1, 0];
  const across = cross(y, down); // where the hand's (y × palm) axis goes
  // rest axes in the (palm, across) pair: x = palm·px − across·pz, z = palm·pz + across·px
  const [px, pz] = palm;
  const x: Vec = [down[0] * px - across[0] * pz, down[1] * px - across[1] * pz, down[2] * px - across[2] * pz];
  const z: Vec = [down[0] * pz + across[0] * px, down[1] * pz + across[1] * px, down[2] * pz + across[2] * px];
  return fromCols(x, y, z);
}

/** How far a pointed foot stretches past the line of the shin (radians). */
const POINT = 0.3;

/** How far the sole lies below the ankle in the solver's skeleton. */
const ANKLE_H = 0.086;

function fitBody(d: Data, shape: BodyShape): Fit {
  const build: Build = shape.build ?? { male: 0.5, fat: 0.5, muscle: 0.5, limbs: { arm: 1, forearm: 1, thigh: 1, shin: 1 } };

  /* 1. blend the targets for this sex, fat and muscle */
  const three = (v: number) => [Math.max(0, 1 - 2 * v), 1 - Math.abs(2 * v - 1), Math.max(0, 2 * v - 1)];
  const M = three(build.muscle), W = three(build.fat);
  const levels = ['min', 'average', 'max'];
  const mix = new Map<string, number>();
  for (const [g, gw] of [['male', build.male], ['female', 1 - build.male]] as [string, number][]) {
    mix.set(`caucasian-${g}-young`, gw);
    M.forEach((m, i) => W.forEach((w, j) => mix.set(`universal-${g}-young-${levels[i]}muscle-${levels[j]}weight`, gw * m * w)));
  }
  // the bust under a shirt: full and round rather than pointed
  const womanly = 1 - build.male;
  W.forEach((w, j) => {
    mix.set(`female-young-averagemuscle-${levels[j]}weight-averagecup-maxfirmness`, womanly * w * (1 - BUST));
    mix.set(`female-young-averagemuscle-${levels[j]}weight-maxcup-maxfirmness`, womanly * w * BUST);
  });
  mix.set('breast-point-decr', womanly);
  const pos = new Float32Array(d.pos);
  const J = d.joints.map((j) => [...j] as Vec);
  for (const t of d.targets) {
    const w = mix.get(t.name) ?? 0;
    if (w < 1e-4) continue;
    const k = w * d.quant;
    for (let i = 0; i < t.idx.length; i++) {
      const v = t.idx[i] * 3;
      pos[v] += t.off[i * 3] * k;
      pos[v + 1] += t.off[i * 3 + 1] * k;
      pos[v + 2] += t.off[i * 3 + 2] * k;
    }
    t.joints.forEach((dj, n) => { for (let c = 0; c < 3; c++) J[n][c] += dj[c] * w; });
  }
  const joint = (name: string): Vec => J[d.jointNames.indexOf(name)];

  /* 2. rest frame of every part: x = hinge axis, y = up the limb, z = front */
  const hipMid = mid(joint('hip.L'), joint('hip.R'));
  const shMid = mid(joint('shoulder.L'), joint('shoulder.R'));
  const torsoH = shMid[1] - hipMid[1];
  const rest: Rest[] = new Array(NB);
  const trunk: Rest = { o: hipMid, r: IDENT, len: torsoH };
  rest[B.pelvis] = rest[B.waist] = rest[B.chest] = trunk;
  rest[B.head] = { o: joint('head'), r: IDENT, len: 1 };
  for (const s of ['L', 'R'] as const) {
    const sh = joint(`shoulder.${s}`), el = joint(`elbow.${s}`), wr = joint(`wrist.${s}`);
    const u = norm(sub(el, sh)), f = norm(sub(wr, el));
    // the elbow's hinge: at right angles to the upper arm and the (slightly bent) forearm
    const hinge = norm(cross(f, u));
    const frame = (dir: Vec): Mat => {
      const y: Vec = [-dir[0], -dir[1], -dir[2]];
      const z = norm(cross(hinge, y));
      return fromCols(cross(y, z), y, z);
    };
    rest[B[`armU${s}`]] = { o: sh, r: frame(u), len: len(sub(el, sh)) };
    rest[B[`armL${s}`]] = { o: el, r: frame(f), len: len(sub(wr, el)) };
    rest[B[`hand${s}`]] = { o: wr, r: frame(f), len: 1 };
    rest[B[`shoulder${s}`]] = { o: sh, r: IDENT, len: 1 };

    const hip = joint(`hip.${s}`), knee = joint(`knee.${s}`), ankle = joint(`ankle.${s}`);
    const leg = (a: Vec, b: Vec): Rest => {
      const y = norm(sub(a, b));
      const x = orth([1, 0, 0], y, [1, 0, 0]);
      return { o: a, r: fromCols(x, y, cross(x, y)), len: len(sub(b, a)) };
    };
    rest[B[`thigh${s}`]] = leg(hip, knee);
    rest[B[`shin${s}`]] = leg(knee, ankle);
    rest[B[`foot${s}`]] = { o: ankle, r: IDENT, len: 1 }; // origin moved to the sole below
  }

  /* 3. what this body measures, to scale it to the person */
  const weightOf = (v: number, ...bones: number[]) => {
    let w = 0;
    for (let k = 0; k < 4; k++) if (bones.includes(d.skinB[v * 4 + k])) w += d.skinW[v * 4 + k];
    return w / 255;
  };
  const BIN = 0.02, T0 = -0.1, NBIN = 56;
  const bins = Array.from({ length: NBIN }, () => [Infinity, -Infinity, Infinity, -Infinity]);
  let top = -Infinity, sole = Infinity;
  const soles = { L: Infinity, R: Infinity };
  for (let v = 0; v < d.nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    if (d.kind[v] !== 0) continue;
    top = Math.max(top, y);
    sole = Math.min(sole, y);
    if (weightOf(v, B.footL) > 0.5) soles.L = Math.min(soles.L, y);
    if (weightOf(v, B.footR) > 0.5) soles.R = Math.min(soles.R, y);
    const t = (y - hipMid[1]) / torsoH;
    const i = Math.floor((t - T0) / BIN);
    if (i < 0 || i >= NBIN) continue;
    // the hips are measured across the top of the thighs too
    const body = weightOf(v, B.pelvis, B.waist, B.chest, B.shoulderL, B.shoulderR) + (t < 0.2 ? weightOf(v, B.thighL, B.thighR) : 0);
    if (body < 0.5) continue;
    const b = bins[i];
    b[0] = Math.min(b[0], x); b[1] = Math.max(b[1], x); b[2] = Math.min(b[2], z); b[3] = Math.max(b[3], z);
  }
  /** width and depth of the widest (or narrowest) cross-section between two heights */
  const section = (t0: number, t1: number, widest: boolean): [number, number] => {
    let best: number[] | null = null;
    for (let i = Math.floor((t0 - T0) / BIN); i <= Math.floor((t1 - T0) / BIN); i++) {
      // a thin band can miss the vertices at the very edge: measure it together with its neighbours
      const b = [Infinity, -Infinity, Infinity, -Infinity];
      for (const n of [bins[i - 1], bins[i], bins[i + 1]]) {
        if (!n) continue;
        b[0] = Math.min(b[0], n[0]); b[1] = Math.max(b[1], n[1]); b[2] = Math.min(b[2], n[2]); b[3] = Math.max(b[3], n[3]);
      }
      if (b[1] < b[0]) continue;
      if (!best || (widest ? b[1] - b[0] > best[1] - best[0] : b[1] - b[0] < best[1] - best[0])) best = b;
    }
    return best ? [best[1] - best[0], best[3] - best[2]] : [0.3, 0.2];
  };
  const mesh = { hip: section(-0.06, 0.16, true), waist: section(0.3, 0.5, false), chest: section(0.66, 0.84, true) };
  const want = { hip: shape.slices[1], waist: shape.slices[2], chest: shape.slices[4] };
  const fitTo = (have: [number, number], to: { w: number; d: number }): [number, number] =>
    [clamp(to.w / have[0], 0.7, 1.6), clamp(to.d / have[1], 0.7, 1.6)];
  const torso = [fitTo(mesh.hip, want.hip), fitTo(mesh.waist, want.waist), fitTo(mesh.chest, want.chest)];
  const shoulderHalf = (joint('shoulder.L')[0] - joint('shoulder.R')[0]) / 2;
  // a measured shoulder width decides how wide the chest is drawn
  if (build.shoulderHalf) torso[2][0] = clamp(build.shoulderHalf / shoulderHalf, 0.7, 1.6);
  const hipHalf = (joint('hip.L')[0] - joint('hip.R')[0]) / 2;

  // limbs keep the mesh's own thickness for this height, times what a scan found
  const tall = (shape.scale * 1.7) / (top - sole);
  const girth = {
    arm: tall * build.limbs.arm, forearm: tall * build.limbs.forearm,
    thigh: tall * build.limbs.thigh, shin: tall * build.limbs.shin, hand: tall,
  };
  for (const s of ['L', 'R'] as const) {
    const foot = rest[B[`foot${s}`]];
    foot.o = [foot.o[0], soles[s], foot.o[2]];
  }

  // which way the palms face: a hand is thinnest through the palm, and the fingertips curl toward it
  const palm = ([B.handL, B.handR] as number[]).map((b): [number, number] => {
    const { o, r } = rest[b];
    const pts: [number, number, number][] = [];
    for (let v = 0; v < d.nv; v++) {
      if (weightOf(v, b) < 0.9) continue;
      const p = sub([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], o);
      pts.push([dot(p, [r[0], r[3], r[6]]), dot(p, [r[1], r[4], r[7]]), dot(p, [r[2], r[5], r[8]])]);
    }
    if (!pts.length) return [0, 1];
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, mz = pts.reduce((a, p) => a + p[2], 0) / pts.length;
    let xx = 0, xz = 0, zz = 0;
    for (const p of pts) { xx += (p[0] - mx) ** 2; xz += (p[0] - mx) * (p[2] - mz); zz += (p[2] - mz) ** 2; }
    const turn = Math.atan2(2 * xz, xx - zz) / 2 + Math.PI / 2; // the direction the hand is thinnest in
    let n: [number, number] = [Math.cos(turn), Math.sin(turn)];
    const tips = [...pts].sort((a, b) => a[1] - b[1]).slice(0, Math.max(1, Math.floor(pts.length * 0.15)));
    const curl = tips.reduce((a, p) => a + (p[0] - mx) * n[0] + (p[2] - mz) * n[1], 0);
    if (curl < 0) n = [-n[0], -n[1]];
    return n;
  });

  // the top and outside of a shoulder keeps its roundness when the arm lifts; the armpit under it stretches flat
  const round = new Float32Array(d.nv);
  for (let v = 0; v < d.nv; v++) {
    const left = pos[v * 3] > 0;
    const c = rest[left ? B.armUL : B.armUR].o;
    const above = (pos[v * 3] - c[0]) * (left ? 0.5 : -0.5) + (pos[v * 3 + 1] - c[1]) * 0.87;
    const t = clamp((above + 0.03) / 0.06, 0, 1);
    round[v] = ARMPIT + (1 - ARMPIT) * t * t * (3 - 2 * t);
  }

  /* 4. clothes: shorts and a T-shirt, marked on the skin in the rest pose */
  const cloth = new Float32Array(d.nv * 3).fill(-1);
  // the skull, to put short hair on: everything on the head above the jaw
  const skull = [Infinity, -Infinity, Infinity, -Infinity];
  const jaw = joint('head')[1] + 0.03;
  for (let v = 0; v < d.nv; v++) {
    const y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    if (d.kind[v] !== 0 || y < jaw || weightOf(v, B.head) < 0.5) continue;
    skull[0] = Math.min(skull[0], y); skull[1] = Math.max(skull[1], y); skull[2] = Math.min(skull[2], z); skull[3] = Math.max(skull[3], z);
  }
  const crown: Vec = [0, skull[1] - (skull[3] - skull[2]) * 0.5, (skull[2] + skull[3]) / 2];
  const scalp = norm([0, 0.8, -0.6]); // up and back from the middle of the head
  // a man gets shorts and cropped hair; a woman leggings to the calf, fuller hair and a bun
  const female = build.male < 0.35;
  const hairline = female ? 0 : 0.08;
  const headR = (skull[3] - skull[2]) / 2;
  const back = norm([0, 0.8, -0.6]); // high on the head, so it is not lain on
  const bun = female
    ? { c: [crown[0] + back[0] * headR, crown[1] + back[1] * headR, crown[2] + back[2] * headR] as Vec, r: headR * 0.5 }
    : null;
  const waistband = hipMid[1] + 0.2 * torsoH;
  const knee = joint('knee.L')[1];
  const hem = female ? knee - 0.45 * (knee - joint('ankle.L')[1]) : hipMid[1] - 0.5 * (hipMid[1] - knee);
  const collar = joint('neck')[1] - 0.012;
  for (let v = 0; v < d.nv; v++) {
    if (d.kind[v] !== 0) continue;
    const p: Vec = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    const trunkW = weightOf(v, B.pelvis, B.waist, B.chest, B.shoulderL, B.shoulderR);
    const legW = weightOf(v, B.thighL, B.thighR) + (female ? weightOf(v, B.shinL, B.shinR) : 0);
    if (trunkW + legW >= 0.5) cloth[v * 3] = Math.min(waistband - p[1], p[1] - hem);
    if (weightOf(v, B.head) >= 0.5)
      cloth[v * 3 + 2] = Math.min(dot(norm(sub(p, crown)), scalp) - hairline, (p[1] - crown[1] + 0.05) * 10);
    const side = weightOf(v, B.armUL) > 0.5 ? 'L' : weightOf(v, B.armUR) > 0.5 ? 'R' : null;
    if (side) {
      const arm = rest[B[`armU${side}`]];
      const along = -dot(sub(p, arm.o), [arm.r[1], arm.r[4], arm.r[7]]);
      cloth[v * 3 + 1] = 0.45 * arm.len - along;
    } else if (trunkW >= 0.5) cloth[v * 3 + 1] = Math.min(p[1] - waistband + 0.015, collar - p[1]);
  }

  // cloth hangs smooth: iron the body's small details out from under it.
  // Near a hem only sideways, so the hem stays level; well inside the shirt in every direction.
  const near = neighbours(d);
  const iron = (verts: number[], passes: number, axes: number[]) => {
    const next = new Float32Array(verts.length * 3);
    for (let pass = 0; pass < passes; pass++) {
      verts.forEach((v, i) => {
        const from = near.start[v], to = near.start[v + 1], n = to - from || 1;
        for (const c of axes) {
          let sum = 0;
          for (let k = from; k < to; k++) sum += pos[near.list[k] * 3 + c];
          next[i * 3 + c] = (pos[v * 3 + c] + sum / n) / 2;
        }
      });
      verts.forEach((v, i) => { for (const c of axes) pos[v * 3 + c] = next[i * 3 + c]; });
    }
  };
  const dressed: number[] = [], shirt: number[] = [];
  for (let v = 0; v < d.nv; v++) {
    if (cloth[v * 3] > 0.01 || cloth[v * 3 + 1] > 0.01) dressed.push(v);
    if (cloth[v * 3 + 1] > 0.05 && cloth[v * 3] <= 0) shirt.push(v);
  }
  // a shirt lies over the chest as one smooth curve: the small tip of each side is
  // ironed flat into the round of the cloth around it
  for (const side of [1, -1]) {
    const front = shirt.filter((v) => pos[v * 3] * side > 0.02 && pos[v * 3 + 2] > hipMid[2]
      && pos[v * 3 + 1] > hipMid[1] + 0.5 * torsoH && pos[v * 3 + 1] < hipMid[1] + 0.9 * torsoH);
    if (!front.length) continue;
    const tip = front.reduce((a, v) => (pos[v * 3 + 2] > pos[a * 3 + 2] ? v : a));
    const far = (v: number) => Math.hypot(pos[v * 3] - pos[tip * 3], pos[v * 3 + 1] - pos[tip * 3 + 1]);
    iron(front.filter((v) => far(v) < 0.03), 60, [0, 1, 2]);
  }
  iron(dressed, 8, [0, 2]);
  iron(shirt, 3, [0, 1, 2]);

  /* 5. smooth normals */
  const nrm = new Float32Array(d.nv * 3);
  for (let i = 0; i < d.tris.length; i += 3) {
    const a = d.tris[i] * 3, b = d.tris[i + 1] * 3, c = d.tris[i + 2] * 3;
    const n = cross(
      [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]],
      [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]],
    );
    for (const v of [a, b, c]) { nrm[v] += n[0]; nrm[v + 1] += n[1]; nrm[v + 2] += n[2]; }
  }
  for (let v = 0; v < nrm.length; v += 3) {
    const l = Math.hypot(nrm[v], nrm[v + 1], nrm[v + 2]) || 1;
    nrm[v] /= l; nrm[v + 1] /= l; nrm[v + 2] /= l;
  }

  return {
    shape: { ...shape, shoulderHalf: shoulderHalf * torso[2][0], hipHalf: hipHalf * torso[0][0] },
    pos, nrm, cloth, rest, torsoH, headJoint: joint('head'), torso, girth, female, bun, palm, round,
  };
}

/* ---------- drawing ---------- */

export interface HumanColors {
  skin: number[]; top: number[]; topFemale: number[]; bottom: number[]; hair: number[]; hot: number[]; iron: number[];
  shadow: number;
}

const VERT = `
attribute vec3 aPos; attribute vec3 aNrm; attribute float aTint; attribute vec3 aCloth; attribute float aKind;
uniform mat3 uRot; uniform vec4 uProj; uniform float uCam; uniform mediump float uShadow;
varying vec3 vN; varying float vTint; varying vec3 vCloth; varying float vKind;
void main(){
  vec3 p = aPos;
  // the shadow is the same body laid flat on the floor, away from the light
  if (uShadow > 0.5) p = vec3(p.x + p.y*0.16, 0.0, p.z + p.y*0.22);
  vec3 c = uRot * p;
  float depth = uCam - c.z;
  gl_Position = vec4(uProj.x*c.x + uProj.z*depth, uProj.y*c.y + uProj.w*depth, (11.0*depth - 20.0)/9.0, depth);
  vN = uRot * aNrm; vTint = aTint; vCloth = aCloth; vKind = aKind;
}`;

const FRAG = `
precision mediump float;
uniform vec3 uSkin, uTop, uBottom, uHair, uHot, uIron; uniform float uShadow; uniform float uShadowA;
varying vec3 vN; varying float vTint; varying vec3 vCloth; varying float vKind;
void main(){
  if (uShadow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, uShadowA); return; }
  vec3 base = uSkin;
  float gloss = 0.22;
  if (vKind > 3.5) { base = uIron; gloss = 0.5; }
  else if (vKind > 2.5) { base = uHair; gloss = 0.08; }
  else if (vKind > 1.5) base = vec3(0.13, 0.09, 0.07);
  else if (vKind > 0.5) base = vec3(0.94);
  else if (vCloth.x > 0.0) { base = uBottom; gloss = 0.05; }
  else if (vCloth.y > 0.0) { base = uTop; gloss = 0.05; }
  else if (vCloth.z > 0.0) { base = uHair; gloss = 0.08; }
  // working muscles: a clear band of colour, not a wash that muddies the clothes
  base = mix(base, uHot, smoothstep(0.3, 0.7, vTint) * 0.82);
  vec3 n = normalize(vN);
  vec3 key = normalize(vec3(-0.4, 0.75, 0.55));
  float d = dot(n, key);
  float lit = 0.38 + 0.5 * max(d, 0.0) + 0.12 * (d * 0.5 + 0.5) + 0.1 * max(dot(n, normalize(vec3(0.7, 0.1, 0.4))), 0.0);
  vec3 h = normalize(key + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, h), 0.0), 24.0) * gloss;
  float rim = pow(1.0 - max(n.z, 0.0), 3.0) * 0.1;
  gl_FragColor = vec4(base * lit + spec + rim, 1.0);
}`;

/** Floats per vertex in the buffer that changes every frame: position, normal, highlight. */
const STRIDE = 7;
const CYL = 14;
/** Rings and segments of the hair bun. */
const BUN = 10;

class Human {
  private canvas = document.createElement('canvas');
  private gl: WebGLRenderingContext;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private at: Record<string, number> = {};
  private live: WebGLBuffer; private clothBuf: WebGLBuffer; private kindBuf: WebGLBuffer; private index: WebGLBuffer; private propBuf: WebGLBuffer;
  private out: Float32Array;
  private bones = new Float32Array(NB * 21);
  /**
   * Around a shoulder, plain blending of two far-apart turns lets the flesh
   * cave in (an arm raised overhead looks deflated). There the turns are
   * blended as rotations about the joint instead, which keeps the volume.
   * Per body part: its turn as a quaternion, its stretch, and where it puts each shoulder joint.
   */
  private turn = new Float32Array(NB * 4);
  private stretch = new Float32Array(NB * 9);
  private pivot = new Float32Array(NB * 6);
  /** per vertex: 0, or 1 / 2 when it belongs to the left / right shoulder */
  private joint: Uint8Array;
  private props = new Float32Array((6 * CYL * 12 + BUN * BUN * 12) * STRIDE);
  private fits = new Map<string, Fit>();
  private byShape = new WeakMap<BodyShape, Fit>();
  private shown: Fit | null = null;

  constructor(private d: Data) {
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, antialias: true, stencil: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    gl.useProgram(prog);
    for (const n of ['uRot', 'uProj', 'uCam', 'uShadow', 'uShadowA', 'uSkin', 'uTop', 'uBottom', 'uHair', 'uHot', 'uIron'])
      this.loc[n] = gl.getUniformLocation(prog, n);
    for (const n of ['aPos', 'aNrm', 'aTint', 'aCloth', 'aKind']) this.at[n] = gl.getAttribLocation(prog, n);

    this.out = new Float32Array(d.nv * STRIDE);
    this.joint = new Uint8Array(d.nv);
    for (let v = 0; v < d.nv; v++)
      for (let k = 0; k < 4; k++) {
        if (!d.skinW[v * 4 + k]) continue;
        const b = d.skinB[v * 4 + k];
        if (b === B.armUL || b === B.shoulderL) this.joint[v] = 1;
        else if (b === B.armUR || b === B.shoulderR) this.joint[v] = 2;
      }
    this.live = gl.createBuffer()!;
    this.clothBuf = gl.createBuffer()!;
    this.propBuf = gl.createBuffer()!;
    this.kindBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.kindBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d.kind), gl.STATIC_DRAW);
    this.index = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.tris, gl.STATIC_DRAW);
  }

  /** This body shaped to one person. Shapes that describe the same body share one fit. */
  fit(shape: BodyShape): Fit {
    let f = this.byShape.get(shape);
    if (f) return f;
    const key = JSON.stringify([shape.build, shape.scale, shape.slices, shape.len]);
    f = this.fits.get(key);
    if (!f) {
      if (this.fits.size > 12) this.fits.clear();
      f = fitBody(this.d, shape);
      this.fits.set(key, f);
    }
    this.byShape.set(shape, f);
    return f;
  }

  /** Where every body part is right now: 3×3 + offset for positions, 3×3 for normals. */
  private place(f: Fit, sk: Skeleton, flat: Vec | null): void {
    const { bones } = this;
    const fr = sk.frames, g = sk.seg;
    const set = (b: number, rn: Mat, s: Vec, on: Vec) => {
      const { o, r } = f.rest[b];
      const m = b * 21;
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          let a = 0, n = 0;
          for (let k = 0; k < 3; k++) {
            const q = rn[i * 3 + k] * r[j * 3 + k];
            a += q * s[k];
            n += q / s[k];
          }
          bones[m + i * 3 + j] = a;
          bones[m + 12 + i * 3 + j] = n;
        }
      for (let i = 0; i < 3; i++)
        bones[m + 9 + i] = on[i] - (bones[m + i * 3] * o[0] + bones[m + i * 3 + 1] * o[1] + bones[m + i * 3 + 2] * o[2]);
      this.turn.set(quat(mulT(rn, r)), b * 4);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
          this.stretch[b * 9 + i * 3 + j] = r[i * 3] * s[0] * r[j * 3] + r[i * 3 + 1] * s[1] * r[j * 3 + 1] + r[i * 3 + 2] * s[2] * r[j * 3 + 2];
    };
    const through = (b: number, p: Vec): Vec => {
      const m = b * 21;
      return [0, 1, 2].map((i) => bones[m + i * 3] * p[0] + bones[m + i * 3 + 1] * p[1] + bones[m + i * 3 + 2] * p[2] + bones[m + 9 + i]) as Vec;
    };

    // trunk: hips follow the pelvis, chest the torso, the waist bends halfway between
    const pelvis = g.torso[0];
    const up = len(sub(mid(g.shoulders[0], g.shoulders[1]), pelvis)) / f.torsoH;
    const half = fr.root.map((v, i) => (v + fr.torso[i]) / 2);
    const hy = norm([half[1], half[4], half[7]]);
    const hx = orth([half[0], half[3], half[6]], hy, [1, 0, 0]);
    set(B.pelvis, fr.root, [f.torso[0][0], up, f.torso[0][1]], pelvis);
    set(B.waist, fromCols(hx, hy, cross(hx, hy)), [f.torso[1][0], up, f.torso[1][1]], pelvis);
    set(B.chest, fr.torso, [f.torso[2][0], up, f.torso[2][1]], pelvis);
    set(B.head, fr.head, [up, up, up], through(B.chest, f.headJoint));

    // the cap of each shoulder goes with its arm, as the muscle over the joint does
    const chest: Vec = [f.torso[2][0], up, f.torso[2][1]];
    for (const [b, arm, now, at] of [[B.shoulderL, B.armUL, fr.lua, g.lua[0]], [B.shoulderR, B.armUR, fr.rua, g.rua[0]]] as [number, number, Mat, Vec][]) {
      const turned = mulT(mulT(now, f.rest[arm].r), fr.torso); // how far the arm has turned from where it hangs at rest
      set(b, mul(partTurn(turned, CAP), fr.torso), chest, at);
    }

    const limb = (b: number, rn: Mat, seg: [Vec, Vec], thick: number) =>
      set(b, rn, [thick, len(sub(seg[1], seg[0])) / f.rest[b].len, thick], seg[0]);
    const hand = f.girth.hand;
    limb(B.armUL, fr.lua, g.lua, f.girth.arm);
    limb(B.armLL, fr.lfa, g.lfa, f.girth.forearm);
    set(B.handL, flat ? palmDown(f.palm[0], flat) : fr.lfa, [hand, hand, hand], g.lfa[1]);
    limb(B.armUR, fr.rua, g.rua, f.girth.arm);
    limb(B.armLR, fr.rfa, g.rfa, f.girth.forearm);
    set(B.handR, flat ? palmDown(f.palm[1], flat) : fr.rfa, [hand, hand, hand], g.rfa[1]);
    limb(B.thighL, fr.lth, g.lth, f.girth.thigh);
    limb(B.shinL, fr.lsh, g.lsh, f.girth.shin);
    limb(B.thighR, fr.rth, g.rth, f.girth.thigh);
    limb(B.shinR, fr.rsh, g.rsh, f.girth.shin);
    // a limb this person does not have closes to a point at the joint it would start from;
    // the skin shared with the part above rounds the end off
    const gone = (b: number, at: Vec) => {
      const m = b * 21;
      bones.fill(0, m, m + 21);
      bones.set(at, m + 9);
      this.turn.set([0, 0, 0, 1], b * 4);
      this.stretch.fill(0, b * 9, b * 9 + 9);
    };
    const absent = f.shape.build?.absent ?? {};
    for (const [limb, upper, lower, end, seg] of [
      ['armL', B.armUL, B.armLL, B.handL, g.lua], ['armR', B.armUR, B.armLR, B.handR, g.rua],
      ['legL', B.thighL, B.shinL, B.footL, g.lth], ['legR', B.thighR, B.shinR, B.footR, g.rth],
    ] as ['armL' | 'armR' | 'legL' | 'legR', number, number, number, [Vec, Vec]][]) {
      const gap = absent[limb];
      if (!gap) continue;
      const at = gap === 'whole' ? seg[0] : seg[1];
      if (gap === 'whole') gone(upper, at);
      gone(lower, at);
      gone(end, at);
    }
    for (const [b, shin, ft, sm] of [[B.footL, g.lsh, g.lft, fr.lsh], [B.footR, g.rsh, g.rft, fr.rsh]] as [number, [Vec, Vec], [Vec, Vec], Mat][]) {
      if (absent[b === B.footL ? 'legL' : 'legR']) continue;
      let z = norm(sub(ft[1], ft[0]));
      let y = orth(sub(shin[0], shin[1]), z, [sm[2], sm[5], sm[8]]);
      const ankle = shin[1];
      if (len(sub(ft[0], ankle)) < 1e-4) {
        // a pointed foot stretches a little past the line of the shin, so its top can lie on the floor
        const c = Math.cos(POINT), s = Math.sin(POINT);
        [z, y] = [[z[0] * c + y[0] * s, z[1] * c + y[1] * s, z[2] * c + y[2] * s], [y[0] * c - z[0] * s, y[1] * c - z[1] * s, y[2] * c - z[2] * s]];
      }
      set(b, fromCols(cross(y, z), y, z), [hand, hand, hand], [ankle[0] - y[0] * ANKLE_H, ankle[1] - y[1] * ANKLE_H, ankle[2] - y[2] * ANKLE_H]);
    }
  }

  /** The three parts that meet at each shoulder: where each puts the joint, and their turns on one side of the sphere. */
  private shoulders(f: Fit): void {
    const { bones: M, turn, pivot } = this;
    [[B.shoulderL, B.armUL], [B.shoulderR, B.armUR]].forEach(([cap, arm], side) => {
      const c = f.rest[arm].o;
      for (const b of [B.chest, cap, arm]) {
        const m = b * 21;
        for (let i = 0; i < 3; i++) pivot[b * 6 + side * 3 + i] = M[m + i * 3] * c[0] + M[m + i * 3 + 1] * c[1] + M[m + i * 3 + 2] * c[2] + M[m + 9 + i];
        if (b === B.chest) continue;
        const a = B.chest * 4, q = b * 4;
        if (turn[a] * turn[q] + turn[a + 1] * turn[q + 1] + turn[a + 2] * turn[q + 2] + turn[a + 3] * turn[q + 3] < 0)
          for (let i = 0; i < 4; i++) turn[q + i] = -turn[q + i];
      }
    });
  }

  /** Blend every vertex between the body parts it belongs to. */
  private skin(f: Fit, hot: Float32Array): void {
    const { d, out, bones: M, turn, stretch, pivot, joint } = this;
    const { pos, nrm } = f;
    const { skinB, skinW } = d;
    const centre = [f.rest[B.armUL].o, f.rest[B.armUR].o];
    const group = [[B.chest, B.shoulderL, B.armUL], [B.chest, B.shoulderR, B.armUR]];
    for (let v = 0, o = 0; v < d.nv; v++, o += STRIDE) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
      let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0, tint = 0;
      const side = joint[v] - 1;
      if (side >= 0) {
        // shoulder: one blended turn about the joint for the parts that meet there
        const mine = group[side], c = centre[side];
        const dx = x - c[0], dy = y - c[1], dz = z - c[2];
        let rx = 0, ry = 0, rz = 0, rw = 0, cx = 0, cy = 0, cz = 0, sx = 0, sy = 0, sz = 0, share = 0;
        let lx = 0, ly = 0, lz = 0, mx = 0, my = 0, mz = 0; // the same parts blended the plain way
        for (let k = 0; k < 4; k++) {
          const w = skinW[v * 4 + k];
          if (!w) break;
          const b = skinB[v * 4 + k], a0 = w / 255;
          tint += a0 * hot[b];
          if (b !== mine[0] && b !== mine[1] && b !== mine[2]) {
            const m = b * 21;
            px += a0 * (M[m] * x + M[m + 1] * y + M[m + 2] * z + M[m + 9]);
            py += a0 * (M[m + 3] * x + M[m + 4] * y + M[m + 5] * z + M[m + 10]);
            pz += a0 * (M[m + 6] * x + M[m + 7] * y + M[m + 8] * z + M[m + 11]);
            qx += a0 * (M[m + 12] * nx + M[m + 13] * ny + M[m + 14] * nz);
            qy += a0 * (M[m + 15] * nx + M[m + 16] * ny + M[m + 17] * nz);
            qz += a0 * (M[m + 18] * nx + M[m + 19] * ny + M[m + 20] * nz);
            continue;
          }
          const t = b * 4, e = b * 9, p = b * 6 + side * 3, m = b * 21;
          const a = a0;
          lx += a * (M[m] * x + M[m + 1] * y + M[m + 2] * z + M[m + 9]);
          ly += a * (M[m + 3] * x + M[m + 4] * y + M[m + 5] * z + M[m + 10]);
          lz += a * (M[m + 6] * x + M[m + 7] * y + M[m + 8] * z + M[m + 11]);
          mx += a * (M[m + 12] * nx + M[m + 13] * ny + M[m + 14] * nz);
          my += a * (M[m + 15] * nx + M[m + 16] * ny + M[m + 17] * nz);
          mz += a * (M[m + 18] * nx + M[m + 19] * ny + M[m + 20] * nz);
          rx += a * turn[t]; ry += a * turn[t + 1]; rz += a * turn[t + 2]; rw += a * turn[t + 3];
          sx += a * (stretch[e] * dx + stretch[e + 1] * dy + stretch[e + 2] * dz);
          sy += a * (stretch[e + 3] * dx + stretch[e + 4] * dy + stretch[e + 5] * dz);
          sz += a * (stretch[e + 6] * dx + stretch[e + 7] * dy + stretch[e + 8] * dz);
          cx += a * pivot[p]; cy += a * pivot[p + 1]; cz += a * pivot[p + 2];
          share += a;
        }
        const l = Math.hypot(rx, ry, rz, rw) || 1;
        rx /= l; ry /= l; rz /= l; rw /= l;
        const r0 = 1 - 2 * (ry * ry + rz * rz), r1 = 2 * (rx * ry - rz * rw), r2 = 2 * (rx * rz + ry * rw);
        const r3 = 2 * (rx * ry + rz * rw), r4 = 1 - 2 * (rx * rx + rz * rz), r5 = 2 * (ry * rz - rx * rw);
        const r6 = 2 * (rx * rz - ry * rw), r7 = 2 * (ry * rz + rx * rw), r8 = 1 - 2 * (rx * rx + ry * ry);
        const g = f.round[v], h = 1 - g;
        out[o] = px + h * lx + g * (cx + r0 * sx + r1 * sy + r2 * sz);
        out[o + 1] = py + h * ly + g * (cy + r3 * sx + r4 * sy + r5 * sz);
        out[o + 2] = pz + h * lz + g * (cz + r6 * sx + r7 * sy + r8 * sz);
        out[o + 3] = qx + h * mx + g * share * (r0 * nx + r1 * ny + r2 * nz);
        out[o + 4] = qy + h * my + g * share * (r3 * nx + r4 * ny + r5 * nz);
        out[o + 5] = qz + h * mz + g * share * (r6 * nx + r7 * ny + r8 * nz);
        out[o + 6] = tint;
        continue;
      }
      for (let k = 0; k < 4; k++) {
        const w = skinW[v * 4 + k];
        if (!w) break;
        const b = skinB[v * 4 + k], m = b * 21, a = w / 255;
        px += a * (M[m] * x + M[m + 1] * y + M[m + 2] * z + M[m + 9]);
        py += a * (M[m + 3] * x + M[m + 4] * y + M[m + 5] * z + M[m + 10]);
        pz += a * (M[m + 6] * x + M[m + 7] * y + M[m + 8] * z + M[m + 11]);
        qx += a * (M[m + 12] * nx + M[m + 13] * ny + M[m + 14] * nz);
        qy += a * (M[m + 15] * nx + M[m + 16] * ny + M[m + 17] * nz);
        qz += a * (M[m + 18] * nx + M[m + 19] * ny + M[m + 20] * nz);
        tint += a * hot[b];
      }
      out[o] = px; out[o + 1] = py; out[o + 2] = pz;
      out[o + 3] = qx; out[o + 4] = qy; out[o + 5] = qz;
      out[o + 6] = tint;
    }
  }

  /** Dumbbells and barbells as plain cylinders. Returns the number of vertices written. */
  /** The hair bun: a ball on the back of the head, written after `from` vertices. Returns the count added. */
  private ball(f: Fit, from: number): number {
    if (!f.bun) return 0;
    const M = this.bones, m = B.head * 21;
    const { c, r } = f.bun;
    const at = [0, 1, 2].map((i) => M[m + i * 3] * c[0] + M[m + i * 3 + 1] * c[1] + M[m + i * 3 + 2] * c[2] + M[m + 9 + i]);
    const R = r * Math.hypot(M[m], M[m + 3], M[m + 6]);
    let n = from;
    const put = (d: Vec) => { this.props.set([at[0] + d[0] * R, at[1] + d[1] * R, at[2] + d[2] * R, d[0], d[1], d[2], 0], n * STRIDE); n++; };
    const dir = (i: number, j: number): Vec => {
      const a = (i / BUN) * Math.PI, b = (j / BUN) * Math.PI * 2;
      return [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
    };
    for (let i = 0; i < BUN; i++)
      for (let j = 0; j < BUN; j++) {
        const a = dir(i, j), b = dir(i + 1, j), c2 = dir(i + 1, j + 1), d = dir(i, j + 1);
        put(a); put(c2); put(b);
        put(a); put(d); put(c2);
      }
    return n - from;
  }

  private cylinders(list: Cylinder[]): number {
    const o = this.props;
    let n = 0;
    const put = (p: Vec, q: Vec) => { o.set([p[0], p[1], p[2], q[0], q[1], q[2], 0], n * STRIDE); n++; };
    for (const c of list.slice(0, 6)) {
      const axis = norm(sub(c.b, c.a));
      const u = orth([0, 1, 0], axis, [1, 0, 0]);
      const w = cross(axis, u);
      const ring = (i: number): Vec => {
        const t = (i / CYL) * Math.PI * 2;
        return [u[0] * Math.cos(t) + w[0] * Math.sin(t), u[1] * Math.cos(t) + w[1] * Math.sin(t), u[2] * Math.cos(t) + w[2] * Math.sin(t)];
      };
      const on = (end: Vec, r: Vec): Vec => [end[0] + r[0] * c.r, end[1] + r[1] * c.r, end[2] + r[2] * c.r];
      const back: Vec = [-axis[0], -axis[1], -axis[2]];
      for (let i = 0; i < CYL; i++) {
        const r0 = ring(i), r1 = ring(i + 1);
        put(on(c.a, r0), r0); put(on(c.a, r1), r1); put(on(c.b, r1), r1);
        put(on(c.a, r0), r0); put(on(c.b, r1), r1); put(on(c.b, r0), r0);
        put(c.a, back); put(on(c.a, r1), back); put(on(c.a, r0), back);
        put(c.b, axis); put(on(c.b, r0), axis); put(on(c.b, r1), axis);
      }
    }
    return n;
  }

  render(
    w: number, h: number, f: Fit, sk: Skeleton, cam: Camera,
    col: HumanColors, lit: (s: SegName) => boolean, props: Cylinder[],
    /** hands flat on the floor, fingers pointing this (level) way; null = hands follow the forearms */
    flatHands: Vec | null = null,
  ): HTMLCanvasElement {
    const { gl, loc, at } = this;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.place(f, sk, flatHands);
    this.shoulders(f);
    const hot = new Float32Array(NB);
    SEGS.forEach((segs, b) => { hot[b] = segs.some(lit) ? 1 : 0; });
    this.skin(f, hot);

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.disable(gl.BLEND);

    const r = cam.rot;
    gl.uniformMatrix3fv(loc.uRot, false, [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]]);
    gl.uniform4f(loc.uProj, (2 * cam.scale * cam.cam) / w, (2 * cam.scale * cam.cam) / h, (2 * cam.ox) / w - 1, 1 - (2 * cam.oy) / h);
    gl.uniform1f(loc.uCam, cam.cam);
    gl.uniform1f(loc.uShadowA, col.shadow);
    gl.uniform3fv(loc.uSkin, col.skin);
    gl.uniform3fv(loc.uTop, f.female ? col.topFemale : col.top);
    gl.uniform3fv(loc.uBottom, col.bottom);
    gl.uniform3fv(loc.uHair, col.hair);
    gl.uniform3fv(loc.uHot, col.hot);
    gl.uniform3fv(loc.uIron, col.iron);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.live);
    gl.bufferData(gl.ARRAY_BUFFER, this.out, gl.DYNAMIC_DRAW);
    if (this.shown !== f) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.clothBuf);
      gl.bufferData(gl.ARRAY_BUFFER, f.cloth, gl.STATIC_DRAW);
      this.shown = f;
    }
    const nProps = this.cylinders(props);
    const nBun = this.ball(f, nProps);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.propBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.props.subarray(0, (nProps + nBun) * STRIDE), gl.DYNAMIC_DRAW);

    const pointLive = (buf: WebGLBuffer) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      for (const [name, size, off] of [['aPos', 3, 0], ['aNrm', 3, 3], ['aTint', 1, 6]] as [string, number, number][]) {
        gl.enableVertexAttribArray(at[name]);
        gl.vertexAttribPointer(at[name], size, gl.FLOAT, false, STRIDE * 4, off * 4);
      }
    };
    const body = () => {
      pointLive(this.live);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.clothBuf);
      gl.enableVertexAttribArray(at.aCloth);
      gl.vertexAttribPointer(at.aCloth, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.kindBuf);
      gl.enableVertexAttribArray(at.aKind);
      gl.vertexAttribPointer(at.aKind, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index);
      gl.drawElements(gl.TRIANGLES, this.d.nt * 3, gl.UNSIGNED_SHORT, 0);
    };
    const iron = () => {
      if (!nProps && !nBun) return;
      pointLive(this.propBuf);
      gl.disableVertexAttribArray(at.aCloth);
      gl.vertexAttrib3f(at.aCloth, -1, -1, -1);
      gl.disableVertexAttribArray(at.aKind);
      gl.vertexAttrib1f(at.aKind, 4);
      gl.drawArrays(gl.TRIANGLES, 0, nProps);
      gl.vertexAttrib1f(at.aKind, 3);
      gl.drawArrays(gl.TRIANGLES, nProps, nBun);
    };

    // shadow first: each floor pixel is darkened once, however many body parts cover it
    gl.uniform1f(loc.uShadow, 1);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.NOTEQUAL, 1, 1);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    body();
    iron();
    gl.disable(gl.STENCIL_TEST);

    gl.uniform1f(loc.uShadow, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    body();
    iron();
    return this.canvas;
  }
}

/* ---------- loading ---------- */

let human: Human | null = null;
let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
const waiting: (() => void)[] = [];

/** The human body once it has loaded, else null. */
export const humanBody = (): Human | null => human;
/** True while the body is still on its way (draw something cheap meanwhile). */
export const humanPending = (): boolean => state === 'idle' || state === 'loading';

/** Start loading the body (once); `then` runs when it is ready to draw. */
export function loadHuman(then?: () => void): void {
  if (state === 'ready') return;
  if (then) waiting.push(then);
  if (state !== 'idle') return;
  state = 'loading';
  fetch(FILE)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((buf) => {
      human = new Human(parse(buf));
      state = 'ready';
      waiting.splice(0).forEach((f) => f());
    })
    .catch((e) => {
      console.warn('human body unavailable, using the simple figure', e);
      state = 'failed';
      waiting.splice(0).forEach((f) => f());
    });
}
