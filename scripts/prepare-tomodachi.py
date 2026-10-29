"""Install pinned Tomodachi Life: Living the Dream models, textures and editor icons.
Artwork is Nintendo game data, installed locally and excluded from Git.
Only static data is copied. No upstream Python program is executed.
"""
from pathlib import Path
import argparse, urllib.request, zipfile, io, json, re, shutil, hashlib
from tomodachi_hair_index import build_hair_index
REV='970c22034c1d4cfee2bd7a491a1475d46bb63169'
URL=f'https://codeload.github.com/zinccat/mii_renderer/zip/{REV}'
ROOT=Path(__file__).resolve().parents[1]
# Stable index order: None, then numeric file order. Heads have no None entry.
MODELS={'face':('Head','Faceline'), 'hair':('HairAllLegacy','Hair'), 'nose':('Nose','Nose'), 'glasses':('Glass','Glass'),'goatee':('Beard','Beard'),'ear':('Ear','Ear'),'hairFront':('HairFront','HairFront'),'hairBack':('HairBack','HairBack')}
SPRITES={'eyes':'Eye','eyebrows':'Eyebrow','mouth':'Mouth','mustache':'Mustache','makeup':'MakeLower','wrinkles':'WrinkleLower','makeupUpper':'MakeUpper','wrinklesUpper':'WrinkleUpper','beardShort':'BeardShort','eyelashUpper':'EyelashUpper','eyelashLower':'EyelashLower','eyelidUpper':'EyelidUpper','eyelidLower':'EyelidLower','highlight':'Highlight'}
def property(text,key,default=''):
    m=re.search(r'(?:^|[,\n{])\s*'+re.escape(key)+r':\s*([^,\n}]+)',text)
    return m.group(1).strip().strip('"') if m else default

def install(source):
    assets=source/'assets';out=ROOT/'public/assets/personal/tomodachi';out.mkdir(parents=True,exist_ok=True)
    for directory in ['glb','miiparts_png','editor_icons','hair_textures']:
        shutil.copytree(assets/directory,out/directory,dirs_exist_ok=True)
    icons=out/'icons';icons.mkdir(exist_ok=True)
    (icons/'none.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="#787287" stroke-width="5"/><path d="M29 71L71 29" stroke="#787287" stroke-width="5"/></svg>')
    metadata=assets/'mii_metadata/MiiParts.pack/Mii/Parts'
    rows={p.name.split('.')[0]:p.read_text(encoding='utf-8') for p in metadata.glob('*.yaml')}
    def entry(key,model=None,sprite=None,meta=None):
        text=rows.get(meta or key,'');icon=property(text,'EditorIconName')
        if not icon:icon='MiiEditor_Face_'+(meta or key)+'_Uit'
        candidate=assets/'editor_icons'/('MiiEditorIcon_'+icon+'.png')
        if not candidate.exists():
            candidates=sorted((assets/'editor_icons').glob('MiiEditorIcon_MiiEditor_Face_'+(meta or key)+'*Uit.png'))
            candidate=candidates[0] if candidates else None
        item={'name':key,'model':model,'sprite':sprite,'icon':f'editor_icons/{candidate.name}' if candidate else 'icons/none.svg','rotation':float(property(text,'OffsetRotate','0'))*11.25}
        strand=assets/'hair_textures'/((Path(model).stem if model else key)+'.png')
        if strand.exists():item['texture']='hair_textures/'+strand.name
        return item
    catalog={}
    for category,(prefix,iconPrefix) in MODELS.items():
        files=sorted(p for p in (assets/'glb').glob('Mii'+prefix+'*.glb') if re.fullmatch('Mii'+prefix+r'\d+',p.stem))
        if category=='hair':files+=sorted(p for p in (assets/'glb').glob('MiiHairAll*.glb') if re.fullmatch(r'MiiHairAll\d+',p.stem))
        items=[] if category=='face' else [{'name':'None','model':None,'sprite':None,'icon':'icons/none.svg','rotation':0}]
        for model in files:
            name=model.stem[3:];meta=name
            if category=='face':meta='Faceline'+name[4:]
            items.append(entry(name,model='glb/'+model.name,meta=meta))
        catalog[category]=items
    for category,prefix in SPRITES.items():
        files=sorted(p for p in (assets/'miiparts_png').glob(prefix+'*.png') if re.fullmatch(prefix+r'\d+',p.stem))
        catalog[category]=[{'name':'None','model':None,'sprite':None,'icon':'icons/none.svg','rotation':0}]+[entry(p.stem,sprite='miiparts_png/'+p.name) for p in files]
    for category,items in catalog.items():
        for index,item in enumerate(items):
            sourceIcon=out/item['icon'];target=icons/f'{category}-{index}.png'
            if sourceIcon.suffix=='.png':shutil.copyfile(sourceIcon,target)
            else:(icons/f'{category}-{index}.svg').write_text(sourceIcon.read_text())
            item['icon']=f'icons/{category}-{index}'+sourceIcon.suffix
    build_hair_index(out,catalog)
    manifest={'version':2,'source':'https://github.com/zinccat/mii_renderer','revision':REV,'categories':catalog}
    (out/'catalog.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
    print('Installed categories:',{k:len(v) for k,v in catalog.items()})
    print('Models and textures remain local:',out)
    return manifest

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path);args=parser.parse_args()
    source=args.source
    if not source:
        source=ROOT/'assets/source/personal/tomodachi';source.mkdir(parents=True,exist_ok=True)
        raw=urllib.request.urlopen(URL,timeout=90).read();archive=zipfile.ZipFile(io.BytesIO(raw))
        for item in archive.infolist():
            rel=Path(*Path(item.filename).parts[1:])
            if item.is_dir() or '..' in rel.parts:continue
            target=source/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(item))
        (source/'archive-sha256.txt').write_text(hashlib.sha256(raw).hexdigest())
    install(source)
if __name__=='__main__':main()
