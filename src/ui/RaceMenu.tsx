import {COURSE_SECTORS,getTrackPoint,TRACK_BOUNDS,TRACK_LENGTH,TRACK_SAMPLES} from '../game/trackLayout'
import './RaceMenu.css'

const width=TRACK_BOUNDS.maxX-TRACK_BOUNDS.minX,depth=TRACK_BOUNDS.maxZ-TRACK_BOUNDS.minZ
const scale=Math.min(250/width,142/depth)
const project=(x:number,z:number)=>[160+(x-(TRACK_BOUNDS.minX+TRACK_BOUNDS.maxX)/2)*scale,94-(z-(TRACK_BOUNDS.minZ+TRACK_BOUNDS.maxZ)/2)*scale]
const path=TRACK_SAMPLES.map((s,i)=>`${i?'L':'M'}${project(s.point.x,s.point.z).join(',')}`).join(' ')+' Z'
const summit=Math.round(Math.max(...TRACK_SAMPLES.map(s=>s.height)))

export function RaceMenu({onRace,onSetup,onTour,onCustomize}:{onRace:()=>void;onSetup:()=>void;onTour:()=>void;onCustomize:()=>void}){
 return <div className="race-menu">
  <section className="race-menu-copy" aria-labelledby="race-menu-title">
   <div className="race-menu-kicker"><span/>THE AFTERGLOW GRAND PRIX</div>
   <h1 id="race-menu-title">CHASE<br/>THE <em>AFTERGLOW.</em></h1>
   <p className="race-menu-intro">From the waterfront to the skyline. Carve the banks, charge your drift and light up the night.</p>
   <div className="race-menu-format"><span>150<small>CC</small></span><span>6 RACERS</span><span>3 LAPS</span></div>
   <div className="race-menu-actions"><button type="button" className="primary" onClick={onRace}>LET’S RACE <span aria-hidden="true">↗</span></button><button type="button" onClick={onSetup}>SET UP HAND CONTROLS</button></div>
   <p className="race-menu-controls"><strong>WASD / ARROWS</strong> DRIVE <b>·</b> <strong>SHIFT</strong> DRIFT <b>·</b> <strong>SPACE</strong> ABILITY</p>
   <p className="race-menu-hands">Two fists accelerate. Open palm brakes, then reverses.<br/>Your camera feed stays on your device.</p>
   <div className="race-menu-extras"><button className="race-menu-tour" type="button" onClick={onTour}>EXPLORE THE CIRCUIT <span aria-hidden="true">→</span></button><button className="race-menu-tour race-menu-driver" type="button" onClick={onCustomize}>CREATE YOUR DRIVER <span aria-hidden="true">↗</span></button></div>
  </section>
  <aside className="race-menu-course" aria-label="Course preview">
   <div className="race-menu-course-top"><span>01 / CITY CIRCUIT</span><span className="race-menu-course-live">NIGHT RACE</span></div>
   <h2>AFTERGLOW CITY</h2><p>One city. Every elevation.</p>
   <svg viewBox="0 0 320 190" aria-label="Afterglow City route preview"><defs><linearGradient id="menu-route" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#57e9ec"/><stop offset=".5" stopColor="#9d91ff"/><stop offset="1" stopColor="#ff65b3"/></linearGradient></defs><path d={path} fill="none" stroke="#d3bcff12" strokeWidth="17"/><path d={path} fill="none" stroke="url(#menu-route)" strokeWidth="4" strokeLinejoin="round"/>{[0,.25,.5,.75].map((t,i)=>{const p=getTrackPoint(t),[x,y]=project(p.x,p.z);return <g key={t}><circle cx={x} cy={y} r="9" fill="#17132c" stroke={i===0?'#fff':'#8da6dd'} strokeWidth="1.5"/><text x={x} y={y+3} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="800">{i===0?'S':i}</text></g>})}</svg>
   <div className="race-menu-course-stats"><div><strong>{(TRACK_LENGTH/1000).toFixed(2)}<small> KM</small></strong><span>PER LAP</span></div><div><strong>{summit}<small> M</small></strong><span>SKYLINE SUMMIT</span></div><div><strong>{COURSE_SECTORS.length}<small> ×</small></strong><span>CONNECTED DISTRICTS</span></div></div>
  </aside>
 </div>
}
