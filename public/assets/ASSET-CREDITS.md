# Palm Prix — asset sources and reuse permissions

The assets loaded by the stadium race are explicitly licensed for reuse. This file is shipped with the game; the Credits button provides an in-game attribution panel.

## Kenney — Car Kit 3.1
- Author: Kenney (https://kenney.nl).
- Primary asset page: https://kenney.nl/assets/car-kit
- Selected files: kart-oopi.glb, kart-ooli.glb, kart-oodi.glb, kart-oobi.glb, kart-oozi.glb, delivery.glb, ambulance.glb and their shared Textures/colormap.png.
- License: **CC0 1.0 Universal**. Original pack license is included at racers/LICENSE.txt.
- Allows personal, educational and commercial use, modification and redistribution. Attribution is appreciated but not required; Palm Prix credits Kenney voluntarily.
- Changes: shared static geometry, material response, adjusted driver proportions, game scale and animated wheel pivots. Original models remain distributed unchanged.

## Poly Haven — Asphalt 02
- Author: **Rob Tuytel**.
- Asset: https://polyhaven.com/a/asphalt_02
- Files: track/asphalt-diff.jpg, track/asphalt-normal.jpg (1024px).
- License: **CC0**; https://polyhaven.com/license
- Integration: repeated road UVs, restrained normal-map strength and material tuning.

## Poly Haven — Concrete Road Barrier
- Author: **Amal Kumar**.
- Asset: https://polyhaven.com/a/concrete_road_barrier
- Runtime file: track/concrete-barrier-lod.glb.
- License: **CC0**; https://polyhaven.com/license
- Changes: Blender decimation from 60,928 to 9,138 triangles, 512px texture maps, exported GLB. Instanced at the pit wall.
- Downloaded source: assets/source/track in the repository. Rebuild script: scripts/optimize-track-asset.py.

## Original Palm Prix work and references
The gameplay spline, road mesh, merged stadium seating, pit garages, lighting, signs, racing effects, UI and integration were created for Palm Prix. OpenWii was consulted as a driving/rendering reference: https://github.com/pattssun/OpenWii. None of its extracted Nintendo models, characters, logos, audio or textures are shipped here. Attribution is not treated as a substitute for an asset license.

The deferred older avatar garage retains its original Palm Prix driver and ambientCG Fabric030 maps (CC0): https://ambientcg.com/a/Fabric030. Older retained art sources and kitbash notes are documented in the repository root CREDITS.md.

CC0 legal text and summary: https://creativecommons.org/publicdomain/zero/1.0/
