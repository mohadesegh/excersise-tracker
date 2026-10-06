/**
 * Camera form check (premium).
 *
 * Runs Google's MediaPipe Pose Landmarker entirely on the device: the camera
 * image never leaves the phone. The library (~150 kB + WASM) and the "lite"
 * model (~5 MB) are loaded only when the user opens the camera, and the
 * service worker keeps them for offline use afterwards.
 */
import type { Exercise } from "../types";
import { fa } from "../utils";
import { exerciseName } from "../data/exercises";
import { say, words } from "../voice";
import { LINES } from "../voiceLines";
import { getLocale } from "../i18n";
import {
	cueText,
	makeAnalyzer,
	setAspect,
	type Feedback,
	type Lm,
} from "./analyzers";

const TASKS = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL =
	"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/** Per-pixel "is this the person" confidence, 0..1; must be closed after use. */
export interface PoseMask {
	width: number;
	height: number;
	getAsFloat32Array(): Float32Array;
	close(): void;
}
export interface Landmarker {
	detectForVideo(
		v: HTMLVideoElement,
		ts: number,
	): { landmarks?: Lm[][]; segmentationMasks?: PoseMask[] };
}
const landmarkers: Partial<Record<"plain" | "masks", Promise<Landmarker>>> = {};

/** The on-device pose model; `masks` also returns the body silhouette (used by the body scan). */
export function loadLandmarker(masks = false): Promise<Landmarker> {
	const key = masks ? "masks" : "plain";
	const made = (landmarkers[key] ??= (async () => {
		const url = `${TASKS}/vision_bundle.mjs`;
		const mod = (await import(/* @vite-ignore */ url)) as {
			FilesetResolver: { forVisionTasks(p: string): Promise<unknown> };
			PoseLandmarker: {
				createFromOptions(fs: unknown, o: unknown): Promise<Landmarker>;
			};
		};
		const fs = await mod.FilesetResolver.forVisionTasks(`${TASKS}/wasm`);
		const make = (delegate: "GPU" | "CPU") =>
			mod.PoseLandmarker.createFromOptions(fs, {
				baseOptions: { modelAssetPath: MODEL, delegate },
				runningMode: "VIDEO",
				numPoses: 1,
				outputSegmentationMasks: masks,
			});
		try {
			return await make("GPU");
		} catch {
			return await make("CPU");
		}
	})());
	made.catch(() => delete landmarkers[key]);
	return made;
}

/** Skeleton lines to draw over the video. */
export const BONES: [number, number][] = [
	[11, 12],
	[11, 13],
	[13, 15],
	[12, 14],
	[14, 16],
	[11, 23],
	[12, 24],
	[23, 24],
	[23, 25],
	[25, 27],
	[24, 26],
	[26, 28],
];

export interface FormCheckOptions {
	ex: Exercise;
	target: number;
	onDone: (reps: number) => void;
}

/** Opens the full-screen camera sheet. Returns a function that closes it. */
export function openFormCheck({
	ex,
	target,
	onDone,
}: FormCheckOptions): () => void {
	const locale = getLocale();
	const t = {
		fa: {
			title: "بررسی فرم",
			close: "بستن",
			sec: "ثانیه",
			of: "از",
			front:
				"گوشی را روبه‌رویت، حدود دو متر دورتر، هم‌ارتفاع کمر بگذار تا کل بدنت دیده شود.",
			side: "گوشی را کنارت، حدود دو متر دورتر، روی زمین یا یک صندلی بگذار تا از بغل دیده شوی.",
			done: "تمام شد",
			log: (n: string) => `ثبت ست با ${n} تکرار`,
			privacy:
				"تصویر دوربین فقط روی همین گوشی پردازش می‌شود؛ ذخیره یا ارسال نمی‌شود.",
			preparing: "در حال آماده‌سازی دوربین…",
			denied:
				"دسترسی به دوربین داده نشد. از تنظیمات مرورگر اجازه‌ی دوربین را بده.",
			loading: "در حال بارگذاری مدل تشخیص بدن… (فقط بار اول کمی طول می‌کشد)",
			loadFailed:
				"مدل تشخیص بدن بارگذاری نشد. اینترنت را بررسی کن؛ بعد از بار اول آفلاین هم کار می‌کند.",
			nobody: "کسی دیده نمی‌شود",
			frame: "کل بدنت را در کادر بیاور",
		},
		en: {
			title: "Form check:",
			close: "Close",
			sec: "sec",
			of: "of",
			front:
				"Place the phone in front of you, about two metres away at waist height, so your whole body is visible.",
			side: "Place the phone beside you, about two metres away on the floor or a chair, so you are seen from the side.",
			done: "Done",
			log: (n: string) => `Log set with ${n} reps`,
			privacy:
				"The camera image is processed only on this phone; it is never saved or sent.",
			preparing: "Preparing the camera…",
			denied:
				"Camera access was not granted. Allow the camera in your browser settings.",
			loading:
				"Loading the body-tracking model… (only the first time takes a moment)",
			loadFailed:
				"The body-tracking model could not be loaded. Check your internet; after the first time it also works offline.",
			nobody: "Nobody is visible",
			frame: "Get your whole body in the frame",
		},
		tr: {
			title: "Form kontrolü:",
			close: "Kapat",
			sec: "sn",
			of: "/",
			front:
				"Telefonu karşına, yaklaşık iki metre uzağa ve bel hizasına koy; tüm vücudun görünsün.",
			side: "Telefonu yanına, yaklaşık iki metre uzağa, yere ya da bir sandalyeye koy; yandan görün.",
			done: "Bitti",
			log: (n: string) => `Seti ${n} tekrarla kaydet`,
			privacy:
				"Kamera görüntüsü yalnızca bu telefonda işlenir; kaydedilmez ve gönderilmez.",
			preparing: "Kamera hazırlanıyor…",
			denied:
				"Kamera izni verilmedi. Tarayıcı ayarlarından kameraya izin ver.",
			loading:
				"Vücut algılama modeli yükleniyor… (yalnızca ilk seferde biraz sürer)",
			loadFailed:
				"Vücut algılama modeli yüklenemedi. İnternetini kontrol et; ilk seferden sonra çevrimdışı da çalışır.",
			nobody: "Kimse görünmüyor",
			frame: "Tüm vücudunu kadraja al",
		},
	}[locale];
	const L = LINES[locale];
	const analyzer = makeAnalyzer(ex.id)!;
	const timed = !!ex.timed;
	const sheet = document.createElement("div");
	sheet.className = "fc";
	sheet.setAttribute("role", "dialog");
	sheet.setAttribute("aria-label", `${t.title} ${exerciseName(ex.id)}`);
	sheet.innerHTML = `
    <div class="fc-head"><b>${exerciseName(ex.id)}</b><button class="icon-btn" data-fc="close" aria-label="${t.close}">✕</button></div>
    <div class="fc-video ${analyzer.view === "front" ? "mirror" : ""}">
      <video playsinline muted></video>
      <canvas></canvas>
      <div class="fc-count"><b>${fa(0)}</b><small>${timed ? t.sec : `${t.of} ${fa(target)}`}</small></div>
      <div class="fc-cue" aria-live="assertive"></div>
    </div>
    <p class="fc-hint">${
			analyzer.view === "front"
				? t.front
				: t.side
		}</p>
    <div class="fc-actions">
      <button class="btn btn-main" data-fc="done">${timed ? t.done : t.log(fa(0))}</button>
    </div>
    <p class="fineprint">${t.privacy}</p>`;
	document.body.append(sheet);
	document.body.classList.add("fc-open");

	const video = sheet.querySelector("video")!;
	const canvas = sheet.querySelector("canvas")!;
	const ctx = canvas.getContext("2d")!;
	const count = sheet.querySelector(".fc-count b")!;
	const cueEl = sheet.querySelector<HTMLElement>(".fc-cue")!;
	const doneBtn = sheet.querySelector<HTMLButtonElement>('[data-fc="done"]')!;
	let stream: MediaStream | null = null;
	let raf = 0;
	let closed = false;
	let last: Feedback | null = null;
	let lastReps = 0;
	let announcedDone = false;

	const showCue = (text: string, level: string) => {
		cueEl.textContent = text;
		cueEl.className = `fc-cue ${level}`;
	};
	showCue(t.preparing, "warn");

	function draw(lms: Lm[] | undefined, fb: Feedback) {
		const w = (canvas.width = video.videoWidth);
		const h = (canvas.height = video.videoHeight);
		ctx.clearRect(0, 0, w, h);
		if (!lms) return;
		const col = getComputedStyle(sheet);
		const ok = col.getPropertyValue("--ok").trim() || "#0a9a5a";
		const bad = col.getPropertyValue("--hot").trim() || "#e11d48";
		ctx.lineWidth = Math.max(3, w / 160);
		ctx.lineCap = "round";
		for (const [a, b] of BONES) {
			const p = lms[a],
				q = lms[b];
			if (!p || !q || (p.visibility ?? 1) < 0.4 || (q.visibility ?? 1) < 0.4)
				continue;
			ctx.strokeStyle = fb.flag.includes(a) || fb.flag.includes(b) ? bad : ok;
			ctx.beginPath();
			ctx.moveTo(p.x * w, p.y * h);
			ctx.lineTo(q.x * w, q.y * h);
			ctx.stroke();
		}
		for (const i of fb.flag) {
			const p = lms[i];
			if (!p) continue;
			ctx.fillStyle = bad;
			ctx.beginPath();
			ctx.arc(p.x * w, p.y * h, w / 45, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	async function start() {
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: "user",
					width: { ideal: 640 },
					height: { ideal: 480 },
				},
				audio: false,
			});
		} catch {
			showCue(t.denied, "bad");
			return;
		}
		if (closed) return stop();
		video.srcObject = stream;
		await video.play().catch(() => {});
		showCue(t.loading, "warn");
		let lm: Landmarker;
		try {
			lm = await loadLandmarker();
		} catch {
			showCue(t.loadFailed, "bad");
			return;
		}
		if (closed) return;
		say(analyzer.view === "front" ? L.camFront : L.camSide);
		const t0 = performance.now();
		const loop = () => {
			if (closed) return;
			if (video.readyState >= 2 && video.videoWidth) {
				setAspect(video.videoWidth / video.videoHeight);
				const now = performance.now();
				const res = lm.detectForVideo(video, now);
				const lms = res.landmarks?.[0];
				const fb = lms
					? analyzer.update(lms, (now - t0) / 1000)
					: {
							ready: false,
							reps: last?.reps ?? 0,
							cue: t.nobody,
							level: "warn" as const,
							flag: [],
						};
				draw(lms, fb);
				update(fb);
			}
			raf = requestAnimationFrame(loop);
		};
		loop();
	}

	function update(fb: Feedback) {
		const value = timed ? Math.floor(fb.hold ?? 0) : fb.reps;
		count.textContent = fa(value);
		if (!timed) doneBtn.textContent = t.log(fa(fb.reps));
		if (!timed && fb.reps > lastReps) {
			lastReps = fb.reps;
			say(words(fb.reps), { force: true });
		}
		if (fb.cue) {
			const cue = cueText(fb.cue, locale);
			showCue(cue, fb.level);
			if (fb.level !== "ok" && fb.cue !== last?.cue) say(cue);
		} else showCue(fb.ready ? "" : t.frame, fb.ready ? "ok" : "warn");
		if (!announcedDone && value >= target) {
			announcedDone = true;
			doneBtn.classList.add("pulse");
			say(timed ? L.timeDone : L.setDone);
		}
		last = fb;
	}

	function stop() {
		cancelAnimationFrame(raf);
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
	}

	function close() {
		if (closed) return;
		closed = true;
		stop();
		sheet.remove();
		document.body.classList.remove("fc-open");
	}

	sheet.addEventListener("click", (e) => {
		const t = (e.target as Element).closest<HTMLElement>("[data-fc]");
		if (!t) return;
		if (t.dataset.fc === "done") {
			const reps = timed ? Math.floor(last?.hold ?? 0) : (last?.reps ?? 0);
			close();
			onDone(reps);
		} else close();
	});
	sheet.addEventListener("keydown", (e) => {
		if (e.key === "Escape") close();
	});

	void start();
	return close;
}
