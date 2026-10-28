"""Install the optional personal Mii Creator part library. No creator program code is copied.
Source-available artwork is not a commercial/reusable asset grant; see personal/CREDITS.md.
"""
from pathlib import Path
import io, zipfile, urllib.request, hashlib, json
ROOT=Path(__file__).resolve().parents[1]
REV='9e009a614241c1326fee0b244d8bb4e662ec8c07'
URL=f'https://codeload.github.com/datkat21/mii-creator/zip/{REV}'
def main():
    raw=urllib.request.urlopen(URL,timeout=60).read()
    archive=zipfile.ZipFile(io.BytesIO(raw))
    output=ROOT/'public/assets/personal/mii-maker'
    output.mkdir(parents=True,exist_ok=True)
    manifest=[]
    for entry in archive.infolist():
        parts=Path(entry.filename).parts
        if len(parts)!=3 or parts[1]!='svg' or not parts[2].endswith('.svg'):
            continue
        data=archive.read(entry)
        # Keep the downloaded artwork local and separate from original/CC0 assets.
        (output/parts[2]).write_bytes(data)
        manifest.append({'name':parts[2],'sha256':hashlib.sha256(data).hexdigest()})
    (output/'manifest.json').write_text(json.dumps({'source':URL,'revision':REV,'parts':manifest},indent=2))
    print(f'Installed {len(manifest)} creator parts at {output}')
if __name__=='__main__':
    main()
