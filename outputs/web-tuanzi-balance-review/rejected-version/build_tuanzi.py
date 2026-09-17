"""团子 3D：外形、纹样、骨骼、动作，一次生成。

用法（仓库根目录）：
    blender -b --factory-startup -P assets/tuanzi-3d/build_tuanzi.py -- [--until=shape|texture|rig|all] [--no-render] [--force]

产出：
    assets/tuanzi-3d/tuanzi.blend              Blender 源文件
    assets/tuanzi-3d/textures/tuanzi_color.png 烘好的颜色贴图
    assets/tuanzi-3d/renders/*.png             固定机位渲染（正面、侧面、四分之三侧）
    web/public/models/tuanzi.glb               网页用的模型

规矩（决策-2026-09-17-网页版）：tuanzi.blend 一旦有人在 Blender 里手调过，就以 .blend 为准。
脚本每次保存后把文件哈希记进 build-manifest.json；下次发现 .blend 的哈希对不上，说明被手调过，
不带 --force 就拒绝覆盖。

坐标（Blender）：Z 朝上，猫脸朝 -Y，猫的左边是 +X，地面 z = 0，单位米。
比例出自 R3 侧面站姿（1px ≈ 0.45mm）与 R1 身份图，见 docs/specs/网页版-3D团子小样-方案-2026-09-17.md。
"""

import hashlib
import json
import math
import os
import sys

import bpy
import numpy as np
import openvdb as vdb
from mathutils import Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BLEND_PATH = os.path.join(HERE, "tuanzi.blend")
MANIFEST_PATH = os.path.join(HERE, "build-manifest.json")
TEXTURE_PATH = os.path.join(HERE, "textures", "tuanzi_color.png")
RENDER_DIR = os.path.join(HERE, "renders")
GLB_PATH = os.path.join(REPO, "web", "public", "models", "tuanzi.glb")

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
UNTIL = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--until=")), "all")
STAGES = ["shape", "texture", "rig", "all"]

# ---------------------------------------------------------------------------
# 尺寸（米）
# ---------------------------------------------------------------------------

VOXEL = 0.002
BOUNDS_MIN = np.array([-0.16, -0.26, -0.01])
BOUNDS_MAX = np.array([0.16, 0.34, 0.44])
TARGET_TRIANGLES = 18000

TORSO = [  # (中心, 半轴)
    ((0.0, 0.035, 0.145), (0.077, 0.135, 0.085)),
    ((0.0, 0.1, 0.137), (0.080, 0.087, 0.077)),  # 收胯，腹线抬起
    ((0.0, -0.037, 0.130), (0.067, 0.060, 0.067)),  # 胸廓收窄，让下颌和肩部各自可读
]
CRANIUM = ((0.0, -0.118, 0.230), (0.111, 0.094, 0.080))
CHEEK = ((0.050, -0.144, 0.205), (0.054, 0.052, 0.044))  # 左侧，右侧镜像；下颊随头上提

EAR_BASE = (0.066, -0.151, 0.277)
EAR_TIP = (0.098, -0.158, 0.365)
EAR_RADII = (0.051, 0.012)
EAR_SQUASH = 2.0  # 耳朵前后方向压扁的倍数
EAR_FACING = (0.4, -1.0, 0.0)  # 耳朵正面朝前偏外

# 腿：每条腿四个关节点 (y, z)，左腿 x 为正
LEGS = {
    "front": {
        "x": 0.052,
        "joints": [(-0.09, 0.115), (-0.071, 0.070), (-0.098, 0.03), (-0.126, 0.012)],
        "radii": [0.035, 0.028, 0.025],
        "paw": (0.033, 0.036, 0.022),
    },
    "hind": {
        "x": 0.060,
        "joints": [(0.125, 0.110), (0.092, 0.068), (0.127, 0.03), (0.097, 0.012)],
        "radii": [0.042, 0.031, 0.026],
        "paw": (0.033, 0.036, 0.022),
    },
}
PAW_Z = 0.019

TAIL_CONTROL = [(0.13, 0.173), (0.218, 0.199), (0.281, 0.259), (0.29, 0.322), (0.267, 0.365), (0.22, 0.378)]  # (y, z)，舒展的大弯尾
TAIL_RADII = (0.035, 0.025)

EYE_X = 0.05
EYE_Z = 0.216
EYE_RADII = (0.0098, 0.0125, 0.0042)  # 宽、高、厚
EYE_PROTRUDE = 0.0022

# 颜色（R1 取样，sRGB）
COLOR_BODY = "#f8962a"
COLOR_STRIPE = "#ef7e1a"
COLOR_RING = "#ed7515"
COLOR_EAR = "#fcab84"
COLOR_MOUTH = "#d05d09"
COLOR_LINE = "#6d3006"
COLOR_EYE = "#3a1c08"


# ---------------------------------------------------------------------------
# 距离场
# ---------------------------------------------------------------------------

def normalize(v):
    v = np.asarray(v, dtype=np.float64)
    return v / np.linalg.norm(v)


def length(v):
    return np.sqrt(np.einsum("...i,...i->...", v, v))


def sd_ellipsoid(p, center, radii):
    radii = np.asarray(radii, dtype=np.float64)
    q = (p - np.asarray(center)) / radii
    k0 = length(q)
    k1 = length(q / radii)
    return np.where(k1 < 1e-8, -float(radii.min()), k0 * (k0 - 1.0) / np.maximum(k1, 1e-9))


def sd_round_cone(p, a, b, r1, r2):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = p - a
    y = pa @ ba
    z = y - l2
    xv = pa * l2 - y[..., None] * ba
    x2 = np.einsum("...i,...i->...", xv, xv)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d_tip = np.sqrt(x2 + z2) * il2 - r2
    d_base = np.sqrt(x2 + y2) * il2 - r1
    d_side = (np.sqrt(np.maximum(x2 * a2 * il2, 0.0)) + y * rr) * il2 - r1
    return np.where(np.sign(z) * a2 * z2 > k, d_tip, np.where(np.sign(y) * a2 * y2 < k, d_base, d_side))


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1.0 - h) + a * h - k * h * (1.0 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def catmull_rom(points, samples):
    pts = [np.asarray(points[0])] + [np.asarray(p) for p in points] + [np.asarray(points[-1])]
    out = []
    segments = len(points) - 1
    for i in range(samples):
        t = i / (samples - 1) * segments
        s = min(int(t), segments - 1)
        u = t - s
        p0, p1, p2, p3 = pts[s], pts[s + 1], pts[s + 2], pts[s + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    return np.array(out)


def resample_by_length(curve, count):
    seg = np.linalg.norm(np.diff(curve, axis=0), axis=1)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    targets = np.linspace(0.0, cum[-1], count)
    return np.stack([np.interp(targets, cum, curve[:, i]) for i in range(curve.shape[1])], axis=1)


def tail_curve(samples=64):
    control = [(0.0, y, z) for y, z in TAIL_CONTROL]
    return resample_by_length(catmull_rom(control, 200), samples)


def ear_frame(side):
    base = np.array([side * EAR_BASE[0], EAR_BASE[1], EAR_BASE[2]])
    tip = np.array([side * EAR_TIP[0], EAR_TIP[1], EAR_TIP[2]])
    u = normalize(tip - base)
    n0 = normalize((side * EAR_FACING[0], EAR_FACING[1], EAR_FACING[2]))
    n = normalize(n0 - u * (n0 @ u))
    w = np.cross(u, n)
    return base, tip, u, n, w


def ear_local(p, side):
    base, tip, u, n, w = ear_frame(side)
    q = p - base
    return np.stack([q @ w, q @ u, q @ n], axis=-1), float(np.linalg.norm(tip - base))


def sd_ear(p, side):
    local, ear_length = ear_local(p, side)
    squashed = local * np.array([1.0, 1.0, EAR_SQUASH])
    ear = sd_round_cone(squashed, (0, 0, 0), (0, ear_length, 0), *EAR_RADII)
    cup = sd_ear_cup(local)
    return smax(ear, -cup, 0.003)


def sd_ear_cup(local):
    return sd_ellipsoid(local, (0.0, 0.042, 0.012), (0.034, 0.053, 0.009))


def leg_points(kind, side):
    leg = LEGS[kind]
    x = side * leg["x"]
    return [np.array([x, y, z]) for y, z in leg["joints"]]


def sd_leg(p, kind, side):
    leg = LEGS[kind]
    joints = leg_points(kind, side)
    r = leg["radii"]
    # 连续曲线过渡肩／肘／腕；不把两个锥体的接缝留在关节外侧。
    curve = catmull_rom(joints[:3], 9)
    radii = np.interp(np.linspace(0, 2, len(curve)), [0, 1, 2], r)
    limb = sd_round_cone(p, curve[0], curve[1], radii[0], radii[1])
    for i in range(1, len(curve) - 1):
        limb = smin(limb, sd_round_cone(p, curve[i], curve[i + 1], radii[i], radii[i + 1]), 0.004)
    wrist, toe = joints[2], joints[3]
    paw_center = (wrist[0], (wrist[1] + toe[1]) / 2, PAW_Z)
    paw = sd_ellipsoid(p, paw_center, leg["paw"])
    return smin(limb, paw, 0.018)


def sd_regions(p):
    """每个部位各自的距离场。蒙皮权重按部位分，所以部位要能单独取。"""
    torso = sd_ellipsoid(p, *TORSO[0])
    for center, radii in TORSO[1:]:
        torso = smin(torso, sd_ellipsoid(p, center, radii), 0.03)

    # 细颈承接抬高的后颅；保持连续体，不用切缝制造头身分离。
    neck = sd_round_cone(p, (0, -0.065, 0.15), (0, -0.1, 0.214), 0.048, 0.043)
    torso = smin(torso, neck, 0.012)
    head = sd_ellipsoid(p, *CRANIUM)
    for side in (1, -1):
        c = (side * CHEEK[0][0], CHEEK[0][1], CHEEK[0][2])
        head = smin(head, sd_ellipsoid(p, c, CHEEK[1]), 0.045)

    curve = tail_curve(14)
    radii = np.linspace(TAIL_RADII[0], TAIL_RADII[1], len(curve))
    tail = sd_round_cone(p, curve[0], curve[1], radii[0], radii[1])
    for i in range(1, len(curve) - 1):
        tail = smin(tail, sd_round_cone(p, curve[i], curve[i + 1], radii[i], radii[i + 1]), 0.006)

    regions = {"torso": torso, "head": head, "tail": tail}
    for side, suffix in ((1, "L"), (-1, "R")):
        regions[f"ear_{suffix}"] = sd_ear(p, side)
        for kind in LEGS:
            regions[f"{kind}_{suffix}"] = sd_leg(p, kind, side)
    return regions


def sd_cat(p):
    r = sd_regions(p)
    d = smin(r["torso"], r["head"], 0.010)
    for suffix in ("L", "R"):
        d = smin(d, r[f"ear_{suffix}"], 0.012)
        d = smin(d, r[f"front_{suffix}"], 0.025)
        d = smin(d, r[f"hind_{suffix}"], 0.025)
    d = smin(d, r["tail"], 0.02)
    # 脚掌底压平，站得住
    return smax(d, -p[..., 2], 0.003)


# ---------------------------------------------------------------------------
# 场景工具
# ---------------------------------------------------------------------------

def hex_to_linear(hex_color):
    srgb = np.array([int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)


def hex_to_srgb(hex_color):
    return np.array([int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def set_active(obj):
    for other in bpy.context.view_layer.objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifier(obj, name):
    set_active(obj)
    with bpy.context.temp_override(object=obj, active_object=obj):
        bpy.ops.object.modifier_apply(modifier=name)


# ---------------------------------------------------------------------------
# 外形
# ---------------------------------------------------------------------------

def build_body_mesh():
    axes = [np.arange(BOUNDS_MIN[i], BOUNDS_MAX[i] + VOXEL * 0.5, VOXEL) for i in range(3)]
    shape = tuple(len(a) for a in axes)
    field = np.empty(shape, dtype=np.float32)
    # 按 x 分片算，省内存
    gy, gz = np.meshgrid(axes[1], axes[2], indexing="ij")
    for i, x in enumerate(axes[0]):
        if i % 40 == 0:
            print(f"[shape] 距离场 {i}/{len(axes[0])}", flush=True)
        p = np.stack([np.full_like(gy, x), gy, gz], axis=-1)
        field[i] = sd_cat(p)

    grid = vdb.FloatGrid(1.0)
    grid.copyFromArray(field)
    grid.transform = vdb.createLinearTransform(voxelSize=VOXEL)
    points, quads = grid.convertToQuads(0.0)
    points = points.astype(np.float64) + BOUNDS_MIN
    print(f"[shape] 体素 {shape}，初始四边形 {len(quads)}", flush=True)

    mesh = bpy.data.meshes.new("tuanzi_body")
    mesh.from_pydata(points.tolist(), [], quads.tolist())
    mesh.validate()
    obj = bpy.data.objects.new("tuanzi_body", mesh)
    bpy.context.scene.collection.objects.link(obj)

    smooth = obj.modifiers.new("smooth", "SMOOTH")
    smooth.factor = 0.5
    smooth.iterations = 3
    apply_modifier(obj, "smooth")

    triangles = len(mesh.polygons) * 2
    decimate = obj.modifiers.new("decimate", "DECIMATE")
    decimate.ratio = min(1.0, TARGET_TRIANGLES / triangles)
    decimate.use_symmetry = True
    decimate.symmetry_axis = "X"
    apply_modifier(obj, "decimate")

    polish = obj.modifiers.new("surface_polish", "SMOOTH")
    polish.factor = 0.3
    polish.iterations = 2
    apply_modifier(obj, "surface_polish")
    polish_forehead(obj)
    obj.data.shade_smooth()
    print(f"[shape] 减面后三角面约 {sum(len(p.vertices) - 2 for p in mesh.polygons)}，顶点 {len(mesh.vertices)}")
    return obj


def polish_forehead(obj):
    """对称减面会在额头中线留下凹点；将局部顶点投回原始连续曲面，保留 UV。"""
    all_points = np.array([v.co[:] for v in obj.data.vertices])
    selected = (np.abs(all_points[:, 0]) < 0.035) & (all_points[:, 1] < CRANIUM[0][1] - 0.055) & (all_points[:, 2] > EYE_Z + 0.015)
    indices = np.flatnonzero(selected)
    points = all_points[selected].copy()
    original = points.copy()
    eps = 0.00015
    for _ in range(4):
        d = sd_cat(points)
        grad = np.stack([(sd_cat(points + np.eye(3)[axis] * eps) - sd_cat(points - np.eye(3)[axis] * eps)) / (2 * eps) for axis in range(3)], axis=1)
        delta = d[:, None] * grad / np.maximum(np.sum(grad * grad, axis=1, keepdims=True), 1e-8)
        points -= delta * np.minimum(1.0, 0.002 / np.maximum(np.linalg.norm(delta, axis=1, keepdims=True), 1e-8))
    # 边界柔和过渡，不在选择边缘制造新的小棱。
    fade = 1 - smoothstep(0.02, 0.035, np.abs(original[:, 0]))
    fade *= smoothstep(EYE_Z + 0.015, EYE_Z + 0.026, original[:, 2])
    points = original + (points - original) * fade[:, None]
    for i, point in zip(indices, points):
        obj.data.vertices[int(i)].co = point
    obj.data.update()
    # 狭长三角面会让平均法线在对称线上起伏；额头用原曲面的解析梯度法线。
    # 全身用连续距离场梯度，避免减面后的狭长三角面在耳杯、肩胯形成碎折光。
    # 只修着色法线；不增加细分层，也不改变关节位置或 UV。
    all_points = np.array([v.co[:] for v in obj.data.vertices])
    normals = np.stack([(sd_cat(all_points + np.eye(3)[axis] * eps) - sd_cat(all_points - np.eye(3)[axis] * eps)) / (2 * eps) for axis in range(3)], axis=1)
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)
    obj.data.shade_smooth()
    obj.data.normals_split_custom_set_from_vertices(normals.tolist())
    print(f"[polish] 额头 {len(indices)} 顶点，最大修整 {np.linalg.norm(points - original, axis=1).max()*1000:.3f} mm", flush=True)


def surface_point(origin, direction):
    """从 origin 沿 direction 往外找距离场零点，返回表面点和法线。"""
    origin = np.asarray(origin, dtype=np.float64)
    direction = normalize(direction)
    ts = np.linspace(0.0, 0.2, 2001)
    samples = origin + ts[:, None] * direction
    d = sd_cat(samples)
    idx = int(np.argmax(d > 0))
    t0, t1 = ts[idx - 1], ts[idx]
    d0, d1 = d[idx - 1], d[idx]
    t = t0 + (t1 - t0) * (-d0) / (d1 - d0)
    point = origin + t * direction
    eps = 0.0005
    grad = np.array([
        sd_cat((point + [eps, 0, 0])[None])[0] - sd_cat((point - [eps, 0, 0])[None])[0],
        sd_cat((point + [0, eps, 0])[None])[0] - sd_cat((point - [0, eps, 0])[None])[0],
        sd_cat((point + [0, 0, eps])[None])[0] - sd_cat((point - [0, 0, eps])[None])[0],
    ])
    return point, normalize(grad)


def build_eyes():
    eyes = []
    center = np.array(CRANIUM[0])
    for side, suffix in ((1, "L"), (-1, "R")):
        target = np.array([side * EYE_X, CRANIUM[0][1] - 0.2, EYE_Z])
        start = np.array([side * EYE_X * 0.5, center[1], EYE_Z])
        point, normal = surface_point(start, target - start)
        up = normalize(np.array([0, 0, 1.0]) - normal * normal[2])
        right = np.cross(up, normal)
        basis = Matrix((right.tolist(), up.tolist(), normal.tolist())).transposed()
        position = point - normal * (EYE_RADII[2] - EYE_PROTRUDE)

        mesh = bpy.data.meshes.new(f"tuanzi_eye_{suffix}")
        obj = bpy.data.objects.new(f"tuanzi_eye_{suffix}", mesh)
        bpy.context.scene.collection.objects.link(obj)
        import bmesh
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=1.0)
        scale = Matrix.Diagonal((EYE_RADII[0], EYE_RADII[1], EYE_RADII[2], 1.0))
        bm.transform(Matrix.Translation(Vector(position)) @ basis.to_4x4() @ scale)
        bm.to_mesh(mesh)
        bm.free()
        mesh.shade_smooth()
        obj["eye_basis"] = [list(row) for row in basis]
        obj["eye_center"] = position.tolist()
        eyes.append(obj)
    return eyes


# ---------------------------------------------------------------------------
# 纹样：先把每个像素对应的表面位置、法线、环境遮蔽烘出来，再用 numpy 按位置画
# ---------------------------------------------------------------------------

TEXTURE_SIZE = 2048
MOUTH_Z = 0.188


def unwrap(obj):
    set_active(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.002)
    bpy.ops.object.mode_set(mode="OBJECT")


def bake(obj, kind):
    """kind: position | normal | ao。返回 (H, W, 4) float 数组，第 4 通道 > 0.5 表示该像素在模型上。"""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32 if kind == "ao" else 1

    image = bpy.data.images.new(f"bake_{kind}", TEXTURE_SIZE, TEXTURE_SIZE, alpha=True, float_buffer=True)
    image.colorspace_settings.name = "Non-Color"
    image.generated_color = (0, 0, 0, 0)

    material = bpy.data.materials.new(f"bake_{kind}")
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    nodes.active = texture
    if kind in ("position", "normal"):
        geometry = nodes.new("ShaderNodeNewGeometry")
        scale = nodes.new("ShaderNodeVectorMath")
        scale.operation = "SCALE"
        scale.inputs["Scale"].default_value = 1.5 if kind == "position" else 0.5
        offset = nodes.new("ShaderNodeVectorMath")
        offset.operation = "ADD"
        offset.inputs[1].default_value = (0.5, 0.5, 0.5)
        emission = nodes.new("ShaderNodeEmission")
        links.new(geometry.outputs["Position" if kind == "position" else "Normal"], scale.inputs[0])
        links.new(scale.outputs[0], offset.inputs[0])
        links.new(offset.outputs[0], emission.inputs["Color"])
        links.new(emission.outputs[0], output.inputs["Surface"])
        bake_type = "EMIT"
    else:
        diffuse = nodes.new("ShaderNodeBsdfDiffuse")
        links.new(diffuse.outputs[0], output.inputs["Surface"])
        scene.world.light_settings.distance = 0.06
        bake_type = "AO"

    obj.data.materials.clear()
    obj.data.materials.append(material)
    set_active(obj)
    bpy.ops.object.bake(type=bake_type, margin=12, use_clear=False)

    pixels = np.empty(TEXTURE_SIZE * TEXTURE_SIZE * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    bpy.data.materials.remove(material)
    return pixels.reshape(TEXTURE_SIZE, TEXTURE_SIZE, 4)


def value_noise(p, cell, seed):
    """三维值噪声，返回 0–1。"""
    q = p / cell + seed * 17.13
    base = np.floor(q)
    f = q - base
    f = f * f * (3 - 2 * f)

    def hash3(i):
        h = (i[..., 0] * 73856093) ^ (i[..., 1] * 19349663) ^ (i[..., 2] * 83492791)
        return ((h * 2654435761) % 4294967296) / 4294967296.0

    base = base.astype(np.int64)
    total = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                total = total + w * hash3(base + np.array([dx, dy, dz]))
    return total


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def distance_to_polyline(points2d, polyline):
    best = np.full(points2d.shape[0], np.inf)
    for a, b in zip(polyline[:-1], polyline[1:]):
        a, b = np.asarray(a), np.asarray(b)
        ab = b - a
        t = np.clip(((points2d - a) @ ab) / (ab @ ab), 0, 1)
        best = np.minimum(best, np.linalg.norm(points2d - (a + t[:, None] * ab), axis=1))
    return best


def paint_texture(position, normal, ao):
    valid = position[..., 3] > 0.5
    P = (position[valid][:, :3] - 0.5) / 1.5
    N = (normal[valid][:, :3] - 0.5) / 0.5
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-6)
    occlusion = ao[valid][:, 0]
    x, y, z = P[:, 0], P[:, 1], P[:, 2]

    regions = sd_regions(P)
    names = list(regions)
    stack = np.stack([regions[n] for n in names])
    nearest = np.array(names)[np.argmin(stack, axis=0)]

    color = np.tile(hex_to_linear(COLOR_BODY), (len(P), 1))

    def mix(mask, hex_color):
        nonlocal color
        mask = np.clip(mask, 0, 1)[:, None]
        color = color * (1 - mask) + hex_to_linear(hex_color) * mask

    wobble = (value_noise(P, 0.012, 1) - 0.5) * 0.004

    # 背上两道宽软身纹：上端偏向头，下端偏向屁股，在体侧中部收尾
    torso = nearest == "torso"
    lean = y + 0.33 * (z - 0.24) + wobble
    for center in (0.058, 0.0):
        half = 0.011 + 0.004 * smoothstep(0.15, 0.24, z)
        band = 1 - smoothstep(half - 0.0015, half + 0.0015, np.abs(lean - center))
        mix(band * smoothstep(0.152, 0.17, z) * torso, COLOR_STRIPE)

    # 三道额纹：在头顶朝前的一面，中间那道最长
    head = nearest == "head"
    d = P - np.array(CRANIUM[0])
    theta = np.arctan2(d[:, 0], -d[:, 1])
    phi = np.arctan2(d[:, 2], np.hypot(d[:, 0], d[:, 1]))
    for center, low in ((-0.42, 0.5), (0.0, 0.42), (0.42, 0.5)):
        fan = center * (1 + 0.35 * (phi - 0.5))
        half = 0.0105 / (0.1 * np.maximum(np.cos(phi), 0.25))
        band = 1 - smoothstep(half * 0.75, half * 1.25, np.abs(theta - fan) + wobble * 3)
        mix(band * smoothstep(low, low + 0.08, phi) * (1 - smoothstep(1.05, 1.2, phi)) * head, COLOR_STRIPE)

    # 尾巴环纹
    tail = nearest == "tail"
    curve = tail_curve(96)
    idx = np.argmin(np.linalg.norm(P[tail][:, None, :] - curve[None], axis=2), axis=1)
    t = np.zeros(len(P))
    t[tail] = idx / (len(curve) - 1)
    for center in (0.3, 0.56, 0.82):
        band = 1 - smoothstep(0.05, 0.065, np.abs(t - center + wobble * 4))
        mix(band * tail, COLOR_RING)

    # 耳朵内侧
    for side, suffix in ((1, "L"), (-1, "R")):
        local, _ = ear_local(P, side)
        # 用耳杯平面内的柔边椭圆，不沿减面三角片的最近部位标签硬切颜色。
        oval = (local[:, 0] / 0.032) ** 2 + ((local[:, 1] - 0.053) / 0.038) ** 2
        inner = (1 - smoothstep(0.65, 1.0, oval)) * smoothstep(0.0, 0.007, local[:, 2])
        mix(inner, COLOR_EAR)

    # 嘴：脸正前方一个小"^"
    mouth_point, _ = surface_point((0.0, CRANIUM[0][1], MOUTH_Z), (0, -1, 0))
    rel = np.stack([x - mouth_point[0], z - mouth_point[2]], axis=1)
    front = (N[:, 1] < -0.4) & (np.abs(y - mouth_point[1]) < 0.02)
    stroke = distance_to_polyline(rel, [(-0.0105, -0.006), (0.0, 0.0018), (0.0105, -0.006)])
    mix((1 - smoothstep(0.0016, 0.0026, stroke)) * front, COLOR_MOUTH)

    # 爪子上的两道趾缝
    for kind in LEGS:
        for side, suffix in ((1, "L"), (-1, "R")):
            joints = leg_points(kind, side)
            paw_y = (joints[2][1] + joints[3][1]) / 2
            on_paw = (nearest == f"{kind}_{suffix}") & (y < paw_y - 0.004) & (N[:, 1] < -0.15)
            for offset in (-0.0105, 0.0105):
                line_x = joints[2][0] + offset * (1 + 0.25 * (0.03 - z) / 0.03)
                line = 1 - smoothstep(0.0012, 0.002, np.abs(x - line_x))
                # 趾缝在前掌低处自然收细，不把整只脚画成三根长条。
                taper = smoothstep(0.003, 0.007, z) * (1 - smoothstep(0.019, 0.027, z))
                mix(line * on_paw * taper, COLOR_LINE)

    # 短绒：保留低对比的细纤维，避免颜色噪声读成砂粒；绒光由材质承担
    tone = 1 + (value_noise(P, 0.03, 2) - 0.5) * 0.035
    fiber = 1 + (value_noise(P, 0.0016, 3) - 0.5) * 0.035
    color = color * (tone * fiber)[:, None] * (0.85 + 0.15 * occlusion)[:, None]

    srgb = np.where(color <= 0.0031308, color * 12.92, 1.055 * np.power(np.clip(color, 0, None), 1 / 2.4) - 0.055)
    out = np.zeros((TEXTURE_SIZE, TEXTURE_SIZE, 4), dtype=np.float32)
    out[..., :3] = hex_to_srgb(COLOR_BODY)
    out[..., 3] = 1.0
    out[valid, :3] = np.clip(srgb, 0, 1)
    return out


def build_texture(body):
    unwrap(body)
    if "--reuse-texture" in ARGS and os.path.exists(TEXTURE_PATH):
        # 网格和展 UV 都是确定性的，外形没改时可以直接用上次烘好的贴图
        print(f"[texture] 沿用 {TEXTURE_PATH}")
        return bpy.data.images.load(TEXTURE_PATH)
    position = bake(body, "position")
    normal = bake(body, "normal")
    ao = bake(body, "ao")
    pixels = paint_texture(position, normal, ao)

    os.makedirs(os.path.dirname(TEXTURE_PATH), exist_ok=True)
    image = bpy.data.images.new("tuanzi_color", TEXTURE_SIZE, TEXTURE_SIZE, alpha=False)
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = TEXTURE_PATH
    image.file_format = "PNG"
    image.save()
    image.filepath = bpy.path.relpath(TEXTURE_PATH) if bpy.data.filepath else TEXTURE_PATH
    print(f"[texture] {TEXTURE_PATH}")
    return image


# ---------------------------------------------------------------------------
# 骨骼与蒙皮
# ---------------------------------------------------------------------------

FPS = 60
SPINE = [(0.0, 0.12, 0.135), (0.0, 0.07, 0.14), (0.0, 0.02, 0.145), (0.0, -0.025, 0.148), (0.0, -0.07, 0.152)]
NECK = [(0.0, -0.07, 0.152), (0.0, -0.088, 0.190), (0.0, -0.106, 0.221)]
HEAD_TIP = (0.0, -0.106, 0.303)
TAIL_BONES = 10
# 部位交界处权重过渡的宽度：头和身子之间要宽，转头时胸口才不会被扯出褶
BLEND_WIDTH = {"torso": 0.012, "head": 0.03, "tail": 0.012, "ear": 0.008, "leg": 0.015}


def bone_layout():
    """{骨骼名: (头, 尾, 父骨骼)}，Blender 坐标。名字是和网页端的约定（方案 4.3）。"""
    bones = {"root": ((0.0, 0.0, 0.0), (0.0, 0.0, 0.05), None)}
    for i in range(4):
        bones[f"spine_0{i + 1}"] = (SPINE[i], SPINE[i + 1], "root" if i == 0 else f"spine_0{i}")
    bones["neck_01"] = (NECK[0], NECK[1], "spine_04")
    bones["neck_02"] = (NECK[1], NECK[2], "neck_01")
    bones["head"] = (NECK[2], HEAD_TIP, "neck_02")
    for side, suffix in ((1, "L"), (-1, "R")):
        base, tip, *_ = ear_frame(side)
        bones[f"ear_{suffix}"] = (tuple(base - (tip - base) * 0.15), tuple(tip), "head")
        for kind, parent in (("front", "spine_04"), ("hind", "spine_01")):
            j = leg_points(kind, side)
            leg = f"{kind}_{suffix}"
            bones[f"{leg}_upper"] = (tuple(j[0]), tuple(j[1]), parent)
            bones[f"{leg}_lower"] = (tuple(j[1]), tuple(j[2]), f"{leg}_upper")
            bones[f"{leg}_paw"] = (tuple(j[2]), tuple(j[3]), f"{leg}_lower")
    joints = tail_curve(TAIL_BONES + 1)
    for i in range(TAIL_BONES):
        bones[f"tail_{i + 1:02d}"] = (tuple(joints[i]), tuple(joints[i + 1]), "spine_01" if i == 0 else f"tail_{i:02d}")
    return bones


def build_armature():
    data = bpy.data.armatures.new("tuanzi_rig")
    arm = bpy.data.objects.new("tuanzi", data)
    bpy.context.scene.collection.objects.link(arm)
    set_active(arm)
    bpy.ops.object.mode_set(mode="EDIT")
    layout = bone_layout()
    for name, (head, tail, _) in layout.items():
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
    for name, (head, _, parent) in layout.items():
        if parent:
            bone = data.edit_bones[name]
            bone.parent = data.edit_bones[parent]
            bone.use_connect = (data.edit_bones[parent].tail - bone.head).length < 1e-6
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return arm


def chain_weights(points, joints, names):
    """沿一串关节的骨链分权重：骨段中点全归这节，关节处两节各半。"""
    joints = np.asarray(joints, dtype=np.float64)
    best = np.full(len(points), np.inf)
    u = np.zeros(len(points))
    for i in range(len(names)):
        a, b = joints[i], joints[i + 1]
        ab = b - a
        t = np.clip(((points - a) @ ab) / (ab @ ab), 0.0, 1.0)
        d = np.linalg.norm(points - (a + t[:, None] * ab), axis=1)
        closer = d < best
        best[closer] = d[closer]
        u[closer] = i + t[closer]
    weights = np.stack([np.clip(1.0 - np.abs(u - (k + 0.5)), 0.0, 1.0) for k in range(len(names))], axis=1)
    return {name: weights[:, k] for k, name in enumerate(names)}


def skin_weights(points):
    layout = bone_layout()
    regions = sd_regions(points)
    nearest = np.min(np.stack(list(regions.values())), axis=0)
    total = {}

    def add(region, bone_weights):
        width = BLEND_WIDTH["ear" if region.startswith("ear") else "leg" if region.startswith(("front", "hind")) else region]
        share = np.clip(1.0 - (regions[region] - nearest) / width, 0.0, 1.0) ** 2
        for bone, w in bone_weights.items():
            total[bone] = total.get(bone, 0.0) + share * w

    spine_joints = SPINE + NECK[1:]
    add("torso", chain_weights(points, spine_joints, ["spine_01", "spine_02", "spine_03", "spine_04", "neck_01", "neck_02"]))
    add("head", {"head": np.ones(len(points))})
    for side, suffix in ((1, "L"), (-1, "R")):
        head, tail, _ = layout[f"ear_{suffix}"]
        head, tail = np.array(head), np.array(tail)
        t = np.clip(((points - head) @ (tail - head)) / ((tail - head) @ (tail - head)), 0.0, 1.0)
        ear = smoothstep(0.1, 0.4, t)
        add(f"ear_{suffix}", {f"ear_{suffix}": ear, "head": 1.0 - ear})
        for kind, parent in (("front", "spine_04"), ("hind", "spine_01")):
            j = leg_points(kind, side)
            leg = f"{kind}_{suffix}"
            # 用沿腿高度的连续区间混合，避免最近线段在弯处切换造成权重折角。
            z = points[:, 2]
            shoulder = smoothstep(j[0][2] - 0.010, j[0][2] + 0.034, z)
            elbow = smoothstep(j[1][2] - 0.028, j[1][2] + 0.028, z)
            wrist = smoothstep(j[2][2] - 0.009, j[2][2] + 0.018, z)
            add(leg, {parent: shoulder,
                      f"{leg}_upper": (1 - shoulder) * elbow,
                      f"{leg}_lower": (1 - shoulder) * (1 - elbow) * wrist,
                      f"{leg}_paw": (1 - shoulder) * (1 - elbow) * (1 - wrist)})
    tail_joints = tail_curve(TAIL_BONES + 1)
    lead = tail_joints[0] - (tail_joints[1] - tail_joints[0]) * 1.5
    add("tail", chain_weights(points, [lead] + list(tail_joints), ["spine_01"] + [f"tail_{i + 1:02d}" for i in range(TAIL_BONES)]))

    names = list(total)
    matrix = np.stack([np.broadcast_to(total[n], (len(points),)) for n in names], axis=1)
    # 每个顶点最多 4 根骨骼（glTF 与 three.js 的上限）
    order = np.argsort(-matrix, axis=1)
    keep = np.zeros_like(matrix, dtype=bool)
    np.put_along_axis(keep, order[:, :4], True, axis=1)
    matrix = np.where(keep, matrix, 0.0)
    matrix /= np.maximum(matrix.sum(axis=1, keepdims=True), 1e-9)
    return names, matrix


def bind(obj, arm, names, matrix):
    groups = {name: obj.vertex_groups.new(name=name) for name in names}
    rows, cols = np.nonzero(matrix > 1e-4)
    for r, c in zip(rows.tolist(), cols.tolist()):
        groups[names[c]].add([r], float(matrix[r, c]), "REPLACE")
    modifier = obj.modifiers.new("rig", "ARMATURE")
    modifier.object = arm
    obj.parent = arm


def relax_weights(obj, names, matrix):
    """按真实网格邻接平滑关节权重，消掉距离场分区／减面形成的小折痕。
    只改蒙皮；不平滑顶点，所以不改变脸、纹样或物理尺度。
    """
    edges = np.array([edge.vertices[:] for edge in obj.data.edges], dtype=np.int32)
    degree = np.bincount(edges.ravel(), minlength=len(matrix)).astype(float)
    for _ in range(6):
        neighbors = np.zeros_like(matrix)
        np.add.at(neighbors, edges[:, 0], matrix[edges[:, 1]])
        np.add.at(neighbors, edges[:, 1], matrix[edges[:, 0]])
        matrix = 0.45 * matrix + 0.55 * neighbors / np.maximum(degree[:, None], 1)
    order = np.argsort(-matrix, axis=1)
    keep = np.zeros_like(matrix, dtype=bool)
    np.put_along_axis(keep, order[:, :4], True, axis=1)
    matrix = np.where(keep, matrix, 0)
    matrix /= np.maximum(matrix.sum(axis=1, keepdims=True), 1e-9)
    return names, matrix


def add_blink(eye):
    """眨眼形态键：上眼睑盖下来，眼睛压成靠下的一道。"""
    center = np.array(eye["eye_center"])
    basis = np.array(eye["eye_basis"])
    eye.shape_key_add(name="Basis")
    key = eye.shape_key_add(name="blink")
    key.value = 0.0  # Blender 5 新建的形态键默认值是 1，会导出成闭眼
    low = -0.3 * EYE_RADII[1]
    for vertex in key.data:
        local = basis.T @ (np.array(vertex.co) - center)
        local[1] = low + (local[1] - low) * 0.12
        vertex.co = Vector(center + basis @ local)


# ---------------------------------------------------------------------------
# 动作：每帧摆好身体、设好四只爪子的目标点，让 Blender 的 IK 解腿，再把结果烘成关键帧
# ---------------------------------------------------------------------------

STRIDE = 0.12  # 走路一个周期身体前进的距离
WALK_SECONDS = 0.48
DUTY = 0.62
X_AXIS, Y_AXIS, Z_AXIS = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
LEG_NAMES = [f"{kind}_{suffix}" for kind in LEGS for suffix in ("L", "R")]
SIT_HIP_DROP = 0.057
SIT_HIP_TILT = -22.0


def armature_rotation(pb, *turns):
    """按骨架坐标轴转（轴, 角度）若干次，换成这根骨头自己坐标系里的旋转。
    X 正转：朝前的方向往下低；Z 正转：往猫的左边转。"""
    rest = pb.bone.matrix_local.to_3x3()
    rotation = Matrix.Identity(3)
    for axis, degrees in turns:
        rotation = Matrix.Rotation(math.radians(degrees), 3, axis) @ rotation
    return (rest.inverted() @ rotation @ rest).to_quaternion()


def armature_offset(pb, offset):
    return pb.bone.matrix_local.to_3x3().inverted() @ Vector(offset)


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * t * (t * (6 * t - 15) + 10)


def setup_leg_ik(arm):
    targets = {}
    for leg in LEG_NAMES:
        lower = arm.pose.bones[f"{leg}_lower"]
        paw = arm.pose.bones[f"{leg}_paw"]
        empty = bpy.data.objects.new(f"ik_{leg}", None)
        bpy.context.scene.collection.objects.link(empty)
        empty.rotation_mode = "QUATERNION"
        rest_rotation = paw.bone.matrix_local.to_quaternion()
        ik = lower.constraints.new("IK")
        ik.target = empty
        ik.chain_count = 2
        copy = paw.constraints.new("COPY_ROTATION")
        copy.target = empty
        targets[leg] = (empty, lower.bone.tail_local.copy(), rest_rotation)
    return targets


def teardown_leg_ik(arm, targets):
    for pb in arm.pose.bones:
        for constraint in list(pb.constraints):
            pb.constraints.remove(constraint)
    for empty, _, _ in targets.values():
        bpy.data.objects.remove(empty)


def breathing(pose, arm, phase, amount=0.008):
    swell = 1.0 + amount * math.sin(2 * math.pi * phase)
    for name in ("spine_02", "spine_03"):
        pose.setdefault("scale", {})[name] = Vector((swell, 1.0, swell))


def tail_wave(pose, arm, phase, yaw, lift=0.0, lag=0.08):
    for i in range(TAIL_BONES):
        name = f"tail_{i + 1:02d}"
        angle = yaw * math.sin(2 * math.pi * (phase - lag * i)) * (0.4 + 0.6 * i / TAIL_BONES)
        pose["rot"][name] = armature_rotation(arm.pose.bones[name], (Z_AXIS, angle), (X_AXIS, -lift))


def pose_idle(arm, phase):
    pose = {"rot": {}, "loc": {}, "feet": {}}
    breathing(pose, arm, phase)
    pose["rot"]["head"] = armature_rotation(arm.pose.bones["head"], (X_AXIS, 0.8 * math.sin(2 * math.pi * phase)))
    tail_wave(pose, arm, phase, yaw=3.0)
    return pose


def foot_cycle(phase, offset, stride, lift):
    """支撑期匀速后移；摆动的端点速度与支撑期一致，离地／落地不骤停。"""
    travel = stride * DUTY
    local = (phase - offset) % 1.0
    if local < DUTY:
        s = local / DUTY
        return travel * (s - 0.5), 0.0, 0.0
    s = (local - DUTY) / (1.0 - DUTY)
    # 五次 Hermite：端点位置 ±travel/2、速度 stride、加速度 0。
    # 上版摆线端点速度为 0，接支撑期时突然变成 stride，脚会顿一下。
    dy = travel * 0.5 + stride * (1 - DUTY) * s - stride * ease(s)
    arc = math.sin(math.pi * s) ** 2
    return dy, lift * arc, 22.0 * arc


# 走路是侧对步：左后、左前、右后、右前依次落地
GAIT_OFFSETS = {"hind_L": 0.0, "front_L": 0.25, "hind_R": 0.5, "front_R": 0.75}


def pose_walk(arm, phase):
    pose = {"rot": {}, "loc": {}, "feet": {}}
    for leg, offset in GAIT_OFFSETS.items():
        lift = 0.021 if leg.startswith("front") else 0.018
        dy, dz, curl = foot_cycle(phase, offset, STRIDE, lift)
        pose["feet"][leg] = ((0.0, dy, dz), curl)
    spine = arm.pose.bones["spine_01"]
    pose["loc"]["spine_01"] = armature_offset(spine, (0.0, 0.0, -0.003 * math.cos(4 * math.pi * phase)))
    pose["rot"]["spine_01"] = armature_rotation(spine, (Y_AXIS, 1.5 * math.sin(2 * math.pi * phase)), (Z_AXIS, 2.0 * math.sin(2 * math.pi * phase)))
    pose["rot"]["spine_03"] = armature_rotation(arm.pose.bones["spine_03"], (Z_AXIS, -2.5 * math.sin(2 * math.pi * phase)))
    pose["rot"]["head"] = armature_rotation(arm.pose.bones["head"], (X_AXIS, 1.5 * math.cos(4 * math.pi * (phase - 0.06))))
    spring = math.sin(4 * math.pi * (phase - 0.06))
    pose["scale"] = {"spine_03": Vector((1.0 - 0.006 * spring, 1.0, 1.0 + 0.008 * spring))}
    for sign, suffix in ((1, "L"), (-1, "R")):
        pose["rot"][f"ear_{suffix}"] = armature_rotation(arm.pose.bones[f"ear_{suffix}"], (Y_AXIS, sign * 1.8 * spring))
    tail_wave(pose, arm, phase, yaw=3.0, lift=0.7, lag=0.10)
    return pose


def pose_step(arm, phase):
    """四拍踏步：保留三脚支撑的停顿，转向由网页端转整只猫。"""
    pose = {"rot": {}, "loc": {}, "feet": {}}
    for leg, offset in GAIT_OFFSETS.items():
        local = (phase - offset) % 1.0
        s = max(0.0, (local - 0.72) / 0.28)
        arc = math.sin(math.pi * s) ** 2
        pose["feet"][leg] = ((0.0, 0.0, 0.016 * arc), 12 * arc)
    tail_wave(pose, arm, phase, yaw=2.5)
    return pose


def sit_amount_body(arm, pose, amount, phase=0.0):
    hips = ease(amount)
    spine = arm.pose.bones["spine_01"]
    pose["loc"]["spine_01"] = armature_offset(spine, (0.0, 0.022 * hips, -SIT_HIP_DROP * hips))
    pose["rot"]["spine_01"] = armature_rotation(spine, (X_AXIS, SIT_HIP_TILT * hips))
    pose["rot"]["spine_04"] = armature_rotation(arm.pose.bones["spine_04"], (X_AXIS, 20.0 * hips))
    pose["rot"]["neck_01"] = armature_rotation(arm.pose.bones["neck_01"], (X_AXIS, 4.0 * hips))
    pose["rot"]["head"] = armature_rotation(arm.pose.bones["head"], (X_AXIS, -2.0 * hips + 0.8 * math.sin(2 * math.pi * phase)))
    # 前爪保持承重点，不在地面上平移；坐下靠后腿折叠与骨盆下降。
    return pose


def sit_amount(arm, pose, amount, phase=0.0):
    """amount 0 = 站，1 = 坐。后半身先落，尾巴后绕。"""
    wrap = ease((amount - 0.35) / 0.65)
    sit_amount_body(arm, pose, amount, phase)
    for name, rotation in sit_tail_rotations(arm).items():
        pose["rot"][name] = Quaternion().slerp(rotation, wrap)
    return pose


# 坐下时尾巴的走向：从尾根往后落到地上，再绕到猫的左侧往前收
SIT_TAIL_PATH = [(0.064, 0.18, 0.075), (0.13, 0.125, 0.041), (0.14, 0.02, 0.038), (0.115, -0.085, 0.036), (0.055, -0.13, 0.034)]
_sit_tail_cache = {}


def sit_tail_rotations(arm):
    """先把身子摆成坐姿，再逐节把尾巴骨转向目标路径，得到每节的局部旋转。"""
    if _sit_tail_cache:
        return _sit_tail_cache
    body = sit_amount_body(arm, {"rot": {}, "loc": {}, "feet": {}}, 1.0)
    for pb in arm.pose.bones:
        pb.location = body["loc"].get(pb.name, Vector())
        pb.rotation_quaternion = body["rot"].get(pb.name, Quaternion())
        pb.scale = Vector((1, 1, 1))
    bpy.context.view_layer.update()
    parent_matrix = arm.pose.bones["spine_01"].matrix.copy()
    parent_rest = arm.pose.bones["spine_01"].bone.matrix_local
    head = None
    path = None
    for i in range(TAIL_BONES):
        pb = arm.pose.bones[f"tail_{i + 1:02d}"]
        rest_relative = parent_rest.inverted() @ pb.bone.matrix_local
        frame = parent_matrix @ rest_relative
        if path is None:
            head = frame.translation.copy()
            path = [np.array(head)] + [np.array(p) for p in SIT_TAIL_PATH]
            lengths = [arm.pose.bones[f"tail_{k + 1:02d}"].bone.length for k in range(TAIL_BONES)]
            curve = resample_by_length(catmull_rom(path, 500), 500)
            cumulative = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(curve, axis=0), axis=1))])
            targets = [Vector(curve[np.searchsorted(cumulative, min(sum(lengths[:k + 1]), cumulative[-1]))]) for k in range(TAIL_BONES)]
        current = frame.col[1].xyz.normalized()
        wanted = (targets[i] - frame.translation).normalized()
        turn = current.rotation_difference(wanted).to_matrix()
        basis = frame.to_3x3().normalized()
        local = (basis.inverted() @ turn @ basis).to_quaternion()
        _sit_tail_cache[pb.name] = local
        parent_matrix = frame @ local.to_matrix().to_4x4()
        parent_rest = pb.bone.matrix_local
    return _sit_tail_cache


def pose_sit_down(arm, phase):
    pose = sit_amount(arm, {"rot": {}, "loc": {}, "feet": {}}, ease((phase - 0.08) / 0.84))
    # 落臀之前轻微前倾，结束时恢复稳定端点。
    anticipation = math.sin(math.pi * min(phase / 0.35, 1)) ** 2 if phase < 0.35 else 0.0
    pose["rot"]["neck_02"] = armature_rotation(arm.pose.bones["neck_02"], (X_AXIS, 2.0 * anticipation))
    return pose


def pose_sit_idle(arm, phase):
    pose = sit_amount(arm, {"rot": {}, "loc": {}, "feet": {}}, 1.0, phase)
    breathing(pose, arm, phase, amount=0.003)
    return pose


def pose_stand_up(arm, phase):
    # 起身先向前承重，再抬臀；不是把坐下的节奏简单倒放。
    amount = 1.0 - ease((phase - 0.13) / 0.78)
    pose = sit_amount(arm, {"rot": {}, "loc": {}, "feet": {}}, amount)
    lean = math.sin(math.pi * phase) ** 2
    pose["rot"]["neck_02"] = armature_rotation(arm.pose.bones["neck_02"], (X_AXIS, 3.0 * lean))
    return pose


def pose_ear_flick(arm, phase):
    pose = {"rot": {}, "loc": {}, "feet": {}}
    flick = math.sin(math.pi * min(phase / 0.38, 1)) ** 2 if phase < 0.38 else -0.18 * math.sin(math.pi * (phase - 0.38) / 0.62) ** 2
    pose["rot"]["ear_L"] = armature_rotation(arm.pose.bones["ear_L"], (Y_AXIS, -28.0 * flick), (X_AXIS, 12.0 * flick))
    return pose


CLIPS = [  # (名字, 秒, 摆姿势的函数, 是否循环)
    ("idle", 2.4, pose_idle, True),
    ("walk", WALK_SECONDS, pose_walk, True),
    ("turn_step", 0.8, pose_step, True),
    ("sit_down", 1.25, pose_sit_down, False),
    ("sit_idle", 2.4, pose_sit_idle, True),
    ("stand_up", 1.05, pose_stand_up, False),
    ("ear_flick", 0.55, pose_ear_flick, False),
]


def apply_pose(arm, targets, pose):
    for pb in arm.pose.bones:
        pb.location = pose["loc"].get(pb.name, Vector())
        pb.rotation_quaternion = pose["rot"].get(pb.name, Quaternion())
        pb.scale = pose.get("scale", {}).get(pb.name, Vector((1, 1, 1)))
    for leg, (empty, rest_location, rest_rotation) in targets.items():
        offset, curl = pose["feet"].get(leg, ((0.0, 0.0, 0.0), 0.0))
        empty.location = rest_location + Vector(offset)
        empty.rotation_quaternion = Quaternion(X_AXIS, math.radians(curl)) @ rest_rotation
    bpy.context.view_layer.update()
    # 四元数逐节插值不保证中途避开地面。按真实骨长抬起会入地的段，
    # 保留水平方向与骨长；余量覆盖尾巴半径及蒙皮圆弧，不只检查尾尖。
    for i in range(TAIL_BONES):
        pb = arm.pose.bones[f"tail_{i + 1:02d}"]
        clearance = TAIL_RADII[0] + (TAIL_RADII[1] - TAIL_RADII[0]) * (i + 1) / TAIL_BONES + 0.005
        if pb.tail.z >= clearance:
            continue
        frame = pb.matrix.copy()
        direction = (pb.tail - pb.head).normalized()
        wanted_z = min(0.98, max(-0.98, (clearance - pb.head.z) / pb.length))
        horizontal = Vector((direction.x, direction.y, 0))
        if horizontal.length < 1e-6:
            horizontal = Vector((1, 0, 0))
        horizontal.normalize()
        wanted = horizontal * math.sqrt(1 - wanted_z ** 2) + Vector((0, 0, wanted_z))
        turn = direction.rotation_difference(wanted).to_matrix()
        corrected = (turn @ frame.to_3x3()).to_4x4()
        corrected.translation = frame.translation
        pb.matrix = corrected
        bpy.context.view_layer.update()


def bake_clip(arm, targets, name, seconds, pose_fn, loop):
    frames = round(seconds * FPS)
    samples = []
    # 循环动作最后一帧与第一帧相同，播放器首尾相接不跳
    for f in range(frames + 1):
        phase = f / frames
        apply_pose(arm, targets, pose_fn(arm, phase % 1.0 if loop else phase))
        samples.append({
            pb.name: arm.convert_space(pose_bone=pb, matrix=pb.matrix, from_space="POSE", to_space="LOCAL")
            for pb in arm.pose.bones
        })
    return samples


def key_clip(arm, name, samples):
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = action
    for frame, sample in enumerate(samples):
        for bone_name, matrix in sample.items():
            pb = arm.pose.bones[bone_name]
            location, rotation, scale = matrix.decompose()
            pb.location, pb.rotation_quaternion, pb.scale = location, rotation, scale
            for path in ("location", "rotation_quaternion", "scale"):
                pb.keyframe_insert(path, frame=frame, group=bone_name)
    arm.animation_data.action = None
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, action)
    if hasattr(strip, "action_slot") and action.slots:
        strip.action_slot = action.slots[0]
    track.mute = True  # 免得几段动作在 Blender 里叠着播；导出器照样逐条导出
    return action


def build_animations(arm):
    targets = setup_leg_ik(arm)
    baked = {name: bake_clip(arm, targets, name, seconds, fn, loop) for name, seconds, fn, loop in CLIPS}
    review = {
        "sit": pose_sit_idle(arm, 0.0),
        "walk": pose_walk(arm, 0.18),
        # 网页端看光标最多转 45°（neck_01 20%、neck_02 25%、head 55%），这里摆满量程
        "head-turn": {"rot": {"neck_01": armature_rotation(arm.pose.bones["neck_01"], (Z_AXIS, 9)),
                              "neck_02": armature_rotation(arm.pose.bones["neck_02"], (Z_AXIS, 11.25)),
                              "head": armature_rotation(arm.pose.bones["head"], (Z_AXIS, 24.75), (X_AXIS, -10))},
                      "loc": {}, "feet": {}},
    }
    review_samples = {}
    for key, pose in review.items():
        apply_pose(arm, targets, pose)
        review_samples[key] = {pb.name: arm.convert_space(pose_bone=pb, matrix=pb.matrix, from_space="POSE", to_space="LOCAL") for pb in arm.pose.bones}
    teardown_leg_ik(arm, targets)
    for pb in arm.pose.bones:
        pb.location, pb.rotation_quaternion, pb.scale = Vector(), Quaternion(), Vector((1, 1, 1))
    for name, samples in baked.items():
        key_clip(arm, name, samples)
    arm["strideLength"] = STRIDE
    arm["walkSeconds"] = WALK_SECONDS
    return review_samples


def set_pose(arm, sample):
    for bone_name, matrix in sample.items():
        pb = arm.pose.bones[bone_name]
        pb.location, pb.rotation_quaternion, pb.scale = matrix.decompose()
    bpy.context.view_layer.update()


def export_glb():
    os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
    wanted = dict(
        filepath=GLB_PATH, export_format="GLB", use_selection=False, export_yup=True,
        export_texcoords=True, export_normals=True, export_tangents=False,
        export_materials="EXPORT", export_image_format="JPEG", export_jpeg_quality=86, export_image_quality=86,
        export_cameras=False, export_lights=False, export_extras=True,
        export_skins=True, export_all_influences=False, export_def_bones=False,
        export_morph=True, export_morph_normal=False,
        export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
        export_optimize_animation_size=True, export_anim_slide_to_zero=True,
    )
    available = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    dropped = sorted(set(wanted) - available)
    if dropped:
        print(f"[export] 当前 Blender 没有这些导出选项，已跳过：{dropped}")
    bpy.ops.export_scene.gltf(**{k: v for k, v in wanted.items() if k in available})
    print(f"[export] {GLB_PATH} {os.path.getsize(GLB_PATH) / 1024:.0f} KB")


# ---------------------------------------------------------------------------
# 渲染
# ---------------------------------------------------------------------------

VIEWS = {  # 方位角：0 = 正对猫脸，正值往猫的左侧（+X）转；与 web/src/stage.ts 一致
    "front": (0.0, 8.0),
    "side": (-90.0, 0.0),
    "three-quarter": (40.0, 14.0),
}


def setup_render_scene():
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"

    world = bpy.data.worlds.new("cream")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs[0].default_value = (*hex_to_linear("#efe5d3"), 1.0)
    background.inputs[1].default_value = 0.9
    scene.world = world

    key_data = bpy.data.lights.new("key", "SUN")
    key_data.energy = 2.2
    key_data.angle = math.radians(12)
    key = bpy.data.objects.new("key", key_data)
    key.rotation_euler = Vector((-1.4, -1.8, 2.4)).to_track_quat("Z", "Y").to_euler()
    key.rotation_euler = (Vector((0, 0, 0)) - Vector((-1.4, -1.8, 2.4))).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(key)

    rim_data = bpy.data.lights.new("rim", "SUN")
    rim_data.energy = 0.65
    rim = bpy.data.objects.new("rim", rim_data)
    rim.rotation_euler = (Vector((0, 0, 0)) - Vector((1.8, 2.0, 1.4))).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(rim)

    cam_data = bpy.data.cameras.new("review")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 0.62
    cam = bpy.data.objects.new("review", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def render_views(tag, views=tuple(VIEWS)):
    os.makedirs(RENDER_DIR, exist_ok=True)
    scene = bpy.context.scene
    cam = scene.camera or setup_render_scene()
    scene.render.engine = "BLENDER_EEVEE"
    focus = Vector((0.0, 0.02, 0.18))
    for name in views:
        azimuth, elevation = VIEWS[name]
        az = math.radians(azimuth)
        el = math.radians(elevation)
        direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
        cam.location = focus + direction * 2.0
        cam.rotation_euler = (focus - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(RENDER_DIR, f"{tag}-{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[render] {scene.render.filepath}")


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def file_sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def guard_hand_edits():
    if not os.path.exists(BLEND_PATH) or "--force" in ARGS:
        return
    recorded = json.load(open(MANIFEST_PATH)).get("blend_sha256") if os.path.exists(MANIFEST_PATH) else None
    if recorded != file_sha256(BLEND_PATH):
        raise SystemExit("tuanzi.blend 和上次生成的不一样，可能被手调过。确认要覆盖再加 --force。")


def main():
    guard_hand_edits()
    if "--animations-only" in ARGS:
        bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)
        bpy.context.preferences.filepaths.save_version = 0
        arm = bpy.data.objects["tuanzi"]
        if "--repaint-texture" in ARGS:
            body = bpy.data.objects["tuanzi_body"]
            material = body.data.materials[0]
            texture = build_texture(body)
            body.data.materials.clear()
            body.data.materials.append(material)
            for node in material.node_tree.nodes:
                if node.type == "TEX_IMAGE":
                    node.image = texture
            bpy.context.scene.render.engine = "BLENDER_EEVEE"
        if "--polish-surface" in ARGS:
            polish_forehead(bpy.data.objects["tuanzi_body"])
        if "--rebind" in ARGS:
            body = bpy.data.objects["tuanzi_body"]
            names, matrix = skin_weights(np.array([v.co[:] for v in body.data.vertices]))
            names, matrix = relax_weights(body, names, matrix)
            body.vertex_groups.clear()
            for mod in list(body.modifiers):
                if mod.type == "ARMATURE":
                    body.modifiers.remove(mod)
            bind(body, arm, names, matrix)
        arm.animation_data_clear()
        for name, *_ in CLIPS:
            old = bpy.data.actions.get(name)
            if old:
                bpy.data.actions.remove(old)
        for pb in arm.pose.bones:
            pb.location, pb.rotation_quaternion, pb.scale = Vector(), Quaternion(), Vector((1, 1, 1))
        review = build_animations(arm)
        if "--no-render" not in ARGS:
            for key in ("sit", "walk", "head-turn"):
                set_pose(arm, review[key])
                render_views(f"pose-{key}")
        for pb in arm.pose.bones:
            pb.location, pb.rotation_quaternion, pb.scale = Vector(), Quaternion(), Vector((1, 1, 1))
        export_glb()
        bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH, relative_remap=True)
        with open(MANIFEST_PATH, "w") as f:
            json.dump({"blend_sha256": file_sha256(BLEND_PATH), "glb_bytes": os.path.getsize(GLB_PATH)}, f, indent=2)
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0  # 不留 .blend1 备份
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.unit_settings.system = "METRIC"

    body = build_body_mesh()
    eyes = build_eyes()
    eye_material = bpy.data.materials.new("tuanzi_eye")
    eye_material.use_nodes = True
    bsdf = eye_material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_to_linear(COLOR_EYE), 1.0)
    bsdf.inputs["Roughness"].default_value = 0.28
    for eye in eyes:
        eye.data.materials.append(eye_material)

    setup_render_scene()
    texture = build_texture(body) if UNTIL != "shape" else None

    body_material = bpy.data.materials.new("tuanzi_body")
    body_material.use_nodes = True
    nodes = body_material.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_to_linear(COLOR_BODY), 1.0)
    bsdf.inputs["Roughness"].default_value = 0.73
    bsdf.inputs["Sheen Weight"].default_value = 0.5
    bsdf.inputs["Sheen Roughness"].default_value = 0.65
    bsdf.inputs["Sheen Tint"].default_value = (*hex_to_linear("#ffe3b9"), 1.0)
    bsdf.inputs["Subsurface Weight"].default_value = 0.045
    bsdf.inputs["Subsurface Radius"].default_value = (0.015, 0.008, 0.004)
    if texture is not None:
        image_node = nodes.new("ShaderNodeTexImage")
        image_node.image = texture
        body_material.node_tree.links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
    body.data.materials.clear()
    body.data.materials.append(body_material)

    if UNTIL in ("shape", "texture"):
        if "--no-render" not in ARGS:
            render_views(UNTIL)
        return

    arm = build_armature()
    names, matrix = skin_weights(np.array([v.co[:] for v in body.data.vertices]))
    names, matrix = relax_weights(body, names, matrix)
    bind(body, arm, names, matrix)
    for eye in eyes:
        add_blink(eye)
        bind(eye, arm, ["head"], np.ones((len(eye.data.vertices), 1)))
    print(f"[rig] {len(arm.data.bones)} 根骨骼，身体顶点 {len(body.data.vertices)}")
    scene.render.fps = FPS
    review = build_animations(arm)
    print(f"[rig] 动作：{[t.name for t in arm.animation_data.nla_tracks]}")

    if "--no-render" not in ARGS:
        render_views("final")
        for key in ("sit", "walk", "head-turn"):
            set_pose(arm, review[key])
            render_views(f"pose-{key}", views=("three-quarter", "side", "front"))
        for pb in arm.pose.bones:
            pb.location, pb.rotation_quaternion, pb.scale = Vector(), Quaternion(), Vector((1, 1, 1))

    if UNTIL == "rig":
        return

    export_glb()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH, relative_remap=True)
    with open(MANIFEST_PATH, "w") as f:
        json.dump({"blend_sha256": file_sha256(BLEND_PATH), "glb_bytes": os.path.getsize(GLB_PATH)}, f, indent=2)
    print(f"[save] {BLEND_PATH}")


if __name__ == "__main__":
    main()
