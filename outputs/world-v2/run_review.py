from pathlib import Path
import subprocess,time,json,re,signal
root=Path.cwd();out=root/'outputs/world-v2/review';app=root/'outputs/world-v2/build/Build/Products/Debug-iphonesimulator/Maomao.app';device='5D171DD3-720E-4FC4-BEB5-BF7B73A25ECD'
def run(*args):return subprocess.check_output(args,text=True).strip()
run('xcrun','simctl','install',device,str(app))
script='100:moveCat:1;12000:moveCat:3;23000:poke;30000:moveCat:5;40000:look:0;45000:findCat;55000:moveCat:2;70000:moveCat:4;85000:moveCat:0;105000:moveCat:5;125000:moveCat:3;145000:moveCat:1;165000:moveCat:4;185000:moveCat:0;205000:moveCat:2;225000:moveCat:5;245000:moveCat:3;265000:moveCat:1;295000:snapshot'
launch=run('xcrun','simctl','launch','--terminate-running-process',device,'com.maomao.app','-script',script);pid=int(launch.split(':')[-1]);print(launch,flush=True)
record=subprocess.Popen(['xcrun','simctl','io',device,'recordVideo','--codec=h264',str(out/'world-v2-run.mp4')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
start=time.monotonic();samples=[]
for i in range(31):
 elapsed=time.monotonic()-start
 rss=int(run('ps','-o','rss=','-p',str(pid)))
 samples.append(dict(seconds=round(elapsed,2),rssKB=rss))
 if i in (1,2,4):run('xcrun','simctl','io',device,'screenshot',str(out/f'run-{i*10}s.png'))
 if i==7:record.send_signal(signal.SIGINT)
 (out/'memory-samples.json').write_text(json.dumps(samples,indent=2))
 if i<30:time.sleep(max(0,start+(i+1)*10-time.monotonic()))
container=run('xcrun','simctl','get_app_container',device,'com.maomao.app','data')
import shutil
shutil.copyfile(Path(container)/'Documents/world-metrics.json',out/'world-metrics.json')
print('Five-minute run completed',flush=True)
