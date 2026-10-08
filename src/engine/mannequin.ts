import { DEFAULT_SHAPE, sample, solve, type BodyShape, type PoseAnim, type SegName, type Vec } from './pose';
import type { Muscle, PainRegion } from '../types';
import { regionSpots } from './regions';
import { reducedMotion } from '../utils';
import { glRenderer, rgb, type Cone, type Cylinder, type Ellipsoid, type Palette, type Scene, type Slab, type V3 } from './gl';
import { humanBody, humanPending, loadHuman, type HumanColors } from './human';

/** Which body parts light up for each muscle group. */
const MUSCLE_SEGS: Record<Muscle, SegName[]> = {
  quads: ['lth', 'rth'],
  hams: ['lth', 'rth'],
  glutes: ['pelvis', 'lth', 'rth'],
  chest: ['torso', 'shoulders'],
  back: ['torso', 'shoulders'],
  shoulders: ['shoulders', 'lua', 'rua'],
  arms: ['lua', 'rua', 'lfa', 'rfa'],
  core: ['torso', 'pelvis'],
};

/** The most telling moment of a move (end of the first transition, e.g. the bottom of a squat). */
function keyTime(a: PoseAnim): number {
  if (a.beats && a.beats.length === a.frames.length) {
    const total = a.beats.reduce((x, y) => x + y, 0);
    return (a.beats[0] / total) * a.dur + 0.001;
  }
  return a.dur / a.frames.length;
}

/** Adaptive pixel budget for the GL renderer: drops on slow phones, recovers on fast ones. */
const MAX_PIXELS = 260_000;
let pixelBudget = MAX_PIXELS;
let frameAvg = 16;
let smooth = 0;

/**
 * Steer the pixel budget by the time between animation frames. The GPU works
 * after the draw call returns, so timing the call itself says nothing; a late
 * next frame is what a slow phone actually shows.
 */
function tune(gap: number): void {
  if (gap > 250) return; // a pause (tab switch, scroll), not a slow frame
  frameAvg = frameAvg * 0.9 + gap * 0.1;
  if (frameAvg > 22 && pixelBudget > 40_000) {
    pixelBudget *= 0.75;
    frameAvg = 17;
    smooth = -240; // stay down for a while before trying more pixels again
  } else if (frameAvg < 17.5 && pixelBudget < MAX_PIXELS && ++smooth > 90) {
    pixelBudget = Math.min(MAX_PIXELS, pixelBudget * 1.1);
    smooth = 0;
  }
}

/** Drawing waits while the page scrolls, so the figure never costs the scroll its frames. */
let scrollUntil = 0;
document.addEventListener('scroll', () => { scrollUntil = performance.now() + 140; }, { capture: true, passive: true });


/** Limb thickness comes from the body shape; the torso is drawn as a loft of slices. */
const limbWidth = (name: SegName, s: BodyShape): number => {
  switch (name) {
    case 'lua': case 'rua': return s.arm;
    case 'lfa': case 'rfa': return s.forearm;
    case 'lth': case 'rth': return s.thigh;
    case 'lsh': case 'rsh': return s.shin;
    case 'lft': case 'rft': return 0.06;
    case 'neck': return s.neck;
    default: return 0; // torso, pelvis, shoulders → slices
  }
};

interface Colors {
  body: string; bodyFar: string; muscle: string; muscleFar: string;
  floor: string; grid: string; shadow: number; iron: string;
}

function readColors(el: Element): Colors {
  const cs = getComputedStyle(el);
  const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
  return {
    body: v('--mq-body', '#2b4058'),
    bodyFar: v('--mq-body-far', '#5d7189'),
    muscle: v('--mq-muscle', '#d7364a'),
    muscleFar: v('--mq-muscle-far', '#e57886'),
    floor: v('--mq-floor', 'rgba(20,38,58,.10)'),
    grid: v('--mq-grid', 'rgba(20,38,58,.18)'),
    shadow: parseFloat(v('--mq-shadow', '0.28')),
    iron: v('--mq-iron', '#14263a'),
  };
}

export interface MannequinOptions {
  interactive?: boolean;
  /** Radians per second of idle auto-rotation; 0 to disable. */
  spin?: number;
  /** Draw a single frame (thumbnails): no animation loop at all. */
  still?: boolean;
  /** Called when the user rotates the view (to keep a paired viewer in sync). */
  onView?: (yaw: number, pitch: number) => void;
}

export class Mannequin {
  private ctx: CanvasRenderingContext2D;
  private anim: PoseAnim | null = null;
  private hl = new Set<SegName>();
  private yaw = -0.55;
  private pitch = 0.42;
  private floorLayer = document.createElement('canvas');
  private shadowLayer = document.createElement('canvas');
  private time = 0;
  private last = 0;
  private raf = 0;
  private visible = true;
  private dragging = false;
  private touched = false;
  private colors: Colors;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private mq = matchMedia('(prefers-color-scheme: dark)');
  private shape: BodyShape = DEFAULT_SHAPE;
  /** bounding cylinder of the whole movement, for framing */
  private fit = { r: 0.6, top: 1.8 };
  /** body map: null = off; otherwise every region is tappable and the listed ones are marked (value = intensity 1..10) */
  private spots: Map<PainRegion, number> | null = null;
  /** where the tappable spots were last drawn, in canvas pixels */
  private hits: { id: PainRegion; x: number; y: number }[] = [];
  /** Called when the user taps a body-map spot (needs `interactive`). */
  onPick: ((id: PainRegion) => void) | null = null;
  speed = 1;
  showMuscles = true;

  constructor(private canvas: HTMLCanvasElement, private opts: MannequinOptions = {}) {
    this.ctx = canvas.getContext('2d')!;
    this.colors = readColors(canvas);
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    // Stop drawing when off-screen: keeps the app cheap on battery.
    this.io = new IntersectionObserver((e) => {
      this.visible = e[0]?.isIntersecting ?? true;
      if (this.visible) this.kick();
    });
    this.io.observe(canvas);
    this.mq.addEventListener('change', this.onTheme);
    document.addEventListener('visibilitychange', this.onVis);
    if (opts.interactive) this.bindDrag();
    // the body arrives a moment after the first frame: frame and draw again with it
    loadHuman(() => { if (!this.gone) { this.measure(); this.kick(); } });
  }
  private gone = false;

  /** Change the body (e.g. from the user's height, weight and measurements). */
  setBody(shape: BodyShape): void {
    this.shape = shape;
    this.measure();
    this.draw();
  }

  /** Turn the body map on (marked regions with their intensity) or off (null). */
  setSpots(marked: Partial<Record<PainRegion, number>> | null): void {
    this.spots = marked ? new Map(Object.entries(marked) as [PainRegion, number][]) : null;
    if (!marked) this.hits = [];
    this.kick();
  }

  /** Sample the whole loop once so the camera frames every frame of it, not just the current one. */
  private fixedFit: { r: number; top: number } | null = null;
  getFit(): { r: number; top: number } {
    return { ...this.fit };
  }
  /** Use the same framing as another viewer, so two bodies are drawn to the same scale. */
  lockFit(f: { r: number; top: number }): void {
    this.fixedFit = { ...f };
    this.fit = { ...f };
    this.draw();
  }

  private measure(): void {
    if (!this.anim) return;
    if (this.fixedFit) {
      this.fit = { ...this.fixedFit };
      return;
    }
    let r = 0.3, top = 0.5;
    const n = Math.max(12, this.anim.frames.length * 6);
    for (let i = 0; i < n; i++) {
      const sk = solve(sample(this.anim, (i / n) * this.anim.dur), this.shape, this.anim);
      const pts: [Vec, number][] = [[sk.head, this.shape.head]];
      for (const k of Object.keys(sk.seg) as SegName[]) for (const v of sk.seg[k]) pts.push([v, 0.08]);
      for (const sl of sk.slices) pts.push([sl.a, sl.d / 2], [sl.b, sl.d / 2]);
      if (this.anim.prop === 'barbell') for (const h of sk.hands) pts.push([h, 0.6]);
      for (const [v, pad] of pts) {
        r = Math.max(r, Math.hypot(v[0], v[2]) + pad);
        top = Math.max(top, v[1] + pad);
      }
    }
    this.fit = { r, top };
  }

  /** Flag specific body parts (wrong-form demos) instead of muscle groups. */
  setAnimFocus(anim: PoseAnim, segs: SegName[]): void {
    this.setAnim(anim, []);
    this.hl = new Set(segs);
  }

  setAnim(anim: PoseAnim, muscles: Muscle[] = []): void {
    this.anim = anim;
    this.measure();
    this.hl = new Set(muscles.flatMap((m) => MUSCLE_SEGS[m]));
    // static renders show the most telling moment of the move
    this.time = this.opts.still || reducedMotion() ? keyTime(anim) : 0;
    this.kick();
  }

  destroy(): void {
    this.gone = true;
    cancelAnimationFrame(this.raf);
    this.io.disconnect();
    this.ro.disconnect();
    this.mq.removeEventListener('change', this.onTheme);
    document.removeEventListener('visibilitychange', this.onVis);
  }

  private onTheme = () => { this.colors = readColors(this.canvas); this.pal = null; this.humanPal = null; this.floorKey = ''; this.draw(); };
  private onVis = () => { if (!document.hidden) this.kick(); };

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    // same size as before: nothing to redraw
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.draw();
  }

  private bindDrag(): void {
    let x0 = 0, y0 = 0, yaw0 = 0, pitch0 = 0;
    const c = this.canvas;
    c.style.touchAction = 'pan-y';
    c.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.touched = true;
      x0 = e.clientX; y0 = e.clientY; yaw0 = this.yaw; pitch0 = this.pitch;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.yaw = yaw0 + (e.clientX - x0) * 0.012;
      this.pitch = Math.max(0.12, Math.min(1.1, pitch0 + (e.clientY - y0) * 0.006));
      this.opts.onView?.(this.yaw, this.pitch);
      this.kick();
    });
    const end = () => { this.dragging = false; };
    c.addEventListener('pointerup', (e) => {
      const tap = this.dragging && Math.hypot(e.clientX - x0, e.clientY - y0) < 8;
      end();
      if (tap) this.pick(e.clientX, e.clientY);
    });
    c.addEventListener('pointercancel', end);
    c.tabIndex = 0;
    c.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.yaw -= 0.2;
      else if (e.key === 'ArrowRight') this.yaw += 0.2;
      else return;
      this.touched = true;
      e.preventDefault();
      this.opts.onView?.(this.yaw, this.pitch);
      this.kick();
    });
  }

  /** A tap on the body map: the nearest spot within a fingertip. */
  private pick(clientX: number, clientY: number): void {
    if (!this.spots || !this.onPick) return;
    const r = this.canvas.getBoundingClientRect();
    const k = this.canvas.width / (r.width || 1);
    const x = (clientX - r.left) * k, y = (clientY - r.top) * k;
    let best: PainRegion | null = null, bd = 30 * k;
    for (const h of this.hits) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bd) { bd = d; best = h.id; }
    }
    if (best) this.onPick(best);
  }

  /** Let the idle spin start again (after a preset view or a drag stopped it). */
  spinAgain(): void {
    this.touched = false;
    this.kick();
  }

  /** Rotate to a preset view (front / side / back). */
  view(yaw: number): void {
    this.yaw = yaw;
    this.touched = true;
    this.opts.onView?.(this.yaw, this.pitch);
    this.kick();
  }

  /** Follow another viewer's camera (no callback, so pairs don't ping-pong). */
  setView(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = pitch;
    this.touched = true;
    this.kick();
  }

  getView(): [number, number] {
    return [this.yaw, this.pitch];
  }

  /** Restart the loop from the first frame (to line up two viewers). */
  restart(): void {
    this.time = 0;
    this.kick();
  }

  private kick(): void {
    if (this.raf || !this.visible || document.hidden) return;
    this.last = performance.now();
    const step = (now: number) => {
      this.raf = 0;
      const still = reducedMotion() || !!this.opts.still;
      // not now: the page is scrolling
      if (!this.dragging && now < scrollUntil) {
        this.last = now;
        this.raf = requestAnimationFrame(step);
        return;
      }
      const gap = now - this.last;
      const dt = Math.min(0.05, gap / 1000);
      this.last = now;
      if (!still) this.time += dt * this.speed;
      const spin = this.opts.spin ?? 0;
      if (spin && !this.touched && !still) this.yaw += spin * dt;
      if (!still && !humanBody()) tune(gap);
      this.draw();
      if (!still && this.visible && !document.hidden) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private pal: Palette | null = null;
  private palette(): Palette {
    if (this.pal) return this.pal;
    const cs = getComputedStyle(this.canvas);
    const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light';
    this.pal = {
      body: rgb(v('--mq3-body', '#d5dce4'), [0.84, 0.86, 0.89]),
      hot: rgb(v('--mq3-hot', '#e0485a'), [0.88, 0.28, 0.35]),
      iron: rgb(v('--mq3-iron', '#2a3542'), [0.16, 0.2, 0.26]),
      floor: rgb(v('--mq3-floor', '#14263a'), [0.08, 0.15, 0.23]),
      grid: rgb(v('--mq3-grid', '#14263a'), [0.08, 0.15, 0.23]),
      floorAlpha: parseFloat(v('--mq3-floor-a', '0.05')),
      gridAlpha: parseFloat(v('--mq3-grid-a', '0.12')),
      shadow: parseFloat(v('--mq3-shadow', '0.5')),
      dark,
    };
    return this.pal;
  }

  /** Skeleton + body shape → SDF primitives for the WebGL renderer. */
  private scene(sk: ReturnType<typeof solve>, floorR: number): Scene {
    const S = this.shape;
    const hl = (n: SegName) => (this.showMuscles && this.hl.has(n) ? 1 : 0);
    const sub = (a: Vec, b: Vec): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const addv = (a: Vec, b: Vec, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
    const norm = (a: Vec): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const cross = (a: Vec, b: Vec): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

    const [pelvis, chestTop] = sk.seg.torso;
    const up = norm(sub(chestTop, pelvis));
    const s0 = sk.slices[Math.floor(sk.slices.length / 2)];
    let side = norm(sub(s0.a, s0.b));
    if (Math.hypot(...sub(s0.a, s0.b)) < 1e-4) side = norm(sub(sk.seg.pelvis[0], sk.seg.pelvis[1]));
    const fwd = norm(cross(side, up));
    side = norm(cross(up, fwd));

    const at = (t: number) => sk.slices.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b));
    const width = (x: (typeof sk.slices)[number]) => Math.hypot(...sub(x.a, x.b)) + x.d;
    const torsoE = (t: number, ry: number, hot: number): Ellipsoid => {
      const x = at(t);
      return { c: [x.c[0], x.c[1], x.c[2]], r: [width(x) / 2, ry * S.scale, x.d / 2], hot };
    };
    const hipHot = hl('pelvis'), trunkHot = hl('torso');
    const ellipsoids: Ellipsoid[] = [
      { c: [sk.head[0], sk.head[1], sk.head[2]], r: [S.head * 0.86, S.head * 1.1, S.head * 0.98], hot: 0 },
      torsoE(0.06, 0.12, hipHot),
      torsoE(0.36, 0.13, trunkHot),
      torsoE(0.72, 0.14, trunkHot),
      torsoE(0.93, 0.08, Math.max(trunkHot, hl('shoulders'))),
    ];

    const cone = (a: Vec, b: Vec, ra: number, rb: number, hot: number): Cone => ({ a: [...a] as V3, b: [...b] as V3, ra, rb, hot });
    const g = sk.seg;
    const cones: Cone[] = [
      cone(g.neck[0], addv(sk.head, up, -0.06), S.neck / 2, S.neck * 0.44, hl('neck')),
      cone(g.shoulders[0], g.shoulders[1], S.arm * 0.6, S.arm * 0.6, hl('shoulders')),
      cone(g.lua[0], g.lua[1], S.arm * 0.56, S.forearm * 0.52, hl('lua')),
      cone(g.lfa[0], g.lfa[1], S.forearm * 0.52, 0.026, hl('lfa')),
      cone(g.rua[0], g.rua[1], S.arm * 0.56, S.forearm * 0.52, hl('rua')),
      cone(g.rfa[0], g.rfa[1], S.forearm * 0.52, 0.026, hl('rfa')),
      cone(g.lth[0], g.lth[1], S.thigh * 0.55, S.shin * 0.52, hl('lth')),
      cone(g.lsh[0], g.lsh[1], S.shin * 0.52, 0.034, hl('lsh')),
      cone(g.rth[0], g.rth[1], S.thigh * 0.55, S.shin * 0.52, hl('rth')),
      cone(g.rsh[0], g.rsh[1], S.shin * 0.52, 0.034, hl('rsh')),
    ];

    /* ---- hands & feet: palms, fingers, thumbs, arched feet with toes ---- */
    const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const orth = (v: Vec, axis: Vec, fb: Vec): V3 => {
      const o = sub(v, [axis[0] * dot(v, axis), axis[1] * dot(v, axis), axis[2] * dot(v, axis)]);
      return Math.hypot(o[0], o[1], o[2]) < 1e-3 ? norm(fb) : norm(o);
    };
    const slabs: Slab[] = [];
    const sc = S.scale;
    const mid = at(0.5).c;
    const a = this.anim;
    const handMode = a?.hands ?? (a?.prop ? 'grip' : a?.contacts?.some((c) => c === 'hands' || c === 'elbows') ? 'floor' : 'free');
    const headward = norm([up[0], 0, up[2]]);
    const flatFwd: V3 = Math.hypot(up[0], up[2]) > 0.3 ? headward : norm([fwd[0], 0, fwd[2]]);

    for (const [el, w0] of [[g.lfa[0], sk.hands[0]], [g.rfa[0], sk.hands[1]]] as [Vec, Vec][]) {
      let dir = norm(sub(w0, el));
      let palm: V3;
      let w: Vec = w0;
      if (handMode === 'floor') {
        dir = flatFwd;
        palm = [0, -1, 0];
        w = [w0[0], w0[1] - 0.015, w0[2]];
      } else {
        palm = orth(sub(mid, w0), dir, fwd);
      }
      const grip = handMode === 'grip';
      const pEnd = addv(w, dir, (grip ? 0.075 : 0.08) * sc);
      slabs.push({ a: addv(w, dir, 0.008), b: pEnd, w: 0.037 * sc, t: grip ? 0.03 : 0.017, up: palm, r: grip ? 0.022 : 0.015 });
      if (!grip) {
        const curl = handMode === 'floor' ? 0.05 : 0.45;
        const fdir = norm(addv([dir[0] * Math.cos(curl), dir[1] * Math.cos(curl), dir[2] * Math.cos(curl)], palm, Math.sin(curl)));
        const fa = addv(pEnd, dir, -0.01);
        slabs.push({ a: fa, b: addv(fa, fdir, 0.07 * sc), w: 0.034 * sc, t: 0.011, up: orth(palm, fdir, palm), r: 0.01 });
      } else {
        slabs.push({ a: [0, 0, 0], b: [0, 0, 0], w: 0, t: 0, up: [0, 1, 0], r: 0 });
      }
      // thumb: forward when relaxed, toward the body's midline when the palm is on the floor
      let ts = norm(cross(palm, dir));
      const want = handMode === 'floor' ? sub(mid, w) : fwd;
      if (dot(ts, want) < 0) ts = [-ts[0], -ts[1], -ts[2]];
      const t0 = addv(addv(w, dir, 0.02 * sc), ts, 0.028 * sc);
      const t1 = addv(addv(addv(w, dir, 0.065 * sc), ts, 0.05 * sc), palm, handMode === 'floor' ? 0 : 0.015);
      cones.push(cone(t0, t1, 0.014, 0.01, 0));
    }

    for (const [knee, ankle, heel, toe] of [
      [g.lsh[0], g.lsh[1], g.lft[0], g.lft[1]],
      [g.rsh[0], g.rsh[1], g.rft[0], g.rft[1]],
    ] as Vec[][]) {
      const dir = norm(sub(toe, heel));
      const dorsum = orth(sub(knee, ankle), dir, [0, 1, 0]);
      const down = (v: Vec, k: number) => addv(v, dorsum, -k);
      // three blocks: heel/arch (tall), forefoot (lower, wider), toes (thin); all soles level
      // with where the solver expects the floor (0.036 below the heel/toe points)
      const len = Math.hypot(...sub(toe, heel));
      slabs.push({ a: down(addv(heel, dir, -0.03), 0.002), b: down(addv(heel, dir, len * 0.55), 0.002), w: 0.038 * sc, t: 0.034, up: dorsum, r: 0.024 });
      slabs.push({ a: down(addv(heel, dir, len * 0.45), 0.012), b: down(addv(toe, dir, 0.01), 0.012), w: 0.045 * sc, t: 0.024, up: dorsum, r: 0.018 });
      slabs.push({ a: down(addv(toe, dir, 0.005), 0.023), b: down(addv(toe, dir, 0.05 * sc), 0.023), w: 0.044 * sc, t: 0.013, up: dorsum, r: 0.012 });
      cones.push(cone(ankle, addv(heel, dir, 0.04), 0.036, 0.03, 0));
    }

    const props = this.props(sk, side);

    // bounding sphere for the ray march
    const pts: Vec[] = [sk.head, ...Object.values(sk.seg).flat(), ...sk.slices.map((x) => x.c)];
    for (const p of props) pts.push(p.a, p.b);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    const c: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    let r = 0;
    for (const p of pts) r = Math.max(r, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]));

    return { cones, ellipsoids, basis: [side, up, fwd], props, slabs, bound: { c, r: r + 0.25 }, floorR };
  }

  /** The weights in the hands, as cylinders. `side` is the body's left. */
  private props(sk: ReturnType<typeof solve>, side: Vec): Cylinder[] {
    const addv = (a: Vec, b: Vec, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
    const props: Cylinder[] = [];
    const absent = this.shape.build?.absent ?? {};
    if (this.anim?.prop === 'dumbbell') {
      for (const [i, h] of sk.hands.entries()) {
        if (absent[i ? 'armR' : 'armL']) continue; // no hand to hold it
        props.push({ a: addv(h, side, -0.075), b: addv(h, side, 0.075), r: 0.016 });
        props.push({ a: addv(h, side, -0.115), b: addv(h, side, -0.065), r: 0.05 });
        props.push({ a: addv(h, side, 0.065), b: addv(h, side, 0.115), r: 0.05 });
      }
    } else if (this.anim?.prop === 'barbell') {
      const [l, r] = sk.hands;
      const d: Vec = [l[0] - r[0], l[1] - r[1], l[2] - r[2]];
      const n = Math.hypot(d[0], d[1], d[2]) || 1;
      const dir: Vec = [d[0] / n, d[1] / n, d[2] / n];
      props.push({ a: addv(r, dir, -0.55), b: addv(l, dir, 0.55), r: 0.014 });
      props.push({ a: addv(r, dir, -0.5), b: addv(r, dir, -0.42), r: 0.2 });
      props.push({ a: addv(l, dir, 0.42), b: addv(l, dir, 0.5), r: 0.2 });
    }
    return props;
  }

  /** Hands that carry the body lie flat on the floor: which way their fingers point (toward the head), else null. */
  private flatHands(torso: number[]): Vec | null {
    const a = this.anim;
    const mode = a?.hands ?? (a?.prop ? 'grip' : a?.contacts?.some((c) => c === 'hands' || c === 'elbows') ? 'floor' : 'free');
    if (mode !== 'floor') return null;
    const level = (v: Vec): Vec | null => { const l = Math.hypot(v[0], v[2]); return l > 0.3 ? [v[0] / l, 0, v[2] / l] : null; };
    return level([torso[1], torso[4], torso[7]]) ?? level([torso[2], torso[5], torso[8]]) ?? [0, 0, 1];
  }

  private humanPal: HumanColors | null = null;
  private humanColors(): HumanColors {
    if (this.humanPal) return this.humanPal;
    const cs = getComputedStyle(this.canvas);
    const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
    const pal = this.palette();
    this.humanPal = {
      body: pal.body,
      top: rgb(v('--hm-top', '#3f5f7d'), [0.25, 0.37, 0.49]),
      topFemale: rgb(v('--hm-top-f', '#2a8c84'), [0.16, 0.55, 0.52]),
      bottom: rgb(v('--hm-bottom', '#2b3238'), [0.17, 0.2, 0.22]),
      hair: rgb(v('--hm-hair', '#2b2420'), [0.17, 0.14, 0.13]),
      hot: pal.hot,
      iron: pal.iron,
      shadow: pal.dark ? 0.4 : 0.16,
    };
    return this.humanPal;
  }

  private floorKey = '';
  /** The mat under the figure: a grid that fades out toward its rim. Redrawn only when the view changes. */
  private floor(proj: (v: Vec) => [number, number, number, number], R: number, scale: number): void {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const key = [W, H, R, scale, this.yaw, this.pitch].map((n) => n.toFixed(3)).join();
    if (key !== this.floorKey || this.floorLayer.width !== W || this.floorLayer.height !== H) {
      this.floorKey = key;
      const f = this.layer(this.floorLayer);
      f.beginPath();
      for (let i = 0; i <= 48; i++) {
        const t = (i / 48) * Math.PI * 2;
        const q = proj([Math.cos(t) * R, 0, Math.sin(t) * R]);
        if (i) f.lineTo(q[0], q[1]); else f.moveTo(q[0], q[1]);
      }
      f.closePath();
      f.fillStyle = this.colors.floor;
      f.fill();
      f.save();
      f.clip();
      f.strokeStyle = this.colors.grid;
      f.lineWidth = Math.max(1, scale * 0.005);
      f.beginPath();
      for (let g = -R; g <= R + 1e-6; g += 0.25) {
        let a = proj([g, 0, -R]), b = proj([g, 0, R]);
        f.moveTo(a[0], a[1]); f.lineTo(b[0], b[1]);
        a = proj([-R, 0, g]); b = proj([R, 0, g]);
        f.moveTo(a[0], a[1]); f.lineTo(b[0], b[1]);
      }
      f.stroke();
      f.restore();
      // fade: keep the centre, dissolve the rim
      const c0 = proj([0, 0, 0]);
      const rad = Math.max(Math.abs(proj([R, 0, 0])[0] - c0[0]), Math.abs(proj([0, 0, R])[0] - c0[0]), scale * 0.6);
      const fade = f.createRadialGradient(c0[0], c0[1], rad * 0.15, c0[0], c0[1], rad);
      fade.addColorStop(0, 'rgba(0,0,0,1)');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      f.globalCompositeOperation = 'destination-in';
      f.fillStyle = fade;
      f.fillRect(0, 0, W, H);
      f.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(this.floorLayer, 0, 0);
  }

  private layer(c: HTMLCanvasElement): CanvasRenderingContext2D {
    if (c.width !== this.canvas.width || c.height !== this.canvas.height) {
      c.width = this.canvas.width;
      c.height = this.canvas.height;
    }
    const x = c.getContext('2d')!;
    x.clearRect(0, 0, c.width, c.height);
    return x;
  }

  private draw(): void {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!this.anim) return;

    // the human body, once loaded, brings its own joint widths; poses are solved for those
    const human = humanBody();
    const fit = human?.fit(this.shape);
    const sk = solve(sample(this.anim, this.time), fit ? fit.shape : this.shape, this.anim);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const CAM = 4.5;

    // camera space (unit scale): rotate by yaw, then pitch, then perspective
    const cam = (v: Vec): [number, number, number, number] => {
      const x1 = v[0] * cy + v[2] * sy;
      const z1 = -v[0] * sy + v[2] * cy;
      const y1 = v[1] * cp - z1 * sp;
      const z2 = v[1] * sp + z1 * cp;
      const k = CAM / (CAM - z2);
      return [x1 * k, -y1 * k, z2, k];
    };

    // auto-framing: fit the movement's bounding cylinder into the canvas.
    // A cylinder looks the same from every yaw, so the zoom stays steady while rotating.
    const { r: fr, top } = this.fit;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      for (const h of [0, top]) {
        const q = cam([Math.cos(t) * fr, h, Math.sin(t) * fr]);
        x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
      }
    }
    const pad = 0.06;
    const scale = Math.min((W * (1 - pad * 2)) / (x1 - x0), (H * (1 - pad * 2)) / (y1 - y0));
    const ox = W / 2 - ((x0 + x1) / 2) * scale;
    const oy = H / 2 - ((y0 + y1) / 2) * scale;
    const proj = (v: Vec): [number, number, number, number] => {
      const q = cam(v);
      return [ox + q[0] * scale, oy + q[1] * scale, q[2], q[3]];
    };
    const R = Math.max(0.8, fr + 0.25);

    const rot = [cy, 0, sy, sy * sp, cp, -cy * sp, -sy * cp, sp, cy * cp];
    if (human && fit) {
      // plain triangles: cheap enough to draw at the canvas's own size
      const q = Math.min(1, Math.sqrt(1_200_000 / (W * H)));
      const w = Math.max(1, Math.round(W * q)), h = Math.max(1, Math.round(H * q));
      const t = sk.frames.torso;
      // a weight sits in the palm, a little past the wrist the skeleton ends at
      const palm = (wrist: Vec, m: number[]): Vec => [wrist[0] - m[1] * 0.07, wrist[1] - m[4] * 0.07, wrist[2] - m[7] * 0.07];
      const held = { ...sk, hands: [palm(sk.hands[0], sk.frames.lfa), palm(sk.hands[1], sk.frames.rfa)] as [Vec, Vec] };
      const img = human.render(w, h, fit, sk, { rot, cam: CAM, ox: ox * q, oy: oy * q, scale: scale * q },
        this.humanColors(), (n) => this.showMuscles && this.hl.has(n), this.props(held, [t[0], t[3], t[6]]), this.flatHands(t));
      this.floor(proj, R, scale);
      ctx.drawImage(img, 0, 0, w, h, 0, 0, W, H);
      this.drawSpots(sk, proj, scale);
      return;
    }

    // the body failed to load: the shared WebGL raymarcher, rendered at a capped pixel count.
    // While it is still loading, the flat figure below stands in.
    const gl = humanPending() ? null : glRenderer();
    if (gl) {
      const q = Math.min(1, Math.sqrt(pixelBudget / (W * H)));
      const w = Math.max(1, Math.round(W * q)), h = Math.max(1, Math.round(H * q));
      const img = gl.render(w, h, this.scene(sk, R), { rot, cam: CAM, ox: ox * q, oy: oy * q, scale: scale * q }, this.palette());
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h, 0, 0, W, H);
      this.drawSpots(sk, proj, scale);
      return;
    }

    const segs = Object.keys(sk.seg) as SegName[];

    /* 1. floor */
    this.floor(proj, R, scale);

    /* 2. body shadow: every limb projected onto the floor, light from above-front */
    const sh = this.layer(this.shadowLayer);
    const ground = (v: Vec): Vec => [v[0] + v[1] * 0.16, 0, v[2] + v[1] * 0.22];
    sh.strokeStyle = sh.fillStyle = '#000';
    sh.lineCap = 'round';
    for (const name of segs) {
      const w = limbWidth(name, this.shape);
      if (!w) continue;
      const [a, b] = sk.seg[name];
      const pa = proj(ground(a)), pb = proj(ground(b));
      sh.lineWidth = w * scale * pa[3];
      sh.beginPath(); sh.moveTo(pa[0], pa[1]); sh.lineTo(pb[0], pb[1]); sh.stroke();
    }
    for (const sl of sk.slices) {
      const pa = proj(ground(sl.a)), pb = proj(ground(sl.b));
      sh.lineWidth = sl.d * scale * pa[3];
      sh.beginPath(); sh.moveTo(pa[0], pa[1]); sh.lineTo(pb[0], pb[1]); sh.stroke();
    }
    const hg = proj(ground(sk.head));
    const hr = this.shape.head * scale * hg[3];
    sh.beginPath(); sh.ellipse(hg[0], hg[1], hr, hr * Math.max(0.3, sp), 0, 0, Math.PI * 2); sh.fill();
    ctx.save();
    ctx.globalAlpha = this.colors.shadow;
    ctx.filter = `blur(${Math.max(1, scale * 0.012)}px)`;
    ctx.drawImage(this.shadowLayer, 0, 0);
    ctx.restore();

    // contact shadows: darker spots exactly where the body touches the floor
    const contacts: Vec[] = [sk.seg.lsh[1], sk.seg.rsh[1], sk.seg.lft[1], sk.seg.rft[1], sk.seg.lth[1], sk.seg.rth[1], sk.hands[0], sk.hands[1],
      ...sk.slices.map((sl): Vec => [sl.c[0], Math.min(sl.a[1], sl.b[1]) - sl.d / 2, sl.c[2]])];
    for (const v of contacts) {
      if (v[1] > 0.09) continue;
      const q = proj([v[0], 0, v[2]]);
      const r = 0.07 * scale * q[3];
      const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
      g.addColorStop(0, `rgba(0,0,0,${(this.colors.shadow * 0.9 * (1 - v[1] / 0.09)).toFixed(3)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(q[0], q[1], r, r * Math.max(0.35, sp), 0, 0, Math.PI * 2); ctx.fill();
    }

    /* 3. body: painter's algorithm, far → near, each limb shaded like a capsule */
    const pelvisDepth = proj(sk.seg.torso[0])[2];
    type Item = { z: number; draw: () => void };
    const items: Item[] = [];
    const capsule = (pa: number[], pb: number[], w: number, col: string, far: boolean) => () => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
      // soft highlight along the lit side gives the shape volume
      const o = w * 0.17;
      ctx.strokeStyle = far ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.2)';
      ctx.lineWidth = w * 0.34;
      ctx.beginPath(); ctx.moveTo(pa[0] - o * 0.6, pa[1] - o); ctx.lineTo(pb[0] - o * 0.6, pb[1] - o); ctx.stroke();
    };
    const tint = (hot: boolean, far: boolean) =>
      hot ? (far ? this.colors.muscleFar : this.colors.muscle) : far ? this.colors.bodyFar : this.colors.body;

    for (const name of segs) {
      const w0 = limbWidth(name, this.shape);
      if (!w0) continue;
      const [a, b] = sk.seg[name];
      const pa = proj(a), pb = proj(b);
      const z = (pa[2] + pb[2]) / 2;
      const far = z < pelvisDepth - 0.04;
      const hot = this.showMuscles && this.hl.has(name);
      items.push({ z, draw: capsule(pa, pb, w0 * scale * (pa[3] + pb[3]) / 2, tint(hot, far), far) });
    }

    // torso: stacked cross-sections. From the front they read as the silhouette
    // (shoulders, waist, hips); from the side as the profile (chest, belly, back).
    const hot = (t: number) =>
      this.showMuscles &&
      ((t <= 0.22 && this.hl.has('pelvis')) || (t > 0.22 && this.hl.has('torso')) || (t >= 0.9 && this.hl.has('shoulders')));
    // drawn as one item: all bases far → near, then a single highlight stroke,
    // so overlapping sections blend into one smooth surface
    const torsoParts = sk.slices
      .map((sl) => ({ sl, pa: proj(sl.a), pb: proj(sl.b), pc: proj(sl.c) }))
      .sort((a, b) => a.pc[2] - b.pc[2]);
    items.push({
      z: pelvisDepth,
      draw: () => {
        ctx.lineCap = 'round';
        for (const { sl, pa, pb, pc } of torsoParts) {
          ctx.strokeStyle = tint(hot(sl.t), false);
          ctx.lineWidth = sl.d * scale * pc[3];
          ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath();
        let w = 0;
        for (const { sl, pa, pb, pc } of torsoParts) {
          w = Math.max(w, sl.d * scale * pc[3] * 0.3);
          const o = sl.d * scale * pc[3] * 0.17;
          ctx.moveTo(pa[0] - o * 0.6, pa[1] - o); ctx.lineTo(pb[0] - o * 0.6, pb[1] - o);
        }
        ctx.lineWidth = w;
        ctx.stroke();
      },
    });

    const ph = proj(sk.head);
    items.push({
      z: ph[2],
      draw: () => {
        const r = this.shape.head * scale * ph[3];
        const g = ctx.createRadialGradient(ph[0] - r * 0.35, ph[1] - r * 0.4, r * 0.1, ph[0], ph[1], r);
        g.addColorStop(0, 'rgba(255,255,255,.35)');
        g.addColorStop(0.55, 'rgba(255,255,255,0)');
        ctx.fillStyle = this.colors.body;
        ctx.beginPath(); ctx.arc(ph[0], ph[1], r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = g;
        ctx.fill();
      },
    });
    if (this.anim.prop) {
      const [lh, rh] = sk.hands;
      if (this.anim.prop === 'barbell') {
        const dir: Vec = [lh[0] - rh[0], lh[1] - rh[1], lh[2] - rh[2]];
        const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
        const ext = 0.45 / len;
        const a = proj([lh[0] + dir[0] * ext, lh[1] + dir[1] * ext, lh[2] + dir[2] * ext]);
        const b = proj([rh[0] - dir[0] * ext, rh[1] - dir[1] * ext, rh[2] - dir[2] * ext]);
        items.push({
          z: (a[2] + b[2]) / 2 + 0.3,
          draw: () => {
            ctx.strokeStyle = this.colors.iron; ctx.lineCap = 'butt';
            ctx.lineWidth = 0.03 * scale * a[3]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
            for (const e of [a, b]) { ctx.fillStyle = this.colors.iron; ctx.beginPath(); ctx.arc(e[0], e[1], 0.13 * scale * e[3], 0, Math.PI * 2); ctx.fill(); }
          },
        });
      } else {
        for (const h of sk.hands) {
          const a = proj([h[0] - 0.09, h[1], h[2]]), b = proj([h[0] + 0.09, h[1], h[2]]);
          items.push({
            z: (a[2] + b[2]) / 2 + 0.01,
            draw: () => {
              ctx.strokeStyle = this.colors.iron; ctx.lineCap = 'butt';
              ctx.lineWidth = 0.025 * scale; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
              ctx.lineWidth = 0.09 * scale * a[3];
              const m = (p: number[], q: number[], t: number) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
              for (const [s, e] of [[0, 0.22], [0.78, 1]]) {
                const p1 = m(a, b, s), p2 = m(a, b, e);
                ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
              }
            },
          });
        }
      }
    }

    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.draw();
    this.drawSpots(sk, proj, scale);
  }

  /** Body map: a ring on every spot that faces the viewer, a glowing dot on the marked ones. */
  private drawSpots(sk: ReturnType<typeof solve>, proj: (v: Vec) => [number, number, number, number], scale: number): void {
    if (!this.spots) return;
    const { ctx } = this;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dpr = this.canvas.width / (this.canvas.getBoundingClientRect().width || 1);
    const pulse = reducedMotion() ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 3);
    const ring = this.palette().dark ? '255,255,255' : '12,14,20';
    const hot = rgb(this.colors.muscle, [0.88, 0.11, 0.28]).map((v) => Math.round(v * 255)).join(',');
    this.hits = [];
    ctx.save();
    for (const s of regionSpots(sk, this.shape)) {
      // toward the viewer = positive depth after the same yaw and pitch as the camera
      const facing = s.n[1] * sp + (-s.n[0] * sy + s.n[2] * cy) * cp;
      const level = this.spots.get(s.id);
      const hidden = facing < s.cut;
      if (hidden && level === undefined) continue;
      const q = proj(s.p);
      const r = Math.max(5 * dpr, scale * 0.022 * q[3]);
      if (!hidden) this.hits.push({ id: s.id, x: q[0], y: q[1] });
      if (level === undefined) {
        ctx.fillStyle = `rgba(${ring},.14)`;
        ctx.strokeStyle = `rgba(${ring},.5)`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        continue;
      }
      if (hidden) {
        // marked on the far side: only a hollow ring shows through, so it is not mistaken for the near side
        ctx.strokeStyle = `rgba(${hot},.55)`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const k = 1.5 + level * 0.14 + pulse * 0.45;
      const glow = ctx.createRadialGradient(q[0], q[1], r * 0.3, q[0], q[1], r * k * 1.6);
      glow.addColorStop(0, `rgba(${hot},1)`);
      glow.addColorStop(1, `rgba(${hot},0)`);
      ctx.fillStyle = glow;
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.arc(q[0], q[1], r * k * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.colors.muscle;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(q[0], q[1], r * 1.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}
