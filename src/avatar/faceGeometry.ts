import * as THREE from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import type {FaceProfile} from './faceProfile'
/** A real sculpted face: shared cartoon proportions, personalized by the scan. */
export function buildFaceGeometry(p:FaceProfile){
 const parts:THREE.BufferGeometry[]=[]
 const add=(g:THREE.BufferGeometry,color:string,position:[number,number,number]=[0,0,0],scale:[number,number,number]=[1,1,1],rotation=0)=>{
  g.scale(...scale);g.rotateZ(rotation);g.translate(...position);g.deleteAttribute('uv')
  const c=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3)
  for(let i=0;i<colors.length;i+=3)c.toArray(colors,i)
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(g)
 }
 const sphere=(color:string,position:[number,number,number],scale:[number,number,number],rotation=0)=>add(new THREE.SphereGeometry(1,16,10),color,position,scale,rotation)
 const skin=new THREE.Color(p.skin),shade='#'+skin.clone().multiplyScalar(.83).getHexString()
 const head=new THREE.SphereGeometry(1,24,16),v=head.attributes.position
 for(let i=0;i<v.count;i++){
  const y=v.getY(i),jaw=y<0?1+(p.jaw-1)*-y:1
  v.setXYZ(i,v.getX(i)*.156*p.faceWidth*jaw,y*.17*p.faceHeight,v.getZ(i)*.112)
 }
 head.computeVertexNormals();add(head,p.skin)
 sphere(p.skin,[0,-.17,-.055],[.055,.075,.055])
 // Sculpted almond lids retain the scanned aperture instead of generic tall eyes.
 const eyeMesh=(color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,side:number)=>{
  const g=new THREE.SphereGeometry(1,20,12),v=g.attributes.position
  if(p.eyeShape!=='round')for(let i=0;i<v.count;i++){
   const px=v.getX(i),py=v.getY(i)
   v.setY(i,py*Math.sqrt(Math.max(.04,1-px*px))*(p.eyeShape==='hooded'&&py>0?.65:1))
  }
  g.computeVertexNormals();add(g,color,[x,y,z],[sx,sy,sz],side*p.eyeTilt)
 }
 for(const side of [-1,1]){
  const x=side*.061*p.eyeSpacing,eye=(p.look==='portrait'?.92:1.08)*p.eyeSize,aperture=p.eyeAspect*(p.look==='portrait'?1:1.25),ey=p.eyeHeight
  if(p.eyeShape==='dot'){
   sphere('#211e30',[x,ey,.117],[.011*eye,.018*eye*aperture,.006])
   sphere('#fff9ef',[x-.003,ey+.005,.123],[.0025,.003,.002])
  }else{
   eyeMesh('#292237',x,ey,.101,.033*eye,.035*eye*aperture,.013,side)
   eyeMesh('#fff7ec',x,ey,.108,.028*eye,.027*eye*aperture,.012,side)
   sphere(p.eyes,[x,ey,.120],[.013*eye,.024*eye*aperture,.005])
   sphere('#171629',[x,ey,.124],[.008*eye,.018*eye*aperture,.003])
   sphere('#ffffff',[x-.004,ey+.005,.128],[.0035,.004,.002])
  }
  if(p.look==='graphic'){
   const browY=ey+.022+aperture*.009
   const brow=[new THREE.Vector3(x-.029,browY,.106),new THREE.Vector3(x,browY+.005,.109),new THREE.Vector3(x+.029,browY,.106)]
   const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(brow),8,.0045*p.browWeight,5,false)
   // Tilt around the brow centre without changing its facial placement.
   g.translate(-x,-browY,0);g.rotateZ(side*(-.07+p.browTilt));g.translate(x,browY,0);add(g,p.hair)
  }else sphere(p.hair,[x,ey+.022+aperture*.009,.101],[.036,.006*p.browWeight,.009],side*(-.07+p.browTilt))

 }
 // A bridge, alar wings and projecting tip give each nose a distinct silhouette.
 const noseY=p.noseHeight
 if(p.look==='graphic'){
  const w=.023*p.noseWidth,top=noseY+.026*p.noseLength,bottom=noseY-.011,z=.113,tip=z+.033*p.noseProjection
  const g=new THREE.BufferGeometry()
  g.setAttribute('position',new THREE.Float32BufferAttribute([-w,bottom,z,w,bottom,z,0,top,z,0,noseY,tip],3))
  g.setIndex([0,1,3,1,2,3,2,0,3,2,1,0]);const faceted=g.toNonIndexed();g.dispose();faceted.computeVertexNormals();faceted.setIndex(Array.from({length:faceted.attributes.position.count},(_,i)=>i));add(faceted,shade)
  const outline=new THREE.CatmullRomCurve3([new THREE.Vector3(0,top-.006,z+.003),new THREE.Vector3(-w*.8,bottom+.002,z+.010),new THREE.Vector3(w*.45,bottom+.002,z+.014)])
  add(new THREE.TubeGeometry(outline,8,.0016,4,false),'#'+skin.clone().multiplyScalar(.52).getHexString())
 }else if(p.look==='soft'){
  sphere(shade,[0,noseY-.003,.119],[.024*p.noseWidth,.020*p.noseLength,.023*p.noseProjection])
  sphere(p.skin,[0,noseY+.003,.128],[.021*p.noseWidth,.018*p.noseLength,.024*p.noseProjection])
 }else{
 sphere(p.skin,[0,noseY+.030,.110],[.012*p.noseWidth,.037*p.noseLength,.015*p.noseProjection])
 for(const side of [-1,1]){
  sphere(shade,[side*.016*p.noseWidth,noseY-.009,.119],[.012*p.noseWidth,.010,.017*p.noseProjection])
  sphere(shade,[side*.014*p.noseWidth,noseY-.015,.132],[.0045,.003,.004])
 }
 sphere(p.skin,[0,noseY,.127],[.018*p.noseWidth,.015,.025*p.noseProjection])
 }
 const mouthZ=Math.sqrt(Math.max(.01,1-(p.mouthHeight/(.17*p.faceHeight))**2))*.112
 if(p.smile>.3){
  sphere('#4b283c',[0,p.mouthHeight+.002,mouthZ+.003],[.042*p.mouthWidth,.005+p.smile*.014,.009])
  sphere('#fff1e4',[0,p.mouthHeight+.009,mouthZ+.011],[.035*p.mouthWidth,.003+p.smile*.006,.004])
 }
 const mouth:THREE.Vector3[]=[]
 for(let i=0;i<=16;i++){const x=(i/16-.5)*.083*p.mouthWidth;mouth.push(new THREE.Vector3(x,p.mouthHeight-p.smile*.01+(x/(.045*p.mouthWidth))**2*.018,mouthZ+.008))}
 add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouth),16,.0045,5,false),'#5b3248')
 sphere('#d98b8b',[0,p.mouthHeight-.011,mouthZ+.003],[.028*p.mouthWidth,.005*p.lipFullness,.006])
 if(p.facialHair!=='none'){
  const hairColor=p.facialHair==='stubble'?'#'+new THREE.Color(p.facialHairColor).lerp(skin,.45).getHexString():p.facialHairColor
  // Surface patches follow the jaw, with an opening around the lips.
  if(p.facialHair!=='moustache'){
   const positions:number[]=[],indices:number[]=[],cols=40,rows=12
   const extent=.135*p.faceWidth*(p.facialHair==='goatee'?.42:1)
   for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const x=(i/cols*2-1)*extent
    const cheek=Math.max(0,Math.min(1,(Math.abs(x)-.046*p.mouthWidth)/(.065*p.faceWidth)))
    const smooth=cheek*cheek*(3-2*cheek)
    const top=(p.mouthHeight-.027)*(1-smooth)-.040*smooth
    const bottom=-.17*p.faceHeight*Math.sqrt(Math.max(.04,1-(x/(.156*p.faceWidth*p.jaw))**2))*.98
    const y=top+(bottom-top)*j/rows
    const rx=.156*p.faceWidth*(1+(p.jaw-1)*Math.max(0,-y/(.17*p.faceHeight)))
    const z=Math.sqrt(Math.max(.003,1-(x/rx)**2-(y/(.17*p.faceHeight))**2))*.112+(p.facialHair==='stubble'?.003:.006)
    positions.push(x,y,z)
    if(j<rows&&i<cols){const k=j*(cols+1)+i;indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2)}
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();add(g,hairColor)
  }
  if(p.facialHair!=='stubble')for(const side of [-1,1])sphere(hairColor,[side*.024*p.mouthWidth,p.mouthHeight+.022,mouthZ+.008],[.028*p.mouthWidth,.009,.006],side*.16)
 }
 if(p.hairStyle!=='none'){
  add(new THREE.SphereGeometry(1,20,8,0,Math.PI*2,0,Math.PI*.30),p.hair,[0,.012,-.005],[.161*p.faceWidth,.173*p.faceHeight,.118])
  if(p.hairStyle==='swept')for(let i=0;i<3;i++)sphere(p.hair,[-.06+i*.055,.126+i*.006,.071],[.062,.019,.028],-.25)
  else for(let i=-2;i<=2;i++)sphere(p.hair,[i*.047,.131,.068],[.029,.016,.025])
 }
 if(p.glasses){
  for(const side of [-1,1])add(new THREE.TorusGeometry(.036,.0037,5,24),'#5bdce9',[side*.061*p.eyeSpacing,p.eyeHeight,.133],[1,.85,1])
  add(new THREE.BoxGeometry(.052,.004,.004),'#5bdce9',[0,p.eyeHeight+.003,.134])
 }
 const merged=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());merged.computeBoundingBox();merged.computeBoundingSphere();return merged
}
