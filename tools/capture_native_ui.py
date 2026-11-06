"""模拟器程序驱动视觉核对；原尺寸截图只写 /tmp，不替代人工触摸/真机验收。"""
import subprocess, time
from pathlib import Path
OUT = Path('/tmp/maomao-native-ui')
OUT.mkdir(exist_ok=True)
cases = [
 ('chat-day', '500:time:12;500:weather:clear;600:place:0;800:screen:chat', False),
 ('chat-night', '500:time:23;500:weather:rain;600:place:4;800:screen:chat', False),
 ('chat-keyboard', '500:time:12;500:weather:clear;600:place:0;800:screen:chat;1000:reviewDraft:今天想慢慢聊一会儿。窗外下过雨，树叶的颜色比平时更深。我刚刚走过院子，看见池塘边有一片落叶，想把这些小事都告诉你。输入框长到五行以后应该可以滚动，发送按钮也要始终看得见。', True),
 ('me', '500:screen:me', False),
 ('diary', '500:screen:mailbox', False),
 ('welcome', '500:reviewPage:0', False),
 ('temperament', '500:reviewPage:1', False),
 ('naming', '500:reviewPage:2', False),
 ('meeting', '500:reviewPage:3', False),
]
for name, script, focus in cases:
 args=['xcrun','simctl','launch','--terminate-running-process','booted','com.maomao.app','-script',script]
 if focus: args+=['-uiFocus']
 subprocess.run(args,check=True,stdout=subprocess.DEVNULL)
 time.sleep(4)
 subprocess.run(['xcrun','simctl','io','booted','screenshot',str(OUT/(name+'.png'))],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 print(name,flush=True)
