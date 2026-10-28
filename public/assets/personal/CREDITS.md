# Optional personal, noncommercial models

These local assets are game extracts, **not CC0** and not cleared for commercial use. Original Mario Kart 8 artwork and designs are copyright Nintendo. This optional asset set is used for the owner's personal, noncommercial project following their explicit request.

## Active personal Afterglow City racers

- **Circuit Special** — Mario Kart 8 (Wii U), uploaded by **BillyGaming964**. https://models.spriters-resource.com/wii_u/mariokart8/asset/342345/
- **Mii** — Mario Kart Tour (Mobile), uploaded by **Centrixe the Dodo**. https://models.spriters-resource.com/mobile/mariokarttour/asset/351442/
- Tire, alloy wheel, groove, hub, subframe, rear axle, front wishbone/knuckle and neutral face geometry: original Palm Prix work. Tires are fitted beneath the fenders, with each hub connected to the chassis. The supplied Mii suit/helmet prefab has no face geometry, so an original neutral face fills its opening. Face personalization remains deferred.
- Low racing stance: cockpit/engine/body lowered 25.5 cm between grounded tires; 25 cm front tire radius versus 35 cm rear radius, broad rear slicks and compact gold dampers. The driver follows the lowered seat. Wheels follow the road bank without an added steering lean that would lift tires off the surface.

Converted with `scripts/prepare-circuit-racer.py`. Only the high-detail Circuit Special body/light meshes and Mii body are retained; overlapping LODs are removed. The Mii rig is posed into the seat and baked. Original albedo atlases and authored normals are retained; unsupported packed source normal maps are not used as standard tangent maps. The runtime recolors blue kart paint and red suit fabric selectively, preserving white markings, carbon, gloves and visor. The player is cyan; the five rivals use coral, yellow, blue, purple and mint kart/suit pairings. Wheels steer and spin independently.

Download the two ZIP archives through their source pages, extract into `assets/source/personal/circuit-special/` and `assets/source/personal/tour-mii/`, then run `blender --background --python scripts/prepare-circuit-racer.py`. Set `VITE_PERSONAL_ASSETS=true` in ignored `.env.local` and rebuild. The exported `public/assets/personal/circuit-special.glb` embeds its textures and remains ignored by Git. Public checkouts use the original neon racer fallback; extracted model data is not pushed.

## Archived Carnival assets

- **Teddy Buggy** — Mario Kart 8 (Wii U), uploaded by **BillyGaming964**. https://models.spriters-resource.com/wii_u/mariokart8/asset/353826/
- **Hot Air Balloon (Sweet Sweet)** — Mario Kart 8 (Wii U), uploaded by **Centrixe the Dodo**. https://models.spriters-resource.com/wii_u/mariokart8/asset/314945/
- **Aqua Cup Ride** — Mario Kart 8 (Wii U), uploaded by **Centrixe the Dodo**. https://models.spriters-resource.com/wii_u/mariokart8/asset/316567/

Source-site usage terms: https://www.spriters-resource.com/page/tou/. Contributor credit is not a transfer of Nintendo's rights. These models must not be represented as original Palm Prix artwork or commercially reusable assets.

The original downloads in `assets/source/personal/`, converted GLBs in this directory, and the local manifest are excluded from Git. The public source checkout keeps the original/CC0 fallback art. Local conversion scripts are versioned for reproducibility.

Changes: FBX to embedded-texture GLB conversion, removal of overlapping LODs, smooth material setup and world-scale normalization. The personal player kart combines Teddy Buggy's textured body with Kenney Car Kit CC0 wheels and seated racer; Kenney source and license are documented in `../racers/CREDITS.md` and `../racers/LICENSE.txt`. The teacup platform and ride animation are original Palm Prix integration.

To restore a personal setup, download each archive through its source page, extract under `assets/source/personal/sweet-balloon`, `aqua-cups`, and `teddy-buggy`, then run the preparation scripts with Blender. Create `manifest.json` with the balloon/cups/kart paths and set `VITE_PERSONAL_ASSETS=true` in `.env.local`; restart or rebuild Vite. See the repository README for details.

## Local Mii Creator part library

- SVG artwork: Nintendo Mii designs, from **datkat21 / Mii Creator (Old Source)**, revision `9e009a614241c1326fee0b244d8bb4e662ec8c07`: https://github.com/datkat21/mii-creator/tree/9e009a614241c1326fee0b244d8bb4e662ec8c07/svg
- Reference requested by the user: https://miimaker.app/ (its embedded JMLuigi Scratch package is a separate creator).
- 347 SVGs: 12 face outlines, 132 hair, 60 eyes, 24 brows, 18 noses, 36 mouths, 20 glasses, 6 moustaches, 6 beard shapes, 12 makeup, 12 wrinkles, 9 headwear.
- The upstream snapshot is source-available and provides no explicit reusable asset license. Credit is not permission or a commercial license. This optional library remains in the local personal setup; the SVGs are ignored by Git and are not pushed.
- Install with `python scripts/prepare-mii-creator.py`. The pinned script downloads only the static SVG artwork, records its hashes, and does not execute the upstream creator.
- Palm Prix integration: removal of thumbnail face backgrounds, hair cutout masks, palette substitution, original closed rounded head geometry with front-projected creator artwork, composited transparent face parts, per-part transforms, selection UI, settings validation/import/export and local save. No face photos or raw landmarks are exported.
