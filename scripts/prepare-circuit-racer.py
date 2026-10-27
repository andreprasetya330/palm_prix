"""Local personal Circuit Special + MKT Mii conversion (Nintendo; not CC0).
Sources / contributors: public/assets/personal/CREDITS.md.
Run with Blender 5.2 --background --python scripts/prepare-circuit-racer.py.
The source DAE has three overlapping LODs. Import its original high-detail geometry
directly because Blender 5 removed Collada import; keep its authored UV atlas intact.
"""
import bpy, math, json, xml.etree.ElementTree as ET
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[1]
KART=ROOT/'assets/source/personal/circuit-special/Circuit Special'
MII=ROOT/'assets/source/personal/tour-mii/Mii'
OUTPUT=ROOT/'public/assets/personal/circuit-special.glb'
# Keep the tires on the road while dropping the cockpit and engine between them.
# Translating the whole racer would bury its tires instead of lowering its stance.
BODY_DROP=.255
FRONT_RADIUS=.25
REAR_RADIUS=.35
FRAME_HEIGHT=.105
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def texture_material(name,path,roughness=.55,metallic=.12):
 mat=bpy.data.materials.new(name);mat.use_nodes=True
 bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=roughness;bs.inputs['Metallic'].default_value=metallic
 image=bpy.data.images.load(str(path),check_existing=True);image.pack()
 node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
 mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
 return mat

body_material=texture_material('TeamBody',KART/'Textures/BodyK_Fml_A_Alb.png',.48,.22)
lights=texture_material('BodyLights',KART/'Textures/BodyK_Fml_A_Alb.png',.4,.12)
bs=lights.node_tree.nodes.get('Principled BSDF')
emission=lights.node_tree.nodes.new('ShaderNodeTexImage');emission.image=bpy.data.images.load(str(KART/'BodyK_Fml_Emm.0.png'));emission.image.pack()
lights.node_tree.links.new(emission.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.9

dae=ET.parse(KART/'BodyK_Fml.dae').getroot();ns={'c':dae.tag.split('}')[0][1:]}
for name,material,target in [('BodyK_Fml__m_Body-mesh',body_material,'body'),('BodyK_Fml__m_Light-mesh',lights,'body-lights')]:
 geometry=next(g for g in dae.findall('c:library_geometries/c:geometry',ns) if g.get('id')==name)
 mesh=geometry.find('c:mesh',ns);sources={}
 for source in mesh.findall('c:source',ns):
  values=list(map(float,source.findtext('c:float_array',namespaces=ns).split()));stride=int(source.find('c:technique_common/c:accessor',ns).get('stride'))
  sources[source.get('id')]=[values[i:i+stride] for i in range(0,len(values),stride)]
 vertex_source=mesh.find('c:vertices/c:input',ns).get('source')[1:]
 positions=sources[vertex_source];triangles=mesh.find('c:triangles',ns);inputs=triangles.findall('c:input',ns)
 stride=max(int(i.get('offset')) for i in inputs)+1;indices=list(map(int,triangles.findtext('c:p',namespaces=ns).split()))
 vertices=[];uvs=[];normals=[]
 for i in range(0,len(indices),stride):
  p=positions[indices[i]];vertices.append((p[0]*.125,-p[2]*.125,p[1]*.125+.43-BODY_DROP))
  for entry in inputs:
   if entry.get('semantic')=='TEXCOORD' and entry.get('set','0')=='0':uvs.append(sources[entry.get('source')[1:]][indices[i+int(entry.get('offset'))]][:2])
   if entry.get('semantic')=='NORMAL':
    n=sources[entry.get('source')[1:]][indices[i+int(entry.get('offset'))]];normals.append((n[0],-n[2],n[1]))
 data=bpy.data.meshes.new(target);data.from_pydata(vertices,[],[tuple(range(i,i+3)) for i in range(0,len(vertices),3)]);data.update()
 uv=data.uv_layers.new(name='UVMap')
 for loop in data.loops:uv.data[loop.index].uv=uvs[loop.vertex_index]
 for poly in data.polygons:poly.use_smooth=True
 data.normals_split_custom_set_from_vertices(normals)
 obj=bpy.data.objects.new(target,data);bpy.context.collection.objects.link(obj);obj.data.materials.append(material)

# Pose the actual MKT rig into the cockpit before baking it to one static driver mesh.
bpy.ops.import_scene.fbx(filepath=str(MII/'Mii_Prefab.fbx'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
driver=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name=='Body_LOD0')
standing=[driver.matrix_world@Vector(c) for c in driver.bound_box]
standing_height=max(v.z for v in standing)-min(v.z for v in standing)
def pose_global(name,rotation):
 pb=rig.pose.bones[name];bpy.context.view_layer.update()
 head=pb.matrix.translation.copy();rest=pb.bone.matrix_local.to_quaternion()
 pb.matrix=Matrix.Translation(head)@(rotation@rest).to_matrix().to_4x4()
 bpy.context.view_layer.update()
for side in ['L','R']:
 pose_global('Leg'+side,Quaternion((1,0,0),math.radians(-74)))
 pose_global('Knee'+side,Quaternion((1,0,0),math.radians(-12)))
 pose_global('Foot'+side,Quaternion((1,0,0),math.radians(-12)))
 sign=1 if side=='L' else -1
 pose_global('Arm'+side,Vector((sign,0,0)).rotation_difference(Vector((sign*.075,-.095,.135)).normalized()))
 pose_global('Elbow'+side,Vector((sign,0,0)).rotation_difference(Vector((-sign*.023,-.03,.163)).normalized()))
 pose_global('Hand'+side,Vector((sign,0,0)).rotation_difference(Vector((-sign*.07,0,.055)).normalized()))
 for bone in ['Finger1','Finger2','Thumb1','Thumb2']:
  pb=rig.pose.bones[bone+side];pb.rotation_mode='XYZ';pb.rotation_euler.z=(.6 if '2' in bone else .35)*(-sign)
bpy.context.view_layer.update()
hip=rig.matrix_world@rig.pose.bones['Hip'].matrix.translation
dg=bpy.context.evaluated_depsgraph_get();data=bpy.data.meshes.new_from_object(driver.evaluated_get(dg));data.transform(driver.matrix_world)
factor=1.46/standing_height
target_hip=Vector((0,-.15,.71-BODY_DROP))
head_anchor=(rig.matrix_world@rig.pose.bones['Head'].matrix.translation-hip)*factor+target_hip
for v in data.vertices:v.co=(v.co-hip)*factor+target_hip
driver.data=data;driver.parent=None;driver.matrix_world=Matrix.Identity(4);driver.modifiers.clear();driver.name='driver'
driver.data.materials.clear();driver.data.materials.append(texture_material('TeamSuit',MII/'T_Mii_Body_Alb.png',.7,.02))
for o in list(bpy.context.scene.objects):
 if o.type=='ARMATURE' or o.name.startswith('Body_LOD'):bpy.data.objects.remove(o,do_unlink=True)

# The downloaded Mii suit prefab has no face geometry inside its helmet.
# Fill it with an original neutral face; this is not a scanned/personalized likeness.
face_parts=[]
face_material=bpy.data.materials.new('OriginalNeutralFace');face_material.use_nodes=True
face_bs=face_material.node_tree.nodes.get('Principled BSDF');face_bs.inputs['Roughness'].default_value=.76
attribute=face_material.node_tree.nodes.new('ShaderNodeVertexColor');attribute.layer_name='Color';face_material.node_tree.links.new(attribute.outputs['Color'],face_bs.inputs['Base Color'])
def face_color(obj,color):
 layer=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 for value in layer.data:value.color=(*color,1)
 obj.data.materials.clear();obj.data.materials.append(face_material)
 for p in obj.data.polygons:p.use_smooth=True
 face_parts.append(obj)
def face_sphere(p,size,color):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=p)
 o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);face_color(o,color)
# Face placement derives from the head bone, keeping it aligned if driver scale changes.
ratio=1.46/1.34
face_origin=head_anchor+Vector((0,-.09,.23))
face_sphere(head_anchor+Vector((0,0,.035)),(.065,.065,.105),(.74,.48,.31))
face_sphere(face_origin,(.16*ratio,.125*ratio,.16*ratio),(.74,.48,.31))
for side in [-1,1]:
 face_sphere(face_origin+Vector((side*.061*ratio,-.126*ratio,.027*ratio)),(.024*ratio,.012*ratio,.033*ratio),(.018,.012,.018))
 face_sphere(face_origin+Vector((side*.054*ratio,-.136*ratio,.038*ratio)),(.006,.004,.008),(.92,.95,1))
 # Soft brows provide expression at gameplay distance.
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=face_origin+Vector((side*.06*ratio,-.119*ratio,.074*ratio)))
 eyebrow=bpy.context.object;eyebrow.scale=(.032,.01,.007);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);face_color(eyebrow,(.09,.045,.025))
face_sphere(face_origin+Vector((0,-.143*ratio,-.012*ratio)),(.022,.021,.025),(.78,.51,.34))
mouth=bpy.data.curves.new('Smile','CURVE');mouth.dimensions='3D';mouth.bevel_depth=.005;mouth.bevel_resolution=2
spline=mouth.splines.new('POLY');spline.points.add(8)
for i,p in enumerate(spline.points):
 x=(i/8-.5)*.065;p.co=(*(face_origin+Vector((x,-.129*ratio,-.075*ratio+(x/.033)**2*.012))),1)
o=bpy.data.objects.new('smile',mouth);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True)
bpy.ops.object.convert(target='MESH');face_color(bpy.context.object,(.16,.045,.038))
bpy.ops.object.select_all(action='DESELECT')
for o in face_parts:o.select_set(True)
bpy.context.view_layer.objects.active=face_parts[0];bpy.ops.object.join();bpy.context.object.name='driver-face'

# Original Palm Prix wheels: sculpted sidewalls, inset spokes, steel hubs and tire grooves.
wheel_mat=bpy.data.materials.new('TeamBody.Wheels');wheel_mat.use_nodes=True
bs=wheel_mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.58;bs.inputs['Metallic'].default_value=.28
attr=wheel_mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Color';wheel_mat.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
def colored(obj,color):
 layer=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 for c in layer.data:c.color=(*color,1)
 obj.data.materials.clear();obj.data.materials.append(wheel_mat)
 for p in obj.data.polygons:p.use_smooth=True
 return obj
def cylinder(radius,depth,location,color,vertices=24):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=location,rotation=(0,math.pi/2,0));return colored(bpy.context.object,color)

# The kart source is only a body. Build a connected subframe rather than placing
# independent tires beside it: rear live axle, front wishbones and hub knuckles.
mounts=[]
def link(a,b,radius=.028,color=(.10,.12,.16)):
 a,b=Vector(a),Vector(b);direction=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=radius,depth=direction.length,location=(a+b)/2)
 obj=bpy.context.object;obj.rotation_euler=direction.to_track_quat('Z','Y').to_euler()
 mounts.append(colored(obj,color))
for side in [-1,1]:
 link((side*.22,.90,FRAME_HEIGHT),(side*.22,-.96,FRAME_HEIGHT),.028)
 # Both front arms end on the steering knuckle, whose center is the wheel pivot.
 for height in [FRONT_RADIUS-.075,FRONT_RADIUS+.075]:
  for anchor_y in [-.60,-1.10]:
   link((side*.22,anchor_y,FRAME_HEIGHT),(side*.66,-.90,height),.022)
 link((side*.66,-.90,FRONT_RADIUS-.10),(side*.66,-.90,FRONT_RADIUS+.10),.04,(.25,.28,.32))
 link((side*.23,.55,FRAME_HEIGHT),(side*.62,.86,REAR_RADIUS),.028)
 # Gold dampers beside the exhausts echo the compact rear silhouette of the reference.
 link((side*.33,.62,.50),(side*.58,.86,.29),.032,(.58,.36,.045))
 link((side*.33,.62,.50),(side*.455,.74,.395),.041,(.75,.53,.08))
link((-.62,.86,REAR_RADIUS),(.62,.86,REAR_RADIUS),.045,(.12,.14,.18))
link((-.22,-.82,FRAME_HEIGHT),(.22,-.82,FRAME_HEIGHT),.028)
bpy.ops.object.select_all(action='DESELECT')
for obj in mounts:obj.select_set(True)
bpy.context.view_layer.objects.active=mounts[0];bpy.ops.object.join();bpy.context.object.name='chassis-mounts'

for side,side_name in [(-1,'left'),(1,'right')]:
 for forward,axle in [(1,'front'),(-1,'rear')]:
  front=axle=='front'
  radius=FRONT_RADIUS if front else REAR_RADIUS
  width=.22 if front else .40
  center=Vector((side*(.66 if front else .62),-.90 if front else .86,radius));pieces=[]
  radial_scale=radius/.33;axial_scale=width/.29
  # Lathed tire has rounded shoulders, stepped bead and a recessed center hub.
  profile=[(-.145,.23),(-.14,.29),(-.11,.325),(-.075,.33),(.075,.33),(.11,.325),(.14,.29),(.145,.23)]
  verts=[];faces=[];segments=40
  for x,profile_radius in profile:
   for i in range(segments):
    a=i/segments*math.tau;verts.append(tuple(center+Vector((x*axial_scale,math.cos(a)*profile_radius*radial_scale,math.sin(a)*profile_radius*radial_scale))))
  for ring in range(len(profile)-1):
   for i in range(segments):
    a=ring*segments+i;b=ring*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
  m=bpy.data.meshes.new('tire');m.from_pydata(verts,[],faces);o=bpy.data.objects.new('tire',m);bpy.context.collection.objects.link(o);pieces.append(colored(o,(.012,.014,.024)))
  for face in [-1,1]:
   x=center.x+face*.14*axial_scale
   pieces.append(cylinder(.235*radial_scale,.016,(x,center.y,center.z),(.04,.12,.45)))
   pieces.append(cylinder(.19*radial_scale,.02,(x+face*.012,center.y,center.z),(.025,.03,.05)))
   pieces.append(cylinder(.065*radial_scale,.03,(x+face*.025,center.y,center.z),(.48,.51,.6),16))
   for spoke in range(5):
    a=spoke/5*math.tau
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x+face*.025,center.y+math.cos(a)*.13*radial_scale,center.z+math.sin(a)*.13*radial_scale))
    s=bpy.context.object;s.dimensions=(.025,.17*radial_scale,.035*radial_scale);s.rotation_euler.x=a;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);pieces.append(colored(s,(.23,.29,.46)))
  for groove in [-.065,.065]:
   bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=4,location=tuple(center+Vector((groove*axial_scale,0,0))),rotation=(0,math.pi/2,0),major_radius=radius-.001,minor_radius=.004)
   pieces.append(colored(bpy.context.object,(.003,.004,.009)))
  bpy.ops.object.select_all(action='DESELECT')
  for p in pieces:p.select_set(True)
  bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();wheel=bpy.context.object
  wheel.name=f'wheel-{axle}-{side_name}'
  wheel['wheelRadius']=radius
  bpy.context.scene.cursor.location=center;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

OUTPUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',export_animations=False,export_skins=False,export_morph=False,export_yup=True,export_extras=True)
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  bounds=[o.matrix_world@Vector(c) for c in o.bound_box]
  print('BOUNDS',o.name,[(round(min(v[i] for v in bounds),3),round(max(v[i] for v in bounds),3)) for i in range(3)])
print('OUTPUT',str(OUTPUT),'BYTES',OUTPUT.stat().st_size)
