import { BASE_L, DEFAULT_SHAPE, type BodyShape } from "./engine/pose";
import { getLocale, type Locale } from "./i18n";
import type { BodyScan, Goal, Profile, Sex } from "./types";
import { clamp } from "./utils";

/**
 * Body-based estimates. All of these are population formulas: good enough to
 * shape a plan, not a diagnosis. The UI says so wherever they appear.
 */

export const bmi = (p: Pick<Profile, "height" | "weight">): number =>
	p.weight / (p.height / 100) ** 2;

export type BmiBand = "low" | "normal" | "over" | "high";
export function bmiBand(b: number): BmiBand {
	if (b < 18.5) return "low";
	if (b < 25) return "normal";
	if (b < 30) return "over";
	return "high";
}
const BMI_TEXT_BY_LOCALE: Record<Locale, Record<BmiBand, string>> = {
	fa: {
		low: "کمتر از محدوده‌ی معمول",
		normal: "در محدوده‌ی معمول",
		over: "کمی بالاتر از محدوده‌ی معمول",
		high: "بالاتر از محدوده‌ی معمول",
	},
	en: {
		low: "Below the usual range",
		normal: "In the usual range",
		over: "Slightly above the usual range",
		high: "Above the usual range",
	},
	tr: {
		low: "Normal aralığın altında",
		normal: "Normal aralıkta",
		over: "Normal aralığın biraz üstünde",
		high: "Normal aralığın üstünde",
	},
};

export const bmiBandText = (
	band: BmiBand,
	locale: Locale = getLocale(),
): string => BMI_TEXT_BY_LOCALE[locale][band];

/** Mifflin–St Jeor resting energy; 'x' (not stated) uses the midpoint of both formulas. */
export function bmr(p: Profile): number {
	const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
	return base + (p.sex === "m" ? 5 : p.sex === "f" ? -161 : -78);
}

const ACTIVITY: Record<number, number> = { 2: 1.375, 3: 1.45, 4: 1.55, 5: 1.6 };
const GOAL_SHIFT: Record<Goal, number> = { fatloss: -400, muscle: 250, fit: 0 };

/** Daily energy target with a modest, safe adjustment for the goal. */
export function dailyKcal(p: Profile): number {
	const tdee = bmr(p) * (ACTIVITY[p.days] ?? 1.45);
	const floor = p.sex === "m" ? 1500 : 1200;
	return Math.round(Math.max(floor, tdee + GOAL_SHIFT[p.goal]) / 10) * 10;
}

export const proteinGrams = (p: Profile): number =>
	Math.round(p.weight * (p.goal === "muscle" ? 1.6 : 1.3));

/** Calories for a session from MET × body weight × hours. */
export function sessionKcal(p: Profile, minutes: number): number {
	const met = p.goal === "fatloss" ? 6 : p.goal === "muscle" ? 4.5 : 5;
	return Math.round((met * p.weight * minutes) / 60);
}

/** Waist-to-height ratio: a better marker of body fat than BMI, when the waist is known. */
export const whtr = (p: Pick<Profile, "waist" | "height">): number | null =>
	p.waist ? p.waist / p.height : null;
export const whtrText = (r: number, locale: Locale = getLocale()): string => {
	const texts = {
		fa:
			r < 0.5
				? "در محدوده‌ی سالم"
				: r < 0.6
					? "کمی بالا؛ ارزش پیگیری دارد"
					: "بالا؛ تمرین منظم و کم‌ضربه کمک می‌کند",
		en:
			r < 0.5
				? "Healthy range"
				: r < 0.6
					? "A bit high; worth tracking"
					: "High; regular low-impact training helps",
		tr:
			r < 0.5
				? "Sağlıklı aralık"
				: r < 0.6
					? "Biraz yüksek; takip edilmeli"
					: "Yüksek; düzenli düşük etkili antrenman yardımcı olur",
	} as const;
	return texts[locale];
};

/**
 * Low-impact only: older age, knee trouble, or a heavy body. When the waist is
 * known it decides (a muscular person can have a high BMI and a slim waist);
 * otherwise BMI is the fallback.
 */
export function lowImpact(p: Profile): boolean {
	if (p.age >= 55 || p.limits.includes("knee")) return true;
	const r = whtr(p);
	return r !== null ? r >= 0.6 : bmi(p) >= 30;
}
/** Teens: no heavy barbell work in an unsupervised app. */
export const noBarbell = (p: Profile): boolean => p.age < 18;
/** Extra rest between sets from 50. */
export const extraRest = (p: Profile): number =>
	p.age >= 60 ? 30 : p.age >= 50 ? 15 : 0;

/** Plain-language notes on how the body answers changed the plan. */
export function planNotes(p: Profile, locale: Locale = getLocale()): string[] {
	const texts = {
		fa: {
			lowImpact:
				"حرکت‌های پرشی با حرکت‌های کم‌ضربه جایگزین شدند تا به مفصل‌ها فشار کمتری بیاید.",
			noBarbell: "حرکت‌های هالتر سنگین تا ۱۸ سالگی کنار گذاشته شده‌اند.",
			extraRest: "استراحت بین ست‌ها کمی بیشتر شده است.",
		},
		en: {
			lowImpact:
				"Jumping moves were replaced with lower-impact options to reduce stress on the joints.",
			noBarbell: "Heavy barbell work has been skipped until age 18.",
			extraRest: "Rest between sets is a little longer.",
		},
		tr: {
			lowImpact:
				"Eklem yükünü azaltmak için zıplama hareketleri daha düşük etkili hareketlerle değiştirildi.",
			noBarbell: "18 yaşına kadar ağır barbell çalışmaları bırakıldı.",
			extraRest: "Setler arası dinlenme biraz daha uzun.",
		},
	} as const;
	const n: string[] = [];
	if (lowImpact(p) && !p.limits.includes("knee"))
		n.push(texts[locale].lowImpact);
	if (noBarbell(p)) n.push(texts[locale].noBarbell);
	if (extraRest(p)) n.push(texts[locale].extraRest);
	return n;
}

/* ---------- the user's own mannequin ---------- */

export interface BodyInput {
	sex: Sex;
	height: number;
	weight: number;
	age?: number;
	waist?: number;
	hip?: number;
	chest?: number;
	scan?: BodyScan;
}

/** Population-average circumferences (cm) for a height/BMI, used when the user skips measuring. */
export function estimateCirc(b: BodyInput): {
	waist: number;
	hip: number;
	chest: number;
} {
	const bm = b.weight / (b.height / 100) ** 2;
	const d = bm - 22;
	const age = (b.age ?? 30) - 30;
	const f = b.sex === "f" ? 1 : b.sex === "m" ? 0 : 0.5;
	return {
		waist:
			b.height * (0.45 - 0.02 * f + (0.011 - 0.001 * f) * d + 0.0012 * age),
		hip: b.height * (0.55 + 0.01 * f + (0.01 + 0.002 * f) * d),
		chest: b.height * (0.56 - 0.03 * f + 0.011 * d),
	};
}

/** An ellipse of circumference C (m) and depth/width ratio → width & depth (m). */
const ellipse = (C: number, ratio: number) => {
	const w = (2 * C) / (Math.PI * (1 + ratio));
	return { w, d: w * ratio };
};

/** Circumference of an ellipse (Ramanujan) from its width and depth, in the same unit. */
export const perimeter = (w: number, d: number): number => {
	const a = w / 2,
		b = d / 2;
	return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
};

/** Build a mannequin with the user's proportions: height, mass, sex, waist and hips. */
export function shapeFor(b: BodyInput | null | undefined): BodyShape {
	if (!b || !b.height || !b.weight) return DEFAULT_SHAPE;
	const hs = clamp(b.height / 170, 0.82, 1.24);
	const bm = b.weight / (b.height / 100) ** 2;
	const ff = clamp((bm - 22) / 10, -0.45, 1.8); // 0 = average build
	const sx = b.sex === "m" ? 1 : b.sex === "f" ? -1 : 0;
	const est = estimateCirc(b);
	const waistC = (b.waist ?? est.waist) / 100;
	const hipC = Math.max((b.hip ?? est.hip) / 100, waistC * 0.85);
	const chestC = (b.chest ?? est.chest) / 100;

	const waist = ellipse(waistC, clamp(0.68 + ff * 0.12, 0.6, 0.95));
	const hip = ellipse(hipC, clamp(0.66 + ff * 0.06, 0.6, 0.85));
	const chest = ellipse(
		chestC,
		clamp(0.62 + ff * 0.08 + (sx < 0 ? 0.04 : 0), 0.58, 0.85),
	);

	// a camera scan replaces the population estimates with the user's own cross-sections
	const sc = b.scan;
	// girth follows weight roughly with its square root
	const k = sc ? clamp(Math.sqrt(b.weight / sc.kg), 0.85, 1.2) / 100 : 0;
	if (sc) {
		const fit = (
			e: { w: number; d: number },
			w?: number,
			d?: number,
			tape?: number,
		) => {
			const ratio = e.d / e.w;
			if (w) e.w = w * k;
			e.d = d ? d * k : e.w * ratio;
			// a girth the user typed in still decides the size: the scan only gives the cross-section its shape
			if (tape) {
				const s = tape / 100 / perimeter(e.w, e.d);
				e.w *= s;
				e.d *= s;
			}
		};
		fit(waist, sc.waistW, sc.waistD, b.waist);
		fit(hip, sc.hipW, sc.hipD, b.hip);
		fit(chest, sc.chestW, sc.chestD, b.chest);
	}

	/**
	 * A scanned limb replaces the build-based guess. `draw` is how much slimmer
	 * the model draws that limb than a real one of average build.
	 */
	const limb = (guess: number, cm: number | undefined, draw: number) =>
		cm ? clamp(cm * k * draw, guess * 0.75, guess * 1.5) : guess;
	const arm = limb(
		0.085 * Math.sqrt(hs) * (1 + 0.3 * ff) + sx * 0.004,
		sc?.armW,
		0.92,
	);
	const thigh = limb(
		0.13 * Math.sqrt(hs) * (1 + 0.3 * ff) + (sx < 0 ? 0.012 : 0),
		sc?.thighW,
		0.8,
	);
	const shoulderHalf = sc
		? sc.shoulder / 200
		: (0.19 + sx * 0.016) * hs + ff * 0.01;
	const mid = (a: number, c: number) => (a + c) / 2;

	const hipF = -0.01 - (hip.d - 0.2) * 0.3; // glutes sit behind the hip joints
	const waistF = 0.01 + (waist.d - 0.17) * 0.5; // a bigger belly grows forward, not backward
	const chestF = 0.02 + (chest.d - 0.19) * 0.3 + (sx < 0 ? 0.012 : 0);

	return {
		scale: hs,
		shoulderHalf,
		hipHalf: Math.max(0.07, hip.w / 2 - thigh * 0.7),
		slices: [
			{ t: -0.05, w: hip.w * 0.92, d: hip.d * 0.92, f: hipF },
			{ t: 0.12, w: hip.w, d: hip.d, f: hipF * 0.6 },
			{ t: 0.36, w: waist.w, d: waist.d, f: waistF },
			{
				t: 0.58,
				w: mid(waist.w, chest.w),
				d: mid(waist.d, chest.d),
				f: mid(waistF, chestF),
			},
			{ t: 0.8, w: chest.w, d: chest.d, f: chestF },
			{ t: 0.97, w: shoulderHalf * 2 + arm * 0.5, d: chest.d * 0.75, f: 0.005 },
		],
		arm,
		forearm: limb(0.068 * Math.sqrt(hs) * (1 + 0.22 * ff), sc?.forearmW, 0.85),
		thigh,
		shin: limb(0.09 * Math.sqrt(hs) * (1 + 0.22 * ff), sc?.calfW, 0.8),
		neck: 0.07 * (1 + 0.2 * ff) + sx * 0.006,
		head: 0.1 * Math.pow(hs, 0.3),
		len: sc ? scanLengths(sc, hs) : undefined,
	};
}

/**
 * The user's own proportions (long legs, short torso…) as multipliers on the
 * model's segment lengths. Torso and legs are rescaled together so the
 * mannequin keeps the height the user entered.
 */
function scanLengths(sc: BodyScan, hs: number): BodyShape["len"] {
	const rel = (cm: number, base: number) =>
		clamp(cm / 100 / (base * hs), 0.85, 1.18);
	const torso = rel(sc.torso, BASE_L.torso);
	const th = rel(sc.thigh, BASE_L.th);
	const sh = rel(sc.shin, BASE_L.sh);
	const stack =
		(BASE_L.torso + BASE_L.th + BASE_L.sh) /
		(BASE_L.torso * torso + BASE_L.th * th + BASE_L.sh * sh);
	return {
		torso: torso * stack,
		th: th * stack,
		sh: sh * stack,
		ua: rel(sc.upperArm, BASE_L.ua),
		fa: rel(sc.forearm, BASE_L.fa),
	};
}
