"""v4 local contact geometry; no mutation of the v3 baseline."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[2]
s=json.loads((root/'assets/scenes/courtyard-v3/scene.json').read_text())
def rect(x,y,w,h):return dict(x=x,y=y,width=w,height=h)
def point(x,y):return dict(x=x,y=y)
# Continuous existing crossbeam instead of an isolated enlarged patch.
s['objects']=[o for o in s['objects'] if o['id']!='rail-support']
for o in s['objects']:
 if o['id']=='tree':
  # Preserve the approved dense tree and its original alpha; only its old nest cutout remains.
  o['image']='world-v2-tree'
 if o['id'].startswith('nest-'):
  o['image']='world-v4-nest';o['rect']=rect(.240,.394,.130,.205)
  o['sourceRect']=None;o['outline']=None;o['cutoutPaths']=None
  o['cutouts']=None if o['id']=='nest-back' else [rect(0,0,1,.865)]
 if o['id']=='fence':o['depth']=.54
 if o['id']=='flower':o['rect']=rect(.939,.542,.021,.052)
# A lower rung spans the same right-hand posts at the original timber's scale.
s['objects'].append(dict(id='rail-lower',image='world-v2-fence',rect=rect(.919,.513,.070,.017),depth=.539,target=5,sourceRect=rect(.86,.34,.05,.09)))
# Top edge of the genuine crossbeam.
s['railSupport']=point(.944,.454)
s['nestSupport']=point(.287,.564)
# Pond front/right bank: forepaw reaches left across the water edge; hind feet stay on grass.
for n in s['nodes']:
 if n['id']=='d4-0':n['point']=point(.854,.704)
 if n['id']=='fence-contact':n['point']=point(.940,.566)
s['edges']=[e for e in s['edges'] if 'd4-0' not in [e['a'],e['b']]]
s['edges'].append(dict(a='m12',b='d4-0',width=.026,main=False))
s['destinations'][4]['cameraX']=.79
s['destinations'][4]['facingRight']=False
s['waterContact']=point(.816,.701)
s['waterOutline']=[point(x,y) for x,y in [(.54,.64),(.59,.60),(.65,.591),(.71,.60),(.78,.625),(.84,.668),(.853,.693),(.832,.716),(.786,.730),(.69,.732),(.635,.727),(.61,.704),(.564,.690)]]
s['version']=4
out=root/'assets/scenes/courtyard-v4';out.mkdir(parents=True,exist_ok=True)
(out/'scene.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
d=root/'ios/Maomao/Assets.xcassets/world-scene-v4.dataset';d.mkdir(parents=True,exist_ok=True)
(d/'data.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
(d/'Contents.json').write_text(json.dumps({'data':[{'idiom':'universal','filename':'data.json'}],'info':{'version':1,'author':'xcode'}},indent=2))
print('Configured courtyard v4')
