import json, math, sys
from PIL import Image
exec(open("compose.py").read().split("os.makedirs(\"kitimg\"")[0])
NAMES = {
 "white":"#F2F4F7","cream":"#EFE6CF","grey":"#8A8F98","silver":"#C0C4CA","black":"#17181A","charcoal":"#3A3D42",
 "red":"#D71920","dark red":"#9E1B22","claret":"#6C1D45","maroon":"#7A263A","pink":"#E8789A",
 "orange":"#F78F1E","dark orange":"#C85A12","amber":"#F2A900","gold":"#D4A72C","yellow":"#FBE300",
 "light green":"#7CC66A","green":"#159C56","dark green":"#0B5A32","lime":"#B5D334",
 "turquoise":"#1CC7C1","teal":"#0B7A75","dark turquoise":"#0F8C8A",
 "sky blue":"#6CABDD","blue":"#0057B8","royal blue":"#1F4FB5","navy":"#001F5B","purple":"#5B2A86","brown":"#6B4226",
}
def rgb(h): return tuple(int(h[i:i+2],16) for i in (1,3,5))
def hx(c): return "#%02X%02X%02X" % tuple(int(round(v)) for v in c[:3])
def lab(c):
    def f(u):
        u/=255; return ((u+0.055)/1.055)**2.4 if u>0.04045 else u/12.92
    r,g,b=[f(v) for v in c[:3]]
    X=(r*0.4124+g*0.3576+b*0.1805)/0.95047; Y=r*0.2126+g*0.7152+b*0.0722; Z=(r*0.0193+g*0.1192+b*0.9505)/1.08883
    g_=lambda t: t**(1/3) if t>0.008856 else 7.787*t+16/116
    return (116*g_(Y)-16, 500*(g_(X)-g_(Y)), 200*(g_(Y)-g_(Z)))
def dE(a,b):
    A,B=lab(a),lab(b); return math.dist(A,B)
NAMES_RGB={k:rgb(v) for k,v in NAMES.items()}
import colorsys
def name(c):
    r,g,b=[v/255 for v in c[:3]]
    h,l,s=colorsys.rgb_to_hls(r,g,b); h*=360
    mx=max(r,g,b); mn=min(r,g,b); chroma=mx-mn
    if chroma<0.10 or (s<0.18 and chroma<0.16):
        return "white" if l>0.88 else "silver" if l>0.68 else "grey" if l>0.42 else "charcoal" if l>0.2 else "black"
    if l<0.12 and chroma<0.2: return "black"
    if h<7 or h>=345:
        if l>0.72: return "pink"
        return "claret" if l<0.3 and h>=330 else "dark red" if l<0.33 else "red"
    if h<20: return "dark orange" if l<0.4 else "orange" if l<0.72 else "pink"
    if h<42:
        if l<0.32: return "brown"
        if l>0.82: return "cream"
        return "orange" if h<34 else "amber"
    if h<62:
        if l<0.35: return "brown" if h<50 else "dark green"
        if l>0.85: return "cream"
        return "gold" if s<0.62 or l<0.5 else "yellow"
    if h<80: return "lime"
    if h<160:
        return "dark green" if l<0.25 else "light green" if l>0.62 else "green"
    if h<186:
        return "teal" if l<0.35 else "turquoise"
    if h<205:
        return "sky blue" if l>0.6 else "teal" if l<0.3 else "blue"
    if h<250:
        if l>0.68: return "sky blue"
        if l<0.22: return "navy"
        return "royal blue" if h>=222 and s>0.6 and l>0.4 else "blue"
    if h<290: return "navy" if l<0.25 else "purple" if l<0.6 else "lilac"
    if h<330: return "purple" if l<0.45 else "pink"
    return "claret" if l<0.3 else "pink" if l>0.6 else "red"
def pixels(layer, base, box=None):
    w,h=layer.size; L=layer.load(); B=base.load() if base else None; out=[]
    for y in range(h):
        for x in range(w):
            if B and B[x,y][3]>=128: continue
            if box and not (box[0]<=x<box[2] and box[1]<=y<box[3]): continue
            out.append(((x,y), L[x,y][:3]))
    return out
def clusters(px, tol=22):
    cs=[]  # [sumr,sumg,sumb,n]
    for _,c in px:
        best=None;bd=1e9
        for cl in cs:
            m=(cl[0]/cl[3],cl[1]/cl[3],cl[2]/cl[3]); d=dE(c,m)
            if d<bd: bd,best=d,cl
        if best and bd<tol: best[0]+=c[0];best[1]+=c[1];best[2]+=c[2];best[3]+=1
        else: cs.append([c[0],c[1],c[2],1])
    tot=sum(c[3] for c in cs) or 1
    res=sorted([((c[0]/c[3],c[1]/c[3],c[2]/c[3]), c[3]/tot) for c in cs], key=lambda t:-t[1])
    # merge tiny into nearest
    return res
def label(c, sig): return min(range(len(sig)), key=lambda i: dE(c, sig[i][0]))
def structure(px, sig, w, h):
    lab_={p:label(c,sig) for p,c in px}
    def runs(seq):
        seq=[s for s in seq if s is not None]; return sum(1 for a,b in zip(seq,seq[1:]) if a!=b)
    def maj(vals):
        if not vals: return None
        from collections import Counter
        v,n=Counter(vals).most_common(1)[0]; return v if n/len(vals)>=0.6 else -1
    cols=[maj([lab_[(x,y)] for y in range(h) if (x,y) in lab_]) for x in range(w)]
    rows=[maj([lab_[(x,y)] for x in range(w) if (x,y) in lab_]) for y in range(h)]
    colpur=sum(1 for c in cols if c not in (None,-1))/max(1,sum(1 for c in cols if c is not None))
    rowpur=sum(1 for c in rows if c not in (None,-1))/max(1,sum(1 for c in rows if c is not None))
    return runs(cols), runs(rows), colpur, rowpur, cols
def analyse(layers):
    body_l, body_b = layers["b"]
    bpx = pixels(body_l, body_b, (4,10,34,52))
    allpx = pixels(body_l, body_b)
    cl = clusters(allpx)
    # merge shades of one colour (a shaded navy and a black are one colour to the eye)
    merged = []
    for c, sh in cl:
        for m in merged:
            if dE(c, m[0]) < 28 and name(c) in (name(m[0]),) or dE(c, m[0]) < 16:
                m[1] += sh; break
        else: merged.append([c, sh])
    merged.sort(key=lambda t: -t[1])
    cl = [(c, s) for c, s in merged]
    sig = [c for c in cl if c[1] >= 0.12][:3] or cl[:1]
    shirt = cl[0][0]
    arms = pixels(*layers["la"]) + pixels(*layers["ra"])
    acl = clusters(arms) if arms else [(shirt,1)]
    sleeve = acl[0][0]
    shorts = clusters(pixels(*layers["sh"]))[0][0]
    socks = clusters(pixels(*layers["so"]))[0][0]
    minor = [c for c in cl[1:] if c[1] >= 0.025 and dE(c[0], shirt) > 18]
    kind = "plain"
    second = None
    if len(sig) >= 2:
        cr, rr, cp, rp, cols = structure(bpx, sig, 38, 59)
        second = sig[1][0]
        if cp >= 0.85 and cr >= 4 and cr > 2 * rr: kind = "pinstripes" if sig[1][1] < 0.22 else "stripes"
        elif rp >= 0.85 and rr >= 4 and rr > 2 * cr: kind = "hoops"
        elif cp >= 0.8 and cr in (1, 2) and rr <= 1: kind = "halves" if cr == 1 else "centre stripe"
        elif rp >= 0.8 and rr in (1, 2) and cr <= 1: kind = "band"
        else: kind = "graphic"
    sleeve_contrast = dE(sleeve, shirt) > 25
    if kind == "plain" and sleeve_contrast: kind = "sleeves"
    # trim: the second colour a viewer reads
    if kind in ("pinstripes","stripes","hoops","halves","centre stripe","band","graphic") and second is not None: trim = second
    elif kind == "sleeves": trim = sleeve
    elif minor: trim = minor[0][0]
    elif dE(shorts, shirt) > 25: trim = shorts
    else: trim = None
    return dict(shirt=shirt, trim=trim, sleeve=sleeve, shorts=shorts, socks=socks, kind=kind,
                sig=[(hx(c), round(s,3)) for c,s in sig], minor=[(hx(c), round(s,3)) for c,s in minor[:3]])
def words(a):
    s=name(a["shirt"]); t=name(a["trim"]) if a["trim"] is not None else None
    k=a["kind"]
    if k=="plain": return f"{s.capitalize()}" + (f" with {t} trim" if t and t!=s else "")
    if k=="sleeves": return f"{s.capitalize()} with {t} sleeves"
    if k == "pinstripes": return f"{s.capitalize()} with thin {t} stripes"
    if k in ("stripes","hoops"): return f"{s.capitalize()} and {t} {k}"
    if k=="halves": return f"{s.capitalize()} and {t} halves"
    if k=="centre stripe": return f"{s.capitalize()} with a {t} centre stripe"
    if k=="band": return f"{s.capitalize()} with a {t} chest band"
    return f"{s.capitalize()} with a {t} graphic pattern" if t and t!=s else s.capitalize()
if __name__=="__main__":
    out={}
    for n,r in raw.items():
        if not r.get("text"): out[n]=None; continue
        out[n]={"title":r["title"]}
        for i,side in ((1,"home"),(2,"away")):
            kit,im,layers=compose(r["text"],i)
            a=analyse(layers)
            out[n][side]=dict(infobox=kit, words=words(a), kind=a["kind"], shirt=hx(a["shirt"]),
              trim=hx(a["trim"]) if a["trim"] is not None else None, sleeves=hx(a["sleeve"]), shorts=hx(a["shorts"]),
              socks=hx(a["socks"]), shirtName=name(a["shirt"]), trimName=name(a["trim"]) if a["trim"] is not None else None,
              shortsName=name(a["shorts"]), socksName=name(a["socks"]), sig=a["sig"], minor=a["minor"])
            im.save(f"kitimg/{n.replace('/','_')}_{side}.png")
        print(n, out[n]["home"]["words"], "|", out[n]["away"]["words"], flush=True)
    json.dump(out, open("analysed.json","w"), indent=1, ensure_ascii=False)
