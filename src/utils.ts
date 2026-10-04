import { getLocale } from './i18n';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/**
 * A number as the current language writes it: Persian digits and separators in
 * Persian, Western digits elsewhere (Turkish swaps the decimal and thousands marks).
 */
export const fa = (v: number | string): string => {
  const locale = getLocale();
  const s = String(v);
  if (locale === 'fa') return s.replace(/\./g, '٫').replace(/\d/g, (d) => FA_DIGITS[+d]);
  if (locale === 'tr') return s.replace(/[.٫]/g, ',').replace(/٬/g, '.');
  return s.replace(/٫/g, '.').replace(/٬/g, ',');
};

/** Persian or Western digits → number. */
export const parseFaNumber = (s: string): number =>
  Number(s.trim().replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٫,/]/g, '.'));

export const money = (n: number): string => fa(n.toLocaleString('en-US').replace(/,/g, '٬'));

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);

export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(sel));

export const buzz = (ms = 12): void => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
};

export const dayKey = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const go = (hash: string): void => {
  location.hash = hash;
};

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

let audio: AudioContext | null = null;
/** Short beep; the AudioContext is created lazily so it costs nothing until a workout runs. */
export function beep(freq = 880, ms = 140): void {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.15, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + ms / 1000);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + ms / 1000);
  } catch {
    /* audio unavailable */
  }
}
