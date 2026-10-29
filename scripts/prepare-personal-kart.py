"""Personal, noncommercial Teddy Buggy conversion; Nintendo body is not CC0.
Source: models.spriters-resource.com/wii_u/mariokart8/asset/353826/
Uploader BillyGaming964. Supplementary driver/wheels: Kenney Car Kit (CC0).
Run using Blender 5.2 --background --python scripts/prepare-personal-kart.py.
"""
import bpy, math, os, tempfile
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/source/personal/teddy-buggy/Teddy Buggy'
OUTPUT=ROOT/'public/assets/personal/teddy-buggy.glb'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(SOURCE/'BodyV_Bea.fbx'))
# FBX contains three coincident LOD sets. Keep only the unsuffixed high-detail set.
keep=[]
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and o.name in ['Jnt_Body__m_Body','Jnt_Handle__m_Body','Jnt_PartsL__m_Body','Jnt_PartsR__m_Body','Jnt_Body__m_Light']:
  # Bake the imported rest pose, then remove the unused skeletal hierarchy.
  dg=bpy.context.evaluated_depsgraph_get()
  mesh=bpy.data.meshes.new_from_object(o.evaluated_get(dg))
  mesh.transform(o.matrix_world)
  # Evaluated FBX pose is Y-up in its mesh data; correct it to Blender Z-up.
  mesh.transform(Matrix.Rotation(math.pi/2,4,'X'))
  o.data=mesh;o.parent=None;o.matrix_world=Matrix.Identity(4);o.modifiers.clear()
  for v in mesh.vertices:
   v.co.x*=0.16365;v.co.y*=0.125;v.co.z=v.co.z*0.125+0.95
  keep.append(o)
 else:bpy.data.objects.remove(o,do_unlink=True)
material=bpy.data.materials.new('Nintendo Teddy Buggy / source albedo');material.use_nodes=True
bs=material.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.68;bs.inputs['Metallic'].default_value=0
image=bpy.data.images.load(str(SOURCE/'BodyV_Bea_Alb.png'));image.colorspace_settings.name='sRGB'
if max(image.size)>1024:image.scale(1024,1024)
image.pack()
node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
material.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
# Wii U's yellow-packed normal map is deliberately not treated as an RGB tangent normal.
for i,o in enumerate(keep):
 o.name='teddy-body-'+str(i);o.data.materials.clear();o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
# Keep the already authored Kenney wheels and seated mascot, discard its chassis.
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/racers/kart-oopi.glb'))
for o in list(bpy.context.selected_objects):
 if o.type!='MESH':continue
 name=o.name
 if not (name.startswith('wheel-') or name=='character'):
  bpy.data.objects.remove(o,do_unlink=True);continue
 o.data=o.data.copy();o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
 if name.startswith('wheel-'):
  coords=[v.co for v in o.data.vertices];center=sum(coords,Vector())/len(coords)
  # Geometric bounds center avoids weighted vertex-density offset.
  center=Vector(tuple((min(v[i] for v in coords)+max(v[i] for v in coords))/2 for i in range(3)))
  target=Vector((.70 if 'left' in name else -.70,-.69 if 'front' in name else .69,.315))
  for v in o.data.vertices:v.co=(v.co-center)*1.50
  o.location=target
 else:
  for v in o.data.vertices:v.co*=.78
  o.location=Vector((0,.10,.64));o.name='character'
 keep.append(o)
# Export uses glTF +Y-up; Blender -Y is the vehicle forward, hence glTF +Z.
for o in bpy.context.scene.objects:o.select_set(False)
for o in keep:o.select_set(True)
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',use_selection=True,export_animations=False,export_skins=False,export_morph=False,export_yup=True)
print('OUTPUT',OUTPUT,'BYTES',OUTPUT.stat().st_size)
for o in keep:
 coords=[o.matrix_world@v.co for v in o.data.vertices]
 print('FINAL',o.name,tuple(round(min(v[i] for v in coords),3) for i in range(3)),tuple(round(max(v[i] for v in coords),3) for i in range(3)))
print('WHEEL_HUBS_GLTF x=+-0.70, y=0.315, z=+-0.69; radius0.315')
print('DRIVER_ORIGIN_GLTF (0,0.64,-0.10), already scaled .78; do not rescale')
# Optional reproducible QA render, outside the repository and excluded from GLB.
if os.environ.get('TEDDY_PREVIEW'):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
 scene.world.color=(.35,.35,.35)
 bpy.ops.object.light_add(type='AREA',location=(3,-4,5));bpy.context.object.data.energy=500;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
 bpy.ops.object.light_add(type='AREA',location=(-3,2,3));bpy.context.object.data.energy=350;bpy.context.object.data.size=4
 bpy.ops.object.camera_add(location=(3,-4,2.8));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.6;scene.camera=cam
 scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
 bpy.ops.render.render();bpy.data.images['Render Result'].save_render(os.environ['TEDDY_PREVIEW'])




