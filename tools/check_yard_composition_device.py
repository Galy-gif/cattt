#!/usr/bin/env python3
"""真机短时性能复测、原生恢复回调注入和程序镜头演示；不代替人工双指触摸验收。"""
import argparse
import json
import subprocess
import time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs/ios-3d-composition-review'

def run(*args): return subprocess.check_output(args,text=True,stderr=subprocess.STDOUT).strip()

def main():
    p=argparse.ArgumentParser();p.add_argument('--device',required=True);p.add_argument('--bundle',required=True);a=p.parse_args()
    result=OUT/'device-checks';result.mkdir(parents=True,exist_ok=True)
    def launch(view,slot='day',duration=0,demo=False,recovery=False):
        return run('xcrun','devicectl','device','process','launch','--terminate-existing','--device',a.device,a.bundle,'--',
            '-yardComposition','-yardCompositionView',view,'-yardCompositionUI','YES','-yardCompositionTime',slot,
            '-yardCompositionDuration',str(duration),'-yardCompositionDemo','YES' if demo else 'NO','-yardCompositionRecovery','YES' if recovery else 'NO')
    def copy(view,slot,path):
        run('xcrun','devicectl','device','copy','from','--device',a.device,'--domain-type','appDataContainer','--domain-identifier',a.bundle,
            '--source',f'Documents/yard-composition/{view}-{slot}-ui.json','--destination',str(path))
        return json.loads(path.read_text())
    for view,slot in [('house','day'),('overview','night')]:
        dest=result/f'{view}-{slot}-60s.json'
        try: old_run=copy(view,slot,dest).get('runId')
        except subprocess.CalledProcessError: old_run=None
        launch(view,slot,60); print(f'真机 {view}/{slot} 60秒样本开始（静止猫、镜头固定）',flush=True)
        deadline=time.monotonic()+90
        # 每次短等候，外层 agent 仍可继续沟通和整理报告。
        while True:
            time.sleep(5)
            try:
                d=copy(view,slot,dest)
                if d.get('runId') != old_run and d.get('report',{}).get('seconds',0)>=60:break
            except subprocess.CalledProcessError:pass
            if time.monotonic()>deadline:raise RuntimeError('性能证据超时')
        print(f'{view}: '+json.dumps({k:d['report'].get(k) for k in ['seconds','medianFps','low1Fps','minScale']},ensure_ascii=False),flush=True)
    launch('house',recovery=True)
    deadline=time.monotonic()+40
    while True:
        time.sleep(3)
        try:
            d=copy('house','day',result/'recovery.json')
            if d.get('recovery',{}).get('after'):break
        except subprocess.CalledProcessError:pass
        if time.monotonic()>deadline:raise RuntimeError('恢复回调证据超时')
    print('缩放浏览状态的原生恢复回调注入已保存',flush=True)
    launch('house',demo=True)
    try:
        run('xcrun','devicectl','device','capture','screen-record','--device',a.device,'--duration','23','--destination',str(OUT/'镜头演示-真机.mp4'))
    except subprocess.CalledProcessError as error:
        (result/'recording-unavailable.json').write_text(json.dumps({'status':'缺测','reason':error.output},ensure_ascii=False,indent=2))
        print('真机录屏接口不可用，保留失败原因；演示需用模拟器录屏明确替代',flush=True)
        time.sleep(22)
    copy('house','day',result/'demo.json')
    launch('house')
    print('复测结束；手机停在可交互的日常预览，录屏是否可用请看记录',flush=True)
if __name__=='__main__':main()
