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
 for(const side of [-1,1]){
  const x=side*.061*p.eyeSpacing,eye=.92*p.eyeSize
  sphere('#282235',[x,.026,.099],[.030*eye,.040*eye,.014])
  sphere('#fff1e4',[x,.027,.106],[.025*eye,.034*eye,.014])
  sphere(p.eyes,[x+side*.002,.027,.119],[.013*eye,.023*eye,.007])
  sphere('#171629',[x+side*.002,.027,.124],[.0065*eye,.015*eye,.004])
  sphere('#ffffff',[x-.006,.038,.128],[.004,.005,.003])
  sphere(p.hair,[x,.079,.099],[.037,.009,.012],side*(-.07+p.browTilt))
 }
 sphere(shade,[0,-.012,.119],[.020*p.noseWidth,.025,.026])
 sphere(p.skin,[0,-.007,.132],[.014*p.noseWidth,.018,.018])
 if(p.smile>.3){
  sphere('#4b283c',[0,-.068,.095],[.042*p.mouthWidth,.005+p.smile*.014,.009])
  sphere('#fff1e4',[0,-.061,.104],[.035*p.mouthWidth,.003+p.smile*.006,.004])
 }
 const mouth:THREE.Vector3[]=[]
 for(let i=0;i<=16;i++){const x=(i/16-.5)*.083*p.mouthWidth;mouth.push(new THREE.Vector3(x,-.070-p.smile*.01+(x/(.045*p.mouthWidth))**2*.018,.098))}
 add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouth),16,.0045,5,false),'#5b3248')
 sphere('#d98b8b',[0,-.081,.093],[.028*p.mouthWidth,.005,.006])
 if(p.hairStyle!=='none'){
  add(new THREE.SphereGeometry(1,20,8,0,Math.PI*2,0,Math.PI*.30),p.hair,[0,.012,-.005],[.161*p.faceWidth,.173*p.faceHeight,.118])
  if(p.hairStyle==='swept')for(let i=0;i<3;i++)sphere(p.hair,[-.06+i*.055,.126+i*.006,.071],[.062,.019,.028],-.25)
  else for(let i=-2;i<=2;i++)sphere(p.hair,[i*.047,.131,.068],[.029,.016,.025])
 }
 if(p.glasses){
  for(const side of [-1,1])add(new THREE.TorusGeometry(.036,.0037,5,24),'#5bdce9',[side*.061*p.eyeSpacing,.027,.133],[1,.85,1])
  add(new THREE.BoxGeometry(.052,.004,.004),'#5bdce9',[0,.03,.134])
 }
 const merged=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());merged.computeBoundingBox();merged.computeBoundingSphere();return merged
}
