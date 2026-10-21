"""Build the Palm Dart hero kart and export glTF.

Original Palm Prix design. The only borrowed geometry is CC0 hardware from
Poly Haven "Gate Latch 01" (Desktoy): visor hinge pins and wheel lug nuts.
See CREDITS.md. Old Tyre and Rusted Wheel Rim 01 were proportion references
and are not in the export.

Run inside Blender (the MCP socket execs this file):

    exec(compile(open("assets/blender/build_palm_dart.py").read(),
                 "build_palm_dart.py", "exec"))
"""

from __future__ import annotations

import math
import os
import traceback

import bmesh
import bpy
import mathutils
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LATCH = os.path.join(ROOT, "assets/blender/kitbash/gate-latch/gate_latch_01.gltf")
BLEND_PATH = os.path.join(ROOT, "assets/blender/palm-dart.blend")
GLB_PATH = os.path.join(ROOT, "src/aaa/kart/models/palm-dart.glb")

# Blender is Z-up, nose toward -Y. glTF export maps that to three.js Y-up, nose +Z.
DRIVER = Vector((0.0, 0.02, 0.78))
WHEELS = {
    "FL": Vector((-0.76, -0.72, 0.36)),
    "FR": Vector((0.76, -0.72, 0.36)),
    "RL": Vector((-0.76, 0.76, 0.36)),
    "RR": Vector((0.76, 0.76, 0.36)),
}


def main() -> None:
    clear_scene()
    mats = make_materials()
    pin, nut = harvest_hardware(mats["gold"])
    root = empty("PalmDart", Vector((0, 0, 0)))
    driver = empty("Driver", DRIVER)
    adopt(driver, root)

    body_objects = build_body(mats)
    for obj in body_objects:
        adopt(obj, root)

    face_objects = build_driver(mats)
    for obj in face_objects:
        adopt(obj, driver)

    wheel_objects = []
    for name, center in WHEELS.items():
        hub = empty(f"Wheel{name}", center)
        adopt(hub, root)
        for obj in build_wheel(name, center, mats, nut):
            adopt(obj, hub)
            wheel_objects.append(obj)
        # Yaw the wheel so the grooved crown faces the front three-quarter camera.
        hub.rotation_euler = (0.0, 0.0, 0.95)
        wheel_objects.append(hub)

    place_hinges(pin, driver)
    trash(pin)
    trash(nut)

    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH":
            shade(obj)

    render_checks()
    for obj in list(bpy.context.scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            trash(obj)

    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        use_selection=False,
    )
    print("PALM_DART_EXPORT", GLB_PATH, os.path.getsize(GLB_PATH))
    names = sorted(o.name for o in bpy.context.scene.objects)
    print("PALM_DART_OBJECTS", len(names))
    print("PALM_DART_NAMES", " ".join(names))


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def select_only(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    try:
        if bpy.context.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
    except RuntimeError:
        pass
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def trash(obj: bpy.types.Object) -> None:
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if data is not None and getattr(data, "users", 1) == 0:
        bpy.data.meshes.remove(data)


def empty(name: str, loc: Vector) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.12
    obj.location = loc
    bpy.context.collection.objects.link(obj)
    return obj


def adopt(obj: bpy.types.Object, parent: bpy.types.Object) -> None:
    # matrix_world is stale until the depsgraph runs, and parenting against a
    # stale identity matrix drops the object on the origin.
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    bpy.context.view_layer.update()
    obj.matrix_world = world


def shade(obj: bpy.types.Object) -> None:
    mesh = obj.data
    if not hasattr(mesh, "polygons"):
        return
    for poly in mesh.polygons:
        poly.use_smooth = True


def link_mesh(name: str, bm: bmesh.types.BMesh, mat, orient="centroid") -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    if mat is not None:
        mats = mat if isinstance(mat, (list, tuple)) else [mat]
        for item in mats:
            mesh.materials.append(item)
    bm.faces.ensure_lookup_table()
    bm.normal_update()
    if orient == "centroid" and bm.faces:
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        center = Vector((0, 0, 0))
        for vert in bm.verts:
            center += vert.co
        center /= max(1, len(bm.verts))
        sample = bm.faces[0].calc_center_median()
        if (sample - center).dot(bm.faces[0].normal) < 0:
            bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def material(name, color, rough=0.45, metal=0.0, coat=0.0, transmission=0.0, alpha=1.0, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = False
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.14
    if transmission:
        bsdf.inputs["Transmission Weight"].default_value = transmission
        bsdf.inputs["IOR"].default_value = 1.45
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
        mat.use_backface_culling = False
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def make_materials():
    return {
        "coral": material("CoralPaint", (1.0, 0.239, 0.400), rough=0.28, coat=0.85),
        "cream": material("CreamPaint", (1.0, 0.953, 0.894), rough=0.32, coat=0.65),
        "blue": material("TeamBlue", (0.184, 0.420, 1.0), rough=0.34, coat=0.45),
        "gold": material("Gold", (1.0, 0.784, 0.239), rough=0.22, metal=1.0, coat=0.4),
        "plum": material("Plum", (0.141, 0.094, 0.184), rough=0.55),
        "palm": material("Palm", (0.078, 0.639, 0.353), rough=0.4, coat=0.35),
        "palm_deep": material("PalmDeep", (0.047, 0.478, 0.251), rough=0.45),
        "tire": material("TireRubber", (0.22, 0.235, 0.26), rough=0.92),
        "groove": material("TreadGroove", (0.015, 0.015, 0.018), rough=0.96),
        "sidewall": material("Sidewall", (0.541, 0.557, 0.596), rough=0.78),
        "letter": material("SidewallLetter", (0.965, 0.945, 0.902), rough=0.55),
        "glove": material("Glove", (0.957, 0.918, 0.847), rough=0.9),
        "metal": material("Metal", (0.835, 0.871, 0.910), rough=0.25, metal=1.0),
        "skin": material("Skin", (0.953, 0.761, 0.643), rough=0.58),
        "brow": material("Brow", (0.227, 0.165, 0.133), rough=0.5),
        "shadow": material("FaceShadow", (0.10, 0.06, 0.05), rough=1.0),
        "lip": material("Lip", (0.769, 0.357, 0.345), rough=0.42),
        "mouth": material("Mouth", (0.25, 0.05, 0.06), rough=0.7),
        "teeth": material("Teeth", (0.96, 0.95, 0.90), rough=0.35, coat=0.2),
        "sclera": material("Sclera", (0.95, 0.95, 0.93), rough=0.4),
        "iris": material("Iris", (0.22, 0.48, 0.32), rough=0.35),
        "pupil": material("Pupil", (0.02, 0.02, 0.025), rough=0.25),
        "suit": material("Suit", (0.769, 0.145, 0.290), rough=0.85),
        "visor": material("VisorGlass", (0.62, 0.86, 0.93), rough=0.05, coat=1.0, transmission=0.82, alpha=0.42),
        "frame": material("VisorFrame", (0.08, 0.09, 0.11), rough=0.35, metal=0.6),
        "lamp": material("Lamp", (1.0, 0.96, 0.78), rough=0.2, emission=2.0),
    }


def box(name, loc, scale, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
        select_only(obj)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    return obj


def sphere(name, loc, radius, mat, scale=(1, 1, 1), segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(16, segments // 2), radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def tube(name, points, radius, mat, sides=8):
    bm = bmesh.new()
    rings = []
    count = len(points)
    for index, point in enumerate(points):
        if index == 0:
            direction = (points[1] - points[0]).normalized()
        elif index == count - 1:
            direction = (points[-1] - points[-2]).normalized()
        else:
            direction = (points[index + 1] - points[index - 1]).normalized()
        up = Vector((0, 0, 1))
        if abs(direction.dot(up)) > 0.92:
            up = Vector((1, 0, 0))
        side = direction.cross(up).normalized()
        lift = side.cross(direction).normalized()
        ring = []
        for step in range(sides):
            angle = 2 * math.pi * step / sides
            ring.append(bm.verts.new(point + (side * math.cos(angle) + lift * math.sin(angle)) * radius))
        rings.append(ring)
    for index in range(count - 1):
        for step in range(sides):
            nxt = (step + 1) % sides
            bm.faces.new((rings[index][step], rings[index][nxt], rings[index + 1][nxt], rings[index + 1][step]))
    obj = link_mesh(name, bm, mat)
    return obj


def leaf(name, length, width, mat):
    outline = [
        (0, 0),
        (width * 0.22, length * 0.22),
        (width * 0.55, length * 0.52),
        (width * 0.26, length * 0.8),
        (0, length),
        (-width * 0.26, length * 0.8),
        (-width * 0.55, length * 0.52),
        (-width * 0.22, length * 0.22),
    ]
    bm = bmesh.new()
    top = [bm.verts.new((x, y, 0.008)) for x, y in outline]
    bot = [bm.verts.new((x, y, 0.0)) for x, y in outline]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    count = len(outline)
    for index in range(count):
        nxt = (index + 1) % count
        bm.faces.new((bot[index], bot[nxt], top[nxt], top[index]))
    return link_mesh(name, bm, mat)


def sphere_patch(name, radius, u0, u1, v0, v1, nu, nv, thickness, mat):
    bm = bmesh.new()
    grid = []
    for i in range(nu + 1):
        u = u0 + (u1 - u0) * (i / nu)
        row = []
        for j in range(nv + 1):
            v = v0 + (v1 - v0) * (j / nv)
            x = math.sin(u) * math.cos(v) * radius
            y = -math.cos(u) * math.cos(v) * radius
            z = math.sin(v) * radius
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    bm.faces.ensure_lookup_table()
    bm.normal_update()
    if bm.faces:
        sample = bm.faces[0].calc_center_median()
        if sample.dot(bm.faces[0].normal) < 0:
            bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
            bm.normal_update()
    if thickness:
        bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thickness)
    obj = link_mesh(name, bm, mat, orient="none")
    obj.location = DRIVER
    return obj


def visor_bar(name, u0, u1, v0, v1, radius, thick, mat, steps=10):
    points = []
    for index in range(steps):
        t = index / (steps - 1)
        u = u0 + (u1 - u0) * t
        v = v0 + (v1 - v0) * t
        points.append(DRIVER + Vector((
            math.sin(u) * math.cos(v) * radius,
            -math.cos(u) * math.cos(v) * radius,
            math.sin(v) * radius,
        )))
    return tube(name, points, thick, mat, sides=8)


def orient_axis(obj, which, target_index):
    select_only(obj)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    select_only(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    dims = list(obj.dimensions)
    src = max(range(3), key=lambda i: dims[i]) if which == "long" else min(range(3), key=lambda i: dims[i])
    src_v = Vector((0, 0, 0))
    src_v[src] = 1.0
    dst_v = Vector((0, 0, 0))
    dst_v[target_index] = 1.0
    if src_v.dot(dst_v) < 0.999:
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = src_v.rotation_difference(dst_v)
        select_only(obj)
        bpy.ops.object.transform_apply(rotation=True)
    longest = max(obj.dimensions)
    if longest > 1e-8:
        obj.scale = (1.0 / longest, 1.0 / longest, 1.0 / longest)
        select_only(obj)
        bpy.ops.object.transform_apply(scale=True)


def harvest_hardware(gold):
    bpy.ops.import_scene.gltf(filepath=LATCH)
    imported = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in imported:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
        select_only(obj)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.separate(type="LOOSE")
        bpy.ops.object.mode_set(mode="OBJECT")
    pieces = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    hardware = []
    for obj in pieces:
        dims = sorted(obj.dimensions)
        verts = len(obj.data.vertices)
        if 0.004 < dims[2] < 0.03 and 40 <= verts <= 220:
            hardware.append(obj)
        else:
            trash(obj)
    if len(hardware) < 2:
        raise RuntimeError(f"expected CC0 latch hardware, found {len(hardware)}")
    hardware.sort(key=lambda obj: max(obj.dimensions) / max(min(obj.dimensions), 1e-6), reverse=True)
    pin = hardware[0]
    nut = hardware[-1]
    pin.name = "KitbashPin"
    nut.name = "KitbashNut"
    for obj in hardware:
        if obj not in (pin, nut):
            trash(obj)
    for obj in (pin, nut):
        obj.data.materials.clear()
        obj.data.materials.append(gold)
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    orient_axis(pin, "long", 2)
    orient_axis(nut, "short", 0)
    print(
        "KITBASH",
        pin.name, tuple(round(v, 4) for v in pin.dimensions),
        nut.name, tuple(round(v, 4) for v in nut.dimensions),
    )
    return pin, nut


def spawn(src, name, location, rotation, scale):
    obj = src.copy()
    obj.data = src.data
    obj.name = name
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    if not isinstance(scale, tuple):
        scale = (scale, scale, scale)
    obj.scale = scale
    return obj


def build_tire(name: str, mats, outer: float):
    # u > 0 is the outer shoulder. The crown groove is a wide valley there,
    # so the close camera sees a dark cut instead of a hairline in the tread.
    s = 1.0 if outer > 0 else -1.0
    outward = [
        (-0.148, 0.190),
        (-0.128, 0.240),
        (-0.100, 0.300),
        (-0.070, 0.338),
        (-0.040, 0.352),
        (-0.010, 0.360),
        (0.018, 0.358),
        (0.040, 0.330),
        (0.055, 0.286),
        (0.080, 0.286),
        (0.098, 0.340),
        (0.116, 0.352),
        (0.132, 0.300),
        (0.146, 0.230),
        (0.156, 0.190),
    ]
    profile = sorted(((u * s, radius) for u, radius in outward), key=lambda point: point[0])
    steps = 144
    bm = bmesh.new()
    rings = []
    for x_pos, radius0 in profile:
        ring = []
        for step in range(steps):
            angle = 2 * math.pi * step / steps
            ring.append(bm.verts.new((x_pos, radius0 * math.cos(angle), radius0 * math.sin(angle))))
        rings.append(ring)
    for index in range(len(rings) - 1):
        for step in range(steps):
            nxt = (step + 1) % steps
            face = bm.faces.new((rings[index][step], rings[index][nxt], rings[index + 1][nxt], rings[index + 1][step]))
            mid = (rings[index][step].co + rings[index + 1][step].co) * 0.5
            radial = math.hypot(mid.y, mid.z)
            outward_u = mid.x * s
            # 0 tread, 1 sidewall, 2 the dark floor of the outer-shoulder groove.
            if 0.042 < outward_u < 0.094 and radial < 0.338:
                face.material_index = 2
            elif radial > 0.318:
                face.material_index = 0
            else:
                face.material_index = 1
    return link_mesh(name, bm, [mats["tire"], mats["sidewall"], mats["groove"]])


def build_rim(name, mats):
    profile = [
        (0.018, 0.055),
        (0.048, 0.078),
        (0.062, 0.12),
        (0.040, 0.16),
        (0.028, 0.20),
        (0.046, 0.228),
        (0.016, 0.236),
    ]
    steps = 48
    bm = bmesh.new()
    rings = []
    for x_pos, radius in profile:
        ring = []
        for step in range(steps):
            angle = 2 * math.pi * step / steps
            ring.append(bm.verts.new((x_pos, radius * math.cos(angle), radius * math.sin(angle))))
        rings.append(ring)
    for index in range(len(rings) - 1):
        for step in range(steps):
            nxt = (step + 1) % steps
            bm.faces.new((rings[index][step], rings[index][nxt], rings[index + 1][nxt], rings[index + 1][step]))
    return link_mesh(name, bm, mats["gold"])


def build_wheel(name, center, mats, nut):
    outer = 1 if center.x > 0 else -1
    made = []
    tire = build_tire(f"Tire{name}", mats, outer)
    tire.location = center
    made.append(tire)

    for side, x_off in (("Out", 0.105), ("In", -0.105)):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.255,
            minor_radius=0.014,
            major_segments=48,
            minor_segments=12,
            location=center + Vector((outer * x_off * (1 if side == "Out" else 0.85), 0, 0)),
            rotation=(0, math.pi / 2, 0),
        )
        band = bpy.context.active_object
        band.name = f"SidewallBand{name}{side}"
        band.data.materials.append(mats["letter"] if side == "Out" else mats["sidewall"])
        made.append(band)

    rim = build_rim(f"Rim{name}", mats)
    rim.location = center + Vector((outer * 0.02, 0, 0))
    if outer < 0:
        rim.rotation_euler = (0, math.pi, 0)
        select_only(rim)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    made.append(rim)

    for index in range(5):
        angle = 2 * math.pi * index / 5
        spoke = box(
            f"Spoke{name}{index}",
            center + Vector((outer * 0.045, math.cos(angle) * 0.13, math.sin(angle) * 0.13)),
            (0.012, 0.16, 0.018),
            mats["gold"],
            bevel=0.002,
        )
        spoke.rotation_euler = (angle, 0, 0)
        made.append(spoke)
        lug = spawn(
            nut,
            f"Lug{name}{index}",
            center + Vector((outer * 0.07, math.cos(angle) * 0.075, math.sin(angle) * 0.075)),
            (0, 0, 0) if outer > 0 else (0, math.pi, 0),
            0.016,
        )
        made.append(lug)

    cap = sphere(f"Hubcap{name}", center + Vector((outer * 0.055, 0, 0)), 0.04, mats["cream"], scale=(0.55, 1, 1), segments=24)
    made.append(cap)
    badge = leaf(f"HubPalm{name}", 0.045, 0.03, mats["palm"])
    badge.location = center + Vector((outer * 0.072, -0.012, 0))
    badge.rotation_euler = (0, math.pi / 2 if outer > 0 else -math.pi / 2, 0.4)
    made.append(badge)

    # One mark, on the rubber the chase camera sees: a block P above the hub,
    # team blue, proud of the sidewall. The old glyph sat in the hub in dark plum.
    made.append(sidewall_mark(f"SidewallMark{name}", center, outer, mats["blue"]))
    return made


def sidewall_mark(name, center, outer, mat):
    """One mesh. The bowl is the top of the P and the stem runs below it."""
    depth = 0.045
    x = outer * 0.175
    # Y is mirrored so the stem sits on the left when the chase camera
    # looks at the outer sidewall of the yawed rear wheel.
    parts = [
        box(f"{name}Stem", center + Vector((x, 0.07, 0.10)), (depth, 0.07, 0.32), mat, bevel=0.004),
        box(f"{name}Top", center + Vector((x, -0.015, 0.235)), (depth, 0.18, 0.07), mat, bevel=0.004),
        box(f"{name}Bar", center + Vector((x, -0.01, 0.095)), (depth, 0.15, 0.065), mat, bevel=0.004),
        box(f"{name}Bowl", center + Vector((x, -0.075, 0.165)), (depth, 0.07, 0.20), mat, bevel=0.004),
    ]
    select_only(parts[0])
    for part in parts[1:]:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    mark = bpy.context.active_object
    mark.name = name
    return mark


def cut_helmet_opening(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed = []
    for face in bm.faces:
        center = face.calc_center_median()
        dist = center.length
        if dist < 1e-5:
            continue
        forward = -center.y / dist
        if forward < 0.42:
            continue
        nx = center.x / 0.108
        nz = center.z / 0.098
        if nx * nx + nz * nz < 1.0:
            doomed.append(face)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    try:
        bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.01)
    except Exception:
        traceback.print_exc()
    bm.to_mesh(obj.data)
    bm.free()


def build_driver(mats):
    made = []
    head = sphere("Head", DRIVER, 0.108, mats["skin"], scale=(1.0, 0.96, 1.12), segments=48)
    made.append(head)

    shell = sphere("HelmetShell", DRIVER, 0.158, mats["cream"], segments=64)
    cut_helmet_opening(shell)
    made.append(shell)
    made.append(sphere_patch("HelmetStripe", 0.168, -0.28, 0.28, 0.55, 1.15, 8, 10, 0.004, mats["coral"]))
    made.append(sphere("EarPodL", DRIVER + Vector((-0.15, 0.0, 0.0)), 0.042, mats["blue"], segments=20))
    made.append(sphere("EarPodR", DRIVER + Vector((0.15, 0.0, 0.0)), 0.042, mats["blue"], segments=20))
    made.append(tube(
        "ChinBar",
        [
            DRIVER + Vector((-0.09, -0.09, -0.05)),
            DRIVER + Vector((-0.04, -0.125, -0.085)),
            DRIVER + Vector((0.04, -0.125, -0.085)),
            DRIVER + Vector((0.09, -0.09, -0.05)),
        ],
        0.012,
        mats["cream"],
        sides=10,
    ))

    made.append(sphere_patch("VisorGlassL", 0.178, -0.58, -0.08, -0.30, 0.26, 12, 10, 0.003, mats["visor"]))
    made.append(sphere_patch("VisorGlassR", 0.178, 0.08, 0.58, -0.30, 0.26, 12, 10, 0.003, mats["visor"]))
    made.append(visor_bar("VisorFrameTop", -0.64, 0.64, 0.30, 0.30, 0.186, 0.007, mats["frame"]))
    made.append(visor_bar("VisorFrameBottom", -0.64, 0.64, -0.34, -0.34, 0.186, 0.007, mats["frame"]))
    made.append(visor_bar("VisorFrameLeft", -0.60, -0.60, -0.32, 0.28, 0.186, 0.007, mats["frame"]))
    made.append(visor_bar("VisorFrameRight", 0.60, 0.60, -0.32, 0.28, 0.186, 0.007, mats["frame"]))
    made.append(visor_bar("VisorCenterBar", 0.0, 0.0, -0.30, 0.26, 0.182, 0.006, mats["frame"]))

    for side, x_pos in (("L", -0.038), ("R", 0.038)):
        made.append(sphere(f"Sclera{side}", DRIVER + Vector((x_pos, -0.09, 0.018)), 0.024, mats["sclera"], segments=24))
        made.append(sphere(f"Iris{side}", DRIVER + Vector((x_pos, -0.108, 0.018)), 0.012, mats["iris"], segments=20))
        made.append(sphere(f"Pupil{side}", DRIVER + Vector((x_pos, -0.116, 0.018)), 0.006, mats["pupil"], segments=16))
        made.append(sphere(f"Catchlight{side}", DRIVER + Vector((x_pos + 0.004, -0.120, 0.024)), 0.0025, mats["letter"], segments=10))
        made.append(tube(
            f"UpperLid{side}",
            arc_pts(DRIVER + Vector((x_pos, -0.112, 0.018)), 0.026, 0.018, 0.2 * math.pi, 0.85 * math.pi, 12),
            0.0055,
            mats["skin"],
        ))
        made.append(tube(
            f"LowerLid{side}",
            arc_pts(DRIVER + Vector((x_pos, -0.108, 0.016)), 0.022, 0.012, 1.2 * math.pi, 1.8 * math.pi, 10),
            0.004,
            mats["skin"],
        ))

    brow_pts = []
    for index in range(18):
        t = index / 17
        x_pos = -0.084 + 0.168 * t
        hump = math.sin(t * math.pi) * 0.01
        twin = math.sin(t * math.pi * 2) ** 2 * 0.01
        brow_pts.append(DRIVER + Vector((
            x_pos,
            -0.118 - 0.01 * math.sin(t * math.pi),
            0.055 + hump + twin,
        )))
    made.append(tube("Brow", brow_pts, 0.007, mats["brow"], sides=8))
    brow_shadow = box(
        "BrowShadow",
        DRIVER + Vector((0.0, -0.108, 0.040)),
        (0.086, 0.006, 0.014),
        mats["shadow"],
    )
    made.append(brow_shadow)

    made.append(sphere("NoseBridge", DRIVER + Vector((0, -0.105, 0.0)), 0.016, mats["skin"], scale=(0.7, 1.8, 0.7), segments=20))
    made.append(sphere("NoseTip", DRIVER + Vector((0, -0.132, -0.012)), 0.018, mats["skin"], segments=24))
    made.append(sphere("NostrilL", DRIVER + Vector((-0.012, -0.124, -0.024)), 0.007, mats["mouth"], scale=(1, 0.7, 0.6), segments=12))
    made.append(sphere("NostrilR", DRIVER + Vector((0.012, -0.124, -0.024)), 0.007, mats["mouth"], scale=(1, 0.7, 0.6), segments=12))
    made.append(sphere("CheekL", DRIVER + Vector((-0.055, -0.085, -0.02)), 0.028, mats["skin"], segments=16))
    made.append(sphere("CheekR", DRIVER + Vector((0.055, -0.085, -0.02)), 0.028, mats["skin"], segments=16))
    made.append(sphere("Chin", DRIVER + Vector((0, -0.08, -0.075)), 0.04, mats["skin"], scale=(1.15, 0.75, 0.7), segments=24))
    made.append(box(
        "MouthShadow",
        DRIVER + Vector((0.0, -0.102, -0.048)),
        (0.048, 0.005, 0.016),
        mats["shadow"],
    ))
    made.append(tube(
        "UpperLip",
        smile_pts(DRIVER + Vector((0, -0.112, -0.036)), 0.04, 0.012),
        0.007,
        mats["lip"],
    ))
    made.append(tube(
        "LowerLip",
        smile_pts(DRIVER + Vector((0, -0.108, -0.062)), 0.036, 0.01),
        0.008,
        mats["lip"],
    ))
    for index in range(6):
        t = index / 5
        x_pos = -0.028 + 0.056 * t
        lift = ((t - 0.5) ** 2) * 0.012
        tooth = box(
            f"Tooth{index}",
            DRIVER + Vector((x_pos, -0.108, -0.046 + lift)),
            (0.008, 0.006, 0.012),
            mats["teeth"],
            bevel=0.001,
        )
        made.append(tooth)

    made.append(sphere("Neck", DRIVER + Vector((0, 0.02, -0.12)), 0.06, mats["skin"], scale=(0.85, 0.75, 1.1), segments=20))
    made.append(sphere("Torso", DRIVER + Vector((0, 0.04, -0.28)), 0.16, mats["suit"], scale=(1.15, 0.85, 0.9), segments=24))
    made.append(sphere("Collar", DRIVER + Vector((0, -0.02, -0.16)), 0.07, mats["blue"], scale=(1.4, 0.7, 0.45), segments=16))
    return made


def arc_pts(origin, rx, rz, a0, a1, count):
    points = []
    for index in range(count):
        t = index / (count - 1)
        angle = a0 + (a1 - a0) * t
        points.append(origin + Vector((math.cos(angle) * rx, 0.0, math.sin(angle) * rz)))
    return points


def smile_pts(origin, rx, lift):
    points = []
    for index in range(14):
        t = index / 13
        x_pos = -rx + 2 * rx * t
        z_pos = ((t - 0.5) ** 2) * 4 * lift
        y_pos = -0.008 * (1 - ((t - 0.5) * 2) ** 2)
        points.append(origin + Vector((x_pos, y_pos, z_pos)))
    return points


def build_body(mats):
    made = []
    made.append(box("Undertray", (0, 0.02, 0.22), (0.72, 1.55, 0.10), mats["plum"], bevel=0.03))
    made.append(box("Tub", (0, 0.0, 0.36), (0.70, 1.15, 0.22), mats["cream"], bevel=0.05))
    made.append(sphere("Nose", (0, -0.78, 0.40), 0.34, mats["coral"], scale=(1.15, 1.7, 0.62), segments=40))
    made.append(sphere("Tail", (0, 0.72, 0.40), 0.30, mats["coral"], scale=(1.2, 1.25, 0.62), segments=32))
    made.append(box("Splitter", (0, -1.05, 0.18), (0.62, 0.22, 0.03), mats["cream"], bevel=0.008))
    made.append(box("SidepodL", (-0.42, -0.05, 0.30), (0.16, 0.62, 0.14), mats["blue"], bevel=0.02))
    made.append(box("SidepodR", (0.42, -0.05, 0.30), (0.16, 0.62, 0.14), mats["blue"], bevel=0.02))
    made.append(box("Seat", (0, 0.16, 0.46), (0.36, 0.34, 0.08), mats["plum"], bevel=0.015))
    made.append(box("SeatBack", (0, 0.32, 0.60), (0.34, 0.08, 0.28), mats["plum"], bevel=0.012))
    made.append(box("Wing", (0, 0.98, 1.02), (0.96, 0.30, 0.028), mats["coral"], bevel=0.008))
    made.append(box("EndplateL", (-0.49, 0.98, 0.96), (0.02, 0.32, 0.24), mats["cream"], bevel=0.004))
    made.append(box("EndplateR", (0.49, 0.98, 0.96), (0.02, 0.32, 0.24), mats["cream"], bevel=0.004))
    for side, x_pos in (("L", -0.49), ("R", 0.49)):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.07,
            minor_radius=0.008,
            major_segments=28,
            minor_segments=10,
            location=(x_pos, 0.98, 0.96),
            rotation=(0, math.pi / 2, 0),
        )
        ring = bpy.context.active_object
        ring.name = f"EndplateRing{side}"
        ring.data.materials.append(mats["blue"])
        made.append(ring)
        mark = leaf(f"EndplatePalm{side}", 0.18, 0.14, mats["palm"])
        mark.location = Vector((x_pos + (0.012 if x_pos > 0 else -0.012), 0.96, 0.93))
        mark.rotation_euler = (0.2, math.pi / 2 if x_pos > 0 else -math.pi / 2, 0)
        made.append(mark)

    for index, angle in enumerate((-0.7, -0.35, 0.0, 0.35, 0.7)):
        frond = leaf(f"WingPalm{index}", 0.42, 0.22, mats["palm"] if index % 2 == 0 else mats["palm_deep"])
        frond.location = Vector((0, 0.90, 1.045))
        frond.rotation_euler = (0.5, 0, angle)
        made.append(frond)

    made.append(box("NumberPlate", (0, 1.055, 0.62), (0.24, 0.02, 0.20), mats["cream"], bevel=0.006))
    made.append(box("SevenBar", (0.0, 1.072, 0.69), (0.16, 0.016, 0.032), mats["plum"], bevel=0.003))
    stem = box("SevenStem", (0.02, 1.072, 0.58), (0.034, 0.016, 0.13), mats["plum"], bevel=0.003)
    stem.rotation_euler = (0, 0.42, 0)
    made.append(stem)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.038, depth=0.32, location=(0, 1.08, 0.30), rotation=(math.pi / 2, 0, 0))
    exhaust = bpy.context.active_object
    exhaust.name = "Exhaust"
    exhaust.data.materials.append(mats["metal"])
    made.append(exhaust)
    made.append(sphere("ExhaustTip", (0, 1.24, 0.30), 0.046, mats["metal"], scale=(1, 0.7, 1), segments=20))

    for side, x_pos in (("L", -0.16), ("R", 0.16)):
        made.append(sphere(f"LampBezel{side}", (x_pos, -1.08, 0.40), 0.05, mats["gold"], scale=(1, 0.55, 1), segments=20))
        made.append(sphere(f"Lamp{side}", (x_pos, -1.10, 0.40), 0.032, mats["lamp"], scale=(1, 0.5, 1), segments=16))

    nose_palm = leaf("NosePalm", 0.16, 0.12, mats["palm"])
    nose_palm.location = Vector((0, -1.02, 0.50))
    nose_palm.rotation_euler = (1.2, 0, 0)
    made.append(nose_palm)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.13,
        minor_radius=0.012,
        major_segments=28,
        minor_segments=10,
        location=(0, -0.28, 0.58),
        rotation=(1.15, 0, 0),
    )
    wheel = bpy.context.active_object
    wheel.name = "SteeringWheel"
    wheel.data.materials.append(mats["plum"])
    made.append(wheel)

    made.append(tube(
        "RollHoop",
        [
            Vector((-0.28, 0.28, 0.42)),
            Vector((-0.22, 0.18, 0.78)),
            Vector((0.0, 0.12, 1.00)),
            Vector((0.22, 0.18, 0.78)),
            Vector((0.28, 0.28, 0.42)),
        ],
        0.014,
        mats["cream"],
        sides=10,
    ))

    for side in (-1, 1):
        palm_loc = Vector((side * 0.12, -0.24, 0.58))
        made.append(tube(
            f"Arm{side}",
            [DRIVER + Vector((side * 0.16, 0.02, -0.22)), palm_loc],
            0.028,
            mats["suit"],
            sides=8,
        ))
        made.append(glove_mesh(f"Glove{side}", palm_loc, side, mats["glove"]))
    return made


def glove_mesh(name, palm_loc, side, mat):
    """One mesh: the thumb grows out of the palm instead of sitting beside it."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.046, location=palm_loc, segments=20, ring_count=12)
    glove = bpy.context.active_object
    glove.scale = (1.05, 0.7, 0.88)
    bpy.ops.object.transform_apply(scale=True)
    thumb_loc = palm_loc + Vector((side * 0.028, -0.006, 0.034))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.026, location=thumb_loc, segments=16, ring_count=10)
    thumb = bpy.context.active_object
    thumb.scale = (0.62, 0.62, 1.85)
    bpy.ops.object.transform_apply(scale=True)
    select_only(glove)
    thumb.select_set(True)
    bpy.context.view_layer.objects.active = glove
    bpy.ops.object.join()
    glove = bpy.context.active_object
    glove.name = name
    if glove.data.materials:
        glove.data.materials[0] = mat
    else:
        glove.data.materials.append(mat)
    return glove


def place_hinges(pin, driver):
    corners = [(-0.62, 0.22), (-0.62, -0.22), (0.62, 0.22), (0.62, -0.22)]
    for index, (u, v) in enumerate(corners):
        loc = DRIVER + Vector((
            math.sin(u) * math.cos(v) * 0.19,
            -math.cos(u) * math.cos(v) * 0.19,
            math.sin(v) * 0.19,
        ))
        hinge = spawn(pin, f"VisorHinge{index}", loc, (0, 0, 0), 0.028)
        adopt(hinge, driver)


def look_at(obj, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_checks() -> None:
    try:
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.render.resolution_x = 960
        scene.render.resolution_y = 720
        scene.render.image_settings.file_format = "PNG"
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "MATERIAL"
        scene.display.shading.show_cavity = True
        shots = [
            ("/tmp/palm-dart-face.png", Vector((0.22, -0.55, 0.86)), DRIVER + Vector((0, -0.08, 0.0)), True),
            ("/tmp/palm-dart-kart.png", Vector((1.7, -2.05, 1.15)), Vector((0, 0.1, 0.5)), False),
            ("/tmp/palm-dart-tire.png", Vector((-1.25, -1.25, 0.55)), WHEELS["FL"], False),
        ]
        for path, cam_loc, target, open_face in shots:
            for obj in bpy.context.scene.objects:
                cover = obj.name.startswith(("Visor", "Helmet", "ChinBar", "EarPod"))
                obj.hide_render = bool(open_face and cover)
                try:
                    obj.hide_set(bool(open_face and cover))
                except RuntimeError:
                    pass
            bpy.ops.object.camera_add(location=cam_loc)
            cam = bpy.context.active_object
            look_at(cam, target)
            scene.camera = cam
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            print("SHOT", path)
            trash(cam)
    except Exception:
        traceback.print_exc()


if __name__ == "__main__":
    main()
else:
    main()
