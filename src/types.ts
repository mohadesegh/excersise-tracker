import type { Guide } from './data/guides';
import type { PoseAnim, SegName } from './engine/pose';

export type Goal = 'fatloss' | 'muscle' | 'fit';
export type Level = 1 | 2 | 3;
export type Place = 'bodyweight' | 'dumbbell' | 'gym';
export type Limit = 'knee' | 'back' | 'shoulder';
export type Equip = 'none' | 'dumbbell' | 'barbell';
export type Pattern = 'squat' | 'lunge' | 'hinge' | 'push' | 'pull' | 'press' | 'core' | 'cardio' | 'mobility';
export type Muscle = 'quads' | 'glutes' | 'hams' | 'chest' | 'back' | 'shoulders' | 'arms' | 'core';
export type Feel = 'easy' | 'ok' | 'hard';
export type Sex = 'm' | 'f' | 'x';

/** Places on the body map; L/R are the user's own left and right. */
export type PainRegion =
  | 'neck' | 'upperBack' | 'lowerBack'
  | 'shoulderL' | 'shoulderR' | 'elbowL' | 'elbowR' | 'wristL' | 'wristR'
  | 'hipL' | 'hipR' | 'kneeL' | 'kneeR' | 'ankleL' | 'ankleR';
/** How it hurts: sharp, dull ache, stiffness, shooting down the limb, numbness or tingling. */
export type PainKind = 'sharp' | 'ache' | 'stiff' | 'radiating' | 'numb';
/** When it is worst. */
export type PainWhen = 'move' | 'sitting' | 'morning' | 'night';

export interface Pain {
  region: PainRegion;
  kind: PainKind;
  /** 1 (barely there) to 10 (unbearable) */
  level: number;
  when: PainWhen;
}

/**
 * Measurements from the camera body scan, in centimetres. Only these numbers
 * are kept; the camera image itself is never stored.
 */
export interface BodyScan {
  date: string;
  /** body weight at scan time, so girths can follow later weight changes */
  kg: number;
  /** shoulder joint to shoulder joint */
  shoulder: number;
  /** torso width from the front view and depth from the side view (absent when that view was unusable) */
  chestW?: number; chestD?: number;
  waistW?: number; waistD?: number;
  hipW?: number; hipD?: number;
  /** limb thickness seen from the front (absent when the silhouette was unclear) */
  armW?: number; forearmW?: number; thighW?: number; calfW?: number;
  /** segment lengths */
  torso: number; upperArm: number; forearm: number; thigh: number; shin: number;
}

export interface Profile {
  name: string;
  goal: Goal;
  level: Level;
  place: Place;
  days: number;
  minutes: number;
  limits: Limit[];
  sex: Sex;
  age: number;
  /** centimetres */
  height: number;
  /** kilograms, kept in sync with the latest weight log */
  weight: number;
  /** optional circumferences in cm; estimated from BMI when missing */
  waist?: number;
  hip?: number;
  chest?: number;
  /** optional target body weight (kg) for the weight tracker */
  goalWeight?: number;
  /** where and how it hurts, marked on the body map; `limits` is derived from this */
  pains?: Pain[];
  scan?: BodyScan;
  createdAt: number;
}

export interface WrongForm {
  /** short label for the toggle */
  label: string;
  /** index into guide.mistakes for the explanation and fix */
  mistake: number;
  anim: PoseAnim;
  /** body parts to flag in red */
  focus: SegName[];
}

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  muscles: Muscle[];
  equip: Equip;
  level: Level;
  avoid: Limit[];
  premium: boolean;
  timed?: boolean;
  /** warm-up, stretching and corrective moves are not used as main training slots */
  kind?: 'warmup' | 'stretch' | 'rehab';
  /** wrong-form demonstrations for the 3D viewer */
  wrong?: WrongForm[];
  /** jumping / landing moves, swapped out for heavier or older bodies */
  impact?: boolean;
  guide: Guide;
  anim: PoseAnim;
}

export interface PlannedExercise {
  id: string;
  /** Free substitute shown to non-premium users when `id` is a premium move. */
  freeAlt?: string;
  sets: number;
  reps: number;
  timed: boolean;
  rest: number;
}

export interface DayPlan {
  /** template id; the title is shown in the user's language from this (plans saved before it existed only have `title`) */
  key?: string;
  title: string;
  items: PlannedExercise[];
  /** Days beyond the free tier's limit. */
  premiumOnly: boolean;
}

export interface Plan {
  days: DayPlan[];
  createdAt: number;
  /** training block number; each block is CYCLE_WEEKS long and rotates the exercise choice */
  cycle?: number;
}

/** One logged set. */
export interface SetLog {
  id: string;
  set: number;
  reps: number;
  /** kilograms (per dumbbell for dumbbell moves); absent for bodyweight */
  kg?: number;
}

export interface Session {
  date: string;
  ts: number;
  day: number;
  minutes: number;
  sets: number;
  feel: Feel;
  kcal?: number;
  logs?: SetLog[];
}

export type BillingPlan = 'trial' | 'monthly' | 'yearly';

export interface Subscription {
  plan: BillingPlan;
  until: number;
}

export interface AppState {
  v: 1;
  profile: Profile | null;
  plan: Plan | null;
  sessions: Session[];
  sub: Subscription | null;
  trialUsed: boolean;
  /** Per-exercise rep (or seconds) adjustment from adaptive progression. */
  adjust: Record<string, number>;
  /** body log: weight, plus optional circumferences (cm) */
  weights: { date: string; kg: number; waist?: number; hip?: number }[];
  /** current working weight per exercise (kg) */
  loads: Record<string, number>;
  /** days (YYYY-MM-DD) on which the corrective routine was completed; recent ones only */
  rehabDays?: string[];
  /** last local change, for sync conflict resolution */
  updatedAt?: number;
}
