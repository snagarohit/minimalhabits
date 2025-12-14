import { useCallback } from 'react'
import confetti from 'canvas-confetti'

export function useFeedback() {
  const celebrate = useCallback(() => {
    // Play rewarding success chime (ascending two-note)
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const now = audioContext.currentTime

      // First note (G5)
      const osc1 = audioContext.createOscillator()
      const gain1 = audioContext.createGain()
      osc1.connect(gain1)
      gain1.connect(audioContext.destination)
      osc1.frequency.setValueAtTime(784, now) // G5
      osc1.type = 'sine'
      gain1.gain.setValueAtTime(0.15, now)
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      osc1.start(now)
      osc1.stop(now + 0.15)

      // Second note (C6) - slightly delayed for ascending feel
      const osc2 = audioContext.createOscillator()
      const gain2 = audioContext.createGain()
      osc2.connect(gain2)
      gain2.connect(audioContext.destination)
      osc2.frequency.setValueAtTime(1047, now + 0.08) // C6
      osc2.type = 'sine'
      gain2.gain.setValueAtTime(0, now)
      gain2.gain.setValueAtTime(0.12, now + 0.08)
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      osc2.start(now + 0.08)
      osc2.stop(now + 0.25)
    } catch {
      // Audio not supported
    }

    // Fire confetti burst
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
      disableForReducedMotion: true,
    })
  }, [])

  return {
    celebrate,
  }
}
