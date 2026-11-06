"""以实际GLB运行时采样表面，对真实吊窝壳/窝沿/软垫做最近表面量测。"""
import bpy,json,numpy as np,os
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'assets/yard-3d/yard.blend'))
meta=json.load(open('/tmp/maomao-nest/frames.json'));pts=np.fromfile('/tmp/maomao-nest/surface.bin',dtype=np.float32).reshape((-1,meta['vertices'],3))
def inside(tree, point):
 votes=0
 for xyz in [(1,.123,.234),(.135,1,.357),(.246,.157,1)]:
  direction=Vector(xyz).normalized();origin=point.copy();crossings=0
  for _ in range(40):
   hit,_,_,_=tree.ray_cast(origin,direction)
   if hit is None:break
   crossings+=1;origin=hit+direction*1e-3
  votes+=crossings%2
 return votes>=2
report={};deps=bpy.context.evaluated_depsgraph_get()
for name in ['nest_shell','nest_opening_rim','nest_cushion','tree_trunk','tree_branch','tree_fork_0','tree_fork_1','tree_fork_2']:
 o=bpy.data.objects[name];e=o.evaluated_get(deps);m=e.to_mesh();v=[e.matrix_world@x.co for x in m.vertices];polys=[list(p.vertices) for p in m.polygons];tree=BVHTree.FromPolygons(v,polys);e.to_mesh_clear()
 a=np.array(v);low=a.min(axis=0);high=a.max(axis=0);states={}
 for frame,points in zip(meta['frames'],pts):
  result=states.setdefault(frame['state'],{'penetration':0,'verticesInside':0})
  mask=np.all(points>=low,axis=1)&np.all(points<=high,axis=1)
  for index in np.flatnonzero(mask):
   p=Vector(points[index]);hit,n,_,d=tree.find_nearest(p)
   if hit is not None and (p-hit).dot(n)<-1e-6 and inside(tree,p):
    result['verticesInside']+=1
    if d>result['penetration']:result.update(penetration=d,frame=frame['frame'],vertex=int(index),point=list(p))
 report[name]=states
os.makedirs(os.path.join(ROOT,'outputs/tuanzi-nest-review/metrics'),exist_ok=True)
with open(os.path.join(ROOT,'outputs/tuanzi-nest-review/metrics/contact.json'),'w') as f:json.dump(report,f,indent=2)
print(json.dumps(report,indent=2))
# 壳不许穿入；软绳沿最多2mm贴合，软垫最多5mm压入。
for name,limit in [('nest_shell',.0001),('nest_opening_rim',.002),('nest_cushion',.005),('tree_trunk',.0001),('tree_branch',.0001),('tree_fork_0',.0001),('tree_fork_1',.0001),('tree_fork_2',.0001)]:
 assert max(v['penetration'] for v in report[name].values())<=limit,(name,report[name])
