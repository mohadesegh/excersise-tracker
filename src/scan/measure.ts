/**
 * Body scan maths: two still frames (front and side) → the user's measurements.
 *
 * Joint positions come from the pose landmarks; torso widths and depths come
 * from the body silhouette. Pixels become centimetres through the height the
 * user entered, so the camera distance does not matter.
 */
import { estimateCirc, perimeter } from "../body";
import { P, type Lm } from "../formcheck/analyzers";
import type { BodyScan, Sex } from "../types";
import { clamp, dayKey } from "../utils";

export interface Silhouette {
	data: Float32Array;
	w: number;
	h: number;
}

/** One captured video frame: landmarks (0..1 of the frame), frame size in pixels, and the silhouette. */
export interface Frame {
	lms: Lm[];
	w: number;
	h: number;
	mask?: Silhouette;
}

export type Facing = "front" | "side" | "none";

const HEEL_L = 29;
const HEEL_R = 30;
const NEEDED = [
	P.nose,
	P.lShoulder,
	P.rShoulder,
	P.lHip,
	P.rHip,
	P.lKnee,
	P.rKnee,
	P.lAnkle,
	P.rAnkle,
];

type Pt = [number, number];
const px = (f: Frame, i: number): Pt => [f.lms[i].x * f.w, f.lms[i].y * f.h];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a: Pt, b: Pt, t: number): Pt => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
];

/**
 * Head to feet inside the frame, with a little margin, and seen clearly.
 * Side-on, the far shoulder, hip, knee and ankle are hidden: one of each pair is enough.
 */
export function wholeBody(lms: Lm[], profile = false): boolean {
	const inFrame = (i: number) => {
		const p = lms[i];
		return !!p && p.x > 0.02 && p.x < 0.98 && p.y > 0.03 && p.y < 0.98;
	};
	const seen = (i: number) => (lms[i]?.visibility ?? 1) > 0.5;
	if (!NEEDED.every(inFrame) || !seen(P.nose)) return false;
	const pairs = [
		[P.lShoulder, P.rShoulder],
		[P.lHip, P.rHip],
		[P.lKnee, P.rKnee],
		[P.lAnkle, P.rAnkle],
	];
	return pairs.every(([l, r]) =>
		profile ? seen(l) || seen(r) : seen(l) && seen(r),
	);
}

/** Which way the body is turned, from how wide the shoulders look next to the torso length. */
export function facing(lms: Lm[], aspect: number): Facing {
	const f: Frame = { lms, w: aspect, h: 1 };
	const ls = px(f, P.lShoulder),
		rs = px(f, P.rShoulder);
	const torso = dist(mid(ls, rs), mid(px(f, P.lHip), px(f, P.rHip)));
	if (torso < 0.05) return "none";
	const r = Math.abs(ls[0] - rs[0]) / torso;
	return r > 0.55 ? "front" : r < 0.3 ? "side" : "none";
}

/** Arms held a little away from the body, so the waist is not hidden behind them. */
export function armsClear(lms: Lm[], aspect: number): boolean {
	const f: Frame = { lms, w: aspect, h: 1 };
	const sh = Math.abs(px(f, P.lShoulder)[0] - px(f, P.rShoulder)[0]);
	const wr = Math.abs(px(f, P.lWrist)[0] - px(f, P.rWrist)[0]);
	return wr > sh * 1.45;
}

/** How far the body moved between two frames, as a fraction of the frame. */
export function drift(a: Lm[], b: Lm[]): number {
	let d = 0;
	for (const i of NEEDED)
		d = Math.max(d, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
	return d;
}

const ON = 0.5;
const at = (m: Silhouette, x: number, y: number): boolean => {
	const xi = Math.round(x),
		yi = Math.round(y);
	return (
		xi >= 0 && yi >= 0 && xi < m.w && yi < m.h && m.data[yi * m.w + xi] > ON
	);
};

/**
 * Width of the body along one image row, growing outward from a point inside
 * it. `lo`/`hi` fence the walk (the arms, in the front view); a walk that
 * reaches a fence means the edge was not found, and gives null.
 */
function rowWidth(
	m: Silhouette,
	x: number,
	y: number,
	lo: number,
	hi: number,
): number | null {
	if (!at(m, x, y)) return null;
	let l = x,
		r = x;
	while (l > lo && at(m, l - 1, y)) l--;
	while (r < hi && at(m, r + 1, y)) r++;
	if (l <= lo || r >= hi) return null;
	return r - l + 1;
}

const median = (v: number[]): number | null => {
	if (!v.length) return null;
	const s = [...v].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
};

/** Top of the head to the soles, in frame pixels. */
function heightPx(f: Frame): number {
	const feet = Math.max(
		...[P.lAnkle, P.rAnkle, HEEL_L, HEEL_R]
			.filter((i) => f.lms[i])
			.map((i) => px(f, i)[1]),
	);
	const nose = px(f, P.nose)[1];
	// landmarks alone: the nose sits at about 93% of standing height, the heel about 2% above the floor
	const guess = (feet - nose) / 0.91;
	const m = f.mask;
	if (!m) return guess;
	const sx = m.w / f.w,
		sy = m.h / f.h;
	const cx = px(f, P.nose)[0] * sx;
	let top = -1;
	for (let y = 0; y < nose * sy && top < 0; y++)
		for (let d = -4; d <= 4; d++)
			if (at(m, cx + d, y)) {
				top = y;
				break;
			}
	if (top < 0) return guess;
	const exact = feet + 0.02 * guess - top / sy;
	// the silhouette can pick up a hat or lose the hair: trust it only near the landmark estimate
	return Math.abs(exact - guess) < guess * 0.08 ? exact : guess;
}

/** Torso width (or depth, in a side frame) in centimetres at three heights between the hips and shoulders. */
function sections(
	f: Frame,
	cm: number,
	fence: boolean,
): { hip: number | null; waist: number | null; chest: number | null } {
	const none = { hip: null, waist: null, chest: null };
	const m = f.mask;
	if (!m) return none;
	const sx = m.w / f.w,
		sy = m.h / f.h;
	const hips = mid(px(f, P.lHip), px(f, P.rHip));
	const shoulders = mid(px(f, P.lShoulder), px(f, P.rShoulder));
	const torso = dist(hips, shoulders);

	/** x of an arm's centre line at image row y, or null when the arm does not cross that row */
	const armX = (s: number, e: number, w: number, y: number): number | null => {
		const pts = [px(f, s), px(f, e), px(f, w)];
		for (let i = 0; i < 2; i++) {
			const [a, b] = [pts[i], pts[i + 1]];
			if ((y - a[1]) * (y - b[1]) <= 0 && a[1] !== b[1])
				return a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
		}
		return null;
	};

	const cut = (t: number): number | null => {
		const out: number[] = [];
		for (const dt of [-0.03, 0, 0.03]) {
			const c = lerp(hips, shoulders, t + dt);
			let lo = 0,
				hi = f.w - 1;
			if (fence) {
				const xs = [
					armX(P.lShoulder, P.lElbow, P.lWrist, c[1]),
					armX(P.rShoulder, P.rElbow, P.rWrist, c[1]),
				].filter((v): v is number => v !== null);
				for (const x of xs) {
					if (x < c[0]) lo = Math.max(lo, x);
					else hi = Math.min(hi, x);
				}
			} else {
				// nobody is deeper than their torso is long
				lo = c[0] - torso;
				hi = c[0] + torso;
			}
			const w = rowWidth(m, c[0] * sx, c[1] * sy, lo * sx, hi * sx);
			if (w !== null) out.push((w / sx) * cm);
		}
		return median(out);
	};
	return { hip: cut(0.02), waist: cut(0.4), chest: cut(0.74) };
}

/**
 * Thickness of a limb in frame pixels, measured across the bone a→b at a few
 * points along it. `reach` (a fraction of the bone length) is how far the edge
 * is looked for on each side.
 */
function limbWidth(
	f: Frame,
	a: number,
	b: number,
	ts: number[],
	reach: number,
): number | null {
	const m = f.mask;
	if (!m || !f.lms[a] || !f.lms[b]) return null;
	const sx = m.w / f.w,
		sy = m.h / f.h;
	const p = px(f, a),
		q = px(f, b);
	const len = dist(p, q);
	if (len < 8) return null;
	const n: Pt = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len];
	const max = len * reach;
	const out: number[] = [];
	for (const t of ts) {
		const c = lerp(p, q, t);
		const on = (k: number) =>
			at(m, (c[0] + n[0] * k) * sx, (c[1] + n[1] * k) * sy);
		if (!on(0)) continue;
		const edge = (dir: 1 | -1): number | null => {
			let k = 0;
			while (k < max && on(dir * (k + 1))) k++;
			return k < max ? k : null;
		};
		const l = edge(-1),
			r = edge(1);
		// one side runs into the torso or the other leg: the limb is taken as symmetric about its bone
		const one = l ?? r;
		if (one === null) continue;
		out.push(l !== null && r !== null ? l + r + 1 : 2 * one + 1);
	}
	return median(out);
}

export interface ScanInput {
	sex: Sex;
	age: number;
	/** centimetres */
	height: number;
	/** kilograms */
	weight: number;
}

/**
 * Front frame (required) + side frame (optional) → measurements.
 * Returns null when the front frame is unusable.
 */
export function measure(
	front: Frame,
	side: Frame | null,
	who: ScanInput,
): BodyScan | null {
	if (!wholeBody(front.lms)) return null;
	const hpx = heightPx(front);
	// standing well back from the phone is fine: the body only has to be big enough to measure
	if (!(hpx > front.h * 0.15)) return null;
	const cm = who.height / hpx;
	const seg = (a: number, b: number) => dist(px(front, a), px(front, b)) * cm;
	const both = (l: [number, number], r: [number, number]) =>
		(seg(...l) + seg(...r)) / 2;
	const round = (v: number) => Math.round(v * 10) / 10;

	// what an average body of this height and weight measures: the scan may move away from it, within reason
	const est = estimateCirc(who);
	const typical = (circ: number, ratio: number) => {
		const w = (2 * circ) / (Math.PI * (1 + ratio));
		return { w, d: w * ratio };
	};
	const expect = {
		hip: typical(est.hip, 0.68),
		waist: typical(est.waist, 0.72),
		chest: typical(est.chest, 0.66),
	};
	const sane = (v: number | null, around: number): number | undefined =>
		v !== null && v > around * 0.6 && v < around * 1.7
			? round(clamp(v, around * 0.72, around * 1.45))
			: undefined;

	const fw = sections(front, cm, true);
	const sideOk = side && wholeBody(side.lms, true);
	const sd = sideOk
		? sections(side, who.height / heightPx(side), false)
		: { hip: null, waist: null, chest: null };

	/** both sides of a limb, averaged; kept only inside what a body of this height can measure */
	const limb = (
		l: [number, number],
		r: [number, number],
		ts: number[],
		reach: number,
		min: number,
		max: number,
	): number | undefined => {
		const v = [l, r]
			.map(([a, b]) => limbWidth(front, a, b, ts, reach))
			.filter((x): x is number => x !== null);
		if (!v.length) return undefined;
		const w = (v.reduce((s, x) => s + x, 0) / v.length) * cm;
		return w > who.height * min && w < who.height * max ? round(w) : undefined;
	};

	const shoulder = seg(P.lShoulder, P.rShoulder);
	return {
		armW: limb(
			[P.lShoulder, P.lElbow],
			[P.rShoulder, P.rElbow],
			[0.45, 0.55, 0.65],
			0.4,
			0.035,
			0.09,
		),
		forearmW: limb(
			[P.lElbow, P.lWrist],
			[P.rElbow, P.rWrist],
			[0.25, 0.35, 0.45],
			0.3,
			0.03,
			0.07,
		),
		thighW: limb(
			[P.lHip, P.lKnee],
			[P.rHip, P.rKnee],
			[0.45, 0.55, 0.65],
			0.4,
			0.06,
			0.15,
		),
		calfW: limb(
			[P.lKnee, P.lAnkle],
			[P.rKnee, P.rAnkle],
			[0.25, 0.32, 0.4],
			0.25,
			0.045,
			0.1,
		),
		date: dayKey(),
		kg: who.weight,
		shoulder: round(clamp(shoulder, who.height * 0.17, who.height * 0.29)),
		chestW: sane(fw.chest, expect.chest.w),
		chestD: sane(sd.chest, expect.chest.d),
		waistW: sane(fw.waist, expect.waist.w),
		waistD: sane(sd.waist, expect.waist.d),
		hipW: sane(fw.hip, expect.hip.w),
		hipD: sane(sd.hip, expect.hip.d),
		torso: round(
			dist(
				mid(px(front, P.lShoulder), px(front, P.rShoulder)),
				mid(px(front, P.lHip), px(front, P.rHip)),
			) * cm,
		),
		upperArm: round(
			both([P.lShoulder, P.lElbow], [P.rShoulder, P.rElbow]),
		),
		forearm: round(both([P.lElbow, P.lWrist], [P.rElbow, P.rWrist])),
		thigh: round(both([P.lHip, P.lKnee], [P.rHip, P.rKnee])),
		shin: round(both([P.lKnee, P.lAnkle], [P.rKnee, P.rAnkle])),
	};
}

const MEASURED = [
	"shoulder",
	"chestW",
	"chestD",
	"waistW",
	"waistD",
	"hipW",
	"hipD",
	"armW",
	"forearmW",
	"thighW",
	"calfW",
	"torso",
	"upperArm",
	"forearm",
	"thigh",
	"shin",
] as const satisfies readonly (keyof BodyScan)[];

/**
 * Several frames of each view → one set of measurements: every number is the
 * median of what the single frames gave, so one jittery frame does not decide it.
 */
export function measureAll(
	fronts: Frame[],
	sides: Frame[],
	who: ScanInput,
): BodyScan | null {
	const n = Math.max(fronts.length, sides.length);
	const scans: BodyScan[] = [];
	for (let i = 0; i < n && fronts.length; i++) {
		const s = measure(
			fronts[i % fronts.length],
			sides.length ? sides[i % sides.length] : null,
			who,
		);
		if (s) scans.push(s);
	}
	if (!scans.length) return null;
	const out = { ...scans[0] };
	for (const key of MEASURED) {
		const m = median(
			scans.map((s) => s[key]).filter((v): v is number => v !== undefined),
		);
		if (m !== null) out[key] = m;
	}
	return out;
}

/** Ellipse circumference (Ramanujan) from a width and depth, for showing the scan as tape-measure numbers. */
export function girth(w?: number, d?: number): number | null {
	if (!w || !d) return null;
	return Math.round(perimeter(w, d));
}
