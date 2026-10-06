/**
 * The "personal physio": turns the pains marked on the body map into a short
 * daily routine of corrective moves, plus plain-language advice.
 *
 * This is general guidance of the kind a physiotherapist gives for common
 * aches from posture and overuse. It is not a diagnosis, and the UI says so
 * wherever the routine appears.
 */
import { EX } from "./data/exercises";
import { getLocale, type Locale } from "./i18n";
import type { Limit, Pain, PainKind, PainRegion, PainWhen } from "./types";

/** Left and right share one prescription. */
type Area =
	| "neck"
	| "upperBack"
	| "lowerBack"
	| "shoulder"
	| "elbow"
	| "wrist"
	| "hip"
	| "knee"
	| "ankle";

export const areaOf = (r: PainRegion): Area => r.replace(/[LR]$/, "") as Area;

/** mob: gentle range of motion; stretch: held stretches; strong: light strengthening */
const PLAN: Record<Area, { mob: string[]; stretch: string[]; strong: string[] }> =
	{
		neck: { mob: ["neckstretch"], stretch: ["chestopen"], strong: ["wallangel"] },
		upperBack: {
			mob: ["catcow"],
			stretch: ["chestopen", "childpose"],
			strong: ["wallangel"],
		},
		lowerBack: {
			mob: ["catcow", "kneehug"],
			stretch: ["childpose"],
			strong: ["birddog", "bridge"],
		},
		shoulder: {
			mob: ["pendulum"],
			stretch: ["chestopen"],
			strong: ["shoulderrot", "wallangel"],
		},
		elbow: { mob: ["wriststretch"], stretch: [], strong: [] },
		wrist: { mob: ["wriststretch"], stretch: [], strong: [] },
		hip: {
			mob: ["kneehug", "legswing"],
			stretch: ["quadstretch"],
			strong: ["bridge", "hipabd"],
		},
		knee: {
			mob: ["slr"],
			stretch: ["hamstretch", "calfstretch"],
			strong: ["bridge", "minisquat", "hipabd"],
		},
		ankle: { mob: ["calfstretch"], stretch: [], strong: ["balance", "minisquat"] },
	};

const LIMIT_OF: Record<Area, Limit> = {
	neck: "shoulder",
	shoulder: "shoulder",
	elbow: "shoulder",
	wrist: "shoulder",
	upperBack: "back",
	lowerBack: "back",
	hip: "knee",
	knee: "knee",
	ankle: "knee",
};

/** Which groups of moves the training plan should leave out for these pains. */
export function limitsFromPains(pains: Pain[]): Limit[] {
	return [...new Set(pains.map((p) => LIMIT_OF[areaOf(p.region)]))];
}

/** Body-map marks for a profile from before the map existed (it only knew knee / back / shoulder). */
export function painsFromLimits(limits: Limit[]): Pain[] {
	const where: Record<Limit, PainRegion[]> = {
		knee: ["kneeL", "kneeR"],
		back: ["lowerBack"],
		shoulder: ["shoulderL", "shoulderR"],
	};
	return limits.flatMap((l) =>
		where[l].map(
			(region): Pain => ({ region, kind: "ache", level: 4, when: "move" }),
		),
	);
}

/** Nerve-like symptoms, severe pain, or pain that wakes you: see someone before exercising through it. */
export const needsDoctor = (p: Pain): boolean =>
	p.kind === "radiating" ||
	p.kind === "numb" ||
	p.level >= 8 ||
	(p.when === "night" && p.level >= 6);

/** Irritable pain gets movement only; no strengthening and no long stretches. */
const gentleOnly = (p: Pain): boolean =>
	needsDoctor(p) || p.kind === "sharp" || p.level >= 7;

export type Tier = "mob" | "strong" | "stretch";
export interface RehabStep {
	id: string;
	secs: number;
	tier: Tier;
	/** the marked regions this move is for */
	regions: PainRegion[];
}

const MAX_STEPS = 8;

/** The daily corrective routine: gentle movement first, then strengthening, stretches last. */
export function routineFor(pains: Pain[]): RehabStep[] {
	const limits = limitsFromPains(pains);
	const steps = new Map<string, RehabStep>();
	// the worst pain is served first, so it keeps its moves when the routine is full
	const sorted = [...pains].sort((a, b) => b.level - a.level);
	const add = (p: Pain, tier: Tier, ids: string[], secs: number) => {
		for (const id of ids) {
			const ex = EX[id];
			// a move that loads another painful area is left out
			if (!ex || ex.avoid.some((l) => limits.includes(l))) continue;
			const had = steps.get(id);
			if (had) {
				if (!had.regions.includes(p.region)) had.regions.push(p.region);
			} else steps.set(id, { id, secs, tier, regions: [p.region] });
		}
	};
	for (const p of sorted) add(p, "mob", PLAN[areaOf(p.region)].mob, 40);
	for (const p of sorted) {
		if (gentleOnly(p)) continue;
		const plan = PLAN[areaOf(p.region)];
		if (p.kind === "stiff") add(p, "stretch", plan.stretch, 50);
		else {
			add(p, "strong", plan.strong, 45);
			add(p, "stretch", plan.stretch.slice(0, 1), 40);
		}
	}
	const order: Tier[] = ["mob", "strong", "stretch"];
	return [...steps.values()]
		.slice(0, MAX_STEPS)
		.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
}

export const routineMinutes = (steps: RehabStep[]): number =>
	Math.max(1, Math.round(steps.reduce((a, s) => a + s.secs + 10, 0) / 60));

/* ---------- words ---------- */

type Words<K extends string> = Record<Locale, Record<K, string>>;

const AREA_NAME: Words<Area> = {
	fa: {
		neck: "گردن",
		upperBack: "بالای پشت",
		lowerBack: "کمر",
		shoulder: "شانه",
		elbow: "آرنج",
		wrist: "مچ دست",
		hip: "لگن",
		knee: "زانو",
		ankle: "مچ پا",
	},
	en: {
		neck: "Neck",
		upperBack: "Upper back",
		lowerBack: "Lower back",
		shoulder: "shoulder",
		elbow: "elbow",
		wrist: "wrist",
		hip: "hip",
		knee: "knee",
		ankle: "ankle",
	},
	tr: {
		neck: "Boyun",
		upperBack: "Üst sırt",
		lowerBack: "Bel",
		shoulder: "omuz",
		elbow: "dirsek",
		wrist: "el bileği",
		hip: "kalça",
		knee: "diz",
		ankle: "ayak bileği",
	},
};

/** "Left knee", «زانوی چپ», "Sol diz". */
export function regionName(r: PainRegion, locale: Locale = getLocale()): string {
	const area = AREA_NAME[locale][areaOf(r)];
	const side = /L$/.test(r) ? "L" : /R$/.test(r) ? "R" : "";
	if (!side) return area;
	if (locale === "fa") {
		// the ezafe: «زانوی چپ», «شانه‌ی راست», «مچ پای چپ»
		const link = /[اوی]$/.test(area) ? "ی" : /ه$/.test(area) ? "‌ی" : "";
		return `${area}${link} ${side === "L" ? "چپ" : "راست"}`;
	}
	if (locale === "tr") return `${side === "L" ? "Sol" : "Sağ"} ${area}`;
	return `${side === "L" ? "Left" : "Right"} ${area}`;
}

export const KIND_NAME: Words<PainKind> = {
	fa: {
		sharp: "تیز",
		ache: "مبهم و کوفته",
		stiff: "خشک و گرفته",
		radiating: "تیرکشنده",
		numb: "گزگز یا بی‌حسی",
	},
	en: {
		sharp: "Sharp",
		ache: "Dull ache",
		stiff: "Stiff, tight",
		radiating: "Shooting",
		numb: "Tingling or numb",
	},
	tr: {
		sharp: "Keskin",
		ache: "Künt, sızlayan",
		stiff: "Tutuk, gergin",
		radiating: "Yayılan",
		numb: "Karıncalanma ya da uyuşma",
	},
};

export const WHEN_NAME: Words<PainWhen> = {
	fa: {
		move: "موقع حرکت",
		sitting: "بعد از نشستن طولانی",
		morning: "صبح‌ها",
		night: "شب و موقع استراحت",
	},
	en: {
		move: "When moving",
		sitting: "After sitting a long time",
		morning: "In the morning",
		night: "At night or at rest",
	},
	tr: {
		move: "Hareket ederken",
		sitting: "Uzun süre oturunca",
		morning: "Sabahları",
		night: "Gece ve dinlenirken",
	},
};

export const TIER_NAME: Words<Tier> = {
	fa: { mob: "حرکت ملایم", strong: "تقویت", stretch: "کشش" },
	en: { mob: "Gentle movement", strong: "Strengthening", stretch: "Stretch" },
	tr: { mob: "Hafif hareket", strong: "Güçlendirme", stretch: "Germe" },
};

const KIND_ADVICE: Words<PainKind> = {
	fa: {
		sharp:
			"درد تیز یعنی آن ناحیه تحریک شده است. چند روز فشار را کم کن و فقط حرکت‌های ملایم و بدون درد انجام بده؛ تقویت را بعداً اضافه می‌کنیم.",
		ache: "درد مبهم معمولاً از ضعف عضله یا ماندن طولانی در یک وضعیت است. حرکت منظم و تقویت ملایم بهترین درمان آن است.",
		stiff:
			"خشکی با حرکت آرام و کشش منظم بهتر می‌شود. قبل از کشش کمی راه برو یا دوش آب گرم بگیر.",
		radiating:
			"دردی که تیر می‌کشد می‌تواند از عصب باشد. قبل از هر تمرینی با پزشک یا فیزیوتراپ مشورت کن؛ فعلاً فقط حرکت‌های خیلی ملایم.",
		numb: "گزگز و بی‌حسی نشانه‌ی درگیری عصب است و باید معاینه شود. تا آن موقع فقط حرکت‌های خیلی ملایم انجام بده.",
	},
	en: {
		sharp:
			"Sharp pain means the area is irritated. Ease off for a few days and do only gentle, pain-free movement; strengthening comes later.",
		ache: "A dull ache usually comes from weak muscles or staying in one position too long. Regular movement and light strengthening are the best treatment.",
		stiff:
			"Stiffness improves with slow movement and regular stretching. Walk a little or take a warm shower before you stretch.",
		radiating:
			"Pain that shoots along a limb can come from a nerve. Check with a doctor or physiotherapist before exercising; for now, only very gentle movement.",
		numb: "Tingling and numbness point to a nerve and should be examined. Until then, do only very gentle movement.",
	},
	tr: {
		sharp:
			"Keskin ağrı o bölgenin tahriş olduğunu gösterir. Birkaç gün yükü azalt ve yalnızca hafif, ağrısız hareketler yap; güçlendirmeyi sonra ekleriz.",
		ache: "Künt ağrı çoğunlukla zayıf kaslardan ya da uzun süre aynı pozisyonda kalmaktan olur. Düzenli hareket ve hafif güçlendirme en iyi tedavidir.",
		stiff:
			"Tutukluk yavaş hareket ve düzenli germeyle azalır. Germeden önce biraz yürü ya da ılık duş al.",
		radiating:
			"Yayılan ağrı sinir kaynaklı olabilir. Egzersizden önce bir doktora ya da fizyoterapiste danış; şimdilik yalnızca çok hafif hareketler.",
		numb: "Karıncalanma ve uyuşma sinire işaret eder ve muayene edilmelidir. O zamana kadar yalnızca çok hafif hareketler yap.",
	},
};

const AREA_TIP: Words<Area> = {
	fa: {
		neck: "صفحه‌ی گوشی و مانیتور را هم‌سطح چشم بیاور و هر نیم ساعت گردن را حرکت بده.",
		upperBack: "هر نیم ساعت از پشت میز بلند شو و کتف‌ها را چند بار به هم نزدیک کن.",
		lowerBack:
			"بیشتر از نیم ساعت یک‌جا ننشین؛ کوتاه راه رفتن بهتر از استراحت مطلق است.",
		shoulder:
			"فعلاً دست را بالاتر از شانه زیر بار نبر و روی شانه‌ی دردناک نخواب.",
		elbow: "چند روز گرفتن محکم و بلند کردن با کف دست رو به پایین را کم کن.",
		wrist: "مچ را موقع تایپ صاف نگه دار و هر نیم ساعت دست‌ها را تکان بده.",
		hip: "روی صندلی خیلی کوتاه ننشین و پاها را روی هم نینداز.",
		knee: "فعلاً از پله، دو زانو نشستن و پریدن کم کن؛ راه رفتن روی سطح صاف خوب است.",
		ankle: "کفش محکم و تخت بپوش و تا بهتر شدن روی سطح ناهموار ندو.",
	},
	en: {
		neck: "Bring your phone and monitor up to eye level, and move your neck every half hour.",
		upperBack:
			"Get up from your desk every half hour and squeeze your shoulder blades together a few times.",
		lowerBack:
			"Do not sit for more than half an hour at a time; short walks beat complete rest.",
		shoulder:
			"For now, avoid loaded overhead work and do not sleep on the painful shoulder.",
		elbow: "For a few days, cut down on hard gripping and palm-down lifting.",
		wrist: "Keep your wrist straight while typing and shake your hands out every half hour.",
		hip: "Avoid very low seats and do not sit with your legs crossed.",
		knee: "For now, cut back on stairs, deep kneeling and jumping; walking on flat ground is good.",
		ankle: "Wear firm, flat shoes and avoid running on uneven ground until it improves.",
	},
	tr: {
		neck: "Telefonu ve monitörü göz hizasına getir, yarım saatte bir boynunu hareket ettir.",
		upperBack:
			"Yarım saatte bir masadan kalk ve kürek kemiklerini birkaç kez birbirine yaklaştır.",
		lowerBack:
			"Yarım saatten uzun oturma; kısa yürüyüşler tam dinlenmeden daha iyidir.",
		shoulder:
			"Şimdilik baş üstü yüklü hareketlerden kaçın ve ağrılı omzunun üstüne yatma.",
		elbow: "Birkaç gün sıkı kavramayı ve avuç aşağı bakarken kaldırmayı azalt.",
		wrist: "Yazarken bileğini düz tut ve yarım saatte bir ellerini silkele.",
		hip: "Çok alçak koltuklara oturma ve bacak bacak üstüne atma.",
		knee: "Şimdilik merdiveni, çömelmeyi ve zıplamayı azalt; düz zeminde yürümek iyidir.",
		ankle: "Sağlam, düz ayakkabı giy ve iyileşene kadar engebeli zeminde koşma.",
	},
};

/** What to do about one marked pain: how to treat this kind of pain, then a habit tip for the area. */
export function painAdvice(p: Pain, locale: Locale = getLocale()): string {
	return `${KIND_ADVICE[locale][p.kind]} ${AREA_TIP[locale][areaOf(p.region)]}`;
}

export const REHAB_TEXT = {
	fa: {
		doctor:
			"با این نشانه‌ها بهتر است قبل از ادامه‌ی تمرین، پزشک یا فیزیوتراپ تو را معاینه کند.",
		redFlags:
			"اگر درد بعد از زمین خوردن یا ضربه شروع شده، با تب، ورم شدید، ضعف دست یا پا، یا مشکل در کنترل ادرار همراه است، تمرین نکن و فوراً به پزشک مراجعه کن.",
		disclaimer:
			"این حرکت‌ها راهنمای عمومی برای دردهای رایج عضلانی و مفصلی هستند و جای معاینه و تشخیص را نمی‌گیرند. هر حرکتی که درد را بیشتر کرد، کنار بگذار. اگر بعد از دو هفته بهتر نشدی، به پزشک یا فیزیوتراپ مراجعه کن.",
	},
	en: {
		doctor:
			"With these symptoms, it is best to have a doctor or physiotherapist examine you before you keep training.",
		redFlags:
			"If the pain began after a fall or blow, or comes with fever, marked swelling, weakness in an arm or leg, or trouble controlling your bladder, do not exercise and see a doctor promptly.",
		disclaimer:
			"These moves are general guidance for common muscle and joint aches and do not replace an examination or diagnosis. Drop any move that makes the pain worse. If you are no better after two weeks, see a doctor or physiotherapist.",
	},
	tr: {
		doctor:
			"Bu belirtilerle, antrenmana devam etmeden önce bir doktorun ya da fizyoterapistin seni muayene etmesi en doğrusu.",
		redFlags:
			"Ağrı bir düşme ya da darbeden sonra başladıysa veya ateş, belirgin şişlik, kol ya da bacakta güçsüzlük ya da idrarı tutmada zorlukla birlikteyse egzersiz yapma ve hemen doktora başvur.",
		disclaimer:
			"Bu hareketler yaygın kas ve eklem ağrıları için genel bir rehberdir; muayenenin ve tanının yerini tutmaz. Ağrıyı artıran hareketi bırak. İki hafta sonra düzelme olmazsa bir doktora ya da fizyoterapiste başvur.",
	},
} as const;
