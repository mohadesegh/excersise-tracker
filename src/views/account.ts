import {
	bmi,
	bmiBand,
	bmiBandText,
	dailyKcal,
	proteinGrams,
	whtr,
	whtrText,
} from "../body";
import {
	CURRENCY,
	grant,
	isRealPayments,
	payCurrency,
	payProvider,
	PRICES,
	provider,
	TRIAL_DAYS,
} from "../payments";
import {
	onCloudChange,
	refreshSubscription,
	sendCode,
	signedInEmail,
	signOut,
	syncNow,
	syncStatus,
	verifyCode,
} from "../cloud";
import { cloudEnabled } from "../config";
import { dayTitle } from "../planner";
import { records } from "../progression";
import { EX, exerciseName } from "../data/exercises";
import {
	canInstall,
	install,
	isIOS,
	isStandalone,
	onInstallChange,
} from "../pwa";
import { isPremium, resetAll, state, update } from "../store";
import type { BillingPlan } from "../types";
import { $, $$, buzz, fa, go, money } from "../utils";
import { shapeFor } from "../body";
import { IDLE } from "../data/exercises";
import { Mannequin } from "../engine/mannequin";
import { getLocale, localeTag, setLocale, type Locale } from "../i18n";

const parseFaDigits = (s: string) =>
	String(s).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
import { checkIcon, dose, kgText, toast, type View } from "./ui";
import { weightCardHTML } from "./body";
import { weekCounts, weekStreak } from "./today";

const FEEL: Record<Locale, Record<"easy" | "ok" | "hard", string>> = {
	fa: { easy: "😌 راحت", ok: "🙂 مناسب", hard: "🥵 سخت" },
	en: { easy: "😌 Easy", ok: "🙂 Good", hard: "🥵 Hard" },
	tr: { easy: "😌 Kolay", ok: "🙂 Uygun", hard: "🥵 Zor" },
};

const txt = (locale: "fa" | "en" | "tr") => ({
	profileTitle:
		locale === "fa" ? "پروفایل" : locale === "tr" ? "Profil" : "Profile",
	goal: locale === "fa" ? "هدف" : locale === "tr" ? "Hedef" : "Goal",
	level: locale === "fa" ? "سطح" : locale === "tr" ? "Seviye" : "Level",
	place:
		locale === "fa"
			? "محل تمرین"
			: locale === "tr"
				? "Antrenman yeri"
				: "Training place",
	plan: locale === "fa" ? "برنامه" : locale === "tr" ? "Program" : "Plan",
	limits: locale === "fa" ? "ملاحظات" : locale === "tr" ? "Notlar" : "Notes",
	bodyStats:
		locale === "fa"
			? "سن، قد، وزن"
			: locale === "tr"
				? "Yaş, boy, kilo"
				: "Age, height, weight",
	waistHip:
		locale === "fa"
			? "دور کمر و باسن"
			: locale === "tr"
				? "Bel ve kalça çevresi"
				: "Waist and hip",
	bodyCompare:
		locale === "fa"
			? "بدن تو: قبل و الان"
			: locale === "tr"
				? "Vücudun: önce ve şimdi"
				: "Your body: before and now",
	fromStart:
		locale === "fa"
			? "از شروع"
			: locale === "tr"
				? "Başlangıçtan beri"
				: "Since start",
	monthAgo:
		locale === "fa"
			? "حدود یک ماه پیش"
			: locale === "tr"
				? "Yaklaşık bir ay önce"
				: "About a month ago",
	bodyWeight: locale === "fa" ? "وزن" : locale === "tr" ? "Kilo" : "Weight",
	waist:
		locale === "fa" ? "دور کمر" : locale === "tr" ? "Bel çevresi" : "Waist",
	progress:
		locale === "fa" ? "پیشرفت" : locale === "tr" ? "İlerleme" : "Progress",
	sessions: locale === "fa" ? "جلسه" : locale === "tr" ? "seans" : "sessions",
	minutes:
		locale === "fa"
			? "دقیقه تمرین"
			: locale === "tr"
				? "dakika antrenman"
				: "minutes of training",
	kcal: locale === "fa" ? "کیلوکالری" : locale === "tr" ? "kalori" : "kcal",
	streak:
		locale === "fa"
			? "هفته‌ی پیاپی"
			: locale === "tr"
				? "Ardışık hafta"
				: "Streak",
	recentSessions:
		locale === "fa"
			? "جلسه‌های اخیر"
			: locale === "tr"
				? "Son seanslar"
				: "Recent sessions",
	notYet:
		locale === "fa"
			? "هنوز جلسه‌ای ثبت نشده."
			: locale === "tr"
				? "Henüz seans kaydedilmedi."
				: "No sessions logged yet.",
	firstWorkout:
		locale === "fa"
			? "اولین تمرین را شروع کن"
			: locale === "tr"
				? "İlk antrenmana başla"
				: "Start your first workout",
	account:
		locale === "fa" ? "حساب کاربری" : locale === "tr" ? "Hesap" : "Account",
	loginText:
		locale === "fa"
			? "وارد شو تا برنامه و سابقه‌ات روی همه‌ی دستگاه‌ها بماند و پاک نشود."
			: locale === "tr"
				? "Programını ve geçmişini tüm cihazlarda korunması için giriş yap."
				: "Sign in so your plan and history stay intact across devices.",
	otpSent:
		locale === "fa"
			? "کد ۶ رقمی به %EMAIL% فرستاده شد."
			: locale === "tr"
				? "%EMAIL% adresine 6 haneli kod gönderildi."
				: "A 6-digit code was sent to %EMAIL%.",
	login: locale === "fa" ? "ورود" : locale === "tr" ? "Giriş" : "Log in",
	changeEmail:
		locale === "fa"
			? "تغییر ایمیل"
			: locale === "tr"
				? "E-postayı değiştir"
				: "Change email",
	emailPlaceholder:
		locale === "fa" ? "ایمیل" : locale === "tr" ? "E-posta" : "Email",
	sendCode:
		locale === "fa"
			? "ارسال کد ورود"
			: locale === "tr"
				? "Giriş kodu gönder"
				: "Send login code",
	verifyCode:
		locale === "fa" ? "کد ورود" : locale === "tr" ? "Giriş kodu" : "Enter code",
	logout:
		locale === "fa"
			? "خروج از حساب"
			: locale === "tr"
				? "Hesaptan çık"
				: "Sign out",
	installTitle:
		locale === "fa"
			? "نصب روی گوشی"
			: locale === "tr"
				? "Telefona kurulum"
				: "Install on phone",
	installPrompt:
		locale === "fa"
			? "فیتورا را مثل یک اپ نصب کن تا آفلاین هم کار کند."
			: locale === "tr"
				? "Fitora’yı uygulama gibi kur; böylece çevrimdışı da çalışır."
				: "Install Fitora like an app so it works offline too.",
	installAction:
		locale === "fa"
			? "نصب اپ"
			: locale === "tr"
				? "Uygulamayı kur"
				: "Install app",
	reset:
		locale === "fa"
			? "پاک کردن همه‌ی داده‌ها"
			: locale === "tr"
				? "Tüm verileri temizle"
				: "Clear all data",
	resetConfirm:
		locale === "fa"
			? "همه‌ی برنامه، جلسه‌ها و وزن‌ها پاک شوند؟"
			: locale === "tr"
				? "Tüm program, seanslar ve kilolar silinsin mi?"
				: "Delete all plans, sessions, and weights?",
	signoutConfirm:
		locale === "fa"
			? "از حساب خارج می‌شوی؟ داده‌ها روی این دستگاه می‌مانند."
			: locale === "tr"
				? "Hesaptan çıkmak istiyor musun? Veriler bu cihazda kalır."
				: "Sign out? Your data stays on this device.",
	planSummary:
		locale === "fa" ? "برنامه" : locale === "tr" ? "Program" : "Plan",
	subscription:
		locale === "fa" ? "اشتراک" : locale === "tr" ? "Abonelik" : "Subscription",
	freePlan:
		locale === "fa"
			? "نسخه‌ی رایگان"
			: locale === "tr"
				? "Ücretsiz sürüm"
				: "Free plan",
	premium:
		locale === "fa"
			? "دیدن اشتراک ویژه"
			: locale === "tr"
				? "Özel aboneliği gör"
				: "View premium",
	bodyCalc:
		locale === "fa"
			? "تخمین‌های بدنی"
			: locale === "tr"
				? "Vücut tahminleri"
				: "Body estimates",
	whtr:
		locale === "fa"
			? "نسبت دور کمر به قد"
			: locale === "tr"
				? "Bel-boy oranı"
				: "Waist-to-height ratio",
	bmi:
		locale === "fa"
			? "شاخص توده‌ی بدنی (BMI)"
			: locale === "tr"
				? "Vücut kitle indeksi (BMI)"
				: "Body Mass Index (BMI)",
	dailyEnergy:
		locale === "fa"
			? "انرژی روزانه برای هدفت"
			: locale === "tr"
				? "Hedefin için günlük enerji"
				: "Daily energy for your goal",
	protein:
		locale === "fa"
			? "پروتئین روزانه"
			: locale === "tr"
				? "Günlük protein"
				: "Daily protein",
	fineprint:
		locale === "fa"
			? "این‌ها تخمین با فرمول‌های عمومی هستند..."
			: locale === "tr"
				? "Bunlar genel formüllere göre tahmindir..."
				: "These are estimates using general formulas...",
	changeAnswers:
		locale === "fa"
			? "تغییر جواب‌ها و ساخت برنامه‌ی تازه"
			: locale === "tr"
				? "Cevapları değiştir ve yeni program oluştur"
				: "Change answers and create a new plan",
	installDone:
		locale === "fa"
			? "اپ نصب شد. حالا می‌توانی آفلاین هم تمرین کنی."
			: locale === "tr"
				? "Uygulama yüklendi. Artık çevrimdışı da antrenman yapabilirsin."
				: "App installed. You can work out offline now.",
	invalidEmail:
		locale === "fa"
			? "ایمیل نامعتبر است."
			: locale === "tr"
				? "Geçersiz e-posta."
				: "Invalid email.",
	accountGood:
		locale === "fa"
			? "حساب کاربری فعال شد."
			: locale === "tr"
				? "Hesabın aktif edildi."
				: "Account is active.",
	codeInvalid:
		locale === "fa"
			? "کد ورود اشتباه است."
			: locale === "tr"
				? "Giriş kodu yanlış."
				: "The login code is incorrect.",
	codeSendFailed:
		locale === "fa"
			? "ارسال کد انجام نشد."
			: locale === "tr"
				? "Kod gönderilemedi."
				: "Could not send the code.",
	confirmSignOut:
		locale === "fa"
			? "از حساب خارج می‌شوی؟ داده‌ها روی این دستگاه می‌مانند."
			: locale === "tr"
				? "Hesaptan çıkmak ister misin? Veriler bu cihazda kalır."
				: "Sign out? Your data stays on this device.",
	confirmReset:
		locale === "fa"
			? "همه‌ی داده‌ها پاک شوند؟"
			: locale === "tr"
				? "Tüm veriler silinsin mi?"
				: "Clear all data?",
	paySuccess:
		locale === "fa"
			? "پرداخت انجام شد"
			: locale === "tr"
				? "Ödeme tamamlandı"
				: "Payment complete",
	payFail:
		locale === "fa"
			? "پرداخت انجام نشد"
			: locale === "tr"
				? "Ödeme tamamlanmadı"
				: "Payment failed",
	payLeadSuccess:
		locale === "fa"
			? "اشتراک ویژه فعال شد. حالا برنامه باهوش‌تر می‌شود."
			: locale === "tr"
				? "Özel abonelik etkinleştirildi. Artık program daha akıllı çalışıyor."
				: "Premium is active. Your plan is now smarter.",
	payLeadFail:
		locale === "fa"
			? "پرداخت انجام نشد، دوباره تلاش کن."
			: locale === "tr"
				? "Ödeme tamamlanmadı, lütfen tekrar deneyin."
				: "Payment did not complete. Please try again.",
	goWorkout:
		locale === "fa"
			? "برو به تمرین"
			: locale === "tr"
				? "Antrenmana başla"
				: "Go to workout",
	tryAgain:
		locale === "fa"
			? "دوباره تلاش کن"
			: locale === "tr"
				? "Tekrar dene"
				: "Try again",
	premiumActivated:
		locale === "fa"
			? "اشتراک ویژه فعال شد."
			: locale === "tr"
				? "Özel abonelik etkinleştirildi."
				: "Premium activated.",
});

export function sparkline(vals: number[]): string {
	if (vals.length < 2) return "";
	const w = 300,
		h = 80,
		pad = 8;
	const lo = Math.min(...vals),
		hi = Math.max(...vals);
	const span = hi - lo || 1;
	const pts = vals.map((v, i) => [
		pad + (i / (vals.length - 1)) * (w - pad * 2),
		h - pad - ((v - lo) / span) * (h - pad * 2),
	]);
	const locale = getLocale();
	// time runs right-to-left in Persian, left-to-right elsewhere
	const fx = (x: number) => (locale === "fa" ? w - x : x);
	const d = pts
		.map(([x, y], i) => `${i ? "L" : "M"}${fx(x).toFixed(1)} ${y.toFixed(1)}`)
		.join(" ");
	const [lx, ly] = pts[pts.length - 1];
	const label =
		locale === "fa"
			? "روند وزن"
			: locale === "tr"
				? "Kilo takibi"
				: "Weight trend";
	return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
    <path d="${d}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${fx(lx).toFixed(1)}" cy="${ly.toFixed(1)}" r="5" fill="currentColor"/></svg>`;
}

/* ---------- body then vs now ---------- */

type Entry = AppStateEntry;
type AppStateEntry = { date: string; kg: number; waist?: number; hip?: number };
let compareMode: "start" | "month" = "start";
export const setCompareMode = (m: "start" | "month"): void => {
	compareMode = m;
};

/** Fill missing circumferences from earlier entries (or the onboarding answers). */
function withCirc(list: Entry[]): Entry[] {
	let waist = state.profile?.waist,
		hip = state.profile?.hip;
	const first = list.find((x) => x.waist);
	if (first && !waist) waist = first.waist;
	return list.map((x) => {
		waist = x.waist ?? waist;
		hip = x.hip ?? hip;
		return { ...x, waist, hip };
	});
}

function comparePair(): [Entry, Entry] | null {
	const list = withCirc(
		[...state.weights].sort((a, b) => a.date.localeCompare(b.date)),
	);
	if (list.length < 2) return null;
	const now = list[list.length - 1];
	if (compareMode === "start") return [list[0], now];
	const target = Date.now() - 30 * 86_400_000;
	const before = list
		.slice(0, -1)
		.reduce((b, x) =>
			Math.abs(new Date(x.date).getTime() - target) <
			Math.abs(new Date(b.date).getTime() - target)
				? x
				: b,
		);
	return [before, now];
}

const shortDate = (d: string) =>
	new Date(d).toLocaleDateString(localeTag(), {
		day: "numeric",
		month: "long",
	});
const num = (n: number) =>
	fa(String(Math.round(n * 10) / 10).replace(".", "٫"));

export function compareHTML(): string {
	const locale = getLocale();
	const text = txt(locale);
	const pair = comparePair();
	if (!pair)
		return `<h2 class="h3">${text.bodyCompare}</h2>
      <div class="empty">${locale === "fa" ? "هر ماه وزن و دور کمرت را پایین همین صفحه ثبت کن؛ آدمک قبل و الانت را کنار هم می‌بینی." : locale === "tr" ? "Her ay kilo ve bel çevresini bu sayfada kaydet; önceki ve şu anki vücudunu yan yana gör." : "Log your weight and waist here each month to compare your body over time."}</div>`;
	const [a, b] = pair;
	const goal = state.profile!.goal;
	const dKg = b.kg - a.kg;
	const dWaist = a.waist && b.waist ? b.waist - a.waist : null;
	const good = (d: number, wantDown: boolean) =>
		d === 0 ? "" : d < 0 === wantDown ? "good" : "bad";
	const sign = (d: number) => (d > 0 ? "+" : d < 0 ? "−" : "");
	const sep = locale === "fa" ? "، " : ", ";
	const waistWord =
		locale === "fa" ? "کمر" : locale === "tr" ? "bel" : "waist";
	const cm = locale === "fa" ? "سانت" : "cm";
	const stageLabel = (d: string) =>
		locale === "fa"
			? `آدمک بدن تو در ${shortDate(d)}`
			: locale === "tr"
				? `${shortDate(d)} tarihindeki vücudunun mankeni`
				: `Mannequin of your body on ${shortDate(d)}`;
	const caption = (e: Entry) =>
		`<b>${shortDate(e.date)}</b><span>${kgText(Math.round(e.kg * 10) / 10, locale)}${e.waist ? `${sep}${waistWord} ${num(e.waist)}` : ""}</span>`;
	return `<h2 class="h3">${text.bodyCompare}</h2>
    <div class="chips compare-mode" role="tablist">
      <button class="chip ${compareMode === "start" ? "on" : ""}" data-cmp="start" role="tab">${text.fromStart}</button>
      <button class="chip ${compareMode === "month" ? "on" : ""}" data-cmp="month" role="tab">${text.monthAgo}</button>
    </div>
    <div class="body-compare">
      <figure><div class="bc-stage"><canvas data-bc="0" aria-label="${stageLabel(a.date)}"></canvas></div>
        <figcaption>${caption(a)}</figcaption></figure>
      <figure><div class="bc-stage now"><canvas data-bc="1" aria-label="${stageLabel(b.date)}"></canvas></div>
        <figcaption>${caption(b)}</figcaption></figure>
    </div>
    <p class="bc-diff">
      <span class="${good(dKg, goal !== "muscle")}">${text.bodyWeight} ${sign(dKg)}${kgText(Math.round(Math.abs(dKg) * 10) / 10, locale)}</span>
      ${dWaist !== null ? `<span class="${good(dWaist, true)}">${text.waist} ${sign(dWaist)}${num(Math.abs(dWaist))} ${cm}</span>` : ""}
    </p>`;
}

export function mountCompare(root: HTMLElement): () => void {
	const pair = comparePair();
	const cs = $$<HTMLCanvasElement>("canvas[data-bc]", root);
	if (!pair || cs.length !== 2) return () => {};
	const ms: Mannequin[] = [];
	cs.forEach((c, i) => {
		const e = pair[i];
		const m = new Mannequin(c, {
			interactive: true,
			spin: 0.3,
			onView: (y, p) => ms[1 - i]?.setView(y, p),
		});
		m.setBody(
			shapeFor({ ...state.profile!, weight: e.kg, waist: e.waist, hip: e.hip }),
		);
		m.setAnim(IDLE);
		ms.push(m);
	});
	// same framing for both, so a smaller body really looks smaller
	const f0 = ms[0].getFit(),
		f1 = ms[1].getFit();
	const fit = { r: Math.max(f0.r, f1.r), top: Math.max(f0.top, f1.top) };
	ms.forEach((m) => m.lockFit(fit));
	return () => ms.forEach((m) => m.destroy());
}

export const progressView: View = (root) => {
	const locale = getLocale();
	setLocale(locale);
	const text = txt(locale);
	const ss = state.sessions;
	const weeks = weekCounts(ss, 8);
	const max = Math.max(1, ...weeks, state.profile?.days ?? 3);
	const minutes = ss.reduce((a, s) => a + s.minutes, 0);
	const kcal = ss.reduce((a, s) => a + (s.kcal ?? 0), 0);

	const bars = weeks
		.map(
			(n, i) =>
				`<li title="${fa(n)} ${text.sessions}"><i style="--h:${(n / max) * 100}%" class="${i === weeks.length - 1 ? "cur" : ""}"></i><span>${i === weeks.length - 1 ? (locale === "fa" ? "این هفته" : locale === "tr" ? "Bu hafta" : "This week") : ""}</span></li>`,
		)
		.join("");

	root.innerHTML = `
    <section class="progress">
      <h1 class="h1">${text.progress}</h1>
      <div class="stats">
        <div><b>${fa(ss.filter((x) => x.day >= 0).length)}</b><span>${text.sessions}</span></div>
        <div><b>${fa(minutes)}</b><span>${text.minutes}</span></div>
        <div><b>${fa(kcal.toLocaleString("en-US").replace(/,/g, "٬"))}</b><span>${text.kcal}</span></div>
        <div><b>${fa(weekStreak())}</b><span>${text.streak}</span></div>
      </div>

      ${weightCardHTML()}

      <h2 class="h3">${locale === "fa" ? "جلسه‌ها در ۸ هفته‌ی اخیر" : locale === "tr" ? "Son 8 haftadaki seanslar" : "Sessions in the last 8 weeks"}</h2>
      <ol class="bars" aria-label="${locale === "fa" ? "تعداد جلسه در هر هفته" : locale === "tr" ? "Haftalık seans sayısı" : "Sessions per week"}">${bars}</ol>

      ${(() => {
				const rs = records()
					.sort((a, b) => (b.kg ?? 0) - (a.kg ?? 0))
					.slice(0, 8);
				return rs.length
					? `<h2 class="h3">${locale === "fa" ? "رکوردهای تو" : locale === "tr" ? "Rekorların" : "Your records"}</h2>
             <ul class="history records">${rs
								.map(
									(r) =>
										`<li><a href="#/ex/${r.id}">${exerciseName(r.id, locale)}</a><span>${
											r.kg !== undefined
												? `${kgText(r.kg, locale)} × ${fa(r.reps)}`
												: dose(r.reps, !!EX[r.id].timed, undefined, locale)
										}</span></li>`,
								)
								.join("")}</ul>`
					: "";
			})()}


      <h2 class="h3">${text.recentSessions}</h2>
      ${
				ss.length
					? `<ul class="history">${ss
							.slice(-10)
							.reverse()
							.map(
								(
									s,
								) => `<li><span>${s.day < 0 && s.logs?.[0] && EX[s.logs[0].id] ? exerciseName(s.logs[0].id, locale) : state.plan?.days[s.day] ? dayTitle(state.plan.days[s.day], locale) : locale === "fa" ? "جلسه" : locale === "tr" ? "Seans" : "Session"}</span>
                  <span class="muted">${new Date(s.ts).toLocaleDateString(localeTag(locale), { weekday: "long", day: "numeric", month: "long" })}</span>
                  <span>${fa(s.minutes)} ${locale === "fa" ? "دقیقه" : locale === "tr" ? "dk" : "min"}</span><span>${s.day < 0 && s.logs?.[0] ? dose(s.logs[0].reps, !!EX[s.logs[0].id]?.timed, s.sets, locale) : FEEL[locale][s.feel]}</span></li>`,
							)
							.join("")}</ul>`
					: `<div class="empty">${text.notYet} <a href="#/today">${text.firstWorkout}</a></div>`
			}
    </section>`;
};

const GOAL = {
	fatloss: "چربی‌سوزی",
	muscle: "عضله‌سازی",
	fit: "سرحال و سالم",
} as const;
const PLACE = {
	bodyweight: "خانه، بدون وسیله",
	dumbbell: "خانه، با دمبل",
	gym: "باشگاه",
} as const;
const LIMIT = { knee: "زانو", back: "کمر", shoulder: "شانه" } as const;
const LEVEL = ["", "تازه‌کار", "متوسط", "منظم"];

const SYNC_TEXT = {
	fa: {
		off: "",
		"signed-out": "",
		syncing: "در حال همگام‌سازی…",
		synced: "همگام شد",
		error: "همگام‌سازی انجام نشد؛ دوباره تلاش می‌شود",
	},
	en: {
		off: "",
		"signed-out": "",
		syncing: "Syncing…",
		synced: "Synced",
		error: "Sync failed; it will be retried",
	},
	tr: {
		off: "",
		"signed-out": "",
		syncing: "Eşitleniyor…",
		synced: "Eşitlendi",
		error: "Eşitleme başarısız; tekrar denenecek",
	},
} as const;
let pendingEmail = "";

function accountHTML(): string {
	const locale = getLocale();
	const text = txt(locale);
	const email = signedInEmail();
	if (email)
		return `<h2 class="h3">${text.account}</h2>
      <div class="sub-box">
        <p><b>${email}</b></p>
        <p class="muted">${SYNC_TEXT[locale][syncStatus()]}</p>
        <button class="btn btn-quiet" data-act="signout">${text.logout}</button>
      </div>`;
	return `<h2 class="h3">${text.account}</h2>
    <div class="sub-box login-box">
      <p>${text.loginText}</p>
      ${
				pendingEmail
					? `<p class="muted">${text.otpSent.replace("%EMAIL%", pendingEmail)}</p>
             <input class="field" id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="${text.verifyCode}" dir="ltr">
             <button class="btn btn-main" data-act="verify">${text.login}</button>
             <button class="btn btn-quiet" data-act="reemail">${text.changeEmail}</button>`
					: `<input class="field" id="email" type="email" autocomplete="email" placeholder="${text.emailPlaceholder}" dir="ltr">
             <button class="btn btn-main" data-act="sendcode">${text.sendCode}</button>`
			}
    </div>`;
}

export const profileView: View = (root, _p, query) => {
	const locale = getLocale();
	setLocale(locale);
	const text = txt(locale);
	const p = state.profile!;
	const pro = isPremium();

	const goalLabel = (key: keyof typeof GOAL) => {
		if (locale === "fa") return GOAL[key];
		if (locale === "tr")
			return key === "fatloss"
				? "Yağ yakımı"
				: key === "muscle"
					? "Kas yapımı"
					: "Sağlıklı ve fit";
		return key === "fatloss"
			? "Fat loss"
			: key === "muscle"
				? "Muscle gain"
				: "Healthy & fit";
	};
	const placeLabel = (key: keyof typeof PLACE) => {
		if (locale === "fa") return PLACE[key];
		if (locale === "tr")
			return key === "bodyweight"
				? "Ev, ekipmansız"
				: key === "dumbbell"
					? "Ev, dambıl ile"
					: "Spor salonu";
		return key === "bodyweight"
			? "Home, no equipment"
			: key === "dumbbell"
				? "Home, dumbbells"
				: "Gym";
	};
	const levelLabel = (n: number) => {
		if (locale === "fa") return LEVEL[n] ?? "";
		if (locale === "tr")
			return ["", "Yeni başlayan", "Orta", "Düzenli"][n] ?? "";
		return ["", "Beginner", "Intermediate", "Consistent"][n] ?? "";
	};
	const limitLabel = (l: keyof typeof LIMIT) => {
		if (locale === "fa") return LIMIT[l];
		if (locale === "tr")
			return { knee: "Diz", back: "Bel", shoulder: "Omuz" }[l];
		return { knee: "Knee", back: "Back", shoulder: "Shoulder" }[l];
	};

	const paint = () => {
		const cm = locale === "fa" ? "سانت" : "cm";
		// one tile per measurement: label, value, unit
		const bodyTiles: [string, string, string][] = [
			[
				locale === "fa" ? "سن" : locale === "tr" ? "Yaş" : "Age",
				fa(p.age),
				locale === "fa" ? "سال" : locale === "tr" ? "" : "yrs",
			],
			[
				locale === "fa" ? "قد" : locale === "tr" ? "Boy" : "Height",
				fa(p.height),
				cm,
			],
			[text.bodyWeight, num(p.weight), locale === "fa" ? "کیلو" : "kg"],
		];
		if (p.waist) bodyTiles.push([text.waist, num(p.waist), cm]);
		if (p.hip)
			bodyTiles.push([
				locale === "fa" ? "دور باسن" : locale === "tr" ? "Kalça" : "Hip",
				num(p.hip),
				cm,
			]);
		root.innerHTML = `
    <section class="profile">
      <h1 class="h1">${p.name || text.profileTitle}</h1>
      <dl class="summary">
        <div><dt>${text.goal}</dt><dd>${goalLabel(p.goal)}</dd></div>
        <div><dt>${text.level}</dt><dd>${levelLabel(p.level)}</dd></div>
        <div><dt>${text.place}</dt><dd>${placeLabel(p.place)}</dd></div>
        <div><dt>${text.plan}</dt><dd>${locale === "fa" ? `${fa(p.days)} روز در هفته، ${fa(p.minutes)} دقیقه` : locale === "tr" ? `Haftada ${fa(p.days)} gün, ${fa(p.minutes)} dakika` : `${fa(p.days)} days/week, ${fa(p.minutes)} min`}</dd></div>
        <div><dt>${text.limits}</dt><dd>${p.limits.length ? p.limits.map((l) => limitLabel(l)).join(locale === "fa" ? "، " : ", ") : locale === "fa" ? "ندارد" : locale === "tr" ? "Yok" : "None"}</dd></div>
      </dl>
      <div class="stats body-stats">${bodyTiles
				.map(
					([label, value, unit]) =>
						`<div><b>${value}${unit ? ` <small>${unit}</small>` : ""}</b><span>${label}</span></div>`,
				)
				.join("")}</div>

      <h2 class="h3">${text.bodyCalc}</h2>
      <dl class="summary">
        ${(() => {
					const r = whtr(p);
					return r
						? `<div><dt>${text.whtr}</dt><dd>${fa(r.toFixed(2))}<small class="muted d-block">${whtrText(r, locale)}</small></dd></div>`
						: "";
				})()}
        <div><dt>${text.bmi}</dt><dd>${fa(bmi(p).toFixed(1))}<small class="muted d-block">${bmiBandText(bmiBand(bmi(p)), locale)}</small></dd></div>
        <div><dt>${text.dailyEnergy}</dt><dd>${locale === "fa" ? "حدود" : locale === "tr" ? "Yaklaşık" : "About"} ${money(dailyKcal(p))} ${locale === "fa" ? "کیلوکالری" : locale === "tr" ? "kalori" : "kcal"}</dd></div>
        <div><dt>${text.protein}</dt><dd>${locale === "fa" ? "حدود" : locale === "tr" ? "Yaklaşık" : "About"} ${fa(proteinGrams(p))} ${locale === "fa" ? "گرم" : locale === "tr" ? "gr" : "g"}</dd></div>
      </dl>
      <p class="fineprint">${locale === "fa" ? "این‌ها تخمین با فرمول‌های عمومی هستند. BMI عضله را از چربی تشخیص نمی‌دهد؛ اگر دور کمرت را وارد کنی، نسبت کمر به قد ملاک تصمیم‌ها می‌شود که دقیق‌تر است. برای رژیم غذایی دقیق با متخصص تغذیه مشورت کن." : locale === "tr" ? "Bunlar genel formüllere dayalı tahminlerdir. BMI kası yağdan ayırt edemez; bel çevreni girersen kararlar daha doğru olan bel-boy oranına göre verilir. Kişiye özel bir beslenme planı için bir diyetisyene danış." : "These are estimates based on general formulas. BMI can’t distinguish muscle from fat; if you enter your waist measurement, waist-to-height ratio is more accurate. Consult a nutrition specialist for a precise diet plan."}</p>
      <a class="btn btn-ghost" href="#/quiz">${text.changeAnswers}</a>
      <a class="btn btn-ghost" href="#/rehab">${locale === "fa" ? "نقاط درد و حرکات اصلاحی" : locale === "tr" ? "Ağrı noktaları ve düzeltici hareketler" : "Painful spots and corrective moves"}</a>

      ${cloudEnabled() ? accountHTML() : ""}

      <h2 class="h3">${text.subscription}</h2>
      <div class="sub-box">
        ${
					pro
						? `<p><b>${state.sub!.plan === "trial" ? (locale === "fa" ? "دوره‌ی آزمایشی" : locale === "tr" ? "Deneme süresi" : "Trial") : locale === "fa" ? "اشتراک ویژه" : locale === "tr" ? "Özel abonelik" : "Premium"}</b> ${(locale === "fa" ? "فعال است تا %D." : locale === "tr" ? "%D tarihine kadar aktif." : "active until %D.").replace("%D", new Date(state.sub!.until).toLocaleDateString(localeTag(locale), { day: "numeric", month: "long" }))}</p>`
						: `<p>${locale === "fa" ? `نسخه‌ی رایگان: ${fa(3)} جلسه در هفته و حرکت‌های پایه.` : locale === "tr" ? `Ücretsiz sürüm: haftada ${fa(3)} seans ve temel hareketler.` : `Free plan: ${fa(3)} sessions/week and basic moves.`}</p><a class="btn btn-main" href="#/pro">${text.premium}</a>`
				}
      </div>

      ${
				isStandalone()
					? ""
					: `<h2 class="h3">${text.installTitle}</h2>
             <div class="install-box">${
								canInstall()
									? `<p>${text.installPrompt}</p><button class="btn btn-ghost" data-act="install">${text.installAction}</button>`
									: isIOS()
										? `<p>${locale === "fa" ? "در سافاری، دکمه‌ی اشتراک‌گذاری را بزن و «Add to Home Screen» را انتخاب کن." : locale === "tr" ? "Safari’de paylaş düğmesine dokun ve «Ana Ekrana Ekle» seçeneğini seç." : "In Safari, tap the share button and choose ‘Add to Home Screen’."}</p>`
										: `<p>${locale === "fa" ? "از منوی مرورگر، گزینه‌ی «نصب برنامه» یا «افزودن به صفحه‌ی اصلی» را انتخاب کن." : locale === "tr" ? "Tarayıcı menüsünden «Uygulamayı yükle» veya «Ana ekrana ekle» seç." : "Choose ‘Install app’ or ‘Add to Home Screen’ from the browser menu."}</p>`
							}</div>`
			}

      <p class="fineprint">${locale === "fa" ? "فیتورا جایگزین نظر پزشک یا مربی نیست. اگر در حین تمرین درد، سرگیجه یا تنگی نفس داشتی، تمرین را متوقف کن." : locale === "tr" ? "Fitora, bir doktorun veya antrenörün tavsiyesinin yerine geçmez. Antrenman sırasında ağrı, baş dönmesi veya nefes darlığı hissedersen dur." : "Fitora is not a substitute for medical or coaching advice. Stop the workout if you feel pain, dizziness, or shortness of breath."}</p>
      <button class="btn btn-quiet danger" data-act="reset">${text.reset}</button>
    </section>`;
	};
	paint();
	const off = onInstallChange(paint);
	const offCloud = onCloudChange(paint);
	if (query.get("login"))
		$(".login-box", root)?.scrollIntoView({ block: "center" });

	root.addEventListener("click", async (e) => {
		const t = (e.target as Element).closest<HTMLElement>("[data-act]");
		if (!t) return;
		if (t.dataset.act === "install") {
			if (await install()) toast(text.installDone);
		}
		try {
			if (t.dataset.act === "sendcode") {
				const email = $<HTMLInputElement>("#email", root)!.value.trim();
				if (!/^\S+@\S+\.\S+$/.test(email)) return toast(text.invalidEmail);
				(t as HTMLButtonElement).disabled = true;
				await sendCode(email);
				pendingEmail = email;
				paint();
				$<HTMLInputElement>("#otp", root)?.focus();
			}
			if (t.dataset.act === "verify") {
				const code = parseFaDigits(
					$<HTMLInputElement>("#otp", root)!.value.trim(),
				);
				(t as HTMLButtonElement).disabled = true;
				await verifyCode(pendingEmail, code);
				pendingEmail = "";
				toast(text.accountGood);
				if (query.get("login") === "pro") go("#/pro");
				else paint();
			}
		} catch {
			toast(
				t.dataset.act === "verify" ? text.codeInvalid : text.codeSendFailed,
			);
			paint();
			return;
		}
		if (t.dataset.act === "reemail") {
			pendingEmail = "";
			paint();
		}
		if (t.dataset.act === "signout" && confirm(text.confirmSignOut)) signOut();
		if (t.dataset.act === "reset" && confirm(text.confirmReset)) {
			resetAll();
			go("#/");
		}
	});
	return () => {
		off();
		offCloud();
	};
};

/** Return page after the payment page (ZarinPal, iyzico or PayPal): #/pay?ok=1 or ok=0. */
export const payResultView: View = (root, _p, query) => {
	const locale = getLocale();
	const text = txt(locale);
	const ok = query.get("ok") === "1";
	root.innerHTML = `<section class="pay-result">
    <h1 class="hero-title">${ok ? text.paySuccess : text.payFail}</h1>
    <p class="lead">${ok ? text.payLeadSuccess : text.payLeadFail}</p>
    <a class="btn btn-main" href="${ok ? "#/today" : "#/pro"}">${ok ? text.goWorkout : text.tryAgain}</a>
  </section>`;
	if (ok)
		void refreshSubscription().then(() => {
			update(() => {});
			void syncNow();
			$(".lead", root)!.textContent = text.premiumActivated;
		});
};

const FEATURES: Record<"fa" | "en" | "tr", [string, boolean][]> = {
	fa: [
		["برنامه‌ی شخصی بر اساس هدف و وسایل", true],
		["آموزش سه‌بعدی حرکت‌های پایه", true],
		["ثبت جلسه، وزن و روند پیشرفت", true],
		["همه‌ی روزهای هفته (تا ۵ جلسه)", false],
		["تنظیم خودکار تکرارها بعد از هر جلسه", false],
		["حرکت‌های ویژه‌ی باشگاه و دمبل", false],
	],
	en: [
		["Personal plan based on your goal and equipment", true],
		["3D coaching for the basic movements", true],
		["Log sessions, weight, and progress", true],
		["All week days (up to 5 sessions)", false],
		["Automatic rep adjustments after each session", false],
		["Gym and dumbbell specialty moves", false],
	],
	tr: [
		["Hedefin ve ekipmanına göre kişisel plan", true],
		["Temel hareketler için 3D rehberlik", true],
		["Seans, kilo ve ilerleme kaydı", true],
		["Haftanın tüm günleri (5 seansa kadar)", false],
		["Her seans sonrası otomatik tekrar ayarı", false],
		["Spor salonu ve dambıl özel hareketleri", false],
	],
};

export const proView: View = (root) => {
	const locale = getLocale();
	const features = FEATURES[locale];
	const planText: Record<string, { title: string; per: string; note?: string }> =
		{
			fa: {
				monthly: { title: "ماهانه", per: "در ماه" },
				yearly: { title: "سالانه", per: "در سال", note: "۴۵٪ ارزان‌تر" },
			},
			en: {
				monthly: { title: "Monthly", per: "per month" },
				yearly: { title: "Yearly", per: "per year", note: "45% cheaper" },
			},
			tr: {
				monthly: { title: "Aylık", per: "/ ay" },
				yearly: { title: "Yıllık", per: "/ yıl", note: "%45 daha ucuz" },
			},
		}[locale];
	const paypal = payProvider() === "paypal";
	const card = payProvider() === "iyzico";
	const currency = payCurrency();
	let chosen: BillingPlan = "yearly";
	const pro = isPremium();
	const trialOk = !state.trialUsed && !pro;

	root.innerHTML = `
    <section class="pricing">
      <header class="detail-top"><button class="icon-btn" data-act="back" aria-label="${locale === "fa" ? "بازگشت" : locale === "tr" ? "Geri" : "Back"}">✕</button></header>
      <h1 class="hero-title">${locale === "fa" ? "تمرینی که با تو بزرگ می‌شود." : locale === "tr" ? "Seninle büyüyen antrenman." : "A workout that grows with you."}</h1>
      <p class="lead">${locale === "fa" ? "بعد از هر جلسه می‌گویی چطور بود؛ فیتورا تکرارها و زمان‌ها را برای جلسه‌ی بعد تنظیم می‌کند." : locale === "tr" ? "Her seansın ardından nasıl geçtiğini söylersin; Fitora bir sonraki seans için tekrar ve süreleri ayarlar." : "After each session you tell us how it went; Fitora adjusts the reps and timing for the next session."}</p>
      <table class="compare">
        <thead><tr><th></th><th>${locale === "fa" ? "رایگان" : locale === "tr" ? "Ücretsiz" : "Free"}</th><th>${locale === "fa" ? "ویژه" : locale === "tr" ? "Özel" : "Premium"}</th></tr></thead>
        <tbody>${features.map(([f, free]) => `<tr><td>${f}</td><td>${free ? checkIcon : '<span class="dash">-</span>'}</td><td>${checkIcon}</td></tr>`).join("")}</tbody>
      </table>
      <div class="plans" role="radiogroup" aria-label="${locale === "fa" ? "انتخاب اشتراک" : locale === "tr" ? "Abonelik seçimi" : "Choose subscription"}">
        ${PRICES.map(
					(
						p,
					) => `<button class="plan ${p.id === chosen ? "sel" : ""}" role="radio" aria-checked="${p.id === chosen}" data-plan="${p.id}">
            <span class="plan-title">${planText[p.id].title}${planText[p.id].note ? `<em>${planText[p.id].note}</em>` : ""}</span>
            <span class="plan-price"><b>${currency === "USD" ? `$${fa(p.usd.toFixed(2))}` : currency === "TRY" ? `₺${money(p.try)}` : money(p.price)}</b> ${currency !== "IRT" ? "" : locale === "fa" ? CURRENCY : "Toman"} ${planText[p.id].per}</span>
          </button>`,
				).join("")}
      </div>
      ${trialOk ? `<button class="btn btn-main" data-act="trial">${locale === "fa" ? `${fa(TRIAL_DAYS)} روز رایگان امتحان کن` : locale === "tr" ? `${fa(TRIAL_DAYS)} gün ücretsiz dene` : `Try ${fa(TRIAL_DAYS)} days free`}</button>` : ""}
      <button class="btn ${trialOk ? "btn-ghost" : "btn-main"}" data-act="buy">${pro ? (locale === "fa" ? "تمدید اشتراک" : locale === "tr" ? "Aboneliği yenile" : "Renew subscription") : card ? (locale === "fa" ? "پرداخت با کارت اعتباری" : locale === "tr" ? "Kredi veya banka kartıyla öde" : "Pay by credit or debit card") : paypal ? (locale === "fa" ? "پرداخت با پی‌پال یا کارت" : locale === "tr" ? "PayPal veya kartla öde" : "Pay with PayPal or card") : locale === "fa" ? "پرداخت و فعال‌سازی" : locale === "tr" ? "Öde ve etkinleştir" : "Pay and activate"}</button>
      <p class="fineprint">${
				isRealPayments()
					? card
						? locale === "fa"
							? "پرداخت امن با کارت اعتباری یا بانکی (ویزا، مسترکارت) در صفحه‌ی iyzico. اشتراک خودکار تمدید نمی‌شود."
							: locale === "tr"
								? "iyzico ödeme sayfasında kredi veya banka kartıyla (Visa, Mastercard, Troy) güvenli ödeme. Abonelik otomatik yenilenmez."
								: "Secure payment by credit or debit card (Visa, Mastercard) on iyzico’s payment page. The subscription is not auto-renewed."
						: paypal
						? locale === "fa"
							? "پرداخت امن با پی‌پال یا کارت اعتباری در صفحه‌ی پی‌پال. اشتراک خودکار تمدید نمی‌شود."
							: locale === "tr"
								? "PayPal sayfasında PayPal veya kredi/banka kartıyla güvenli ödeme. Abonelik otomatik yenilenmez."
								: "Secure payment on PayPal’s page with PayPal or a credit/debit card. The subscription is not auto-renewed."
						: locale === "fa"
							? "پرداخت امن از طریق درگاه زرین‌پال. اشتراک خودکار تمدید نمی‌شود."
							: locale === "tr"
								? "ZarinPal üzerinden güvenli ödeme. Abonelik otomatik yenilenmez."
								: "Secure payment via ZarinPal. The subscription is not auto-renewed."
					: locale === "fa"
						? "پرداخت این نسخه‌ی نمایشی شبیه‌سازی‌شده است."
						: locale === "tr"
							? "Bu demo sürümünde ödeme simüle edilir."
							: "This demo version uses simulated payment."
			}</p>
    </section>`;

	const activate = async (plan: BillingPlan, btn: HTMLButtonElement) => {
		btn.disabled = true;
		const old = btn.textContent;
		btn.textContent =
			plan === "trial"
				? locale === "fa"
					? "در حال فعال‌سازی…"
					: locale === "tr"
						? "Etkinleştiriliyor…"
						: "Activating…"
				: locale === "fa"
					? "در حال اتصال به درگاه…"
					: locale === "tr"
						? "Ödeme ekranına bağlanılıyor…"
						: "Connecting to checkout…";
		if (plan !== "trial" && isRealPayments() && !signedInEmail()) {
			go("#/profile?login=pro");
			return;
		}
		const res = plan === "trial" ? { ok: true } : await provider.checkout(plan);
		if (res.ok && plan !== "trial" && isRealPayments()) return;
		if (!res.ok) {
			btn.disabled = false;
			btn.textContent = old;
			toast(
				locale === "fa"
					? "پرداخت انجام نشد. دوباره امتحان کن."
					: locale === "tr"
						? "Ödeme yapılmadı. Tekrar deneyin."
						: "Payment failed. Try again.",
			);
			return;
		}
		grant(plan);
		toast(
			locale === "fa"
				? plan === "trial"
					? "دوره‌ی آزمایشی فعال شد"
					: "اشتراک ویژه فعال شد"
				: locale === "tr"
					? plan === "trial"
						? "Deneme süresi etkinleştirildi"
						: "Özel abonelik etkinleştirildi"
					: plan === "trial"
						? "Trial activated"
						: "Premium activated",
		);
		go("#/profile");
	};

	root.addEventListener("click", async (e) => {
		const t = (e.target as Element).closest<HTMLElement>(
			"[data-act],[data-plan]",
		);
		if (!t) return;
		buzz();
		if (t.dataset.plan) {
			chosen = t.dataset.plan as BillingPlan;
			root.querySelectorAll(".plan").forEach((btn) => {
				btn.classList.toggle("sel", btn.getAttribute("data-plan") === chosen);
				btn.setAttribute(
					"aria-checked",
					String(btn.getAttribute("data-plan") === chosen),
				);
			});
			return;
		}
		if (t.dataset.act === "back")
			return history.length > 1 ? history.back() : go("#/today");
		if (t.dataset.act === "trial" || t.dataset.act === "buy") {
			await activate(chosen, t as HTMLButtonElement);
		}
	});

	return () => {};
};
