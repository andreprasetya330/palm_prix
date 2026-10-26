import {useEffect,useMemo} from 'react'
import * as THREE from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {getTrackSample,nearestTrack,ROAD_HALF_WIDTH} from '../game/trackLayout'

/** Physical places around the course: a suspension causeway, market arcade and terraced city blocks. */
export function CourseDistricts(){
 const signs=useMemo(()=>{
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384
  const ctx=canvas.getContext('2d')!
  for(const [i,label] of ['COASTAL SKYWAY','NIGHT MARKET','AFTERGLOW OBSERVATORY'].entries()){
   const y=i*128;ctx.fillStyle='#24223f';ctx.fillRect(0,y,1024,128)
   ctx.strokeStyle=i===1?'#ff72b8':'#54dee5';ctx.lineWidth=5;ctx.strokeRect(6,y+6,1012,116)
   ctx.fillStyle='#f6cfab';ctx.font=`italic 900 ${i===2?48:64}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,512,y+65)
   ctx.fillStyle='#f791a4';for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(32+j*25,y+87);ctx.lineTo(44+j*25,y+65);ctx.lineTo(56+j*25,y+87);ctx.fill()}
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map
 },[])
 const batches=useMemo(()=>{
  const parts:THREE.BufferGeometry[][]=[[],[],[],[],[]]
  const add=(batch:number,g:THREE.BufferGeometry,color:string)=>{
   g.deleteAttribute('uv');const c=new THREE.Color(color),values=new Float32Array(g.attributes.position.count*3)
   for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b}
   g.setAttribute('color',new THREE.BufferAttribute(values,3));parts[batch].push(g)
  }
  const box=(batch:number,p:THREE.Vector3,size:[number,number,number],color:string,yaw=0)=>add(batch,new THREE.BoxGeometry(...size).rotateY(yaw).translate(p.x,p.y,p.z),color)
  const at=(t:number,lane:number,y:number)=>{const s=getTrackSample(t);return s.point.clone().addScaledVector(s.normal,lane).add(new THREE.Vector3(0,y,0))}
  const tube=(batch:number,points:THREE.Vector3[],radius:number,color:string)=>add(batch,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(8,points.length*3),radius,5,false),color)
  // Streets, raised planted blocks, stepped kerbs and recessed paving fill the city between roads.
  // Each entire block is checked against the racing corridor, so no building platform clips a turn.
  for(let x=-156;x<=73;x+=12)for(let z=-147;z<=137;z+=12){
   const radius=6.9,s=nearestTrack(x,z)
   if(s.distance<ROAD_HALF_WIDTH+radius+2)continue
   const seed=Math.abs(Math.round(x*3+z)),park=seed%5===0
   box(0,new THREE.Vector3(x,-.16,z),[11.6,.22,11.6],'#29253e')
   box(0,new THREE.Vector3(x,.04,z),[10.7,.22,10.7],'#52506c')
   box(0,new THREE.Vector3(x,.2,z),[10.05,.14,10.05],park?'#234752':'#39324e')
   for(const side of [-1,1]){
    box(1,new THREE.Vector3(x+side*5.25,.17,z),[.05,.04,9.9],seed%2?'#48d9de':'#ed63a6')
    box(0,new THREE.Vector3(x,.3,z+side*4.4),[7.9,.18,.3],'#716478')
   }
   for(let line=-3;line<=3;line++)box(0,new THREE.Vector3(x+line*1.3,.277,z),[.025,.015,9.5],'#4c4260')
   if(park){
    box(0,new THREE.Vector3(x,.58,z),[6,.6,6],'#252b46')
    box(0,new THREE.Vector3(x,.9,z),[5.5,.12,5.5],'#32616a')
    const basin=new THREE.CylinderGeometry(2.1,2.6,.65,12).translate(x,.65,z);add(0,basin,'#766381')
    add(2,new THREE.CylinderGeometry(1.9,1.9,.035,32).translate(x,1,z),'#3ec8d8')
    tube(1,[new THREE.Vector3(x,1,z),new THREE.Vector3(x,3.4,z),new THREE.Vector3(x+.2,1.1,z+.4)],.055,'#75dfec')
   }
   // A few broad low-rise pavilions break up the narrow skyline silhouette.
   if(seed%11===0&&s.distance>28){
    box(0,new THREE.Vector3(x,2.1,z),[8.8,3.6,8.4],'#44425e')
    box(0,new THREE.Vector3(x,4.15,z),[9.6,.45,9.2],'#82718c')
    box(0,new THREE.Vector3(x,4.6,z),[5.8,.6,5.4],'#353651')
    for(const side of [-1,1]){
     box(2,new THREE.Vector3(x,2.5,z+side*4.23),[7.5,1.15,.035],'#488aab')
     box(1,new THREE.Vector3(x,3.85,z+side*4.65),[9.1,.06,.08],'#e16d9d')
    }
   }
  }
  // A stepped embankment and timber marina fingers break the straight channel edge.
  for(const z of [-81,-28,25,78]){
   box(0,new THREE.Vector3(85,-.2,z),[5,.7,13],'#64556e')
   box(0,new THREE.Vector3(88,-.05,z),[4,.4,10],'#7b6379')
   box(0,new THREE.Vector3(90,.03,z),[3,.25,7],'#977887')
   box(0,new THREE.Vector3(94,.1,z),[10,.18,2.8],'#735268')
   for(let plank=0;plank<25;plank++)box(0,new THREE.Vector3(89.2+plank*.39,.2,z),[.03,.018,2.75],'#413448')
   for(const side of [-1,1])for(const x of [90,97]){
    box(0,new THREE.Vector3(x,.5,z+side*1.4),[.12,1.2,.12],'#52405b')
    box(1,new THREE.Vector3(x,1.1,z+side*1.4),[.2,.06,.2],'#ffb779')
   }
  }
  // Build retaining-wall terraces beside the lower road, leaving the high deck visibly open beneath.
  for(let i=0;i<180;i++){
   const t=i/180,s=getTrackSample(t)
   if(s.point.y>3.5)continue
   for(const side of [-1,1]){
    const p=at(t,side*11.6,-.48),clear=nearestTrack(p.x,p.z)
    if(clear.distance<10.7)continue
    p.y=(s.point.y-.56)/2
    box(0,p,[2.9,s.point.y+.08,2.9],'#39344f',s.yaw)
    box(0,at(t,side*11.6,-.15),[2.9,.18,2.9],'#6b5873',s.yaw)
    box(1,at(t,side*10.5,.02),[.055,.055,2.3],side<0?'#f168b4':'#40cddc',s.yaw)
   }
  }
  // Elevated coast: portal towers and continuous suspension cables frame the sky reveal.
  const bridgeStart=.17,bridgeEnd=.34
  // A connected city avenue passes beneath the racing deck; its ground-level sidewalks
  // and lane markings make the ten-metre separation legible from the climb and descent.
  const under=getTrackSample(.25)
  box(0,new THREE.Vector3(under.point.x,-.19,under.point.z),[48,.12,6.4],'#454057',under.yaw)
  for(const side of [-1,1]){
   const p=under.point.clone().addScaledVector(under.tangent,side*4);p.y=-.02
   box(0,p,[48,.24,1.5],'#7a6680',under.yaw)
  }
  for(let i=-11;i<=11;i++){
   const p=under.point.clone().addScaledVector(under.normal,i*2);p.y=-.12
   box(0,p,[1,.02,.09],'#e3b8ba',under.yaw)
  }
  for(const t of [bridgeStart,bridgeEnd]){
   const s=getTrackSample(t)
   for(const side of [-1,1]){
    const p=at(t,side*11.2,0),h=s.point.y+13
    box(0,new THREE.Vector3(p.x,h/2-.15,p.z),[1.7,h+.3,2.2],'#7c658e',s.yaw)
    box(1,at(t,side*11.2,6.5),[.13,12,.15],side<0?'#ee67bb':'#53dce8',s.yaw)
   }
   box(0,at(t,0,12),[24.2,1.1,2.2],'#957b9c',s.yaw)
   box(1,at(t,0,11.62),[22.5,.09,1.73],'#ffb770',s.yaw)
  }
  for(const side of [-1,1]){
   const cable:THREE.Vector3[]=[]
   for(let i=0;i<=40;i++){
    const u=i/40,t=bridgeStart+(bridgeEnd-bridgeStart)*u,drop=10-7*Math.sin(u*Math.PI)
    cable.push(at(t,side*10.4,drop))
    if(i%3===0)tube(0,[at(t,side*10.4,.6),at(t,side*10.4,drop)],.045,'#8b739e')
   }
   tube(1,cable,.075,side<0?'#ee67bb':'#53dce8')
  }
  // Night-market arcade: a genuinely covered sequence with repeated angled roof ribs.
  for(let i=0;i<=13;i++){
   const t=.48+i/13*.11,s=getTrackSample(t)
   for(const side of [-1,1]){
    box(0,at(t,side*11,3.7),[.55,7.8,.65],'#3b3b5b',s.yaw)
    box(1,at(t,side*10.68,3.7),[.09,6.8,.15],side<0?'#e968aa':'#58cbd5',s.yaw)
    box(0,at(t,side*14,1.4),[4.8,2.8,2.7],'#2a2845',s.yaw)
    box(3,at(t,side*13.2,3.05),[3.9,.23,3.2],i%2?'#c55791':'#418b9d',s.yaw)
   }
   tube(0,[at(t,-11,7.3),at(t,-5.5,9.4),at(t,5.5,9.4),at(t,11,7.3)],.2,'#686080')
   tube(1,[at(t,-10.7,7.25),at(t,-5.5,9.1),at(t,5.5,9.1),at(t,10.7,7.25)],.055,i%2?'#ee67bb':'#53dce8')
   // Alternating solid roof bays give enclosure without hiding every view of the skyline.
   if(i%3!==1)box(0,at(t,0,9.45),[12,.18,3.8],'#262c49',s.yaw)
  }
  // Observatory ring over the western return creates a unique navigation landmark.
  const ring=getTrackSample(.79),center=at(.79,0,11.6)
  const halo=new THREE.TorusGeometry(12.3,.22,6,64).rotateY(ring.yaw).translate(center.x,center.y,center.z)
  add(1,halo,'#f36aab')
  for(const side of [-1,1])box(0,at(.79,side*12,5.5),[.8,12,1.2],'#4b4266',ring.yaw)
  for(const [i,t,height] of [[0,.17,10.7],[1,.48,6.7],[2,.79,11]]){
   const sample=getTrackSample(t),p=at(t,0,height),g=new THREE.PlaneGeometry(i===2?15:16,1.7),uv=g.attributes.uv
   for(let v=0;v<uv.count;v++)uv.setY(v,(uv.getY(v)+2-i)/3)
   g.rotateY(sample.yaw+Math.PI);g.translate(p.x,p.y,p.z);parts[4].push(g)
  }
  return parts.map(gs=>{const g=mergeGeometries(gs)!;gs.forEach(p=>p.dispose());return g})
 },[])
 useEffect(()=>()=>{batches.forEach(g=>g.dispose());signs.dispose()},[batches,signs])
 return <group name="afterglow-course-districts">
  <mesh geometry={batches[0]} receiveShadow><meshStandardMaterial vertexColors roughness={.8} metalness={.12}/></mesh>
  <mesh geometry={batches[1]}><meshBasicMaterial vertexColors color={[2,2,2]} toneMapped={false}/></mesh>
  <mesh geometry={batches[2]}><meshBasicMaterial vertexColors toneMapped={false}/></mesh>
  <mesh geometry={batches[3]} receiveShadow><meshStandardMaterial vertexColors roughness={.9} side={THREE.DoubleSide}/></mesh>
  <mesh geometry={batches[4]}><meshBasicMaterial map={signs} toneMapped={false}/></mesh>
 </group>
}
