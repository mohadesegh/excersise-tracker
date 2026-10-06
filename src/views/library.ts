import {
	alternatives,
	EQUIP_NAME,
	EX,
	EXERCISES,
	exerciseName,
	MUSCLE_NAME,
} from "../data/exercises";
import { getLocale, localeTag } from "../i18n";
import { sessionKcal } from "../body";
import { isPremium, state, update } from "../store";
import type { Equip } from "../types";
import { $, $$, buzz, dayKey, fa, go } from "../utils";
import {
	backIcon,
	checkIcon,
	dose,
	kgText,
	mountMannequin,
	mountThumbs,
	proBadge,
	toast,
	type Cleanup,
	type View,
} from "./ui";
import type { Exercise } from "../types";
import { history as exHistory, isLoaded, starterKg } from "../progression";
import { sparkline } from "./account";

const LEVEL = {
	fa: ["", "مبتدی", "متوسط", "پیشرفته"],
	en: ["", "Beginner", "Intermediate", "Advanced"],
	tr: ["", "Başlangıç", "Orta", "İleri"],
} as const;

const libraryText = {
	fa: {
		history: "سابقه‌ی تو",
		logMove: "این حرکت را انجام دادم",
		logSave: "ثبت کن",
		logSets: "ست",
		logReps: "تکرار در هر ست",
		logSecs: "ثانیه در هر ست",
		logKg: "وزنه (کیلو)",
		logged: "ثبت شد. در سابقه و آمارت آمد.",
		setup: "حالت شروع",
		move: "اجرای حرکت",
		cues: "حواست به این‌ها باشد",
		breath: "تنفس",
		feel: "کجا باید حس کنی",
		mistakes: "اشتباه‌های رایج و راه اصلاح",
		all: "همه",
		mobility: "گرم کردن و کشش",
		searchPlaceholder: "جست‌وجوی حرکت یا عضله",
		searchAria: "جست‌وجو",
		notFound: "حرکتی با «${q}» پیدا نشد. اسم عضله را امتحان کن، مثلاً «باسن».",
		sideView: "نمایش سه‌بعدی",
		correct: "درست",
		wrong: "غلط",
		unlock: "باز کردن با اشتراک ویژه",
		unlockText: "آموزش کامل این حرکت در اشتراک ویژه است.",
		drag: "برای چرخاندن، بکش",
		front: "رو‌به‌رو",
		side: "بغل",
		back: "پشت",
		slow: "آهسته",
		muscles: "عضلات",
		compareTitle: "درست یا غلط؟ اشتباه‌های رایج را کنار اجرای درست ببین",
		compareAria: "مقایسه‌ی اجرای درست و غلط",
		correctBtn: "اجرای درست",
		alternatives: "جایگزین‌ها",
		timed: "این حرکت زمان‌دار است؛ در برنامه به ثانیه اجرا می‌شود.",
		sets: "تعداد ست و تکرار در برنامه بر اساس هدف و سطحت تعیین می‌شود.",
		results: "حرکت‌ها",
	},
	en: {
		history: "Your history",
		logMove: "I did this move",
		logSave: "Save",
		logSets: "sets",
		logReps: "reps per set",
		logSecs: "seconds per set",
		logKg: "weight (kg)",
		logged: "Saved. It is in your history and stats now.",
		setup: "Starting position",
		move: "How to perform",
		cues: "Watch for these",
		breath: "Breath",
		feel: "Where to feel it",
		mistakes: "Common mistakes and fixes",
		all: "All",
		mobility: "Warm-up & mobility",
		searchPlaceholder: "Search moves or muscles",
		searchAria: "Search",
		notFound: "No move matched “${q}”. Try a muscle name, like “glutes”.",
		sideView: "3D view:",
		correct: "Correct",
		wrong: "Wrong",
		unlock: "Unlock with premium",
		unlockText: "The full coaching for this move is available with Premium.",
		drag: "Drag to rotate",
		front: "Front",
		side: "Side",
		back: "Back",
		slow: "Slow",
		muscles: "Muscles",
		compareTitle:
			"Right or wrong? Compare the common mistakes against the correct form",
		compareAria: "Compare correct and incorrect form",
		correctBtn: "Correct form",
		alternatives: "Alternatives",
		timed: "This movement is timed; it runs by the second in your plan.",
		sets: "Set and rep targets are based on your goal and level.",
		results: "Moves",
	},
	tr: {
		history: "Geçmişin",
		logMove: "Bu hareketi yaptım",
		logSave: "Kaydet",
		logSets: "set",
		logReps: "set başına tekrar",
		logSecs: "set başına saniye",
		logKg: "ağırlık (kg)",
		logged: "Kaydedildi. Geçmişinde ve istatistiklerinde görünüyor.",
		setup: "Başlangıç pozisyonu",
		move: "Nasıl yapılır",
		cues: "Bunlara dikkat et",
		breath: "Nefes",
		feel: "Nerede hissetmelisin",
		mistakes: "Yaygın hatalar ve düzeltmeler",
		all: "Tümü",
		mobility: "Isınma ve esneme",
		searchPlaceholder: "Hareket veya kas ara",
		searchAria: "Ara",
		notFound:
			"“${q}” için hareket bulunamadı. Kas adını dene, örneğin “kalça”.",
		sideView: "3D görünüm:",
		correct: "Doğru",
		wrong: "Yanlış",
		unlock: "Özel abonelikle aç",
		unlockText: "Bu hareketin tam eğitimi özel abonelikte.",
		drag: "Döndürmek için sürükle",
		front: "Ön",
		side: "Yan",
		back: "Arka",
		slow: "Yavaş",
		muscles: "Kaslar",
		compareTitle:
			"Doğru mu yanlış mı? Yaygın hataları doğru form ile karşılaştır",
		compareAria: "Doğru ve yanlış form karşılaştırması",
		correctBtn: "Doğru form",
		alternatives: "Alternatifler",
		timed: "Bu hareket zamanlıdır; programda saniye cinsinden çalışır.",
		sets: "Set ve tekrar hedefleri hedefine ve seviyene göre belirlenir.",
		results: "Hareketler",
	},
} as const;

/** The user's own record on this move: best set per session. */
function historyHTML(ex: Exercise): string {
	const locale = getLocale();
	const text = libraryText[locale];
	const h = exHistory(ex.id);
	if (!h.length) return "";
	const loaded = h.some((p) => p.kg !== undefined);
	const series = h.slice(-20).map((p) => (loaded ? (p.kg ?? 0) : p.reps));
	const fmt = (p: (typeof h)[number]) =>
		p.kg !== undefined
			? `${kgText(p.kg, locale)} × ${fa(p.reps)}`
			: dose(p.reps, !!ex.timed, undefined, locale);
	const localeDate = localeTag(locale);
	return `
    <section class="history-box">
      <h2 class="h3">${text.history}</h2>
      ${series.length > 1 ? sparkline(series) : ""}
      <ul class="history">${h
				.slice(-6)
				.reverse()
				.map(
					(p) =>
						`<li><span>${new Date(p.ts).toLocaleDateString(localeDate, { day: "numeric", month: "long" })}</span><span>${fmt(p)}</span></li>`,
				)
				.join("")}</ul>
    </section>`;
}

/** Full coaching guide: setup, movement, focus points, breathing, feel, mistakes with fixes. */
export function guideHTML(ex: Exercise): string {
	const locale = getLocale();
	const text = libraryText[locale];
	const g = ex.guide;
	return `
    <section class="guide">
      <h2 class="h3">${text.setup}</h2>
      <ol class="steps">${g.setup.map((t) => `<li>${t}</li>`).join("")}</ol>

      <h2 class="h3">${text.move}</h2>
      <ol class="steps">${g.steps.map((t) => `<li>${t}</li>`).join("")}</ol>

      <h2 class="h3">${text.cues}</h2>
      <ul class="cues">${g.cues.map((t) => `<li>${checkIcon}<span>${t}</span></li>`).join("")}</ul>

      <dl class="guide-facts">
        <div><dt>${text.breath}</dt><dd>${g.breath}</dd></div>
        <div><dt>${text.feel}</dt><dd>${g.feel}</dd></div>
      </dl>

      <h2 class="h3">${text.mistakes}</h2>
      <ul class="mistakes">${g.mistakes.map((x) => `<li><b>${x.m}</b><span>${x.fix}</span></li>`).join("")}</ul>

      ${g.safety ? `<p class="safety" role="note">${g.safety}</p>` : ""}
    </section>`;
}
type Filter = "all" | Equip | "mobility";

export const libraryView: View = (root) => {
	const locale = getLocale();
	const text = libraryText[locale];
	let filter: Filter = "all";
	let q = "";
	let cleanup: Cleanup = () => {};
	const pro = isPremium();

	root.innerHTML = `
    <section class="library">
      <h1 class="h1">${text.results}</h1>
      <input class="field search" type="search" placeholder="${text.searchPlaceholder}" aria-label="${text.searchAria}">
      <div class="chips" role="tablist">
        ${(["all", "none", "dumbbell", "barbell", "mobility"] as Filter[])
					.map(
						(f) =>
							`<button class="chip ${f === "all" ? "on" : ""}" data-f="${f}" role="tab">${f === "all" ? text.all : f === "mobility" ? text.mobility : EQUIP_NAME[f]}</button>`,
					)
					.join("")}
      </div>
      <ul class="grid"></ul>
    </section>`;

	const grid = $(".grid", root)!;
	// search ignores letter case, using the language's own casing rules (Turkish İ/ı)
	const norm = (s: string) => s.toLocaleLowerCase(localeTag(locale));
	function render() {
		cleanup();
		const list = EXERCISES.filter(
			(e) =>
				(filter === "mobility"
					? !!e.kind
					: filter === "all"
						? !e.kind
						: e.equip === filter && !e.kind) &&
				(!q ||
					norm(exerciseName(e.id, locale)).includes(norm(q)) ||
					e.muscles.some((m) => norm(MUSCLE_NAME[m]).includes(norm(q)))),
		);
		grid.innerHTML = list.length
			? list
					.map(
						(e) => `<li><a class="tile" href="#/ex/${e.id}">
              <canvas class="tile-thumb" data-thumb="${e.id}" aria-hidden="true"></canvas>
              <span class="tile-name">${exerciseName(e.id, getLocale())}</span>
              <span class="tile-meta">${e.muscles
								.slice(0, 2)
								.map((m) => MUSCLE_NAME[m])
								.join(locale === "fa" ? "، " : ", ")}</span>
              ${e.premium && !pro ? proBadge(getLocale()) : ""}
            </a></li>`,
					)
					.join("")
			: `<li class="empty">${text.notFound.replace("${q}", q)}</li>`;
		cleanup = mountThumbs(grid);
	}

	root.addEventListener("click", (e) => {
		const c = (e.target as Element).closest<HTMLElement>("[data-f]");
		if (!c) return;
		filter = c.dataset.f as Filter;
		$$(".chip", root).forEach((x) => x.classList.toggle("on", x === c));
		render();
	});
	$<HTMLInputElement>(".search", root)!.addEventListener("input", (e) => {
		q = (e.target as HTMLInputElement).value.trim();
		render();
	});

	render();
	return () => cleanup();
};

export const exerciseView: View = (root, params) => {
	const locale = getLocale();
	const text = libraryText[locale];
	const ex = EX[params[0]];
	if (!ex) {
		go("#/library");
		return;
	}
	const locked = ex.premium && !isPremium();
	const alts = alternatives(ex.id);

	// logging the move on its own, outside a plan session: sets, reps (or seconds) and the weight used
	const prof = state.profile;
	const canLog = !locked && !!prof;
	const log = {
		sets: 3,
		reps: ex.timed ? 30 : 10,
		kg: prof && isLoaded(ex) ? (state.loads[ex.id] ?? starterKg(ex, prof)) : 0,
	};
	const showLog = (k: keyof typeof log) =>
		k === "kg" ? fa(String(log.kg).replace(".", "٫")) : fa(log[k]);
	const stepper = (k: keyof typeof log, label: string) => `
    <div class="stepper" role="group" aria-label="${label}">
      <button data-step="${k}" data-d="-1" aria-label="− ${label}">−</button>
      <output><b>${showLog(k)}</b><small>${label}</small></output>
      <button data-step="${k}" data-d="1" aria-label="+ ${label}">+</button>
    </div>`;
	const logHTML = () => `
      <section class="log-box">
        <button class="btn btn-main" data-act="logopen">${checkIcon}${text.logMove}</button>
        <div class="log-form" hidden>
          <div class="logger">
            ${stepper("sets", text.logSets)}
            ${stepper("reps", ex.timed ? text.logSecs : text.logReps)}
            ${log.kg ? stepper("kg", text.logKg) : ""}
          </div>
          <button class="btn btn-main" data-act="logsave">${text.logSave}</button>
        </div>
      </section>`;

	root.innerHTML = `
    <section class="detail">
      <header class="detail-top">
        <button class="icon-btn" data-act="back" aria-label="${locale === "fa" ? "بازگشت" : locale === "tr" ? "Geri" : "Back"}">${backIcon}</button>
        <h1 class="h2">${exerciseName(ex.id, locale)}</h1>
      </header>
      <div class="stage ${locked ? "is-locked" : ""}">
        <div class="pane pane-ok">
          <canvas aria-label="${text.sideView} ${exerciseName(ex.id, locale)}"></canvas>
          <span class="pane-tag ok" hidden>${checkIcon}${text.correct}</span>
        </div>
        <div class="pane pane-bad" hidden>
          <canvas aria-label="${locale === "fa" ? "نمایش سه‌بعدی اجرای غلط" : locale === "tr" ? "Yanlış uygulama 3D görünümü" : "3D view of incorrect form"}"></canvas>
          <span class="pane-tag bad">✕ ${text.wrong}</span>
        </div>
        ${
					locked
						? `<div class="stage-lock"><p>${text.unlockText}</p><a class="btn btn-main" href="#/pro">${text.unlock}</a></div>`
						: `<p class="stage-hint">${text.drag}</p>`
				}
      </div>
      ${
				locked
					? ""
					: `<div class="controls" role="group" aria-label="${locale === "fa" ? "کنترل نمایش" : locale === "tr" ? "Görünüm kontrolleri" : "View controls"}">
              <button class="ctl" data-view="0">${text.front}</button>
              <button class="ctl" data-view="1.5708">${text.side}</button>
              <button class="ctl" data-view="3.1416">${text.back}</button>
              <button class="ctl" data-act="slow" aria-pressed="false">${text.slow}</button>
              <button class="ctl on" data-act="muscles" aria-pressed="true">${text.muscles}</button>
            </div>`
			}
      ${
				ex.wrong?.length && !locked
					? `<h2 class="h3 form-title">${text.compareTitle}</h2>
            <div class="form-switch" role="tablist" aria-label="${text.compareAria}">
              <button class="fs on" data-form="-1" role="tab" aria-selected="true">${checkIcon}${text.correctBtn}</button>
              ${ex.wrong.map((w, i) => `<button class="fs bad" data-form="${i}" role="tab" aria-selected="false">✕ ${w.label}</button>`).join("")}
            </div>
            <div class="form-note" hidden aria-live="polite"></div>`
					: ""
			}
      <div class="facts">
        <span>${EQUIP_NAME[ex.equip]}</span><span>${LEVEL[locale][ex.level]}</span>
        ${ex.muscles.map((m) => `<span class="m">${MUSCLE_NAME[m]}</span>`).join("")}
      </div>
      <p class="why">${ex.guide.why}</p>
      ${canLog ? logHTML() : ""}
      <div class="history-slot">${locked ? "" : historyHTML(ex)}</div>
      ${locked ? "" : guideHTML(ex)}
      ${
				alts.length
					? `<h2 class="h3">${text.alternatives}</h2>
             <ul class="alts">${alts
								.map(
									(a) =>
										`<li><a class="alt" href="#/ex/${a.id}"><canvas data-thumb="${a.id}" aria-hidden="true"></canvas><span>${exerciseName(a.id, locale)}</span>${a.premium && !isPremium() ? proBadge(locale) : ""}</a></li>`,
								)
								.join("")}</ul>`
					: ""
			}
      ${ex.timed ? `<p class="muted">${text.timed}</p>` : `<p class="muted">${text.sets}</p>`}
    </section>`;

	let mq2: ReturnType<typeof mountMannequin> | null = null;
	const mq = mountMannequin(
		$<HTMLCanvasElement>(".pane-ok canvas", root)!,
		ex.id,
		{
			interactive: !locked,
			spin: 0.35,
			onView: (y, p) => mq2?.setView(y, p),
		},
	);
	const thumbs = mountThumbs(
		$(".alts", root) ?? root.ownerDocument.createElement("div"),
	);

	root.addEventListener("click", (e) => {
		const t = (e.target as Element).closest<HTMLElement>(
			"[data-act],[data-view],[data-form],[data-step]",
		);
		if (!t) return;
		buzz();
		if (t.dataset.step) {
			const k = t.dataset.step as keyof typeof log;
			const d = Number(t.dataset.d);
			if (k === "sets") log.sets = Math.min(10, Math.max(1, log.sets + d));
			else if (k === "reps")
				log.reps = ex.timed
					? Math.min(600, Math.max(5, log.reps + d * 5))
					: Math.min(200, Math.max(1, log.reps + d));
			else
				log.kg = Math.max(
					0.5,
					Math.round((log.kg + d * (ex.equip === "barbell" ? 2.5 : 0.5)) * 2) / 2,
				);
			t.parentElement!.querySelector("output b")!.textContent = showLog(k);
			return;
		}
		if (t.dataset.act === "logopen") {
			$(".log-form", root)!.hidden = false;
			t.hidden = true;
			return;
		}
		if (t.dataset.act === "logsave" && prof) {
			// about three seconds a rep, and a short rest after every set
			const work = log.sets * (ex.timed ? log.reps : log.reps * 3);
			const minutes = Math.max(1, Math.round((work + log.sets * 45) / 60));
			update((st) => {
				st.sessions.push({
					date: dayKey(),
					ts: Date.now(),
					day: -1,
					minutes,
					sets: log.sets,
					feel: "ok",
					kcal: sessionKcal(prof, minutes),
					logs: Array.from({ length: log.sets }, (_, i) => ({
						id: ex.id,
						set: i + 1,
						reps: log.reps,
						kg: log.kg || undefined,
					})),
				});
				if (log.kg) st.loads[ex.id] = log.kg;
			});
			toast(text.logged, 2600);
			$(".log-form", root)!.hidden = true;
			$('[data-act="logopen"]', root)!.hidden = false;
			$(".history-slot", root)!.innerHTML = historyHTML(ex);
			return;
		}
		if (t.dataset.form) {
			const i = Number(t.dataset.form);
			const w = i >= 0 ? ex.wrong![i] : null;
			$$(".fs", root).forEach((b) => {
				b.classList.toggle("on", b === t);
				b.setAttribute("aria-selected", String(b === t));
			});
			const stage = $(".stage", root)!;
			stage.classList.toggle("split", !!w);
			$(".pane-bad", root)!.hidden = !w;
			$(".pane-tag.ok", root)!.hidden = !w;
			const note = $(".form-note", root)!;
			note.hidden = !w;
			if (w) {
				const m = ex.guide.mistakes[w.mistake];
				note.innerHTML = `<b>${m.m}</b><span>${m.fix}</span>`;
				$(".pane-tag.bad", root)!.textContent = `✕ ${w.label}`;
				mq2 ??= mountMannequin(
					$<HTMLCanvasElement>(".pane-bad canvas", root)!,
					ex.id,
					{
						interactive: true,
						onView: (y, p) => mq.setView(y, p),
					},
				);
				mq2.setAnimFocus(w.anim, w.focus);
				mq2.setView(...mq.getView());
				mq.setAnim(ex.anim, ex.muscles);
				mq.setView(...mq.getView());
				mq.restart();
				mq2.restart();
			} else mq.setAnim(ex.anim, ex.muscles);
			return;
		}
		if (t.dataset.view) {
			mq.view(-Number(t.dataset.view));
			return;
		}
		if (t.dataset.act === "back")
			history.length > 1 ? history.back() : go("#/library");
		if (t.dataset.act === "slow") {
			mq.speed = mq.speed === 1 ? 0.35 : 1;
			if (mq2) mq2.speed = mq.speed;
			t.classList.toggle("on", mq.speed !== 1);
			t.setAttribute("aria-pressed", String(mq.speed !== 1));
		}
		if (t.dataset.act === "muscles") {
			mq.showMuscles = !mq.showMuscles;
			t.classList.toggle("on", mq.showMuscles);
			t.setAttribute("aria-pressed", String(mq.showMuscles));
		}
	});

	return () => {
		mq.destroy();
		mq2?.destroy();
		thumbs();
	};
};
