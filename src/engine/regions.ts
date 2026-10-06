import type { PainRegion } from '../types';
import type { BodyShape, Skeleton, Vec } from './pose';

/** A tappable place on the body surface, and the way it faces (to hide it when it is turned away). */
export interface Spot {
  id: PainRegion;
  p: Vec;
  n: Vec;
  /** hidden once it faces away by more than this (−1 = straight away): the torso hides its far side early, a thin limb almost never */
  cut: number;
}

export const REGIONS: PainRegion[] = [
  'neck', 'shoulderL', 'shoulderR', 'upperBack', 'lowerBack', 'elbowL', 'elbowR', 'wristL', 'wristR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR',
];

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const norm = (a: Vec): Vec => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const neg = (a: Vec): Vec => [-a[0], -a[1], -a[2]];

/** Where each body-map region sits on a solved skeleton. */
export function regionSpots(sk: Skeleton, shape: BodyShape): Spot[] {
  const g = sk.seg;
  const up = norm(sub(g.torso[1], g.torso[0]));
  // the body's left; the shoulder line is never degenerate
  let side = norm(sub(g.shoulders[0], g.shoulders[1]));
  const fwd = norm(cross(side, up));
  side = norm(cross(up, fwd));
  const back = neg(fwd);
  const slice = (t: number) => sk.slices.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b));
  const spine = (t: number): Vec => { const s = slice(t); return add(s.c, back, s.d / 2); };

  const out: Spot[] = [
    { id: 'neck', p: add(add(g.neck[0], sub(g.neck[1], g.neck[0]), 0.6), back, shape.neck / 2), n: back, cut: -0.2 },
    { id: 'upperBack', p: spine(0.76), n: back, cut: -0.2 },
    { id: 'lowerBack', p: spine(0.28), n: back, cut: -0.2 },
  ];
  const cut = -0.8;
  const sides: ['L' | 'R', Vec, number][] = [['L', side, 0], ['R', neg(side), 1]];
  for (const [s, o, i] of sides) {
    const arm = i ? 'r' : 'l';
    const ua = g[`${arm}ua`], th = g[`${arm}th`], sh = g[`${arm}sh`];
    out.push(
      { id: `shoulder${s}`, p: add(add(ua[0], o, shape.arm * 0.45), up, shape.arm * 0.45), n: norm(add(o, up)), cut },
      { id: `elbow${s}`, p: add(ua[1], o, shape.forearm * 0.5), n: o, cut },
      { id: `wrist${s}`, p: add(sk.hands[i], o, 0.025), n: o, cut },
      { id: `hip${s}`, p: add(th[0], o, shape.thigh * 0.55), n: o, cut },
      { id: `knee${s}`, p: add(th[1], fwd, shape.shin * 0.5), n: fwd, cut: -0.2 },
      { id: `ankle${s}`, p: add(sh[1], o, 0.035), n: o, cut },
    );
  }
  return out;
}
