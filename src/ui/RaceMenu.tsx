import {useEffect,useRef,useState,type KeyboardEvent} from 'react'
import {ChromeText} from './ChromeText'
import {TRACK_LENGTH,COURSE_SECTORS} from '../game/trackLayout'
import './RaceMenu.css'
import './ArcadeMenu.css'

type Props={onRace:()=>void;onSetup:()=>void;onTour:()=>void;onCustomize:()=>void;onCredits:()=>void;onSound:()=>void;onCue:(confirm:boolean)=>void;muted:boolean;cameraEnabled:boolean;trackingStatus:string;fists:number;steer:number}
function ModeIcon({kind}:{kind:number}){
 const paths=['M12 22V12Q12 7 16 9V5Q19 2 22 6V4Q26 2 28 6V7Q32 4 34 9V22L28 31H18L11 25 7 19Q6 15 10 16L15 21M16 9V17M22 6V16M28 7V17','M5 10H35V30H5ZM11 16H15M21 16H25M29 16H31M11 22H15M20 25H29','M8 27V13Q20 2 32 13V27M10 20H30M13 27H27M14 13Q20 8 26 13M10 27 6 32H34L30 27','M7 28 13 8 27 32 34 12M7 28 17 25 27 32M13 8 23 11 34 12']
 return <svg viewBox="0 0 40 40" aria-hidden="true"><path d={paths[kind]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/></svg>
}
export function RaceMenu({onRace,onSetup,onTour,onCustomize,onCredits,onSound,onCue,muted,cameraEnabled,trackingStatus,fists,steer}:Props){
 const [selected,setSelected]=useState(0),buttons=useRef<(HTMLButtonElement|null)[]>([])
 const linked=cameraEnabled&&trackingStatus==='ready',gripped=linked&&fists>=2
 const choices=[{title:'HAND CONTROL RACE',subtitle:gripped?'HANDS READY · ENTER THE GRAND PRIX':linked?'CLOSE BOTH FISTS · CHECK YOUR GRIP':'CONNECT CAMERA · FIND YOUR GRIP',action:gripped?onRace:onSetup,tag:'VISION'},{title:'KEYBOARD RACE',subtitle:'WASD / ARROWS · CLASSIC CONTROLS',action:onRace,tag:'150 CC'},{title:'DRIVER GARAGE',subtitle:'CREATE YOUR MII-STYLE RACER',action:onCustomize,tag:'CUSTOM'},{title:'CIRCUIT TOUR',subtitle:'EXPLORE THE SEVEN DISTRICTS',action:onTour,tag:'FREE LOOK'}]
 useEffect(()=>{const frame=requestAnimationFrame(()=>buttons.current[0]?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame)},[])
 const confirm=(i:number)=>{onCue(true);choices[i].action()}
 const navigate=(event:KeyboardEvent<HTMLElement>)=>{
  const key=event.key
  if(['ArrowDown','ArrowUp','Home','End'].includes(key)){event.preventDefault();event.stopPropagation();const next=key==='Home'?0:key==='End'?choices.length-1:(selected+(key==='ArrowDown'?1:-1)+choices.length)%choices.length;setSelected(next);buttons.current[next]?.focus({preventScroll:true});onCue(false)}
  else if(key==='Enter'||key===' '){event.preventDefault();event.stopPropagation();confirm(selected)}
 }
 const connection=gripped?'TWO FISTS CONNECTED':linked?'SHOW BOTH CLOSED FISTS':cameraEnabled?(trackingStatus==='denied'||trackingStatus==='error'?'CAMERA NEEDS ATTENTION':'CONNECTING CAMERA…'):'CAMERA STANDBY'
 return <section className="arcade-menu" aria-labelledby="race-menu-title" onPointerDown={event=>{if(event.target instanceof Element&&!event.target.closest('button')){event.preventDefault();buttons.current[selected]?.focus({preventScroll:true})}}}>
  <div className="arcade-scanlines" aria-hidden="true"/>
  <header className="arcade-logo"><span>THE AFTERGLOW GRAND PRIX</span><h1 id="race-menu-title"><ChromeText>PALM PRIX</ChromeText></h1><p>HAND-DRIVEN <i/> NEON RACING</p></header>
  <nav className="arcade-modes" aria-label="Main game menu" onKeyDown={navigate}>{choices.map((choice,i)=><button key={choice.title} type="button" ref={node=>{buttons.current[i]=node}} className={`arcade-mode ${i===selected?'is-selected':''} ${i===0?'arcade-mode--vision':''}`} onPointerEnter={()=>setSelected(i)} onFocus={()=>setSelected(i)} onClick={()=>confirm(i)} tabIndex={selected===i?0:-1} aria-describedby={`arcade-mode-hint-${i}`}><span className="arcade-mode__cursor" aria-hidden="true">▶</span><span className="arcade-mode__icon"><ModeIcon kind={i}/></span><span className="arcade-mode__copy"><strong>{choice.title}</strong><small id={`arcade-mode-hint-${i}`}>{choice.subtitle}</small></span><span className="arcade-mode__tag">{choice.tag}</span></button>)}</nav>
  <aside className={`arcade-vision ${gripped?'is-linked':''}`} aria-label="Hand control readiness"><div className="arcade-vision__header"><span><i/> VISION LINK</span><b>01 / PLAYER</b></div><div className="arcade-wheel" style={linked?{transform:`rotate(${steer*35}deg)`}:undefined} aria-hidden="true"><svg viewBox="0 0 240 150"><defs><linearGradient id="menu-wheel" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8cf6ff"/><stop offset="1" stopColor="#fa78cf"/></linearGradient></defs><circle cx="120" cy="75" r="48" fill="none" stroke="url(#menu-wheel)" strokeWidth="2" strokeDasharray="75 8 20 8"/><path d="M73 75H167M120 75V122M101 75 120 61 139 75" fill="none" stroke="#8cf6ff" strokeWidth="3"/><g fill="#21152f" stroke="#c0faff" strokeWidth="2"><path d="M53 86 42 75V51Q42 45 48 47V39Q54 35 59 40Q63 34 68 40Q74 36 78 43V66L71 88ZM187 86 198 75V51Q198 45 192 47V39Q186 35 181 40Q177 34 172 40Q166 36 162 43V66L169 88Z"/></g><path d="M102 16 120 9 138 16M102 137 120 144 138 137" stroke="#f392c8" fill="none" strokeWidth="2"/></svg></div><strong className="arcade-vision__status" role="status">{connection}</strong><div className="arcade-gestures"><span><b>01</b> TWO FISTS <em>ACCELERATE</em></span><span><b>02</b> TILT HANDS <em>STEER</em></span><span><b>03</b> OPEN PALM <em>BRAKE / REVERSE</em></span></div><small className="arcade-vision__privacy">ON-DEVICE TRACKING · YOUR VIDEO STAYS LOCAL</small></aside>
  <div className="arcade-racer-tag" aria-hidden="true"><span>PLAYER 01</span><strong>READY TO MAKE WAVES.</strong><i/></div>
  <div className="arcade-course"><span className="arcade-course__index">01</span><div><small>SELECTED CIRCUIT</small><strong>AFTERGLOW CITY</strong><span>{(TRACK_LENGTH/1000).toFixed(2)} KM <i/> 3 LAPS <i/> 6 RACERS <i/> {COURSE_SECTORS.length} DISTRICTS</span></div><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M5 29V6H31L25 12 31 18H7M9 8H14V12H9ZM19 8H24V12H19ZM14 12H19V16H14Z" fill="none" stroke="currentColor" strokeWidth="2"/></svg></div>
  <footer className="arcade-footer"><div><span><kbd>↑</kbd><kbd>↓</kbd> SELECT</span><span><kbd>ENTER</kbd> CONFIRM</span></div><div><button type="button" onClick={onSound} aria-label={muted?'Unmute game sound':'Mute game sound'}>{muted?'♪ SOUND OFF':'♪ SOUND ON'}</button><button type="button" onClick={onCredits}>CREDITS</button></div></footer>
 </section>
}
