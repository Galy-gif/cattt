#!/usr/bin/env python3
"""扩院真机：静态短测、真实步速散步、镜头恢复回调；设备标识仅作命令参数。"""
import argparse,json,subprocess,time,math
from pathlib import Path

def run(*a):return subprocess.check_output(a,text=True,stderr=subprocess.STDOUT)

def same_snapshot(a,b):
    if isinstance(a,dict) and isinstance(b,dict):
        return a.keys()==b.keys() and all(same_snapshot(a[k],b[k]) for k in a)
    if isinstance(a,list) and isinstance(b,list):
        return len(a)==len(b) and all(same_snapshot(x,y) for x,y in zip(a,b))
    if isinstance(a,(int,float)) and not isinstance(a,bool) and isinstance(b,(int,float)) and not isinstance(b,bool):
        return math.isclose(a,b,rel_tol=0,abs_tol=1e-9)
    return a==b

def main():
    p=argparse.ArgumentParser();p.add_argument('--device',required=True);p.add_argument('--bundle',required=True)
    p.add_argument('--output',type=Path,default=Path('outputs/yard-expansion-review'));p.add_argument('--only',choices=['all','stroll-recovery','recovery'],default='all');a=p.parse_args()
    out=a.output/'device-checks';out.mkdir(parents=True,exist_ok=True)
    def copy(view,slot,dest):
        run('xcrun','devicectl','device','copy','from','--device',a.device,'--domain-type','appDataContainer','--domain-identifier',a.bundle,
            '--source',f'Documents/yard-composition/{view}-{slot}-ui.json','--destination',str(dest))
        return json.loads(dest.read_text())
    def launch(view='house',slot='day',duration=0,stroll=False,recovery=False):
        run('xcrun','devicectl','device','process','launch','--terminate-existing','--device',a.device,a.bundle,'--',
            '-yardComposition','-yardCompositionView',view,'-yardCompositionTime',slot,'-yardCompositionUI','YES',
            '-yardCompositionDuration',str(duration),'-yardCompositionStroll','YES' if stroll else 'NO',
            '-yardCompositionRecovery','YES' if recovery else 'NO','-yardCompositionDemo','NO')
    samples=[('house','day',60,False),('overview','night',60,False),('overview','day',240,True),('house','day',0,False)]
    for view,slot,duration,stroll in (samples if a.only=='all' else samples[3:] if a.only=='recovery' else samples[2:]):
        recovery=duration==0
        name='recovery' if recovery else f'{view}-{slot}-{duration}s'+('-stroll' if stroll else '')
        dest=out/f'{name}.json'
        try:old_run=copy(view,slot,dest).get('runId')
        except subprocess.CalledProcessError:old_run=None
        launch(view,slot,duration,stroll,recovery)
        print(f'{name} 开始',flush=True)
        deadline=time.monotonic()+duration+90
        while True:
            time.sleep(5)
            try:
                d=copy(view,slot,dest)
                if d.get('runId')!=old_run and (bool(d.get('recovery',{}).get('after')) if recovery else d.get('report',{}).get('seconds',0)>=duration):break
            except subprocess.CalledProcessError:pass
            if time.monotonic()>deadline:raise RuntimeError(name+' 超时，证据不完整')
        if recovery:
            before=d['recovery']['before'];after=d['recovery']['after']
            assert same_snapshot(before['camera'],after['camera']), '恢复后镜头不同'
            assert same_snapshot(before['position'],after['position']), '恢复后猫位置不同'
            print('镜头及猫位置恢复一致（回调注入，1e-9绝对容差）',flush=True)
        else:
            report=d['report'];print(json.dumps({'sample':name,**{k:report.get(k) for k in ['seconds','medianFps','low1Fps','minScale','trajectoryClearance','visitedNodes','journey']}},ensure_ascii=False),flush=True)
            if stroll:
                required={'lawn-center','m14','lawn-south','bench-front'}
                assert required.issubset(set(report.get('visitedNodes',[]))), '新增路线未走完'
                assert report['journey']['arrived'], '散步未结束'
                assert report['trajectoryClearance']['violations']==0, '实际行走出现穿透'
    launch('overview')
    print('完成，手机停在扩展版全景',flush=True)
if __name__=='__main__':main()
