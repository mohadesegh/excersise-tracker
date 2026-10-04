import { arms, legs, pose, type Pose, type PoseAnim } from '../engine/pose';
import type { Locale } from '../i18n';
import type { WrongForm } from '../types';

/*
 * Wrong-form demonstrations, shown next to the correct technique in the 3D viewer.
 * `mistake` points at the matching entry in the exercise's guide (for the fix text).
 */

const stand = pose(arms(), legs());
const rep = (top: Pose, bottom: Pose, down = 1.3, hold = 0.25, up = 0.9, rest = 0.45): PoseAnim => ({
  frames: [top, bottom, bottom, top],
  beats: [down, hold, up, rest],
  dur: down + hold + up + rest,
});
/** Bottom → an ugly middle → top: for "hips shoot up first" type errors. */
const ugly = (top: Pose, bottom: Pose, middle: Pose, extra: Partial<PoseAnim> = {}): PoseAnim => ({
  frames: [top, bottom, middle, top],
  beats: [1.2, 0.7, 0.8, 0.6],
  dur: 3.3,
  ...extra,
});

const sqBottom = pose({ spine: 34 }, arms(85, 6, 0, 0), legs(98, 14, 112));
const kneesIn = { lha: -4, rha: -4, lkv: -22, rkv: -22 };

export const WRONG: Record<string, WrongForm[]> = {
  squat: [
    { label: 'زانوها به داخل', mistake: 0, focus: ['lth', 'rth', 'lsh', 'rsh'], anim: rep(stand, pose(sqBottom, kneesIn)) },
    { label: 'باسن زودتر بالا', mistake: 3, focus: ['torso', 'pelvis'], anim: ugly(stand, sqBottom, pose({ spine: 72 }, arms(80, 6, 0, 0), legs(45, 12, 30))) },
  ],
  goblet: [
    {
      label: 'خم شدن زیاد به جلو', mistake: 1, focus: ['torso'],
      anim: { ...rep(pose(arms(28, 14, 0, 128), legs(0, 8, 0)), pose({ spine: 58 }, arms(28, 16, 0, 128), legs(100, 16, 116))), prop: 'dumbbell' },
    },
  ],
  backsquat: [
    {
      label: 'باسن زودتر بالا', mistake: 0, focus: ['torso', 'pelvis'],
      anim: ugly(
        pose(arms(-25, 50, 90, 158), legs(0, 9, 0)),
        pose({ spine: 40 }, arms(-25, 50, 90, 158), legs(102, 15, 120)),
        pose({ spine: 75 }, arms(-25, 50, 90, 158), legs(45, 12, 32)),
        { prop: 'barbell' },
      ),
    },
    {
      label: 'زانوها به داخل', mistake: 1, focus: ['lth', 'rth', 'lsh', 'rsh'],
      anim: { ...rep(pose(arms(-25, 50, 90, 158), legs(0, 9, 0)), pose({ spine: 40 }, arms(-25, 50, 90, 158), legs(102, 15, 120), kneesIn)), prop: 'barbell' },
    },
  ],
  lunge: [
    {
      label: 'زانوی جلو به داخل', mistake: 1, focus: ['lth', 'lsh'],
      anim: rep(stand, pose({ spine: 6 }, arms(10, 10, 0, 20), { lhf: 88, lk: 92, lha: -6, lkv: -22, rhf: -10, rk: 88, rha: 6 }), 1.2, 0.3, 0.9, 0.5),
    },
  ],
  bridge: [
    {
      label: 'قوس دادن کمر', mistake: 0, focus: ['torso'],
      anim: { ...rep(pose({ rp: -90 }, arms(0, 14, 0, 0), legs(55, 10, 105)), pose({ rp: -100, spine: -22, neck: 30 }, arms(-12, 14, 0, 0), legs(4, 10, 100)), 0.9, 0.9, 1.1, 0.4), contacts: ['torso', 'feet'], feet: 'flat' },
    },
    {
      label: 'باز شدن زانوها', mistake: 1, focus: ['lth', 'rth'],
      anim: { ...rep(pose({ rp: -90 }, arms(0, 14, 0, 0), legs(55, 10, 105)), pose({ rp: -112, neck: 42 }, arms(-22, 14, 0, 0), legs(10, 34, 100)), 0.9, 0.9, 1.1, 0.4), contacts: ['torso', 'feet'], feet: 'flat' },
    },
  ],
  rdl: [
    {
      label: 'خم کردن زیاد زانو', mistake: 1, focus: ['lth', 'rth', 'lsh', 'rsh'],
      anim: { ...rep(pose(arms(0, 6, 0, 0), legs(0, 8, 8)), pose({ spine: 62 }, arms(62, 6, 0, 0), legs(62, 8, 78)), 1.6, 0.2, 1, 0.4), prop: 'dumbbell' },
    },
    {
      label: 'دمبل دور از بدن', mistake: 2, focus: ['lua', 'rua', 'lfa', 'rfa'],
      anim: { ...rep(pose(arms(0, 6, 0, 0), legs(0, 8, 8)), pose({ spine: 78 }, arms(118, 6, 0, 0), legs(0, 8, 18)), 1.6, 0.2, 1, 0.4), prop: 'dumbbell' },
    },
  ],
  deadlift: [
    {
      label: 'لگن زودتر بالا', mistake: 2, focus: ['torso', 'pelvis'],
      anim: ugly(
        pose(arms(0, 10, 0, 0), legs(0, 9, 0)),
        pose({ spine: 58 }, arms(58, 10, 0, 0), legs(55, 10, 70)),
        pose({ spine: 82 }, arms(82, 10, 0, 0), legs(8, 9, 10)),
        { prop: 'barbell' },
      ),
    },
  ],
  pushup: [
    {
      label: 'افتادن باسن', mistake: 0, focus: ['torso', 'pelvis'],
      anim: { ...rep(pose({ rp: 76, spine: -16 }, arms(60, 14, 0, 0), legs(0, 4, 0)), pose({ rp: 88, spine: -20 }, arms(-6, 30, 0, 86), legs(0, 4, 0)), 1.3, 0.2, 0.8, 0.4), contacts: ['hands', 'toes'], feet: 'toes' },
    },
    {
      label: 'آرنج‌ها کاملاً باز', mistake: 1, focus: ['lua', 'rua'],
      anim: { ...rep(pose({ rp: 76 }, arms(76, 14, 0, 0), legs(0, 4, 0)), pose({ rp: 88 }, arms(30, 82, 0, 86), legs(0, 4, 0)), 1.3, 0.2, 0.8, 0.4), contacts: ['hands', 'toes'], feet: 'toes' },
    },
  ],
  kneepush: [
    {
      label: 'باسن بالا', mistake: 0, focus: ['torso', 'pelvis'],
      anim: { ...rep(pose({ rp: 64, spine: 34 }, arms(98, 14, 0, 0), legs(0, 6, 40)), pose({ rp: 84, spine: 34 }, arms(42, 30, 0, 86), legs(0, 6, 40)), 1.2, 0.2, 0.8, 0.4), contacts: ['hands', 'knees'], feet: 'point' },
    },
  ],
  floorpress: [
    {
      label: 'آرنج‌ها کاملاً باز', mistake: 2, focus: ['lua', 'rua'],
      anim: { ...rep(pose({ rp: -90 }, arms(0, 92, 0, 92), legs(55, 8, 105)), pose({ rp: -90 }, arms(90, 12, 0, 0), legs(55, 8, 105)), 1.2, 0.3, 0.8, 0.4), prop: 'dumbbell', contacts: ['torso', 'feet'], feet: 'flat' },
    },
  ],
  row: [
    {
      label: 'بالا آمدن تنه', mistake: 0, focus: ['torso'],
      anim: { ...rep(pose({ spine: 62 }, arms(62, 8, 0, 0), legs(22, 8, 28)), pose({ spine: 28 }, arms(-20, 14, 0, 92), legs(22, 8, 28)), 0.5, 0.1, 0.8, 0.3), prop: 'dumbbell' },
    },
  ],
  superman: [
    {
      label: 'بالا آوردن سر', mistake: 0, focus: ['neck'],
      anim: { ...rep(pose({ rp: 90 }, arms(172, 14, 0, 0), legs(6, 6, 0)), pose({ rp: 90, spine: -10, neck: -45 }, arms(196, 14, 0, 0), legs(-14, 6, 0)), 1, 1.2, 1, 0.4), feet: 'point' },
    },
  ],
  press: [
    {
      label: 'قوس دادن کمر', mistake: 0, focus: ['torso', 'pelvis'],
      anim: { ...rep(pose(arms(0, 86, 90, 95), legs(0, 8, 0)), pose({ spine: -16 }, arms(16, 168, 90, 8), legs(-6, 8, 0)), 0.9, 0.25, 1.3, 0.3), prop: 'dumbbell' },
    },
  ],
  plank: [
    {
      label: 'افتادن کمر', mistake: 0, focus: ['torso', 'pelvis'],
      anim: { dur: 4, contacts: ['elbows', 'toes'], feet: 'toes', frames: [pose({ rp: 80, spine: -16 }, arms(64, 10, 0, 92), legs(0, 5, 0)), pose({ rp: 79, spine: -17 }, arms(62, 10, 0, 92), legs(0, 5, 0))] },
    },
    {
      label: 'باسن خیلی بالا', mistake: 1, focus: ['torso', 'pelvis'],
      anim: { dur: 4, contacts: ['elbows', 'toes'], feet: 'toes', frames: [pose({ rp: 64, spine: 30 }, arms(94, 10, 0, 92), legs(0, 5, 0)), pose({ rp: 63, spine: 31 }, arms(94, 10, 0, 92), legs(0, 5, 0))] },
    },
  ],
  birddog: [
    {
      label: 'پا بیش از حد بالا', mistake: 1, focus: ['rth', 'torso'],
      anim: {
        dur: 3.5, contacts: ['hands', 'knees'], feet: 'point', beats: [1.2, 1, 1.3],
        frames: [
          pose({ rp: 90 }, arms(90, 8, 0, 0), legs(90, 6, 104)),
          pose({ rp: 90, spine: -14 }, arms(90, 8, 0, 0), legs(90, 6, 104), { lsf: 192, rhf: -32, rk: 0 }),
          pose({ rp: 90, spine: -14 }, arms(90, 8, 0, 0), legs(90, 6, 104), { lsf: 192, rhf: -32, rk: 0 }),
        ],
      },
    },
  ],
  crunch: [
    {
      label: 'کشیدن سر با دست', mistake: 0, focus: ['neck'],
      anim: { ...rep(pose({ rp: -90 }, arms(150, 40, 0, 135), legs(55, 8, 105)), pose({ rp: -90, spine: 12, neck: 52 }, arms(160, 25, 0, 140), legs(55, 8, 105)), 0.5, 0.3, 0.8, 0.3), contacts: ['torso', 'feet'], feet: 'flat' },
    },
  ],
  jacks: [
    {
      label: 'زانوها به داخل در فرود', mistake: 1, focus: ['lth', 'rth', 'lsh', 'rsh'],
      anim: {
        dur: 1.3,
        frames: [
          pose(arms(0, 10, 0, 6), legs(0, 4, 4)),
          pose({ lift: 0.08 }, arms(0, 90, 0, 6), legs(0, 14, 4)),
          pose(arms(0, 168, 0, 6), legs(30, 2, 40), { lkv: -20, rkv: -20 }),
          pose({ lift: 0.08 }, arms(0, 90, 0, 6), legs(0, 14, 4)),
        ],
      },
    },
  ],
  highknees: [
    {
      label: 'خم شدن به عقب', mistake: 0, focus: ['torso'],
      anim: {
        dur: 0.9,
        frames: [
          pose({ lift: 0.03, spine: -16 }, { lhf: 88, lk: 95, rhf: 0, rk: 4, lha: 4, rha: 4, lsf: -25, le: 85, rsf: 45, re: 85, lsa: 8, rsa: 8 }),
          pose({ lift: 0.03, spine: -16 }, { rhf: 88, rk: 95, lhf: 0, lk: 4, lha: 4, rha: 4, rsf: -25, re: 85, lsf: 45, le: 85, lsa: 8, rsa: 8 }),
        ],
      },
    },
  ],
  climber: [
    {
      label: 'باسن بالا', mistake: 0, focus: ['torso', 'pelvis'],
      anim: {
        dur: 1, contacts: ['hands', 'toes'], feet: 'toes',
        frames: [
          pose({ rp: 58, spine: 26 }, arms(84, 10, 0, 0), { lhf: 88, lk: 112, rhf: 0, rk: 0, lha: 5, rha: 5 }),
          pose({ rp: 58, spine: 26 }, arms(84, 10, 0, 0), { rhf: 88, rk: 112, lhf: 0, lk: 0, lha: 5, rha: 5 }),
        ],
      },
    },
  ],
  boxing: [
    {
      label: 'افتادن دست دیگر', mistake: 1, focus: ['rua', 'rfa', 'lua', 'lfa'],
      anim: {
        dur: 1.1,
        frames: [
          pose({ spine: 8 }, legs(14, 9, 22), { lsf: 88, lsa: 4, le: 2, rsf: 0, rsa: 10, re: 20 }),
          pose({ spine: 8 }, legs(14, 9, 22), { lsf: 0, lsa: 10, le: 20, rsf: 88, rsa: 4, re: 2 }),
        ],
      },
    },
  ],
};

/** The toggle labels above in the other languages. */
const LABELS: Record<string, { en: string; tr: string }> = {
  'زانوها به داخل': { en: 'Knees caving in', tr: 'Dizler içe çöküyor' },
  'باسن زودتر بالا': { en: 'Hips rise first', tr: 'Kalça önce kalkıyor' },
  'خم شدن زیاد به جلو': { en: 'Leaning too far forward', tr: 'Öne fazla eğilme' },
  'زانوی جلو به داخل': { en: 'Front knee caving in', tr: 'Ön diz içe kaçıyor' },
  'قوس دادن کمر': { en: 'Arching the lower back', tr: 'Beli kavislendirme' },
  'باز شدن زانوها': { en: 'Knees falling outward', tr: 'Dizler dışa açılıyor' },
  'خم کردن زیاد زانو': { en: 'Bending the knees too much', tr: 'Dizleri fazla bükme' },
  'دمبل دور از بدن': { en: 'Dumbbells away from the body', tr: 'Dambıllar vücuttan uzak' },
  'لگن زودتر بالا': { en: 'Hips rise first', tr: 'Kalça önce kalkıyor' },
  'افتادن باسن': { en: 'Hips sagging', tr: 'Kalça düşüyor' },
  'آرنج‌ها کاملاً باز': { en: 'Elbows flared out', tr: 'Dirsekler tamamen açık' },
  'باسن بالا': { en: 'Hips too high', tr: 'Kalça yukarıda' },
  'بالا آمدن تنه': { en: 'Torso rising', tr: 'Gövde kalkıyor' },
  'بالا آوردن سر': { en: 'Lifting the head', tr: 'Başı kaldırma' },
  'افتادن کمر': { en: 'Lower back sagging', tr: 'Bel çöküyor' },
  'باسن خیلی بالا': { en: 'Hips far too high', tr: 'Kalça çok yukarıda' },
  'پا بیش از حد بالا': { en: 'Leg lifted too high', tr: 'Bacak fazla yukarıda' },
  'کشیدن سر با دست': { en: 'Pulling the head with the hands', tr: 'Başı ellerle çekme' },
  'زانوها به داخل در فرود': { en: 'Knees caving in on landing', tr: 'İnişte dizler içe çöküyor' },
  'خم شدن به عقب': { en: 'Leaning back', tr: 'Geriye yaslanma' },
  'افتادن دست دیگر': { en: 'Other hand dropping', tr: 'Diğer el düşüyor' },
};

export const wrongLabel = (label: string, locale: Locale): string =>
  locale === 'fa' ? label : (LABELS[label]?.[locale] ?? label);
