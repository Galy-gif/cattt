"""在已确认模型上增量添加第一批生活动作，不重建外形、UV、权重或旧动作。"""
import importlib.util, os, json, hashlib, sys
import bpy
import numpy as np
from mathutils import Vector
HERE = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location('tuanzi_builder', os.path.join(HERE, 'build_tuanzi.py'))
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
b.guard_hand_edits()
bpy.ops.wm.open_mainfile(filepath=b.BLEND_PATH)
bpy.context.preferences.filepaths.save_version = 0
arm = bpy.data.objects['tuanzi']; body = bpy.data.objects['tuanzi_body']

def fingerprint():
    data = [[tuple(v.co), [(g.group,g.weight) for g in v.groups]] for v in body.data.vertices]
    data += [[tuple(x.uv) for x in body.data.uv_layers.active.data]]
    return hashlib.sha256(repr(data).encode()).hexdigest()
before = fingerprint()

tail_cache={}
def resting_tail(a, body_pose, key):
    # 尾巴路径以当前骨盆姿势解算，不能复用另一种坐姿的局部旋转。
    if key not in tail_cache:
        old_fn,old_cache=b.sit_amount_body,b._sit_tail_cache
        try:
            b.sit_amount_body=lambda *_args: body_pose
            b._sit_tail_cache={}
            tail_cache[key]={n:q.copy() for n,q in b.sit_tail_rotations(a).items()}
        finally:
            b.sit_amount_body,b._sit_tail_cache=old_fn,old_cache
    return tail_cache[key]

def low(arm, amount, phase=0):
    p = {'rot':{},'loc':{},'feet':{},'fold':amount}
    p['loc']['spine_01'] = b.armature_offset(arm.pose.bones['spine_01'], (.01*amount,.0175*amount,-.0455*amount))
    for n,angle in [('neck_01',38),('neck_02',25),('head',-56)]:
        p['rot'][n] = b.armature_rotation(arm.pose.bones[n],(b.X_AXIS,angle*amount))
    # 背部轻轻收成弧，脸侧向外，避免低头时把整张脸埋进垫子。
    for n,angle in [('spine_02',-8),('spine_03',-10),('spine_04',-5)]:
        p['rot'][n]=b.armature_rotation(arm.pose.bones[n],(b.Z_AXIS,angle*amount))
    p['rot']['head']=b.armature_rotation(arm.pose.bones['head'],(b.X_AXIS,-56*amount),(b.Y_AXIS,-12*amount))
    for leg in ['front_L','front_R']:
        p['feet'][leg]=((0,(-.021 if leg=='front_R' else -.025)*amount, .006*b.math.sin(b.math.pi*amount)**2 - (.001*amount if leg=='front_R' else 0)),0)
    for leg in ['hind_L','hind_R']:
        p['feet'][leg]=((0,-.045*amount,0),0)
    if amount != 1 and 'sleep' not in tail_cache: low(arm,1)
    for n,q in resting_tail(arm,p,'sleep').items():
        p['rot'][n]=b.Quaternion().slerp(q,amount)
    p['loc']['tail_01'] = b.armature_offset(arm.pose.bones['tail_01'], (0,0,.075*b.math.sin(b.math.pi*amount)))
    b.breathing(p,arm,phase,.005*amount)
    return p

def sleep_down(a,t): return low(a,b.ease(t))
def sleep_idle(a,t): return low(a,1,t)
def sleep_up(a,t): return low(a,1-b.ease(t))
def seated(a,amount,phase=0):
    p={'rot':{},'loc':{},'feet':{}}
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,0,-.062*amount))
    for n,angle in [('spine_01',-70),('spine_02',42),('spine_03',25),('spine_04',12),('neck_01',-12),('head',-6)]:
        p['rot'][n]=b.armature_rotation(a.pose.bones[n],(b.X_AXIS,angle*amount))
    for leg in ['front_L','front_R']:
        p['feet'][leg]=((0,.055*amount,.014*b.math.sin(b.math.pi*amount)**2),0)
    if amount != 1 and 'doze' not in tail_cache: seated(a,1)
    for n,q in resting_tail(a,p,'doze').items(): p['rot'][n]=b.Quaternion().slerp(q,amount)
    b.breathing(p,a,phase,.006)
    return p

def doze(a,t):
    p=seated(a,1,t)
    p['rot']['neck_02']=b.armature_rotation(a.pose.bones['neck_02'],(b.X_AXIS,3+10*(1-b.math.cos(2*b.math.pi*t))/2))
    return p

def drink(a,amount,phase=0):
    p={'rot':{},'loc':{},'feet':{}}
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,0,-.024*amount))
    seconds=phase*2.4
    lap=b.math.sin(b.math.pi*seconds*4)**2 if seconds<2 else 0
    swallow=b.math.sin(b.math.pi*(seconds-2)/.4)**2 if seconds>=2 else 0
    for n,angle in [('neck_01',28-7*swallow),('neck_02',16-2*lap-5*swallow),('head',10+2*lap)]:
        p['rot'][n]=b.armature_rotation(a.pose.bones[n],(b.X_AXIS,angle*amount))
    b.breathing(p,a,phase,.003)
    return p

def hop(a,t):
    p={'rot':{},'loc':{},'feet':{}}
    # 起落的压腿与腾空收爪；位移轨迹由运行时按场景支撑面计算。
    tuck=b.math.sin(b.math.pi*t)**2
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,0,-.012*tuck))
    for leg in ['front_L','front_R','hind_L','hind_R']:
        p['feet'][leg]=((0,0,.03*tuck),0)
    return p

# 趴下时肘部沿身体两侧收折；默认站立 IK 会把肘尖压进软垫。
original_apply_pose=b.apply_pose
def apply_life_pose(a, targets, pose):
    for leg in ['front_L','front_R']:
        for n in ['lower','paw']:
            for c in a.pose.bones[f'{leg}_{n}'].constraints:c.mute=False
    original_apply_pose(a,targets,pose)
    amount=pose.get('fold',0)
    if not amount:return
    for leg,sign in [('front_L',1),('front_R',-1)]:
        upper,lower,paw=[a.pose.bones[f'{leg}_{n}'] for n in ['upper','lower','paw']]
        start=upper.head.copy();end=targets[leg][0].location.copy()
        axis=(end-start).normalized();distance=(end-start).length
        along=(upper.length**2-lower.length**2+distance**2)/(2*distance)
        height=b.math.sqrt(max(0,upper.length**2-along**2))
        bend=lower.head-start-axis*along
        if bend.length<1e-6:bend=Vector((0,1,0))
        bend.normalize()
        desired=Vector((sign*.15,-1,.3));desired-=axis*desired.dot(axis);desired.normalize()
        bend=b.Quaternion().slerp(bend.rotation_difference(desired),amount)@bend
        knee=start+axis*along+bend*height
        for pb in [lower,paw]:
            for c in pb.constraints:c.mute=True
        for pb,target in [(upper,knee),(lower,end)]:
            frame=pb.matrix.copy()
            turn=(pb.tail-pb.head).normalized().rotation_difference((target-pb.head).normalized())
            matrix=(turn.to_matrix()@frame.to_3x3()).to_4x4();matrix.translation=frame.translation
            pb.matrix=matrix;bpy.context.view_layer.update()
        matrix=targets[leg][2].to_matrix().to_4x4();matrix.translation=lower.tail.copy();paw.matrix=matrix
        bpy.context.view_layer.update()
b.apply_pose=apply_life_pose

# 第二批使用独立片段；已确认的17段不重新烘焙。
def expression(a,kind,amount,phase=0):
    p=seated(a,amount,phase)
    wave=b.math.sin(2*b.math.pi*phase)
    def rotate(name,*axes):
        p['rot'][name]=b.armature_rotation(a.pose.bones[name],*((axis,angle*amount) for axis,angle in axes))
    if kind=='tilt':
        rotate('head',(b.X_AXIS,-6),(b.Y_AXIS,14+3*wave))
        rotate('neck_02',(b.Z_AXIS,-5))
    elif kind=='happy':
        rotate('head',(b.X_AXIS,-10+2*wave))
        # 轻抬尾根，尾端慢摆；不改变坐姿承托。
        p['rot']['tail_01']=p['rot']['tail_01'] @ b.armature_rotation(a.pose.bones['tail_01'],(b.X_AXIS,-14*amount))
        rotate('ear_L',(b.Y_AXIS,-3))
        rotate('ear_R',(b.Y_AXIS,3))
    elif kind=='sulk':
        rotate('neck_02',(b.Z_AXIS,14))
        rotate('head',(b.X_AXIS,1),(b.Z_AXIS,12+2*wave))
        rotate('ear_L',(b.Y_AXIS,12))
        rotate('ear_R',(b.Y_AXIS,-12))
    elif kind=='sad':
        rotate('neck_02',(b.X_AXIS,12+1.5*wave))
        rotate('head',(b.X_AXIS,5),(b.Y_AXIS,-4))
        rotate('ear_L',(b.Y_AXIS,18))
        rotate('ear_R',(b.Y_AXIS,-18))
    elif kind=='groom':
        # 右前爪抬到嘴边，另一前爪和后肢承重；慢舔后短停。
        lick=b.math.sin(6*b.math.pi*phase)**2
        rotate('neck_02',(b.X_AXIS,17),(b.Z_AXIS,-9))
        rotate('head',(b.X_AXIS,10+3*lick),(b.Z_AXIS,-8))
        p['feet']['front_R']=((.018*amount,.012*amount,.115*amount),-20*amount)
    return p

def mix_pose(p,q,t):
    out={'rot':{},'loc':{},'feet':{},'fold':p.get('fold',0)*(1-t)+q.get('fold',0)*t}
    for n in p['rot'].keys()|q['rot'].keys():out['rot'][n]=p['rot'].get(n,b.Quaternion()).slerp(q['rot'].get(n,b.Quaternion()),t)
    for n in p['loc'].keys()|q['loc'].keys():out['loc'][n]=p['loc'].get(n,Vector()).lerp(q['loc'].get(n,Vector()),t)
    for n in p['feet'].keys()|q['feet'].keys():
        a,c=p['feet'].get(n,((0,0,0),0));d,e=q['feet'].get(n,((0,0,0),0))
        out['feet'][n]=(Vector(a).lerp(Vector(d),t),c*(1-t)+e*t)
    return out

def nest_grip(a,t=0):
    p={'rot':{},'loc':{},'feet':{}}
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,0,.04))
    for leg in ['front_L','front_R']:p['feet'][leg]=((0,-.11,.138),-12)
    for leg in ['hind_L','hind_R']:p['feet'][leg]=((0,0,.02),0)
    return p

def nest_climb(a,t):
    u=b.ease(t)
    p=mix_pose(nest_grip(a),low(a,1),u)
    # 过口时把尾巴收在中线后上方，进窝后再恢复侧边蜷卧曲线。
    old_path=b.SIT_TAIL_PATH
    try:
        b.SIT_TAIL_PATH=[(0,.17,.20),(0,.20,.27),(0,.15,.32),(0,.07,.30),(0,.03,.24)]
        tucked=resting_tail(a,p,'nest-'+str(round(t,5)))
    finally:b.SIT_TAIL_PATH=old_path
    amount=b.ease(min(1,t/.12))*(1-b.ease(max(0,min(1,(t-.86)/.14))))
    for n,q in tucked.items():p['rot'][n]=p['rot'].get(n,b.Quaternion()).slerp(q,amount)
    # 前半段双爪抓稳窝沿，后半段依次收爪进窝。
    root_z=.48*(1-u);root_y=.554+(.715-.554)*u+.065*b.math.sin(b.math.pi*u)**2
    lock=1-b.ease(max(0,min(1,(t-.38)/.30)))
    for leg in ['front_L','front_R']:
        rest=a.data.bones[leg+'_paw'].head_local
        target=Vector((0,.27-root_z-rest.y,.722-root_y-rest.z))
        offset,curl=p['feet'][leg];p['feet'][leg]=(Vector(offset).lerp(target,lock),curl)
    return p

def nest_watch(a,t):
    p=low(a,1,t)
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,-64),(b.Y_AXIS,-8+2*b.math.sin(2*b.math.pi*t)))
    return p

def nest_sleep_pose(a,t=0):
    p=low(a,1)
    # 胸腹和骨盆降到垫面，四肢收折；头轻抬并侧向开口露出睡脸。
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(.01,.0175,-.048))
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,-70),(b.Y_AXIS,-12),(b.Z_AXIS,-35))
    for leg in ['front_L','front_R']:p['feet'][leg]=((0,-.05,0),0)
    for n,q in resting_tail(a,p,'nest-sleep').items():p['rot'][n]=q.copy()
    b.breathing(p,a,t,.002)
    return p

def pond_pose(a,reach=-.03,lift=.10,curl=0):
    p={'rot':{},'loc':{},'feet':{}}
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(.012,-.04,-.035))
    p['rot']['neck_01']=b.armature_rotation(a.pose.bones['neck_01'],(b.X_AXIS,16))
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,8),(b.Z_AXIS,-10))
    p['feet']['front_R']=((0,reach,lift),curl)
    return p

def pond_probe(a,t):
    reach=-.03-.09*b.ease(min(1,t/.5))
    dip=b.ease(max(0,min(1,(t-.25)/.35)))*(1-b.ease(max(0,min(1,(t-.72)/.28))))
    return pond_pose(a,reach,.10-.10*dip)

def pond_pat(a,t):return pond_pose(a,-.12,.10-.10*b.math.sin(2*b.math.pi*t)**2)
def pond_shake(a,t):
    u=b.ease(min(1,t/.22));pulse=b.math.sin(12*b.math.pi*t)*b.math.sin(b.math.pi*t)
    p=pond_pose(a,-.12+.09*u,.10+.015*u+ .015*pulse,18*pulse)
    offset,curl=p['feet']['front_R'];p['feet']['front_R']=((.018*pulse,offset[1],offset[2]),curl)
    return p

def fence_reach(a,t):
    # 四爪不离地，先收腿压身，再抬头锁定横木。
    u=b.ease(min(1,t/.72));p={'rot':{},'loc':{},'feet':{}}
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,.008*u,-.034*u))
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,-12*u))
    return p

def fence_turn_progress(t):
    q=max(0,min(1,(t-.1)/.8))*4
    step=min(3,int(q));phase=min(1,q-step)
    return (step+b.ease(max(0,min(1,(phase-.12)/.76))))/4

def fence_step_turn(a,t,out=False):
    raised=b.ease(min(1,t/.1))*(1-b.ease(max(0,min(1,(t-.9)/.1))))
    p=low(a,1-.65*raised)
    origin=low(a,1)
    q=max(0,min(1,(t-.1)/.8))*4;step=min(3,int(q));phase=min(1,q-step)
    sign=1 if out else -1
    angle=sign*b.math.pi/2*fence_turn_progress(t)
    for index,leg in enumerate(['front_L','hind_R','front_R','hind_L']):
        lo,hi=(.02,.46) if index<2 else (.54,.98)
        f=max(0,min(1,(phase-lo)/(hi-lo)))
        foot_angle=sign*b.math.pi/2*(step+b.ease(f))/4
        rest=a.data.bones[leg+'_paw'].head_local
        base=rest+Vector(origin['feet'].get(leg,((0,0,0),0))[0])
        # 承重爪保留世界落点，只有抬起的那组爪子前移到下一落点。
        local=b.Quaternion(b.Z_AXIS,foot_angle-angle)@base
        local.z=rest.z+.025*b.math.sin(b.math.pi*f)**2*raised
        p['feet'][leg]=(local-rest,0)
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,-56),(b.Z_AXIS,sign*8*raised))
    return p

def fence_land(a,t):
    # 落地由四腿吸收冲击，爪子不再次悬空。
    p={'rot':{},'loc':{},'feet':{}}
    squash=.024*b.math.sin(b.math.pi*t)*b.math.exp(-1.5*t)
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,0,-squash))
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,120*squash))
    return p

def fence_grip(a,t=0):
    p={'rot':{},'loc':{},'feet':{}}
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,-.015,.06))
    for leg in ['front_L','front_R']:p['feet'][leg]=((0,-.12,.188),-8)
    for leg in ['hind_L','hind_R']:p['feet'][leg]=((0,-.015,.025),0)
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,-12))
    return p

def fence_climb(a,t):
    u=b.ease(t);p=mix_pose(fence_grip(a),low(a,1),u)
    # 先用双前爪拉起胸腹，再依次收后脚；高度轨迹与 FenceMotion 共用参数。
    if t<.44:
        v=b.ease(t/.44);root_y=.32+(.575-.32)*v;root_z=-2.73+(-2.87+2.73)*v
    elif t<.54:root_y=.575;root_z=-2.87
    elif t<.84:
        v=b.ease((t-.54)/.30);root_y=.575+(.53-.575)*v;root_z=-2.87+(-3.10+2.87)*v
    else:
        v=b.ease((t-.84)/.16);root_y=.53+(.501-.53)*v;root_z=-3.10
    lock=1-b.ease(max(0,min(1,(t-.35)/.28)))
    for leg in ['front_L','front_R']:
        rest=a.data.bones[leg+'_paw'].head_local
        offset,curl=p['feet'][leg]
        target=Vector((0,-2.97-root_z-rest.y,.538-root_y-rest.z))
        p['feet'][leg]=(Vector(offset).lerp(target,lock),curl)
    return p

def fence_rest(a,t=0):
    p=low(a,1,t)
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,-64),(b.Z_AXIS,-45))
    return p

def flower_watch(a,t):
    p={'rot':{},'loc':{},'feet':{}}
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,6),(b.Z_AXIS,4*b.math.sin(b.math.pi*t)))
    return p

def flower_crouch(a,t):
    p=flower_watch(a,0);u=b.ease(t)
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,.008*u,-.032*u))
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,-8*u))
    return p

def flower_ready(a):
    p={'rot':{},'loc':{},'feet':{}}
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,-12),(b.Z_AXIS,8))
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,-.025,.012))
    p['feet']['front_L']=((0,-.06,.18),0)
    return p

def flower_pounce(a,t):
    p=mix_pose(flower_crouch(a,1),flower_ready(a),b.ease(t))
    tuck=.035*b.math.sin(b.math.pi*t)**2
    for leg in ['front_R','hind_L','hind_R']:p['feet'][leg]=((0,0,tuck),0)
    return p

def flower_touch(a,t):
    p=flower_ready(a)
    tap=b.math.sin(b.math.pi*t)**2
    p['feet']['front_L']=((0,-.06-.075*tap,.18-.006*tap),-8*tap)
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,-.025,.012-.009*b.math.exp(-12*t)*b.math.sin(3*b.math.pi*t)))
    return p

def flower_recoil(a,t):
    p=mix_pose(flower_ready(a),{'rot':{},'loc':{},'feet':{}},b.ease(t))
    for leg in ['front_R','hind_L','hind_R']:p['feet'][leg]=((0,0,.025*b.math.sin(b.math.pi*t)**2),0)
    return p

def scratch_pose(a,phase=0):
    p={'rot':{},'loc':{},'feet':{}}
    p['rot']['spine_01']=b.armature_rotation(a.pose.bones['spine_01'],(b.X_AXIS,-55))
    p['rot']['head']=b.armature_rotation(a.pose.bones['head'],(b.X_AXIS,48),(b.Z_AXIS,-10))
    # 两后爪承重；前爪抬高回位，再贴树向下抓，两侧错开半个周期。
    for leg,shift in [('front_L',0),('front_R',.5)]:
        t=(phase+shift)%1
        if t<.62:
            u=b.ease(t/.62);height=.325-.055*u;reach=-.082
        else:
            u=b.ease((t-.62)/.38);height=.270+.055*u;reach=-.082+.018*b.math.sin(b.math.pi*u)
        rest=a.data.bones[leg+'_paw'].head_local
        reach-=.004 if leg=='front_L' else 0
        p['feet'][leg]=((0,reach-rest.y,height-rest.z),-75)
    p['loc']['spine_01']=b.armature_offset(a.pose.bones['spine_01'],(0,0,-.012-.003*b.math.sin(4*b.math.pi*phase)**2))
    return p

def scratch_reach(a,t):
    p=mix_pose({'rot':{},'loc':{},'feet':{}},scratch_pose(a),b.ease(t))
    # 身体向前时后脚分两步跟上；落脚段抵消根节点位移。
    root=.268*b.ease(t)
    for leg,delay in [('hind_L',0),('hind_R',.38)]:
        f=max(0,min(1,(t-delay)/.62));step=b.ease(f)
        p['feet'][leg]=((0,root-.268*step,.018*b.math.sin(b.math.pi*f)**2),0)
    return p

clips=[('bed_hop',1.4,hop,False),('sleep_down',1.8,sleep_down,False),('sleep_idle',4.8,sleep_idle,True),('sleep_up',1.6,sleep_up,False),('doze_down',1.6,lambda a,t:seated(a,b.ease(t)),False),('doze_idle',5.6,doze,True),('doze_up',1.4,lambda a,t:seated(a,1-b.ease(t)),False),('drink_down',1.6,lambda a,t:drink(a,b.ease(t)),False),('drink_lap',2.4,lambda a,t:drink(a,1,t),True),('drink_up',1.4,lambda a,t:drink(a,1-b.ease(t)),False)]
if '--nest-only' in sys.argv:
    clips=[('nest_jump',1.0,lambda a,t:mix_pose({'rot':{},'loc':{},'feet':{}},nest_grip(a),b.ease(t)),False),
           ('nest_grab',.35,nest_grip,False),('nest_climb',1.4,nest_climb,False),
           ('nest_turn',1.2,lambda a,t:low(a,1),False),('nest_watch',4.8,nest_watch,True),
           ('nest_down',1.0,lambda a,t:mix_pose(nest_watch(a,0),nest_sleep_pose(a),b.ease(t)),False),
           ('nest_sleep',4.8,nest_sleep_pose,True),
           ('nest_wake',1.0,lambda a,t:mix_pose(nest_sleep_pose(a),nest_watch(a,0),b.ease(t)),False),
           ('nest_out',1.4,lambda a,t:nest_climb(a,1-t),False),
           ('nest_drop',1.0,lambda a,t:mix_pose(nest_grip(a),{'rot':{},'loc':{},'feet':{}},b.ease(t)),False),
           ('nest_land',.5,lambda a,t:hop(a,t),False)]
elif '--expressions-only' in sys.argv:

    clips=[]
    for kind in ['tilt','groom','happy','sulk','sad']:
        clips.extend([(kind+'_down',1.6,lambda a,t,k=kind:expression(a,k,b.ease(t)),False),
                      (kind+'_idle',4.8,lambda a,t,k=kind:expression(a,k,1,t),True),
                      (kind+'_up',1.4,lambda a,t,k=kind:expression(a,k,1-b.ease(t)),False)])
elif '--sleep-only' in sys.argv:

    clips=[clip for clip in clips if clip[0].startswith('sleep_')]
if '--pond-only' in sys.argv:
    empty={'rot':{},'loc':{},'feet':{}}
    clips=[('pond_down',1.2,lambda a,t:mix_pose(empty,pond_pose(a),b.ease(t)),False),('pond_probe',2.8,pond_probe,False),('pond_pat',2.4,pond_pat,False),('pond_shake',1.6,pond_shake,False),('pond_up',1.2,lambda a,t:mix_pose(pond_pose(a,lift=.115),empty,b.ease(t)),False)]
if '--fence-only' in sys.argv:
    clips=[('fence_reach',.75,fence_reach,False),
           ('fence_jump',.44,lambda a,t:mix_pose(fence_reach(a,1),fence_grip(a),b.ease(t)),False),
           ('fence_grip',.30,fence_grip,False),('fence_climb',1.15,fence_climb,False),
           ('fence_turn',2.0,fence_step_turn,False),
           ('fence_turn_out',2.0,lambda a,t:fence_step_turn(a,t,True),False),
           ('fence_down',1.0,lambda a,t:mix_pose(low(a,1),fence_rest(a),b.ease(t)),False),
           ('fence_rest',4.8,fence_rest,True),
           ('fence_wake',1.0,lambda a,t:mix_pose(fence_rest(a),low(a,1),b.ease(t)),False),
           ('fence_out',1.15,lambda a,t:fence_climb(a,1-t),False),
           ('fence_drop',.38,lambda a,t:mix_pose(fence_grip(a),{'rot':{},'loc':{},'feet':{}},b.ease(t)),False),
           ('fence_land',.5,fence_land,False)]
if '--flower-only' in sys.argv:
    clips=[('flower_watch',.9,flower_watch,False),('flower_crouch',.65,flower_crouch,False),
           ('flower_pounce',.36,flower_pounce,False),('flower_touch',1.2,flower_touch,False),
           ('flower_recoil',.36,flower_recoil,False),('flower_recover',.6,fence_land,False)]
if '--scratch-only' in sys.argv:
    clips=[('scratch_reach',1.25,scratch_reach,False),('scratch_grip',.3,lambda a,t:scratch_pose(a),False),
           ('scratch_rake',.8,scratch_pose,True)]
if '--nest-sleep-only' in sys.argv:
    clips=[('nest_down',1.0,lambda a,t:mix_pose(nest_watch(a,0),nest_sleep_pose(a),b.ease(t)),False),('nest_sleep',4.8,nest_sleep_pose,True),('nest_wake',1.0,lambda a,t:mix_pose(nest_sleep_pose(a),nest_watch(a,0),b.ease(t)),False)]
# 收爪反向采样抬爪片段；清掉早期试做的重复片段。
if '--scratch-only' in sys.argv:
    for tr in list(arm.animation_data.nla_tracks):
        if tr.name in ['scratch_release','scratch_settle']:arm.animation_data.nla_tracks.remove(tr)
    for name in ['scratch_release','scratch_settle']:
        old=bpy.data.actions.get(name)
        if old:bpy.data.actions.remove(old)
for tr in list(arm.animation_data.nla_tracks):
    if tr.name in [x[0] for x in clips]: arm.animation_data.nla_tracks.remove(tr)
for name,*_ in clips:
    old=bpy.data.actions.get(name)
    if old:bpy.data.actions.remove(old)
arm.animation_data.action=None
for pb in arm.pose.bones:
    pb.location=b.Vector();pb.rotation_quaternion=b.Quaternion();pb.scale=b.Vector((1,1,1))
targets=b.setup_leg_ik(arm)
baked={name:b.bake_clip(arm,targets,name,seconds,fn,loop) for name,seconds,fn,loop in clips}
b.teardown_leg_ik(arm,targets)
for name,samples in baked.items():b.key_clip(arm,name,samples)
for pb in arm.pose.bones:
    pb.location=b.Vector();pb.rotation_quaternion=b.Quaternion();pb.scale=b.Vector((1,1,1))
assert fingerprint()==before,'外形或绑定被改写'
b.export_glb()
bpy.ops.wm.save_as_mainfile(filepath=b.BLEND_PATH,relative_remap=True,compress=True)
with open(b.MANIFEST_PATH,'w') as f:json.dump({'blend_sha256':b.file_sha256(b.BLEND_PATH),'glb_bytes':os.path.getsize(b.GLB_PATH)},f,indent=2)
print('LIFE_BINDING_HASH',before)
