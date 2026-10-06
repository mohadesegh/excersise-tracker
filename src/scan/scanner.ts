/**
 * Camera body scan.
 *
 * The user props the phone up, steps back and stands still twice: facing the
 * camera, then side-on. Each pose is captured hands-free after a short hold.
 * Everything runs on the device; only the resulting measurements are returned,
 * never an image.
 */
import type { Lm } from "../formcheck/analyzers";
import { BONES, loadLandmarker, type Landmarker } from "../formcheck/camera";
import { getLocale } from "../i18n";
import type { BodyScan } from "../types";
import { beep, buzz, fa } from "../utils";
import { say } from "../voice";
import {
	armsClear,
	drift,
	facing,
	measureAll,
	wholeBody,
	type Frame,
	type ScanInput,
} from "./measure";

/** Seconds the pose has to be held before it is captured. */
const HOLD = 2.5;
/** Movement allowed while holding, as a fraction of the frame. */
const STILL = 0.025;
/** Milliseconds of lost or jumpy tracking a hold survives. */
const GRACE = 450;
/** Frames kept from one hold, and the milliseconds between them. */
const SHOTS = 8;
const SHOT_EVERY = 250;

type Stage = "front" | "side";

const TEXT = {
	fa: {
		title: "اسکن بدن",
		close: "بستن",
		preparing: "در حال آماده‌سازی دوربین…",
		denied:
			"دسترسی به دوربین داده نشد. از تنظیمات مرورگر اجازه‌ی دوربین را بده.",
		loading: "در حال بارگذاری مدل تشخیص بدن… (فقط بار اول کمی طول می‌کشد)",
		loadFailed:
			"مدل تشخیص بدن بارگذاری نشد. اینترنت را بررسی کن؛ بعد از بار اول آفلاین هم کار می‌کند.",
		nobody: "کسی دیده نمی‌شود",
		frame: "عقب‌تر برو تا از سر تا پا در کادر باشی",
		faceMe: "رو به گوشی بایست",
		arms: "دست‌ها را کمی از بدن فاصله بده",
		turn: "حالا یک‌چهارم بچرخ و از پهلو بایست",
		hold: "همین‌طور بمان",
		step: (n: number) => `مرحله‌ی ${fa(n)} از ${fa(2)}`,
		front: "نمای روبه‌رو",
		side: "نمای پهلو",
		hint: "گوشی را حدود دو متر دورتر و هم‌ارتفاع کمر به جایی تکیه بده. لباس چسبان بپوش و در نور خوب بایست.",
		skipSide: "بدون نمای پهلو ادامه بده",
		failed: "اندازه‌گیری نشد. دوباره در کادر بایست.",
		privacy:
			"تصویر دوربین فقط روی همین گوشی پردازش می‌شود؛ هیچ عکسی ذخیره یا ارسال نمی‌شود، فقط اندازه‌ها می‌مانند.",
		sayFront: "رو به گوشی بایست و دست‌ها را کمی از بدن فاصله بده",
		saySide: "عالی. حالا از پهلو بایست",
		sayDone: "اسکن تمام شد",
	},
	en: {
		title: "Body scan",
		close: "Close",
		preparing: "Preparing the camera…",
		denied:
			"Camera access was not granted. Allow the camera in your browser settings.",
		loading:
			"Loading the body-tracking model… (only the first time takes a moment)",
		loadFailed:
			"The body-tracking model could not be loaded. Check your internet; after the first time it also works offline.",
		nobody: "Nobody is visible",
		frame: "Step back until you are in the frame from head to toe",
		faceMe: "Stand facing the phone",
		arms: "Hold your arms a little away from your body",
		turn: "Now make a quarter turn and stand side-on",
		hold: "Hold still",
		step: (n: number) => `Step ${n} of 2`,
		front: "Front view",
		side: "Side view",
		hint: "Prop the phone about two metres away at waist height. Wear fitted clothes and stand in good light.",
		skipSide: "Continue without the side view",
		failed: "Could not measure. Stand in the frame again.",
		privacy:
			"The camera image is processed only on this phone; no picture is saved or sent, only the measurements are kept.",
		sayFront: "Stand facing the phone with your arms a little away from your body",
		saySide: "Great. Now stand side-on",
		sayDone: "Scan complete",
	},
	tr: {
		title: "Vücut taraması",
		close: "Kapat",
		preparing: "Kamera hazırlanıyor…",
		denied: "Kamera izni verilmedi. Tarayıcı ayarlarından kameraya izin ver.",
		loading:
			"Vücut algılama modeli yükleniyor… (yalnızca ilk seferde biraz sürer)",
		loadFailed:
			"Vücut algılama modeli yüklenemedi. İnternetini kontrol et; ilk seferden sonra çevrimdışı da çalışır.",
		nobody: "Kimse görünmüyor",
		frame: "Baştan ayağa kadraja girene kadar geri çekil",
		faceMe: "Telefona dönük dur",
		arms: "Kollarını vücudundan biraz uzak tut",
		turn: "Şimdi çeyrek tur dön ve yan dur",
		hold: "Kıpırdamadan bekle",
		step: (n: number) => `Adım ${n} / 2`,
		front: "Önden görünüm",
		side: "Yandan görünüm",
		hint: "Telefonu yaklaşık iki metre uzağa, bel hizasında bir yere yasla. Dar kıyafet giy ve iyi ışıkta dur.",
		skipSide: "Yan görünüm olmadan devam et",
		failed: "Ölçüm alınamadı. Yeniden kadraja gir.",
		privacy:
			"Kamera görüntüsü yalnızca bu telefonda işlenir; hiçbir fotoğraf kaydedilmez ya da gönderilmez, yalnızca ölçüler saklanır.",
		sayFront: "Telefona dönük dur ve kollarını vücudundan biraz uzak tut",
		saySide: "Harika. Şimdi yan dur",
		sayDone: "Tarama tamamlandı",
	},
} as const;

export interface BodyScanOptions {
	who: ScanInput;
	onDone: (scan: BodyScan) => void;
}

/** Opens the full-screen scan sheet. Returns a function that closes it. */
export function openBodyScan({ who, onDone }: BodyScanOptions): () => void {
	const locale = getLocale();
	const t = TEXT[locale];
	const sheet = document.createElement("div");
	sheet.className = "fc scan";
	sheet.setAttribute("role", "dialog");
	sheet.setAttribute("aria-label", t.title);
	sheet.innerHTML = `
    <div class="fc-head"><b>${t.title}</b><button class="icon-btn" data-scan="close" aria-label="${t.close}">✕</button></div>
    <div class="fc-video mirror">
      <video playsinline muted></video>
      <canvas></canvas>
      <div class="scan-step"><b></b><small></small></div>
      <div class="scan-hold" hidden><i></i></div>
      <div class="fc-cue" aria-live="assertive"></div>
    </div>
    <p class="fc-hint">${t.hint}</p>
    <div class="fc-actions">
      <button class="btn btn-ghost" data-scan="skip" hidden>${t.skipSide}</button>
    </div>
    <p class="fineprint">${t.privacy}</p>`;
	document.body.append(sheet);
	document.body.classList.add("fc-open");

	const video = sheet.querySelector("video")!;
	const canvas = sheet.querySelector("canvas")!;
	const ctx = canvas.getContext("2d")!;
	const cueEl = sheet.querySelector<HTMLElement>(".fc-cue")!;
	const stepEl = sheet.querySelector<HTMLElement>(".scan-step")!;
	const holdEl = sheet.querySelector<HTMLElement>(".scan-hold")!;
	const skipBtn = sheet.querySelector<HTMLButtonElement>('[data-scan="skip"]')!;

	let stream: MediaStream | null = null;
	let raf = 0;
	let closed = false;
	let stage: Stage = "front";
	/** frames sampled during the current hold, and the ones kept from the front view */
	let shots: Frame[] = [];
	let lastShot = 0;
	let fronts: Frame[] = [];
	/** when the current hold began, and the pose it began with */
	let heldSince = 0;
	let anchor: Lm[] | null = null;
	/** last frame in which the pose was right and still */
	let lastGood = 0;
	let cueKey = "";

	const showCue = (text: string, level: "ok" | "warn" | "bad") => {
		cueEl.textContent = text;
		cueEl.className = `fc-cue ${level}`;
	};
	const showStage = () => {
		stepEl.querySelector("b")!.textContent = t.step(stage === "front" ? 1 : 2);
		stepEl.querySelector("small")!.textContent =
			stage === "front" ? t.front : t.side;
		skipBtn.hidden = stage !== "side";
	};
	showCue(t.preparing, "warn");
	showStage();

	function draw(lms: Lm[] | undefined, ready: boolean) {
		const w = (canvas.width = video.videoWidth);
		const h = (canvas.height = video.videoHeight);
		ctx.clearRect(0, 0, w, h);
		if (!lms) return;
		const css = getComputedStyle(sheet);
		ctx.strokeStyle = ready
			? css.getPropertyValue("--ok").trim() || "#0a9a5a"
			: "rgba(255,255,255,.75)";
		ctx.lineWidth = Math.max(3, w / 160);
		ctx.lineCap = "round";
		for (const [a, b] of BONES) {
			const p = lms[a],
				q = lms[b];
			if (!p || !q || (p.visibility ?? 1) < 0.4 || (q.visibility ?? 1) < 0.4)
				continue;
			ctx.beginPath();
			ctx.moveTo(p.x * w, p.y * h);
			ctx.lineTo(q.x * w, q.y * h);
			ctx.stroke();
		}
	}

	/** What is still wrong with the pose, or null when it can be captured. */
	function problem(lms: Lm[] | undefined, aspect: number): string | null {
		if (!lms) return t.nobody;
		if (!wholeBody(lms, stage === "side")) return t.frame;
		const dir = facing(lms, aspect);
		if (stage === "front") {
			if (dir !== "front") return t.faceMe;
			if (!armsClear(lms, aspect)) return t.arms;
		} else if (dir !== "side") return t.turn;
		return null;
	}

	function finish(sides: Frame[]) {
		const scan = measureAll(fronts, sides, who);
		if (!scan) {
			// start over rather than hand back a wrong body
			stage = "front";
			fronts = [];
			showStage();
			showCue((cueKey = t.failed), "bad");
			say(t.failed);
			return;
		}
		say(t.sayDone);
		close();
		onDone(scan);
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
			lm = await loadLandmarker(true);
		} catch {
			showCue(t.loadFailed, "bad");
			return;
		}
		if (closed) return;
		say(t.sayFront);

		const loop = () => {
			if (closed) return;
			raf = requestAnimationFrame(loop);
			if (video.readyState < 2 || !video.videoWidth) return;
			const now = performance.now();
			const res = lm.detectForVideo(video, now);
			const lms = res.landmarks?.[0];
			const mask = res.segmentationMasks?.[0];
			const aspect = video.videoWidth / video.videoHeight;
			const issue = problem(lms, aspect);
			draw(lms, !issue);

			const moved = !!anchor && !!lms && drift(anchor, lms) > STILL;
			if (issue || !lms || moved) {
				// far from the phone the tracking flickers: a short dropout does not restart the hold
				if (anchor && now - lastGood < GRACE) {
					mask?.close();
					return;
				}
				heldSince = 0;
				anchor = null;
				if (issue || !lms) {
					holdEl.hidden = true;
					if (issue && issue !== cueKey) showCue((cueKey = issue), "warn");
					mask?.close();
					return;
				}
			}
			lastGood = now;
			if (!anchor) {
				anchor = lms;
				heldSince = now;
				shots = [];
				lastShot = 0;
			}
			const held = (now - heldSince) / 1000;
			if (cueKey !== t.hold) showCue((cueKey = t.hold), "ok");
			holdEl.hidden = false;
			holdEl.style.setProperty("--p", String(Math.min(1, held / HOLD)));
			const done = held >= HOLD;
			// sample the hold: keep the landmarks and a copy of the silhouette, nothing else
			if (done || now - lastShot >= SHOT_EVERY) {
				lastShot = now;
				shots.push({
					lms,
					w: video.videoWidth,
					h: video.videoHeight,
					mask: mask && {
						data: mask.getAsFloat32Array().slice(),
						w: mask.width,
						h: mask.height,
					},
				});
				if (shots.length > SHOTS) shots.shift();
			}
			mask?.close();
			if (!done) return;

			const taken = shots;
			shots = [];
			beep(990, 220);
			buzz(60);
			heldSince = 0;
			anchor = null;
			holdEl.hidden = true;
			if (stage === "front") {
				fronts = taken;
				stage = "side";
				showStage();
				showCue((cueKey = t.turn), "warn");
				say(t.saySide);
			} else finish(taken);
		};
		loop();
	}

	function stop() {
		cancelAnimationFrame(raf);
		stream?.getTracks().forEach((tr) => tr.stop());
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
		const b = (e.target as Element).closest<HTMLElement>("[data-scan]");
		if (!b) return;
		if (b.dataset.scan === "skip" && fronts.length) finish([]);
		else close();
	});
	sheet.addEventListener("keydown", (e) => {
		if (e.key === "Escape") close();
	});

	void start();
	return close;
}
