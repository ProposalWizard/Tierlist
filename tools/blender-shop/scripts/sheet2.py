import sys
from PIL import Image
import os
fam=sys.argv[1]; ls="1 2 3 4 5".split()
ims=[(l,Image.open(f'../out/p-{fam}-{l}.png').convert('RGBA')) for l in ls if os.path.exists(f'../out/p-{fam}-{l}.png')]
bgs=[(58,63,74),(21,94,117),(30,64,175),(107,33,168),(183,121,31)]
w,h=360,270
sheet=Image.new('RGB',(w*3,h*2))
for i,(l,im) in enumerate(ims):
    bg=Image.new('RGBA',(w,h),bgs[int(l)-1]+(255,)); bg.alpha_composite(im); sheet.paste(bg.convert('RGB'),((i%3)*w,(i//3)*h))
sheet.save(f'../out/prev-{fam}.png')
