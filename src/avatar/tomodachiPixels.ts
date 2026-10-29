import * as THREE from 'three'
/** Native textures store colour layers in RGB, not the final visible colours. */
export function tintNativePixels(input:Uint8ClampedArray,kind:string,colour:string){
 const out=new Uint8ClampedArray(input.length),c=new THREE.Color(colour)
 const srgb=(v:number)=>Math.round(255*(v<=.0031308?12.92*v:1.055*Math.max(0,v)**(1/2.4)-.055))
 for(let i=0;i<input.length;i+=4){
  const r=input[i]/255,g=input[i+1]/255,b=input[i+2]/255,a=input[i+3]/255
  let red=c.r,green=c.g,blue=c.b,alpha=a
  if(kind==='Eye'){red=r+g+b*c.r;green=r+g+b*c.g;blue=r+g+b*c.b}
  else if(kind==='Mouth'){red=(r+g)*c.r+b;green=(r+g)*c.g+b;blue=(r+g)*c.b+b}
  else if(kind==='Hair'){const weight=Math.max(.7,r+g);red=c.r*weight;green=c.g*weight;blue=c.b*weight}
  else alpha=kind==='BeardShort'?Math.max(r,g):r
  out[i]=srgb(Math.min(1,red));out[i+1]=srgb(Math.min(1,green));out[i+2]=srgb(Math.min(1,blue));out[i+3]=Math.round(alpha*255)
 }
 return out
}

/** Extraction conventions differ for these native mask categories. */
export function orientNativePixels(pixels:Uint8ClampedArray,width:number,height:number,kind:string){
 const flipX=['EyelashLower','EyelidUpper','EyelidLower','Highlight','MakeLower','WrinkleUpper','WrinkleLower'].includes(kind),flipY=['MakeLower','WrinkleLower'].includes(kind)
 if(!flipX&&!flipY)return pixels
 const out=new Uint8ClampedArray(pixels.length)
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const source=((flipY?height-1-y:y)*width+(flipX?width-1-x:x))*4;out.set(pixels.subarray(source,source+4),(y*width+x)*4)}
 return out
}
