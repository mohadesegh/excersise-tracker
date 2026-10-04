import { EX, IDLE } from "../data/exercises";
import type { Mannequin } from "../engine/mannequin";
import { shapeFor } from "../body";
import { buildPlan } from "../planner";
import { state, update } from "../store";
import type { Goal, Level, Limit, Place, Profile, Sex } from "../types";
import { $, $$, buzz, dayKey, esc, fa, go, parseFaNumber } from "../utils";
import { backIcon, checkIcon, mountMannequin, type View } from "./ui";
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
	multi?: boolean;
	compact?: boolean;
	options?: Option[];
}

interface Draft {
	goal?: Goal;
	level?: Level;
	place?: Place;
	days?: number;
	minutes?: number;
	limits: Limit[];
	name: string;
	sex?: Sex;
	age: number;
	height: number;
	weight: number;
	waist?: number;
	hip?: number;
}

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

const NO_ISSUE = {
	fa: "نه، مشکلی ندارم",
	en: "No, I have no issues",
	tr: "Hayır, sorunum yok",
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
			limits: "جایی از بدنت اذیتت می‌کند؟",
			limitsSub: "حرکت‌های پرفشار برای آن ناحیه کنار گذاشته می‌شوند.",
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
			limits: "Does any part of your body bother you?",
			limitsSub: "High-impact moves for that area are skipped.",
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
			limits: "Vücudunda seni rahatsız eden bir yer var mı?",
			limitsSub: "Bu bölgede yüksek etkili hareketler atlanır.",
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
		{
			key: "limits",
			q: q.limits,
			sub: q.limitsSub,
			multi: true,
			options: [
				{
					v: "knee",
					emoji: "🦵",
					label: locale === "fa" ? "زانو" : locale === "tr" ? "Diz" : "Knee",
					ex: "bridge",
				},
				{
					v: "back",
					emoji: "🧍",
					label: locale === "fa" ? "کمر" : locale === "tr" ? "Bel" : "Back",
					ex: "birddog",
				},
				{
					v: "shoulder",
					emoji: "🤷",
					label:
						locale === "fa" ? "شانه" : locale === "tr" ? "Omuz" : "Shoulder",
					ex: "plank",
				},
				{ v: "none", emoji: "✅", label: NO_ISSUE[locale], ex: "jacks" },
			],
		},
		{ key: "name", q: q.name, sub: q.nameSub },
	];
};

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
				limits: [...p.limits],
				name: p.name,
				sex: p.sex,
				age: p.age ?? 28,
				height: p.height ?? 170,
				weight: p.weight ?? 70,
				waist: p.waist,
				hip: p.hip,
			}
		: { limits: [], name: "", age: 28, height: 170, weight: 70 };
	const steps = buildSteps(locale);
	const bodyFields = BODY_FIELDS(locale);
	let i = 0;
	let noneChosen = !!p && p.limits.length === 0;
	let mq: Mannequin | null = null;
	let timer = 0;

	root.innerHTML = `
    <section class="quiz">
      <header class="quiz-top">
        <button class="icon-btn" data-act="back" aria-label="${t("back", locale)}">${backIcon}</button>
        <div class="segbar" aria-hidden="true">${steps.map(() => "<span></span>").join("")}</div>
        <span class="quiz-count"></span>
      </header>
      <div class="quiz-stage"><canvas aria-label="${locale === "fa" ? "پیش‌نمایش حرکت" : locale === "tr" ? "Hareket önizlemesi" : "Movement preview"}"></canvas><span class="cheer" aria-live="polite"></span></div>
      <div class="quiz-body"></div>
    </section>`;

	const body = $(".quiz-body", root)!;
	const canvas = $<HTMLCanvasElement>(".quiz-stage canvas", root)!;
	mq = mountMannequin(canvas, "squat", { spin: 0.35 });

	const preview = (exId: string) => {
		const ex = EX[exId];
		mq?.setAnim(ex.anim, ex.muscles);
	};

	/** the mannequin morphs as the user describes their body */
	const reshape = () =>
		mq?.setBody(
			shapeFor({
				sex: d.sex ?? "x",
				age: d.age,
				height: d.height,
				weight: d.weight,
				waist: d.waist,
				hip: d.hip,
			}),
		);

	const selected = (s: Step, v: string): boolean => {
		if (s.key === "body") return false;
		if (s.key === "limits")
			return v === "none" ? noneChosen : d.limits.includes(v as Limit);
		return String(d[s.key] ?? "") === v;
	};

	function render() {
		const s = steps[i];
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
						? "با متر نواری: کمر در سطح ناف، باسن در پهن‌ترین قسمت. بدون این‌ها، از روی قد و وزن تخمین می‌زنیم."
						: locale === "tr"
							? "Mezura ile: bel göbek seviyesinde, kalça en geniş noktada. Bunlar yoksa boy ve ağırlığa göre tahmin edilir."
							: "With a tape: waist at navel level, hips at the widest point. Without these, we estimate from height and weight.",
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
        <details class="more-measures" ${d.waist || d.hip ? "open" : ""}>
          <summary>${locale === "fa" ? "اندازه‌ی دور کمر و باسن" : locale === "tr" ? "Bel ve kalça ölçüsü" : "Waist and hip measurements"} <span class="muted">${bodyText.optional}</span></summary>
          <p class="muted">${bodyText.help}</p>
          <div class="measure-row">
            <label><span>${bodyText.waist}</span><input class="field" inputmode="decimal" data-m="waist" placeholder="${locale === "fa" ? "سانتی‌متر" : locale === "tr" ? "cm" : "cm"}" value="${d.waist ? fa(d.waist) : ""}"></label>
            <label><span>${bodyText.hip}</span><input class="field" inputmode="decimal" data-m="hip" placeholder="${locale === "fa" ? "سانتی‌متر" : locale === "tr" ? "cm" : "cm"}" value="${d.hip ? fa(d.hip) : ""}"></label>
          </div>
        </details>
        <button class="btn btn-main" data-act="next" ${d.sex ? "" : "disabled"}>${t("continue", locale)}</button>`;
		} else if (s.options) {
			inner += `<div class="opts ${s.compact ? "opts-compact" : ""}" role="${s.multi ? "group" : "radiogroup"}">
        ${s.options
					.map(
						(
							o,
						) => `<button class="opt ${selected(s, o.v) ? "sel" : ""}" data-v="${o.v}" data-ex="${o.ex}"
              role="${s.multi ? "checkbox" : "radio"}" aria-checked="${selected(s, o.v)}">
              ${o.emoji ? `<span class="opt-emoji" aria-hidden="true">${o.emoji}</span>` : ""}
              <span class="opt-label">${o.label}</span>
              ${o.hint ? `<span class="opt-hint">${o.hint}</span>` : ""}
              ${s.multi ? `<span class="opt-check">${checkIcon}</span>` : ""}
            </button>`,
					)
					.join("")}
      </div>`;
			if (s.multi)
				inner += `<button class="btn btn-main" data-act="next" ${d.limits.length || noneChosen ? "" : "disabled"}>${t("continue", locale)}</button>`;
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
		if (s.key === "body") {
			mq?.setAnim(IDLE);
			reshape();
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

	function finish() {
		d.name = ($<HTMLInputElement>("#q-name", root)?.value ?? "").trim();
		const profile: Profile = {
			name: d.name,
			goal: d.goal!,
			level: d.level!,
			place: d.place!,
			days: d.days!,
			minutes: d.minutes!,
			limits: d.limits,
			sex: d.sex ?? "x",
			age: d.age,
			height: d.height,
			weight: d.weight,
			waist: d.waist,
			hip: d.hip,
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
      </ul></div>`;
		$$(".build-steps li", body).forEach((li, k) =>
			setTimeout(() => li.classList.add("done"), 350 + k * 420),
		);
		timer = window.setTimeout(() => {
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
		}, 1700);
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
		if (target.dataset.act === "back") {
			if (i > 0) {
				i--;
				render();
			} else go("#/profile");
			return;
		}
		if (target.dataset.act === "next") return next();
		if (target.dataset.act === "finish") return finish();

		const v = target.dataset.v!;
		preview(target.dataset.ex!);
		if (s.multi) {
			if (v === "none") {
				noneChosen = true;
				d.limits = [];
			} else {
				noneChosen = false;
				d.limits = d.limits.includes(v as Limit)
					? d.limits.filter((x) => x !== v)
					: [...d.limits, v as Limit];
			}

			$$("[data-v]", body).forEach((o) => {
				const item = o as HTMLElement;
				const itemValue = item.dataset.v as string | undefined;
				const isSelected =
					itemValue === "none"
						? noneChosen
						: d.limits.includes(itemValue as Limit);
				item.classList.toggle("sel", isSelected);
				item.setAttribute("aria-checked", String(isSelected));
			});
			const nextBtn = $<HTMLButtonElement>('[data-act="next"]', body);
			if (nextBtn) nextBtn.disabled = !(d.limits.length || noneChosen);
			return;
		}
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
		if (r.dataset.m === "waist" || r.dataset.m === "hip") {
			const v = parseFaNumber(r.value);
			d[r.dataset.m] = v >= 40 && v <= 200 ? v : undefined;
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
		mq?.destroy();
	};
};
