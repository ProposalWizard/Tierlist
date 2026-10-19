import json,sys
from PIL import Image, ImageDraw, ImageFont
d=json.load(open("analysed.json"))
fin=json.load(open("final.json"))["nations"]; nm=json.load(open("nations.json"))
for n in d:
    if d[n]:
        f=fin[nm.get(n,n)]
        for side in ("home","away"):
            k=f[side+"Kit"]; d[n][side]["words"]=k["pattern"]; d[n][side]["shirt"]=k["shirtHex"]; d[n][side]["trim"]=k.get("trimHex")
import os
only=json.load(open(os.environ["ONLY"])) if os.environ.get("ONLY") else None
names=[n for n in d if d[n] and (only is None or n in only)]
prefix=os.environ.get("PREFIX","sheet")
per=int(sys.argv[1]) if len(sys.argv)>1 else 24
try: font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",11)
except: font=ImageFont.load_default()
for p in range(0,len(names),per):
    chunk=names[p:p+per]; cols=6; rows=(len(chunk)+cols-1)//cols
    W=260; H=240
    sh=Image.new("RGB",(cols*W,rows*H),"white"); dr=ImageDraw.Draw(sh)
    for i,n in enumerate(chunk):
        x=(i%cols)*W; y=(i//cols)*H
        dr.text((x+4,y+2),n,fill="black",font=font)
        for j,side in enumerate(("home","away")):
            im=Image.open(f"kitimg/{n.replace('/','_')}_{side}.png").convert("RGB").resize((100,135),0)
            sh.paste(im,(x+15+j*120,y+18))
            w=d[n][side]["words"]
            # wrap
            lines=[w[k:k+22] for k in range(0,len(w),22)]
            for li,l in enumerate(lines[:3]): dr.text((x+4+j*128,y+158+li*13),l,fill="black",font=font)
            dr.rectangle([x+4+j*128,y+200,x+24+j*128,y+215],fill=d[n][side]["shirt"],outline="black")
            if d[n][side]["trim"]: dr.rectangle([x+26+j*128,y+200,x+46+j*128,y+215],fill=d[n][side]["trim"],outline="black")
    sh.save(f"{prefix}_{p//per:02d}.png")
print("done")
