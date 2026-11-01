#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ширина ростових фігур і мініатюри для каталогу /rostovi-figury/.

  python3 tools/rostovi-measure.py links_brand.csv

CSV: file;id;view;url (view: cardboard_front / cardboard_back / cardboard_combo).
Для кожної фігури бере фото ззаду (картонний силует) і лінійку висоти на ньому,
рахує ширину силуету в частках висоти, а з фото спереду робить мініатюру 360×480 (img/rf/<id>.webp).
Результат: tools/rostovi-widths.json {id: {bw, mt, mb, ...}}; ширина в см = висота × bw / (mb - mt).
Уже виміряні фігури пропускає, тож після нових товарів досить запустити ще раз.
"""
import csv, json, io, os, sys, urllib.request, concurrent.futures as cf
import numpy as np
from PIL import Image
rows=list(csv.DictReader(open(sys.argv[1],encoding='utf-8-sig'),delimiter=';'))
by={}
for r in rows: by.setdefault(r['id'],{})[r['view']]=r['url']
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTJ=os.path.join(ROOT,'tools','rostovi-widths.json'); TH=os.path.join(ROOT,'img','rf'); os.makedirs(TH,exist_ok=True)
res=json.load(open(OUTJ)) if os.path.exists(OUTJ) else {}
def get(u):
    for k in range(3):
        try: return Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 (printme catalog build)'}),timeout=40).read())).convert('RGB')
        except Exception as e: err=e
    raise err
def work(i):
    v=by[i]
    b=np.asarray(get(v['cardboard_back'])).astype(int)
    dark=b.sum(2)<300
    cols=dark[:,500:].sum(0); mx=500+int(cols.argmax())
    ys=np.where(dark[:,mx])[0]
    if cols.max()<300: return i,{'err':'no marker'}
    mt,mb=int(ys.min()),int(ys.max())
    m=(b[:,:,0]-b[:,:,2]>45)&(b[:,:,0]>110)
    m[:mt-6]=False; m[mb+4:]=False
    ys,xs=np.where(m)
    if len(xs)<500: return i,{'err':'no silhouette','n':int(len(xs))}
    x0,x1,y0,y1=int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())
    f=get(v['cardboard_front'])
    mp=mb-mt
    cx=(x0+x1)/2; w=max(mp*0.79,(x1-x0)+60); w=min(w,1200); h=w*4/3
    if h>1200: h=1200; w=900
    L=int(max(0,min(1200-w,cx-w/2))); T=int(max(0,min(1200-h,(mt+mb)/2-h/2)))
    f.crop((L,T,L+int(w),T+int(h))).resize((360,480),Image.LANCZOS).save(os.path.join(TH,f'{i}.webp'),quality=70,method=6)
    return i,{'bw':x1-x0+1,'mt':mt,'mb':mb,'mx':mx,'x0':x0,'x1':x1,'y0':y0,'y1':y1,'n':int(len(xs))}
todo=[i for i in by if i not in res]
print('todo',len(todo),flush=True)
with cf.ThreadPoolExecutor(24) as ex:
    for k,fu in enumerate(cf.as_completed([ex.submit(work,i) for i in todo])):
        try: i,r=fu.result(); res[i]=r
        except Exception as e: print('ERR',e,flush=True)
        if k%200==0:
            json.dump(res,open(OUTJ,'w')); print(k,flush=True)
json.dump(res,open(OUTJ,'w')); print('done',len(res))
