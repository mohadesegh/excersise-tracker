import { bmi, bmiBand, bmiBandText } from "../body";
import { getLocale, localeTag } from "../i18n";
import { state, update } from "../store";
import { $, buzz, dayKey, fa, parseFaNumber } from "../utils";
import { compareHTML, mountCompare, setCompareMode } from "./account";
import { backIcon, toast, type View } from "./ui";

/*
 * Weight & measurements tracker: log (any date), chart with a 7-day trend,
 * optional goal line with a projection, safe-rate check, history with delete,
 * and the then-vs-now mannequins.
 */

type Entry = { date: string; kg: number; waist?: number; hip?: number };
type Metric = "kg" | "waist";
type Range = 30 | 90 | 0;

const DAY = 86_400_000;
const num = (n: number, d = 1) =>
	fa(String(Math.round(n * 10 ** d) / 10 ** d).replace(".", "٫"));
const ts = (d: string) => new Date(`${d}T12:00:00`).getTime();
const faShort = (t: number) =>
	new Date(t).toLocaleDateString(localeTag(), {
		day: "numeric",
		month: "short",
	});
const faLong = (d: string) =>
	new Date(`${d}T12:00:00`).toLocaleDateString(localeTag(), {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
const signed = (
	d: number,
	unit: string,
	locale: "fa" | "en" | "tr" = getLocale(),
) => {
	if (Math.abs(d) < 0.05)
		return locale === "fa"
			? "بدون تغییر"
			: locale === "tr"
				? "Değişiklik yok"
				: "No change";
	return `${d > 0 ? "+" : "−"}${num(Math.abs(d))} ${unit}`;
};

const entries = (): Entry[] =>
	[...state.weights].sort((a, b) => a.date.localeCompare(b.date));

let metric: Metric = "kg";
let range: Range = 90;

/** Average of all entries in the 7 days up to each point: smooths out daily water swings. */
function trend(pts: { t: number; v: number }[]): { t: number; v: number }[] {
	return pts.map((p) => {
		const win = pts.filter((q) => q.t <= p.t && q.t > p.t - 7 * DAY);
		return { t: p.t, v: win.reduce((a, q) => a + q.v, 0) / win.length };
	});
}

/** Least-squares slope in units per day over the last `days`. */
function slope(pts: { t: number; v: number }[], days: number): number | null {
	const recent = pts.filter((p) => p.t > Date.now() - days * DAY);
	if (recent.length < 3 || recent[recent.length - 1].t - recent[0].t < 10 * DAY)
		return null;
	const n = recent.length;
	const mx = recent.reduce((a, p) => a + p.t, 0) / n;
	const my = recent.reduce((a, p) => a + p.v, 0) / n;
	let num_ = 0,
		den = 0;
	for (const p of recent) {
		num_ += (p.t - mx) * (p.v - my);
		den += (p.t - mx) ** 2;
	}
	return den ? (num_ / den) * DAY : null;
}

function niceTicks(lo: number, hi: number, n = 4): number[] {
	const span = hi - lo || 1;
	const raw = span / n;
	const mag = 10 ** Math.floor(Math.log10(raw));
	const stepSize =
		[1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
	const out: number[] = [];
	for (
		let v = Math.ceil(lo / stepSize) * stepSize;
		v <= hi + 1e-9;
		v += stepSize
	)
		out.push(+v.toFixed(2));
	return out;
}

/** SVG line chart. It follows the reading direction: in Persian the newest point is on the left. */
export function weightChart(
	list: Entry[],
	m: Metric,
	opts: { goal?: number; compact?: boolean; days?: Range } = {},
): string {
	const all = list
		.filter((e) => (m === "kg" ? true : e[m] !== undefined))
		.map((e) => ({
			t: ts(e.date),
			v: (m === "kg" ? e.kg : e[m])!,
			date: e.date,
		}));
	const pts = opts.days
		? all.filter((p) => p.t > Date.now() - opts.days! * DAY)
		: all;
	if (!pts.length) return "";
	const locale = getLocale();
	const rtl = locale === "fa";
	// text-anchor is relative to the text direction, so the fixed-side labels swap it
	const anchorRight = rtl ? "end" : "start";
	const anchorLeft = rtl ? "start" : "end";
	const W = 340,
		H = opts.compact ? 120 : 220;
	const padL = 10,
		padR = opts.compact ? 10 : 40,
		padT = 14,
		padB = opts.compact ? 10 : 28;
	const t0 = pts[0].t,
		t1 = pts[pts.length - 1].t;
	const goal = m === "kg" ? opts.goal : undefined;
	let lo = Math.min(...pts.map((p) => p.v), goal ?? Infinity);
	let hi = Math.max(...pts.map((p) => p.v), goal ?? -Infinity);
	const pad = Math.max(0.8, (hi - lo) * 0.15);
	lo -= pad;
	hi += pad;
	const X = (t: number) =>
		t1 === t0
			? (padL + W - padR) / 2
			: rtl
				? W - padR - ((t - t0) / (t1 - t0)) * (W - padL - padR)
				: padL + ((t - t0) / (t1 - t0)) * (W - padL - padR);
	const Y = (v: number) =>
		padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
	const line = (p: { t: number; v: number }[]) =>
		p
			.map(
				(q, i) => `${i ? "L" : "M"}${X(q.t).toFixed(1)} ${Y(q.v).toFixed(1)}`,
			)
			.join(" ");

	const grid = opts.compact
		? ""
		: niceTicks(lo, hi)
				.map(
					(v) =>
						`<line x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}" class="wc-grid"/><text x="${W - padR + 6}" y="${Y(v) + 4}" class="wc-y" text-anchor="${anchorRight}">${num(v)}</text>`,
				)
				.join("");
	const xLabels =
		opts.compact || t1 === t0
			? ""
			: [0, 0.5, 1]
					.map((f) => {
						const t = t0 + (t1 - t0) * f;
						return `<text x="${X(t)}" y="${H - 8}" class="wc-x" text-anchor="${f === 0 ? "start" : f === 1 ? "end" : "middle"}">${faShort(t)}</text>`;
					})
					.join("");
	const goalLine =
		goal !== undefined
			? `<line x1="${padL}" x2="${W - padR}" y1="${Y(goal)}" y2="${Y(goal)}" class="wc-goal"/>${opts.compact ? "" : `<text x="${W - padR - 4}" y="${Y(goal) - 5}" class="wc-goal-t" text-anchor="${anchorLeft}">${locale === "fa" ? "هدف" : locale === "tr" ? "Hedef" : "Goal"} ${num(goal)}</text>`}`
			: "";
	const tr = trend(pts);
	const dots = opts.compact
		? ""
		: pts
				.map(
					(p) =>
						`<circle cx="${X(p.t)}" cy="${Y(p.v)}" r="${pts.length > 20 ? 2.5 : 4.5}" class="wc-dot" data-date="${p.date}"><title>${faShort(p.t)}: ${num(p.v)}</title></circle>`,
				)
				.join("");
	return `<svg class="wchart ${opts.compact ? "compact" : ""}" direction="${rtl ? "rtl" : "ltr"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${locale === "fa" ? `نمودار ${m === "kg" ? "وزن" : "دور کمر"}` : locale === "tr" ? (m === "kg" ? "Kilo grafiği" : "Bel çevresi grafiği") : m === "kg" ? "Weight chart" : "Waist chart"}">
    ${grid}${goalLine}
    ${pts.length > 1 ? `<path d="${line(pts)}" class="wc-raw"/>` : ""}
    ${dots}
    ${pts.length > 2 ? `<path d="${line(tr)}" class="wc-trend"/>` : ""}
    ${xLabels}
    ${opts.compact && pts.length ? `<circle cx="${X(t1)}" cy="${Y(pts[pts.length - 1].v)}" r="4" class="wc-last"/>` : ""}
  </svg>`;
}

/** Summary card for the progress page. */
export function weightCardHTML(): string {
	const locale = getLocale();
	const list = entries();
	const goal = state.profile?.goalWeight;
	const labels = {
		fa: {
			title: "وزن و اندازه‌ها",
			start: "از شروع",
			hint: "برای دیدن روند، چند روز دیگر دوباره ثبت کن.",
			action: "ثبت وزن",
			actionFull: "ثبت و نمودار کامل",
			unit: "کیلو",
		},
		en: {
			title: "Weight & measurements",
			start: "since start",
			hint: "Log a few more days to see the trend.",
			action: "Log weight",
			actionFull: "Log and full chart",
			unit: "kg",
		},
		tr: {
			title: "Kilo ve ölçüler",
			start: "başlangıçtan beri",
			hint: "Eğilimi görmek için birkaç gün sonra tekrar kaydet.",
			action: "Kilo kaydet",
			actionFull: "Kaydet ve tam grafik",
			unit: "kg",
		},
	} as const;
	if (!list.length)
		return `<a class="wcard" href="#/body"><div><b>${labels[locale].title}</b><span>${locale === "fa" ? "وزنت را ثبت کن تا روندش را روی نمودار ببینی." : locale === "tr" ? "Eğilimi grafikte görmek için kilonu kaydet." : "Log your weight to see the trend on the chart."}</span></div><span class="wcard-go">${labels[locale].action}</span></a>`;
	const last = list[list.length - 1];
	const first = list[0];
	return `<a class="wcard" href="#/body">
      <div>
        <b>${labels[locale].title}</b>
        <span class="wcard-now">${num(last.kg)} <small>${labels[locale].unit}</small></span>
        <span>${list.length > 1 ? `${signed(last.kg - first.kg, labels[locale].unit, locale)} ${labels[locale].start}` : labels[locale].hint}</span>
      </div>
      ${weightChart(list, "kg", { compact: true, goal })}
      <span class="wcard-go">${labels[locale].actionFull}</span>
    </a>`;
}

export const bodyView: View = (root) => {
	const locale = getLocale();
	const prof = state.profile!;
	let unmount = () => {};

	const text = {
		fa: {
			back: "بازگشت",
			title: "وزن و اندازه‌ها",
			week: "یک هفته",
			month: "یک ماه",
			goal: "وزن هدف",
			goalPlaceholder: "مثلاً ۷۰",
			goalAria: "وزن هدف به کیلوگرم",
			weight: "وزن",
			waist: "دور کمر",
			all: "همه",
			monthRange: "یک ماه",
			threeMonths: "سه ماه",
			newEntry: "ثبت جدید",
			date: "تاریخ",
			kg: "وزن (کیلو)",
			waistInput: "دور کمر (سانت، اختیاری)",
			hipInput: "دور باسن (سانت، اختیاری)",
			save: "ثبت",
			saveGoal: "ذخیره",
			history: "همه‌ی ثبت‌ها",
			noWeight: "هنوز وزنی ثبت نشده.",
			noWaist: "هنوز دور کمری ثبت نشده.",
			addFromBelow: "از فرم پایین ثبت کن.",
			singleEntry:
				"یک ثبت داری. چند روز دیگر دوباره ثبت کن تا نمودار روند را نشان بدهد.",
			legendEntries: "ثبت‌ها",
			legendAvg: "میانگین ۷ روزه",
			legendTarget: "هدف",
			trend: "روند ۶ هفته‌ی اخیر",
			confirmDelete: "این ثبت حذف شود؟",
			goalInvalid: "وزن هدف را به کیلوگرم وارد کن",
			goalSaved: "وزن هدف ذخیره شد",
			goalRemoved: "وزن هدف حذف شد",
			kgInvalid: "وزن را به کیلوگرم وارد کن، مثلاً ۷۲٫۵",
			waistInvalid: "دور کمر را به سانتی‌متر وارد کن",
			hipInvalid: "دور باسن را به سانتی‌متر وارد کن",
			futureDate: "تاریخ آینده قابل ثبت نیست",
			saved: "ثبت شد",
			savedPast: "ثبت شد (تاریخ قبل)",
			deleteEntry: "حذف ثبت",
			notEnoughData: "برای دیدن روند، چند روز دیگر دوباره ثبت کن.",
			logWeight: "ثبت وزن",
			fullChart: "ثبت و نمودار کامل",
			unit: "کیلو",
			start: "از شروع",
			trackHint: "بیشتر ثبت کن تا روند را ببینی.",
		},
		en: {
			back: "Back",
			title: "Weight & measurements",
			week: "1 week",
			month: "1 month",
			goal: "Goal weight",
			goalPlaceholder: "e.g. 70",
			goalAria: "Goal weight in kg",
			weight: "Weight",
			waist: "Waist",
			all: "All",
			monthRange: "1 month",
			threeMonths: "3 months",
			newEntry: "New entry",
			date: "Date",
			kg: "Weight (kg)",
			waistInput: "Waist (cm, optional)",
			hipInput: "Hip (cm, optional)",
			save: "Log",
			saveGoal: "Save",
			history: "All entries",
			noWeight: "No weight logged yet.",
			noWaist: "No waist measurement yet.",
			addFromBelow: "Log it from the form below.",
			singleEntry: "You have one entry. Log a few more days to see the trend.",
			legendEntries: "Entries",
			legendAvg: "7-day average",
			legendTarget: "Goal",
			trend: "Trend over the last 6 weeks",
			confirmDelete: "Delete this entry?",
			goalInvalid: "Enter a goal weight in kg",
			goalSaved: "Goal weight saved",
			goalRemoved: "Goal weight removed",
			kgInvalid: "Enter weight in kg, e.g. 72.5",
			waistInvalid: "Enter waist in cm",
			hipInvalid: "Enter hip in cm",
			futureDate: "Future dates are not allowed",
			saved: "Saved",
			savedPast: "Saved (past date)",
			deleteEntry: "Delete entry",
			notEnoughData: "Log a few more days to see the trend.",
			logWeight: "Log weight",
			fullChart: "Log and full chart",
			unit: "kg",
			start: "since start",
			trackHint: "Log more days to see the trend.",
		},
		tr: {
			back: "Geri",
			title: "Kilo ve ölçüler",
			week: "1 hafta",
			month: "1 ay",
			goal: "Hedef kilo",
			goalPlaceholder: "örn. 70",
			goalAria: "Kilogram cinsinden hedef kilo",
			weight: "Kilo",
			waist: "Bel",
			all: "Tümü",
			monthRange: "1 ay",
			threeMonths: "3 ay",
			newEntry: "Yeni giriş",
			date: "Tarih",
			kg: "Kilo (kg)",
			waistInput: "Bel (cm, isteğe bağlı)",
			hipInput: "Kalça (cm, isteğe bağlı)",
			save: "Kaydet",
			saveGoal: "Kaydet",
			history: "Tüm girişler",
			noWeight: "Henüz kilo kaydedilmedi.",
			noWaist: "Henüz bel ölçüsü kaydedilmedi.",
			addFromBelow: "Aşağıdaki formdan kaydet.",
			singleEntry:
				"Bir kaydın var. Eğilimi görmek için birkaç gün sonra tekrar kaydet.",
			legendEntries: "Girişler",
			legendAvg: "7 günlük ortalama",
			legendTarget: "Hedef",
			trend: "Son 6 haftalık eğilim",
			confirmDelete: "Bu kayıt silinsin mi?",
			goalInvalid: "Hedef kiloyu kg olarak gir",
			goalSaved: "Hedef kilo kaydedildi",
			goalRemoved: "Hedef kilo silindi",
			kgInvalid: "Kilonu kg olarak gir, örn. 72,5",
			waistInvalid: "Bel ölçüsünü cm olarak gir",
			hipInvalid: "Kalça ölçüsünü cm olarak gir",
			futureDate: "Gelecek tarihler kaydedilemez",
			saved: "Kaydedildi",
			savedPast: "Kaydedildi (eski tarih)",
			deleteEntry: "Girişi sil",
			notEnoughData: "Eğilimi görmek için birkaç gün sonra tekrar kaydet.",
			logWeight: "Kilo kaydet",
			fullChart: "Kaydet ve tam grafik",
			unit: "kg",
			start: "başlangıçtan beri",
			trackHint: "Eğilimi görmek için daha fazla gün kaydet.",
		},
	} as const;
	const labels = text[locale];

	const paint = () => {
		unmount();
		const list = entries();
		const last = list[list.length - 1];
		const goal = prof.goalWeight;
		const pts = list.map((e) => ({ t: ts(e.date), v: e.kg }));
		const s = slope(pts, 42);
		const weekly = s === null ? null : s * 7;
		const ago = (days: number) => {
			const target = Date.now() - days * DAY;
			const older = list.filter((e) => ts(e.date) <= target);
			return older.length ? last.kg - older[older.length - 1].kg : null;
		};
		const w7 = last ? ago(7) : null,
			w30 = last ? ago(30) : null;
		const b = last ? bmi({ height: prof.height, weight: last.kg }) : 0;

		const fast = weekly !== null && last && weekly < -0.01 * last.kg;
		const lowGoal =
			goal !== undefined && bmi({ height: prof.height, weight: goal }) < 18.5;
		let eta = "";
		if (
			goal !== undefined &&
			weekly !== null &&
			last &&
			!lowGoal &&
			Math.abs(last.kg - goal) > 0.3
		) {
			const towards = (goal - last.kg) * weekly > 0;
			if (towards && Math.abs(weekly) > 0.05) {
				const weeks = Math.abs(goal - last.kg) / Math.abs(weekly);
				if (weeks < 104) {
					eta =
						locale === "fa"
							? `با همین روند، حدود ${fa(Math.max(1, Math.round(weeks)))} هفته‌ی دیگر به هدف می‌رسی.`
							: locale === "tr"
								? `Bu gidişle yaklaşık ${fa(Math.max(1, Math.round(weeks)))} hafta sonra hedefine ulaşırsın.`
								: `At this rate, you’ll reach the goal in about ${fa(Math.max(1, Math.round(weeks)))} more weeks.`;
				}
			} else {
				eta =
					locale === "fa"
						? "روند فعلی به سمت هدف نیست؛ برنامه‌ی تمرین و تغذیه را مرور کن."
						: locale === "tr"
							? "Mevcut eğilim hedefe doğru değil; antrenman ve beslenme planını gözden geçir."
							: "The current trend is not heading toward the goal; review your workout and nutrition plan.";
			}
		}

		root.innerHTML = `
      <section class="bodyp">
        <header class="detail-top">
          <a class="icon-btn" href="#/progress" aria-label="${labels.back}">${backIcon}</a>
          <h1 class="h2">${labels.title}</h1>
        </header>

        ${
					last
						? `<div class="wstats">
                <div class="wnow"><b>${num(last.kg)}</b><span>${locale === "fa" ? "کیلو، " : "kg, "}${faLong(last.date)}</span></div>
                <div><b>${w7 === null ? "-" : signed(w7, labels.unit, locale)}</b><span>${labels.week}</span></div>
                <div><b>${w30 === null ? "-" : signed(w30, labels.unit, locale)}</b><span>${labels.month}</span></div>
                <div><b>${fa(b.toFixed(1))}</b><span>${bmiBandText(bmiBand(b), locale)}</span></div>
              </div>`
						: ""
				}

        <div class="chips wtabs" role="tablist">
          <button class="chip ${metric === "kg" ? "on" : ""}" data-metric="kg" role="tab">${labels.weight}</button>
          <button class="chip ${metric === "waist" ? "on" : ""}" data-metric="waist" role="tab">${labels.waist}</button>
          <span class="wtabs-gap"></span>
          ${([30, 90, 0] as Range[]).map((r) => `<button class="chip ${range === r ? "on" : ""}" data-range="${r}">${r === 30 ? labels.monthRange : r === 90 ? labels.threeMonths : labels.all}</button>`).join("")}
        </div>
        <div class="wchart-box">
          ${
						weightChart(list, metric, { goal, days: range }) ||
						`<div class="empty">${metric === "waist" ? labels.noWaist : labels.noWeight} ${labels.addFromBelow}</div>`
					}
          ${list.length === 1 ? `<p class="muted small">${labels.singleEntry}</p>` : ""}
          ${list.length > 2 ? `<p class="wlegend"><i class="lg-raw"></i>${labels.legendEntries} <i class="lg-trend"></i>${labels.legendAvg} <i class="lg-goal"></i>${labels.legendTarget}</p>` : ""}
          <p class="wpoint muted small" aria-live="polite"></p>
        </div>

        ${weekly !== null ? `<p class="wrate">${labels.trend}: <b>${signed(weekly, labels.unit, locale)}</b> ${locale === "fa" ? "در هفته" : locale === "tr" ? "haftada" : "per week"}</p>` : ""}
        ${fast ? `<p class="safety" role="note">${locale === "fa" ? "وزنت سریع‌تر از حد توصیه‌شده (حدود ۱٪ وزن بدن در هفته) کم می‌شود. کاهش خیلی سریع معمولاً عضله را هم کم می‌کند؛ کمی کالری بیشتر بخور و اگر نگرانی، با پزشک مشورت کن." : locale === "tr" ? "Kilon önerilenden daha hızlı düşüyor (haftada vücut ağırlığının yaklaşık %1’i). Çok hızlı düşüş genelde kas kaybına da yol açar; biraz daha fazla kalori ye ve endişen varsa doktorla konuş." : "Your weight is dropping faster than recommended (about 1% of body weight per week). Very rapid loss often reduces muscle too; eat a bit more and check with a clinician if you’re concerned."}</p>` : ""}

        <h2 class="h3">${labels.newEntry}</h2>
        <form class="wform">
          <label><span>${labels.date}</span><input class="field" type="date" name="date" value="${dayKey()}" max="${dayKey()}" dir="ltr"></label>
          <label><span>${labels.kg}</span><input class="field" name="kg" inputmode="decimal" placeholder="${last ? num(last.kg) : locale === "fa" ? "مثلاً ۷۲٫۵" : locale === "tr" ? "örn. 72,5" : "e.g. 72.5"}" required></label>
          <label><span>${labels.waistInput}</span><input class="field" name="waist" inputmode="decimal" placeholder="${last?.waist ? num(last.waist) : ""}"></label>
          <label><span>${labels.hipInput}</span><input class="field" name="hip" inputmode="decimal" placeholder="${last?.hip ? num(last.hip) : ""}"></label>
          <button class="btn btn-main" type="submit">${labels.save}</button>
        </form>
        <p class="muted small">${locale === "fa" ? "برای مقایسه‌ی درست، همیشه صبح، بعد از دستشویی و قبل از صبحانه وزن کن. وزن روزانه تا ۱ تا ۲ کیلو به‌خاطر آب بدن بالا و پایین می‌رود؛ به میانگین ۷ روزه نگاه کن، نه به یک روز." : locale === "tr" ? "Daha doğru kıyaslama için her sabah tuvaletten sonra ve kahvaltıdan önce tartıl. Günlük ağırlık su tutumu nedeniyle 1–2 kg dalgalanabilir; tek güne değil 7 günlük ortalamaya bak." : "For a fair comparison, weigh yourself every morning after the bathroom and before breakfast. Daily weight can fluctuate by 1–2 kg due to water retention, so look at the 7-day average rather than one day."}</p>

        <h2 class="h3">${labels.goal}</h2>
        <form class="gform">
          <input class="field" name="goal" inputmode="decimal" placeholder="${labels.goalPlaceholder}" value="${goal ? num(goal) : ""}" aria-label="${labels.goalAria}">
          <button class="btn btn-ghost" type="submit">${labels.saveGoal}</button>
        </form>
        ${lowGoal ? `<p class="safety" role="note">${locale === "fa" ? `این وزن برای قد ${fa(prof.height)} سانتی‌متر کمتر از محدوده‌ی سالم است (BMI زیر ۱۸٫۵). پیشنهاد می‌کنم هدف را با پزشک یا متخصص تغذیه تعیین کنی.` : locale === "tr" ? `Bu kilo ${fa(prof.height)} cm boy için sağlıklı aralığın altında (BMI 18,5’in altında). Hedefi bir doktor veya diyetisyenle belirlemeni öneririm.` : `This weight is below the healthy range for a height of ${fa(prof.height)} cm (BMI under 18.5). I recommend setting your goal with a doctor or dietitian.`}</p>` : ""}
        ${eta ? `<p class="wrate">${eta}</p>` : ""}

        ${compareHTML()}

        ${
					list.length
						? `<h2 class="h3">${labels.history}</h2>
               <ul class="history wlist">${[...list]
									.reverse()
									.map(
										(e, i, arr) => `<li>
                     <span>${faLong(e.date)}</span>
                     <span><b>${num(e.kg)}</b> ${locale === "fa" ? "کیلو" : locale === "tr" ? "kg" : "kg"}${e.waist ? `${locale === "fa" ? `، کمر ${num(e.waist)}` : locale === "tr" ? `, bel ${num(e.waist)}` : `, waist ${num(e.waist)}`}` : ""}${e.hip ? `${locale === "fa" ? `، باسن ${num(e.hip)}` : locale === "tr" ? `, kalça ${num(e.hip)}` : `, hip ${num(e.hip)}`}` : ""}
                       ${arr[i + 1] ? `<small class="${e.kg - arr[i + 1].kg <= 0 ? "down" : "up"}">${signed(e.kg - arr[i + 1].kg, "", locale)}</small>` : ""}</span>
                     <button class="icon-btn wdel" data-del="${e.date}" aria-label="${labels.deleteEntry} ${faLong(e.date)}">✕</button>
                   </li>`,
									)
									.join("")}</ul>`
						: ""
				}
      </section>`;
		unmount = mountCompare(root);
	};

	root.addEventListener("click", (e) => {
		const t = e.target as Element;
		const cmp = t.closest<HTMLElement>("[data-cmp]");
		if (cmp) {
			setCompareMode(cmp.dataset.cmp as "start" | "month");
			paint();
			return;
		}
		const chip = t.closest<HTMLElement>("[data-metric],[data-range]");
		if (chip) {
			if (chip.dataset.metric) metric = chip.dataset.metric as Metric;
			if (chip.dataset.range !== undefined)
				range = Number(chip.dataset.range) as Range;
			paint();
			return;
		}
		const dot = t.closest<SVGCircleElement>(".wc-dot");
		if (dot) {
			const en = entries().find((x) => x.date === dot.dataset.date);
			if (en) {
				$(".wpoint", root)!.textContent =
					`${faLong(en.date)}: ${num(en.kg)} ${locale === "fa" ? "کیلو" : locale === "tr" ? "kg" : "kg"}${en.waist ? `${locale === "fa" ? `، کمر ${num(en.waist)} سانت` : locale === "tr" ? `, bel ${num(en.waist)} cm` : `, waist ${num(en.waist)} cm`}` : ""}`;
			}
			return;
		}
		const del = t.closest<HTMLElement>("[data-del]");
		if (del && confirm(labels.confirmDelete)) {
			update((s) => {
				s.weights = s.weights.filter((x) => x.date !== del.dataset.del);
				const lastE = [...s.weights]
					.sort((a, b) => a.date.localeCompare(b.date))
					.pop();
				if (lastE && s.profile) s.profile.weight = lastE.kg;
			});
			paint();
		}
	});

	root.addEventListener("submit", (e) => {
		e.preventDefault();
		const f = e.target as HTMLFormElement;
		const val = (n: string) =>
			(f.elements.namedItem(n) as HTMLInputElement | null)?.value.trim() ?? "";
		buzz();
		if (f.classList.contains("gform")) {
			const g = val("goal") ? parseFaNumber(val("goal")) : undefined;
			if (g !== undefined && !(g > 30 && g < 250))
				return toast(labels.goalInvalid);
			update((s) => (s.profile!.goalWeight = g));
			toast(g ? labels.goalSaved : labels.goalRemoved);
			return paint();
		}
		const date = val("date") || dayKey();
		const kg = parseFaNumber(val("kg"));
		const waist = val("waist") ? parseFaNumber(val("waist")) : undefined;
		const hip = val("hip") ? parseFaNumber(val("hip")) : undefined;
		if (!(kg > 25 && kg < 300)) return toast(labels.kgInvalid);
		if (waist !== undefined && !(waist > 40 && waist < 200))
			return toast(labels.waistInvalid);
		if (hip !== undefined && !(hip > 50 && hip < 220))
			return toast(labels.hipInvalid);
		if (date > dayKey()) return toast(labels.futureDate);
		update((s) => {
			s.weights = s.weights.filter((x) => x.date !== date);
			s.weights.push({ date, kg: Math.round(kg * 10) / 10, waist, hip });
			const lastE = [...s.weights]
				.sort((a, b) => a.date.localeCompare(b.date))
				.pop()!;
			if (s.profile) {
				s.profile.weight = lastE.kg;
				if (lastE.waist) s.profile.waist = lastE.waist;
				if (lastE.hip) s.profile.hip = lastE.hip;
			}
		});
		toast(
			state.weights.filter((x) => x.date === date).length && date !== dayKey()
				? labels.savedPast
				: labels.saved,
		);
		paint();
	});

	paint();
	return () => unmount();
};
