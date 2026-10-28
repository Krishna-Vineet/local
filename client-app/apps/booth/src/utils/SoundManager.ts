import { NativeModules, Platform, Vibration } from 'react-native';

/**
 * Interaction sound — the React Native twin of `electron/src/ui/services/sound.ts`.
 *
 * Electron synthesises five sine cues with WebAudio at call time. RN has no
 * WebAudio, so the identical tones are generated into WAV files by
 * `scripts/generate_tones.py` and played by the `SimpleSound` native module on
 * both Android (`SoundPool`) and iOS (`AVAudioPlayer`). The API here keeps
 * Electron's names — `click`, `select`, `countdown`, `shutter`, `success` — so a
 * screen reads the same on either client.
 *
 * Failure is always silent: a booth that cannot play a click must still take a
 * photo. If the native module is missing (unit tests, a fresh checkout before
 * the first native build) the calls are no-ops rather than errors.
 */

export type SoundCue = 'click' | 'select' | 'countdown' | 'shutter' | 'success' | 'beep';

const native = NativeModules.SimpleSound as
  | { play: (name: string) => void; stopAll?: () => void }
  | undefined;

/** Haptics are additive, never a substitute — Electron has none, iPads/tablets do. */
const HAPTICS: Record<SoundCue, number | number[]> = {
  click: 8,
  select: 12,
  countdown: 14,
  shutter: [0, 18],
  success: [0, 14, 60, 14],
  beep: 10,
};

class SoundManager {
  /** True when a native player answered — useful in diagnostics and tests. */
  static get available(): boolean {
    return Boolean(native?.play);
  }

  static async init(): Promise<void> {
    // Nothing to warm up: the modules load their samples in their constructors.
  }

  static play(cue: SoundCue = 'click'): void {
    try {
      native?.play(cue);
    } catch {
      /* a silent booth is better than a crashed one */
    }
  }

  /** Explicit haptic, for presses that should not also make a sound. */
  static haptic(pattern: number | number[] = 12): void {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') Vibration.vibrate(pattern);
    } catch {
      /* device without a motor */
    }
  }

  /** Sound + haptic in one call, the shape most screens want on a tap. */
  static tap(cue: SoundCue = 'click'): void {
    SoundManager.play(cue);
    if (cue === 'shutter' || cue === 'success') SoundManager.haptic(HAPTICS[cue]);
  }

  static stopAll(): void {
    try {
      native?.stopAll?.();
    } catch {
      /* ignore */
    }
  }
}

/** Electron-compatible facade: `sound.click()`, `sound.shutter()`, … */
export const sound = {
  click: () => SoundManager.play('click'),
  select: () => SoundManager.play('select'),
  countdown: () => SoundManager.play('countdown'),
  shutter: () => SoundManager.play('shutter'),
  success: () => SoundManager.play('success'),
};

export default SoundManager;
