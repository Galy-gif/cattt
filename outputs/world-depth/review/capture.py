"""Capture a deterministic depth comparison using the app's existing debug script."""
from pathlib import Path
import json
import signal
import subprocess
import time

out = Path(__file__).resolve().parent
sim = '8049B028-962E-45BE-8B8B-FDFDD06B07CD'
bundle = 'com.maomao.app'
script = ('0:place:0;50:pause;100:depth:off;1800:depth:on;4500:look:4;'
          '7500:look:5;10500:findCat;13500:look:1;15500:findCat;17500:snapshot:depth-final')
subprocess.run(['xcrun','simctl','terminate',sim,bundle],capture_output=True)
video = out/'depth-tour.mp4'
video.unlink(missing_ok=True)
record = subprocess.Popen(['xcrun','simctl','io',sim,'recordVideo','--codec=h264',str(video)])
launch = subprocess.check_output(['xcrun','simctl','launch',sim,bundle,'-script',script],text=True)
pid = launch.strip().split()[-1]
print(launch.strip(), flush=True)
started = time.monotonic()
captures = [(1.3,'before'),(3.5,'after'),(6.8,'pond'),(9.8,'fence'),(12.5,'return'),(14.8,'tree')]
rss=[]
try:
    for target,name in captures:
        while time.monotonic()-started < target:
            sample=subprocess.run(['ps','-o','rss=','-p',pid],capture_output=True,text=True).stdout.strip()
            if sample.isdigit(): rss.append(int(sample))
            time.sleep(0.2)
        subprocess.run(['xcrun','simctl','io',sim,'screenshot',str(out/(name+'.png'))],check=True,capture_output=True)
    time.sleep(max(0,18.5-(time.monotonic()-started)))
finally:
    record.send_signal(signal.SIGINT)
    record.wait(timeout=20)
(out/'capture.json').write_text(json.dumps({'script':script,'peakRSSMiB':max(rss,default=0)/1024,'samples':len(rss)},indent=2))
