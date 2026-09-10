from pathlib import Path
import subprocess,time,json,shutil
out=Path('outputs/world-v2/review');d='5D171DD3-720E-4FC4-BEB5-BF7B73A25ECD'
def run(*a):return subprocess.check_output(a,text=True).strip()
run('xcrun','simctl','install',d,str(Path('outputs/world-v2/build/Build/Products/Debug-iphonesimulator/Maomao.app').resolve()))
script='100:moveCat:5;1000:snapshot;1200:screen:chat;4000:snapshot;4500:screen:home;7000:snapshot;7200:pause;10000:snapshot;10500:pause;12500:snapshot'
run('xcrun','simctl','launch','--terminate-running-process',d,'com.maomao.app','-script',script)
container=Path(run('xcrun','simctl','get_app_container',d,'com.maomao.app','data'));start=time.monotonic()
for at,label in [(1.1,'before'),(4.2,'off-home'),(7.1,'after'),(10.2,'manual-paused'),(12.8,'resumed')]:
 time.sleep(max(0,at-(time.monotonic()-start)));shutil.copyfile(container/'Documents/world-metrics.json',out/f'state-{label}.json')
print('state snapshots saved')
