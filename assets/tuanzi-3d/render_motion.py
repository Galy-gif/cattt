"""从最终 .blend 输出约十秒动作检查视频；走路／转身是原地片段，世界移动由网页负责。
blender -b assets/tuanzi-3d/tuanzi.blend -P assets/tuanzi-3d/render_motion.py
不保存 .blend；MP4 只作本机验收，不提交。
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
review_dir = root / next((a.split('=', 1)[1] for a in args if a.startswith('--output=')), 'outputs/web-tuanzi-refinement-review')
review_dir.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
arm = bpy.data.objects['tuanzi']
arm.animation_data.action = None
for track in arm.animation_data.nla_tracks:
    track.mute = True

fps = 15
cursor = 1
# 前后动作重叠 0.15 秒，片段内部仍用原 60 fps 关键帧。
for name, repeats in [('idle', 0.4), ('ear_flick', 1), ('walk', 3), ('turn_step', 1.5), ('sit_down', 1), ('sit_idle', 0.8), ('stand_up', 1), ('idle', 0.4)]:
    action = bpy.data.actions[name]
    track = arm.animation_data.nla_tracks.new()
    track.name = 'review_' + name
    strip = track.strips.new(name, round(cursor), action)
    strip.action_slot = action.slots[0]
    strip.scale = fps / 60
    strip.repeat = repeats
    strip.extrapolation = 'NOTHING'
    strip.blend_type = 'REPLACE'
    strip.blend_in = min(3, (strip.frame_end-strip.frame_start)/3)
    cursor = strip.frame_end - 3

scene.render.fps = fps
scene.frame_start = 1
scene.frame_end = round(cursor + 3)
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
if hasattr(scene.eevee, 'taa_render_samples'):
    scene.eevee.taa_render_samples = 16

# 地面只用于看支撑关系，不进入源模型或 glb。
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.0003))
floor = bpy.context.object
mat = bpy.data.materials.new('review_ground')
mat.use_nodes = True
bsdf = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Base Color'].default_value = (0.72, 0.67, 0.55, 1)
bsdf.inputs['Roughness'].default_value = 1
floor.data.materials.append(mat)
camera = scene.camera
focus = Vector((0, 0.02, 0.20))
az, el = math.radians(40), math.radians(14)
camera.location = focus + Vector((math.sin(az)*math.cos(el),-math.cos(az)*math.cos(el),math.sin(el)))*2
camera.rotation_euler = (focus-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.ortho_scale = 0.62
scene.render.image_settings.media_type = 'VIDEO'
scene.render.image_settings.file_format = 'FFMPEG'
scene.render.ffmpeg.format = 'MPEG4'
scene.render.ffmpeg.codec = 'H264'
scene.render.ffmpeg.constant_rate_factor = 'HIGH'
scene.render.filepath = str(review_dir/'团子动作预览.mp4')
bpy.ops.render.render(animation=True)
