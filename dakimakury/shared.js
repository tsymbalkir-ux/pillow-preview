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
    if (statsFor === D) return statsVal;
    var nCol = D.cols.map(function () { return 0; }), uCol = nCol.slice(), nSec = D.secs.map(function () { return 0; });
    D.items.forEach(function (it) { nCol[it[1]]++; uCol[it[1]] += it[5] || 0; nSec[D.cols[it[1]].s]++; });
    statsFor = D; statsVal = { nCol: nCol, uCol: uCol, nSec: nSec };
    return statsVal;
  }
  var MISC = /^(anime2|games2|movies2|misc|kpop)$/;
  var TREE_LIMIT = 24;
  function popular(D) {
    var st = stats(D);
    return D.cols.map(function (_, i) { return i; })
      .filter(function (i) { return st.nCol[i] && !MISC.test(D.cols[i].k); })
      .sort(function (a, b) { return st.uCol[b] - st.uCol[a]; }).slice(0, 10);
  }
  /* opts.all: показати всі колекції розділу; opts.compact: решту за межами перших TREE_LIMIT у HTML не класти
     (так роблять статичні сторінки персонажів, скрипт потім домальовує повне дерево) */
  function tree(D, sec, col, opts) {
    var st = stats(D); opts = opts || {};
    if (col >= 0) sec = D.cols[col].s;
    function row(cls, href, attr, t, n, on) {
      return '<a class="' + cls + '" href="' + href + '" ' + attr + (on ? ' aria-current="true"' : '') + '><span>' + esc(t) + '</span><span class="n">' + n + '</span></a>';
    }
    function li(i) { return '<li>' + row('t-col', pathFor(D, -1, i, -1), 'data-c="' + i + '"', D.cols[i].t, st.nCol[i], col === i) + '</li>'; }
    var out = row('t-row', BASE, 'data-s="-1"', 'Усі дизайни', D.items.length, sec < 0);
    D.secs.forEach(function (s, i) {
      if (!st.nSec[i]) return;
      var open = sec === i, ids = [], list = '';
      if (open) {
        D.cols.forEach(function (c, k) { if (c.s === i && st.nCol[k]) ids.push(k); });
        /* за продажами, далі за кількістю дизайнів; збірні колекції («Інше аніме», «Різне») завжди наприкінці */
        var misc = function (k) { return MISC.test(D.cols[k].k) ? 1 : 0; };
        ids.sort(function (a, b) { return misc(a) - misc(b) || st.uCol[b] - st.uCol[a] || st.nCol[b] - st.nCol[a]; });
        var head = ids, rest = [];
        if (!opts.all && ids.length > TREE_LIMIT + 3) {
          head = ids.slice(0, TREE_LIMIT); rest = ids.slice(TREE_LIMIT);
          var last = ids[ids.length - 1];
          if (misc(last)) { rest.pop(); head.push(last); }
          if (col >= 0 && rest.indexOf(col) >= 0) { rest.splice(rest.indexOf(col), 1); head.splice(TREE_LIMIT, 0, col); }
        }
        list = '<ul class="t-cols">' + head.map(li).join('') + '</ul>';
        if (rest.length) list += '<button class="t-more" type="button" data-more="1">Ще ' + rest.length + ' ' + plural(rest.length, 'колекція', 'колекції', 'колекцій') + '</button>' +
          (opts.compact ? '' : '<ul class="t-cols t-extra" hidden>' + rest.map(li).join('') + '</ul>');
      }
      out += '<div class="t-sec' + (open ? ' open' : '') + '">' +
        row('t-row', pathFor(D, i, -1, -1), 'data-s="' + i + '"', s.t, st.nSec[i], open && col < 0) + list + '</div>';
    });
    if (sec < 0) out += '<div class="t-pop"><p class="t-lbl">Популярне</p><ul class="t-cols">' + popular(D).map(li).join('') + '</ul></div>';
    return out;
  }

  var api = { tree: tree, esc: esc, BASE: BASE, ORIGIN: ORIGIN, plural: plural, designs: designs, money: money, count: count,
    pathFor: pathFor, hasPage: hasPage, h1: h1, title: title, lead: lead, description: description, crumbs: crumbs, links: links };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DakiShared = api;
})(typeof window !== 'undefined' ? window : this);
