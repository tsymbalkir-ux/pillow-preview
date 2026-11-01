#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Збирає каталог картонних ростових фігур /rostovi-figury/ з tools/rostovi-src.json.

  python3 tools/build-rostovi.py

Пише: rostovi-figury/index.html (усі), сторінки розділів і колекцій, rostovi-figury/data.js (усі фігури,
браузер довантажує для «Показати ще» і пошуку), rostovi-figury/sitemap.xml.
Шаблон сторінки: tools/rostovi-page.html. Мініатюри: img/rf/<id>.webp (tools/rostovi-measure.py).
"""
import os, re, json, html, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
OUT = os.path.join(ROOT, 'rostovi-figury'); BASE = '/rostovi-figury/'; ORIGIN = 'https://printme.world'
SRC = json.load(open(os.path.join(HERE, 'rostovi-src.json')))
TPL = open(os.path.join(HERE, 'rostovi-page.html'), encoding='utf-8').read()
V = SRC['v'] + '-' + str(len(SRC['items']))
STATIC = 48
PHOTO = 'https://pub-a68eca237e8e4425b76226cdb7c2ca73.r2.dev/brand/{id}_cardboard_{v}.jpg'

CUR, EXP, FP = ' aria-current="true"', ' aria-expanded="true"', ' fetchpriority="high"'
esc = lambda s: html.escape(str(s), quote=True)
money = lambda n: f'{n:,}'.replace(',', ' ') + ' ₴'
def plural(n, a, b, c):
    n1 = n % 10; n2 = n % 100
    return a if n1 == 1 and n2 != 11 else b if 2 <= n1 <= 4 and not 12 <= n2 <= 14 else c
figs = lambda n: f'{n} {plural(n, "фігура", "фігури", "фігур")}'
TR = dict(zip('абвгґдеєжзиіїйклмнопрстуфхцчшщьюяё', ['a','b','v','h','g','d','e','ye','zh','z','y','i','yi','y','k','l','m','n','o','p','r','s','t','u','f','kh','ts','ch','sh','shch','','yu','ya','e']))
def slug(s):
    s = ''.join(TR.get(ch, ch) for ch in s.lower()).replace('&', ' i ')
    import unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

# ---------- розділи й колекції ----------
SECS = [  # ключ, назва, адреса, заголовок H1
    ('anime', 'Аніме', 'anime', 'Ростові фігури аніме-персонажів'),
    ('movies', 'Кіно й мультфільми', 'kino-y-multfilmy', 'Ростові фігури героїв кіно й мультфільмів'),
    ('stars', 'Актори', 'aktory', 'Ростові фігури акторів'),
    ('music', 'Музиканти', 'muzykanty', 'Ростові фігури музикантів'),
    ('kpop', 'K-pop', 'k-pop', 'Ростові фігури K-pop айдолів'),
    ('sport', 'Спорт', 'sport', 'Ростові фігури спортсменів'),
]
items = SRC['items']
secIdx = {k: i for i, (k, *_) in enumerate(SECS)}
for it in items: it['si'] = secIdx[it['s']]
# колекції: лише там, де в розділі їх більше однієї
cols = []; colIdx = {}
used = {p for _, _, p, _ in SECS}
for si, (sk, st, sp, _) in enumerate(SECS):
    names = []
    for it in items:
        if it['s'] == sk and it['c'] not in names: names.append(it['c'])
    if len(names) < 2:
        for it in items:
            if it['s'] == sk: it['ci'] = -1
        continue
    # більші колекції першими, «Інше аніме» в кінці
    cnt = {n: sum(1 for it in items if it['s'] == sk and it['c'] == n) for n in names}
    names.sort(key=lambda n: (n.startswith('Інше') or n == 'K-pop', -cnt[n], n))
    for n in names:
        p = slug(n) or 'c'
        if p in used: p = slug(st) + '-' + p
        used.add(p); colIdx[(sk, n)] = len(cols)
        cols.append(dict(t=n, s=si, p=p, n=cnt[n]))
for it in items:
    if 'ci' not in it: it['ci'] = colIdx[(it['s'], it['c'])]
nSec = [sum(1 for it in items if it['si'] == i) for i in range(len(SECS))]

# порядок на сторінці «Усі»: по черзі з кожного розділу, щоб одразу було видно різноманіття
def mixed(lst):
    by = [[it for it in lst if it['si'] == i] for i in range(len(SECS))]; out = []
    while any(by):
        for b in by:
            if b: out.append(b.pop(0))
    return out

def short_col(it):
    return SECS[it['si']][1] if it['ci'] < 0 else cols[it['ci']]['t']
def full_name(it):
    return it['n'] + (f', {cols[it["ci"]]["t"]}' if it['ci'] >= 0 and not cols[it['ci']]['t'].startswith('Інше') and cols[it['ci']]['t'] != 'K-pop' else '')

def card(it, i):
    lazy = 'eager' if i < 4 else 'lazy'
    return (f'<article class="card" data-id="{it["id"]}"><button class="pic" type="button" aria-label="Відкрити: ростова фігура {esc(full_name(it))}">'
            f'<img src="/img/rf/{it["id"]}.webp" width="360" height="480" alt="Ростова фігура {esc(full_name(it))} з картону" loading="{lazy}" decoding="async"'
            f'{FP if i < 2 else ""}></button>'
            f'<div class="meta"><span class="name">{esc(it["n"])}</span><span class="sub">{esc(short_col(it))}</span>'
            f'<span class="price">{money(it["p"])}<small> · {it["h"]}×{it["w"]} см</small></span></div></article>')

def tree(cur_s, cur_c):
    out = [f'<a class="t-row" href="{BASE}"{CUR if cur_s < 0 else ""}><span>Усі фігури</span><span class="n">{len(items)}</span></a>']
    for si, (sk, st, sp, _) in enumerate(SECS):
        sc = [c for c in cols if c['s'] == si]; open_ = si == cur_s and sc
        cur = ' aria-current="true"' if si == cur_s and cur_c < 0 else ''
        row = f'<a class="t-row" href="{BASE}{sp}/"{EXP if open_ else ""}{cur}><span>{esc(st)}</span><span class="n">{nSec[si]}</span></a>'
        if open_:
            row += '<ul class="t-cols">' + ''.join(
                f'<li><a class="t-col" href="{BASE}{c["p"]}/"{CUR if cols.index(c) == cur_c else ""}><span>{esc(c["t"])}</span><span class="n">{c["n"]}</span></a></li>' for c in sc) + '</ul>'
        out.append(f'<div class="t-sec{" open" if open_ else ""}">{row}</div>')
    return ''.join(out)

def page(path, lst, cur_s, cur_c, h1, title, desc, crumbs, tops, links_h, links):
    ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': h1, 'url': ORIGIN + path, 'inLanguage': 'uk',
          'mainEntity': {'@type': 'ItemList', 'numberOfItems': len(lst), 'itemListElement': [
              {'@type': 'ListItem', 'position': i + 1, 'item': {'@type': 'Product', 'name': 'Ростова фігура ' + full_name(it),
               'image': ORIGIN + f'/img/rf/{it["id"]}.webp', 'category': short_col(it), 'material': 'Картон',
               'offers': {'@type': 'Offer', 'price': it['p'], 'priceCurrency': 'UAH', 'availability': 'https://schema.org/MadeToOrder', 'url': ORIGIN + path}}}
              for i, it in enumerate(lst[:24])]}}
    first = lst[0]['id'] if lst else ''
    rep = {
        'TITLE': esc(title), 'DESC': esc(desc), 'URL': ORIGIN + path, 'H1': esc(h1), 'V': V,
        'OGIMG': ORIGIN + f'/img/rf/{first}.webp', 'PRELOAD': f'<link rel="preload" as="image" href="/img/rf/{first}.webp" fetchpriority="high">' if first else '',
        'LD': '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>',
        'TREE': tree(cur_s, cur_c), 'CRUMBS': crumbs, 'NOW': esc(cols[cur_c]['t'] if cur_c >= 0 else SECS[cur_s][1] if cur_s >= 0 else 'Каталог'),
        'TOPS': tops, 'COUNT': 'Фігур: ' + str(len(lst)), 'CARDS': '\n'.join(card(it, i) for i, it in enumerate(lst[:STATIC])),
        'MORE': f'<button class="btn ghost" id="moreBtn" type="button">Показати ще</button>' if len(lst) > STATIC else '',
        'LINKS': (f'<h2>{esc(links_h)}</h2><ul>' + ''.join(f'<li><a href="{h}">{esc(t)}</a></li>' for h, t in links) + '</ul>') if links else '',
        'LINKSHIDDEN': '' if links else ' hidden',
        'PAGE': json.dumps({'s': cur_s, 'c': cur_c, 'n': len(lst), 'v': V}),
    }
    s = TPL
    for k, v in rep.items(): s = s.replace('{{' + k + '}}', v)
    assert '{{' not in s, re.findall(r'\{\{\w+\}\}', s)
    d = os.path.join(ROOT, path.strip('/')); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(s)
    return path

# ---------- чистимо стару збірку (крім файлів, які пишемо руками) ----------
KEEP = {'catalog.js', 'catalog.css'}
if os.path.isdir(OUT):
    for n in os.listdir(OUT):
        if n in KEEP: continue
        p = os.path.join(OUT, n)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
os.makedirs(OUT, exist_ok=True)

crumb = lambda parts: '<a href="/">printme</a><span class="sep">/</span>' + '<span class="sep">/</span>'.join(
    f'<a href="{h}">{esc(t)}</a>' if h else f'<span aria-current="page">{esc(t)}</span>' for h, t in parts)
chip = lambda h, t, n, cur=False: f'<a href="{h}"{CUR if cur else ""}>{esc(t)}<span class="n">{n}</span></a>'
urls = []
P1590 = '1 590'
# усі
urls.append(page(BASE, mixed(items), -1, -1, 'Ростові фігури з картону',
    'Ростові фігури з картону — купити від 1 590 грн | printme',
    f'Картонні ростові фігури в повний зріст: аніме, актори, музиканти, K-pop, спорт. {len(items)} готових дизайнів, від {P1590} грн, складана підставка, доставка по Україні.',
    crumb([(None, 'Ростові фігури')]),
    ''.join(chip(f'{BASE}{sp}/', st, nSec[i]) for i, (_, st, sp, _) in enumerate(SECS)),
    'Розділи каталогу', [(f'{BASE}{sp}/', st) for _, st, sp, _ in SECS]))
for si, (sk, st, sp, h1) in enumerate(SECS):
    lst = [it for it in items if it['si'] == si]; sc = [c for c in cols if c['s'] == si]
    tops = ''.join(chip(f'{BASE}{c["p"]}/', c['t'], c['n']) for c in sc[:14])
    urls.append(page(f'{BASE}{sp}/', lst, si, -1, h1, f'{h1} з картону — від {P1590} грн | printme',
        f'{h1}: {figs(len(lst))} з картону в повний зріст, від {P1590} грн. Складана підставка, доставка Новою Поштою, оплата при отриманні.',
        crumb([(BASE, 'Ростові фігури'), (None, st)]), tops,
        f'Усі колекції розділу «{st}»' if sc else '', [(f'{BASE}{c["p"]}/', c['t']) for c in sc]))
    for c in sc:
        ci = cols.index(c); cl = [it for it in lst if it['ci'] == ci]
        h = f'Ростові фігури {c["t"]}' if not c['t'].startswith('Інше') else f'Ростові фігури: {c["t"].lower()}'
        sib = [x for x in sc if x is not c][:14]
        urls.append(page(f'{BASE}{c["p"]}/', cl, si, ci, h, f'{h} з картону — від {P1590} грн | printme',
            f'{h}: {figs(len(cl))} з картону в повний зріст, від {P1590} грн. Складана підставка, доставка по Україні, оплата при отриманні.',
            crumb([(BASE, 'Ростові фігури'), (f'{BASE}{sp}/', st), (None, c['t'])]),
            ''.join(chip(f'{BASE}{x["p"]}/', x['t'], x['n']) for x in sib),
            f'Інші колекції розділу «{st}»', [(f'{BASE}{x["p"]}/', x['t']) for x in sc if x is not c]))

# ---------- дані для браузера ----------
D = {'v': V, 'secs': [{'t': st, 'p': sp} for _, st, sp, _ in SECS], 'cols': [{'t': c['t'], 's': c['s'], 'p': c['p']} for c in cols],
     'items': [[int(it['id']), it['si'], it['ci'], it['n'], it['h'], it['w'], it['p']] for it in items]}
open(os.path.join(OUT, 'data.js'), 'w', encoding='utf-8').write(
    '/* Дані каталогу ростових фігур. Файл генерує tools/build-rostovi.py, руками не редагувати.\n'
    '   Рядок: [id товару Prom, № розділу, № колекції (-1 = без колекції), назва, висота см, ширина см, ціна грн] */\n'
    'window.RF_DATA=' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(OUT, 'sitemap.xml'), 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ''.join(f'  <url><loc>{ORIGIN}{u}</loc><changefreq>weekly</changefreq></url>\n' for u in urls) + '</urlset>\n')
# мініатюри, яких уже немає в каталозі, прибираємо
ids = {it['id'] for it in items}; gone = 0
for n in os.listdir(os.path.join(ROOT, 'img', 'rf')):
    if n.split('.')[0] not in ids: os.remove(os.path.join(ROOT, 'img', 'rf', n)); gone += 1
miss = [i for i in ids if not os.path.exists(os.path.join(ROOT, 'img', 'rf', i + '.webp'))]
print(f'Фігур: {len(items)}, розділів: {len(SECS)}, колекцій: {len(cols)}, сторінок: {len(urls)}; мініатюр прибрано: {gone}; без мініатюри: {len(miss)}')
