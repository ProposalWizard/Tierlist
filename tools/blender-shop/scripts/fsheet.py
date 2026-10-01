import sys, os
from PIL import Image
fams=sys.argv[1:]
bgs=[(58,63,74),(21,94,117),(30,64,175),(107,33,168),(183,121,31)]
w,h=400,300
for fam in fams:
    ims=[]
    for l in range(1,6):
        p=f'../final/{fam}-L{l}.png'
        if os.path.exists(p): ims.append((l,Image.open(p).convert('RGBA').resize((w,h),Image.LANCZOS)))
    sh=Image.new('RGB',(w*3,h*2))
    for i,(l,im) in enumerate(ims):
        bg=Image.new('RGBA',(w,h),bgs[l-1]+(255,)); bg.alpha_composite(im); sh.paste(bg.convert('RGB'),((i%3)*w,(i//3)*h))
    sh.save(f'../out/f-{fam}.png')
