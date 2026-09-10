import subprocess,time,pathlib,signal
root=pathlib.Path(__file__).resolve().parents[3]
out=root/'outputs/world-v3/review'
app=root/'outputs/world-v3/build/Build/Products/Debug-iphonesimulator/Maomao.app'
subprocess.run(['xcrun','simctl','install','booted',str(app)],check=True)
record=subprocess.Popen(['xcrun','simctl','io','booted','recordVideo',str(out/'final-review.mp4')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
script='300:reseed;1500:place:1;1700:findCat;15500:snapshot:nest;18000:place:5;18100:findCat;22500:snapshot:flower;28000:snapshot:rail;30000:look:0;32500:findCat;35000:look:0;35500:findCat;39500:snapshot:end'
subprocess.run(['xcrun','simctl','launch','--terminate-running-process','booted','com.maomao.app','-script',script],check=True)
start=time.monotonic()
for sec,label in [(6,'scratch'),(16,'nest'),(22,'flower'),(28,'rail'),(31,'camera-away'),(33,'camera-return'),(41,'end')]:
 time.sleep(max(0,sec-(time.monotonic()-start)))
 subprocess.run(['xcrun','simctl','io','booted','screenshot',str(out/('final-'+label+'.png'))],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
 print(label,flush=True)
record.send_signal(signal.SIGINT);record.wait(timeout=30)
