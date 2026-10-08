#!/usr/bin/env node
/* Збирає каталог дакімакур: dakimakury/data.js, усі статичні сторінки та dakimakury/sitemap.xml.

     node tools/build-dakimakury.js

   Звідки дані:   tools/dakimakury-src.json   (його пише tools/import-prom.py з вигрузки Prom)
   Шаблон:        tools/dakimakury-page.html
   Тексти й адреси сторінок рахує dakimakury/shared.js, той самий файл, що працює в браузері,
   тому статичний HTML і те, що домальовує скрипт, збігаються.
   Папки розділів, колекцій і персонажів у dakimakury/ скрипт щоразу створює заново. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'dakimakury');
const S = require(path.join(OUT, 'shared.js'));
const SRC = JSON.parse(fs.readFileSync(path.join(__dirname, 'dakimakury-src.json'), 'utf8'));
const TPL = fs.readFileSync(path.join(__dirname, 'dakimakury-page.html'), 'utf8');

const STATIC_CARDS = 48;     // стільки ж карток показує catalog.js одразу після завантаження
const LD_ITEMS = 24;         // товарів у розмітці для пошуковика
const SUBS_SHOWN = 14;       // підкатегорій у рядку над сіткою
const PRICES = [1100, 2390];

/* ---------- дані для браузера ---------- */
const secIdx = {}; SRC.secs.forEach((s, i) => { secIdx[s.k] = i; });
const colIdx = {}; SRC.cols.forEach((c, i) => { colIdx[c.k] = i; });
const D = {
  v: SRC.v,
  secs: SRC.secs,
  cols: SRC.cols.map(c => {
    const o = { k: c.k, t: c.t, h: c.h, s: secIdx[c.s], top: c.top || [], p: c.p };
    if (c.subs && c.subs.length) { o.subs = c.subs; o.sp = c.sp; o.sl = c.sl; }
    return o;
  }),
  items: SRC.items.map(([id, c, name, ru, pics, sold, label, k, orig, og]) => {
    /* фото одного товару майже завжди мають однакову назву файлу, тоді пишемо її один раз */
    const parts = pics.map(p => /^(\d+)_(.+)$/.exec(p));
    const packed = parts.every(m => m && m[2] === parts[0][2]) ? parts.map(m => m[1]).join(',') + '|' + parts[0][2] : pics;
    const row = [/^\d{1,15}$/.test(id) ? +id : id, colIdx[c], name, ru, packed, sold || 0, label || '', k == null ? -1 : k, orig || [], og || 0];
    /* порожній хвіст рядка не пишемо: без оригіналу, без підкатегорії, без підпису */
    if (!row[9]) row.pop();
    if (row.length === 9 && !row[8].length) row.pop();
    if (row.length === 8 && row[7] === -1) row.pop();
    if (row.length === 7 && !row[6]) row.pop();
    return row;
  }),
};
fs.writeFileSync(path.join(OUT, 'data.js'),
  '/* Дані каталогу з адресами сторінок. Файл генерує tools/build-dakimakury.js, руками не редагувати.\n' +
  '   Рядок: [id товару Prom, № колекції, назва, слова для пошуку, фото, продано, підпис, № підкатегорії, [оригінали принта], скільки оригіналів у галереї] */\n' +
  'window.DAKI_DATA=' + JSON.stringify(D) + ';\n');

/* ---------- допоміжне ---------- */
const esc = S.esc;
const attr = s => esc(s).replace(/'/g, '&#39;');
const picUrl = p => /^https?:/.test(p) ? p : `https://images.prom.ua/${p}.jpg`;
const sized = (url, w, h) => url.replace(/(\/\d+)_/, `$1_w${w}_h${h}_`);
const firstPic = it => { const p = it[4]; if (typeof p === 'string') { const [n, t] = p.split('|'); return n.split(',')[0] + '_' + t; } return p[0]; };
const times = n => { const d = n % 10, h = n % 100; return n + (d >= 2 && d <= 4 && (h < 12 || h > 14) ? ' рази' : d === 1 && h !== 11 ? ' раз' : ' разів'); };
const subOf = it => (it[7] == null ? -1 : it[7]);
const labelOf = it => it[6] || D.cols[it[1]].t;

/* той самий порядок, що в catalog.js: за продажами, далі як у файлі */
const ORDERED = D.items.map((it, i) => [it, i]).sort((a, b) => (b[0][5] || 0) - (a[0][5] || 0) || a[1] - b[1]).map(x => x[0]);
function listFor(sec, col, sub) {
  return ORDERED.filter(it => (col >= 0 ? it[1] === col && (sub < 0 || subOf(it) === sub) : sec < 0 || D.cols[it[1]].s === sec));
}
const fill = (tpl, map) => tpl.replace(/\{\{([A-Z0-9]+)\}\}/g, (_, k) => { if (!(k in map)) throw new Error('у шаблоні немає значення для ' + k); return map[k]; });

function page(sec, col, sub) {
  if (col >= 0) sec = D.cols[col].s;
  const list = listFor(sec, col, sub), url = S.ORIGIN + S.pathFor(D, sec, col, sub);
  const h1 = S.h1(D, sec, col, sub), cr = S.crumbs(D, sec, col, sub);
  const ld = [];
  ld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: cr.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.t, item: S.ORIGIN + c.href })) });
  ld.push({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url, inLanguage: 'uk',
    mainEntity: { '@type': 'ItemList', numberOfItems: list.length,
      itemListElement: list.slice(0, LD_ITEMS).map((it, i) => ({ '@type': 'ListItem', position: i + 1, item: {
        '@type': 'Product', name: 'Дакімакура ' + it[2], image: picUrl(firstPic(it)), category: D.cols[it[1]].t,
        offers: { '@type': 'AggregateOffer', priceCurrency: 'UAH', lowPrice: PRICES[0], highPrice: PRICES[1], offerCount: 4,
          availability: 'https://schema.org/MadeToOrder', url } } })) } });

  const cards = list.slice(0, STATIC_CARDS).map((it, i) => `<article class="card" data-id="${it[0]}">
      <div class="pic">${(it[5] || 0) >= 3 ? `<span class="hit">Купили ${times(it[5])}</span>` : ''}<div class="track"><img src="${attr(sized(picUrl(firstPic(it)), 640, 640))}" alt="Дакімакура ${attr(it[2])}" width="640" height="640" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer"></div></div>
      <div class="meta"><span class="name">${esc(it[2])}</span><span class="sub">${esc(labelOf(it))}</span></div>
    </article>`).join('\n') + '\n';

  let tops = '';
  const c = col >= 0 ? D.cols[col] : null;
  if (c && c.subs && c.subs.length) {
    const n = c.subs.map(() => 0);
    D.items.forEach(it => { if (it[1] === col && subOf(it) >= 0) n[subOf(it)]++; });
    let ids = c.subs.map((_, i) => i).slice(0, SUBS_SHOWN);
    if (sub >= SUBS_SHOWN) ids.push(sub);
    tops = `<span>${esc(c.sl || 'Підкатегорія')}:</span>` + ids.map(i =>
      `<a href="${S.pathFor(D, -1, col, i)}"${sub === i ? ' aria-current="true"' : ''}>${esc(c.subs[i])} <span class="n">${n[i]}</span></a>`).join('');
  }
  const links = S.links(D, sec, sub >= 0 ? col : col);
  const pageCtx = col >= 0 ? (sub >= 0 ? { g: c.k, sub: c.subs[sub] } : { g: c.k }) : sec >= 0 ? { s: D.secs[sec].k } : {};
  return fill(TPL, {
    TITLE: esc(S.title(D, sec, col, sub)), DESC: attr(S.description(D, sec, col, sub)), URL: url, H1: esc(h1),
    OGIMG: list.length ? attr(picUrl(firstPic(list[0]))) : '', V: D.v,
    LD: ld.map(o => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>').join('\n'),
    TREE: S.tree(D, sec, col, { compact: sub >= 0 }),
    CRUMBS: cr.length > 1 ? cr.map((x, i) => i === cr.length - 1 ? `<span aria-current="page">${esc(x.t)}</span>` : `<a href="${x.href}">${esc(x.t)}</a>`).join('<span class="sep">/</span>') : '',
    NOW: esc(c ? c.t : sec >= 0 ? D.secs[sec].t : 'Каталог'), TOPS: tops, COUNT: 'Дизайнів: ' + list.length, CARDS: cards,
    LINKSHIDDEN: links.list.length ? '' : ' hidden',
    LINKS: links.list.length ? `<h2>${esc(links.title)}</h2><ul>${links.list.map(x => `<li><a href="${x.href}">${esc(x.t)}</a></li>`).join('')}</ul>` : '',
    PAGE: JSON.stringify(pageCtx).replace(/</g, '\\u003c'),
  });
}
function redirectPage(to) {
  return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8">
<title>Сторінка переїхала</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${S.ORIGIN + to}">
<script>location.replace(${JSON.stringify(to)} + location.search);</script>
<meta http-equiv="refresh" content="0; url=${to}">
</head>
<body>
<p>Сторінка переїхала: <a href="${to}">${S.ORIGIN.replace('https://', '') + to}</a></p>
</body>
</html>
`;
}

/* ---------- запис ---------- */
for (const e of fs.readdirSync(OUT, { withFileTypes: true })) if (e.isDirectory()) fs.rmSync(path.join(OUT, e.name), { recursive: true });
const urls = [];
function write(rel, html, indexed) {
  const dir = path.join(OUT, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  if (indexed) urls.push(S.BASE + (rel ? rel + '/' : ''));
}
const relOf = p => p.slice(S.BASE.length).replace(/\/$/, '');
const taken = new Set();
function emit(sec, col, sub) {
  const rel = relOf(S.pathFor(D, sec, col, sub));
  if (taken.has(rel)) throw new Error('дві сторінки з однією адресою: ' + rel);
  taken.add(rel); write(rel, page(sec, col, sub), true);
}
emit(-1, -1, -1);
const nSec = D.secs.map(() => 0); D.items.forEach(it => { nSec[D.cols[it[1]].s]++; });
D.secs.forEach((s, i) => { if (nSec[i]) emit(i, -1, -1); });
D.cols.forEach((c, i) => {
  emit(-1, i, -1);
  (c.sp || []).forEach((p, k) => { if (p) emit(-1, i, k); });
});
let nRedir = 0;
for (const [from, to] of Object.entries(SRC.redirects || {})) {
  if (taken.has(from)) continue;
  write(from, redirectPage(S.BASE + to + '/'), false); nRedir++;
}
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => `  <url><loc>${S.ORIGIN + u}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n');
console.log(`Дизайнів: ${D.items.length}, колекцій: ${D.cols.length}, сторінок: ${urls.length}, перенаправлень: ${nRedir}`);
console.log('data.js: ' + (fs.statSync(path.join(OUT, 'data.js')).size / 1e6).toFixed(2) + ' МБ');
