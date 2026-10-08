/**
 * What to do instead when a move bothers a sore area. Every training move has
 * at least one entry here, and every area a move lists under `avoid` has one.
 * Swaps never loop, so following them always ends on a move that is gentle on
 * all of the user's sore areas.
 *
 * This is general guidance of the kind a coach gives, not a diagnosis; the UI
 * says so wherever the swaps appear.
 */
import { getLocale, localeTag, type Locale } from "../i18n";
import type { Limit } from "../types";

export const INJURY_ALT: Record<string, Partial<Record<Limit, string>>> = {
	squat: { knee: "minisquat", back: "minisquat" },
	goblet: { knee: "minisquat", back: "minisquat", shoulder: "squat" },
	backsquat: { knee: "minisquat", back: "minisquat", shoulder: "squat" },
	lunge: { knee: "bridge" },
	bridge: { back: "kneehug" },
	rdl: { back: "birddog" },
	deadlift: { back: "birddog", knee: "bridge" },
	pushup: { shoulder: "wallangel", back: "kneepush" },
	kneepush: { shoulder: "wallangel", knee: "plank" },
	floorpress: { shoulder: "wallangel" },
	row: { back: "birddog", shoulder: "shoulderrot" },
	superman: { back: "birddog" },
	press: { shoulder: "shoulderrot" },
	plank: { shoulder: "bridge" },
	birddog: { shoulder: "bridge", knee: "plank" },
	crunch: { back: "birddog" },
	jacks: { knee: "boxing", shoulder: "march" },
	highknees: { knee: "boxing" },
	climber: { shoulder: "march", knee: "boxing", back: "march" },
	boxing: { shoulder: "march" },
	quadstretch: { knee: "hamstretch" },
	childpose: { knee: "kneehug" },
};

/** The gentler stand-ins a move offers, one per sore area it can bother. */
export const injurySwaps = (id: string): { limit: Limit; alt: string }[] =>
	(Object.entries(INJURY_ALT[id] ?? {}) as [Limit, string][]).map(
		([limit, alt]) => ({ limit, alt }),
	);

/**
 * The move to do in place of `id` with these sore areas, or null when `id` is
 * fine as it is. A stand-in that bothers another sore area is swapped again.
 */
export function swapFor(id: string, limits: Limit[]): string | null {
	let cur = id;
	const seen = new Set([id]);
	for (;;) {
		const hit = limits.find((l) => INJURY_ALT[cur]?.[l]);
		const next = hit && INJURY_ALT[cur][hit];
		if (!next || seen.has(next)) break;
		seen.add(next);
		cur = next;
	}
	return cur === id ? null : cur;
}

/** Each plan limit covers the neighbouring joints too (see LIMIT_OF in rehab.ts). */
const AREA: Record<Locale, Record<Limit, string>> = {
	fa: {
		knee: "زانو، لگن یا مچ پا",
		back: "کمر",
		shoulder: "شانه، گردن یا دست",
	},
	en: {
		knee: "knee, hip or ankle",
		back: "back",
		shoulder: "shoulder, neck or arm",
	},
	tr: {
		knee: "diz, kalça veya ayak bileği",
		back: "bel veya sırt",
		shoulder: "omuz, boyun veya kol",
	},
};

/** The sore area in words, lower case for use inside a sentence. */
export const soreArea = (l: Limit, locale: Locale = getLocale()): string =>
	AREA[locale][l];

/** "Knee, hip or ankle pain": the heading of one swap. */
export function sorePain(l: Limit, locale: Locale = getLocale()): string {
	const a = AREA[locale][l];
	if (locale === "fa") return `درد ${a}`;
	const cap = a.charAt(0).toLocaleUpperCase(localeTag(locale)) + a.slice(1);
	return locale === "tr" ? `${cap} ağrısı` : `${cap} pain`;
}
