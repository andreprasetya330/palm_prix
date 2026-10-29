# Track and stadium asset credits

## Poly Haven (CC0)
- Asphalt 02, by **Rob Tuytel**: https://polyhaven.com/a/asphalt_02 — diffuse and OpenGL normal maps, 1024px. Downloaded from the official Poly Haven API/file CDN.
- Concrete Road Barrier, by **Amal Kumar**: https://polyhaven.com/a/concrete_road_barrier — glTF model, binary and 1024px texture maps. Instanced twelve times beside the pit complex.
- License: https://polyhaven.com/license (CC0 public domain dedication).

The circuit, merged grandstands, seating, pit garages, light masts and Palm Prix graphics are original geometry/graphics authored for this project. They are not extracted Mario Kart assets.

The user-provided OpenWii stadium-source.glb was evaluated but not incorporated: 55,552,092 bytes and provenance identifies Nintendo Mario Kart 8 assets excluded from OpenWii's software license. Adding that full stadium would also work against the lightweight rendering goal.

Track/world rendering batches static architecture by material. Asset textures are capped at 1024px. Floodlights use emissive panels rather than additional shadow-casting lights.

Barrier modification: reduced from 60,928 to 9,138 triangles in Blender, texture maps downsampled to 512px, exported as concrete-barrier-lod.glb. Original downloaded source is preserved in assets/source/track; rebuild with scripts/optimize-track-asset.py.
