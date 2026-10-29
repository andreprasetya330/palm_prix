import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=root/'assets/source/track/concrete_road_barrier.gltf'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
before=after=0
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH':continue
    before+=sum(len(p.vertices)-2 for p in obj.data.polygons)
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    dec=obj.modifiers.new('Race distance LOD','DECIMATE');dec.ratio=.15
    bpy.ops.object.modifier_apply(modifier=dec.name)
    after+=sum(len(p.vertices)-2 for p in obj.data.polygons)
    obj.select_set(False)
for image in bpy.data.images:
    if image.size[0]>512 or image.size[1]>512:image.scale(512,512)
bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/track/concrete-barrier-lod.glb'),export_format='GLB',export_animations=False)
print(f'Barrier LOD triangles: {before} -> {after}')
