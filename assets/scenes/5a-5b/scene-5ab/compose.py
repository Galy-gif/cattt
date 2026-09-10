#!/usr/bin/env python3
"""Scene 5b: deterministic compositing. Edit layers.json to reposition assets."""
import json, importlib.util, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
PROPS=ROOT/'outputs/cat-ip-concepts/2026-09-07/parallel-tracks/props/revision-2'
spec=importlib.util.spec_from_file_location('pipeline',ROOT/'outputs/assets/revision-2/convert_assets_v2.py')
pipeline=importlib.util.module_from_spec(spec);spec.loader.exec_module(pipeline)
NAMES=[
 'stool table basket clay-bowl water-bowl bucket lantern books rolled-blanket crate broom sign yarn cushion watering-can cup'.split(),
 'potted-plant flower tall-grass low-grass fern mushroom mushroom-cluster leaf-pile leaf rock mossy-rock stump log twigs dandelion clover'.split(),
 'cat-bed hanging-nest scratching-log feather-toy bell kibble-bowl blanket paper-bag cardboard-box fish-toy string crate-stack lamp-stand stepping-stone birdhouse firewood'.split()]
SIZES=[[160,240,140,80,80,120,100,100,120,140,220,200,32,120,100,36],[180,100,140,40,120,32,60,100,24,40,100,120,200,120,80,80],[180,240,180,180,24,80,160,120,160,48,80,200,220,140,120,160]]
AXES=['hwhwwhhwwwhhwwhh','hhhhhhhwwwwhwwhw','whwhhwwhwwwhhwhw']
ROWS=[[0,340,615,925,1254],[0,380,635,910,1254],[0,400,660,920,1254]]
COLS=[[0,330,630,940,1254],[0,360,630,920,1254],[0,360,630,934,1254]]
BATCH=['01-furniture','02-nature','03-cat-misc']

def prepare():
    folder=HERE/'assets';folder.mkdir(exist_ok=True)
    catalog={}
    for batch in range(3):
        source=PROPS/(BATCH[batch]+'.png');im=Image.open(source).convert('RGBA')
        for i,name in enumerate(NAMES[batch]):
            cols=[0,310,630,915,1254] if batch==2 and i//4==3 else COLS[batch]
            rect=[cols[i%4],ROWS[batch][i//4],cols[i%4+1],ROWS[batch][i//4+1]]
            cell=im.crop(rect)
            cut,bb,_=pipeline.extract_v2(cell,'auto',36)
            # Remove detached keying specks, not markings inside a prop.
            a=np.array(cut.getchannel('A'))
            a[a<8]=0
            cut.putalpha(Image.fromarray(a))
            bb=cut.getchannel('A').getbbox();cut=cut.crop(bb)
            axis=AXES[batch][i];scale=SIZES[batch][i]/cut.size[0 if axis=='w' else 1]
            size=tuple(max(1,round(s*scale)) for s in cut.size)
            cut=cut.resize(size,Image.Resampling.LANCZOS)
            path=folder/('prop-'+name+'.png');cut.save(path)
            catalog[name]={'file':str(path.relative_to(HERE)),'source':str(source.relative_to(ROOT)),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'grid_crop':rect,'content_crop':bb,'source_scale':scale,'size':size,'scale_basis':f'{axis}={SIZES[batch][i]}px'}
    source=ROOT/'outputs/cat-ip-concepts/2026-09-07/world-layer-3b/01-nine-poses.png'
    cut,bb,_=pipeline.extract_v2(Image.open(source).crop((0,0,418,475)),'auto',38)
    cut=cut.crop(bb);scale=120/184
    size=tuple(round(v*scale) for v in cut.size)
    cut=cut.resize(size,Image.Resampling.LANCZOS);cut.save(folder/'tuanzi-world-sleep-basket.png')
    catalog['tuanzi']={'file':'assets/tuanzi-world-sleep-basket.png','source':str(source.relative_to(ROOT)),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'grid_crop':[0,0,418,475],'content_crop':bb,'source_scale':scale,'size':size,'scale_basis':'visible cat including tail height 120px; source y=154..337','combined_cat_and_basket':True}
    (HERE/'asset-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2))
    return catalog

def defaults(catalog):
    # x,y are top-left target pixels. Hanging pieces attach to the fixed tree;
    # all remaining pieces form the house-side cluster, with clear lower margin.
    items=[
      ('birdhouse',680,560,10),('lantern',560,640,11),
      ('sign',30,720,20),('potted-plant',70,860,21),('flower',385,835,22),
      ('lamp-stand',450,760,23),('crate-stack',570,925,24),
      ('stool',115,1010,30),('table',305,995,31),
      ('books',395,970,32),('cup',505,998,33),
      ('bucket',55,1155,40),('watering-can',178,1170,41),
      ('cardboard-box',567,1100,42),('rolled-blanket',605,1180,43),
      ('broom',730,975,44),('fern',655,1300,45),
      ('cat-bed',145,1270,50),('blanket',150,1370,51),
      ('clay-bowl',290,1270,52),('water-bowl',530,1350,53),
      ('kibble-bowl',555,1440,54),('yarn',294,1405,55),
      ('fish-toy',565,1530,56),('bell',490,1510,57),
      ('mushroom-cluster',695,1450,58),('leaf-pile',675,1510,59),
      ('low-grass',700,1580,60),('rock',370,1510,61),
      ('paper-bag',70,1040,29),
      ('tuanzi',342,1310,100)]
    layers=[]
    for name,x,y,z in items:
        entry=catalog[name]
        layers.append({'id':name,'file':entry['file'],'x':x,'y':y,'scale':1.0,'source_scale':entry['source_scale'],'z':z,'kind':'character' if name=='tuanzi' else 'prop','shadow':{'opacity':0 if name in ['birdhouse','lantern'] else 15,'offset':[2,3],'blur':3,'height':8}})
    return {'canvas':[853,1844],'background':'5a-background-plate.png','safe_top':148,'safe_bottom':1622,'layers':layers}

def render(config):
    im=Image.open(HERE/config['background']).convert('RGBA')
    if im.size!=(853,1844):im=im.resize((853,1844),Image.Resampling.LANCZOS)
    bg=im.copy();prop_mask=Image.new('L',im.size);bounds=[];catbox=None
    ordered=sorted(config['layers'],key=lambda l:l['z'])
    for layer in ordered:
        obj=Image.open(HERE/layer['file']).convert('RGBA')
        if layer['scale']!=1:obj=obj.resize(tuple(round(v*layer['scale']) for v in obj.size),Image.Resampling.LANCZOS)
        x,y=layer['x'],layer['y'];w,h=obj.size
        assert x>=0 and x+w<=853 and y>=config['safe_top'] and y+h<=config['safe_bottom'],(layer['id'],x,y,w,h)
        s=layer['shadow']
        if s['opacity']:
            shadow=Image.new('RGBA',im.size);d=ImageDraw.Draw(shadow)
            d.ellipse((x+w*.15+s['offset'][0],y+h-s['height']/2+s['offset'][1],x+w*.85+s['offset'][0],y+h+s['height']/2+s['offset'][1]),fill=(73,71,58,s['opacity']))
            im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(s['blur'])))
        im.alpha_composite(obj,(x,y))
        bounds.append([x,y,x+w,y+h])
        prop_mask.paste(obj.getchannel('A'),(x,y),obj.getchannel('A'))
        if layer['kind']=='character':catbox=[x,y,x+w,y+h]
    im.save(HERE/'5b-companion-home.png')
    arr=np.asarray(im.convert('RGB')).astype(float)/255
    mx=arr.max(2);mn=arr.min(2);delta=mx-mn
    # Warm-red/coral family: excludes honey-orange character, includes muted roof.
    hsv=np.asarray(im.convert('HSV'))
    red=(hsv[:,:,0]<30*255/360)&(hsv[:,:,1]>65)&(hsv[:,:,2]>100)
    ratio=float(red.mean())
    bb=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
    safe=bool(np.array_equal(np.asarray(im)[:148],np.asarray(bg)[:148]) and np.array_equal(np.asarray(im)[1622:],np.asarray(bg)[1622:]))
    assert safe and ratio<=.03
    metrics={'canvas':[853,1844],'prop_count':sum(l['kind']=='prop' for l in ordered),'character_count':1,'cat_on_top':ordered[-1]['kind']=='character','visible_cat_target_height':120,'cluster_bbox':bb,'cluster_bbox_fraction':(bb[2]-bb[0])*(bb[3]-bb[1])/(853*1844),'actual_asset_alpha_coverage':float((np.asarray(prop_mask)>32).mean()),'coral_family_fraction':ratio,'coral_measurement':'HSV H<30deg,S>65/255,V>100/255; broad red/orange family includes some warm wood. Approximate conservative area, not exact hex pixel count.','safe_zone_foreground_clear':safe,'cat_box':catbox}
    (HERE/'qa.json').write_text(json.dumps(metrics,indent=2))
    qa=im.copy();d=ImageDraw.Draw(qa);d.rectangle(bb,outline=(80,90,80),width=2);d.rectangle(catbox,outline=(210,80,65),width=2)
    d.line((0,148,853,148),fill=(150,150,150),width=2);d.line((0,1622,853,1622),fill=(150,150,150),width=2)
    qa.save(HERE/'5b-layout-check.png')
    print(json.dumps(metrics))

if __name__=='__main__':
    catalog=prepare()
    path=HERE/'layers.json'
    if not path.exists():path.write_text(json.dumps(defaults(catalog),ensure_ascii=False,indent=2))
    render(json.loads(path.read_text()))
