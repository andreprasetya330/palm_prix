/** Original four-chord synth sequence; all voices are synthesized locally. */
export function startRaceSoundtrack(context:AudioContext,destination:AudioNode,noiseBuffer:AudioBuffer,finalLap=false){
  const bus=context.createGain();bus.gain.value=.65;bus.connect(destination)
  const voices=new Set<AudioScheduledSourceNode>()
  const frequency=(midi:number)=>440*2**((midi-69)/12)
  const register=(source:AudioScheduledSourceNode,gain:GainNode,end:number)=>{
    voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect()};source.stop(end)
  }
  const note=(midi:number,at:number,duration:number,volume:number,bass=false)=>{
    const source=context.createOscillator(),gain=context.createGain()
    source.type=bass?'triangle':'sine';source.frequency.value=frequency(midi)
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration)
    source.connect(gain);gain.connect(bus);source.start(at);register(source,gain,at+duration+.01)
  }
  const drum=(at:number,kick:boolean)=>{
    const gain=context.createGain();gain.gain.setValueAtTime(kick?.12:.035,at);gain.gain.exponentialRampToValueAtTime(.0001,at+(kick?.2:.08));gain.connect(bus)
    if(kick){const source=context.createOscillator();source.frequency.setValueAtTime(125,at);source.frequency.exponentialRampToValueAtTime(43,at+.12);source.connect(gain);source.start(at);register(source,gain,at+.22)}
    else {const source=context.createBufferSource();source.buffer=noiseBuffer;source.connect(gain);source.start(at);register(source,gain,at+.1)}
  }
  const roots=[36,32,39,34],arp=[24,31,27,34,31,27,24,19]
  const stepDuration=60/(finalLap?128:116)/4
  let step=0,next=context.currentTime+.05
  const schedule=()=>{
    // A suspended tab must resume the current phrase without a backlog burst.
    if(next<context.currentTime-.2)next=context.currentTime+.03
    while(next<context.currentTime+.16){
      const root=roots[Math.floor(step/32)%roots.length],beat=step%16
      if(step%4===0)note(root,next,.23,.065,true)
      if(step%2===0)note(root+arp[Math.floor(step/2)%8],next,.16,.028)
      if(beat===0||beat===8)drum(next,true)
      if(beat===4||beat===12||beat%2===1)drum(next,false)
      step++;next+=stepDuration
    }
  }
  schedule();const timer=window.setInterval(schedule,80)
  return()=>{window.clearInterval(timer);bus.gain.setTargetAtTime(0,context.currentTime,.01);for(const voice of voices){try{voice.stop(context.currentTime+.03)}catch{/* Already completed. */}}window.setTimeout(()=>bus.disconnect(),100)}
}
