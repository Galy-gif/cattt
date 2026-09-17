from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,json,hashlib
R=Path(__file__).resolve().parents[2];D=R/'outputs/tree-nest-contact-v2-delivery';V=R/'outputs/tree-nest-contact-v2-review'
base=Image.open(D/'edit-target.png').convert('RGB');raw=Image.open(D/'_sources/C2-tail__r1.png').convert('RGB');new=raw.resize(base.size,Image.Resampling.LANCZOS)
# Registered scene contact patch: retain the original face, front legs and exterior.
region=[(737,573),(799,579),(849,604),(875,647),(879,711),(854,749),(805,775),(753,773),(740,750),(727,727),(743,702),(752,670),(747,627)]
protected=[(447,490),(737,490),(743,572),(751,616),(759,657),(759,687),(750,711),(736,727),(730,731),(738,724),(746,716),(754,714),(759,718),(762,726),(762,737),(759,748),(754,758),(750,765),(729,780),(685,788),(615,792),(541,785),(506,777),(450,739)]
m=Image.new('L',base.size);ImageDraw.Draw(m).polygon(region,fill=255);m=m.filter(ImageFilter.GaussianBlur(2.0))
p=Image.new('L',base.size);ImageDraw.Draw(p).polygon(protected,fill=255)
gap=Image.new('L',base.size);ImageDraw.Draw(gap).ellipse((730,726,741,739),fill=255);gap=gap.filter(ImageFilter.GaussianBlur(1.0))
ma=np.array(m);ma[np.array(p)>0]=0;ma=np.maximum(ma,np.array(gap));m=Image.fromarray(ma);m.save(D/'rear-contact-adoption-mask.png')
final=Image.composite(new,base,m);fur=Image.open(D/'_sources/C1-contact__r1.png').convert('RGB').resize(base.size,Image.Resampling.LANCZOS).transform(base.size,Image.Transform.AFFINE,(1,0,28,0,1,-9),resample=Image.Resampling.BICUBIC);final=Image.composite(fur,final,gap);final.save(D/'C2-nest-contact-identity-locked__v1.png');final.save(V/'树窝参考收尾修正版.jpg',quality=88,subsampling=0)
# Unlabelled near view for human review; no additional drawing.
final.crop((300,365,1000,915)).save(V/'树窝参考收尾修正版近景.jpg',quality=89,subsampling=0)
base.crop((715,570,895,790)).resize((540,660)).save(V/'后身修复前.jpg',quality=87)
final.crop((715,570,895,790)).resize((540,660)).save(V/'后身修复后.jpg',quality=87)
b=np.array(base);f=np.array(final);changed=np.any(b!=f,axis=2);mask=np.array(m)>0;pr=(np.array(p)>0)&(np.array(gap)==0)
ys,xs=np.where(changed)
sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
values={'generation_mode':'内置image_gen，局部场景接触编辑；不是完整猫-only帧','new_imagegen_calls':2,'selected_candidate_imagegen_calls':1,'raw_size':list(raw.size),'raw_mode':raw.mode,'raw_sha256':sha(D/'_sources/C2-tail__r1.png'),'edit_target_sha256':sha(D/'edit-target.png'),'raw_registration':{'uniform_resize':1024/1254,'additional_translation_px':[0,0],'nonuniform_warp':False,'landmark_review':'原构图一致，最终外围与头脸/前肢直接采用原图；生成区域限定后身/直接窝垫接触，人工局部核对'},'adoption_polygon_target_px':region,'original_head_frontlegs_protection_polygon_target_px':protected,'boundary_feather_px':2,'original_background_notch_fill':{'ellipse_target_px':[730,726,741,739],'feather_px':1,'source':'上一局部稿C1邻近尾部橙毛像素，等尺度局部复用填旧灰色缺口；非改头脸/源猫','local_fur_translation_target_px':[-28,9],'fur_source_reference_pixel_target_px':[764,723],'fur_destination_reference_pixel_target_px':[736,732]},'adoption_mask_sha256':sha(D/'rear-contact-adoption-mask.png'),'final_sha256':sha(D/'C2-nest-contact-identity-locked__v1.png'),'changed_pixels':int(changed.sum()),'changed_bbox_px':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())],'outside_adoption_mask_rgb_changed_pixels':int((changed&~mask).sum()),'protected_head_frontlegs_rgb_changed_pixels':int((changed&pr).sum()),'protected_pixels':int(pr.sum()),'canvas_size':list(final.size),'native_reference_crop_px':[263,325,468,530],'preview_multiplier':1024/205,'cat_source_scale_reference_pt_per_px_unchanged':0.12094169194472532,'nest_reference_size_pt_unchanged':[136.961,143.985],'source_cat_files_unchanged':True,'physical_size_note':'头脸/前肢像素和原相机尺度固定，后身未经专用缩放；投影随收腿蜷尾姿势改变。局部场景不代替完整猫源图及体积/动态验收。','visual_review':'pending','runtime_changed':False}
(V/'局部接触加工数值.json').write_text(json.dumps(values,ensure_ascii=False,indent=2)+'\n');print(json.dumps(values,ensure_ascii=False,indent=2))
