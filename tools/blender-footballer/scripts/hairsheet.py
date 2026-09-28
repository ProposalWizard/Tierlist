import os
from PIL import Image, ImageDraw, ImageFont
import deliver
D = 'work/hair'
F = ImageFont.truetype(deliver.FONT, 20); T = ImageFont.truetype(deliver.FONT, 24)
rows = [('4 STYLES  (brown)', [('buzz', 'brown', 'BUZZ CUT  - card mesh'), ('crop', 'brown', 'SHORT CROP  - card mesh'),
                              ('afro', 'brown', 'CURLY / AFRO  - curve strands'), ('long', 'brown', 'LONG  - card mesh')]),
        ('1 STYLE x 3 COLOURS  (short crop)', [('crop', 'black', 'BLACK'), ('crop', 'brown', 'BROWN'), ('crop', 'blonde', 'BLONDE')])]
w, h = Image.open(f'{D}/hair_buzz_brown.png').size
out = Image.new('RGB', (w * 4, (h + 90) * 2), (10, 14, 26))
d = ImageDraw.Draw(out)
for r, (title, cells) in enumerate(rows):
    y0 = r * (h + 90)
    d.text((16, y0 + 12), title, font=T, fill=(230, 235, 245))
    for c, (s, col, lab) in enumerate(cells):
        im = Image.open(f'{D}/hair_{s}_{col}.png').convert('RGBA')
        bg = deliver.backdrop(w, h); bg = bg.convert('RGBA'); bg.alpha_composite(im)
        out.paste(bg.convert('RGB'), (c * w, y0 + 50))
        d.text((c * w + w // 2, y0 + 50 + h + 20), lab, font=F, fill=(210, 220, 235), anchor='mm')
out.save('hair.jpg', quality=90)
