import re, html
D='/home/user/Tierlist/docs/plans/2026-10-15/'
def read(n): return open(D+n,encoding='utf-8').read().split('\n')

def esc(s): return html.escape(s,quote=False)

def inline(s, pre=None, bold=True):
    s=s.replace('\\|','|')
    if pre: s=pre(s)
    codes=[]
    def c(m):
        codes.append(m.group(1)); return '\x00%d\x00'%(len(codes)-1)
    s=re.sub(r'`([^`]+)`',c,s)
    s=esc(s)
    if bold:
        s=re.sub(r'(^|[\s(|])\*\*([A-Za-z0-9"\'(\[“].*?[^\s])\*\*',lambda m:m.group(1)+'<b>'+m.group(2)+'</b>',s)
    s=re.sub('\x00(\\d+)\x00',lambda m:'<code>'+esc(codes[int(m.group(1))])+'</code>',s)
    return s

def split_row(line):
    t=line.strip()
    t=t.replace('\\|','\x01')
    if t.startswith('|'): t=t[1:]
    if t.endswith('|'): t=t[:-1]
    return [c.strip().replace('\x01','\\|') for c in t.split('|')]

def is_sep(line):
    return bool(re.match(r'^\|[\s:\-|]+\|\s*$',line))

def table_html(block, pre=None):
    rows=[split_row(l) for l in block if not is_sep(l)]
    head,body=rows[0],rows[1:]
    n=len(head)
    nw = max(len(re.sub(r'`','',r[0])) for r in body)<=22 if body else False
    mw=0 if n<=3 else n*110
    h='<div class="tw"><table class="%s" style="min-width:%dpx"><tr>'%('nw' if nw else '',mw)
    h+=''.join('<th>%s</th>'%inline(x,pre) for x in head)+'</tr>'
    for r in body:
        r=r+['']*(n-len(r))
        h+='<tr>'+''.join('<td>%s</td>'%inline(x,pre) for x in r[:n])+'</tr>'
    h+='</table></div>'
    return h,len(body)

def render(lines, pre=None, skip_h=True):
    out=[];nrows=0;i=0
    while i<len(lines):
        l=lines[i]
        if l.startswith('```'):
            j=i+1;buf=[]
            while j<len(lines) and not lines[j].startswith('```'): buf.append(lines[j]); j+=1
            out.append('<div class="tw"><pre>%s</pre></div>'%esc('\n'.join(buf)));i=j+1;continue
        if l.startswith('|'):
            j=i;blk=[]
            while j<len(lines) and lines[j].startswith('|'): blk.append(lines[j]); j+=1
            h,n=table_html(blk,pre); out.append(h); nrows+=n; i=j; continue
        m=re.match(r'^(#{2,4})\s+(.*)',l)
        if m:
            if not skip_h: out.append('<h4>%s</h4>'%inline(m.group(2),pre))
            i+=1;continue
        if re.match(r'^\s*-\s+',l):
            j=i;items=[]
            while j<len(lines) and re.match(r'^\s*-\s+',lines[j]):
                items.append(re.sub(r'^\s*-\s+','',lines[j])); j+=1
            out.append('<ul>'+''.join('<li>%s</li>'%inline(x,pre) for x in items)+'</ul>'); i=j; continue
        if re.match(r'^\d+\.\s+',l):
            j=i;items=[]
            while j<len(lines) and re.match(r'^\d+\.\s+',lines[j]):
                items.append(re.sub(r'^\d+\.\s+','',lines[j])); j+=1
            out.append('<ol>'+''.join('<li>%s</li>'%inline(x,pre) for x in items)+'</ol>'); i=j; continue
        if l.strip()=='' or l.strip()=='---': i+=1; continue
        j=i;buf=[]
        while j<len(lines) and lines[j].strip() and not lines[j].startswith(('|','#','```')) and not re.match(r'^\s*-\s+',lines[j]) and not re.match(r'^\d+\.\s+',lines[j]) and lines[j].strip()!='---':
            buf.append(lines[j]); j+=1
        out.append('<p>%s</p>'%inline(' '.join(buf),pre)); i=j
    return '\n'.join(out),nrows

def sect(lines,start,end=None):
    s=next(i for i,l in enumerate(lines) if l.startswith(start))
    lvl=len(re.match(r'#*',lines[s]).group(0))
    e=len(lines)
    for j in range(s+1,len(lines)):
        if end is not None:
            if lines[j].startswith(end): e=j;break
        else:
            m=re.match(r'^(#+)\s',lines[j])
            if m and len(m.group(1))<=lvl: e=j;break
    return lines[s:e]
