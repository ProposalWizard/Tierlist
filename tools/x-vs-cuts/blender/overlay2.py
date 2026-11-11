import json,os
from PIL import Image,ImageDraw,ImageFont,ImageFilter
E=json.load(open('events_r1.json'))['R'];D=sorted(E['down']+E['side']+E['dice'])
CUBES={124:4,139:18,154:36}
F='/usr/share/fonts/opentype/inter/InterDisplay-Black.otf';FB='/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf'
W,H=1080,1920;big=ImageFont.truetype(F,184);lab=ImageFont.truetype(FB,54);mid=ImageFont.truetype(F,104);lab2=ImageFont.truetype(FB,46)
def ct(d,y,s,f,c):w=d.textlength(s,font=f);d.text(((W-w)/2,y),s,font=f,fill=c)
os.makedirs('out2',exist_ok=True)
g=Image.new('L',(1,H));[g.putpixel((0,y),int(max(0,(y-1400)/520)*140)) for y in range(H)];g=g.resize((W,H))
for name in sorted(os.listdir('fr2')):
  i=int(name[1:6]);cuts=sum(1 for f in D if f<=i);cubes=max([v for f,v in CUBES.items() if f<=i],default=0)
  im=Image.open('fr2/'+name).convert('RGB').resize((W,H),Image.LANCZOS);im=Image.composite(Image.new('RGB',(W,H),(12,10,8)),im,g)
  sh=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(sh);ct(d,128,f'{cuts:,}',big,(0,0,0,140));ct(d,1540,f'{cubes:,}',mid,(0,0,0,140))
  sh=sh.filter(ImageFilter.GaussianBlur(8));im.paste(sh,(0,4),sh);d=ImageDraw.Draw(im)
  ct(d,128,f'{cuts:,}',big,(244,239,230));ct(d,330,'CUTS',lab,(229,164,60));ct(d,1540,f'{cubes:,}',mid,(244,239,230));ct(d,1660,'CUBES',lab2,(229,164,60))
  im.save('out2/'+name.replace('.png','.jpg'),quality=92)
print('overlaid')
