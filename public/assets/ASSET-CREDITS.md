# Palm Prix — asset sources and reuse permissions

Afterglow City uses original Palm Prix geometry, shaders and graphics for its art-deco city, striped sun, elevated roadway, suspension bridge, market arcade, observatory halo and terraced streetscape. The owner's optional personal build uses Nintendo's Circuit Special and Mario Kart Tour Mii models from Models Resource, with coordinated team liveries and original Palm Prix wheels; these are **not CC0**, and their sources/contributor credits are in [personal/CREDITS.md](personal/CREDITS.md). Extracted binaries are local-only and ignored by Git; regular checkouts use the original neon racer fallback. No panorama image is mounted. The following older external assets remain with their original attribution and licenses. This file is shipped with the game; the Credits button provides an in-game attribution panel.

## Kenney — Car Kit 3.1
- Author: Kenney (https://kenney.nl).
- Primary asset page: https://kenney.nl/assets/car-kit
- Selected files (support vehicles retained for the older stadium): kart-oopi.glb, kart-ooli.glb, kart-oodi.glb, kart-oobi.glb, kart-oozi.glb, delivery.glb, ambulance.glb and their shared Textures/colormap.png.
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
The gameplay spline, road mesh, merged stadium seating, pit garages, lighting, signs, racing effects, UI and integration were created for Palm Prix. OpenWii was consulted as a driving/rendering reference: https://github.com/pattssun/OpenWii. No OpenWii asset pack is redistributed here. The optional local personal model set is documented separately below. Attribution is not treated as a substitute for an asset license.

The deferred older avatar garage retains its original Palm Prix driver and ambientCG Fabric030 maps (CC0): https://ambientcg.com/a/Fabric030. Older retained art sources and kitbash notes are documented in the repository root CREDITS.md.

CC0 legal text and summary: https://creativecommons.org/publicdomain/zero/1.0/

## Kenney — Nature Kit
- Primary source: https://kenney.nl/assets/nature-kit
- License: CC0 1.0; original license and selection notes at festival/LICENSE.txt and festival/CREDITS.md.
- Authored assets: tree_detailed, tree_detailed_fall, tree_pineTallA_detailed, rock_largeA, rock_tallB, mushroom_redGroup, mushroom_redTall.
- Changes: scaled/placed outside the racing corridor and batched with their original material colors. The crystal accents, festival wheel, balloon assemblies, boost-strip graphics and stamped Palm Prix tokens are original game artwork.

## Cloud Carnival — original world and Poly Haven Cliff Side
- Cliff Side: https://polyhaven.com/a/cliff_side
- Authors: James Ray Cock and Dario Barresi (photography), Jenelle van Heerden (processing).
- License: CC0 1.0. Files: cloud-carnival/cliff-diff.jpg and cliff-normal.jpg (1K JPEG); used for subtle relief on stylized floating islands.
- Original carousel, sculpted horses, gateway, booths, balloon fleet, wind-up airship, floating islands, ceramic material and animated waterfall tunnel were authored for this game.
- The cloud panorama is original AI-generated project artwork, generated with the built-in imagegen tool. Prompt and provenance: cloud-carnival/ARTWORK.md. It is separate from the third-party CC0 assets.
- The old stadium, scanned barriers and asphalt are retained in the repository but do not mount in Cloud Carnival.

## Optional local Models Resource set
The owner explicitly requested a personal, noncommercial build using Mario Kart 8 assets from The Models Resource. Teddy Buggy, Sweet Sweet Balloon and Aqua Cup Ride remain Nintendo artwork; they are NOT CC0. Upload contributors, exact source pages and limitations are documented at personal/CREDITS.md. Original archives, converted GLBs and the personal manifest are excluded from Git. The reusable source checkout uses the original/CC0 fallbacks; the personal flag must be disabled for a reusable/public build.

## On-device face customizer
- Face landmark inference: Google MediaPipe Tasks Vision / Face Landmarker, https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js.
- The model and WASM runtime load from their official Google/MediaPipe distributions. No model binary is redistributed in this repository.
- The personalized face geometry, toon treatment, glasses, customizer interface and feature-mapping code are original Palm Prix work. The scan does not modify or redistribute the optional Nintendo source models.
- User photos stay in the local browser and are not included in the repository or saved as assets.

### Optional Tomodachi Life avatar library

The local personal setup uses Nintendo's Tomodachi Life: Living the Dream avatar assets, packaged as GLB/PNG by zinccat (`mii_renderer`, pinned revision `970c22034c1d4cfee2bd7a491a1475d46bb63169`). Public model/face-part submissions are credited to Centrixe the Dodo. Full source links and restrictions are in `personal/CREDITS.md`. Extracted assets are not included in the public source checkout.

## Original retro HUD and combat effects

Chrome HUD lettering, vector ability emblems, holographic pickups, Shockwave/Neon Seeker/Echo Trap meshes, particle/reticle animations and their synthesized sound cues are original Palm Prix code. The user-provided retro title images informed the palette and chrome treatment; their artwork is not embedded or redistributed. No external models, textures or sound recordings were added for these effects.
