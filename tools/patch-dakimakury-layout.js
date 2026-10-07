#!/usr/bin/env node
/* Переводить уже згенеровані сторінки /dakimakury/ на нову розкладку:
   без верхнього блоку з розмірами, каталог у лівій колонці, картки без цін і кнопок.
   Запуск із кореня сайту:  node tools/patch-dakimakury-layout.js
   Повторний запуск нічого не ламає: уже оновлені сторінки пропускаються.
   Якщо сторінки заново збирає tools/build-dakimakury.js, ту саму розмітку треба перенести в його шаблон,
   інакше після наступної збірки цей скрипт доведеться запустити ще раз. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'dakimakury');
global.window = {};
require(path.join(ROOT, 'data.js'));
const D = global.window.DAKI_DATA, S = require(path.join(ROOT, 'shared.js'));

const byKey = (list, k) => list.findIndex(c => c.k === String(k || '').toLowerCase());
const pick = (html, re, name, file) => { const m = html.match(re); if (!m) throw new Error(file + ': не знайдено ' + name); return m[0]; };

function patch(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('class="layout"')) return false;
  const page = JSON.parse(pick(html, /window\.DAKI_PAGE=(\{.*?\});/, 'DAKI_PAGE', file).replace(/^window\.DAKI_PAGE=|;$/g, ''));
  const col = byKey(D.cols, page.g);
  const sec = col >= 0 ? D.cols[col].s : byKey(D.secs, page.s);

  const from = html.indexOf('<section class="hero">');
  const countRe = /<p class="count" id="count"[^>]*>[^<]*<\/p>/;
  const count = pick(html, countRe, 'count', file);
  const to = html.indexOf(count) + count.length;
  if (from < 0 || to < from) throw new Error(file + ': не знайдено верхній блок');
  const head = html.slice(from, to);
  const crumbs = pick(head, /<nav class="crumbs" id="crumbs"[\s\S]*?<\/nav>/, 'crumbs', file);
  const h1 = pick(head, /<h1 id="h1">[\s\S]*?<\/h1>/, 'h1', file);
  const tops = pick(head, /<div class="tops" id="tops">[\s\S]*?<\/div>/, 'tops', file);
  const now = col >= 0 ? D.cols[col].t : sec >= 0 ? D.secs[sec].t : 'Каталог';

  const top = `<div class="layout">
    <div class="shade" id="shade"></div>
    <aside class="side" id="side" aria-label="Каталог дакімакур">
      <div class="side-head"><b>Каталог</b><button class="side-x" id="sideClose" type="button" aria-label="Закрити каталог">×</button></div>
      <nav class="tree" id="tree" aria-label="Розділи й колекції">${S.tree(D, sec, col)}</nav>
      <div class="side-foot"><button class="btn wide" id="sideShow" type="button">Показати дизайни</button></div>
    </aside>

    <div class="main">
      ${crumbs}
      ${h1}
      <div class="bar">
        <button class="catbtn" id="sideOpen" type="button" aria-controls="side" aria-expanded="false"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg><span id="sideNow">${S.esc(now)}</span></button>
        <input class="search" id="search" type="search" placeholder="Пошук персонажа" aria-label="Пошук персонажа">
      </div>
      ${tops}
      ${count}
`;
  html = html.slice(0, from) + top + html.slice(to);
  html = html.replace(/\n\s*<div class="buyrow">[\s\S]*?<\/div>(?=\s*<\/article>)/g, '');
  const more = '<div class="more" id="more"></div>';
  if (!html.includes(more)) throw new Error(file + ': не знайдено блок «Показати ще»');
  html = html.replace(more, more + '\n    </div>\n  </div>');
  fs.writeFileSync(file, html);
  return true;
}

let done = 0, skipped = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html') patch(p) ? done++ : skipped++;
  }
})(ROOT);
console.log(`Оновлено сторінок: ${done}, уже були оновлені: ${skipped}`);
