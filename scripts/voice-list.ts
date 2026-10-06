// Prints, as JSON, every piece of speech the app can play from recorded clips
// in one language: [{ file, text }]. make-voice.py turns the list into
// public/voice/<language>/<file>.dat (MP3 audio). The language comes from VOICE_LOCALE.
import "./voice-env";
import { EXERCISES, exerciseName } from "../src/data/exercises";
import { CUES } from "../src/formcheck/analyzers";
import type { Locale } from "../src/i18n";
import { clipName, words } from "../src/voice";
import { doseLine, LINES, MAX_SPOKEN, setLine } from "../src/voiceLines";

const locale = (process.env.VOICE_LOCALE ?? "fa") as Locale;
const texts = new Set<string>();
const add = (...t: string[]) => t.forEach((x) => texts.add(x.trim()));

add(...Object.values(LINES[locale]));
for (let n = 0; n <= MAX_SPOKEN; n++) add(words(n));
for (let sets = 1; sets <= 6; sets++)
	for (let set = 1; set <= sets; set++) add(...setLine(set, sets, locale).parts);
// the words around a weight ("with", "kilos"); the numbers are already in
add(...doseLine(1, false, 1, locale).parts, ...doseLine(1, true, 0, locale).parts);
for (const e of EXERCISES) add(exerciseName(e.id, locale), ...e.guide.cues);
add(...Object.entries(CUES).map(([fa, other]) => (locale === "fa" ? fa : other[locale])));

const out = [...texts].filter(Boolean).map((text) => ({ file: clipName(text), text }));
const files = new Set(out.map((o) => o.file));
if (files.size !== out.length) throw new Error("two clips share a file name");
console.log(JSON.stringify(out));
