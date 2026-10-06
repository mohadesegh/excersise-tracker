import { planNotes, sessionKcal } from "../body";
import {
	buildPlan,
	dayTitle,
	estimateMinutes,
	FREE_DAYS,
	resolve,
} from "../planner";
import {
	CYCLE_WEEKS,
	isLoaded,
	setsThisWeek,
	todayKg,
	weekInfo,
} from "../progression";
import { refresh } from "../router";
import { isPremium, state, update } from "../store";
import type { Session } from "../types";
import { $, dayKey, fa } from "../utils";
import { getLocale, setLocale, t, type Locale } from "../i18n";
import { EX, exerciseName } from "../data/exercises";
import { regionName, routineFor, routineMinutes } from "../rehab";
import { rehabDoneToday } from "./rehab";
import {
	bindLangSwitcher,
	dose,
	kgText,
	langSwitcherHTML,
	lockIcon,
	mountMannequin,
	mountThumbs,
	proBadge,
	type View,
} from "./ui";

export const welcomeView: View = (root) => {
	const locale = getLocale();
	setLocale(locale);
	const brandName = locale === "fa" ? "فیتورا" : "Fitora";
	root.innerHTML = `
    <section class="welcome">
      ${langSwitcherHTML(locale)}
      <div class="welcome-stage"><canvas aria-label="${locale === "fa" ? "آدمک در حال اسکات؛ برای چرخاندن بکشید" : locale === "tr" ? "Squat yapan manken; döndürmek için sürükle" : "Mannequin doing a squat; drag to rotate"}"></canvas></div>
      <div class="welcome-copy">
        <p class="brand">${brandName}</p>
        <h1 class="hero-title">${locale === "fa" ? "برنامه‌ی تمرینیِ مخصوص خودت، در کمتر از یک دقیقه." : locale === "tr" ? "Kişiselleştirilmiş antrenman planın bir dakikadan kısa sürede." : "Your personalized workout plan in under a minute."}</h1>
        <p class="lead">${locale === "fa" ? "هفت سؤال کوتاه جواب بده؛ برنامه‌ای می‌گیری که با بدن، وقت و وسایلت جور است. هر حرکت را سه‌بعدی و از هر زاویه ببین." : locale === "tr" ? "Yedi kısa soruya cevap ver; vücuduna, zamanına ve ekipmanına uyan bir program al. Her hareketi 3D ve her açıdan gör." : "Answer seven short questions and get a program designed for your body, time, and gear. See every move in 3D from every angle."}</p>
        <a class="btn btn-main" href="#/quiz">${t("start", locale)}</a>
        <p class="fineprint">${locale === "fa" ? "رایگان، بدون ثبت‌نام" : locale === "tr" ? "Ücretsiz, kayıt gerekmez" : "Free, no sign-up required"}</p>
      </div>
    </section>`;

	const unbindLang = bindLangSwitcher(root);

	const m = mountMannequin($<HTMLCanvasElement>("canvas", root)!, "squat", {
		interactive: true,
		spin: 0.3,
	});
	return () => {
		unbindLang();
		m.destroy();
	};
};

/** Saturday-first week, as used in Iran. */
function weekStart(d = new Date()): Date {
	const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	s.setDate(s.getDate() - ((s.getDay() + 1) % 7));
	return s;
}

/** Sessions of the plan; moves logged on their own from the library are not among them. */
export const planSessions = (sessions: Session[]): Session[] =>
	sessions.filter((s) => s.day >= 0);

export function weekCounts(sessions: Session[], weeks: number): number[] {
	const start = weekStart();
	const out = new Array(weeks).fill(0);
	for (const s of planSessions(sessions)) {
		const diff = Math.floor(
			(start.getTime() - weekStart(new Date(s.ts)).getTime()) /
				(7 * 86_400_000) +
				0.5,
		);
		if (diff >= 0 && diff < weeks) out[weeks - 1 - diff]++;
	}
	return out;
}

/** Weeks in a row that hit the weekly target; the current week only counts once it's hit. */
export function weekStreak(): number {
	const target = Math.min(
		state.profile?.days ?? 3,
		isPremium() ? 7 : FREE_DAYS,
	);
	const counts = weekCounts(state.sessions, 52);
	let n = 0;
	for (let k = counts.length - 1; k >= 0; k--) {
		if (counts[k] >= target) n++;
		else if (k === counts.length - 1) continue;
		else break;
	}
	return n;
}

export function nextDayIndex(): number {
	const plan = state.plan!;
	const open = plan.days
		.map((d, k) => ({ d, k }))
		.filter(({ d }) => isPremium() || !d.premiumOnly)
		.map(({ k }) => k);
	const last = planSessions(state.sessions).pop();
	if (!last) return open[0];
	const pos = open.indexOf(last.day);
	return open[(pos + 1) % open.length];
}

const GOAL_TXT: Record<"fatloss" | "muscle" | "fit", Record<Locale, string>> = {
	fatloss: {
		fa: "چربی‌سوزی",
		en: "Fat loss",
		tr: "Yağ yakımı",
	},
	muscle: {
		fa: "عضله‌سازی",
		en: "Muscle gain",
		tr: "Kas yapımı",
	},
	fit: {
		fa: "سرحال و سالم",
		en: "Healthy & fit",
		tr: "Sağlıklı ve fit",
	},
};
const WEEKDAYS: Record<Locale, string[]> = {
	fa: ["ش", "ی", "د", "س", "چ", "پ", "ج"],
	en: ["S", "S", "M", "T", "W", "T", "F"],
	tr: ["Ct", "Pz", "Pt", "Sa", "Ça", "Pe", "Cu"],
};

export const todayView: View = (root, _p, query) => {
	const locale = getLocale();
	setLocale(locale);
	const prof = state.profile!;
	const plan = state.plan!;
	const pro = isPremium();
	const nextIdx = nextDayIndex();
	const day = plan.days[nextIdx];
	const streak = weekStreak();
	const ws = weekStart();
	const doneDates = new Set(planSessions(state.sessions).map((s) => s.date));
	const thisWeek = weekCounts(state.sessions, 1)[0];
	const target = Math.min(prof.days, pro ? 7 : FREE_DAYS);

	const strip = WEEKDAYS[locale]
		.map((w, k) => {
			const d = new Date(ws);
			d.setDate(ws.getDate() + k);
			const key = dayKey(d);
			const cls = [
				doneDates.has(key) ? "done" : "",
				key === dayKey() ? "now" : "",
			].join(" ");
			return `<li class="${cls}"><span>${w}</span><b>${fa(d.getDate())}</b></li>`;
		})
		.join("");

	const wk = weekInfo(plan);
	// moves logged on their own today (from a move's page), summed per move
	const loggedToday = new Map<string, { sets: number; reps: number; kg?: number }>();
	for (const ses of state.sessions) {
		if (ses.day >= 0 || ses.date !== dayKey()) continue;
		for (const l of ses.logs ?? []) {
			const cur = loggedToday.get(l.id);
			loggedToday.set(l.id, { sets: (cur?.sets ?? 0) + 1, reps: l.reps, kg: l.kg ?? cur?.kg });
		}
	}
	const doneDose = (id: string, timed: boolean) => {
		const l = loggedToday.get(id)!;
		return `✓ ${dose(l.reps, timed, l.sets)}${l.kg ? `<small>${kgText(l.kg, locale)}</small>` : ""}`;
	};
	const planned = new Set<string>();

	const items = day.items
		.map((it) => {
			const { ex } = resolve(it, pro);
			planned.add(ex.id);
			if (loggedToday.has(ex.id))
				return `<li><a class="ex-row done" href="#/ex/${ex.id}">
        <canvas class="thumb" data-thumb="${ex.id}" aria-hidden="true"></canvas>
        <span class="ex-row-name">${exerciseName(ex.id, locale)}</span>
        <span class="ex-row-dose">${doneDose(ex.id, it.timed)}</span></a></li>`;
			const reps = Math.max(
				it.timed ? 10 : 4,
				it.reps + (pro && !isLoaded(ex) ? (state.adjust[ex.id] ?? 0) : 0),
			);
			const kg = isLoaded(ex) ? todayKg(ex, prof, wk) : 0;
			return `<li><a class="ex-row" href="#/ex/${ex.id}">
        <canvas class="thumb" data-thumb="${ex.id}" aria-hidden="true"></canvas>
        <span class="ex-row-name">${exerciseName(ex.id, locale)}</span>
        <span class="ex-row-dose">${dose(reps, it.timed, setsThisWeek(it.sets, wk))}${kg ? `<small>${kgText(kg, locale)}</small>` : ""}</span></a></li>`;
		})
		.join("");

	// logged today but not part of this session: listed on their own
	const extras = [...loggedToday.keys()]
		.filter((id) => !planned.has(id) && EX[id])
		.map(
			(id) => `<li><a class="ex-row done" href="#/ex/${id}">
        <canvas class="thumb" data-thumb="${id}" aria-hidden="true"></canvas>
        <span class="ex-row-name">${exerciseName(id, locale)}</span>
        <span class="ex-row-dose">${doneDose(id, !!EX[id].timed)}</span></a></li>`,
		)
		.join("");
	const extrasTitle =
		locale === "fa"
			? "امروز جدا از برنامه انجام دادی"
			: locale === "tr"
				? "Bugün programın dışında yaptıkların"
				: "Done today outside your plan";

	const others = plan.days
		.map((d, k) => {
			const locked = d.premiumOnly && !pro;
			return `<li><a class="day-chip ${k === nextIdx ? "cur" : ""} ${locked ? "locked" : ""}" href="${locked ? "#/pro" : `#/workout/${k}`}">
        <span>${dayTitle(d, locale)}</span><small>${locked ? `${lockIcon} ${locale === "fa" ? "ویژه" : locale === "tr" ? "Özel" : "Premium"}` : `${fa(d.items.length)} ${locale === "fa" ? "حرکت" : locale === "tr" ? "hareket" : "moves"}`}</small></a></li>`;
		})
		.join("");

	const helloText =
		locale === "fa"
			? prof.name
				? `سلام ${prof.name}`
				: "سلام"
			: locale === "tr"
				? prof.name
					? `Merhaba ${prof.name}`
					: "Merhaba"
				: prof.name
					? `Hi ${prof.name}`
					: "Hi";
	const weekGoalText =
		locale === "fa"
			? thisWeek >= target
				? "هدف این هفته را زدی."
				: `این هفته ${fa(thisWeek)} از ${fa(target)} جلسه`
			: locale === "tr"
				? thisWeek >= target
					? "Bu haftanın hedefini tamamladın."
					: `Bu hafta ${fa(thisWeek)} / ${fa(target)} seans`
				: thisWeek >= target
					? "You hit this week's goal."
					: `This week ${fa(thisWeek)} of ${fa(target)} sessions`;
	const cycleDoneText =
		locale === "fa"
			? [
					`دوره‌ی ${fa(CYCLE_WEEKS)} هفته‌ای تمام شد.`,
					"برای اینکه بدنت به یک تمرین عادت نکند، حرکت‌های دوره‌ی بعد کمی عوض می‌شوند. وزنه‌هایت حفظ می‌شود.",
				]
			: locale === "tr"
				? [
						`${fa(CYCLE_WEEKS)} haftalık döngü tamamlandı.`,
						"Vücudun aynı egzersize alışmasın diye bir sonraki döngünün hareketleri biraz değişecek. Ağırlıklar korunacak.",
					]
				: [
						`${fa(CYCLE_WEEKS)}-week cycle complete.`,
						"To keep your body from adapting, the next cycle swaps in a few different movements while keeping your weights.",
					];
	const cycleChipText =
		locale === "fa"
			? `هفته‌ی ${fa(wk.week)} از ${fa(CYCLE_WEEKS)}${wk.deload ? ". هفته‌ی سبک: یک ست کمتر و وزنه‌ها ۱۰٪ سبک‌تر تا بدنت ریکاوری کند." : ""}`
			: locale === "tr"
				? `Hafta ${fa(wk.week)} / ${fa(CYCLE_WEEKS)}${wk.deload ? ". Hafif hafta: bir set daha az, ağırlıklar %10 daha hafif; böylece vücudun toparlanır." : ""}`
				: `Week ${fa(wk.week)} of ${fa(CYCLE_WEEKS)}${wk.deload ? ". Deload week: one fewer set and 10% lighter weights to help recovery." : ""}`;
	const readyNoteText =
		locale === "fa"
			? `برنامه‌ات آماده است: ${GOAL_TXT[prof.goal][locale]}، ${fa(prof.days)} روز در هفته، حدود ${fa(prof.minutes)} دقیقه.`
			: locale === "tr"
				? `Programın hazır: ${GOAL_TXT[prof.goal][locale]}, haftada ${fa(prof.days)} gün, yaklaşık ${fa(prof.minutes)} dakika.`
				: `Your plan is ready: ${GOAL_TXT[prof.goal][locale]}, ${fa(prof.days)} days a week, about ${fa(prof.minutes)} minutes.`;
	const nextWorkoutText =
		locale === "fa"
			? "شروع تمرین"
			: locale === "tr"
				? "Antrenmana başla"
				: "Start workout";
	const nextSessionText =
		locale === "fa"
			? "جلسه‌ی بعدی"
			: locale === "tr"
				? "Sonraki seans"
				: "Next session";
	const sessionMetaText =
		locale === "fa"
			? `حدود ${fa(estimateMinutes(day) + 5)} دقیقه با گرم کردن و کشش، ${fa(day.items.length)} حرکت`
			: locale === "tr"
				? `Isınma ve esneme dahil yaklaşık ${fa(estimateMinutes(day) + 5)} dakika, ${fa(day.items.length)} hareket`
				: `About ${fa(estimateMinutes(day) + 5)} minutes including warm-up and stretch, ${fa(day.items.length)} exercises`;
	const kcalText =
		locale === "fa"
			? `حدود ${fa(sessionKcal(prof, estimateMinutes(day)))} کیلوکالری`
			: locale === "tr"
				? `Yaklaşık ${fa(sessionKcal(prof, estimateMinutes(day)))} kalori`
				: `About ${fa(sessionKcal(prof, estimateMinutes(day)))} kcal`;
	const weekPlanText =
		locale === "fa"
			? "برنامه‌ی هفته"
			: locale === "tr"
				? "Haftalık program"
				: "This week's plan";
	const upsellTitle =
		locale === "fa"
			? "برنامه‌ات با تو پیشرفت کند"
			: locale === "tr"
				? "Programın seninle gelişsin"
				: "Let your plan grow with you";
	const upsellText =
		locale === "fa"
			? `تنظیم خودکار تکرارها، همه‌ی روزهای هفته و حرکت‌های ویژه. ${fa(7)} روز رایگان امتحان کن.`
			: locale === "tr"
				? `Tekrarların otomatik ayarlanması, haftanın tüm günleri ve özel hareketler. ${fa(7)} gün ücretsiz dene.`
				: `Auto-adjust reps, all-week scheduling, and premium moves. Try ${fa(7)} days free.`;

	const pains = prof.pains ?? [];
	const routine = routineFor(pains);
	const sep = locale === "fa" ? "، " : ", ";
	const rehabCard = pains.length
		? {
				title:
					locale === "fa"
						? "حرکات اصلاحی امروز"
						: locale === "tr"
							? "Bugünün düzeltici hareketleri"
							: "Today's corrective moves",
				text: `${pains.map((x) => regionName(x.region, locale)).join(sep)}. ${
					locale === "fa"
						? `${fa(routine.length)} حرکت، حدود ${fa(routineMinutes(routine))} دقیقه`
						: locale === "tr"
							? `${fa(routine.length)} hareket, yaklaşık ${fa(routineMinutes(routine))} dakika`
							: `${fa(routine.length)} moves, about ${fa(routineMinutes(routine))} minutes`
				}`,
				go: rehabDoneToday()
					? locale === "fa"
						? "✓ انجام شد"
						: locale === "tr"
							? "✓ Yapıldı"
							: "✓ Done"
					: locale === "fa"
						? "شروع"
						: locale === "tr"
							? "Başla"
							: "Start",
			}
		: {
				title:
					locale === "fa"
						? "جایی از بدنت درد دارد؟"
						: locale === "tr"
							? "Vücudunda ağrıyan bir yer var mı?"
							: "Does something hurt?",
				text:
					locale === "fa"
						? "روی بدن سه‌بعدی خودت نشان بده و حرکت اصلاحی بگیر."
						: locale === "tr"
							? "Kendi 3D vücudunun üzerinde göster, düzeltici hareketlerini al."
							: "Show it on your own 3D body and get corrective moves.",
				go:
					locale === "fa"
						? "نشان بده"
						: locale === "tr"
							? "Göster"
							: "Show",
			};

	root.innerHTML = `
    <section class="today">
      ${langSwitcherHTML(locale)}
      <header class="today-head">
        <div>
          <p class="hello">${helloText}</p>
          <h1 class="h1">${weekGoalText}</h1>
        </div>
        ${streak ? `<span class="streak" title="${locale === "fa" ? "هفته‌های پیاپی با هدف کامل" : locale === "tr" ? "Hedefi tamamlayan ardışık haftalar" : "Consecutive weeks hitting the target"}">🔥 ${fa(streak)}</span>` : ""}
      </header>

      <ol class="week-strip" aria-label="${locale === "fa" ? "این هفته" : locale === "tr" ? "Bu hafta" : "This week"}">${strip}</ol>

      ${
				wk.finished
					? `<div class="cycle-done" role="status">
               <b>${cycleDoneText[0]}</b>
               <span>${cycleDoneText[1]}</span>
               <button class="btn btn-main" data-act="newcycle">${locale === "fa" ? "شروع دوره‌ی بعد" : locale === "tr" ? "Sonraki döngüyü başlat" : "Start next cycle"}</button>
             </div>`
					: `<p class="cycle-chip ${wk.deload ? "deload" : ""}">${cycleChipText}</p>`
			}

      ${
				query.get("new")
					? `<div class="ready-note" role="status"><p>${readyNoteText}</p>
             ${planNotes(prof)
								.map((n) => `<p class="note">${n}</p>`)
								.join("")}</div>`
					: ""
			}

      <article class="session-card">
        <div class="session-top">
          <div>
            <p class="muted">${nextSessionText}</p>
            <h2 class="h2">${dayTitle(day, locale)}</h2>
            <p class="muted">${sessionMetaText}</p>
            <p class="muted">${kcalText}</p>
          </div>
          <div class="session-stage"><canvas aria-hidden="true"></canvas></div>
        </div>
        <ul class="ex-list">${items}</ul>
        <a class="btn btn-main" href="#/workout/${nextIdx}">${nextWorkoutText}</a>
      </article>

      ${
				extras
					? `<article class="session-card"><h2 class="h3">${extrasTitle}</h2><ul class="ex-list">${extras}</ul></article>`
					: ""
			}

      <a class="rcard ${pains.length ? "" : "quiet"}" href="#/rehab">
        <div><b>${rehabCard.title}</b><span>${rehabCard.text}</span></div>
        <span class="rcard-go">${rehabCard.go}</span>
      </a>

      <h3 class="h3">${weekPlanText}</h3>
      <ul class="day-chips">${others}</ul>

      ${
				pro
					? ""
					: `<a class="upsell" href="#/pro">
              <div><b>${upsellTitle}</b>
              <span>${upsellText}</span></div>
              ${proBadge(locale)}
            </a>`
			}
    </section>`;

	const unbindLang = bindLangSwitcher(root);

	root.addEventListener("click", (e) => {
		if (!(e.target as Element).closest('[data-act="newcycle"]')) return;
		update(
			(st) => (st.plan = buildPlan(st.profile!, (st.plan?.cycle ?? 0) + 1)),
		);
		refresh();
	});

	const first = resolve(day.items[0], pro).ex;
	const hero = mountMannequin(
		$<HTMLCanvasElement>(".session-stage canvas", root)!,
		first.id,
		{ spin: 0.4 },
	);
	const thumbs = mountThumbs(root);
	return () => {
		unbindLang();
		hero.destroy();
		thumbs();
	};
};
