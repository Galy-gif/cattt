import subprocess,time,pathlib,signal,sys
root=pathlib.Path(__file__).resolve().parents[2]
out=root/'outputs/frames-v5-review/capture'; out.mkdir(parents=True,exist_ok=True)
name=sys.argv[1]; script=sys.argv[2]; seconds=float(sys.argv[3])
video=out/(name+'.mp4')
if video.exists(): video.replace(out/(name+'-previous.mp4'))
start_wall=time.time()
record=subprocess.Popen(['xcrun','simctl','io','booted','recordVideo','--force',str(video)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1.0)
t0=time.monotonic()
subprocess.run(['xcrun','simctl','launch','--terminate-running-process','booted','com.maomao.app','-script',script],check=True,stdout=subprocess.DEVNULL)
time.sleep(seconds)
record.send_signal(signal.SIGINT);record.wait(timeout=30)
assert video.exists() and video.stat().st_mtime>=start_wall,'Missing fresh recording'
print('video',video,'launch offset',round(t0-start_wall,2))
