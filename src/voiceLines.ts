/**
 * Everything the coach says out loud.
 *
 * A line has the full sentence (`text`, read by the cloud or device voice) and
 * the same sentence cut into `parts`: short pieces that exist as recorded clips
 * in public/voice (see scripts/make-voice.py). Keep both in step: a part that
 * has no clip is simply skipped when the clips are playing.
 */
import { getLocale, type Locale } from "./i18n";
import { ordinal, words, type Line } from "./voice";

export const LINES = {
	fa: {
		finished: "آفرین! تمرین تمام شد. این جلسه چطور بود؟",
		rest: "استراحت",
		next: "بعدی",
		go: "شروع!",
		tenLeft: "ده ثانیه مانده",
		voiceOn: "راهنمای صوتی روشن شد",
		seconds: "ثانیه",
		reps: "تکرار",
		warmup: "گرم کردن",
		main: "تمرین اصلی",
		cooldown: "سرد کردن و کشش",
		half: "و نیم",
		camFront: "روبه‌روی گوشی بایست",
		camSide: "از بغل جلوی گوشی قرار بگیر",
		timeDone: "آفرین! زمان کامل شد",
		setDone: "آفرین! ست کامل شد",
	},
	en: {
		finished: "Nice! Workout complete. How did this session feel?",
		rest: "Rest",
		next: "Next",
		go: "Go!",
		tenLeft: "10 seconds left",
		voiceOn: "Voice guide enabled",
		seconds: "seconds",
		reps: "reps",
		warmup: "Warm-up",
		main: "Main workout",
		cooldown: "Cool-down",
		half: "and a half",
		camFront: "Stand facing the phone",
		camSide: "Stand side-on to the phone",
		timeDone: "Well done! Time complete",
		setDone: "Well done! Set complete",
	},
	tr: {
		finished: "Harika! Antrenman bitti. Bu seans nasıl geçti?",
		rest: "Dinlenme",
		next: "Sonraki",
		go: "Başla!",
		tenLeft: "10 saniye kaldı",
		voiceOn: "Sesli rehber açıldı",
		seconds: "saniye",
		reps: "tekrar",
		warmup: "Isınma",
		main: "Ana antrenman",
		cooldown: "Soğuma ve esneme",
		half: "buçuk",
		camFront: "Telefonun karşısında dur",
		camSide: "Telefona yan dur",
		timeDone: "Harika! Süre tamamlandı",
		setDone: "Harika! Set tamamlandı",
	},
} as const satisfies Record<Locale, Record<string, string>>;

/** Whole numbers have a clip each; a half is the whole number plus "and a half". */
export const MAX_SPOKEN = 200;

/** A number as clips: 12 → ["12"], 12.5 → ["12", "and a half"]. */
function numberParts(n: number, locale: Locale): string[] {
	const whole = Math.floor(n);
	return n === whole ? [words(whole)] : [words(whole), LINES[locale].half];
}

/** Several lines (or plain sentences) said one after another. */
export function lines(...items: (string | Line | false | undefined)[]): Line {
	const all = items
		.filter((x): x is string | Line => !!x)
		.map((x) => (typeof x === "string" ? { text: x, parts: [x] } : x));
	return {
		text: all.map((l) => l.text.replace(/[.!?]$/, "")).join(". "),
		parts: all.flatMap((l) => l.parts),
	};
}

export const numberLine = (n: number, locale: Locale = getLocale()): Line => ({
	text: words(n),
	parts: numberParts(n, locale),
});

/** "Set 2 of 4" (one clip per combination). */
export const setLine = (
	set: number,
	sets: number,
	locale: Locale = getLocale(),
): Line => {
	const text =
		locale === "fa"
			? `ست ${ordinal(set)} از ${words(sets)}`
			: locale === "tr"
				? `${set}. set, toplam ${sets}`
				: `Set ${set} of ${sets}`;
	return { text, parts: [text] };
};

/** "10 reps" / "30 seconds", plus "with 12.5 kilos" when there is a weight. */
export function doseLine(
	amount: number,
	timed: boolean,
	kg = 0,
	locale: Locale = getLocale(),
): Line {
	const t = LINES[locale];
	const unit = timed ? t.seconds : t.reps;
	let text = `${words(amount)} ${unit}`;
	const parts = [...numberParts(amount, locale), unit];
	if (kg) {
		if (locale === "fa") {
			text += `، با ${words(kg)} کیلو`;
			parts.push("با", ...numberParts(kg, locale), "کیلو");
		} else if (locale === "tr") {
			text += `, ${words(kg)} kilo ile`;
			parts.push(...numberParts(kg, locale), "kilo ile");
		} else {
			text += ` at ${words(kg)} kilos`;
			parts.push("at", ...numberParts(kg, locale), "kilos");
		}
	}
	return { text, parts };
}

/** "Rest, 45 seconds. Next: squat". */
export function restLine(
	seconds: number,
	nextName: string,
	locale: Locale = getLocale(),
): Line {
	const t = LINES[locale];
	const sep = locale === "fa" ? "، " : ", ";
	return {
		text: `${t.rest}${sep}${words(seconds)} ${t.seconds}. ${t.next}: ${nextName}`,
		parts: [
			t.rest,
			...numberParts(seconds, locale),
			t.seconds,
			t.next,
			nextName,
		],
	};
}
