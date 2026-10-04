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
    if (col >= 0 && sub >= 0) return 'Дакімакури ' + D.cols[col].subs[sub] + ' (' + D.cols[col].t + ')';
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
      return { title: ({ 'Бренд': 'Усі бренди', 'Тайтл': 'Усі тайтли' }[c.sl] || 'Усі персонажі') + ': ' + c.t, list: list };
    }
    var cols = [];
    D.cols.forEach(function (c, i) { if (sec < 0 || c.s === sec) cols.push({ t: c.t, href: pathFor(D, -1, i, -1) }); });
    return { title: sec >= 0 ? 'Усі колекції розділу «' + D.secs[sec].t + '»' : 'Усі колекції', list: cols };
  }

  var api = { BASE: BASE, ORIGIN: ORIGIN, plural: plural, designs: designs, money: money, count: count,
    pathFor: pathFor, hasPage: hasPage, h1: h1, title: title, lead: lead, description: description, crumbs: crumbs, links: links };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DakiShared = api;
})(typeof window !== 'undefined' ? window : this);
