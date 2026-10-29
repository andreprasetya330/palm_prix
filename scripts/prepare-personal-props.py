"""Prepare locally supplied balloon or Aqua Cup models for a personal prototype.
Run: blender --background --python scripts/prepare-personal-props.py
Optional after --: --asset aqua-cups --preview PATH.png. Original model: Nintendo; extraction:
Centrixe the Dodo, https://models.spriters-resource.com/wii_u/mariokart8/asset/314945/
Aqua Cup: Nintendo; extraction: Centrixe the Dodo,
https://models.spriters-resource.com/wii_u/mariokart8/asset/316567/
This converter does not download, license, or authorize redistribution of assets.
"""
import argparse
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--preview')
parser.add_argument('--asset', choices=['sweet-balloon','aqua-cups'], default='sweet-balloon')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
source = root / 'assets/source/personal' / args.asset / ('Hot Air Balloon (Sweet Sweet)' if args.asset == 'sweet-balloon' else 'Aqua Cup Ride')
target_height = 8 if args.asset == 'sweet-balloon' else 4
output = root / 'public/assets/personal' / (args.asset + '.glb')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(source / ('CakeBalloon.fbx' if args.asset == 'sweet-balloon' else 'CoffeeCup.fbx')), use_anim=False)
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if not meshes:
    raise RuntimeError('FBX contains no meshes')
print('IMPORTED', [(obj.name, [m.name for m in obj.data.materials if m]) for obj in meshes])
# Bake imported hierarchy into vertex coordinates before global normalization.
for obj in meshes:
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj.data.transform(world)
    for modifier in list(obj.modifiers):
        if modifier.type == 'ARMATURE': obj.modifiers.remove(modifier)
vertices = [v.co.copy() for obj in meshes for v in obj.data.vertices]
lo = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
hi = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
print('SOURCE_Z_UP_BOUNDS', list(lo), list(hi))
height = hi.z - lo.z
if height <= 0:
    raise RuntimeError('Imported asset has no height')
scale = target_height / height
center = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
for obj in meshes:
    for vertex in obj.data.vertices:
        vertex.co = (vertex.co-center)*scale
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.update()
materials = []
for material in set(m for obj in meshes for m in obj.data.materials if m):
    texture = 'cakeballoon_basket__alb.png' if 'basket' in material.name.lower() else 'cakeballoon_alb.png'
    if args.asset == 'aqua-cups':
        texture = 'coffeecup_glass_alb.png' if 'glass' in material.name.lower() else 'coffeecup_b_alb.png'
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Roughness'].default_value = .35
    shader.inputs['Metallic'].default_value = .05
    tex = nodes.new('ShaderNodeTexImage')
    image = bpy.data.images.load(str(source / 'images' / texture), check_existing=True)
    image.colorspace_settings.name = 'sRGB'
    if max(image.size) > 512:
        factor = 512 / max(image.size)
        image.scale(max(1, round(image.size[0]*factor)), max(1, round(image.size[1]*factor)))
    image.pack()
    tex.image = image
    # Native UV atlas, no guessed normal-map channel conversions.
    material.node_tree.links.new(tex.outputs['Color'], shader.inputs['Base Color'])
    out = nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(shader.outputs['BSDF'], out.inputs['Surface'])
    materials.append({'name':material.name, 'albedo':texture, 'size':list(image.size)})
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True, export_yup=True, export_animations=False, export_apply=True, export_extras=False, export_image_format='AUTO')
print('PREPARED', json.dumps({'file':str(output), 'bytes':output.stat().st_size, 'meshes':len(meshes), 'triangles':sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in meshes), 'gltf_y_up_bounds':{'min':[(lo.x-center.x)*scale,0,-(hi.y-center.y)*scale], 'max':[(hi.x-center.x)*scale,target_height,-(lo.y-center.y)*scale]}, 'materials':materials}))
print('PREVIEW_REQUEST', repr(args.preview), flush=True)
if args.preview:
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.render.resolution_x=700
    scene.render.resolution_y=700
    scene.render.resolution_percentage=100
    scene.world.color=(.3,.3,.3)
    bpy.ops.object.camera_add(location=(11,-16,10))
    camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,target_height/2))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=target_height*1.4
    scene.camera=camera
    for location,power,size in [((4,-6,12),1800,7),((-5,-2,6),1000,6),((2,5,9),1400,5)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        light=bpy.context.object
        light.data.energy=power
        light.data.shape='DISK'
        light.data.size=size
        light.rotation_euler=(Vector((0,0,4))-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath='//preview'
    bpy.ops.render.render()
    bpy.data.images['Render Result'].save_render(filepath=str(Path(args.preview).resolve()))




