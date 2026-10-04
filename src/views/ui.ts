import { shapeFor } from "../body";
import { EX } from "../data/exercises";
import {
	getLocale,
	localeOptions,
	setLocale,
	type Locale,
} from "../i18n";
import { state } from "../store";
import { Mannequin, type MannequinOptions } from "../engine/mannequin";
import { fa } from "../utils";

export type Cleanup = () => void;
export type View = (
	root: HTMLElement,
	params: string[],
	query: URLSearchParams,
) => Cleanup | void;

export const lockIcon = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="4.5" y="10" width="15" height="11" rx="3" fill="currentColor"/></svg>`;
export const backIcon = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const checkIcon = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const proBadge = (locale: Locale = getLocale()): string => {
	const label = locale === "fa" ? "ویژه" : locale === "tr" ? "Özel" : "Premium";
	return `<span class="pro-badge">${lockIcon}${label}</span>`;
};

export const dose = (
	reps: number,
	timed: boolean,
	sets?: number,
	locale: Locale = getLocale(),
): string => {
	const unit = timed
		? locale === "fa"
			? "ثانیه"
			: locale === "tr"
				? "sn"
				: "sec"
		: locale === "fa"
			? "تکرار"
			: locale === "tr"
				? "tekrar"
				: "reps";
	return `${sets ? `${fa(sets)} × ` : ""}${fa(reps)} ${unit}`;
};

/** Weight in kilograms with its unit, in the current language. */
export const kgText = (kg: number, locale: Locale = getLocale()): string =>
	`${fa(String(kg).replace(".", "٫"))} ${locale === "fa" ? "کیلو" : "kg"}`;

export function langSwitcherHTML(locale: Locale = getLocale()): string {
	const current = localeOptions.find((option) => option.value === locale)!;
	const label =
		locale === "fa"
			? "انتخاب زبان"
			: locale === "tr"
				? "Dil seçimi"
				: "Select language";
	return `
    <div class="lang-switcher">
      <div class="lang-picker" data-locale-picker>
        <button type="button" class="lang-select" data-locale-toggle aria-haspopup="true" aria-expanded="false" aria-label="${label}">
          <span class="lang-current">
            <img class="lang-flag" src="${current.flag}" alt="" />
            <span class="lang-name">${current.label}</span>
          </span>
          <span class="lang-caret" aria-hidden="true">▾</span>
        </button>
        <div class="lang-menu" hidden>
          ${localeOptions
						.map(
							(option) => `
              <button type="button" class="lang-option ${locale === option.value ? "active" : ""}" data-locale="${option.value}" lang="${option.value}">
                <img class="lang-flag" src="${option.flag}" alt="" />
                <span>${option.label}</span>
              </button>
            `,
						)
						.join("")}
        </div>
      </div>
    </div>`;
}

/** Wire up the language menu: it closes on choosing, on Escape, and on any tap outside it. */
export function bindLangSwitcher(root: HTMLElement): Cleanup {
	const picker = root.querySelector<HTMLElement>("[data-locale-picker]");
	const toggle = root.querySelector<HTMLButtonElement>("[data-locale-toggle]");
	const menu = root.querySelector<HTMLElement>(".lang-menu");
	if (!picker || !toggle || !menu) return () => {};

	const setMenuOpen = (open: boolean) => {
		menu.hidden = !open;
		toggle.setAttribute("aria-expanded", String(open));
	};

	toggle.addEventListener("click", () => setMenuOpen(menu.hidden));

	menu.addEventListener("click", (event) => {
		const option = (event.target as Element).closest<HTMLElement>(
			"[data-locale]",
		);
		if (!option) return;
		setMenuOpen(false);
		const next = option.dataset.locale as Locale;
		if (next === getLocale()) return;
		setLocale(next);
		location.reload();
	});

	// pointerdown rather than click: dragging the 3D mannequin never produces a click
	const onOutside = (event: Event) => {
		if (!menu.hidden && !picker.contains(event.target as Node))
			setMenuOpen(false);
	};
	const onKey = (event: KeyboardEvent) => {
		if (event.key !== "Escape" || menu.hidden) return;
		setMenuOpen(false);
		toggle.focus();
	};
	document.addEventListener("pointerdown", onOutside, true);
	document.addEventListener("focusin", onOutside);
	document.addEventListener("keydown", onKey);
	return () => {
		document.removeEventListener("pointerdown", onOutside, true);
		document.removeEventListener("focusin", onOutside);
		document.removeEventListener("keydown", onKey);
	};
}

/** Mount a mannequin on a canvas and play an exercise. */
export function mountMannequin(
	canvas: HTMLCanvasElement,
	exId: string,
	opts: MannequinOptions = {},
): Mannequin {
	const m = new Mannequin(canvas, opts);
	// everyone sees their own body doing the move
	m.setBody(shapeFor(state.profile));
	const ex = EX[exId];
	m.setAnim(ex.anim, ex.muscles);
	return m;
}

/** Static thumbnails for every `canvas[data-thumb]` inside root. */
export function mountThumbs(root: ParentNode): Cleanup {
	const ms = Array.from(
		root.querySelectorAll<HTMLCanvasElement>("canvas[data-thumb]"),
	).map((c) => mountMannequin(c, c.dataset.thumb!, { still: true }));
	return () => ms.forEach((m) => m.destroy());
}

export function toast(text: string): void {
	const el = document.createElement("div");
	el.className = "toast";
	el.setAttribute("role", "status");
	el.textContent = text;
	document.body.append(el);
	setTimeout(() => el.classList.add("out"), 1800);
	setTimeout(() => el.remove(), 2200);
}
