import {COURSE_SECTORS,getTrackSample} from '../game/trackLayout'
const descriptions=[
 'Launch from the marina and sweep past the coastal skyline before the long climb.',
 'An 18-metre suspension bridge opens the view across the water and the city below.',
 'Link the north-shore curves through a series of stepped coastal terraces.',
 'Climb through uptown toward the highest point of the circuit. Save a turbo for the ascent.',
 'Race 24 metres above the streets across illuminated rooftops and beneath the observatory halo.',
 'Dive into the covered market arcade, framed by glowing roof ribs and storefronts.',
 'Unwind onto the home straight. Charge one last drift before the checkered line.',
]
export function CourseTour({index,onSelect,onBack,onRace}:{index:number;onSelect:(index:number)=>void;onBack:()=>void;onRace:()=>void}){
 const sector=COURSE_SECTORS[index],height=Math.round(getTrackSample((sector.start+sector.end)/2).height)
 return <section className="course-tour" aria-label="Course tour"><div className="course-tour-copy"><small>COURSE TOUR / {String(index+1).padStart(2,'0')} OF 07</small><h1>{sector.name}</h1><p>{descriptions[index]}</p><span>{height} M ABOVE THE CITY</span></div><nav aria-label="Choose a course district">{COURSE_SECTORS.map((s,i)=><button key={s.name} type="button" aria-current={index===i?'step':undefined} onClick={()=>onSelect(i)}><span>{String(i+1).padStart(2,'0')}</span>{s.name}</button>)}</nav><div className="course-tour-actions"><button type="button" onClick={onBack}>← BACK TO GRID</button><button type="button" className="primary" onClick={onRace}>LET’S RACE ↗</button></div></section>
}
