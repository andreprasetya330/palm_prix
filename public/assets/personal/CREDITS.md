# Optional personal, noncommercial models

These local assets are game extracts, **not CC0** and not cleared for commercial use. Original Mario Kart 8 artwork and designs are copyright Nintendo. This optional asset set is used for the owner's personal, noncommercial project following their explicit request.

## Active personal Afterglow City racers

- **Circuit Special** — Mario Kart 8 (Wii U), uploaded by **BillyGaming964**. https://models.spriters-resource.com/wii_u/mariokart8/asset/342345/
- **Mii** — Mario Kart Tour (Mobile), uploaded by **Centrixe the Dodo**. https://models.spriters-resource.com/mobile/mariokarttour/asset/351442/
- Tire, alloy wheel, groove, hub and neutral face geometry: original Palm Prix work. The supplied Mii suit/helmet prefab has no face geometry, so an original neutral face fills its opening. Face personalization remains deferred.

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
