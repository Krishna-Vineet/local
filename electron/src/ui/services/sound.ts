let audioContext: AudioContext | null = null

function context(): AudioContext | null {
  try {
    audioContext ??= new AudioContext()
    return audioContext
  } catch {
    return null
  }
}

function tone(frequency: number, duration: number, volume: number): void {
  const ctx = context()
  if (!ctx) return
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start()
  oscillator.stop(ctx.currentTime + duration)
}

export const sound = {
  click(): void {
    tone(520, 0.07, 0.035)
  },
  select(): void {
    tone(720, 0.11, 0.04)
  },
  countdown(): void {
    tone(880, 0.12, 0.05)
  },
  shutter(): void {
    tone(180, 0.06, 0.06)
    window.setTimeout(() => tone(90, 0.09, 0.05), 55)
  },
  success(): void {
    tone(520, 0.12, 0.04)
    window.setTimeout(() => tone(660, 0.12, 0.04), 120)
    window.setTimeout(() => tone(880, 0.2, 0.05), 240)
  },
}
