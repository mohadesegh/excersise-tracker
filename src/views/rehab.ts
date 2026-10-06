import { shapeFor } from "../body";
import { A_POSE, exerciseName } from "../data/exercises";
import { getLocale } from "../i18n";
import { buildPlan } from "../planner";
import {
	limitsFromPains,
	needsDoctor,
	painAdvice,
	regionName,
	REHAB_TEXT,
	routineFor,
	routineMinutes,
	TIER_NAME,
} from "../rehab";
import { openBodyScan } from "../scan/scanner";
import { state, update } from "../store";
import type { Pain } from "../types";
import { $, buzz, dayKey, fa } from "../utils";
import { mountPainMap, painLine, spotsOf } from "./painmap";
import {
	backIcon,
	dose,
	mountMannequin,
	mountThumbs,
	toast,
	type Cleanup,
	type View,
} from "./ui";

/*
 * Corrective moves: the user's own 3D body with the painful spots marked,
 * what to do about each one, and today's routine.
 */

const TEXT = {
	fa: {
		back: "بازگشت",
		title: "حرکات اصلاحی",
		canvas: "بدن سه‌بعدی تو با نقاط درد؛ برای چرخاندن بکشید",
		emptyTitle: "کجای بدنت درد دارد؟",
		empty:
			"روی بدن سه‌بعدی خودت نقطه‌های درد را علامت بزن و بگو چه‌جور دردی است؛ برای هر کدام حرکت اصلاحی مناسب می‌گیری.",
		mark: "علامت زدن نقاط درد",
		today: "برنامه‌ی امروز",
		about: (moves: string, min: string) => `${moves} حرکت، حدود ${min} دقیقه`,
		doneToday: "امروز انجام شد",
		start: "شروع حرکات اصلاحی",
		again: "دوباره انجام بده",
		edit: "ویرایش نقاط درد",
		save: "ذخیره",
		cancel: "انصراف",
		saved: "ذخیره شد. برنامه‌ات هم با آن هماهنگ شد.",
		scan: "اسکن بدن با دوربین",
		rescan: "اسکن دوباره‌ی بدن",
		scanned: "اسکن شد. آدمک حالا اندازه‌های خودت را دارد.",
		daily: "هر روز یک بار، آرام و بدون درد.",
	},
	en: {
		back: "Back",
		title: "Corrective moves",
		canvas: "Your 3D body with the painful spots; drag to rotate",
		emptyTitle: "Where does your body hurt?",
		empty:
			"Mark the painful spots on your own 3D body and say what kind of pain it is; you get the right corrective moves for each.",
		mark: "Mark painful spots",
		today: "Today's routine",
		about: (moves: string, min: string) => `${moves} moves, about ${min} minutes`,
		doneToday: "Done today",
		start: "Start corrective moves",
		again: "Do it again",
		edit: "Edit painful spots",
		save: "Save",
		cancel: "Cancel",
		saved: "Saved. Your plan was adjusted to match.",
		scan: "Scan your body with the camera",
		rescan: "Scan your body again",
		scanned: "Scanned. The figure now has your measurements.",
		daily: "Once a day, slowly and without pain.",
	},
	tr: {
		back: "Geri",
		title: "Düzeltici hareketler",
		canvas: "Ağrı noktalarıyla 3D vücudun; döndürmek için sürükle",
		emptyTitle: "Vücudunun neresi ağrıyor?",
		empty:
			"Kendi 3D vücudunun üzerinde ağrıyan noktaları işaretle ve nasıl bir ağrı olduğunu söyle; her biri için uygun düzeltici hareketleri alırsın.",
		mark: "Ağrı noktalarını işaretle",
		today: "Bugünün programı",
		about: (moves: string, min: string) => `${moves} hareket, yaklaşık ${min} dakika`,
		doneToday: "Bugün yapıldı",
		start: "Düzeltici hareketlere başla",
		again: "Tekrar yap",
		edit: "Ağrı noktalarını düzenle",
		save: "Kaydet",
		cancel: "Vazgeç",
		saved: "Kaydedildi. Programın da buna göre ayarlandı.",
		scan: "Vücudunu kamerayla tara",
		rescan: "Vücudunu yeniden tara",
		scanned: "Tarandı. Figür artık senin ölçülerinde.",
		daily: "Günde bir kez, yavaşça ve ağrısız.",
	},
} as const;

export const rehabDoneToday = (): boolean =>
	!!state.rehabDays?.includes(dayKey());

export const rehabView: View = (root) => {
	const locale = getLocale();
	const t = TEXT[locale];
	const rt = REHAB_TEXT[locale];
	const prof = state.profile!;
	let editing: Pain[] | null = null;
	let offMap: Cleanup | null = null;
	let offThumbs: Cleanup = () => {};
	let closeScan: Cleanup | null = null;

	root.innerHTML = `
    <section class="rehab">
      <header class="detail-top">
        <a class="icon-btn" href="#/today" aria-label="${t.back}">${backIcon}</a>
        <h1 class="h2">${t.title}</h1>
      </header>
      <div class="rehab-stage"><canvas aria-label="${t.canvas}"></canvas></div>
      <div class="rehab-body"></div>
    </section>`;
	const body = $(".rehab-body", root)!;
	const mq = mountMannequin($<HTMLCanvasElement>("canvas", root)!, "squat", {
		interactive: true,
		spin: 0.3,
	});
	mq.setAnim(A_POSE);
	// open on the side of the body where the worst pain is, then keep turning slowly
	const worst = [...(prof.pains ?? [])].sort((a, b) => b.level - a.level)[0];
	if (worst && /^(neck|upperBack|lowerBack)$/.test(worst.region)) {
		mq.view(Math.PI);
		mq.spinAgain();
	}

	function paint() {
		offMap?.();
		offMap = null;
		offThumbs();
		offThumbs = () => {};

		if (editing) {
			body.innerHTML = `<div class="pm-host"></div>
        <div class="row">
          <button class="btn btn-main" data-act="save">${t.save}</button>
          <button class="btn btn-quiet" data-act="cancel">${t.cancel}</button>
        </div>`;
			offMap = mountPainMap($(".pm-host", body)!, mq, editing);
			return;
		}

		const pains = prof.pains ?? [];
		// in reading mode the marks are shown and a tap on the body opens the editor
		mq.setSpots(spotsOf(pains));
		mq.onPick = () => edit();
		const scanBtn = `<button class="btn btn-quiet" data-act="scan">📷 ${prof.scan ? t.rescan : t.scan}</button>`;

		if (!pains.length) {
			body.innerHTML = `
        <h2 class="h3">${t.emptyTitle}</h2>
        <p class="muted">${t.empty}</p>
        <button class="btn btn-main" data-act="edit">${t.mark}</button>
        ${scanBtn}
        <p class="fineprint">${rt.disclaimer}</p>`;
			return;
		}

		const steps = routineFor(pains);
		const done = rehabDoneToday();
		body.innerHTML = `
      ${pains.some(needsDoctor) ? `<p class="safety" role="note">${rt.doctor}</p>` : ""}
      <ul class="pain-cards">${pains
				.map(
					(p) => `<li>
            <i style="--lv:${p.level}"></i>
            <div><b>${regionName(p.region, locale)}</b><small>${painLine(p)}</small>
            <p>${painAdvice(p, locale)}</p></div>
          </li>`,
				)
				.join("")}</ul>

      <h2 class="h3">${t.today}${done ? ` <span class="rehab-done">✓ ${t.doneToday}</span>` : ""}</h2>
      <p class="muted">${t.about(fa(steps.length), fa(routineMinutes(steps)))}. ${t.daily}</p>
      <ul class="ex-list">${steps
				.map(
					(s) => `<li><a class="ex-row" href="#/ex/${s.id}">
            <canvas class="thumb" data-thumb="${s.id}" aria-hidden="true"></canvas>
            <span class="ex-row-name">${exerciseName(s.id, locale)}<small class="tier tier-${s.tier}">${TIER_NAME[locale][s.tier]}</small></span>
            <span class="ex-row-dose">${dose(s.secs, true)}</span></a></li>`,
				)
				.join("")}</ul>
      <a class="btn btn-main" href="#/workout/rehab">${done ? t.again : t.start}</a>
      <button class="btn btn-ghost" data-act="edit">${t.edit}</button>
      ${scanBtn}
      <p class="fineprint">${rt.redFlags}</p>
      <p class="fineprint">${rt.disclaimer}</p>`;
		offThumbs = mountThumbs(body);
	}

	function edit() {
		editing = (prof.pains ?? []).map((p) => ({ ...p }));
		paint();
	}

	function save() {
		const pains = editing!;
		editing = null;
		update((s) => {
			const p = s.profile!;
			const before = [...p.limits].sort().join();
			p.pains = pains;
			p.limits = limitsFromPains(pains);
			// the training plan leaves out moves that load a painful area
			if ([...p.limits].sort().join() !== before)
				s.plan = buildPlan(p, s.plan?.cycle ?? 0);
		});
		toast(t.saved);
		mq.spinAgain();
		paint();
	}

	root.addEventListener("click", (e) => {
		const b = (e.target as Element).closest<HTMLElement>("[data-act]");
		if (!b) return;
		buzz();
		switch (b.dataset.act) {
			case "edit":
				return edit();
			case "save":
				return save();
			case "cancel":
				editing = null;
				mq.spinAgain();
				return paint();
			case "scan":
				closeScan = openBodyScan({
					who: prof,
					onDone: (scan) => {
						closeScan = null;
						update((s) => (s.profile!.scan = scan));
						mq.setBody(shapeFor(prof));
						toast(t.scanned);
						paint();
					},
				});
		}
	});

	paint();
	return () => {
		offMap?.();
		offThumbs();
		closeScan?.();
		mq.destroy();
	};
};
