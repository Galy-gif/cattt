from build_world_v2 import *
top=Image.open(REVIEW/'tree-detail-top-native.png').convert('RGB');bottom=Image.open(REVIEW/'tree-detail-bottom-native.png').convert('RGB')
k=min(top.width/1230,top.height/687,bottom.width/1230,bottom.height/687)
w=int(1230*k);h=int(1278*k);th=round(687*k);start=round(591*k)
top=top.resize((w,th),Image.Resampling.LANCZOS);bottom=bottom.resize((w,h-start),Image.Resampling.LANCZOS)
a=np.zeros((h,w,3),np.float32);a[:th]=np.array(top);a[th:]=np.array(bottom)[th-start:]
overlap=th-start;fade=np.linspace(0,1,overlap)[:,None,None]
a[start:th]=np.array(top)[start:th]*(1-fade)+np.array(bottom)[:overlap]*fade
Image.fromarray(a.astype('uint8')).save(REVIEW/'tree-HD-generated.png');print('native tree',w,h)
