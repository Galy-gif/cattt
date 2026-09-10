from pathlib import Path
import subprocess,time,shutil,json
out=Path('outputs/world-v2/review');d='5D171DD3-720E-4FC4-BEB5-BF7B73A25ECD'
def run(*a):return subprocess.check_output(a,text=True).strip()
run('xcrun','simctl','install',d,str(Path('outputs/world-v2/build/Build/Products/Debug-iphonesimulator/Maomao.app').resolve()))
script='100:moveCat:5;1000:snapshot:lifecycle-before;1200:screen:chat;4000:snapshot:lifecycle-off-home;4500:screen:home;7000:snapshot:lifecycle-after;7200:pause;10000:snapshot:lifecycle-manual-paused;10500:pause;12500:snapshot:lifecycle-resumed'
run('xcrun','simctl','launch','--terminate-running-process',d,'com.maomao.app','-script',script)
container=Path(run('xcrun','simctl','get_app_container',d,'com.maomao.app','data'))
for _ in range(30):
 if (container/'Documents/lifecycle-resumed.json').exists():break
 time.sleep(1)
for p in (container/'Documents').glob('lifecycle-*.json'):shutil.copyfile(p,out/p.name)
for p in out.glob('lifecycle-*.json'):
 data=json.loads(p.read_text());print(p.name,round(data['worldSeconds'],2),data['paused'],data['onHome'])
