"""Build a local-only front hair silhouette index from the installed native editor icons."""
import json, struct, zlib

def rgba_png(path):
    data=path.read_bytes();offset=8;compressed=b'';palette=[];alpha=[]
    while offset<len(data):
        size=struct.unpack_from('>I',data,offset)[0];kind=data[offset+4:offset+8];part=data[offset+8:offset+8+size];offset+=size+12
        if kind==b'IHDR':width,height,depth,colour,_,_,interlace=struct.unpack('>IIBBBBB',part)
        elif kind==b'IDAT':compressed+=part
        elif kind==b'PLTE':palette=list(zip(part[0::3],part[1::3],part[2::3]))
        elif kind==b'tRNS':alpha=list(part)
    if depth!=8 or interlace:raise ValueError('Expected non-interlaced 8-bit icon')
    channels={0:1,2:3,3:1,4:2,6:4}[colour];stride=width*channels;raw=zlib.decompress(compressed);rows=[];previous=bytearray(stride);at=0
    for _ in range(height):
        mode=raw[at];at+=1;row=bytearray(raw[at:at+stride]);at+=stride
        for x in range(stride):
            a=row[x-channels] if x>=channels else 0;b=previous[x];c=previous[x-channels] if x>=channels else 0
            if mode==1:predict=a
            elif mode==2:predict=b
            elif mode==3:predict=(a+b)//2
            elif mode==4:
                p=a+b-c;dist=[abs(p-a),abs(p-b),abs(p-c)];predict=[a,b,c][dist.index(min(dist))]
            else:predict=0
            row[x]=(row[x]+predict)&255
        rows.append(row);previous=row
    pixels=[]
    for row in rows:
        for x in range(width):
            p=row[x*channels:(x+1)*channels]
            if colour==6:pixels.append(tuple(p))
            elif colour==2:pixels.append((*p,255))
            elif colour==3:pixels.append((*palette[p[0]],alpha[p[0]] if p[0]<len(alpha) else 255))
            elif colour==4:pixels.append((p[0],p[0],p[0],p[1]))
            else:pixels.append((p[0],p[0],p[0],255))
    return width,height,pixels

def build_hair_index(out,catalog):
    cols,rows=24,28;styles=[]
    for ident,item in enumerate(catalog['hair']):
        bits='0'*(cols*rows)
        if item['model'] and item['icon'].endswith('.png'):
            width,height,pixels=rgba_png(out/item['icon']);mask=[]
            for gy in range(rows):
                for gx in range(cols):
                    hits=0
                    for dx,dy in [(-.25,-.25),(.25,-.25),(-.25,.25),(.25,.25)]:
                        x=round((.5+(-.85+(gx+.5+dx)/cols*1.7)*.48)*width)
                        y=round((.30+(-.55+(gy+.5+dy)/rows*1.95)*.49)*height)
                        if 0<=x<width and 0<=y<height:
                            r,g,b,a=pixels[y*width+x];hits+=a>180 and max(r,g,b)<65
                    mask.append('1' if hits>=2 else '0')
            bits=''.join(mask)
        styles.append({'id':ident,'mask':bits})
    result={'version':1,'cols':cols,'rows':rows,'styles':styles}
    (out/'hair-match.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
    return result
