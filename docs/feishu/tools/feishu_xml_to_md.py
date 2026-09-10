import json,re,sys,os,html
import xml.etree.ElementTree as ET

def load(name):
    d=json.load(open(f'{name}.xml.json'))['data']['document']
    return d['content'], d['document_id'], d['revision_id']

def inline(el, imgmap):
    """render element's text+children inline, return string"""
    out=[]
    if el.text: out.append(esc(el.text))
    for c in el:
        out.append(render_inline(c, imgmap))
        if c.tail: out.append(esc(c.tail))
    return ''.join(out)

def esc(s): return s

def render_inline(c, imgmap):
    t=c.tag
    if t=='b': return '**'+inline(c,imgmap).strip()+'**' if inline(c,imgmap).strip() else ''
    if t=='i': return '*'+inline(c,imgmap)+'*'
    if t=='a': return f'[{inline(c,imgmap)}]({c.get("href","")})'
    if t=='br': return '\n'
    if t=='code': return '`'+inline(c,imgmap)+'`'
    if t=='cite':
        title=c.get('title') or c.get('doc-id',''); did=c.get('doc-id',''); ft=c.get('file-type','docx')
        url=f'https://my.feishu.cn/{ft}/{did}' if did else ''
        return f'[{title}]({url})' if url else title
    if t=='img':
        src=c.get('src'); name=c.get('name') or src
        path=imgmap.get(src, f'https://feishu.cn/file/{src}')
        return f'![{name}]({path})'
    return inline(c,imgmap)

def cell(td, imgmap):
    parts=[]
    for ch in td:
        if ch.tag=='p': parts.append(inline(ch,imgmap))
        elif ch.tag in ('ul','ol'): parts.append(' / '.join('• '+inline(li,imgmap) for li in ch.findall('li')))
        elif ch.tag=='img': parts.append(render_inline(ch,imgmap))
        else: parts.append(inline(ch,imgmap))
    s='<br>'.join(p.strip() for p in parts if p.strip())
    return s.replace('\n','<br>').replace('|','\\|')

def block(el, imgmap, depth=0):
    t=el.tag; o=[]
    if t=='title': return ''
    if re.fullmatch(r'h\d',t):
        lvl=int(t[1]); return '#'*lvl+' '+inline(el,imgmap).strip()+'\n'
    if t=='p':
        s=inline(el,imgmap).strip(); return (s+'\n') if s else ''
    if t in ('ul','ol'):
        for i,li in enumerate(el.findall('li'),1):
            mark=f'{i}.' if t=='ol' else '-'
            # li may contain p and nested lists
            txt=[]; sub=[]
            if li.text and li.text.strip(): txt.append(li.text.strip())
            for ch in li:
                if ch.tag in ('ul','ol'): sub.append(block(ch,imgmap,depth+1))
                elif ch.tag=='p': txt.append(inline(ch,imgmap).strip())
                else: txt.append(render_inline(ch,imgmap))
                if ch.tail and ch.tail.strip(): txt.append(ch.tail.strip())
            o.append('  '*depth+f'{mark} '+' '.join(x for x in txt if x))
            for s in sub: o.append(s.rstrip('\n'))
        return '\n'.join(o)+'\n'
    if t=='callout':
        emoji=el.get('emoji','')
        lines=[]
        for ch in el:
            b=block(ch,imgmap).rstrip('\n')
            for ln in b.split('\n'): lines.append('> '+ln)
        if emoji and lines: lines[0]=lines[0].replace('> ','> '+emoji+' ',1)
        return '\n'.join(lines)+'\n'
    if t=='table':
        rows=[]
        for tr in el.iter('tr'):
            rows.append([cell(td,imgmap) for td in tr if td.tag in ('td','th')])
        if not rows: return ''
        n=max(len(r) for r in rows)
        rows=[r+['']*(n-len(r)) for r in rows]
        out=['| '+' | '.join(rows[0])+' |','|'+'---|'*n]
        for r in rows[1:]: out.append('| '+' | '.join(r)+' |')
        return '\n'.join(out)+'\n'
    if t=='pre':
        cap=el.get('caption','').strip(); lang=el.get('lang','') or ''
        code=el.find('code'); body=''
        if code is not None:
            body=inline(code,{}).replace('\n','\n')
        pre=(f'*{cap}*\n' if cap else '')
        return pre+f'```{lang if lang!="text" else ""}\n{body}\n```\n'
    if t=='img': return render_inline(el,imgmap)+'\n'
    # fallback
    return inline(el,imgmap)+'\n'

def convert(name, imgmap, title, url, extra_note=''):
    x,doc_id,rev=load(name)
    root=ET.fromstring('<root>'+x+'</root>')
    parts=[]
    for el in root:
        b=block(el,imgmap)
        if b: parts.append(b)
    body='\n'.join(parts)
    fm=f'''---
title: "{title}"
source: {url}
document_id: {doc_id}
revision_id: {rev}
fetched: 2026-09-08
fetched_via: lark-cli docs +fetch --doc-format xml
{extra_note}---

# {title}

'''
    return fm+body, rev


import datetime
OUT=sys.argv[1]
DOCS=[('panorama','pan_imgmap.json','猫猫功能与页面全景清单','https://my.feishu.cn/docx/N0urdST5LojCWMxe5NycAKjInlg','猫猫功能与页面全景清单.md','assets/panorama/'),
      ('mech',None,'猫的个体差异机制','https://my.feishu.cn/docx/KODZdLGbUoobNMxHNXccxV2FnFd','猫的个体差异机制.md',None),
      ('prd','prd_imgmap.json','猫猫（暂名）产品需求文档｜方向草案 v0.2','https://my.feishu.cn/wiki/NSwzwJlf6iABKSklAQ8cA0WGnWb','猫猫产品需求文档-方向草案v0.2.md','assets/prd/')]
if len(sys.argv)>2 and sys.argv[2]=='refresh':
    DOCS=[(n,f'{n}_imgmap.json',t,u,f,a) for n,_,t,u,f,a in DOCS]
for name,mapf,title,url,fn,adir in DOCS:
    im=json.load(open(mapf)) if mapf and os.path.exists(mapf) else {}
    note=f'assets: {adir} ({len(im)} 张，本地相对路径)\n' if im else ''
    md,rev=convert(name, im, title, url, note)
    md=md.replace('fetched: 2026-09-08', 'fetched: '+datetime.date.today().isoformat())
    open(f'{OUT}/{fn}','w').write(md); print(fn,'rev',rev,'chars',len(md))
