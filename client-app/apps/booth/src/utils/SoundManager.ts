import { NativeModules, Platform, Vibration } from 'react-native';

const { SimpleSound } = NativeModules;

class SoundManager {
  static async init() {
    // Sound initialization if needed per platform
  }

  // Micro-interaction haptic feedback
  static haptic(pattern: number | number[] = 15) {
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        Vibration.vibrate(pattern);
      } else if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      // Ignore haptic error if unsupported
    }
  }

  // Major interaction sound feedback
  static async play(name: 'click' | 'shutter' | 'beep' | 'success') {
    try {
      // Native Android module
      if (SimpleSound && Platform.OS === 'android') {
        SimpleSound.play(name);
        return;
      }

      // Web Audio / Cross-Platform Fallback Synthesizer
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (name === 'click') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
        } else if (name === 'shutter') {
          osc.type = 'square';
          osc.frequency.setValueAtTime(1500, now);
          osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (name === 'beep') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1000, now);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (name === 'success') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(523.25, now); // C5
          osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
          osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        }
      }
    } catch (e) {
      console.log('Error playing sound', e);
    }
  }
}

export default SoundManager;
