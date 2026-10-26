import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { getTrackSample, nearestTrack, ROAD_HALF_WIDTH, TRACK_BOUNDS } from '../game/trackLayout'

/** Original modeled architecture and graphic signs. No photos, licensed models or carnival assets. */
const P={navy:'#202943',plum:'#44345e',indigo:'#39446d',concrete:'#4b5277',cyan:'#48c8d2',pink:'#ed63a6',orange:'#f49a59',window:'#edb67d',dark:'#14233d'}
type Point=[number,number,number]
type Batches={solid:THREE.BufferGeometry[];glow:THREE.BufferGeometry[];windows:THREE.BufferGeometry[];signs:THREE.BufferGeometry[]}
function colorize(geometry:THREE.BufferGeometry,color:string){
  const g=geometry.index?geometry.toNonIndexed():geometry
  if(g!==geometry)geometry.dispose()
  for(const name of Object.keys(g.attributes))if(!['position','normal'].includes(name))g.deleteAttribute(name)
  if(!g.attributes.normal)g.computeVertexNormals()
  const c=new THREE.Color(color),values=new Float32Array(g.attributes.position.count*3)
  for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b}
  g.setAttribute('color',new THREE.BufferAttribute(values,3));return g
}
function combine(parts:THREE.BufferGeometry[]){
  const g=parts.length?mergeGeometries(parts,false)!:new THREE.BufferGeometry()
  parts.forEach(p=>p.dispose());g.computeBoundingSphere();return g
}
function transform(g:THREE.BufferGeometry,p:Point=[0,0,0],rotation:Point=[0,0,0],scale:Point=[1,1,1]){
  g.scale(...scale);g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)));g.translate(...p);return g
}
function box(parts:THREE.BufferGeometry[],color:string,p:Point,size:Point,rotation:Point=[0,0,0]){parts.push(transform(colorize(new THREE.BoxGeometry(...size),color),p,rotation))}
function roundedTower(w:number,d:number,h:number,bevel=.45){
  const shape=new THREE.Shape(),x=w/2,z=d/2,r=Math.min(bevel,x/2,z/2)
  shape.moveTo(-x+r,-z);shape.lineTo(x-r,-z);shape.quadraticCurveTo(x,-z,x,-z+r);shape.lineTo(x,z-r);shape.quadraticCurveTo(x,z,x-r,z);shape.lineTo(-x+r,z);shape.quadraticCurveTo(-x,z,-x,z-r);shape.lineTo(-x,-z+r);shape.quadraticCurveTo(-x,-z,-x+r,-z)
  const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:4});g.rotateX(-Math.PI/2);return g
}
function sourceSign(index:number,w:number,h:number,curved=false){
  const g=curved?new THREE.CylinderGeometry(w/1.3,w/1.3,h,40,1,true,-.65,1.3):new THREE.PlaneGeometry(w,h)
  const uv=g.attributes.uv,col=index%4,row=Math.floor(index/4)
  for(let i=0;i<uv.count;i++)uv.setXY(i,(col+0.025+uv.getX(i)*.95)/4,1-(row+.025+(1-uv.getY(i))*.95)/2)
  return g
}
function makeSigns(){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=512
  const ctx=canvas.getContext('2d')!,brands=['PALM PRIX','AFTER HOURS','RADIO 99','COASTLINE','NIGHT MARKET','SUNSET HOTEL','NEON ARCADE','24 / 7']
  brands.forEach((brand,i)=>{
    const x=i%4*512,y=Math.floor(i/4)*256;ctx.save();ctx.beginPath();ctx.rect(x,y,512,256);ctx.clip()
    ctx.fillStyle=i%2?'#241b3c':'#122c43';ctx.fillRect(x,y,512,256)
    ctx.strokeStyle=i%2?'#ed63a6':'#48c8d2';ctx.lineWidth=7;ctx.strokeRect(x+13,y+13,486,230)
    ctx.fillStyle='#f49a59';ctx.beginPath();ctx.arc(x+434,y+64,43,0,Math.PI*2);ctx.fill()
    ctx.fillStyle='#241b3c';for(let line=0;line<4;line++)ctx.fillRect(x+388,y+66+line*10,92,4)
    ctx.fillStyle='#f8e4cf';ctx.textAlign='left';ctx.textBaseline='middle';ctx.font=`900 ${brand.length>11?48:57}px Arial`;ctx.fillText(brand,x+29,y+123,455)
    ctx.font='700 18px monospace';ctx.fillStyle=i%2?'#ed63a6':'#48c8d2';ctx.fillText(['COAST TO COAST / GRAND PRIX','OPEN TIL THE SUN COMES UP','STEREO / 99.0 FM','PACIFIC DREAMS'][i%4],x+31,y+182)
    ctx.strokeStyle='#49607a';ctx.lineWidth=2;for(let j=0;j<6;j++){ctx.beginPath();ctx.moveTo(x+20+j*90,y+246);ctx.lineTo(x+256,y+198);ctx.stroke()}
    ctx.restore()
  })
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map
}
function useToonRamp(){
  const ramp=useMemo(()=>{const t=new THREE.DataTexture(new Uint8Array([55,110,175,240]),4,1,THREE.RedFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t},[])
  useEffect(()=>()=>ramp.dispose(),[ramp]);return ramp
}
function architecture(){
  const b:Batches={solid:[],glow:[],windows:[],signs:[]}
  let count=0
  const build=(cx:number,cz:number,w:number,d:number,h:number,yaw:number,variant:number)=>{
    const radius=Math.hypot(w+3,d+3)/2
    // Root owns the east-coast water channel (x84..126); keep foundations out of it.
    if(cx+radius>84&&cx-radius<126&&Math.abs(cz)<130+radius)return false
    if(nearestTrack(cx,cz).distance<ROAD_HALF_WIDTH+8+radius)return false
    const local=(x:number,y:number,z:number):Point=>[cx+Math.cos(yaw)*x+Math.sin(yaw)*z,y,cz-Math.sin(yaw)*x+Math.cos(yaw)*z]
    const add=(g:THREE.BufferGeometry,color:string,p:Point=[0,0,0],glow=false)=>{const transformed=transform(colorize(g,color),p);transformed.rotateY(yaw);transformed.translate(cx,0,cz);b[glow?'glow':'solid'].push(transformed)}
    const cube=(color:string,p:Point,size:Point,emissive=false)=>add(new THREE.BoxGeometry(...size),color,p,emissive)
    const body=[P.navy,P.plum,P.indigo][variant%3],light=variant%2?P.pink:P.cyan
    // Continuous sidewalks and low plinths visually anchor every building to the city surface.
    cube(P.concrete,[0,.15,0],[w+2,.3,d+2]);cube(P.dark,[0,.42,0],[w+1,.25,d+1])
    const hero=variant===3
    add(roundedTower(w,d,h,hero?2.2:.6),body)
    const levels=hero?4:variant%3===0?3:2
    for(let tier=1;tier<=levels;tier++){
      const tw=w*(1-tier*.17),td=d*(1-tier*.17),th=2.1+(variant%3)*.55
      add(roundedTower(tw,td,th,.35),body,[0,h+(tier-1)*th,0])
      cube(light,[0,h+tier*th+.06,td/2],[tw,.1,.12],true)
      cube(light,[0,h+tier*th+.06,-td/2],[tw,.1,.12],true)
    }
    // Horizontal cornices, dark ribbon glazing and lit windows on all four elevations.
    for(let floor=0;floor<Math.floor((h-3)/2.5);floor++){
      const y=3.2+floor*2.5
      for(let side=0;side<4;side++){
        const width=side%2?d:w,z=side%2?w/2:d/2,angle=side*Math.PI/2
        const facePoint=(x:number,py:number,offset:number):Point=>local(Math.cos(angle)*x+Math.sin(angle)*offset,py,-Math.sin(angle)*x+Math.cos(angle)*offset)
        const trim=new THREE.PlaneGeometry(width-.35,1.55)
        b.solid.push(transform(colorize(trim,P.dark),facePoint(0,y,z+.015),[0,yaw+angle,0]))
        for(let cell=0;cell<Math.floor(width/1.5)-1;cell++){
          if((cell*7+floor*3+variant)%9<3)continue
          const x=-width/2+1.4+cell*1.5
          const tint=(cell+floor+variant)%5===0?light:P.window
          const g=new THREE.PlaneGeometry(1.02,1.1)
          b.windows.push(transform(colorize(g,tint),facePoint(x,y,z+.04),[0,yaw+angle,0]))
        }
      }
      if(floor%3===0){cube(P.concrete,[0,y-1.05,0],[w+.16,.12,d+.16]);cube(light,[0,y-.95,d/2+.12],[w-.5,.055,.07],true)}
    }
    // Art-deco fluted piers, sheltered ground-floor arcade and functional entrance.
    for(const x of [-w/2+.6,w/2-.6]){
      cube(P.concrete,[x,h/2,d/2+.18],[.32,h,.35])
      cube(light,[x,h/2,d/2+.38],[.055,h-.6,.065],true)
    }
    cube(P.dark,[0,1.4,d/2+.02],[2.1,2.5,.1]);cube(P.concrete,[0,2.8,d/2+.6],[3.5,.2,1.6])
    for(const x of [-.8,.8])cube(light,[x,1.4,d/2+.1],[.045,2.3,.05],true)
    const brand=variant%8,signW=Math.min(w-1,8.8)
    cube(P.dark,[0,h-1.2,d/2+.35],[signW+.4,2.8,.4])
    b.signs.push(transform(sourceSign(brand,signW,2.5),local(0,h-1.2,d/2+.57),[0,yaw,0]))
    if(hero){
      // A memorable Miami-deco hotel: rounded lower pavilion, wraparound marquee,
      // stepped blade crown and fluted central tower, all attached to the building.
      add(roundedTower(w+2,d+2,3.2,2.4),P.plum,[0,0,0])
      add(roundedTower(w+2.5,d+2.5,.22,2.6),P.concrete,[0,3.2,0])
      const marqueeW=w+1.5,radius=marqueeW/1.3,marqueeZ=d/2-radius+1.1
      b.signs.push(transform(sourceSign(1,marqueeW,3.1,true),local(0,5.1,marqueeZ),[0,yaw,0]))
      for(const y of [3.48,6.72]){
        const points=Array.from({length:33},(_,i)=>{const a=-.65+i/32*1.3;return new THREE.Vector3(Math.sin(a)*radius,y,Math.cos(a)*radius+marqueeZ)})
        add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,.065,6,false),P.cyan,[0,0,0],true)
      }
      for(let fin=-3;fin<=3;fin++){
        const extra=8-Math.abs(fin)*1.3
        cube(P.concrete,[fin*.62,h+4+extra/2,0],[.28,extra,2.3])
        cube(fin%2?P.pink:P.cyan,[fin*.62,h+4+extra/2,1.2],[.075,extra,.08],true)
      }
      for(const x of [-w*.25,0,w*.25]){
        cube(P.concrete,[x,h*.57,d/2+.18],[.32,h*.6,.32])
        cube(P.cyan,[x,h*.57,d/2+.37],[.06,h*.6,.06],true)
      }
      // Fan-shaped relief references classic art-deco sunbursts without a copied logo.
      for(let ray=0;ray<9;ray++){
        const a=-Math.PI*.45+ray/8*Math.PI*.9,len=1.5+Math.sin(ray/8*Math.PI)*1.1
        const g=new THREE.BoxGeometry(.12,len,.08);g.rotateZ(-a);g.translate(Math.sin(a)*len*.5,h-4+Math.cos(a)*len*.5,d/2+.45)
        add(g,P.orange,[0,0,0],true)
      }
    }
    if(variant%4===0){
      cube(P.concrete,[0,h+levels*2.1+2,0],[.2,4,.2]);add(new THREE.SphereGeometry(.25,12,8),P.pink,[0,h+levels*2.1+4,0],true)
    }
    count++;return true
  }
  // Two skyline rings give depth in chase views; the coast-side sector remains open to the horizon.
  for(let i=0;i<30;i++){
    const t=i/30,sample=getTrackSample(t),w=7+i%4*1.8,d=7.5+i%3*2,h=15+i%7*4.1
    const radius=Math.hypot(w+2,d+2)/2,offset=ROAD_HALF_WIDTH+10+radius+i%2*2
    const p=sample.point.clone().addScaledVector(sample.normal,-offset)
    build(p.x,p.z,w,d,h,sample.yaw+Math.PI/2,i)
  }
  for(let i=0;i<16;i++){
    const sample=getTrackSample(i/16+.03),offset=ROAD_HALF_WIDTH+38+i%3*7,p=sample.point.clone().addScaledVector(sample.normal,-offset)
    build(p.x,p.z,10+i%3*2,10+i%2*3,37+i%5*6,sample.yaw+Math.PI/2,i+32)
  }
  for(const [i,x,z] of [[0,-17,-23],[1,4,-29],[2,22,-22],[3,-13,0],[4,12,0],[5,-8,19],[6,12,20]])build(x,z,8+i%2*2,9,14+i%4*5,-.15+i*.08,i+64)
  // Across the channel, taller silhouettes cut into the sunset without blocking the waterfront.
  for(let i=0;i<9;i++)build(148+i%3*15,-84+Math.floor(i/3)*64,10+i%2*3,12,32+i%4*9,-Math.PI/2,i+80)
  // A real overhead metro viaduct: road clear below at 8.6m; supports sit beyond its verge.
  const over=getTrackSample(.64),offset=ROAD_HALF_WIDTH+13
  const a=over.point.clone().addScaledVector(over.normal,offset),c=over.point.clone().addScaledVector(over.normal,-offset)
  if(nearestTrack(a.x,a.z).distance>ROAD_HALF_WIDTH+10&&nearestTrack(c.x,c.z).distance>ROAD_HALF_WIDTH+10){
    for(const side of [-1,1]){
      const p=over.point.clone().addScaledVector(over.normal,side*offset)
      box(b.solid,P.navy,[p.x,(over.point.y+9)/2,p.z],[1.5,over.point.y+9,3],[0,over.yaw,0])
      box(b.glow,P.cyan,[p.x,over.point.y+4.5,p.z],[1.55,.09,3.05],[0,over.yaw,0])
    }
    box(b.solid,P.concrete,[over.point.x,over.point.y+9,over.point.z],[offset*2+2,.8,9],[0,over.yaw,0])
    for(const side of [-1,1]){
      const p=over.point.clone().addScaledVector(over.tangent,side*4.5)
      box(b.solid,P.navy,[p.x,over.point.y+10,p.z],[offset*2+2,1.2,.3],[0,over.yaw,0])
      box(b.glow,P.pink,[p.x,over.point.y+10.6,p.z],[offset*2+2,.08,.35],[0,over.yaw,0])
    }
  }
  return {solid:combine(b.solid),glow:combine(b.glow),windows:combine(b.windows),signs:combine(b.signs),buildingCount:count}
}
function palmLeaf(){
  const p:number[]=[],indices:number[]=[]
  for(let i=0;i<=20;i++){
    const t=i/20,width=Math.sin(t*Math.PI)*(.32+(i%2)*.11)
    for(const side of [-1,1])p.push(t*3.8,Math.sin(t*Math.PI)*.65-t*t*1.15,side*width)
    if(i<20){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3)}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g
}
function streetscape(){
  const solid:THREE.BufferGeometry[]=[],glow:THREE.BufferGeometry[]=[],foliage:THREE.BufferGeometry[]=[]
  // East-coast quay: uninterrupted geometry, physically grounded at the water's boundary.
  box(solid,'#383451',[79,-.05,-9],[8,.65,242]);box(solid,P.navy,[83,-.45,-9],[.55,1.7,242])
  box(solid,'#36334e',[130,-.05,-9],[8,.65,242]);box(solid,P.navy,[126,-.45,-9],[.55,1.7,242])
  for(const x of [82.5,126.5]){
    box(glow,P.pink,[x,.45,-9],[.09,.08,240])
    for(let z=-128;z<111;z+=6){box(solid,P.concrete,[x,.7,z],[.12,1.2,.12]);box(glow,P.cyan,[x,1.3,z],[.22,.08,.22])}
    box(solid,P.concrete,[x,1.22,-9],[.09,.09,240])
  }
  // Promenade paving joints, mooring bollards, recessed planters and curb-side lights.
  for(let z=-123;z<110;z+=8){
    box(solid,P.navy,[79,.285,z],[7.8,.018,.045]);box(solid,P.navy,[130,.285,z],[7.8,.018,.045])
    if(Math.round(z)%3===0){
      box(solid,P.dark,[80,.5,z],[1.4,.5,1.4]);box(solid,P.concrete,[80,.78,z],[1.6,.12,1.6])
      box(solid,P.navy,[127.2,.6,z],[.35,.65,.4])
    }
  }
  const leaf=palmLeaf()
  const plant=(x:number,z:number,height:number,seed:number)=>{
    if(nearestTrack(x,z).distance<ROAD_HALF_WIDTH+5)return
    const lean=(seed%2?1:-1)*.65
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(lean*.15,height*.32,.1),new THREE.Vector3(lean*.6,height*.72,.2),new THREE.Vector3(lean,height,0)])
    foliage.push(transform(colorize(new THREE.TubeGeometry(curve,16,.14,7,false),'#574057'),[x,.3,z]))
    for(let i=0;i<9;i++)foliage.push(transform(colorize(leaf.clone(),i%3?'#214e5e':'#326c77'),[x+lean,height+.3,z],[0,i/9*Math.PI*2+seed,.07*(i%3)]))
    for(let i=0;i<3;i++)foliage.push(transform(colorize(new THREE.SphereGeometry(.17,8,6),'#775160'),[x+lean+Math.sin(i*2)*.18,height+.1,z+Math.cos(i*2)*.18]))
    const base=roundedTower(1.2,1.2,.35,.16);solid.push(transform(colorize(base,P.concrete),[x,0,z]))
  }
  for(let i=0;i<21;i++){plant(77.5,-117+i*11,6.7+i%4*.65,i);if(i%2===0)plant(132,-115+i*11,7.2+i%3*.75,i+30)}
  // Street palms give the inland sections a recognizable silhouette as well.
  for(let i=0;i<28;i++){
    const sample=getTrackSample(i/28+.01),p=sample.point.clone().addScaledVector(sample.normal,i%2?ROAD_HALF_WIDTH+7:-(ROAD_HALF_WIDTH+7))
    if(p.x>84&&p.x<126&&Math.abs(p.z)<132)continue
    plant(p.x,p.z,5.2+i%3*.8,i+80)
  }
  leaf.dispose()
  // Restrained road-facing streetlight heads: emissive strips rather than extra light sources.
  for(let i=0;i<24;i++){
    const sample=getTrackSample(i/24),p=sample.point.clone().addScaledVector(sample.normal,ROAD_HALF_WIDTH+5)
    if(nearestTrack(p.x,p.z).distance<ROAD_HALF_WIDTH+3)continue
    box(solid,P.navy,[p.x,(sample.point.y+6.8)/2,p.z],[.12,sample.point.y+6.8,.12])
    box(solid,P.concrete,[p.x,sample.point.y+6.75,p.z],[2.2,.14,.3],[0,sample.yaw,0])
    box(glow,i%2?P.pink:P.cyan,[p.x,sample.point.y+6.68,p.z],[2,.035,.22],[0,sample.yaw,0])
  }
  return{solid:combine(solid),glow:combine(glow),foliage:combine(foliage)}
}
function mountains(){
  const cx=(TRACK_BOUNDS.minX+TRACK_BOUNDS.maxX)/2,cz=(TRACK_BOUNDS.minZ+TRACK_BOUNDS.maxZ)/2
  const vertices:number[]=[],indices:number[]=[],count=128
  // One continuous low coastal range. Layered ridgelines avoid isolated pyramid silhouettes.
  for(let ring=0;ring<4;ring++)for(let i=0;i<=count;i++){
    const a=i/count*Math.PI*2
    const peaks=17+3.8*Math.sin(a*5+.3)+2.7*Math.sin(a*11+1.2)+1.5*Math.cos(a*19)
    const radius=[182,212,239,280][ring]+Math.sin(a*7)*4
    const height=ring===0||ring===3?-1:ring===1?peaks*.65:peaks
    vertices.push(cx+Math.sin(a)*radius,height,cz+Math.cos(a)*radius)
  }
  for(let ring=0;ring<3;ring++)for(let i=0;i<count;i++){
    const a=ring*(count+1)+i,b=a+count+1
    indices.push(a,b,a+1,a+1,b,b+1)
  }
  const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));indexed.setIndex(indices)
  const g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals()
  return colorize(g,'#41365c')
}
export function NeonCity(){
  const city=useMemo(architecture,[]),street=useMemo(streetscape,[]),ridges=useMemo(mountains,[]),atlas=useMemo(makeSigns,[]),ramp=useToonRamp()
  useEffect(()=>()=>{
    city.solid.dispose();city.glow.dispose();city.windows.dispose();city.signs.dispose()
    street.solid.dispose();street.glow.dispose();street.foliage.dispose();ridges.dispose();atlas.dispose()
  },[city,street,ridges,atlas])
  return <group name="original-neon-waterfront-city">
    <mesh geometry={city.solid} castShadow receiveShadow><meshToonMaterial vertexColors gradientMap={ramp}/></mesh>
    <mesh geometry={city.windows}><meshBasicMaterial vertexColors toneMapped={false}/></mesh>
    <mesh geometry={city.glow}><meshBasicMaterial vertexColors color={[2,2,2]} toneMapped={false}/></mesh>
    <mesh geometry={city.signs}><meshBasicMaterial map={atlas} toneMapped={false}/></mesh>
    <mesh geometry={street.solid} receiveShadow><meshToonMaterial vertexColors gradientMap={ramp}/></mesh>
    <mesh geometry={street.glow}><meshBasicMaterial vertexColors color={[2,2,2]} toneMapped={false}/></mesh>
    <mesh geometry={street.foliage} castShadow><meshToonMaterial vertexColors gradientMap={ramp} side={THREE.DoubleSide}/></mesh>
    <mesh geometry={ridges}><meshToonMaterial vertexColors gradientMap={ramp} side={THREE.DoubleSide}/></mesh>
  </group>
}
