import json,sys,os
from PIL import Image,ImageDraw,ImageFont,ImageFilter
P=json.load(open('/tmp/claude-0/-home-user-Tierlist/c1503037-5087-50d1-9ca4-718cbb45521d/scratchpad/avo/plan.json'))
F='/usr/share/fonts/opentype/inter/InterDisplay-Black.otf';FB='/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf'
W,H=1080,1920
big=ImageFont.truetype(F,156);lab=ImageFont.truetype(FB,50);mid=ImageFont.truetype(F,88);lab2=ImageFont.truetype(FB,42)
def ctext(d,y,s,f,col):
  w=d.textlength(s,font=f);d.text(((W-w)/2,y),s,font=f,fill=col)
os.makedirs('/tmp/claude-0/-home-user-Tierlist/c1503037-5087-50d1-9ca4-718cbb45521d/scratchpad/blend/out',exist_ok=True)
fr=sorted(os.listdir('/tmp/claude-0/-home-user-Tierlist/c1503037-5087-50d1-9ca4-718cbb45521d/scratchpad/blend/fr'))
for name in fr:
  i=int(name[1:6]);im=Image.open('/tmp/claude-0/-home-user-Tierlist/c1503037-5087-50d1-9ca4-718cbb45521d/scratchpad/blend/fr/'+name).convert('RGB').resize((W,H),Image.LANCZOS)
  # soft bottom darkening like the reference
  g=Image.new('L',(1,H));[g.putpixel((0,y),int(max(0,(y-1400)/520)*140)) for y in range(H)]
  im=Image.composite(Image.new('RGB',(W,H),(12,10,8)),im,g.resize((W,H)))
  sh=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(sh)
  ctext(d,148,P['cuts'][i],big,(0,0,0,140));ctext(d,1556,P['cubes'][i],mid,(0,0,0,140))
  sh=sh.filter(ImageFilter.GaussianBlur(8));im.paste(sh,(0,4),sh)
  d=ImageDraw.Draw(im)
  ctext(d,148,P['cuts'][i],big,(244,239,230));ctext(d,322,'CUTS',lab,(229,164,60))
  ctext(d,1556,P['cubes'][i],mid,(244,239,230));ctext(d,1660,'CUBES',lab2,(229,164,60))
  im.save('/tmp/claude-0/-home-user-Tierlist/c1503037-5087-50d1-9ca4-718cbb45521d/scratchpad/blend/out/'+name.replace('.png','.jpg'),quality=92)
print('overlaid',len(fr))
