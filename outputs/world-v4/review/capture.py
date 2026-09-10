import subprocess,time,pathlib,signal,sys,json,shutil
root=pathlib.Path(__file__).resolve().parents[3]
out=root/'outputs/world-v4/review'
scenario=sys.argv[1] if len(sys.argv)>1 else 'interactions'
scenarios={
'final':('300:reseed;1400:place:1;1500:findCat;17500:snapshot:nest;19000:moveCat:0;24000:place:5;24100:findCat;28000:snapshot:rail;30000:moveCat:4;35000:place:4;35100:findCat;39000:snapshot:pond;42500:moveCat:4;48000:snapshot:pond-repeat;51000:look:0;53500:findCat;54000:look:0;54500:findCat;57000:drag:500;57500:drag:-800;58500:findCat;61500:snapshot:end',[(6,'final-scratch'),(14,'final-tree-up'),(18,'final-nest'),(21,'final-tree-down'),(26,'final-rail-up'),(28,'final-rail'),(32,'final-rail-down'),(38,'final-pond-touch'),(40,'final-pond-shake'),(44,'final-pond-repeat'),(53,'final-camera-away'),(56,'final-camera-return'),(66,'final-end')]),
'interactions':('300:reseed;1400:place:1;1500:findCat;18500:snapshot:nest;19500:place:5;19600:findCat;24500:snapshot:rail;27000:place:4;27100:findCat;33500:snapshot:pond',[(5,'scratch'),(12,'tree-approach'),(14,'tree-up'),(17,'nest'),(21,'rail-up'),(23,'rail'),(29,'pond-reach'),(30,'pond-tap'),(32,'pond-shake'),(35,'pond-rest')]),
'camera':('300:reseed;1300:place:5;1400:findCat;5000:look:0;7400:findCat;8100:look:0;8500:findCat;11000:drag:500;11500:drag:-800;12500:findCat;16000:snapshot:camera',[(6,'camera-left'),(8,'camera-return'),(12,'drag'),(17,'camera-end')]),
'route':('300:reseed;1500:moveCat:5;1600:findCat;25000:snapshot:route',[(8,'route1'),(15,'route2'),(21,'bend'),(27,'arrival')]),
}
script,times=scenarios[scenario]
video=out/(scenario+'.mp4')
if video.exists():
 backup=out/(scenario+'-previous.mp4')
 video.replace(backup)
record=subprocess.Popen(['xcrun','simctl','io','booted','recordVideo',str(out/(scenario+'.mp4'))],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
subprocess.run(['xcrun','simctl','launch','--terminate-running-process','booted','com.maomao.app','-script',script],check=True)
start=time.monotonic()
start_wall=time.time()-5
memory=[]
for sec,label in times:
 time.sleep(max(0,sec-(time.monotonic()-start)))
 subprocess.run(['xcrun','simctl','io','booted','screenshot',str(out/(label+'.png'))],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
 ps=subprocess.check_output(['ps','-axo','rss,comm'],text=True)
 memory.extend([int(line.strip().split()[0])/1024 for line in ps.splitlines() if line.rstrip().endswith('/Maomao')])
 print(label,flush=True)
if record.poll() is not None:raise RuntimeError('Simulator video recording stopped unexpectedly')
record.send_signal(signal.SIGINT);record.wait(timeout=30)
assert video.exists() and video.stat().st_mtime>=start_wall,'Missing fresh recording'

(out/(scenario+'-memory.json')).write_text(json.dumps({'samplesMB':memory,'peakMB':max(memory,default=0)},indent=2))
documents=pathlib.Path(subprocess.check_output(['xcrun','simctl','get_app_container','booted','com.maomao.app','data'],text=True).strip())/'Documents'
for f in documents.glob('*.json'):
 if f.name.startswith(('camera-','nest','rail','pond','end','route','world-metrics')):shutil.copy2(f,out/(scenario+'-'+f.name))
