#!/usr/bin/env python3
"""Generate the booth's interaction tones.

The Electron kiosk synthesises its sounds at runtime with WebAudio
(`electron/src/ui/services/sound.ts`). React Native has no WebAudio, so the same
five tones are baked into WAV files here and played by the tiny `SimpleSound`
native module on Android and iOS. Frequencies, durations, ordering and the
exponential decay curve are copied from that file so the two clients sound
identical; only the absolute level is raised, because a tablet in a hall is
further from the ear than a laptop on a desk.

Source of truth for the *shape* of each sound:
    electron/src/ui/services/sound.ts

Run:
    python3 client-app/apps/booth/scripts/generate_tones.py

Writes:
    apps/booth/android/app/src/main/res/raw/{click,select,countdown,shutter,success,beep}.wav
    apps/booth/ios/booth/Sounds/{...}.wav
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

RATE = 44100
# Electron uses gains of 0.035–0.06 (−29 dBFS … −24 dBFS). Multiply to land
# around −9 dBFS, which is audible over venue noise but never harsh.
LEVEL = 6.0
TAIL = 0.03  # let the decay finish instead of clipping the last sample


def sine(freq: float, duration: float, gain: float, start: float = 0.0, length: float = 0.0) -> list[float]:
    """One oscillator with WebAudio's exponential decay to 0.001."""
    total = int((length or duration) * RATE)
    offset = int(start * RATE)
    buf = [0.0] * (offset + total)

    amplitude = gain * LEVEL
    for i in range(total):
        t = i / RATE
        if duration <= 0:
            continue
        envelope = 0.001 ** (t / duration) if t < duration else 0.0
        buf[offset + i] += amplitude * envelope * math.sin(2 * math.pi * freq * t)
    return buf


def mix(*tracks: list[float]) -> list[float]:
    longest = max(len(t) for t in tracks)
    out = [0.0] * longest
    for track in tracks:
        for i, value in enumerate(track):
            out[i] += value
    return out


def write_wav(path: Path, samples: list[float]) -> None:
    peak = max((abs(s) for s in samples), default=0.0)
    if peak > 0.98:                       # headroom, never clip
        samples = [s * (0.98 / peak) for s in samples]

    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        frames = b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in samples)
        handle.writeframes(frames)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    android = root / "android/app/src/main/res/raw"
    ios = root / "ios/booth/Sounds"

    tones = {
        # electron: tone(520, 0.07, 0.035)
        "click": mix(sine(520, 0.07, 0.035, length=0.07 + TAIL)),
        # electron: tone(720, 0.11, 0.04)
        "select": mix(sine(720, 0.11, 0.04, length=0.11 + TAIL)),
        # electron: tone(880, 0.12, 0.05)
        "countdown": mix(sine(880, 0.12, 0.05, length=0.12 + TAIL)),
        # electron: 180 Hz 60 ms, then 90 Hz 90 ms at 55 ms
        "shutter": mix(sine(180, 0.06, 0.06), sine(90, 0.09, 0.05, start=0.055)),
        # electron: 520 → 660 → 880 at 0 / 120 / 240 ms
        "success": mix(
            sine(520, 0.12, 0.04),
            sine(660, 0.12, 0.04, start=0.12),
            sine(880, 0.2, 0.05, start=0.24),
        ),
        # legacy name used by older screens; same pitch as countdown, quieter
        "beep": mix(sine(880, 0.1, 0.045, length=0.1 + TAIL)),
    }

    for name, samples in tones.items():
        write_wav(android / f"{name}.wav", samples)
        write_wav(ios / f"{name}.wav", samples)
        duration = len(samples) / RATE
        print(f"{name:9s} {duration * 1000:5.0f} ms  → {android.name}/ and ios/booth/Sounds/")

    # The old mp3s are superseded by these; remove them so the module cannot
    # pick up two files with the same @raw name.
    for stale in android.glob("*.mp3"):
        stale.unlink()
        print(f"removed stale {stale.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
