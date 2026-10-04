export type Locale = "fa" | "en" | "tr";

export const appMeta = {
	fa: {
		appName: "فیتورا",
		browserTitle: "فیتورا | برنامه‌ی تمرینی شخصی",
		description:
			"برنامه‌ی تمرینی شخصی در کمتر از یک دقیقه، با آموزش سه‌بعدی حرکت‌ها.",
	},
	en: {
		appName: "Fitora",
		browserTitle: "Fitora | Personal workout plan",
		description:
			"Personal workout plan in under a minute with 3D movement coaching.",
	},
	tr: {
		appName: "Fitora",
		browserTitle: "Fitora | Kişisel antrenman planı",
		description:
			"Bir dakikadan kısa sürede 3D hareket eğitimiyle kişisel antrenman planı.",
	},
} as const;

export const localeOptions: {
	value: Locale;
	label: string;
	flag: string;
}[] = [
	{ value: "fa", label: "فارسی", flag: "/icons/flags/ir.svg" },
	{ value: "en", label: "English", flag: "/icons/flags/gb.svg" },
	{ value: "tr", label: "Türkçe", flag: "/icons/flags/tr.svg" },
];

let current: Locale | null = null;

export function getLocale(): Locale {
	if (current) return current;
	const saved = localStorage.getItem("varzideh-locale") as Locale | null;
	if (saved === "fa" || saved === "en" || saved === "tr")
		return (current = saved);
	const nav = navigator.language.toLowerCase();
	if (nav.startsWith("tr")) return (current = "tr");
	if (nav.startsWith("en")) return (current = "en");
	return (current = "fa");
}

/** BCP 47 tag for dates and speech in the current language. */
export const localeTag = (locale: Locale = getLocale()): string =>
	locale === "fa" ? "fa-IR" : locale === "tr" ? "tr-TR" : "en-US";

export function setLocale(locale: Locale): void {
	current = locale;
	localStorage.setItem("varzideh-locale", locale);
	document.documentElement.lang = locale;
	document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
	document.documentElement.dataset.lang = locale;
	document.title = appMeta[locale].browserTitle;

	const description = document.querySelector('meta[name="description"]');
	if (description)
		description.setAttribute("content", appMeta[locale].description);

	const appName = document.querySelector('meta[name="application-name"]');
	if (appName) appName.setAttribute("content", appMeta[locale].appName);

	// the install name, description and shortcuts come from a manifest per language
	document
		.querySelector('link[rel="manifest"]')
		?.setAttribute(
			"href",
			locale === "fa"
				? "/manifest.webmanifest"
				: `/manifest.${locale}.webmanifest`,
		);
	document
		.getElementById("tabs")
		?.setAttribute(
			"aria-label",
			locale === "fa" ? "بخش‌ها" : locale === "tr" ? "Bölümler" : "Sections",
		);
}

export const i18n = {
	fa: {
		start: "شروع کنیم",
		next: "ادامه",
		back: "قبلی",
		continue: "ادامه",
		finish: "برنامه‌ام را بساز",
		selectProblem: "جایی از بدنت اذیتت می‌کند؟",
		selectProblemHint: "حرکت‌های پرفشار برای آن ناحیه کنار گذاشته می‌شوند.",
		noIssue: "نه، مشکلی ندارم",
		welcomeTitle: "برنامه‌ی تمرینیِ مخصوص خودت، در کمتر از یک دقیقه.",
		welcomeLead:
			"هفت سؤال کوتاه جواب بده؛ برنامه‌ای می‌گیری که با بدن، وقت و وسایلت جور است. هر حرکت را سه‌بعدی و از هر زاویه ببین.",
		freeNote: "رایگان، بدون ثبت‌نام",
		hello: "سلام",
		profileGreet: "سلام",
		build: "در حال ساختن برنامه‌ات…",
		goal: "دنبال چی هستی؟",
		level: "الان چقدر ورزش می‌کنی؟",
		body: "کمی از بدنت بگو",
		place: "کجا تمرین می‌کنی؟",
		days: "هفته‌ای چند روز؟",
		minutes: "هر جلسه چقدر وقت داری؟",
	},
	en: {
		start: "Let’s begin",
		next: "Next",
		back: "Back",
		continue: "Continue",
		finish: "Build my plan",
		selectProblem: "Where does your body hurt?",
		selectProblemHint: "High-impact moves for that area are skipped.",
		noIssue: "No, I have no issues",
		welcomeTitle: "Your personalized workout plan in under a minute.",
		welcomeLead:
			"Answer seven short questions and get a program that fits your body, schedule, and gear. See every move in 3D from every angle.",
		freeNote: "Free, no sign-up required",
		hello: "Hi",
		profileGreet: "Hi",
		build: "Building your plan…",
		goal: "What are you aiming for?",
		level: "How active are you right now?",
		body: "Tell us a bit about your body",
		place: "Where do you train?",
		days: "How many days per week?",
		minutes: "How much time do you have per session?",
	},
	tr: {
		start: "Başlayalım",
		next: "Devam",
		back: "Geri",
		continue: "Devam",
		finish: "Planımı oluştur",
		selectProblem: "Vücudunuzun neresi rahatsız ediyor?",
		selectProblemHint: "Bu bölgede yüksek etkili hareketler atlanır.",
		noIssue: "Hayır, sorunum yok",
		welcomeTitle:
			"Bir dakikadan kısa sürede kişiselleştirilmiş antrenman planın.",
		welcomeLead:
			"Yedi kısa soruya cevap ver; vücuduna, zamanına ve ekipmanına uygun bir program al. Her hareketi 3D ve her açıdan gör.",
		freeNote: "Ücretsiz, kayıt gerekmez",
		hello: "Merhaba",
		profileGreet: "Merhaba",
		build: "Planın hazırlanıyor…",
		goal: "Ne hedefliyorsun?",
		level: "Şu an ne kadar spor yapıyorsun?",
		body: "Bize biraz vücudundan bahset",
		place: "Nerede antrenman yapıyorsun?",
		days: "Haftada kaç gün?",
		minutes: "Her seans ne kadar zamanın var?",
	},
} as const;

export function t(
	key: keyof typeof i18n.fa,
	locale: Locale = getLocale(),
): string {
	return i18n[locale][key];
}
