import subprocess,time,signal
from pathlib import Path
out=Path('outputs/world-v2/review');d='5D171DD3-720E-4FC4-BEB5-BF7B73A25ECD'
p=subprocess.Popen(['xcrun','simctl','io',d,'recordVideo','--codec=h264',str(out/'tail-ten-cycles.mp4')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
subprocess.run(['xcrun','simctl','launch','--terminate-running-process',d,'com.maomao.app','-script','100:action:tailChase;200:pause'],check=True)
time.sleep(17);p.send_signal(signal.SIGINT);p.wait(timeout=15)
print('tail review recorded')
