# 静态蜷卧图源标尺与真实场景复查；不写入运行时scene。
from pathlib import Path
from PIL import Image,ImageDraw,ImageEnhance
import json
R=Path(__file__).resolve().parents[2];T=R/'ios/Maomao/Resources/WorldTextures';S=json.loads((R/'assets/scenes/courtyard-v4/scene.json').read_text());W,H=1266,844
FONT='/System/Library/Fonts/STHeiti Medium.ttc'
def object_image(o):
 im=Image.open(T/(o['image']+'.png')).convert('RGBA');src=o.get('sourceRect')
 if src:im=im.crop((round(src['x']*im.width),round(src['y']*im.height),round((src['x']+src['width'])*im.width),round((src['y']+src['height'])*im.height)))
 im=ImageEnhance.Color(im).enhance(.70);r=o['rect'];im=im.resize((round(r['width']*W),round(r['height']*H)),Image.Resampling.LANCZOS)
 if o.get('cutoutPaths'):
  mask=Image.new('L',im.size,255);draw=ImageDraw.Draw(mask)
  for points in o['cutoutPaths']:draw.polygon([(p['x']*im.width,p['y']*im.height) for p in points],fill=0)
  import numpy as np
  a=np.array(im);a[:,:,3]=np.minimum(a[:,:,3],np.array(mask));im=Image.fromarray(a)
 return im

def place(im,o):
 a=object_image(o);r=o['rect'];im.alpha_composite(a,(round(r['x']*W),round(r['y']*H)))
def ground():
 im=ImageEnhance.Color(Image.open(T/'world-v3-ground-preview.png').convert('RGBA')).enhance(.70).resize((W,H),Image.Resampling.LANCZOS)
 for tile in S['tiles']:place(im,tile)
 return im

def context(limit=None,omit=()):
 im=ground()
 for o in sorted(S['objects'],key=lambda o:o['depth']):
  if o['id'] in omit or o.get('visibility')=='lit' or (limit is not None and o['depth']>limit):continue
  place(im,o)
 return im

from pathlib import Path
import json,copy,hashlib
from PIL import Image,ImageDraw,ImageFilter,ImageFont
import numpy as np
R=R;D=R/'outputs/tree-nest-curled-v3-delivery';V=R/'outputs/tree-nest-curled-v3-review'
old=json.loads((R/'outputs/tree-nest-v1-review/树窝体型校准后数值.json').read_text());nr=old['nest_rect'];center=(nr['x']+nr['width']/2)*W;top=nr['y']*H
head_raw=295;scale=old['head_pt']/head_raw;calibration=scale/(205/1254);nest_factor=1.30
newrect={'x':(center-nr['width']*W*nest_factor/2)/W,'y':nr['y'],'width':nr['width']*nest_factor,'height':nr['height']*nest_factor}
objects=copy.deepcopy(S['objects'])
for o in objects:
 if o['id'] in ('nest-back','nest-front'):o['rect']=copy.deepcopy(newrect)
 if o['id']=='nest-rope':o['rect']['height']=newrect['y']+.004-o['rect']['y']
base=ground()
for o in sorted(objects,key=lambda o:o['depth']):
 if o.get('visibility')!='lit':place(base,o)
empty=base.copy()
raw=Image.open(D/'_sources/S1-curled__r1.png').convert('RGB')
# Generated whole-cat/contact patch, NOT production cat-only alpha.
outline=[(505,750),(557,717),(620,693),(678,688),(704,647),(736,646),(771,685),(802,665),(862,658),(921,673),(976,709),(1015,750),(1040,808),(1046,849),(1030,889),(1000,914),(950,933),(895,946),(823,949),(755,951),(698,950),(663,938),(626,943),(580,937),(544,921),(524,901),(518,871),(511,840),(513,807),(504,778)]
m=Image.new('L',raw.size);ImageDraw.Draw(m).polygon(outline,fill=255);m=m.filter(ImageFilter.GaussianBlur(2.0));rgb=np.array(raw);aa=np.array(m).astype(float);yy=np.indices(aa.shape)[0];rim_keep=np.clip((135-rgb[:,:,2].astype(float))/45,0,1);aa=np.where(yy>875,aa*rim_keep,aa);m=Image.fromarray(np.rint(aa).astype('uint8'));m.save(D/'whole-cat-contact-patch-mask.png')
a=np.dstack([np.array(raw),np.array(m)]);patch=Image.fromarray(a);patch.save(D/'S1-curled-contact-patch-alpha__v1.png')
# Source calibration ties head to approved 55.633pt skull; this is not fit-to-nest shrink.
# Keep current rope top, lower the support to allow a full C-shape; center the whole pose inside the opening.
xoff=center+(263-center)*calibration-5.5
new_lip=top+(475.327-top)*nest_factor
raw_bottom=946
uncentered_y=top+(325-top)*calibration+raw_bottom*scale
down=new_lip-3-uncentered_y
yoff=top+(325-top)*calibration+down
p=patch.resize((round(raw.width*scale),round(raw.height*scale)),Image.Resampling.LANCZOS);pos=(round(xoff),round(yoff));base.alpha_composite(p,pos)
front=next(o for o in objects if o['id']=='nest-front');fi=object_image(front);place(base,front)
# Quantify real front mask against the orange cat interior, excluding copied contact/background.
foreground=(np.array(raw)[:,:,0]>145)&(np.array(raw)[:,:,0]>np.array(raw)[:,:,1]*1.38)&(np.array(raw)[:,:,2]<125)&(np.array(m)>220)
cf=Image.fromarray(foreground.astype('uint8')*255).resize(p.size,Image.Resampling.NEAREST);full=Image.new('L',(W,H));full.paste(cf,pos)
fa=Image.new('RGBA',(W,H));fa.alpha_composite(fi,(round(front['rect']['x']*W),round(front['rect']['y']*H)))
clipped=(np.array(full)>128)&(np.array(fa)[:,:,3]>128)
# Same reference camera and 3x enlargement for all scene crops.
box=(65,325,505,590);near=(275,340,505,555)
base.convert('RGB').save(D/'S1-curled-calibrated-scene__v1.png')
for name,b in [('团子参考蜷卧姿势场景.jpg',box),('团子参考蜷卧姿势近景.jpg',near)]:
 c=base.convert('RGB').crop(b);c.resize((c.width*3,c.height*3),Image.Resampling.LANCZOS).save(V/name,quality=88,subsampling=0)
# Prove rendering adopts no generated pixels outside the explicit patch+new native nest.
changed=np.any(np.array(base)!=np.array(empty),axis=2)
vals={'source_head_local_axis_width_raw_px':head_raw,'manual_measurement_range_raw_px':[290,300],'fixed_skull_width_reference_pt':old['head_pt'],'source_px_to_reference_pt':scale,'source_calibration_vs_uncalibrated_scene_projection':calibration,'calibration_purpose':'回归已确认团子的物理头骨尺度；完整新姿势整体等比，未改头/身/四肢比例，不以闭眼或水平bbox缩猫','nest_relative_to_previous_native_factor':nest_factor,'nest_rect':newrect,'nest_size_reference_pt':[newrect['width']*W,newrect['height']*H],'opening_width_reference_pt':old['opening_width_reference_pt']*nest_factor,'head_to_opening_width_pose_dependent':old['head_pt']/(old['opening_width_reference_pt']*nest_factor),'original_pose_paws_on_rim_retained':False,'head_pixels_from_old_pose_reused':False,'whole_cat_contact_outline_raw_px':outline,'removed_generated_lower_rim_light_fringe':{'raw_y_above':875,'alpha_keep_by_blue_channel':'clip((135-B)/45,0,1)','purpose':'只消除生成垫/窝沿浅边，保留橙毛棕轮廓与暗接触；不修改猫比例或补画新像素'},'patch_scale_uniform':scale,'patch_native_translation_px':list(pos),'registration_left_shift_reference_pt':-5.5,'registration_down_after_source_calibration_reference_pt':down,'front_opaque_pixels_hiding_orange_foreground_reference_px':int(clipped.sum()),'native_reference_camera':[W,H],'scene_crop_reference_px':list(box),'near_crop_reference_px':list(near),'same_preview_multiplier':3,'original_texture_scene_hashes':{str(q.relative_to(R)):hashlib.sha256(q.read_bytes()).hexdigest() for q in [R/'assets/scenes/courtyard-v4/scene.json',T/'world-v4-nest.png',R/'outputs/frames-v8-delivery/keys/K3-sit-relaxed__r1.png']},'runtime_changed':False,'new_imagegen_calls':1,'human_review':'pending'}
(V/'整猫姿势与标尺数值.json').write_text(json.dumps(vals,ensure_ascii=False,indent=2)+'\n');print(json.dumps(vals,ensure_ascii=False,indent=2))
