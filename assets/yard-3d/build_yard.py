"""院子物件：蘑菇屋（木门、十字窗、石烟囱、柴堆）、水盆与食盆、信箱、猫窝、大树与水滴形吊窝、木牌、栅栏（灌木、小花）。

用法（仓库根目录）：
    blender -b --factory-startup -P assets/yard-3d/build_yard.py -- [--no-render] [--force]

产出：
    assets/yard-3d/yard.blend          Blender 源文件
    assets/yard-3d/renders/*.png       俯视与正面两张白模渲染（不进仓库）
    web/public/models/yard.glb         网页用的模型

规矩同团子：yard.blend 一旦有人手调过就以它为准。脚本把上次保存的哈希记在 build-manifest.json，
哈希对不上又没带 --force 就拒绝覆盖。

地形、小路、草、水面、天空、石头在网页里程序生成（方案 4.2），不在这里。
落点都来自 layout.py，和网页端的 layout.generated.ts 同源。

坐标：Blender 里 Z 朝上；世界 +Z（朝镜头）= Blender 的 -Y。节点名是和网页端的约定：
    house / house_window / house_door / bowl / bowl_water / mailbox / mailbox_flag /
    bed / tree / tree_crown / nest_pivot（吊绳挂点，吊窝绕它晃）/ board / fence / flower
"""

import hashlib
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from layout import ANCHORS, NEST_PIVOT_HEIGHT, NEST_SEAT_HEIGHT, REPO, load_scene, to_world, build_layout  # noqa: E402

BLEND_PATH = os.path.join(HERE, "yard.blend")
MANIFEST_PATH = os.path.join(HERE, "build-manifest.json")
RENDER_DIR = os.path.join(HERE, "renders")
GLB_PATH = os.path.join(REPO, "web", "public", "models", "yard.glb")

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
FORCE = "--force" in ARGS
RENDER = "--no-render" not in ARGS


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def guard_hand_edits():
    if not os.path.exists(BLEND_PATH) or FORCE:
        return
    recorded = None
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH) as f:
            recorded = json.load(f).get("blend_sha256")
    if recorded != sha256(BLEND_PATH):
        sys.exit("yard.blend 和上次脚本生成的不一样（有人手调过）。以 .blend 为准；确实要覆盖请加 --force。")


# ── 小工具 ────────────────────────────────────────────────────────────────

MATERIALS = {}


def material(name, color):
    """一个名字一种材质：毛毡都是完全哑光，质感（纤维起伏、绒光）由网页端按材质名加。"""
    if name not in MATERIALS:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = 1.0
        MATERIALS[name] = m
    return MATERIALS[name]


def srgb(hex_color):
    """#rrggbb → Blender 用的线性 RGB。"""
    h = hex_color.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# 配色（第二轮）：取自 iOS 院子现行素材（world-v2 的屋、树、栅栏，v4 吊窝，v5 信箱）。
# 材质名是和网页端的约定：网页端按名字换成毛毡材质；window_glow、water 另有用途。
PALETTE = {
    "cap": "#cd5946", "gill": "#d3bb91", "cream": "#f2e2c4", "spot": "#f6ead2",
    "wood": "#9a5a2e", "wood_dark": "#73421f", "wood_light": "#b5763e",
    "stone": "#bfb3a0", "stone_light": "#d6ccba",
    "window_glow": "#f6d28a", "water": "#6ec3e0",
    "bowl_orange": "#e2622e", "bowl_teal": "#2fa7a8", "kibble": "#a9693a",
    "leaf_dark": "#426d45", "leaf_mid": "#66884f", "leaf_light": "#8ea25e",
    "rope": "#e6cfa6", "cushion": "#8fa070", "tan": "#d9b98a",
    "coral": "#c25a3e", "slot": "#4a3b30",
    "petal_white": "#f7f3e8", "petal_yellow": "#f0c23b",
}


def mat(name):
    return material(name, srgb(PALETTE[name]))


LAYOUT = build_layout()


def at(name):
    """落点 → Blender 坐标（地面）。"""
    x, z = LAYOUT["anchors"][name].values()
    return Vector((x, -z, 0))


def finish(obj, name, material_, parent=None, smooth=True):
    obj.name = name
    obj.data.name = name
    obj.data.materials.clear()
    obj.data.materials.append(material_)
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def empty(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.1
    obj.location = location
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.update()
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def sphere(name, location, scale, material_, parent=None, segments=32, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(6, segments // 2), location=location, rotation=rotation)
    obj = bpy.context.object
    obj.scale = scale if isinstance(scale, (tuple, list, Vector)) else (scale,) * 3
    return finish(obj, name, material_, parent)


def dome(name, location, scale, material_, parent=None, lip=0.06):
    """半球伞盖：球的上半截，底面封平，边沿往下留一小圈 lip。location 是切面中心。"""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.bisect(plane_co=(location[0], location[1], location[2] - lip), plane_no=(0, 0, 1), use_fill=True, clear_inner=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = 0.05
    mod.segments = 5
    mod.limit_method = "ANGLE"
    return finish(obj, name, material_, parent)


def cylinder(name, location, radius, depth, material_, parent=None, top_radius=None, bevel=0.0, vertices=32):
    """竖直圆柱／圆台，location 是底面中心。"""
    loc = Vector(location) + Vector((0, 0, depth / 2))
    if top_radius is None or abs(top_radius - radius) < 1e-6:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=top_radius, depth=depth, location=loc)
    obj = bpy.context.object
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 4
        mod.limit_method = "ANGLE"
    return finish(obj, name, material_, parent)


def rod(name, start, end, radius, material_, parent=None, vertices=12, end_radius=None):
    """两点之间的一根圆棍（枝、绳、横档、柴）。"""
    start, end = Vector(start), Vector(end)
    span = end - start
    if end_radius is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=span.length, location=start + span * 0.5)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=end_radius, depth=span.length, location=start + span * 0.5)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(span.normalized())
    return finish(obj, name, material_, parent)


def box(name, location, size, material_, parent=None, bevel=0.02, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 4
    return finish(obj, name, material_, parent)


def torus(name, location, major, minor, material_, parent=None, scale=(1, 1, 1), rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=40, minor_segments=14, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, material_, parent)


def facing_z(root, target_xy):
    """让物件的"正面"（Blender -Y）朝向某个地面点。"""
    d = Vector((target_xy[0], target_xy[1])) - Vector((root.location.x, root.location.y))
    root.rotation_euler.z = math.atan2(d.x, -d.y)
    bpy.context.view_layer.update()


RNG_STATE = [12345]


def rnd():
    RNG_STATE[0] = (RNG_STATE[0] * 16807) % 2147483647
    return RNG_STATE[0] / 2147483647


# ── 物件 ──────────────────────────────────────────────────────────────────


def build_house(scene):
    root = empty("house", at("house"))
    dx, dz = LAYOUT["nodes"]["m0"].values()
    o = root.location

    # 菌柄：略鼓的矮柱，奶油色
    sphere("house_stem", o + Vector((0, 0, 0.30)), (0.46, 0.46, 0.46), mat("cream"), root)
    cylinder("house_stem_base", o, 0.44, 0.34, mat("cream"), root, top_radius=0.46, bevel=0.03)
    # 墙脚收边和伞盖底面：保持原有体量，补足从屋檐到墙的厚度。
    torus("house_footing", o + Vector((0, 0, .045)), .431, .032, mat("stone"), root, scale=(1, 1, .7))
    sphere("house_eave_under", o + Vector((0, 0, .455)), (.695, .695, .052), mat("gill"), root)
    torus("house_eave_edge", o + Vector((0, 0, .474)), .681, .025, mat("cap"), root, scale=(1, 1, .75))
    # 伞盖：红，奶油圆斑
    dome("house_cap", o + Vector((0, 0, 0.50)), (0.72, 0.72, 0.52), mat("cap"), root)
    spots = [(0.2, 0.88, 0.11), (1.3, 0.74, 0.09), (2.4, 0.90, 0.10), (3.4, 0.70, 0.085), (4.3, 0.86, 0.11), (5.3, 0.72, 0.09), (4.75, 0.99, 0.07)]
    for i, (a, h, r) in enumerate(spots):
        reach = 0.72 * math.sqrt(max(0.0, 1 - ((h - 0.50) / 0.52) ** 2)) * 0.975
        tilt_out = math.atan2(reach, (h - 0.50) * (0.72 / 0.52) ** 2 + 1e-6)
        spot = sphere(f"house_spot_{i}", o + Vector((math.cos(a) * reach, math.sin(a) * reach, h)), (r, r, r * 0.35), mat("spot"), root, segments=16)
        spot.rotation_euler = (0, tilt_out, a)
    # 正面（本地 -Y）：拱形木门、门框、门把、门前石
    sphere("house_door", o + Vector((0, -0.425, 0.20)), (0.165, 0.05, 0.26), mat("wood"), root, segments=24)
    torus("house_door_frame", o + Vector((0, -0.43, 0.20)), 1.0, 0.11, mat("wood_dark"), root, scale=(0.175, 0.27, 0.06), rotation=(math.pi / 2, 0, 0))
    for i, x in enumerate((-0.07, 0.0, 0.07)):
        box(f"house_door_plank_{i}", o + Vector((x, -0.468, 0.20)), (0.006, 0.01, 0.40 - abs(x) * 1.6), mat("wood_dark"), root, bevel=0.002)
    sphere("house_door_knob", o + Vector((0.10, -0.475, 0.19)), 0.016, mat("wood_dark"), root, segments=12)
    sphere("house_doorstep", o + Vector((0, -0.56, 0.0)), (0.24, 0.15, 0.025), mat("stone_light"), root, segments=20)
    sphere("house_threshold", o + Vector((0, -.51, .022)), (.19, .06, .026), mat("stone"), root, segments=16)
    for z in (.12, .29):
        box("house_door_hinge", o + Vector((-.115, -.474, z)), (.035, .014, .016), mat("wood_dark"), root, bevel=.005)
    # 圆窗：发光的窗面 + 木框 + 十字
    wa = math.radians(36)
    wx, wy = math.sin(wa) * 0.455, -math.cos(wa) * 0.455
    window_root = empty("house_window_root", o + Vector((wx, wy, 0.36)), root)
    window_root.rotation_euler = (0, 0, wa)
    bpy.context.view_layer.update()
    wo = window_root.location
    sphere("house_window", wo, (0.10, 0.10, 0.10), mat("window_glow"), window_root, segments=24).scale = (0.10, 0.03, 0.10)
    torus("house_window_frame", wo, 0.10, 0.02, mat("wood"), window_root, rotation=(math.pi / 2, 0, 0))
    box("house_window_bar_v", wo + Vector((0, -0.028, 0)), (0.016, 0.014, 0.20), mat("wood"), window_root, bevel=0.004)
    box("house_window_bar_h", wo + Vector((0, -0.028, 0)), (0.20, 0.014, 0.016), mat("wood"), window_root, bevel=0.004)
    torus("house_window_reveal", wo + Vector((0, .006, 0)), .111, .018, mat("gill"), window_root, rotation=(math.pi / 2, 0, 0))
    box("house_window_sill", wo + Vector((0, -.035, -.112)), (.255, .105, .035), mat("wood_light"), window_root, bevel=.012)
    for child in list(window_root.children):
        child.rotation_euler.z += wa
        child.location = wo + (child.location - wo)
    # 石烟囱：三块石头摞起来
    for i in range(3):
        box(f"house_chimney_{i}", o + Vector((-0.30 + (i % 2) * 0.012, 0.16, 0.86 + i * 0.075)), (0.16 - i * 0.006, 0.14, 0.075), mat("stone"), root, bevel=0.022)
    # 烟囱顶部暗口与四边压顶，无需布尔或额外实时灯光。
    chimney = o + Vector((-.30, .16, 1.044))
    box("house_chimney_opening", chimney, (.095, .083, .015), mat("slot"), root, bevel=.009)
    for x, y, size in [(-.067, 0, (.028, .16, .035)), (.067, 0, (.028, .16, .035)),
                       (0, -.065, (.12, .03, .035)), (0, .065, (.12, .03, .035))]:
        box("house_chimney_rim", chimney + Vector((x, y, .014)), size, mat("stone_light"), root, bevel=.01)
    # 柴堆：靠在屋子左前
    for i in range(5):
        base = o + Vector((-0.50 + i * 0.035, -0.30 - i * 0.02, 0.0))
        rod(f"house_firewood_{i}", base, base + Vector((0.05 + i * 0.01, 0.10, 0.30 + (i % 2) * 0.04)), 0.028, mat("wood_light" if i % 2 else "wood"), root)

    facing_z(root, (dx, -dz))
    return root


def water_bowl_mesh():
    """真实敞口剖面：外壁、圆润盆沿、内壁和盆底，水面上方没有实心顶盖。"""
    profile=[(0,0),(.069,0),(.081,.009),(.099,.037),(.1,.043),(.097,.049),(.092,.05),(.086,.049),(.083,.044),(.076,.016),(.069,.009),(0,.009)]
    vertices=[];rings=[];faces=[];segments=48
    for radius,z in profile:
        ring=[]
        for i in range(1 if radius==0 else segments):
            angle=2*math.pi*i/segments;ring.append(len(vertices));vertices.append((radius*math.cos(angle),radius*math.sin(angle),z))
        rings.append(ring)
    for a,c in zip(rings,rings[1:]):
        for i in range(segments):
            j=(i+1)%segments
            if len(a)==1:faces.append((a[0],c[j],c[i]))
            elif len(c)==1:faces.append((a[i],a[j],c[0]))
            else:faces.append((a[i],a[j],c[j],c[i]))
    mesh=bpy.data.meshes.new('bowl_body_open');mesh.from_pydata(vertices,[],faces);mesh.update()
    return mesh


def build_bowls():
    """水盆（蓝绿）和食盆（橙）。节点名 bowl 是水盆，团子喝水的那个。"""
    root = empty("bowl", at("bowl"))
    o = root.location
    body=bpy.data.objects.new("bowl_body",water_bowl_mesh());bpy.context.collection.objects.link(body);body.location=o
    finish(body,"bowl_body",mat("bowl_teal"),root)
    cylinder("bowl_water", o + Vector((0, 0, 0.043)), 0.084, 0.004, mat("water"), root)
    f = o + Vector((-0.24, 0.03, 0))
    cylinder("food_bowl_body", f, 0.082, 0.05, mat("bowl_orange"), root, top_radius=0.10, bevel=0.014)
    sphere("food_bowl_kibble", f + Vector((0, 0, 0.04)), (0.078, 0.078, 0.022), mat("kibble"), root, segments=16)
    return root


def build_mailbox():
    root = empty("mailbox", at("mailbox"))
    o = root.location
    cylinder("mailbox_post", o, 0.03, 0.44, mat("wood"), root, bevel=0.008)
    box("mailbox_box", o + Vector((0, 0, 0.52)), (0.19, 0.27, 0.16), mat("cream"), root, bevel=0.06)
    box("mailbox_slot", o + Vector((0, -0.136, 0.545)), (0.10, 0.008, 0.018), mat("slot"), root, bevel=0.004)
    sphere("mailbox_dot", o + Vector((0, -0.136, 0.49)), (0.014, 0.006, 0.014), mat("coral"), root, segments=12)
    pivot = empty("mailbox_flag", o + Vector((0.102, 0.02, 0.50)), root)
    box("mailbox_flag_arm", pivot.location + Vector((0, 0, 0.07)), (0.012, 0.028, 0.15), mat("coral"), pivot, bevel=0.004)
    box("mailbox_flag_tab", pivot.location + Vector((0, -0.032, 0.13)), (0.012, 0.075, 0.05), mat("coral"), pivot, bevel=0.004)
    root.rotation_euler.z = math.radians(18)
    return root


def build_bed():
    root = empty("bed", at("bed"))
    o = root.location
    torus("bed_rim", o + Vector((0, 0, 0.055)), 0.26, 0.068, mat("tan"), root, scale=(1, 0.86, 1))
    sphere("bed_cushion", o + Vector((0, 0, 0.03)), (0.25, 0.21, 0.05), mat("cushion"), root)
    return root


def teardrop(name, center, radius, height, material_, parent):
    """水滴形吊窝：下半是球，上半收成尖，正面（-Y）挖一个圆口。"""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=28, location=center)
    obj = bpy.context.object
    for v in obj.data.vertices:
        if v.co.z > 0:
            t = v.co.z
            squeeze = (1 - t) ** 0.28
            r = math.hypot(v.co.x, v.co.y)
            if r > 1e-6:
                flat = math.sqrt(max(0.0, 1 - t * t))
                k = squeeze / max(flat, 1e-6) * flat if flat > 0 else 0
                v.co.x *= (squeeze / flat) if flat > 1e-6 else 0
                v.co.y *= (squeeze / flat) if flat > 1e-6 else 0
            v.co.z = t * height / radius
    obj.scale = (radius, radius, radius)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # 先做中空壳再挖口；对实心球挖口后加厚会留下堵住猫身体的内凹盖。
    solid = obj.modifiers.new("shell", "SOLIDIFY")
    solid.thickness = .018
    solid.offset = -1
    bpy.ops.object.modifier_apply(modifier="shell")
    # 挖口
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=Vector(center) + Vector((0, -.285, .085)))
    cutter = bpy.context.object
    cutter.scale = (.31, .30, .25)
    mod = obj.modifiers.new("hole", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="hole")
    bpy.data.objects.remove(cutter, do_unlink=True)
    return finish(obj, name, material_, parent)


def build_tree():
    root = empty("tree", at("tree"))
    o = root.location
    wood, wood_dark = mat("wood"), mat("wood_dark")
    wood_root = empty("tree_wood", o, root)
    # 连续弯曲的截面代替直圆柱，根部从地面渐收，所有根尖留在既有碰撞圈内。
    rings = [(0, 0, .0, .22), (0, 0, .12, .195), (.022, .005, .43, .16),
             (.036, .012, .78, .135), (.005, .018, 1.12, .11), (-.03, .018, 1.30, .075)]
    verts, faces = [], []
    for x, y, z, r in rings:
        for j in range(16):
            a = j * math.tau / 16
            rr = r * (1 + .045 * math.sin(a * 3 + z))
            verts.append(tuple(o + Vector((x + math.cos(a) * rr, y + math.sin(a) * rr, z))))
    for i in range(len(rings) - 1):
        for j in range(16):
            k = i * 16 + j; n = i * 16 + (j + 1) % 16
            faces.append((k, n, n + 16, k + 16))
    faces.extend([tuple(reversed(range(16))), tuple(range((len(rings)-1)*16, len(rings)*16))])
    mesh = bpy.data.meshes.new("tree_trunk"); mesh.from_pydata(verts, [], faces); mesh.update()
    trunk = bpy.data.objects.new("tree_trunk", mesh); bpy.context.collection.objects.link(trunk)
    finish(trunk, "tree_trunk", wood, wood_root)
    for i in range(5):
        a = i * math.tau / 5 + .4
        start = o + Vector((math.cos(a) * .07, math.sin(a) * .07, .19))
        mid = o + Vector((math.cos(a) * .21, math.sin(a) * .21, .055))
        tip = o + Vector((math.cos(a) * .32, math.sin(a) * .32, .003))
        rod(f"tree_root_{i}", start, mid, .062, wood, wood_root, end_radius=.038)
        rod(f"tree_root_tip_{i}", mid, tip, .038, wood, wood_root, end_radius=.015)
        sphere(f"tree_root_joint_{i}", mid, (.04, .04, .04), wood, wood_root, segments=12)
    # 分叉
    forks = [((0.34, 0.05, 0.62), 0.085), ((-0.30, 0.10, 0.58), 0.08), ((0.05, -0.22, 0.66), 0.075)]
    top = o + Vector((0, 0, 1.12))
    for i, (offset, r) in enumerate(forks):
        rod(f"tree_fork_{i}", top, top + Vector(offset), r, wood, wood_root, end_radius=r * 0.6)
    # 伸向左前方、挂吊窝的那根枝
    pivot_pos = at("nest") + Vector((0, 0, NEST_PIVOT_HEIGHT))
    rod("tree_branch", o + Vector((0, 0, 1.05)), pivot_pos + Vector((-0.14, 0, 0.035)), 0.06, wood, wood_root, end_radius=0.035)

    # 树冠：三种绿的圆团，大团打底、小团提亮
    crown = empty("tree_crown", o + Vector((0, 0, 1.25)), root)
    c = crown.location
    big = [((0.00, 0.00, 0.50), 0.60), ((-0.52, -0.02, 0.26), 0.47), ((0.52, 0.04, 0.30), 0.49), ((-0.20, 0.32, 0.64), 0.45),
           ((0.26, -0.26, 0.62), 0.43), ((0.04, -0.08, 0.95), 0.38), ((-0.80, -0.08, 0.06), 0.30), ((0.82, 0.0, 0.10), 0.31)]
    for i, (offset, r) in enumerate(big):
        sphere(f"tree_crown_{i}", c + Vector(offset), (r, r, r * 0.86), mat("leaf_dark" if i % 3 == 0 else "leaf_mid"), crown, segments=24)
    for i in range(9):
        a = rnd() * math.tau
        elevation = 0.15 + rnd() * 1.2
        reach = 0.62 + rnd() * 0.12
        p = Vector((math.cos(a) * math.cos(elevation) * reach * 1.25, math.sin(a) * math.cos(elevation) * reach * 0.9, 0.45 + math.sin(elevation) * reach * 0.8))
        r = 0.20 + rnd() * 0.12
        sphere(f"tree_tuft_{i}", c + p, (r, r, r * 0.8), mat("leaf_light" if i % 3 == 0 else "leaf_mid"), crown, segments=16)

    # 吊窝：绕挂点晃。绳圈 + 水滴形编织窝 + 绿垫
    build_nest(root, pivot_pos)
    return root


def build_nest(root, pivot_pos):
    """按真实团子尺寸保留水滴外形，开口和软垫可容纳蜷卧。"""
    pivot = empty("nest_pivot", pivot_pos, root)
    radius = 0.34
    height = 0.34
    center = Vector((pivot_pos.x, pivot_pos.y, NEST_SEAT_HEIGHT + .27))
    tip = center + Vector((0, 0, height))
    rod("nest_rope", tip, pivot_pos, 0.013, mat("rope"), pivot)
    torus("nest_loop", pivot_pos + Vector((0, 0, 0.0)), 0.035, 0.012, mat("rope"), pivot, rotation=(math.pi / 2, 0, 0))
    teardrop("nest_shell", center, radius, height, mat("rope"), pivot)
    sphere("nest_cushion", center + Vector((0, 0, -.165)), (.234, .234, .066), mat("cushion"), pivot, segments=20)
    torus("nest_opening_rim", center + Vector((0, -.27, .085)),
          .30, .012, mat("rope"), pivot, scale=(1, .80, 1), rotation=(math.pi / 2, 0, 0))
    # 编织的横箍
    for i, (z, k) in enumerate(((-0.10, 0.93), (0.0, 1.0), (0.10, 0.80), (0.20, 0.52))):
        if i == 1 or i == 2:
            continue  # 开口的高度不箍
        torus(f"nest_band_{i}", center + Vector((0, 0, z)), radius * k + 0.004, 0.012, mat("rope"), pivot)


def build_board():
    root = empty("board", at("board"))
    o = root.location
    cylinder("board_post", o, 0.022, 0.30, mat("wood"), root, bevel=0.006)
    box("board_plank", o + Vector((0, -0.012, 0.30)), (0.30, 0.03, 0.15), mat("wood_light"), root, bevel=0.02)
    root.rotation_euler.z = math.radians(-12)
    return root


def build_fence_perch(root):
    # 圆角宽横木盖住局部尖顶，供团子横向趴卧；挂在原栅栏上。
    box("fence_perch", Vector((3.15, 3.10, .475)), (.90, .28, .05), mat("wood_light"), root, bevel=.018)


def build_fence():
    """木板栅栏：尖顶木板、两道横档，脚下一排灌木和小花。"""
    root = empty("fence", Vector((0, 0, 0)))
    a, b, c = at("fence_from"), at("fence_corner"), at("fence_to")
    index = 0
    for run, (start, end) in enumerate(((a, b), (b, c))):
        span = end - start
        along = span.normalized()
        yaw = math.atan2(along.y, along.x)
        count = max(2, round(span.length / 0.17))
        for i in range(count + (1 if run == 1 else 0)):
            p = start + span * (i / count)
            h = 0.38 + 0.035 * math.sin(index * 1.7)
            box(f"fence_plank_{index}", p + Vector((0, 0, h / 2)), (0.10, 0.026, h), mat("wood_light" if index % 3 else "wood"), root, bevel=0.012, rotation=(0, 0, yaw))
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.071, radius2=0.0, depth=0.06, location=p + Vector((0, 0, h + 0.03)), rotation=(0, 0, yaw + math.pi / 4))
            tip = bpy.context.object
            tip.scale = (1, 0.26, 1)
            finish(tip, f"fence_tip_{index}", mat("wood_light" if index % 3 else "wood"), root, smooth=False)
            index += 1
        for j, z in enumerate((0.13, 0.29)):
            rod(f"fence_rail_{run}_{j}", start + Vector((0, 0, z)) + along * -0.04, end + Vector((0, 0, z)) + along * 0.04, 0.02, mat("wood"), root)
        # 灌木和花：贴着栅栏朝院子里的一侧
        inward = Vector((-along.y, along.x, 0)) * (-1 if run == 0 else 1)
        bushes = max(3, round(span.length / 0.32))
        for i in range(bushes):
            if i % 7 in (3, 4):
                continue
            p = start + span * ((i + 0.5) / bushes) + inward * (0.07 + rnd() * 0.05)
            r = 0.10 + rnd() * 0.07
            sphere(f"fence_bush_{run}_{i}", p + Vector((0, 0, r * 0.55)), (r * 1.25, r, r * 0.8), mat("leaf_dark" if i % 2 else "leaf_mid"), root, segments=14)
            if i % 2 == 0:
                q = p + inward * (r * 0.75) + Vector((0, 0, r * 0.9))
                sphere(f"fence_flower_{run}_{i}", q, (0.028, 0.028, 0.018), mat("petal_white" if i % 4 else "petal_yellow"), root, segments=10)
    build_fence_perch(root)
    return root


def build_flower():
    root = empty("flower", at("flower"))
    o = root.location
    cylinder("flower_stem", o, 0.008, 0.16, mat("leaf_mid"), root, vertices=8)
    sphere("flower_heart", o + Vector((0, 0, 0.172)), 0.016, mat("petal_yellow"), root, segments=10)
    for i in range(5):
        a = i * math.tau / 5
        sphere(f"flower_petal_{i}", o + Vector((math.cos(a) * 0.026, math.sin(a) * 0.026, 0.168)), (0.02, 0.02, 0.008), mat("petal_white"), root, segments=10)
    return root


def build_garden_details():
    """少量添景：一张木凳、三块山石、一小簇花；沿用邻物的木与石材质。"""
    root = empty("bench", at("bench"))
    o = root.location
    for i in range(3):
        box(f"bench_seat_{i}", o + Vector((0, -0.12 + i * 0.12, 0.27)),
            (0.94, 0.095, 0.065), mat("wood_light"), root, bevel=0.025)
    for x in (-0.34, 0.34):
        for y in (-0.11, 0.11):
            cylinder("bench_leg", o + Vector((x, y, 0)), 0.035, 0.25, mat("wood"), root, bevel=0.008)
    for x in (-0.36, 0.36):
        cylinder("bench_back_post", o + Vector((x, 0.14, 0.20)), 0.028, 0.37, mat("wood"), root)
    box("bench_back", o + Vector((0, 0.15, 0.47)), (0.96, 0.055, 0.16), mat("wood_light"), root, bevel=0.025)
    # 木凳朝向左侧谷地，保留原落点及碰撞范围。
    facing_z(root, (-12, -6))
    rocks = empty("rocks", at("rocks"))
    for i, (x, y, h, r) in enumerate(((0, 0, .27, .28), (.24, .06, .16, .19), (-.17, -.13, .11, .15))):
        sphere(f"garden_stone_{i}", rocks.location + Vector((x, y, h * .37)),
               (r, r * .72, h * .62), mat("stone" if i == 0 else "stone_light"), rocks, segments=14)
    flowers = empty("flowerbed", at("flowerbed"))
    for i in range(11):
        a = i * 2.4
        r = .12 + .02 * (i % 4)
        p = flowers.location + Vector((math.cos(a) * r * 2, math.sin(a) * r, 0))
        h = .10 + .018 * (i % 3)
        rod(f"garden_flower_stem_{i}", p, p + Vector((0, 0, h)), .005, mat("leaf_mid"), flowers, vertices=6)
        sphere(f"garden_flower_heart_{i}", p + Vector((0, 0, h)), .012, mat("petal_yellow"), flowers, segments=8)
        for j in range(5):
            a = j * math.tau / 5
            sphere(f"garden_flower_petal_{i}_{j}", p + Vector((math.cos(a) * .019, math.sin(a) * .019, h)),
                   (.015, .015, .007), mat("petal_white"), flowers, segments=8)


# ── 渲染（自检用）────────────────────────────────────────────────────────


def render_views():
    os.makedirs(RENDER_DIR, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 1600, 800
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.78, 0.95, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "_render_ground"
    ground.data.materials.append(material("render_ground", srgb("#9cc23a")))

    sun = bpy.data.objects.new("_render_sun", bpy.data.lights.new("_render_sun", "SUN"))
    sun.data.energy = 3.0
    sun.data.angle = math.radians(12)
    sun.rotation_euler = (math.radians(52), 0, math.radians(-32))
    scene.collection.objects.link(sun)

    cam = bpy.data.objects.new("_render_cam", bpy.data.cameras.new("_render_cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    views = {
        "front": ((0.2, -7.2, 2.2), (0.2, 0.6, 0.55), 36),
        "top": ((0.2, -0.2, 9.0), (0.2, 0.2, 0.0), 40),
    }
    for name, (position, target, lens) in views.items():
        cam.location = position
        cam.data.lens = lens
        direction = Vector(target) - Vector(position)
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(RENDER_DIR, f"blockout-{name}.png")
        bpy.ops.render.render(write_still=True)

    for obj in (ground, sun, cam):
        bpy.data.objects.remove(obj, do_unlink=True)


def main():
    guard_hand_edits()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = load_scene()

    house = build_house(scene)
    house.scale = (LAYOUT["houseScale"],) * 3
    build_bowls()
    build_mailbox()
    build_bed()
    build_tree()
    build_fence()
    build_flower()
    build_garden_details()
    bpy.context.view_layer.update()

    if RENDER:
        render_views()

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_materials="EXPORT",
    )

    triangles = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            mesh = obj.evaluated_get(depsgraph).to_mesh()
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
    manifest = {
        "blend_sha256": sha256(BLEND_PATH),
        "glb_bytes": os.path.getsize(GLB_PATH),
        "triangles": triangles,
    }
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=1)
        f.write("\n")
    print("yard:", manifest)


if __name__ == "__main__":
    main()
