/**
 * Voice coaching in the app's language ("ست دوم، زانوها رو به بیرون").
 *
 * Three engines, best first:
 *  1. Cloud: Azure neural voice via the `tts` Edge Function (needs cloud
 *     config). Every phrase is cached in Cache Storage, so repeated cues cost
 *     nothing and work offline afterwards.
 *  2. Device: the browser's speechSynthesis, when a voice for the language
 *     exists (English almost always; Turkish and Persian only on some
 *     phones and browsers).
 *  3. Clips: recorded pieces shipped with the app in public/voice (Persian
 *     and Turkish), played one after another. Needs no server and no device
 *     voice. See scripts/make-voice.py.
 * With none of these, the app falls back to beeps and vibration.
 */
import { CLOUD, cloudEnabled } from './config';
import { getLocale, localeTag } from './i18n';

const PREF = 'varzideh:voice';
let enabled = (() => {
  try {
    return localStorage.getItem(PREF) !== 'off';
  } catch {
    return true;
  }
})();
let deviceVoice: SpeechSynthesisVoice | null = null;
let current: HTMLAudioElement | null = null;
let lastText = '';
let lastAt = 0;
/** when the cloud voice last failed; it is tried again after a minute (a brief loss of signal must not silence the session) */
let cloudFailedAt = 0;
const cloudBroken = (): boolean => Date.now() - cloudFailedAt < 60_000;
/** bumped on every say()/stop(), so a phrase that was still loading never plays over a newer one */
let turn = 0;
const voiceListeners = new Set<() => void>();

/** Best device voice for the app's language: exact region first, then an on-device one. */
function findVoice() {
  if (!('speechSynthesis' in window)) return;
  const tag = localeTag().toLowerCase();
  const lang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-'); // Android reports tr_TR
  const voices = speechSynthesis.getVoices().filter((v) => lang(v).startsWith(getLocale()));
  const score = (v: SpeechSynthesisVoice) => (lang(v) === tag ? 2 : 0) + (v.localService ? 1 : 0);
  deviceVoice = voices.sort((a, b) => score(b) - score(a))[0] ?? null;
  voiceListeners.forEach((f) => f());
}
if ('speechSynthesis' in window) {
  findVoice();
  // most browsers load their voice list a moment after the page starts
  speechSynthesis.addEventListener?.('voiceschanged', findVoice);
}

/** Called when the available voices change (they usually arrive after the first render). */
export const onVoiceChange = (fn: () => void): (() => void) => {
  voiceListeners.add(fn);
  return () => voiceListeners.delete(fn);
};

/** A sentence for the cloud / device voice, and the same sentence as recorded clips. */
export interface Line {
  text: string;
  parts: string[];
}

/** Languages that have recorded clips in public/voice. */
const CLIP_LOCALES: readonly string[] = ['fa', 'tr'];

export type VoiceEngine = 'cloud' | 'device' | 'clips' | null;
export const voiceEngine = (): VoiceEngine =>
  cloudEnabled() && !cloudBroken() ? 'cloud' : deviceVoice ? 'device' : CLIP_LOCALES.includes(getLocale()) ? 'clips' : null;
export const voiceOn = (): boolean => enabled && voiceEngine() !== null;
export const voiceEnabledPref = (): boolean => enabled;
export function setVoice(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(PREF, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  if (!on) stop();
}

export function stop(): void {
  turn++;
  current?.pause();
  current = null;
  clipPlayer?.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

/* ---------- recorded clips ---------- */

/** FNV-1a over the UTF-8 bytes: the clip's file name (the same function is in scripts/make-voice.py). */
export function clipName(text: string): string {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(text.trim())) {
    h ^= b;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
// .dat, not .mp3: download managers (IDM and the like) grab every address that ends in a media extension
const clipUrl = (text: string) => `/voice/${getLocale()}/${clipName(text)}.dat`;

/** One element for every clip: phones only let an element that the user has started keep playing on its own. */
let clipPlayer: HTMLAudioElement | null = null;
/** An empty sound, played once inside the user's tap so the element may play on its own afterwards. */
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/**
 * Clips are loaded as data and played from memory, so no media address is
 * ever requested for a download manager to catch.
 */
const clips = new Map<string, Promise<string | null>>();
function clip(text: string): Promise<string | null> {
  const url = clipUrl(text);
  let got = clips.get(url);
  if (!got) {
    got = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? URL.createObjectURL(new Blob([b], { type: 'audio/mpeg' })) : null))
      .catch(() => {
        clips.delete(url); // offline for a moment: try again next time
        return null;
      });
    clips.set(url, got);
  }
  return got;
}

async function playClips(parts: string[], mine: number): Promise<void> {
  let a = clipPlayer;
  if (!a) {
    a = clipPlayer = new Audio();
    a.src = SILENCE;
    void a.play().catch(() => {});
  }
  // load the whole sentence at once so the pieces follow each other without gaps
  const loaded = parts.map(clip);
  for (const one of loaded) {
    const src = await one;
    if (mine !== turn) return;
    if (!src) continue; // a missing clip is skipped
    await new Promise<void>((done) => {
      a.onended = a.onerror = a.onpause = () => done();
      a.src = src;
      a.play().catch(() => done());
    });
  }
}

async function cloudAudio(text: string): Promise<Blob> {
  const lang = localeTag();
  const key = `https://tts.local/${lang}/${encodeURIComponent(text)}`;
  const cache = 'caches' in window ? await caches.open('varzideh-tts') : null;
  const hit = await cache?.match(key);
  if (hit) return hit.blob();
  const res = await fetch(`${CLOUD.url}/functions/v1/tts`, {
    method: 'POST',
    headers: { apikey: CLOUD.anonKey, Authorization: `Bearer ${CLOUD.anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const blob = await res.blob();
  await cache?.put(key, new Response(blob, { headers: { 'content-type': 'audio/mpeg' } }));
  return blob;
}

/**
 * Say something. A new phrase interrupts the previous one (the newest
 * instruction matters most); the same phrase isn't repeated within 4 s.
 */
export async function say(what: string | Line, opts: { force?: boolean } = {}): Promise<void> {
  const { text, parts } = typeof what === 'string' ? { text: what, parts: [what] } : what;
  if (!enabled || !text) return;
  const now = Date.now();
  if (!opts.force && text === lastText && now - lastAt < 4000) return;
  lastText = text;
  lastAt = now;
  stop();
  const mine = turn;
  const engine = voiceEngine();
  if (engine === 'cloud') {
    try {
      const blob = await cloudAudio(text);
      if (mine !== turn) return;
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      current = a;
      a.onended = () => URL.revokeObjectURL(url);
      await a.play();
      return;
    } catch {
      cloudFailedAt = Date.now(); // fall through to the device voice for now
      voiceListeners.forEach((f) => f());
      if (mine !== turn) return;
    }
  }
  if (deviceVoice) {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = deviceVoice;
    u.lang = deviceVoice.lang;
    u.rate = 1.02;
    speechSynthesis.speak(u);
    return;
  }
  if (CLIP_LOCALES.includes(getLocale())) await playClips(parts, mine);
}

/* ---------- Persian numbers as words (TTS reads them more naturally); other languages read digits fine ---------- */

const ONES = ['صفر', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];

export function words(n: number): string {
  const locale = getLocale();
  if (locale !== 'fa') return String(n).replace('.', locale === 'tr' ? ',' : '.');
  if (!Number.isInteger(n)) {
    const [i, d] = String(n).split('.');
    return `${words(Number(i))} و ${d === '5' ? 'نیم' : `ممیز ${words(Number(d))}`}`;
  }
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` و ${ONES[n % 10]}` : '');
  if (n < 1000) return HUNDREDS[Math.floor(n / 100)] + (n % 100 ? ` و ${words(n % 100)}` : '');
  return String(n);
}

const ORD = ['', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم'];
export const ordinal = (n: number): string => (getLocale() !== 'fa' ? String(n) : (ORD[n] ?? `${words(n)}م`));
