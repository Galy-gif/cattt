"""仅补栅栏宽横木，其余物件与模型保持。"""
import bpy,importlib.util,os,json,hashlib
HERE=os.path.dirname(__file__)
spec=importlib.util.spec_from_file_location('yard_builder',os.path.join(HERE,'build_yard.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
b.guard_hand_edits();bpy.ops.wm.open_mainfile(filepath=b.BLEND_PATH)
bpy.context.preferences.filepaths.save_version=0
from mathutils import Vector
def unchanged_world():
 data=[]
 for o in sorted(bpy.data.objects,key=lambda o:o.name):
  if o.name.startswith('fence_perch'):continue
  data.append((o.name,tuple(v for row in o.matrix_world for v in row)))
  if o.type=='MESH':data.append(([tuple(v.co) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
 return hashlib.sha256(repr(data).encode()).hexdigest()
before=unchanged_world()
root=bpy.data.objects['fence']
for obj in list(bpy.data.objects):
 if obj.name.startswith('fence_perch'):bpy.data.objects.remove(obj,do_unlink=True)
b.build_fence_perch(root)
assert unchanged_world()==before,'非栅栏横木物件被改写'
bpy.ops.wm.save_as_mainfile(filepath=b.BLEND_PATH)
bpy.ops.export_scene.gltf(filepath=b.GLB_PATH,export_format='GLB',export_apply=True,export_yup=True,export_animations=False,export_materials='EXPORT')
triangles=0;depsgraph=bpy.context.evaluated_depsgraph_get()
for o in bpy.data.objects:
 if o.type=='MESH':
  e=o.evaluated_get(depsgraph);m=e.to_mesh();m.calc_loop_triangles();triangles+=len(m.loop_triangles);e.to_mesh_clear()
with open(b.MANIFEST_PATH,'w') as f:json.dump({'blend_sha256':b.sha256(b.BLEND_PATH),'glb_bytes':os.path.getsize(b.GLB_PATH),'triangles':triangles},f,indent=1);f.write('\n')
