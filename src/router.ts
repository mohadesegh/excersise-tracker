import { buildPlan } from "./planner";
import { getLocale } from "./i18n";
import { state, update } from "./store";
import { $$ } from "./utils";
import type { Cleanup, View } from "./views/ui";

interface Route {
	view: View;
	tab?: string;
	needsProfile?: boolean;
}

const routes = new Map<string, Route>();
let cleanup: Cleanup | void;
const app = (): HTMLElement => document.getElementById("app")!;

export const route = (name: string, r: Route): void => {
	routes.set(name, r);
};

export function refresh(): void {
	const raw = location.hash.replace(/^#\/?/, "");
	const [path, qs = ""] = raw.split("?");
	const [name = "", ...params] = path.split("/").filter(Boolean);
	const query = new URLSearchParams(qs);

	let key = name;
	if (!key) key = state.profile ? "today" : "welcome";
	let r = routes.get(key);
	if (!r) {
		key = "today";
		r = routes.get("today")!;
	}
	if (r.needsProfile && !state.profile) {
		key = "welcome";
		r = routes.get("welcome")!;
	}
	// profiles from before body metrics existed: ask the missing questions first
	else if (r.needsProfile && !state.profile!.weight) {
		key = "quiz";
		r = routes.get("quiz")!;
	} else if (r.needsProfile && !state.plan)
		update((s) => (s.plan = buildPlan(s.profile!)));

	if (typeof cleanup === "function") cleanup();
	// a fresh container per view, so listeners never leak between screens
	const view = document.createElement("div");
	view.className = `view view-${key}`;
	app().replaceChildren(view);
	cleanup = r.view(view, params, query);

	const nav = document.getElementById("tabs")!;
	nav.hidden = !r.tab;
	const locale = getLocale();
	const labels: Record<string, Record<typeof locale, string>> = {
		today: { fa: "امروز", en: "Today", tr: "Bugün" },
		library: { fa: "حرکت‌ها", en: "Moves", tr: "Hareketler" },
		progress: { fa: "پیشرفت", en: "Progress", tr: "İlerleme" },
		profile: { fa: "پروفایل", en: "Profile", tr: "Profil" },
	};
	$$<HTMLAnchorElement>("a", nav).forEach((a) => {
		const label = labels[a.dataset.tab ?? ""]?.[locale] ?? a.dataset.tab ?? "";
		const title = a.querySelector<HTMLSpanElement>(".tab-label");
		if (title) title.textContent = label;
		else {
			const span = document.createElement("span");
			span.className = "tab-label";
			span.textContent = label;
			a.append(span);
		}
		const on = a.dataset.tab === r!.tab;
		a.classList.toggle("on", on);
		if (on) a.setAttribute("aria-current", "page");
		else a.removeAttribute("aria-current");
	});
	window.scrollTo(0, 0);
	// move focus to the new screen's heading for screen-reader users
	view.querySelector<HTMLElement>("h1")?.setAttribute("tabindex", "-1");
}

export function startRouter(): void {
	window.addEventListener("hashchange", refresh);
	refresh();
}
