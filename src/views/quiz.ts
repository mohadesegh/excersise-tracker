import { A_POSE, EX, IDLE } from "../data/exercises";
import type { Mannequin } from "../engine/mannequin";
import { shapeFor } from "../body";
import { buildPlan } from "../planner";
import { state, update } from "../store";
import { limitsFromPains, painsFromLimits } from "../rehab";
import { girth } from "../scan/measure";
import { openBodyScan } from "../scan/scanner";
import type {
	Absent,
	BodyScan,
	Goal,
	Level,
	Limb,
	LimbGap,
	Pain,
	Place,
	Profile,
	Sex,
} from "../types";
import { $, $$, buzz, dayKey, esc, fa, go, parseFaNumber } from "../utils";
import { mountPainMap } from "./painmap";
import { backIcon, mountMannequin, type Cleanup, type View } from "./ui";
import { getLocale, setLocale, t, type Locale } from "../i18n";

interface Option {
	v: string;
	label: string;
	hint?: string;
	emoji: string;
	ex: string;
}
interface Step {
	key: keyof Draft | "body";
	q: string;
	sub?: string;
	compact?: boolean;
	options?: Option[];
}

interface Draft {
	goal?: Goal;
	level?: Level;
	place?: Place;
	days?: number;
	minutes?: number;
	pains: Pain[];
	scan?: BodyScan;
	name: string;
	sex?: Sex;
	age: number;
	height: number;
	weight: number;
	waist?: number;
	hip?: number;
	chest?: number;
	absent?: Absent;
}

/** The limb-difference choices: for each limb, what the user has of it. */
const LIMB_TEXT = {
	fa: {
		title: "تفاوت اندام",
		optional: "(اختیاری)",
		help: "اگر دست یا پایی نداری، این‌جا بگو تا آدمک و اسکن با بدن خودت جور باشند.",
		limbs: { armL: "دست چپ", armR: "دست راست", legL: "پای چپ", legR: "پای راست" },
		full: "کامل",
		arm: { lower: "از آرنج به پایین ندارم", whole: "از شانه ندارم" },
		leg: { lower: "از زانو به پایین ندارم", whole: "از لگن ندارم" },
	},
	en: {
		title: "Limb difference",
		optional: "(optional)",
		help: "If you do not have an arm or a leg, say so here and the figure and the scan will match your body.",
		limbs: { armL: "Left arm", armR: "Right arm", legL: "Left leg", legR: "Right leg" },
		full: "Complete",
		arm: { lower: "None below the elbow", whole: "None from the shoulder" },
		leg: { lower: "None below the knee", whole: "None from the hip" },
	},
	tr: {
		title: "Uzuv farklılığı",
		optional: "(isteğe bağlı)",
		help: "Bir kolun ya da bacağın yoksa burada belirt; figür ve tarama vücuduna uysun.",
		limbs: { armL: "Sol kol", armR: "Sağ kol", legL: "Sol bacak", legR: "Sağ bacak" },
		full: "Tam",
		arm: { lower: "Dirsekten aşağısı yok", whole: "Omuzdan itibaren yok" },
		leg: { lower: "Dizden aşağısı yok", whole: "Kalçadan itibaren yok" },
	},
} as const;
const LIMBS: Limb[] = ["armL", "armR", "legL", "legR"];

const BODY_FIELDS = (locale: Locale) => {
	const labels = {
		fa: {
			age: "سن",
			height: "قد",
			weight: "وزن",
			ageUnit: "سال",
			heightUnit: "سانتی‌متر",
			weightUnit: "کیلوگرم",
		},
		en: {
			age: "Age",
			height: "Height",
			weight: "Weight",
			ageUnit: "years",
			heightUnit: "cm",
			weightUnit: "kg",
		},
		tr: {
			age: "Yaş",
			height: "Boy",
			weight: "Kilo",
			ageUnit: "yıl",
			heightUnit: "cm",
			weightUnit: "kg",
		},
	}[locale];
	return [
		{
			k: "age",
			label: labels.age,
			unit: labels.ageUnit,
			min: 14,
			max: 80,
			step: 1,
		},
		{
			k: "height",
			label: labels.height,
			unit: labels.heightUnit,
			min: 140,
			max: 210,
			step: 1,
		},
		{
			k: "weight",
			label: labels.weight,
			unit: labels.weightUnit,
			min: 35,
			max: 180,
			step: 1,
		},
	] as const;
};

const CHEERS = {
	fa: ["عالیه!", "ثبت شد", "خوب شد", "حله"],
	en: ["Awesome!", "Saved", "Nice", "Great"],
	tr: ["Harika!", "Kaydedildi", "Güzel", "Mükemmel"],
} as const;

const buildSteps = (locale: Locale): Step[] => {
	const q = {
		fa: {
			goal: "دنبال چی هستی؟",
			level: "الان چقدر ورزش می‌کنی؟",
			body: "کمی از بدنت بگو",
			bodySub:
				"برای تنظیم شدت تمرین و تخمین کالری. فقط روی همین دستگاه می‌ماند.",
			place: "کجا تمرین می‌کنی؟",
			days: "هفته‌ای چند روز؟",
			daysSub: "کمتر و پیوسته، بهتر از زیاد و نصفه‌نیمه است.",
			minutes: "هر جلسه چقدر وقت داری؟",
			scan: "بدنت را اسکن کنیم؟",
			scanSub:
				"دوربین اندازه‌های بدنت را می‌گیرد و آدمک سه‌بعدی را شبیه خودت می‌سازد. هیچ عکسی ذخیره نمی‌شود.",
			pains: "کجای بدنت درد دارد؟",
			painsSub:
				"روی بدن خودت نشان بده. حرکت‌های پرفشار برای آن ناحیه کنار می‌روند و حرکت اصلاحی می‌گیری.",
			name: "آخرین سؤال: اسمت چیه؟",
			nameSub: "اختیاری است؛ فقط برای اینکه صدایت کنیم.",
		},
		en: {
			goal: "What are you aiming for?",
			level: "How active are you right now?",
			body: "Tell us a bit about your body",
			bodySub:
				"To tune intensity and estimate calories. It stays on this device only.",
			place: "Where do you train?",
			days: "How many days per week?",
			daysSub: "Less, but consistent, is better than too much and half-done.",
			minutes: "How much time do you have per session?",
			scan: "Shall we scan your body?",
			scanSub:
				"The camera takes your measurements and shapes the 3D figure like you. No picture is saved.",
			pains: "Where does your body hurt?",
			painsSub:
				"Show it on your own body. Hard moves for that area are left out and you get corrective moves.",
			name: "One last question: what is your name?",
			nameSub: "Optional; just so we know what to call you.",
		},
		tr: {
			goal: "Ne hedefliyorsun?",
			level: "Şu an ne kadar spor yapıyorsun?",
			body: "Bize biraz vücudundan bahset",
			bodySub:
				"Antrenman yoğunluğunu ayarlamak ve kalori tahmini için. Sadece bu cihazda kalır.",
			place: "Nerede antrenman yapıyorsun?",
			days: "Haftada kaç gün?",
			daysSub:
				"Daha az ama düzenli olmak, çok ama yarım yamalak olandan daha iyidir.",
			minutes: "Her seans ne kadar zamanın var?",
			scan: "Vücudunu tarayalım mı?",
			scanSub:
				"Kamera ölçülerini alır ve 3D figürü sana benzetir. Hiçbir fotoğraf kaydedilmez.",
			pains: "Vücudunun neresi ağrıyor?",
			painsSub:
				"Kendi vücudunun üzerinde göster. O bölgeyi zorlayan hareketler çıkarılır ve düzeltici hareketler alırsın.",
			name: "Son soru: adın ne?",
			nameSub: "İsteğe bağlı; sadece sana adınla hitap etmek için.",
		},
	}[locale];

	return [
		{
			key: "goal",
			q: q.goal,
			options: [
				{
					v: "fatloss",
					emoji: "🔥",
					label:
						locale === "fa"
							? "چربی‌سوزی"
							: locale === "tr"
								? "Yağ kaybı"
								: "Fat loss",
					hint:
						locale === "fa"
							? "سبک‌تر و چابک‌تر شوم"
							: locale === "tr"
								? "Daha hafif ve çevik olayım"
								: "Light and agile",
					ex: "jacks",
				},
				{
					v: "muscle",
					emoji: "💪",
					label:
						locale === "fa"
							? "عضله‌سازی"
							: locale === "tr"
								? "Kas kazanımı"
								: "Muscle gain",
					hint:
						locale === "fa"
							? "قوی‌تر و فرم‌گرفته‌تر"
							: locale === "tr"
								? "Daha güçlü ve daha biçimli"
								: "Stronger and more defined",
					ex: "press",
				},
				{
					v: "fit",
					emoji: "🌿",
					label:
						locale === "fa"
							? "سرحال و سالم"
							: locale === "tr"
								? "Sağlıklı ve enerjik"
								: "Healthy & fit",
					hint:
						locale === "fa"
							? "انرژی بیشتر، بدن روان‌تر"
							: locale === "tr"
								? "Daha fazla enerji, daha akıcı vücut"
								: "More energy, smoother body",
					ex: "boxing",
				},
			],
		},
		{
			key: "level",
			q: q.level,
			options: [
				{
					v: "1",
					emoji: "🌱",
					label:
						locale === "fa"
							? "تازه شروع کرده‌ام"
							: locale === "tr"
								? "Yeni başladım"
								: "Just starting out",
					ex: "kneepush",
				},
				{
					v: "2",
					emoji: "🚶",
					label:
						locale === "fa"
							? "گاهی تمرین می‌کنم"
							: locale === "tr"
								? "Bazen egzersiz yapıyorum"
								: "I train occasionally",
					ex: "pushup",
				},
				{
					v: "3",
					emoji: "⚡",
					label:
						locale === "fa"
							? "منظم تمرین می‌کنم"
							: locale === "tr"
								? "Düzenli antrenman yapıyorum"
								: "I train consistently",
					ex: "climber",
				},
			],
		},
		{ key: "body", q: q.body, sub: q.bodySub },
		{ key: "scan", q: q.scan, sub: q.scanSub },
		{
			key: "place",
			q: q.place,
			options: [
				{
					v: "bodyweight",
					emoji: "🏠",
					label:
						locale === "fa"
							? "خانه، بدون وسیله"
							: locale === "tr"
								? "Ev, alet yok"
								: "Home, no equipment",
					ex: "squat",
				},
				{
					v: "dumbbell",
					emoji: "🏋️",
					label:
						locale === "fa"
							? "خانه، با دمبل"
							: locale === "tr"
								? "Ev, dambıl var"
								: "Home, with dumbbells",
					ex: "goblet",
				},
				{
					v: "gym",
					emoji: "🏟️",
					label:
						locale === "fa"
							? "باشگاه"
							: locale === "tr"
								? "Spor salonu"
								: "Gym",
					ex: "backsquat",
				},
			],
		},
		{
			key: "days",
			q: q.days,
			sub: q.daysSub,
			compact: true,
			options: [
				{
					v: "2",
					emoji: "",
					label: locale === "fa" ? "۲" : locale === "tr" ? "2" : "2",
					hint:
						locale === "fa"
							? "شروع آرام"
							: locale === "tr"
								? "Yumuşak başlangıç"
								: "Gentle start",
					ex: "birddog",
				},
				{
					v: "3",
					emoji: "",
					label: locale === "fa" ? "۳" : locale === "tr" ? "3" : "3",
					hint:
						locale === "fa"
							? "متعادل"
							: locale === "tr"
								? "Dengeli"
								: "Balanced",
					ex: "squat",
				},
				{
					v: "4",
					emoji: "",
					label: locale === "fa" ? "۴" : locale === "tr" ? "4" : "4",
					hint: locale === "fa" ? "جدی" : locale === "tr" ? "Ciddi" : "Serious",
					ex: "lunge",
				},
				{
					v: "5",
					emoji: "",
					label: locale === "fa" ? "۵" : locale === "tr" ? "5" : "5",
					hint:
						locale === "fa"
							? "پرانرژی"
							: locale === "tr"
								? "Enerjik"
								: "High energy",
					ex: "highknees",
				},
			],
		},
		{
			key: "minutes",
			q: q.minutes,
			compact: true,
			options: [
				{
					v: "20",
					emoji: "",
					label: locale === "fa" ? "۲۰" : locale === "tr" ? "20" : "20",
					hint:
						locale === "fa"
							? "دقیقه، فشرده"
							: locale === "tr"
								? "dakika, yoğun"
								: "min, intense",
					ex: "jacks",
				},
				{
					v: "35",
					emoji: "",
					label: locale === "fa" ? "۳۵" : locale === "tr" ? "35" : "35",
					hint:
						locale === "fa"
							? "دقیقه، معمولی"
							: locale === "tr"
								? "dakika, normal"
								: "min, standard",
					ex: "row",
				},
				{
					v: "50",
					emoji: "",
					label: locale === "fa" ? "۵۰" : locale === "tr" ? "50" : "50",
					hint:
						locale === "fa"
							? "دقیقه، کامل"
							: locale === "tr"
								? "dakika, tam"
								: "min, full",
					ex: "deadlift",
				},
			],
		},
		{ key: "pains", q: q.pains, sub: q.painsSub },
		{ key: "name", q: q.name, sub: q.nameSub },
	];
};

const SCAN_TEXT = {
	fa: {
		start: "شروع اسکن با دوربین",
		skip: "فعلاً نه",
		again: "اسکن دوباره",
		remove: "حذف اسکن",
		done: "اسکن شد. آدمک حالا اندازه‌های خودت را دارد؛ با انگشت بچرخانش.",
		drag: "آدمک را با انگشت بچرخان.",
		shoulder: "عرض شانه",
		chest: "دور سینه",
		waist: "دور کمر",
		hip: "دور باسن",
		leg: "طول پا",
		cm: "سانت",
		approx:
			"اعداد تخمین دوربین هستند. اگر با متر اندازه گرفته‌ای یا عددی درست نیست، همین‌جا اصلاحش کن.",
		noPain: "دردی ندارم",
	},
	en: {
		start: "Start the camera scan",
		skip: "Not now",
		again: "Scan again",
		remove: "Remove scan",
		done: "Scanned. The figure now has your measurements; turn it with your finger.",
		drag: "Turn the figure with your finger.",
		shoulder: "Shoulder width",
		chest: "Chest",
		waist: "Waist",
		hip: "Hips",
		leg: "Leg length",
		cm: "cm",
		approx:
			"These are camera estimates. If you measured with a tape or a number is off, correct it here.",
		noPain: "I have no pain",
	},
	tr: {
		start: "Kamerayla taramayı başlat",
		skip: "Şimdi değil",
		again: "Yeniden tara",
		remove: "Taramayı sil",
		done: "Tarandı. Figür artık senin ölçülerinde; parmağınla döndür.",
		drag: "Figürü parmağınla döndür.",
		shoulder: "Omuz genişliği",
		chest: "Göğüs çevresi",
		waist: "Bel çevresi",
		hip: "Kalça çevresi",
		leg: "Bacak boyu",
		cm: "cm",
		approx:
			"Bunlar kamera tahminidir. Mezurayla ölçtüysen ya da bir sayı yanlışsa buradan düzelt.",
		noPain: "Ağrım yok",
	},
} as const;

type Measure = "shoulder" | "chest" | "waist" | "hip";

/** Accepted range of each editable measurement, in centimetres. */
const MEASURE_RANGE: Record<Measure, [number, number]> = {
	shoulder: [25, 65],
	chest: [50, 200],
	waist: [40, 200],
	hip: [40, 200],
};

/**
 * The measurements the figure is built from, as editable tape-measure numbers:
 * what the user typed in wins, the camera's estimate fills the rest.
 */
function scanFields(
	d: Pick<Draft, "chest" | "waist" | "hip">,
	scan: BodyScan,
	locale: Locale,
): [Measure, string, number | null][] {
	const st = SCAN_TEXT[locale];
	return [
		["shoulder", st.shoulder, Math.round(scan.shoulder)],
		["chest", st.chest, d.chest ?? girth(scan.chestW, scan.chestD)],
		["waist", st.waist, d.waist ?? girth(scan.waistW, scan.waistD)],
		["hip", st.hip, d.hip ?? girth(scan.hipW, scan.hipD)],
	];
}

export const quizView: View = (root) => {
	const locale = getLocale();
	setLocale(locale);
	const p = state.profile;
	const d: Draft = p
		? {
				goal: p.goal,
				level: p.level,
				place: p.place,
				days: p.days,
				minutes: p.minutes,
				pains: p.pains
					? p.pains.map((x) => ({ ...x }))
					: painsFromLimits(p.limits),
				scan: p.scan,
				name: p.name,
				sex: p.sex,
				age: p.age ?? 28,
				height: p.height ?? 170,
				weight: p.weight ?? 70,
				waist: p.waist,
				hip: p.hip,
				chest: p.chest,
				absent: p.absent ? { ...p.absent } : undefined,
			}
		: { pains: [], name: "", age: 28, height: 170, weight: 70 };
	const steps = buildSteps(locale);
	const bodyFields = BODY_FIELDS(locale);
	const st = SCAN_TEXT[locale];
	let i = 0;
	let timer = 0;
	let painOff: Cleanup | null = null;
	let closeScan: Cleanup | null = null;

	root.innerHTML = `
    <section class="quiz">
      <header class="quiz-top">
        <button class="icon-btn" data-act="back" aria-label="${t("back", locale)}">${backIcon}</button>
        <div class="segbar" aria-hidden="true">${steps.map(() => "<span></span>").join("")}</div>
        <span class="quiz-count"></span>
      </header>
      <div class="quiz-stage"><canvas aria-label="${locale === "fa" ? "آدمک سه‌بعدی؛ برای چرخاندن بکشید" : locale === "tr" ? "3D figür; döndürmek için sürükle" : "3D figure; drag to rotate"}"></canvas><span class="cheer" aria-live="polite"></span></div>
      <div class="quiz-body"></div>
    </section>`;

	const body = $(".quiz-body", root)!;
	const stage = $(".quiz-stage", root)!;
	const canvas = $<HTMLCanvasElement>(".quiz-stage canvas", root)!;
	const mq: Mannequin = mountMannequin(canvas, "squat", {
		interactive: true,
		spin: 0.35,
	});

	const preview = (exId: string) => {
		const ex = EX[exId];
		mq.setAnim(ex.anim, ex.muscles);
	};

	/** the mannequin morphs as the user describes (or scans) their body */
	const reshape = () =>
		mq.setBody(
			shapeFor({
				sex: d.sex ?? "x",
				age: d.age,
				height: d.height,
				weight: d.weight,
				waist: d.waist,
				hip: d.hip,
				chest: d.chest,
				scan: d.scan,
				absent: d.absent,
			}),
		);

	const selected = (s: Step, v: string): boolean =>
		s.key !== "body" && String(d[s.key] ?? "") === v;

	function render() {
		const s = steps[i];
		if (painOff) {
			painOff();
			painOff = null;
			mq.spinAgain();
		}
		// the steps about the user's own body give the 3D figure more room
		stage.classList.toggle("tall", s.key === "scan" || s.key === "pains");
		$$(".segbar span", root).forEach((el, k) =>
			el.classList.toggle("on", k <= i),
		);
		const count =
			locale === "fa"
				? `${fa(i + 1)} از ${fa(steps.length)}`
				: locale === "tr"
					? `${i + 1} / ${steps.length}`
					: `${i + 1} of ${steps.length}`;
		$(".quiz-count", root)!.textContent = count;
		$<HTMLButtonElement>('[data-act="back"]', root)!.style.visibility =
			i === 0 && !p ? "hidden" : "visible";

		let inner = `<h1 class="q">${s.q}</h1>${s.sub ? `<p class="q-sub">${s.sub}</p>` : ""}`;
		if (s.key === "body") {
			const sexes: [Sex, string][] = [
				["f", locale === "fa" ? "خانم" : locale === "tr" ? "Kadın" : "Woman"],
				["m", locale === "fa" ? "آقا" : locale === "tr" ? "Erkek" : "Man"],
				[
					"x",
					locale === "fa"
						? "ترجیح می‌دهم نگویم"
						: locale === "tr"
							? "Belirtmek istemiyorum"
							: "Prefer not to say",
				],
			];
			const bodyText = {
				waist:
					locale === "fa"
						? "دور کمر"
						: locale === "tr"
							? "Bel çevresi"
							: "Waist",
				hip:
					locale === "fa"
						? "دور باسن"
						: locale === "tr"
							? "Kalça çevresi"
							: "Hip",
				optional:
					locale === "fa"
						? "(اختیاری، دقیق‌تر)"
						: locale === "tr"
							? "(İsteğe bağlı, daha doğru)"
							: "(Optional, more precise)",
				help:
					locale === "fa"
						? "با متر نواری: کمر در سطح ناف، باسن و سینه در پهن‌ترین قسمت. بدون این‌ها، از روی قد و وزن تخمین می‌زنیم."
						: locale === "tr"
							? "Mezura ile: bel göbek seviyesinde, kalça ve göğüs en geniş noktada. Bunlar yoksa boy ve ağırlığa göre tahmin edilir."
							: "With a tape: waist at navel level, hips and chest at the widest point. Without these, we estimate from height and weight.",
			};
			inner += `<div class="sexes" role="radiogroup" aria-label="${locale === "fa" ? "جنسیت" : locale === "tr" ? "Cinsiyet" : "Gender"}">${sexes
				.map(
					([v, l]) =>
						`<button class="chip ${d.sex === v ? "on" : ""}" role="radio" aria-checked="${d.sex === v}" data-sex="${v}">${l}</button>`,
				)
				.join("")}</div>
        <div class="sliders">${bodyFields
					.map(
						(f) => `<label class="slider">
            <span class="slider-top"><span>${f.label}</span><output data-out="${f.k}">${fa(d[f.k])} <small>${f.unit}</small></output></span>
            <input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${d[f.k]}" data-k="${f.k}" aria-label="${f.label} (${f.unit})">
          </label>`,
					)
					.join("")}</div>
        <details class="more-measures" ${d.waist || d.hip || d.chest ? "open" : ""}>
          <summary>${locale === "fa" ? "اندازه‌ی دور کمر، باسن و سینه" : locale === "tr" ? "Bel, kalça ve göğüs ölçüsü" : "Waist, hip and chest measurements"}<span class="muted">${bodyText.optional}</span></summary>
          <p class="muted">${bodyText.help}</p>
          <div class="measure-row">
            <label><span>${bodyText.waist}</span><input class="field" inputmode="decimal" data-m="waist" placeholder="${locale === "fa" ? "سانتی‌متر" : locale === "tr" ? "cm" : "cm"}" value="${d.waist ? fa(d.waist) : ""}"></label>
            <label><span>${bodyText.hip}</span><input class="field" inputmode="decimal" data-m="hip" placeholder="${locale === "fa" ? "سانتی‌متر" : locale === "tr" ? "cm" : "cm"}" value="${d.hip ? fa(d.hip) : ""}"></label>
            <label><span>${st.chest}</span><input class="field" inputmode="decimal" data-m="chest" placeholder="${locale === "fa" ? "سانتی‌متر" : locale === "tr" ? "cm" : "cm"}" value="${d.chest ? fa(d.chest) : ""}"></label>
          </div>
        </details>
        <details class="more-measures" ${d.absent && Object.keys(d.absent).length ? "open" : ""}>
          <summary>${LIMB_TEXT[locale].title} <span class="muted">${LIMB_TEXT[locale].optional}</span></summary>
          <p class="muted">${LIMB_TEXT[locale].help}</p>
          <div class="measure-row">${LIMBS.map((limb) => {
						const lt = LIMB_TEXT[locale];
						const opts = limb.startsWith("arm") ? lt.arm : lt.leg;
						const cur = d.absent?.[limb] ?? "";
						return `<label><span>${lt.limbs[limb]}</span><select class="field" data-limb="${limb}">
              <option value="" ${cur === "" ? "selected" : ""}>${lt.full}</option>
              <option value="lower" ${cur === "lower" ? "selected" : ""}>${opts.lower}</option>
              <option value="whole" ${cur === "whole" ? "selected" : ""}>${opts.whole}</option>
            </select></label>`;
					}).join("")}</div>
        </details>
        <button class="btn btn-main" data-act="next" ${d.sex ? "" : "disabled"}>${t("continue", locale)}</button>`;
		} else if (s.key === "scan") {
			inner += d.scan
				? `<p class="scan-done" role="status">${st.done}</p>
           <div class="measure-row">${scanFields(d, d.scan, locale)
							.map(
								([m, label, cm]) =>
									`<label><span>${label} <small>(${st.cm})</small></span><input class="field" inputmode="decimal" data-m="${m}" value="${cm ? fa(cm) : ""}"></label>`,
							)
							.join("")}</div>
           <p class="fineprint">${st.approx}</p>
           <button class="btn btn-main" data-act="next">${t("continue", locale)}</button>
           <div class="row">
             <button class="btn btn-quiet" data-act="scan">${st.again}</button>
             <button class="btn btn-quiet" data-act="unscan">${st.remove}</button>
           </div>`
				: `<p class="muted">${st.drag}</p>
           <button class="btn btn-main" data-act="scan">📷 ${st.start}</button>
           <button class="btn btn-quiet" data-act="next">${st.skip}</button>`;
		} else if (s.key === "pains") {
			inner += `<div class="pm-host"></div>
        <button class="btn btn-main" data-act="next"></button>`;
		} else if (s.options) {
			inner += `<div class="opts ${s.compact ? "opts-compact" : ""}" role="radiogroup">
        ${s.options
					.map(
						(
							o,
						) => `<button class="opt ${selected(s, o.v) ? "sel" : ""}" data-v="${o.v}" data-ex="${o.ex}"
              role="radio" aria-checked="${selected(s, o.v)}">
              ${o.emoji ? `<span class="opt-emoji" aria-hidden="true">${o.emoji}</span>` : ""}
              <span class="opt-label">${o.label}</span>
              ${o.hint ? `<span class="opt-hint">${o.hint}</span>` : ""}
            </button>`,
					)
					.join("")}
      </div>`;
		} else {
			const namePlaceholder =
				locale === "fa"
					? "مثلاً سارا"
					: locale === "tr"
						? "örn. Ayşe"
						: "e.g. Sara";
			inner += `<input class="field" id="q-name" maxlength="24" autocomplete="given-name" placeholder="${namePlaceholder}" value="${esc(d.name)}">
        <button class="btn btn-main" data-act="finish">${t("finish", locale)}</button>
        <p class="fineprint">${locale === "fa" ? "با ادامه، تأیید می‌کنی بیماری قلبی یا محدودیت پزشکی جدی نداری، یا با پزشکت مشورت کرده‌ای." : locale === "tr" ? "Devam ederek ciddi kalp hastalığı veya tıbbi kısıtlamanın olmadığını ya da doktorundan onay aldığını doğruluyorsun." : "By continuing, you confirm you do not have serious heart disease or medical limitations, or that you have consulted your physician."}</p>`;
		}
		body.innerHTML = inner;
		body.classList.remove("enter");
		void body.offsetWidth;
		body.classList.add("enter");
		const sel = s.options?.find((o) => selected(s, o.v));
		if (sel) preview(sel.ex);
		if (s.key === "body" || s.key === "scan") {
			mq.setAnim(IDLE);
			reshape();
		}
		if (s.key === "pains") {
			mq.setAnim(A_POSE);
			reshape();
			const nextBtn = $<HTMLButtonElement>('[data-act="next"]', body)!;
			const label = () => {
				nextBtn.textContent = d.pains.length
					? t("continue", locale)
					: st.noPain;
			};
			label();
			painOff = mountPainMap($(".pm-host", body)!, mq, d.pains, label);
		}
		const focusTarget = body.querySelector<HTMLElement>(
			".opt.sel, .opt, .field",
		);
		if (focusTarget) focusTarget.focus({ preventScroll: true });
	}

	function cheer() {
		const el = $(".cheer", root)!;
		el.textContent =
			CHEERS[locale][Math.floor(Math.random() * CHEERS[locale].length)];
		el.classList.remove("pop");
		void el.offsetWidth;
		el.classList.add("pop");
	}

	function next() {
		if (i < steps.length - 1) {
			i++;
			render();
		}
	}

	function scan() {
		closeScan = openBodyScan({
			who: {
				sex: d.sex ?? "x",
				age: d.age,
				height: d.height,
				weight: d.weight,
				absent: d.absent,
			},
			onDone: (result) => {
				closeScan = null;
				d.scan = result;
				render();
				cheer();
			},
		});
	}

	function finish() {
		d.name = ($<HTMLInputElement>("#q-name", root)?.value ?? "").trim();
		const profile: Profile = {
			name: d.name,
			goal: d.goal!,
			level: d.level!,
			place: d.place!,
			days: d.days!,
			minutes: d.minutes!,
			limits: limitsFromPains(d.pains),
			pains: d.pains,
			scan: d.scan,
			sex: d.sex ?? "x",
			age: d.age,
			height: d.height,
			weight: d.weight,
			waist: d.waist,
			hip: d.hip,
			chest: d.chest,
			absent: d.absent,
			createdAt: Date.now(),
		};
		const placeText =
			locale === "fa"
				? profile.place === "gym"
					? "باشگاه"
					: "خانه"
				: locale === "tr"
					? profile.place === "gym"
						? "spor salonu"
						: "ev"
					: profile.place === "gym"
						? "gym"
						: "home";
		body.innerHTML = `<div class="building" role="status">
      <h1 class="q">${t("build", locale)}</h1>
      <ul class="build-steps">
        <li>${locale === "fa" ? `انتخاب حرکت‌ها متناسب با ${placeText}` : locale === "tr" ? `Antrenman yerine uygun hareketler seçiliyor: ${placeText}` : `Selecting moves that suit: ${placeText}`}</li>
        <li>${locale === "fa" ? "تنظیم ست و تکرار برای هدفت" : locale === "tr" ? "Hedefin için set ve tekrar ayarı" : "Set and rep targets for your goal"}</li>
        <li>${locale === "fa" ? `چیدن ${fa(profile.days)} جلسه در هفته` : locale === "tr" ? `Haftada ${fa(profile.days)} seans planlanıyor` : `Scheduling ${fa(profile.days)} sessions per week`}</li>
        ${d.pains.length ? `<li>${locale === "fa" ? "انتخاب حرکت‌های اصلاحی برای نقاط دردناک" : locale === "tr" ? "Ağrıyan bölgeler için düzeltici hareketler seçiliyor" : "Choosing corrective moves for the painful spots"}</li>` : ""}
      </ul></div>`;
		const lis = $$(".build-steps li", body);
		lis.forEach((li, k) =>
			setTimeout(() => li.classList.add("done"), 350 + k * 420),
		);
		timer = window.setTimeout(
			() => {
				update((s) => {
					s.profile = profile;
					s.plan = buildPlan(profile);
					s.adjust = {};
					const today = dayKey();
					const last = s.weights[s.weights.length - 1];
					if (
						!last ||
						last.kg !== profile.weight ||
						last.waist !== profile.waist
					) {
						s.weights = s.weights.filter((x) => x.date !== today);
						s.weights.push({
							date: today,
							kg: profile.weight,
							waist: profile.waist,
							hip: profile.hip,
						});
					}
				});
				go("#/today?new=1");
			},
			440 + lis.length * 420,
		);
	}

	root.addEventListener("click", (e) => {
		const target = (e.target as Element).closest<HTMLElement>(
			"[data-v],[data-act],[data-sex]",
		);
		if (!target) return;
		buzz();
		const s = steps[i];
		if (target.dataset.sex) {
			d.sex = target.dataset.sex as Sex;
			$$("[data-sex]", body).forEach((c) => {
				c.classList.toggle("on", c === target);
				c.setAttribute("aria-checked", String(c === target));
			});
			$<HTMLButtonElement>('[data-act="next"]', body)!.disabled = false;
			reshape();
			return;
		}
		switch (target.dataset.act) {
			case "back":
				if (i > 0) {
					i--;
					render();
				} else go("#/profile");
				return;
			case "next":
				return next();
			case "finish":
				return finish();
			case "scan":
				return scan();
			case "unscan":
				d.scan = undefined;
				return render();
		}

		const v = target.dataset.v!;
		preview(target.dataset.ex!);
		if (s.key === "goal") d.goal = v as Goal;
		else if (s.key === "place") d.place = v as Place;
		else if (s.key === "level") d.level = Number(v) as Level;
		else if (s.key === "days") d.days = Number(v);
		else if (s.key === "minutes") d.minutes = Number(v);
		$$(".opt", body).forEach((o) => {
			o.classList.toggle("sel", o === target);
			o.setAttribute("aria-checked", String(o === target));
		});
		cheer();
		clearTimeout(timer);
		timer = window.setTimeout(next, 420);
	});

	root.addEventListener("input", (e) => {
		const r = e.target as HTMLInputElement;
		const limb = r.dataset.limb as Limb | undefined;
		if (limb) {
			const absent = { ...d.absent };
			if (r.value) absent[limb] = r.value as LimbGap;
			else delete absent[limb];
			d.absent = Object.keys(absent).length ? absent : undefined;
			reshape();
			return;
		}
		const m = r.dataset.m as Measure | undefined;
		if (m) {
			const v = parseFaNumber(r.value);
			const [min, max] = MEASURE_RANGE[m];
			const ok = v >= min && v <= max;
			// the shoulder width only exists in the scan; the girths are the user's own numbers
			if (m !== "shoulder") d[m] = ok ? v : undefined;
			else if (ok && d.scan) d.scan = { ...d.scan, shoulder: v };
			reshape();
			return;
		}
		const k = r.dataset.k as (typeof bodyFields)[number]["k"] | undefined;
		if (!k) return;
		d[k] = Number(r.value);
		const f = bodyFields.find((x) => x.k === k)!;
		$(`[data-out="${k}"]`, body)!.innerHTML =
			`${fa(d[k])} <small>${f.unit}</small>`;
		reshape();
	});

	root.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && (e.target as HTMLElement).id === "q-name")
			finish();
	});

	render();
	return () => {
		clearTimeout(timer);
		painOff?.();
		closeScan?.();
		mq.destroy();
	};
};
