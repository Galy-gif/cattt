"""读取已保存的 .blend，逐帧量测并渲染；不保存或修改源文件。

blender -b assets/tuanzi-3d/tuanzi.blend -P assets/tuanzi-3d/review_tuanzi.py -- --label=before --render
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
LABEL = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--label=")), "after")
OUT = os.path.join(HERE, "renders", LABEL)
os.makedirs(OUT, exist_ok=True)
arm = bpy.data.objects["tuanzi"]
body = bpy.data.objects["tuanzi_body"]
scene = bpy.context.scene
legs = [f"{k}_{s}_paw" for k in ("front", "hind") for s in ("L", "R")]


def activate(name, frame=0):
    for track in arm.animation_data.nla_tracks:
        track.mute = True
    action = bpy.data.actions[name]
    arm.animation_data.action = action
    arm.animation_data.action_slot = action.slots[0]
    scene.frame_set(int(frame), subframe=frame % 1)
    bpy.context.view_layer.update()


def vertices():
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    points = np.array([v.co[:] for v in mesh.vertices])
    evaluated.to_mesh_clear()
    return points


tail_groups = {g.index for g in body.vertex_groups if g.name.startswith("tail_")}
tail_indices = [v.index for v in body.data.vertices if sum(g.weight for g in v.groups if g.group in tail_groups) > 0.65]
# 连通性与绑定完整性独立于渲染检查；每个身体顶点都须有归一权重。
parent = list(range(len(body.data.vertices)))
def root(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i
for edge in body.data.edges:
    a, b = edge.vertices
    parent[root(a)] = root(b)
components = {}
for i in range(len(parent)):
    key = root(i)
    components[key] = components.get(key, 0) + 1
weight_error = max(abs(sum(g.weight for g in v.groups) - 1) for v in body.data.vertices)
report = {"clips": {}, "tail_vertices": len(tail_indices),
          "body_connected_components": sorted(components.values(), reverse=True),
          "max_weight_normalization_error": weight_error}
for name in ("idle", "walk", "turn_step", "sit_down", "sit_idle", "stand_up", "ear_flick"):
    action = bpy.data.actions[name]
    first, last = map(int, action.frame_range)
    paws, heads, tails, minima, tail_minima = [], [], [], [], []
    for frame in range(first, last + 1):
        activate(name, frame)
        paws.append([arm.pose.bones[n].head[:] for n in legs])
        heads.append(arm.pose.bones["head"].head[:])
        tails.append(arm.pose.bones["tail_10"].tail[:])
        points = vertices()
        minima.append(float(points[:, 2].min()))
        tail_minima.append(float(points[tail_indices, 2].min()))
    paws, heads, tails = np.array(paws), np.array(heads), np.array(tails)
    report["clips"][name] = {
        "seconds": (last - first) / scene.render.fps,
        "frames": len(paws),
        "min_surface_z": min(minima),
        "min_tail_z": min(tail_minima),
        "paw_height_range": [float(paws[:, :, 2].min()), float(paws[:, :, 2].max())],
        "max_paw_frame_step": float(np.linalg.norm(np.diff(paws, axis=0), axis=2).max()),
        "paw_endpoint_delta": float(np.linalg.norm(paws[-1] - paws[0], axis=1).max()),
        "tail_endpoint_delta": float(np.linalg.norm(tails[-1] - tails[0])),
        "tail_tip_end": tails[-1].tolist(),
        "head_end": heads[-1].tolist(),
    }
report["triangles"] = sum(sum(len(p.vertices) - 2 for p in obj.data.polygons) for obj in bpy.data.objects if obj.type == "MESH")
with open(os.path.join(OUT, "metrics.json"), "w") as f:
    json.dump(report, f, indent=2)
print("REVIEW " + json.dumps(report))

if "--render" in ARGS:
    # 同一轮前后对照统一灯光，避免换灯掩盖造型变化。
    if "--consistent-light" in ARGS:
        bpy.data.lights["key"].energy = 2.2
        bpy.data.lights["rim"].energy = 0.65
    scene.render.resolution_x = scene.render.resolution_y = 700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = True
    camera = scene.camera
    focus = Vector((0, 0.02, 0.18))
    for pose, frame in (("idle", 0), ("sit_idle", 0), ("walk", 11)):
        activate(pose, frame)
        for view, azimuth, elevation in (("front", 0, 8), ("side", -90, 0), ("three-quarter", 40, 14)):
            az, el = map(math.radians, (azimuth, elevation))
            camera.location = focus + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * 2
            camera.rotation_euler = (focus - camera.location).to_track_quat("-Z", "Y").to_euler()
            scene.render.filepath = os.path.join(OUT, f"{pose}-{view}.png")
            bpy.ops.render.render(write_still=True)

arm.animation_data.action = None
