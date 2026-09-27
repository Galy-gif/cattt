#!/usr/bin/env python3
"""已安装 Debug App 的模拟器构图采样；等待本轮原生证据写入后才截图。"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import time
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/ios-3d-composition-review'

def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT).strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--device', required=True)
    parser.add_argument('--output', type=Path, default=OUT)
    parser.add_argument('--label', required=True)
    parser.add_argument('--physical', action='store_true')
    parser.add_argument('--bundle', default='com.maomao.app')
    parser.add_argument('--views', default='house,bed,tree,grass,pond,fence,overview')
    parser.add_argument('--time', default='day', choices=['day', 'night'])
    parser.add_argument('--ui', default='both', choices=['both', 'YES', 'NO'])
    args = parser.parse_args()
    originals = args.output / 'originals' / args.label
    evidence = args.output / 'metrics' / args.label
    originals.mkdir(parents=True, exist_ok=True); evidence.mkdir(parents=True, exist_ok=True)
    if not args.physical: run('xcrun', 'simctl', 'status_bar', args.device, 'override', '--time', '09:41', '--batteryState', 'charged', '--batteryLevel', '100')
    for view in args.views.split(','):
        for ui in (['NO', 'YES'] if args.ui == 'both' else [args.ui]):
            name = f'{view}-{args.time}-{"ui" if ui == "YES" else "clean"}'
            began = time.time()
            old_run = None
            if args.physical:
                try:
                    old = originals / f'{name}-prior.json'
                    run('xcrun', 'devicectl', 'device', 'copy', 'from', '--device', args.device,
                        '--domain-type', 'appDataContainer', '--domain-identifier', args.bundle,
                        '--source', f'Documents/yard-composition/{name}.json', '--destination', str(old))
                    old_run = json.loads(old.read_text()).get('runId')
                except (subprocess.CalledProcessError, ValueError): pass
            arguments = ['-yardComposition', '-yardCompositionView', view, '-yardCompositionTime', args.time,
                         '-yardCompositionUI', ui, '-yardCompositionDemo', 'NO', '-yardCompositionDuration', '0', '-yardCompositionRecovery', 'NO', '-yardCompositionStroll', 'NO']
            if args.physical:
                run('xcrun', 'devicectl', 'device', 'process', 'launch', '--terminate-existing', '--device', args.device, args.bundle, '--', *arguments)
                source = originals / f'{name}.json'
                deadline = time.monotonic() + 35
                while True:
                    time.sleep(1)
                    try:
                        run('xcrun', 'devicectl', 'device', 'copy', 'from', '--device', args.device,
                            '--domain-type', 'appDataContainer', '--domain-identifier', args.bundle,
                            '--source', f'Documents/yard-composition/{name}.json', '--destination', str(source))
                        data = json.loads(source.read_text())
                        if data.get('runId') and data['runId'] != old_run: break
                    except (subprocess.CalledProcessError, KeyError, ValueError): pass
                    if time.monotonic() >= deadline: raise RuntimeError(f'{name}: 真机未生成本轮证据')
            else:
                run('xcrun', 'simctl', 'launch', '--terminate-running-process', args.device, args.bundle, *arguments)
                container = Path(run('xcrun', 'simctl', 'get_app_container', args.device, args.bundle, 'data'))
                source = container / 'Documents/yard-composition' / f'{name}.json'
                deadline = time.monotonic() + 30
                while not (source.exists() and source.stat().st_mtime >= began):
                    if time.monotonic() >= deadline:
                        run('xcrun', 'simctl', 'io', args.device, 'screenshot', str(originals / f'{name}-failed.png'))
                        raise RuntimeError(f'{name}: 30秒内未生成本轮证据，不能将截图记作通过')
                    time.sleep(.25)
            data = json.loads(source.read_text())
            if data['viewport']['width'] <= 0: raise RuntimeError('无效视口')
            shutil.copy2(source, evidence / f'{name}.json')
            if args.physical:
                run('xcrun', 'devicectl', 'device', 'capture', 'screenshot', '--device', args.device, '--destination', str(originals / f'{name}.png'))
            else: run('xcrun', 'simctl', 'io', args.device, 'screenshot', str(originals / f'{name}.png'))
            print(f'{args.label}: {name} captured; cat height {data["cat"]["height"]:.1f}pt', flush=True)

if __name__ == '__main__': main()
