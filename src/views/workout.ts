import { sessionKcal } from "../body";
import { EX, exerciseName } from "../data/exercises";
import { cooldownFor, progressionDelta, resolve, warmupFor } from "../planner";
import {
	applyLoads,
	isLoaded,
	repRange,
	setsThisWeek,
	todayKg,
	weekInfo,
} from "../progression";
import { isPremium, state, update } from "../store";
import type { Exercise, Feel, SetLog } from "../types";
import { $, beep, buzz, dayKey, fa, go } from "../utils";
import { guideHTML } from "./library";
import { hasAnalyzer } from "../formcheck/analyzers";
import { openFormCheck } from "../formcheck/camera";
import {
	checkIcon,
	dose,
	kgText,
	mountMannequin,
	toast,
	type View,
} from "./ui";
import {
	onVoiceChange,
	say,
	setVoice,
	stop as stopVoice,
	voiceEnabledPref,
	voiceEngine,
	voiceOn,
	words,
} from "../voice";
import { doseLine, lines, LINES, restLine, setLine } from "../voiceLines";
import { getLocale, setLocale } from "../i18n";

type Section = "warmup" | "main" | "cooldown";
interface Step {
	ex: Exercise;
	section: Section;
	sets: number;
	reps: number;
	timed: boolean;
	rest: number;
}
type Phase = "ready" | "work" | "rest" | "feel";


const localeText = (locale: "fa" | "en" | "tr") => ({
	quit:
		locale === "fa"
			? "خروج از تمرین"
			: locale === "tr"
				? "Antrenmandan çık"
				: "Exit workout",
	voice:
		locale === "fa"
			? "راهنمای صوتی"
			: locale === "tr"
				? "Sesli rehber"
				: "Voice guide",
	canvas:
		locale === "fa"
			? "نمایش سه‌بعدی حرکت؛ برای چرخاندن بکشید"
			: locale === "tr"
				? "Hareketin 3D gösterimi; döndürmek için sürükleyin"
				: "3D motion preview; drag to rotate",
	sec: locale === "fa" ? "ثانیه" : locale === "tr" ? "sn" : "sec",
	rest: locale === "fa" ? "استراحت" : locale === "tr" ? "Dinlenme" : "Rest",
	complete:
		locale === "fa"
			? "تمام شد. این جلسه چطور بود؟"
			: locale === "tr"
				? "Bitti. Bu seans nasıl geçti?"
				: "Done. How was this session?",
	next:
		locale === "fa"
			? "حرکت بعدی"
			: locale === "tr"
				? "Sonraki hareket"
				: "Next move",
	skip: locale === "fa" ? "رد شدن از" : locale === "tr" ? "Atla:" : "Skip:",
	ready:
		locale === "fa" ? "آماده‌ام" : locale === "tr" ? "Hazırım" : "I’m ready",
	more15:
		locale === "fa"
			? "۱۵ ثانیه بیشتر"
			: locale === "tr"
				? "15 saniye daha"
				: "+15 seconds",
	guide:
		locale === "fa"
			? "راهنمای کامل حرکت"
			: locale === "tr"
				? "Hareketin tam rehberi"
				: "Full movement guide",
	easy: locale === "fa" ? "راحت" : locale === "tr" ? "Kolay" : "Easy",
	ok: locale === "fa" ? "مناسب" : locale === "tr" ? "Uygun" : "Good",
	hard: locale === "fa" ? "سخت" : locale === "tr" ? "Zor" : "Hard",
	setPrefix: locale === "fa" ? "ست" : locale === "tr" ? "Set" : "Set",
	done: locale === "fa" ? "تمام شد" : locale === "tr" ? "Bitti" : "Done",
	start: locale === "fa" ? "شروع" : locale === "tr" ? "Başla" : "Start",
	warmup: locale === "fa" ? "گرم کردن" : locale === "tr" ? "Isınma" : "Warm-up",
	cooldown:
		locale === "fa"
			? "سرد کردن و کشش"
			: locale === "tr"
				? "Soğutma ve esneme"
				: "Cool-down & stretch",
	main:
		locale === "fa"
			? "تمرین اصلی"
			: locale === "tr"
				? "Ana antrenman"
				: "Main workout",
	withKg: locale === "fa" ? "با" : locale === "tr" ? "ile" : "with",
	proNote:
		locale === "fa"
			? "وزنه‌ها و تکرارهای جلسه‌ی بعد بر اساس جوابت تنظیم می‌شود."
			: locale === "tr"
				? "Bir sonraki seansın ağırlıkları ve tekrarları verdiğin cevaplara göre ayarlanacak."
				: "Your next session loads and reps will be adjusted based on your feedback.",
	premiumNote:
		locale === "fa"
			? "با اشتراک ویژه، وزنه و تکرار جلسه‌ی بعد خودکار تنظیم می‌شود."
			: locale === "tr"
				? "Özel üyelikle bir sonraki seanstaki ağırlık ve tekrar otomatik ayarlanır."
				: "With premium, the next session weight and reps are adjusted automatically.",
	autoAdjust:
		locale === "fa"
			? "به‌روزرسانی خودکار"
			: locale === "tr"
				? "Otomatik ayar"
				: "Auto-adjust",
	setLabel: locale === "fa" ? "ست" : locale === "tr" ? "Set" : "Set",
	repDone:
		locale === "fa"
			? "تکرار انجام‌شده"
			: locale === "tr"
				? "Yapılan tekrar"
				: "Reps done",
	kgLabel: locale === "fa" ? "کیلو" : locale === "tr" ? "kg" : "kg",
	clickToStart: locale === "fa" ? "شروع" : locale === "tr" ? "Başla" : "Start",
	pass:
		locale === "fa"
			? "رد شدن از حرکت"
			: locale === "tr"
				? "Hareketi atla"
				: "Skip move",
	cameraLabel:
		locale === "fa"
			? "بررسی فرم و شمارش با دوربین"
			: locale === "tr"
				? "Kamera ile form ve sayımı kontrol et"
				: "Check form and count with camera",
	platform: locale === "fa" ? "ویژه" : locale === "tr" ? "Özel" : "Premium",
	voiceUnavailable:
		locale === "fa"
			? "صدای فارسی روی این دستگاه نیست. با اتصال اپ به سرور، صدای فارسی ابری فعال می‌شود."
			: locale === "tr"
				? "Bu cihazda Türkçe ses yok. Uygulama sunucuya bağlandığında bulut sesi etkinleşir."
				: "No English voice is available on this device. Cloud voice will activate once the app connects to the server.",
	voiceOn:
		locale === "fa"
			? "راهنمای صوتی روشن شد"
			: locale === "tr"
				? "Sesli rehber açıldı"
				: "Voice guide enabled",
	quitConfirm:
		locale === "fa"
			? "تمرین نیمه‌کاره ذخیره نمی‌شود. خارج می‌شوی؟"
			: locale === "tr"
				? "Yarı bitmiş antrenman kaydedilmez. Çıkmak ister misin?"
				: "This unfinished workout will not be saved. Leave?",
	progressSaved:
		locale === "fa"
			? "پیشرفت! جلسه‌ی بعد حرکت بعدی با وزن بیشتر"
			: locale === "tr"
				? "İlerleme! Bir sonraki hareket daha ağır bir ağırlıkla başlıyor"
				: "Nice progress! The next move starts heavier",
	saved:
		locale === "fa"
			? "ذخیره شد. آفرین!"
			: locale === "tr"
				? "Kaydedildi. Tebrikler!"
				: "Saved. Nice!",
	exerciseCount: locale === "fa" ? "از" : locale === "tr" ? "/" : "of",
});

export const workoutView: View = (root, params) => {
	const locale = getLocale();
	setLocale(locale);
	const plan = state.plan!;
	const prof = state.profile!;
	const dayIdx = Number(params[0]);
	const day = plan.days[dayIdx];
	const pro = isPremium();
	if (!day || (day.premiumOnly && !pro)) {
		go("#/pro");
		return;
	}
	const wk = weekInfo(plan);

	const steps: Step[] = [
		...warmupFor(day, prof).map(
			(w): Step => ({
				ex: EX[w.id],
				section: "warmup",
				sets: 1,
				reps: w.secs,
				timed: true,
				rest: 0,
			}),
		),
		...day.items.map((item): Step => {
			const { ex } = resolve(item, pro);
			const reps = Math.max(
				item.timed ? 10 : 4,
				item.reps + (pro && !isLoaded(ex) ? (state.adjust[ex.id] ?? 0) : 0),
			);
			return {
				ex,
				section: "main",
				sets: setsThisWeek(item.sets, wk),
				reps,
				timed: item.timed,
				rest: item.rest,
			};
		}),
		...cooldownFor(day, prof).map(
			(c): Step => ({
				ex: EX[c.id],
				section: "cooldown",
				sets: 1,
				reps: c.secs,
				timed: true,
				rest: 0,
			}),
		),
	];

	let si = 0;
	let set = 1;
	let phase: Phase = "ready";
	let left = 0;
	let restSec = 30;
	let tick = 0;
	let kg = 0;
	let reps = 0;
	const logs: SetLog[] = [];
	/** seconds held, as measured by the camera (plank) */
	let camHold: number | null = null;
	let closeCam: (() => void) | null = null;
	const started = Date.now();
	let wake: { release(): Promise<void> } | null = null;

	const t = localeText(locale);
	const text = t;
	const L = LINES[locale];
	const sep = locale === "fa" ? "، " : ", ";

	root.innerHTML = `
    <section class="player">
      <header class="player-top">
        <button class="icon-btn" data-act="quit" aria-label="${t.quit}">✕</button>
        <div class="player-progress" aria-hidden="true"><i></i></div>
        <span class="player-count"></span>
        <button class="icon-btn voice-btn" data-act="voice" aria-pressed="${voiceOn()}" aria-label="${t.voice}">${voiceOn() ? "🔊" : "🔇"}</button>
      </header>
      <div class="player-stage"><canvas aria-label="${t.canvas}"></canvas><div class="ring" hidden></div></div>
      <div class="player-body" aria-live="polite"></div>
    </section>`;

	const mq = mountMannequin(
		$<HTMLCanvasElement>("canvas", root)!,
		steps[0].ex.id,
		{ interactive: true, spin: 0.25 },
	);
	const body = $(".player-body", root)!;
	const ring = $(".ring", root)!;

	(
		navigator as Navigator & {
			wakeLock?: {
				request(t: "screen"): Promise<{ release(): Promise<void> }>;
			};
		}
	).wakeLock
		?.request("screen")
		.then((w) => (wake = w))
		.catch(() => {});

	const totalSets = steps.reduce((a, s) => a + s.sets, 0);
	let doneSets = 0;

	function setRing(sec: number, total: number) {
		ring.hidden = false;
		ring.style.setProperty("--p", String(Math.min(1, sec / total)));
		ring.innerHTML = `<b>${fa(sec)}</b><small>${t.sec}</small>`;
	}

	function countdown(sec: number, onEnd: () => void) {
		clearInterval(tick);
		left = sec;
		const total = sec;
		setRing(left, total);
		tick = window.setInterval(() => {
			left--;
			if (left === 10 && total >= 20) say(L.tenLeft);
			if (left <= 3 && left > 0) {
				if (voiceOn()) say(words(left), { force: true });
				else beep(660, 90);
			}
			if (left <= 0) {
				clearInterval(tick);
				beep(990, 220);
				buzz(60);
				onEnd();
			} else setRing(left, total);
		}, 1000);
	}

	/** Called whenever a new exercise starts: preload today's weight and target reps. */
	function enterStep() {
		const s = steps[si];
		set = 1;
		reps = s.reps;
		kg = isLoaded(s.ex) && s.section === "main" ? todayKg(s.ex, prof, wk) : 0;
		// warm-up and stretches run hands-free
		phase = s.section === "main" ? "ready" : "work";
	}

	// the guide stays open across sets once the user opens it
	let guideOpen = false;
	const guideBlock = (ex: Exercise) => `
    <details class="player-guide" ${guideOpen ? "open" : ""}>
      <summary><span>${t.guide}</span><span class="chev" aria-hidden="true"></span></summary>
      ${guideHTML(ex)}
    </details>`;
	const bindGuide = () =>
		$<HTMLDetailsElement>(".player-guide", body)?.addEventListener(
			"toggle",
			(e) => {
				guideOpen = (e.target as HTMLDetailsElement).open;
			},
		);

	const stepper = (k: "kg" | "reps", label: string, value: string) => `
    <div class="stepper" role="group" aria-label="${label}">
      <button data-step="${k}" data-d="-1" aria-label="${locale === "fa" ? "کم کردن" : locale === "tr" ? "Azalt" : "Decrease"} ${label}">−</button>
      <output><b>${value}</b><small>${label}</small></output>
      <button data-step="${k}" data-d="1" aria-label="${locale === "fa" ? "زیاد کردن" : locale === "tr" ? "Arttır" : "Increase"} ${label}">+</button>
    </div>`;

	let spokenKey = "";
	/** Speak once per new situation (exercise, set, phase), never on plain re-renders. */
	function announce() {
		const s = steps[si];
		const key = `${si}-${set}-${phase}`;
		if (key === spokenKey) return;
		spokenKey = key;
		const name = exerciseName(s.ex.id, locale);
		if (phase === "feel") return void say(L.finished);
		if (phase === "rest") return void say(restLine(restSec, name, locale));
		if (s.section !== "main") {
			const first = si === 0 || steps[si - 1].section !== s.section;
			return void say(
				lines(
					first && L[s.section],
					name,
					doseLine(s.reps, true, 0, locale),
					s.ex.guide.cues[0],
				),
			);
		}
		if (phase === "work") return void say(L.go);
		say(
			lines(
				set === 1 && name,
				setLine(set, s.sets, locale),
				doseLine(s.reps, s.timed, kg, locale),
				s.ex.guide.cues[(set - 1) % s.ex.guide.cues.length],
			),
		);
	}

	const sectionName = (section: Section) =>
		section === "warmup" ? t.warmup : section === "main" ? t.main : t.cooldown;

	function render() {
		announce();
		const s = steps[si];
		$(".player-count", root)!.textContent =
			`${fa(si + 1)} ${t.exerciseCount} ${fa(steps.length)}`;
		$<HTMLElement>(".player-progress i", root)!.style.width =
			`${(doneSets / totalSets) * 100}%`;
		ring.hidden = true;
		clearInterval(tick);

		if (phase === "feel") {
			body.innerHTML = `
        <h1 class="h1">${t.complete}</h1>
        <p class="muted">${pro ? t.proNote : t.premiumNote}</p>
        <div class="feel">
          <button class="opt" data-feel="easy"><span class="opt-emoji">😌</span><span class="opt-label">${t.easy}</span></button>
          <button class="opt" data-feel="ok"><span class="opt-emoji">🙂</span><span class="opt-label">${t.ok}</span></button>
          <button class="opt" data-feel="hard"><span class="opt-emoji">🥵</span><span class="opt-label">${t.hard}</span></button>
        </div>`;
			return;
		}

		if (phase === "rest") {
			body.innerHTML = `
        <p class="muted">${t.rest}</p>
        <h1 class="h1">${locale === "fa" ? "بعدی:" : locale === "tr" ? "Sonraki:" : "Next:"} ${exerciseName(s.ex.id, locale)}</h1>
        <p class="cue">${t.setLabel} ${fa(set)} / ${fa(s.sets)}${sep}${dose(s.reps, s.timed)}${kg ? `${sep}${kgText(kg)}` : ""}</p>
        <div class="row">
          <button class="btn btn-main" data-act="restskip">${t.ready}</button>
          <button class="btn btn-quiet" data-act="more">${t.more15}</button>
        </div>`;
			mq.setAnim(s.ex.anim, s.ex.muscles);
			countdown(restSec, () => {
				phase = "ready";
				render();
			});
			return;
		}

		mq.setAnim(s.ex.anim, s.ex.muscles);
		$(".player-stage", root)!.classList.remove("is-wrong");
		const section = `<p class="section-tag section-${s.section}">${sectionName(s.section)}${s.section === "main" && wk.deload ? (locale === "fa" ? "، هفته‌ی سبک" : locale === "tr" ? ", hafif hafta" : ", deload week") : ""}</p>`;

		if (s.section !== "main") {
			const lastOfSection =
				!steps[si + 1] || steps[si + 1].section !== s.section;
			body.innerHTML = `
        ${section}
        <h1 class="h1">${exerciseName(s.ex.id, locale)}</h1>
        <p class="cue">${checkIcon}<span>${s.ex.guide.cues[0]}</span></p>
        <div class="row">
          <button class="btn btn-ghost" data-act="next">${lastOfSection ? t.done : t.next}</button>
          <button class="btn btn-quiet" data-act="skipsection">${t.skip} ${sectionName(s.section)}</button>
        </div>
        ${guideBlock(s.ex)}`;
			bindGuide();
			countdown(s.reps, finishSet);
			return;
		}

		const timedRunning = phase === "work" && s.timed;
		const logger = s.timed
			? ""
			: `<div class="logger">
          ${kg ? stepper("kg", t.kgLabel, fa(String(kg).replace(".", "٫"))) : ""}
          ${stepper("reps", t.repDone, fa(reps))}
        </div>
        ${kg && !state.loads[s.ex.id] ? `<p class="muted small">${locale === "fa" ? `اولین بار است؟ وزنی بردار که با آن بتوانی ${fa(repRange(prof.goal)[1])} تکرار تمیز بزنی.` : locale === "tr" ? `İlk kez mi? ${fa(repRange(prof.goal)[1])} temiz tekrar yapabileceğin bir ağırlık seç.` : `First time? Pick a weight you can lift for ${fa(repRange(prof.goal)[1])} clean reps.`}</p>` : ""}`;

		body.innerHTML = `
      ${section}
      <p class="muted">${t.setLabel} ${fa(set)} ${locale === "fa" ? "از" : locale === "tr" ? "/" : "of"} ${fa(s.sets)}</p>
      <h1 class="h1">${exerciseName(s.ex.id, locale)}</h1>
      <p class="big-dose">${dose(s.reps, s.timed)}${kg ? `<small> ${locale === "tr" ? `${kgText(kg)} ${t.withKg}` : `${t.withKg} ${kgText(kg)}`}</small>` : ""}</p>
      <p class="cue">${checkIcon}<span>${s.ex.guide.cues[(set - 1) % s.ex.guide.cues.length]}</span></p>
      ${
				s.ex.wrong?.length
					? `<div class="form-switch compact">${s.ex.wrong
							.map(
								(w, i) =>
									`<button class="fs bad" data-wrong="${i}" aria-pressed="false">✕ ${w.label}</button>`,
							)
							.join("")}</div>`
					: ""
			}
      ${
				hasAnalyzer(s.ex.id)
					? `<button class="btn btn-ghost cam-btn" data-act="camera">📷 ${t.cameraLabel}${pro ? "" : ` <span class="pro-badge">${t.platform}</span>`}</button>`
					: ""
			}
      ${logger}
      <div class="row">
        ${
					s.timed && !timedRunning
						? `<button class="btn btn-main" data-act="go">${locale === "tr" ? `${fa(s.reps)} ${t.sec} ${t.clickToStart}` : `${t.clickToStart} ${fa(s.reps)} ${t.sec}`}</button>`
						: timedRunning
							? `<button class="btn btn-ghost" data-act="setdone">${t.done}</button>`
							: `<button class="btn btn-main" data-act="setdone">${locale === "fa" ? "ثبت ست" : locale === "tr" ? "Seti kaydet" : "Log set"}</button>`
				}
        <button class="btn btn-quiet" data-act="skip">${t.pass}</button>
      </div>
      ${guideBlock(s.ex)}`;
		bindGuide();
		if (timedRunning) countdown(s.reps, finishSet);
	}

	function finishSet() {
		const s = steps[si];
		doneSets++;
		if (s.section === "main")
			logs.push({
				id: s.ex.id,
				set,
				reps: s.timed ? (camHold ?? s.reps) : reps,
				kg: kg || undefined,
			});
		camHold = null;
		if (set < s.sets) {
			set++;
			reps = s.reps;
			phase = "rest";
			restSec = s.rest;
			render();
			return;
		}
		advance(s.section === "main" && steps[si + 1]?.section === "main");
	}

	function advance(withRest: boolean) {
		const s = steps[si];
		if (si >= steps.length - 1) {
			phase = "feel";
			render();
			return;
		}
		si++;
		enterStep();
		if (withRest) {
			phase = "rest";
			restSec = s.rest;
		}
		render();
	}

	function skipSection() {
		const sec = steps[si].section;
		while (si < steps.length && steps[si].section === sec) {
			doneSets += steps[si].sets;
			si++;
		}
		if (si >= steps.length) {
			si = steps.length - 1;
			phase = "feel";
		} else enterStep();
		render();
	}

	function save(feel: Feel) {
		const minutes = Math.max(1, Math.round((Date.now() - started) / 60000));
		let changes: ReturnType<typeof applyLoads> = [];
		update((st) => {
			const session = {
				date: dayKey(),
				ts: Date.now(),
				day: dayIdx,
				minutes,
				sets: logs.length,
				feel,
				kcal: sessionKcal(st.profile!, minutes),
				logs,
			};
			st.sessions.push(session);
			changes = applyLoads(session, prof.goal, wk);
			if (pro && !wk.deload)
				for (const s of steps)
					if (s.section === "main" && !isLoaded(s.ex)) {
						const d = progressionDelta(feel, s.timed);
						st.adjust[s.ex.id] = Math.max(
							-8,
							Math.min(30, (st.adjust[s.ex.id] ?? 0) + d),
						);
					}
		});
		const up = changes.filter((c) => c.to > c.from);
		toast(
			up.length
				? locale === "fa"
					? `پیشرفت! جلسه‌ی بعد ${exerciseName(up[0].id, locale)} با ${kgText(up[0].to)}`
					: locale === "tr"
						? `İlerleme! Sonraki seansta ${exerciseName(up[0].id, locale)}: ${kgText(up[0].to)}`
						: `Nice progress! Next session ${exerciseName(up[0].id, locale)} at ${kgText(up[0].to)}`
				: locale === "fa"
					? "ذخیره شد. آفرین!"
					: locale === "tr"
						? "Kaydedildi. Tebrikler!"
						: "Saved. Nice!",
		);
		go("#/progress");
	}

	root.addEventListener("click", (e) => {
		const t = (e.target as Element).closest<HTMLElement>(
			"[data-act],[data-feel],[data-step],[data-wrong]",
		);
		if (!t) return;
		buzz();
		if (t.dataset.wrong) {
			// preview a common mistake on the stage; tap again to return to correct form
			const s = steps[si];
			const on = t.getAttribute("aria-pressed") !== "true";
			body.querySelectorAll("[data-wrong]").forEach((b) => {
				b.setAttribute("aria-pressed", "false");
				b.classList.remove("on");
			});
			const stage = $(".player-stage", root)!;
			stage.classList.toggle("is-wrong", on);
			if (on) {
				t.setAttribute("aria-pressed", "true");
				t.classList.add("on");
				const w = s.ex.wrong![Number(t.dataset.wrong)];
				mq.setAnimFocus(w.anim, w.focus);
				toast(
					locale === "fa"
						? `اصلاح: ${s.ex.guide.mistakes[w.mistake].fix}`
						: locale === "tr"
							? `Düzeltme: ${s.ex.guide.mistakes[w.mistake].fix}`
							: `Fix: ${s.ex.guide.mistakes[w.mistake].fix}`,
				);
			} else mq.setAnim(s.ex.anim, s.ex.muscles);
			return;
		}
		if (t.dataset.feel) return save(t.dataset.feel as Feel);
		if (t.dataset.step) {
			const d = Number(t.dataset.d);
			const s = steps[si];
			if (t.dataset.step === "kg")
				kg = Math.max(
					0.5,
					Math.round((kg + d * (s.ex.equip === "barbell" ? 2.5 : 0.5)) * 2) / 2,
				);
			else reps = Math.max(0, reps + d);
			const out = t.parentElement!.querySelector("output b")!;
			out.textContent =
				t.dataset.step === "kg" ? fa(String(kg).replace(".", "٫")) : fa(reps);
			return;
		}
		switch (t.dataset.act) {
			case "voice": {
				if (!voiceEngine()) {
					toast(text.voiceUnavailable);
					break;
				}
				setVoice(!voiceEnabledPref());
				t.textContent = voiceOn() ? "🔊" : "🔇";
				t.setAttribute("aria-pressed", String(voiceOn()));
				if (voiceOn()) say(L.voiceOn, { force: true });
				break;
			}
			case "camera": {
				if (!pro) {
					go("#/pro");
					break;
				}
				const s = steps[si];
				clearInterval(tick);
				closeCam = openFormCheck({
					ex: s.ex,
					target: s.reps,
					onDone: (n) => {
						closeCam = null;
						if (s.timed) camHold = n;
						else reps = n;
						finishSet();
					},
				});
				break;
			}
			case "quit":
				if (
					logs.length === 0 ||
					confirm(
						locale === "fa"
							? "تمرین نیمه‌کاره ذخیره نمی‌شود. خارج می‌شوی؟"
							: locale === "tr"
								? "Yarı bitmiş antrenman kaydedilmez. Çıkmak ister misin?"
								: "This unfinished workout will not be saved. Leave?",
					)
				)
					go("#/today");
				break;
			case "go":
				phase = "work";
				render();
				break;
			case "setdone":
			case "next":
				finishSet();
				break;
			case "skip":
				doneSets += steps[si].sets - set + 1;
				advance(false);
				break;
			case "skipsection":
				skipSection();
				break;
			case "restskip":
				phase = "ready";
				render();
				break;
			case "more":
				left += 15;
				break;
		}
	});

	// voices often load after the first render: keep the speaker button honest
	const offVoice = onVoiceChange(() => {
		const btn = $<HTMLButtonElement>(".voice-btn", root);
		if (!btn) return;
		btn.textContent = voiceOn() ? "🔊" : "🔇";
		btn.setAttribute("aria-pressed", String(voiceOn()));
	});

	enterStep();
	render();
	return () => {
		offVoice();
		clearInterval(tick);
		closeCam?.();
		stopVoice();
		mq.destroy();
		wake?.release().catch(() => {});
	};
};
