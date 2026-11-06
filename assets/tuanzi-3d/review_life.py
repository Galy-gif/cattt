import bpy,json,math,os,sys
import numpy as np
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
out=os.path.join(ROOT,'assets/tuanzi-3d/renders/life');os.makedirs(out,exist_ok=True)
a=bpy.data.objects['tuanzi'];body=bpy.data.objects['tuanzi_body'];s=bpy.context.scene
mouth=[v.index for v in body.data.vertices if abs(v.co.x)<.009 and v.co.y<-.196 and .169<v.co.z<.18]
print('MOUTH_VERTICES',len(mouth))
r={}
for name in ['bed_hop','sleep_down','sleep_idle','sleep_up','doze_down','doze_idle','doze_up','drink_down','drink_lap','drink_up']:
 for t in a.animation_data.nla_tracks:t.mute=True
 action=bpy.data.actions[name];a.animation_data.action=action;a.animation_data.action_slot=action.slots[0]
 low=99;mouths=[];paws=[]
 for f in range(int(action.frame_range[1])+1):
  s.frame_set(f);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();pts=np.array([v.co[:] for v in m.vertices]);low=min(low,float(pts[:,2].min()));mouths.append(pts[mouth].mean(axis=0).tolist());paws.append([a.pose.bones[n].head[:] for n in ['front_L_paw','front_R_paw','hind_L_paw','hind_R_paw']]);e.to_mesh_clear()
 r[name]={'minSurface':low,'mouthStart':mouths[0],'mouthEnd':mouths[-1],'mouthVerticalRange':float(np.ptp(np.array(mouths)[:,2])),'pawEndpointMaxDelta':float(np.linalg.norm(np.array(paws[-1])-np.array(paws[0]),axis=1).max())}
 if '--render' in sys.argv and name in ['sleep_idle','doze_idle','drink_lap']:
  s.frame_set(0);s.render.resolution_x=s.render.resolution_y=600;s.render.resolution_percentage=100;s.render.film_transparent=True;s.render.image_settings.file_format='PNG';cam=s.camera;focus=Vector((0,.015,.15));cam.location=focus+Vector((1,-1.5,.25));cam.rotation_euler=(focus-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=out+'/'+name+'.png';bpy.ops.render.render(write_still=True)
json.dump(r,open(os.path.join(ROOT,'outputs/tuanzi-life-review/metrics/clips.json'),'w'),indent=2)
print('LIFE_METRICS',json.dumps(r))
