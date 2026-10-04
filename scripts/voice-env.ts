// Stand-ins for the browser globals the app modules touch when they load, so
// voice-list.ts can import them under Node. Must be imported first.
const g = globalThis as Record<string, unknown>;
const store = new Map<string, string>([
	["varzideh-locale", process.env.VOICE_LOCALE ?? "fa"],
]);
g.localStorage = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => void store.set(k, v),
	removeItem: (k: string) => void store.delete(k),
};
g.window = g;
export {};
