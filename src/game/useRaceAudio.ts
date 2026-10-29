import { useCallback, useEffect, useRef, useState } from 'react'
import {driftTier as getDriftTier,type KartState} from './kartPhysics'
import {startRaceSoundtrack} from './raceSoundtrack'
import type { RaceStatus } from './raceLoop'
import type { AbilityState } from './abilities'

type AudioRig = { context: AudioContext; master: GainNode; engine: GainNode; voices: OscillatorNode[]; wind: GainNode; skid: GainNode; noise: AudioBufferSourceNode; filter: BiquadFilterNode }
/** Audio is created only by enable(), which must be invoked from a user gesture. */
export function useRaceAudio(kart: KartState, race: RaceStatus, coins=0, abilities?: AbilityState) {
  const rig = useRef<AudioRig | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [muted, setMuted] = useState(false)
  const lastCue = useRef('')
  const boosted = useRef(false)
  const lastCoins=useRef(coins)
  const lastAbility=useRef(0),lastCast=useRef(0),lastHits=useRef(0)
  const driftTier=useRef(0)
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
        // Original procedural road/wind noise, filtered into two quiet layers.
        const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate)
        const samples=buffer.getChannelData(0)
        let smooth=0
        for(let i=0;i<samples.length;i++){smooth=.85*smooth+.15*(Math.random()*2-1);samples[i]=smooth}
        const noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true
        const wind=context.createGain(),skid=context.createGain()
        wind.gain.value=0;skid.gain.value=0
        const windFilter=context.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=1200
        const skidFilter=context.createBiquadFilter();skidFilter.type='bandpass';skidFilter.frequency.value=2300;skidFilter.Q.value=.6
        noise.connect(windFilter);windFilter.connect(wind);wind.connect(master)
        noise.connect(skidFilter);skidFilter.connect(skid);skid.connect(master);noise.start()
        rig.current = { context, master, engine, voices, wind, skid, noise, filter }
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
    a.wind.gain.setTargetAtTime(active ? Math.pow(speed/46,2)*.45 : 0,now,.2)
    a.skid.gain.setTargetAtTime(active&&kart.drifting ? .25+Math.min(1,kart.driftCharge??0)*.2 : 0,now,.08)
    a.filter.frequency.setTargetAtTime(450+speed*20+(kart.boostTimer>0?600:0),now,.12)
    // A modest rising register with small gear drops prevents a monotonous single whine.
    const gear=Math.min(3,Math.floor(speed/11))
    const frequency = 48 + speed * 4 - gear*12 + (kart.boostTimer > 0 ? 28 : 0)
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
    const sweep=(from:number,to:number,duration:number,type:OscillatorType='triangle')=>{
      const voice=a.context.createOscillator(),gain=a.context.createGain();voice.type=type
      voice.frequency.setValueAtTime(from,now);voice.frequency.exponentialRampToValueAtTime(to,now+duration)
      gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(.09,now+.012);gain.gain.exponentialRampToValueAtTime(.001,now+duration)
      voice.connect(gain);gain.connect(a.master);voice.start(now);voice.stop(now+duration+.02);voice.onended=()=>{voice.disconnect();gain.disconnect()}
    }
    if(abilities&&abilities.castId!==lastCast.current){
      if(abilities.lastCast==='pulse'){sweep(180,35,.55);[220,330,440].forEach((f,i)=>cue(f,.2,i*.035))}
      if(abilities.lastCast==='bolt'){sweep(420,1800,.3,'sawtooth');cue(1320,.1,.1)}
      if(abilities.lastCast==='mine'){sweep(660,165,.22,'square');cue(330,.12,.17)}
      lastCast.current=abilities.castId
    }
    if(abilities&&abilities.hits>lastHits.current){sweep(160,45,.28);cue(880,.12,.08);cue(1320,.18,.15)}
    lastHits.current=abilities?.hits??0
    if(abilities && abilities.eventId!==lastAbility.current){
      if(abilities.lastEvent==='pickup'){[660,880,1320].forEach((f,i)=>cue(f,.16,i*.055))}
      if(abilities.lastEvent==='shield'){[440,554,660].forEach((f,i)=>cue(f,.5,i*.05))}
      lastAbility.current=abilities.eventId
    }
    const tier=kart.drifting?getDriftTier(kart.driftCharge??0):0
    if(tier>driftTier.current){cue([0,880,1175,1568][tier],.12);cue([0,1320,1760,2093][tier],.16,.06)}
    driftTier.current=tier
    if(coins>lastCoins.current){cue(1040,.1);cue(1560,.16,.07)}
    lastCoins.current=coins
    const cueKey = race.phase === 'countdown' ? `count:${Math.ceil(race.countdown)}` : race.phase
    if (lastCue.current !== cueKey) {
      if (race.phase === 'countdown'&&race.countdown<=3) cue(520, 0.16)
      if (race.phase === 'racing' && lastCue.current.startsWith('count')) cue(1040, 0.45)
      if (race.phase === 'finish') [660, 830, 990, 1320].forEach((f, i) => cue(f, 0.45, i * 0.15))
      lastCue.current = cueKey
    }
    if (kart.boostTimer > 0 && !boosted.current) { cue(330, 0.2); cue(660, 0.3, 0.08); cue(1320, 0.3, 0.16) }
    boosted.current = kart.boostTimer > 0
  }, [enabled, muted, kart.speed, kart.boostTimer, race.phase, race.countdown,coins,kart.drifting,kart.driftCharge,abilities?.eventId,abilities?.lastEvent,abilities?.castId,abilities?.hits])
  const finalLap=race.lap===race.totalLaps
  useEffect(()=>{
    const a=rig.current
    if(!enabled||!a||race.phase!=='racing'||!a.noise.buffer)return
    return startRaceSoundtrack(a.context,a.master,a.noise.buffer,finalLap)
  },[enabled,race.phase,finalLap])
  useEffect(() => () => {
    const a = rig.current
    if (a) { a.voices.forEach(v => v.stop()); a.noise.stop(); void a.context.close(); rig.current = null }
  }, [])
  return { enable, enabled, muted, toggleMute }
}
