import sys,glob
from PIL import Image,ImageDraw
D=sys.argv[1];fs=sorted(glob.glob(D+'/t*.png'),key=lambda f:float(f.split('/t')[-1][:-4]))
ims=[Image.open(f).resize((300,533)) for f in fs];cols=5;rows=(len(ims)+4)//5
c=Image.new('RGB',(300*cols,533*rows),'white')
for i,im in enumerate(ims):
  X,Y=(i%5)*300,(i//5)*533;c.paste(im,(X,Y));d=ImageDraw.Draw(c);d.line([X+264,Y,X+264,Y+533],fill='red');d.line([X,Y+426,X+300,Y+426],fill='red')
c.save(D+'/sheet.png')
