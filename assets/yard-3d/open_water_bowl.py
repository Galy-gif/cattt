"""仅把现有院子的水盆改成敞口；保留其他物件和手工修改。"""
import importlib.util,json,os
import bpy
HERE=os.path.dirname(__file__)
spec=importlib.util.spec_from_file_location('yard_builder',os.path.join(HERE,'build_yard.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
b.guard_hand_edits();bpy.ops.wm.open_mainfile(filepath=b.BLEND_PATH)
bpy.context.preferences.filepaths.save_version=0
obj=bpy.data.objects['bowl_body'];material=obj.data.materials[0]
obj.data=b.water_bowl_mesh();obj.data.materials.append(material);obj.modifiers.clear()
matrix=obj.matrix_world.copy();matrix.translation.z=0;obj.matrix_world=matrix
for face in obj.data.polygons:face.use_smooth=True
bpy.context.view_layer.update()
water=bpy.data.objects['bowl_water'];surface=max((water.matrix_world@v.co).z for v in water.data.vertices)
assert abs(surface-.047)<1e-5,surface
# 敞口中央向下探测应击中内底，不能再击中水面上方的顶盖。
from mathutils import Vector
hit,point,normal,index=obj.ray_cast(obj.matrix_world.inverted()@Vector((obj.matrix_world.translation.x,obj.matrix_world.translation.y,.1)),Vector((0,0,-1)))
assert hit and point.z<.015,(hit,point[:])
bpy.ops.wm.save_as_mainfile(filepath=b.BLEND_PATH)
bpy.ops.export_scene.gltf(filepath=b.GLB_PATH,export_format='GLB',export_apply=True,export_yup=True,export_animations=False,export_materials='EXPORT')
triangles=0;depsgraph=bpy.context.evaluated_depsgraph_get()
for o in bpy.data.objects:
    if o.type=='MESH':
        e=o.evaluated_get(depsgraph);m=e.to_mesh();m.calc_loop_triangles();triangles+=len(m.loop_triangles);e.to_mesh_clear()
manifest={'blend_sha256':b.sha256(b.BLEND_PATH),'glb_bytes':os.path.getsize(b.GLB_PATH),'triangles':triangles}
with open(b.MANIFEST_PATH,'w') as f:json.dump(manifest,f,indent=1);f.write('\n')
print('BOWL_SURFACE',surface,'OPENING_BOTTOM',point.z,'YARD',manifest)
