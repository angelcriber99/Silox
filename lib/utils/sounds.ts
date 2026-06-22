export function playSound(type: 'pop' | 'success' | 'click' | 'celebration') {
  if (typeof window === 'undefined') return

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContext()

    const playTone = (freq: number, type: OscillatorType, duration: number, vol = 0.1) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      
      gain.gain.setValueAtTime(vol, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.start()
      osc.stop(ctx.currentTime + duration)
    }

    if (type === 'pop') {
      playTone(400, 'sine', 0.1, 0.1)
    } else if (type === 'click') {
      playTone(800, 'triangle', 0.05, 0.05)
    } else if (type === 'success') {
      playTone(500, 'sine', 0.1, 0.1)
      setTimeout(() => playTone(800, 'sine', 0.2, 0.1), 100)
    } else if (type === 'celebration') {
      // Arpeggio
      const notes = [440, 554.37, 659.25, 880] // A4, C#5, E5, A5
      notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'sine', 0.2, 0.15), i * 100)
      })
    }
  } catch (e) {
    console.error('Audio playback failed', e)
  }
}
