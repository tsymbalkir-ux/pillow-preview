/* Спільна логіка каталогу дакімакур: адреси сторінок, заголовки, тексти, хлібні крихти.
   Цей файл читає і браузер (перед catalog.js), і генератор tools/build-dakimakury.js,
   тому статичний HTML і те, що малює скрипт, завжди збігаються. */
(function (root) {
  var BASE = '/dakimakury/';
  var ORIGIN = 'https://printme.world';
  var HOME_H1 = 'Дакімакури з готовим принтом';
  var MIN_PRICE = 1100;

  function plural(n, one, few, many) {
    var d = n % 10, h = n % 100;
    return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
  }
  function designs(n) { return n + ' ' + plural(n, 'дизайн', 'дизайни', 'дизайнів'); }
  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  /* рядок даних: [id, № колекції, назва, пошук, [фото], продано, підпис, № підкатегорії] */
  function count(D, sec, col, sub) {
    var n = 0;
    for (var i = 0; i < D.items.length; i++) {
      var it = D.items[i];
      if (col >= 0) { if (it[1] !== col) continue; if (sub >= 0 && it[7] !== sub) continue; }
      else if (sec >= 0 && D.cols[it[1]].s !== sec) continue;
      n++;
    }
    return n;
  }

  /* найточніша сторінка, яка існує для цього вибору */
  function pathFor(D, sec, col, sub) {
    if (col >= 0) {
      var c = D.cols[col];
      if (sub >= 0 && c.sp && c.sp[sub]) return BASE + c.p + '/' + c.sp[sub] + '/';
      return BASE + c.p + '/';
    }
    if (sec >= 0) return BASE + D.secs[sec].p + '/';
    return BASE;
  }
  function hasPage(D, col, sub) { return !(col >= 0 && sub >= 0) || !!(D.cols[col].sp && D.cols[col].sp[sub]); }

  function h1(D, sec, col, sub) {
    /* у збірних колекціях підкатегорія це окремий тайтл або гурт, назва колекції поруч нічого не додає */
    if (col >= 0 && sub >= 0) return 'Дакімакури ' + D.cols[col].subs[sub] + (/^(Тайтл|Гурт|Зірка|Гравець|Гонщик)$/.test(D.cols[col].sl) ? '' : ' (' + D.cols[col].t + ')');
    if (col >= 0) return D.cols[col].h;
    if (sec >= 0) return D.secs[sec].h;
    return HOME_H1;
  }
  function title(D, sec, col, sub) {
    return h1(D, sec, col, sub) + ': купити від ' + money(MIN_PRICE) + ' грн | printme';
  }
  var TAIL = 'Чотири розміри від 100×33 до 180×60 см, ціна від ' + money(MIN_PRICE) + ' ₴, оплата при отриманні.';
  function lead(D, sec, col, sub) {
    var n = count(D, sec, col, sub);
    if (col >= 0 && sub >= 0) return designs(n) + ' з принтом «' + D.cols[col].subs[sub] + '» у колекції ' + D.cols[col].t + '. ' + TAIL;
    if (col >= 0) {
      var s = (D.cols[col].subs || []).slice(0, 4);
      return designs(n) + (s.length >= 3 ? ': ' + s.join(', ') + ' та інші' : '') + '. ' + TAIL;
    }
    if (sec >= 0) {
      var names = D.cols.filter(function (c) { return c.s === sec && !/^(Інш|Різне)/.test(c.t); }).map(function (c) { return c.t; });
      return designs(n) + (names.length ? ': ' + names.slice(0, 5).join(', ') + (names.length > 5 ? ' та інші' : '') : '') + '. ' + TAIL;
    }
    return 'Подушки-обіймашки з персонажами, гуртами й мемами. Обери дизайн і розмір, оплата після того, як забереш посилку.';
  }
  function description(D, sec, col, sub) {
    var n = count(D, sec, col, sub);
    return h1(D, sec, col, sub) + ' з доставкою по Україні: ' + designs(n) +
      ', розміри від 100 до 180 см, друк на габардині, оплата при отриманні на Новій Пошті.';
  }
  function crumbs(D, sec, col, sub) {
    var out = [{ t: 'Дакімакури', href: BASE }];
    if (col >= 0) sec = D.cols[col].s;
    if (sec >= 0) out.push({ t: D.secs[sec].t, href: pathFor(D, sec, -1, -1) });
    if (col >= 0) out.push({ t: D.cols[col].t, href: pathFor(D, -1, col, -1) });
    if (col >= 0 && sub >= 0) out.push({ t: D.cols[col].subs[sub], href: pathFor(D, -1, col, sub) });
    return out;
  }

  /* блок посилань під каталогом: усі сторінки рівнем нижче */
  function links(D, sec, col) {
    if (col >= 0) {
      var c = D.cols[col], list = [];
      (c.subs || []).forEach(function (t, i) { if (c.sp && c.sp[i]) list.push({ t: t, href: pathFor(D, -1, col, i) }); });
      return { title: ({ 'Бренд': 'Усі бренди', 'Тайтл': 'Усі тайтли', 'Гурт': 'Усі гурти', 'Зірка': 'Усі зірки', 'Гравець': 'Усі гравці',
        'Гонщик': 'Усі гонщики', 'Марка': 'Усі марки' }[c.sl] || 'Усі персонажі') + ': ' + c.t, list: list };
    }
    var cols = [];
    D.cols.forEach(function (c, i) { if (sec < 0 || c.s === sec) cols.push({ t: c.t, href: pathFor(D, -1, i, -1) }); });
    return { title: sec >= 0 ? 'Усі колекції розділу «' + D.secs[sec].t + '»' : 'Усі колекції', list: cols };
  }

  /* ---------- дерево каталогу (ліва колонка, на телефоні висувна панель) ----------
     Розділи, під відкритим розділом його колекції, на головній ще й десять найпопулярніших. */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  var statsFor = null, statsVal = null;
  function stats(D) {
    if (D.st) return D.st;                 // браузер: пораховано заздалегідь у meta.js, бо товари вантажаться пізніше
    if (statsFor === D) return statsVal;
    var nCol = D.cols.map(function () { return 0; }), uCol = nCol.slice(), nSec = D.secs.map(function () { return 0; });
    D.items.forEach(function (it) { nCol[it[1]]++; uCol[it[1]] += it[5] || 0; nSec[D.cols[it[1]].s]++; });
    statsFor = D; statsVal = { nCol: nCol, uCol: uCol, nSec: nSec };
    return statsVal;
  }
  var MISC = /^(anime2|games2|movies2|misc|kpop)$/;
  function popular(D) {
    var st = stats(D);
    return D.cols.map(function (_, i) { return i; })
      .filter(function (i) { return st.nCol[i] && !MISC.test(D.cols[i].k); })
      .sort(function (a, b) { return st.uCol[b] - st.uCol[a]; }).slice(0, 10);
  }
  /* Колекції розділу: спершу збірна («Інше аніме»), далі всі за абеткою.
     opts.shut: розділ згорнуто (другий натиск на його назву), список колекцій не показуємо.
     opts.compact: у HTML кладемо лише поточну колекцію; так роблять статичні сторінки персонажів, щоб не носити
     в кожній сотню посилань, а скрипт після завантаження домальовує повний список. */
  function tree(D, sec, col, opts) {
    var st = stats(D); opts = opts || {};
    if (col >= 0) sec = D.cols[col].s;
    function row(cls, href, attr, t, n, on) {
      return '<a class="' + cls + '" href="' + href + '" ' + attr + (on ? ' aria-current="true"' : '') + '><span>' + esc(t) + '</span><span class="n">' + n + '</span></a>';
    }
    function li(i) { return '<li>' + row('t-col', pathFor(D, -1, i, -1), 'data-c="' + i + '"', D.cols[i].t, st.nCol[i], col === i) + '</li>'; }
    var out = row('t-row', BASE, 'data-s="-1"', 'Усі дизайни', D.st ? D.st.total : D.items.length, sec < 0);
    D.secs.forEach(function (s, i) {
      if (!st.nSec[i]) return;
      var open = sec === i, shut = open && !!opts.shut, ids = [], list = '';
      if (open && !shut) {
        D.cols.forEach(function (c, k) { if (c.s === i && st.nCol[k]) ids.push(k); });
        var misc = function (k) { return MISC.test(D.cols[k].k) ? 0 : 1; };
        ids.sort(function (a, b) { return misc(a) - misc(b) || D.cols[a].t.localeCompare(D.cols[b].t, 'uk', { sensitivity: 'base', numeric: true }); });
        if (opts.compact) ids = ids.filter(function (k) { return k === col; });
        if (ids.length) list = '<ul class="t-cols">' + ids.map(li).join('') + '</ul>';
      }
      out += '<div class="t-sec' + (open ? ' open' : '') + (shut ? ' shut' : '') + '">' +
        row('t-row', pathFor(D, i, -1, -1), 'data-s="' + i + '"' + (open ? ' aria-expanded="' + !shut + '"' : ''), s.t, st.nSec[i], open && col < 0) + list + '</div>';
    });
    if (sec < 0) out += '<div class="t-pop"><p class="t-lbl">Популярне</p><ul class="t-cols">' + popular(D).map(li).join('') + '</ul></div>';
    return out;
  }

  /* Рядок під заголовком: підкатегорії великої колекції з кількістю або «Часто шукають».
     Той самий HTML і в статичній сторінці, і в браузері. На телефоні видно 8 підкатегорій, на комп'ютері 14:
     зайві ховає CSS (.t-x), тож після завантаження скрипта нічого не стрибає.
     cnt: { n: [кількість у кожній підкатегорії], rest: без підкатегорії } */
  var TOPS_DESK = 14, TOPS_PHONE = 8;
  function topsHtml(D, col, sub, opts) {
    opts = opts || {};
    var c = col >= 0 ? D.cols[col] : null;
    if (c && c.subs && c.subs.length) {
      var cnt = opts.cnt || { n: c.sn || c.subs.map(function () { return 0; }), rest: c.sr || 0 };
      var len = c.subs.length, open = !!opts.open;
      var hidD = open ? 0 : Math.max(0, len - TOPS_DESK), hidP = open ? 0 : Math.max(0, len - TOPS_PHONE);
      var href = function (i) { return hasPage(D, col, i) ? pathFor(D, -1, col, i) : pathFor(D, -1, col, -1) + '?sub=' + encodeURIComponent(c.subs[i]); };
      var out = '<span>' + esc(c.sl || 'Підкатегорія') + ':</span>';
      for (var i = 0; i < len; i++) {
        if (!open && i >= TOPS_DESK && i !== sub) continue;
        var x = !open && i >= TOPS_PHONE && i !== sub ? ' class="t-x"' : '';
        out += '<a href="' + href(i) + '" data-k="' + i + '"' + x + (sub === i ? ' aria-current="true"' : '') + '>' + esc(c.subs[i]) + ' <span class="n">' + cnt.n[i] + '</span></a>';
      }
      if (cnt.rest && !hidD) out += '<button type="button" data-k="-2"' + (hidP ? ' class="t-x"' : '') + ' aria-pressed="' + (sub === -2) + '">Інші <span class="n">' + cnt.rest + '</span></button>';
      if (hidP) out += '<button type="button" data-more="1"' + (hidD ? '' : ' class="t-mo"') + '><span class="t-m">Ще ' + hidP + '</span>' + (hidD ? '<span class="t-d">Ще ' + hidD + '</span>' : '') + '</button>';
      return out;
    }
    var tops = c ? c.top || [] : [];
    if (!tops.length) return '';
    var nq = String(opts.q || '').toLowerCase().trim();
    return '<span>Часто шукають:</span>' + tops.map(function (t) {
      return '<button type="button" aria-pressed="' + (t.toLowerCase() === nq) + '">' + esc(t) + '</button>';
    }).join('');
  }

  /* ---------- товар і картка: однакові в статичному HTML і в браузері ---------- */
  var ORIG_HOST = 'https://i.ibb.co/';
  var sized = function (url, w, h) { return url.replace(/(\/\d+)_/, '$1_w' + w + '_h' + h + '_'); };
  /* рядок даних → товар. whole/pair: Set з id дизайнів зі старими фото (див. catalog.js) */
  function itemFromRow(D, r, whole, pair) {
    var id = String(r[0]), c = r[1], pics = r[4], o = r[8] || [], og = r[9] || 0;
    if (typeof pics === 'string') { var parts = pics.split('|'); pics = parts[0].split(',').map(function (n) { return n + '_' + parts[1]; }); }
    var prom = pics.map(function (p) { return /^https?:/.test(p) ? p : 'https://images.prom.ua/' + p + '.jpg'; });
    var orig = o.map(function (p) { return /^https?:/.test(p) ? p : ORIG_HOST + p; });
    return { id: id, whole: whole.has(id), pair: pair.has(id), c: c, name: r[2], ru: r[3] || '', sold: r[5] || 0, sub: r[6] || D.cols[c].t,
      label: r[6] || '', k: r[7] == null ? -1 : r[7], orig: orig, nProm: prom.length, pics: prom.concat(orig.slice(0, og || 1)) };
  }
  function mockHtml(src, name, lazy) {
    return '<span class="mock"><span class="mk"><span class="za"><img src="' + src + '" alt="Дакімакура ' + name + '" loading="' + lazy + '" decoding="async" referrerpolicy="no-referrer"></span><span class="zb"><img src="' + src + '" alt="" loading="' + lazy + '" decoding="async" referrerpolicy="no-referrer"></span></span></span>';
  }
  function cardHtml(it, idx) {
    var n = it.pics.length, lazy = idx < 4 ? 'eager' : 'lazy';
    var slides = it.pics.map(function (p, i) {
      if (i === 0) return it.pair ? mockHtml(sized(p, 640, 640), esc(it.name), lazy)
        : '<img ' + (it.whole ? 'class="whole" ' : '') + 'src="' + sized(p, 640, 640) + '" data-full="' + p + '" alt="Дакімакура ' + esc(it.name) + '" loading="' + lazy + '" fetchpriority="' + (idx < 2 ? 'high' : 'auto') + '" decoding="async" referrerpolicy="no-referrer" onerror="imgFallback(this)">';
      return '<img ' + (i >= it.nProm ? 'class="orig" ' : '') + 'data-src="' + sized(p, 640, 640) + '" data-full="' + p + '" alt="Дакімакура ' + esc(it.name) + ', ' + (i >= it.nProm ? 'принт' : 'фото ' + (i + 1)) + '" decoding="async" referrerpolicy="no-referrer" onerror="imgFallback(this)">';
    }).join('');
    var initials = it.name.replace(/[^\p{L} ]/gu, '').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ''; }).join('');
    return '<article class="card" data-id="' + it.id + '">' +
      '<div class="pic' + (it.whole ? ' whole' : it.pair ? ' pair' : '') + '">' +
      (it.orig.length ? '<span class="b3d" title="Є 3D-перегляд">3D</span>' : '') +
      '<span class="ph">' + esc(initials) + '</span>' +
      '<div class="track" aria-label="' + esc(it.name) + ': фото, гортай">' + slides + '</div>' +
      (n > 1 ? '<button class="arrow prev" type="button" aria-label="Попереднє фото" disabled>‹</button><button class="arrow next" type="button" aria-label="Наступне фото">›</button>' +
        '<div class="dots">' + it.pics.map(function (_, i) { return '<i class="' + (i ? '' : 'on') + '"></i>'; }).join('') + '</div>' : '') +
      '</div><div class="meta"><span class="name">' + esc(it.name) + '</span><span class="sub">' + esc(it.sub) + '</span></div></article>';
  }
  var OWN_CARD = '<a class="card own" href="/dakimakura" id="ownCard"><div class="pic">Твій арт або фото на подушці</div>' +
    '<div class="meta"><span class="name">Свій принт</span><span class="sub">Макет з\'явиться одразу після завантаження</span></div></a>';

  var api = { tree: tree, esc: esc, BASE: BASE, ORIGIN: ORIGIN, plural: plural, designs: designs, money: money, count: count,
    pathFor: pathFor, hasPage: hasPage, h1: h1, title: title, lead: lead, description: description, crumbs: crumbs, links: links,
    sized: sized, itemFromRow: itemFromRow, mockHtml: mockHtml, cardHtml: cardHtml, OWN_CARD: OWN_CARD, topsHtml: topsHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DakiShared = api;
})(typeof window !== 'undefined' ? window : this);
