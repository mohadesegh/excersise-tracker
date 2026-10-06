import type { Mannequin } from "../engine/mannequin";
import { REGIONS } from "../engine/regions";
import { getLocale } from "../i18n";
import { KIND_NAME, regionName, WHEN_NAME } from "../rehab";
import type { Pain, PainKind, PainRegion, PainWhen } from "../types";
import { buzz, fa } from "../utils";
import type { Cleanup } from "./ui";

/*
 * The body map: the user turns their own 3D body, taps where it hurts, and a
 * sheet asks how it hurts. Used in the questionnaire and on the corrective
 * moves page. Every region is also reachable from a plain list, for keyboard
 * and screen-reader users.
 */

const TEXT = {
	fa: {
		front: "جلو",
		back: "پشت",
		left: "چپ",
		right: "راست",
		hint: "بدنت را بچرخان و روی هر نقطه‌ای که درد دارد بزن.",
		list: "انتخاب از فهرست",
		kind: "چه‌جور دردی است؟",
		level: "شدت درد",
		of10: "از ۱۰",
		when: "کی بیشتر است؟",
		save: "ثبت",
		remove: "حذف",
		cancel: "انصراف",
		edit: "ویرایش",
	},
	en: {
		front: "Front",
		back: "Back",
		left: "Left",
		right: "Right",
		hint: "Turn your body and tap every spot that hurts.",
		list: "Choose from a list",
		kind: "What kind of pain is it?",
		level: "How strong",
		of10: "of 10",
		when: "When is it worst?",
		save: "Save",
		remove: "Remove",
		cancel: "Cancel",
		edit: "Edit",
	},
	tr: {
		front: "Ön",
		back: "Arka",
		left: "Sol",
		right: "Sağ",
		hint: "Vücudunu döndür ve ağrıyan her noktaya dokun.",
		list: "Listeden seç",
		kind: "Nasıl bir ağrı?",
		level: "Ağrının şiddeti",
		of10: "/ 10",
		when: "En çok ne zaman?",
		save: "Kaydet",
		remove: "Sil",
		cancel: "Vazgeç",
		edit: "Düzenle",
	},
} as const;

const KINDS: PainKind[] = ["ache", "stiff", "sharp", "radiating", "numb"];
const WHENS: PainWhen[] = ["move", "sitting", "morning", "night"];
/** yaw that brings each side of the body to the viewer; the body's left is on the viewer's right */
const VIEWS = { front: 0, right: Math.PI / 2, back: Math.PI, left: -Math.PI / 2 };

/** One line for a marked pain: "Sharp, 6 of 10, when moving". */
export function painLine(p: Pain): string {
	const locale = getLocale();
	const sep = locale === "fa" ? "، " : ", ";
	return [
		KIND_NAME[locale][p.kind],
		`${fa(p.level)} ${TEXT[locale].of10}`,
		WHEN_NAME[locale][p.when],
	].join(sep);
}

export const spotsOf = (pains: Pain[]): Partial<Record<PainRegion, number>> =>
	Object.fromEntries(pains.map((p) => [p.region, p.level]));

/**
 * Turns `mq` into a body map and renders its controls into `host`.
 * `pains` is edited in place; `onChange` runs after every edit.
 */
export function mountPainMap(
	host: HTMLElement,
	mq: Mannequin,
	pains: Pain[],
	onChange: () => void = () => {},
): Cleanup {
	const locale = getLocale();
	const t = TEXT[locale];
	let sheet: HTMLElement | null = null;

	host.innerHTML = `
    <div class="painmap">
      <div class="chips pm-views" role="group">
        ${(Object.keys(VIEWS) as (keyof typeof VIEWS)[])
					.map(
						(v) => `<button class="chip" data-pm-view="${v}">${t[v]}</button>`,
					)
					.join("")}
      </div>
      <p class="muted pm-hint">${t.hint}</p>
      <ul class="pm-list"></ul>
      <details class="pm-all">
        <summary>${t.list}</summary>
        <div class="pm-regions">${REGIONS.map(
					(r) =>
						`<button class="chip" data-pm-region="${r}">${regionName(r, locale)}</button>`,
				).join("")}</div>
      </details>
    </div>`;
	const list = host.querySelector<HTMLElement>(".pm-list")!;

	const paint = () => {
		mq.setSpots(spotsOf(pains));
		list.innerHTML = pains
			.map(
				(p) => `<li>
          <button class="pm-item" data-pm-region="${p.region}" aria-label="${t.edit} ${regionName(p.region, locale)}">
            <i style="--lv:${p.level}"></i>
            <span><b>${regionName(p.region, locale)}</b><small>${painLine(p)}</small></span>
          </button>
          <button class="icon-btn" data-pm-del="${p.region}" aria-label="${t.remove} ${regionName(p.region, locale)}">✕</button>
        </li>`,
			)
			.join("");
		host.querySelectorAll<HTMLElement>(".pm-regions .chip").forEach((c) => {
			c.classList.toggle(
				"on",
				pains.some((p) => p.region === c.dataset.pmRegion),
			);
		});
	};

	const closeSheet = () => {
		sheet?.remove();
		sheet = null;
	};

	const remove = (region: PainRegion) => {
		const k = pains.findIndex((p) => p.region === region);
		if (k >= 0) pains.splice(k, 1);
		paint();
		onChange();
	};

	function openSheet(region: PainRegion) {
		closeSheet();
		const old = pains.find((p) => p.region === region);
		const draft: Pain = old
			? { ...old }
			: { region, kind: "ache", level: 5, when: "move" };
		const chips = <K extends string>(
			group: string,
			keys: K[],
			names: Record<K, string>,
			cur: K,
		) =>
			`<div class="pm-chips" role="radiogroup">${keys
				.map(
					(k) =>
						`<button class="chip ${k === cur ? "on" : ""}" role="radio" aria-checked="${k === cur}" data-pm-${group}="${k}">${names[k]}</button>`,
				)
				.join("")}</div>`;
		const el = document.createElement("div");
		el.className = "pm-backdrop";
		el.innerHTML = `
      <div class="pm-sheet" role="dialog" aria-modal="true" aria-label="${regionName(region, locale)}">
        <h2 class="h2">${regionName(region, locale)}</h2>
        <p class="pm-label">${t.kind}</p>
        ${chips("kind", KINDS, KIND_NAME[locale], draft.kind)}
        <label class="pm-level">
          <span class="pm-label">${t.level}</span>
          <output>${fa(draft.level)} <small>${t.of10}</small></output>
          <input type="range" min="1" max="10" step="1" value="${draft.level}" aria-label="${t.level}">
        </label>
        <p class="pm-label">${t.when}</p>
        ${chips("when", WHENS, WHEN_NAME[locale], draft.when)}
        <div class="pm-actions">
          <button class="btn btn-main" data-pm-act="save">${t.save}</button>
          <button class="btn btn-quiet" data-pm-act="${old ? "remove" : "cancel"}">${old ? t.remove : t.cancel}</button>
        </div>
      </div>`;
		el.addEventListener("input", (e) => {
			const r = e.target as HTMLInputElement;
			draft.level = Number(r.value);
			el.querySelector("output")!.innerHTML =
				`${fa(draft.level)} <small>${t.of10}</small>`;
		});
		el.addEventListener("click", (e) => {
			const b = (e.target as Element).closest<HTMLElement>("button");
			if (!b) {
				// a tap on the dimmed background closes the sheet
				if (e.target === el) closeSheet();
				return;
			}
			buzz();
			const pick = (group: "kind" | "when", v: string) => {
				if (group === "kind") draft.kind = v as PainKind;
				else draft.when = v as PainWhen;
				b.parentElement!.querySelectorAll(".chip").forEach((c) => {
					c.classList.toggle("on", c === b);
					c.setAttribute("aria-checked", String(c === b));
				});
			};
			if (b.dataset.pmKind) return pick("kind", b.dataset.pmKind);
			if (b.dataset.pmWhen) return pick("when", b.dataset.pmWhen);
			const act = b.dataset.pmAct;
			closeSheet();
			if (act === "remove") return remove(region);
			if (act !== "save") return;
			const k = pains.findIndex((p) => p.region === region);
			if (k >= 0) pains[k] = draft;
			else pains.push(draft);
			paint();
			onChange();
		});
		el.addEventListener("keydown", (e) => {
			if (e.key === "Escape") closeSheet();
		});
		document.body.append(el);
		sheet = el;
		el.querySelector<HTMLElement>(".chip.on")?.focus({ preventScroll: true });
	}

	const onClick = (e: Event) => {
		const b = (e.target as Element).closest<HTMLElement>(
			"[data-pm-view],[data-pm-region],[data-pm-del]",
		);
		if (!b) return;
		// the questionnaire listens on a parent for its own buttons
		e.stopPropagation();
		buzz();
		if (b.dataset.pmView)
			mq.view(VIEWS[b.dataset.pmView as keyof typeof VIEWS]);
		else if (b.dataset.pmDel) remove(b.dataset.pmDel as PainRegion);
		else openSheet(b.dataset.pmRegion as PainRegion);
	};
	host.addEventListener("click", onClick);

	mq.onPick = (id) => {
		buzz();
		openSheet(id);
	};
	mq.view(VIEWS.front);
	paint();

	return () => {
		closeSheet();
		host.removeEventListener("click", onClick);
		mq.onPick = null;
		mq.setSpots(null);
	};
}
