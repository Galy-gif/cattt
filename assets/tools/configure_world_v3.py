"""Versioned scene configuration; leaves v2 assets/configuration intact."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[2]
s=json.loads((root/'assets/scenes/courtyard-v2/scene.json').read_text())
def rect(x,y,w,h):return dict(x=x,y=y,width=w,height=h)
for o in s['objects']:
 if o['id']=='board':o['rect']=rect(.50,.795,.087,.205)
 if o['id']=='tree':o['cutouts']=[]
 if o['id']=='fence':o['depth']=.565
for n in s['nodes']:
 if n['id']=='d1-0':n['point']=dict(x=.398,y=.711)
 if n['id']=='d1-1':n['point']=dict(x=.410,y=.691)
 if n['id']=='d1-2':n['point']=dict(x=.414,y=.677)
s['nodes'].append(dict(id='fence-contact',point=dict(x=.916,y=.595)))
s['edges'].append(dict(a='m15',b='fence-contact',width=.026,main=False))
s['destinations'][1]['facingRight']=False
s['destinations'][1]['contact']=rect(.371,.555,.03,.115)
s['destinations'][5]['node']='fence-contact'
s['nestSupport']=dict(x=.309,y=.561)
s['railSupport']=dict(x=.945,y=.477)
def obj(name,image,r,z,target,source=None,cutouts=None,motion=None):
 s['objects'].append(dict(id=name,image=image,rect=r,depth=z,target=target,sourceRect=source,cutouts=cutouts,motion=motion))
nest=rect(.257,.395,.104,.208)
obj('nest-back','world-v2-tree',nest,.615,1,rect(.255,.51,.145,.203),motion='nest')
obj('nest-front','world-v2-tree',nest,.92,1,rect(.255,.51,.145,.203),[rect(0,0,1,.82)],'nest')
# A padded wooden support between posts, using the existing horizontal timber's texture.
obj('rail-support','world-v2-fence',rect(.918,.476,.073,.017),.60,5,rect(.80,.34,.09,.11))
# Split the existing daisy with its stem so force originates at the rooted base.
obj('flower','world-v3-flower',rect(.939,.542,.027,.06),.65,5,motion='flower')
outline=[(.316,.51),(.350,.51),(.350,.54),(.368,.565),(.386,.594),(.397,.625),(.397,.66),(.386,.688),(.368,.705),(.341,.716),(.306,.712),(.278,.702),(.258,.68),(.253,.65),(.258,.617),(.275,.585),(.302,.55),(.316,.53)]
next(o for o in s['objects'] if o['id']=='tree')['cutoutPaths']=[[dict(x=x,y=y) for x,y in outline]]
for name in ['nest-back','nest-front']:
 o=next(o for o in s['objects'] if o['id']==name)
 o['outline']=[dict(x=(x-.255)/.145,y=(y-.51)/.203) for x,y in outline]
s['version']=3
out=root/'assets/scenes/courtyard-v3';out.mkdir(parents=True,exist_ok=True)
(out/'scene.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
# Preferred version remains explicit; fallback v2 is left untouched.
d=root/'ios/Maomao/Assets.xcassets/world-scene-v3.dataset';d.mkdir(parents=True,exist_ok=True)
(d/'data.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
(d/'Contents.json').write_text(json.dumps({'data':[{'idiom':'universal','filename':'data.json'}],'info':{'version':1,'author':'xcode'}},indent=2))
print('Configured courtyard v3')
