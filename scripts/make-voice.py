"""
Builds the recorded voice clips in public/voice/<language>/ with Piper, an
open-source text-to-speech engine that runs on this computer (no account).

    pip install piper-tts                       # once
    python -m piper.download_voices --download-dir <models> fa_IR-amir-medium tr_TR-dfki-medium
    npx esbuild scripts/voice-list.ts --bundle --platform=node --format=cjs --outfile=<tmp>/voice-list.cjs
    python scripts/make-voice.py --list <tmp>/voice-list.cjs --models <models>

Needs node and ffmpeg on the PATH. Re-run it after changing any spoken text
(src/voiceLines.ts, the exercise names, the guide cues): clips whose text is
gone are deleted, existing ones are kept unless --force is given.

Check each voice's licence before publishing (the MODEL_CARD next to the model
on huggingface.co/rhasspy/piper-voices). To use another voice, change VOICES.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

VOICES = {"fa": "fa_IR-amir-medium", "tr": "tr_TR-dfki-medium"}
OUT = Path(__file__).resolve().parent.parent / "public" / "voice"

# trim the silence Piper leaves around a clip so the pieces of a sentence join up, then keep a short breath
TRIM = (
    "silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
    "silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
    "apad=pad_dur=0.12"
)


# MP3 audio under a neutral name: download managers grab every address ending in .mp3
EXT = ".dat"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", required=True, help="the bundled scripts/voice-list.ts")
    ap.add_argument("--models", required=True, help="folder with the downloaded Piper voices")
    ap.add_argument("--force", action="store_true", help="re-record clips that already exist")
    args = ap.parse_args()

    for locale, model in VOICES.items():
        env = {**os.environ, "VOICE_LOCALE": locale}
        clips = json.loads(subprocess.run(["node", args.list], env=env, capture_output=True, check=True).stdout.decode("utf-8"))
        out = OUT / locale
        out.mkdir(parents=True, exist_ok=True)
        wanted = {c["file"] + EXT for c in clips}
        for old in out.glob("*" + EXT):
            if old.name not in wanted:
                old.unlink()

        voice = PiperVoice.load(str(Path(args.models) / f"{model}.onnx"))
        made = 0
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "clip.wav"
            for c in clips:
                target = out / (c["file"] + EXT)
                if target.exists() and not args.force:
                    continue
                with wave.open(str(wav), "wb") as w:
                    voice.synthesize_wav(c["text"], w, syn_config=SynthesisConfig(length_scale=1.05))
                subprocess.run(
                    ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", TRIM, "-ac", "1", "-ar", "22050", "-b:a", "32k", "-f", "mp3", str(target)],
                    check=True,
                )
                made += 1
        size = sum(f.stat().st_size for f in out.glob("*" + EXT))
        print(f"{locale}: {len(clips)} clips ({made} new), {size / 1e6:.1f} MB", file=sys.stderr)


if __name__ == "__main__":
    main()
