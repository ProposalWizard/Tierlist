import json,sys
from PIL import Image,ImageDraw
d,out,label=sys.argv[1],sys.argv[2],sys.argv[3]
j=json.load(open(d+'/on.json'))
ims=[]
for i,f in enumerate(j['frames']):
    im=Image.open(f'{d}/on-celeb-{i}.jpg').convert('RGB'); dr=ImageDraw.Draw(im)
    k=f['keeper']; x,y=k['cx'],k['cy']
    if -40<x<430 and -40<y<884: dr.ellipse([x-22,y-22,x+22,y+22],outline=(255,0,0),width=4)
    else: dr.text((10,820),f"keeper's spot is off screen ({x:.0f},{y:.0f})",fill=(255,0,0))
    for p in ('postL','postR'):
        q=f[p]; dr.line([q['cx'],q['cy']-15,q['cx'],q['cy']+15],fill=(0,200,255),width=4)
    dr.rectangle([0,90,390,118],fill=(0,0,0)); dr.text((8,96),f"{label}  t={f['t']:.1f}s  ring = keeper's pitch spot",fill=(255,255,255))
    ims.append(im)
W=sum(i.width for i in ims); s=Image.new('RGB',(W,ims[0].height)); x=0
for i in ims: s.paste(i,(x,0)); x+=i.width
s=s.resize((W//2,ims[0].height//2)); s.save(out,quality=75)
