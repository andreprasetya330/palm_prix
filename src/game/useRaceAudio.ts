import { useCallback, useEffect, useRef, useState } from 'react'
import type { KartState } from './kartPhysics'
import type { RaceStatus } from './raceLoop'

type AudioRig = { context: AudioContext; master: GainNode; engine: GainNode; voices: OscillatorNode[] }
/** Audio is created only by enable(), which must be invoked from a user gesture. */
export function useRaceAudio(kart: KartState, race: RaceStatus, coins=0) {
  const rig = useRef<AudioRig | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [muted, setMuted] = useState(false)
  const lastCue = useRef('')
  const boosted = useRef(false)
  const lastCoins=useRef(coins)
  const enable = useCallback(() => {
    try {
      if (!rig.current) {
        const context = new AudioContext()
        const master = context.createGain()
        master.gain.value = 0.3
        master.connect(context.destination)
        const engine = context.createGain()
        engine.gain.value = 0
        const filter = context.createBiquadFilter()
        filter.type = 'lowpass'; filter.frequency.value = 750
        engine.connect(filter); filter.connect(master)
        const voices = [1, 2.01, 0.5].map((ratio, i) => {
          const voice = context.createOscillator()
          voice.type = i === 2 ? 'sine' : 'triangle'
          voice.frequency.value = 55 * ratio
          const level = context.createGain(); level.gain.value = i === 0 ? 0.5 : 0.18
          voice.connect(level); level.connect(engine); voice.start()
          return voice
        })
        rig.current = { context, master, engine, voices }
      }
      void rig.current.context.resume().catch(() => {})
      setEnabled(true)
    } catch { /* Gameplay remains available if WebAudio is unavailable. */ }
  }, [])
  const toggleMute = useCallback(() => setMuted(v => !v), [])
  useEffect(() => {
    const a = rig.current
    if (!a) return
    const now = a.context.currentTime
    a.master.gain.setTargetAtTime(muted ? 0 : 0.3, now, 0.04)
    const active = race.phase === 'racing'
    const speed = Math.abs(kart.speed)
    a.engine.gain.setTargetAtTime(active ? 0.11 + speed / 280 : 0, now, 0.08)
    const frequency = 48 + speed * 4 + (kart.boostTimer > 0 ? 28 : 0)
    a.voices.forEach((voice, i) => voice.frequency.setTargetAtTime(frequency * [1, 2.01, 0.5][i], now, 0.08))
    const cue = (frequency: number, duration: number, delay = 0) => {
      const voice = a.context.createOscillator(); const gain = a.context.createGain()
      voice.type = 'sine'; voice.frequency.value = frequency
      gain.gain.setValueAtTime(0, now + delay)
      gain.gain.linearRampToValueAtTime(0.15, now + delay + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration)
      voice.connect(gain); gain.connect(a.master)
      voice.start(now + delay); voice.stop(now + delay + duration + 0.02)
      voice.onended = () => { voice.disconnect(); gain.disconnect() }
    }
    if(coins>lastCoins.current){cue(1040,.1);cue(1560,.16,.07)}
    lastCoins.current=coins
    const cueKey = race.phase === 'countdown' ? `count:${Math.ceil(race.countdown)}` : race.phase
    if (lastCue.current !== cueKey) {
      if (race.phase === 'countdown') cue(520, 0.16)
      if (race.phase === 'racing' && lastCue.current.startsWith('count')) cue(1040, 0.45)
      if (race.phase === 'finish') [660, 830, 990, 1320].forEach((f, i) => cue(f, 0.45, i * 0.15))
      lastCue.current = cueKey
    }
    if (kart.boostTimer > 0 && !boosted.current) { cue(330, 0.2); cue(660, 0.3, 0.08); cue(1320, 0.3, 0.16) }
    boosted.current = kart.boostTimer > 0
  }, [enabled, muted, kart.speed, kart.boostTimer, race.phase, race.countdown,coins])
  useEffect(() => () => {
    const a = rig.current
    if (a) { a.voices.forEach(v => v.stop()); void a.context.close(); rig.current = null }
  }, [])
  return { enable, enabled, muted, toggleMute }
}
