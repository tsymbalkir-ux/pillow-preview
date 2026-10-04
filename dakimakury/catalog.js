/* =====================================================================
   Каталог дакімакур з готовими принтами. Один скрипт на всі сторінки /dakimakury/.
   Кожна статична сторінка каже, що на ній відкрито, через window.DAKI_PAGE = { s, g, sub }.
   Далі фільтри працюють без перезавантаження, а адреса в рядку браузера змінюється
   на адресу відповідної статичної сторінки.
   Параметри в адресі: ?q=<пошук>, ?size=150, а також старі ?g=<ключ колекції>, ?s=<розділ>, ?sub=<підкатегорія>.
   ===================================================================== */
const S = window.DakiShared;

/* та сама адреса Apps Script, що приймає замовлення з /dakimakura */
const ORDER_URL = 'https://script.google.com/macros/s/AKfycbzRgonaetNukZ1PA-RU6eBPyIxy2CkMQfJ5QGggDyob2uF1cV0gxoKAg5nhRn0ZrTdv/exec';

const SIZES = [
  { v:'100x33', len:100, cm:33, label:'100×33', price:1100 },
  { v:'120x40', len:120, cm:40, label:'120×40', price:1290 },
  { v:'150x50', len:150, cm:50, label:'150×50', price:1640 },
  { v:'180x60', len:180, cm:60, label:'180×60', price:2390 },
];
const PAGE = 24;

/* як ще називають колекцію в запитах (укр / рос / латиниця) */
const COL_ALIAS = {
  shrek:'шрек shrek', revo:'рево revo енергетик энергетик', beer:'пиво пивом beer',
  ronaldo:'роналду роналдо ronaldo кріштіану криштиану футбол', gosling:'гослінг гослинг райан раян gosling ryan',
  straykids:'stray kids стрей кідс стрей кидс стрэй кидс скз k-pop кпоп', bts:'bts бтс k-pop кпоп',
  hp:'гаррі поттер гарри поттер harry potter хогвартс', genshin:'genshin impact геншин геншін імпакт импакт',
  jjk:'магічна битва магическая битва jujutsu kaisen джуджуцу', ds:'клинок розсікає демонів рассекающий демонов demon slayer kimetsu',
  naruto:'наруто naruto', dota:'дота dota', zzz:'зенлес зона зеро ззз', hsr:'хонкай стар рейл хср', ddlc:'доки доки литературный клуб', brawl:'бравл старс браво старс',
  cyberpunk:'киберпанк кіберпанк', bleach:'блич bleach', chainsaw:'человек-бензопила человек бензопила chainsaw man', vocaloid:'вокалоид вокалоїд мику міку miku',
  quints:'пять невест', gup:'девушки и танки', eva:'евангелион evangelion', overlord:'оверлорд повелитель', mha:'моя геройская академия my hero academia мга',
  mushoku:'реинкарнация безработного', onepiece:'ван пис one piece', apothecary:'монолог фармацевта', berserk:'berserk', f1:'формула 1 formula f1',
  ukr:'украинские звезды', memes:'мемы мем', twilight:'сумерки twilight', tvd:'дневники вампира vampire diaries', mlp:'май литл пони мой маленький пони пони',
  music:'музыканты рок метал', softdrinks:'энергетик напиток енергетик', alcohol:'алкоголь', kpop:'k-pop кпоп к-поп', celebs:'актеры звезды актори',
  football:'футбол футболист', romclub:'клуб романтики', wuwa:'вутеринг вейвс', uma:'ума мусуме девушки-пони', aot:'атака титанів атака титанов attack on titan', bsd:'бродячі пси бродячие псы бсд bsd bungo',
};
/* різні написання одного імені: достатньо, щоб збіглося будь-яке */
const ALIASES = [
  ['фелікс','феликс','felix'], ['хьонджин','хьонджін','хьоджін','хенджин','хенджін','хёнджин','хунджин','hyunjin'],
  ['бан чан','банчан','bang chan','banchan','крістофер','кристофер'], ['лі ноу','ли ноу','мінхо','минхо','lee know'],
  ['чонгук','чон гук','jungkook'], ['чимін','чімін','чимин','jimin','пак чі мін'], ['техьон','техйон','тэхен','техен','taehyung'],
  ['шуга','шуґа','suga','юнгі','юнги'], ['намджун','nam-joon','namjoon'], ['хосок','джей хоуп','j-hope','j hope'],
  ['годжо','gojo','сатору'], ['мегумі','мегуми'], ['тоджі','тодзі','тоджи','тодзи'], ['нанамі','нанами'], ['сукуна','sukuna'],
  ['дазай','дадзай','dazai'], ['чуя','чуї','чуе','chuuya'], ['акутагава','акутаґава'],
  ['леві','леви','levi'], ['ерен','эрен','eren'], ['мікаса','микаса'], ['ханджі','ханджи','ханзі'], ['армін','армин'],
  ['незуко','недзуко','неедзуко','nezuko'], ['танджиро','тандзіро','тандзиро','tanjiro'], ['зеніцу','зеницу','дзеницю','дзеніцу'],
  ['шинобу','шінобу','сінобу','синобу'], ['міцурі','мицури'], ['ренгоку','рэнгоку'],
  ['какаші','какаши'], ['ітачі','итачи'], ['хіната','хината'], ['саске','sasuke'],
  ['драко','малфой','мелфой'], ['снейп','снегг','северус'], ['герміона','гермиона'],
  ['сяо','xiao'], ['чжун лі','чжун ли','zhongli'], ['ху тао','hu tao'], ['райден','raiden','сьогун','сёгун'],
  ['кадзуха','казуха','kazuha'], ['тарталья','тарталья','чайлд','childe'], ['скарамучча','скарамуча','мандрівник','странник'],
  ['віслюк','осел','осёл'], ['єгермейстер','егермейстер','jägermeister','jagermeister'], ['пудж','pudge'], ['ферстаппен','verstappen'], ['леклер','leclerc'], ['деймон','дэймон','сальваторе'], ['едвард','едварт','эдвард','каллен'], ['монстр','monster'], ['кока','coca'], ['фіона','фиона'], ['львівське','львовское'], ['гослінг','гослинг','gosling'], ['роналду','роналдо','ronaldo'],
];
/* слова, які в пошуку нічого не уточнюють */
const NOISE = /^(дак[иі]макур\S*|докимакур\S*|dakimakura|подушк\S*|обн[иі]машк\S*|об[иі]ймашк\S*|куп[иі]т[иь]|купити|ан[иі]ме|з|с|із|со|і|и|на|для)$/;

const D = window.DAKI_DATA || { cols: [], items: [] };
const COLS = D.cols;
const SECS = D.secs || [];
/* Оригінали принтів (пласкі файли для друку) лежать на i.ibb.co. Якщо вони є:
   1) стають останніми фото в галереї; 2) з них будується 3D. Без оригіналів кнопки 3D немає. */
const ORIG_HOST = 'https://i.ibb.co/';
const ITEMS = D.items.map(([id, c, name, ru, pics, sold, sub, k, o, og]) => {
  const prom = pics.map(p => /^https?:/.test(p) ? p : `https://images.prom.ua/${p}.jpg`);
  const orig = (o || []).map(p => /^https?:/.test(p) ? p : ORIG_HOST + p);
  return {
  id: String(id), c, name, sold: sold || 0, sub: sub || COLS[c].t, k: k == null ? -1 : k,
  orig, nProm: prom.length,
  pics: prom.concat(orig.slice(0, og || 1)),
  hay: norm(`${name} ${ru} ${sub || ''} ${COLS[c].t} ${COL_ALIAS[COLS[c].k] || ''}`),
  };
});
/* спершу те, що купують найчастіше (за історією замовлень) */
ITEMS.sort((a, b) => b.sold - a.sold);
const times = n => { const d = n % 10, h = n % 100; return n + (d >= 2 && d <= 4 && (h < 12 || h > 14) ? ' рази' : d === 1 && h !== 11 ? ' раз' : ' разів'); };

const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString('uk-UA') + ' ₴';
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
function norm(s){ return String(s).toLowerCase().replace(/ё/g, 'е').replace(/['’`ʼ]/g, '').replace(/\s+/g, ' ').trim(); }
/* Prom CDN віддає зменшені копії фото, якщо в назву файлу додати _wW_hH_ */
const sized = (url, w, h) => url.replace(/(\/\d+)_/, `$1_w${w}_h${h}_`);
const isPhone = () => matchMedia('(max-width: 860px)').matches;
window.imgFallback = img => { if (img.dataset.full && img.src !== img.dataset.full) { img.src = img.dataset.full; } else { img.remove(); } };
const sizeBy = len => SIZES.find(s => s.len === len) || SIZES[1];

/* ---------- стан і адреса ---------- */
const params = new URLSearchParams(location.search);
const CTX = window.DAKI_PAGE || {};
const byKey = (list, k) => Math.max(-1, list.findIndex(c => c.k === String(k || '').toLowerCase()));
const state = {
  size: sizeBy(+params.get('size') || 120),
  col: byKey(COLS, params.get('g') || CTX.g),
  sec: byKey(SECS, params.get('s') || CTX.s),
  q: (params.get('q') || '').slice(0, 60),
  shown: 48,        // стільки ж карток уже є в статичному HTML, тому сторінка не «стрибає» після завантаження скрипта
  sub: -1,          // підкатегорія в межах колекції: -1 усі, -2 «Інші»
  subsOpen: false,
};
if (state.col >= 0) {
  state.sec = COLS[state.col].s;
  const want = norm(params.get('sub') || CTX.sub || '');
  if (want) state.sub = (COLS[state.col].subs || []).findIndex(l => norm(l) === want);
}
/* адреса в браузері = статична сторінка для поточного вибору + параметри, яких у адресі сторінки немає */
function syncUrl(){
  const p = new URLSearchParams(location.search);
  ['g', 's', 'sub', 'q', 'size'].forEach(k => p.delete(k));
  const sub = state.col >= 0 && state.sub >= 0 ? state.sub : -1;
  if (sub >= 0 && !S.hasPage(D, state.col, sub)) p.set('sub', COLS[state.col].subs[sub]);
  if (state.q) p.set('q', state.q);
  if (state.size.len !== 120) p.set('size', state.size.len);
  const path = S.pathFor(D, state.sec, state.col, sub), qs = p.toString();
  if (location.protocol.startsWith('http')) history.replaceState(null, '', path + (qs ? '?' + qs : ''));
  const canon = document.querySelector('link[rel="canonical"]');
  if (canon) canon.href = S.ORIGIN + path;
}

/* ---------- аналітика: GTM (dataLayer) + Meta Pixel, ті самі назви подій, що на /dakimakura ---------- */
window.dataLayer = window.dataLayer || [];
const sent = new Set();
function track(event, data = {}, fb, fbData, fbOpts){
  try {
    if (data.ecommerce) dataLayer.push({ ecommerce: null });
    dataLayer.push({ event, ...data });
    if (fb && window.fbq) fbq('track', fb, fbData || {}, fbOpts || {});
  } catch (err) { console.warn('tracking', err); }
}
function trackOnce(key, ...args){ if (sent.has(key)) return; sent.add(key); track(...args); }
const gaItem = (it, s = state.size) => ({
  item_id: it.id, item_name: it.name, item_category: COLS[it.c].t, item_variant: s.v, price: s.price, quantity: 1,
});
const phoneE164 = raw => {
  const d = String(raw).replace(/\D/g, '');
  if (d.startsWith('380')) return '+' + d;
  if (d.startsWith('0') && d.length === 10) return '+38' + d;
  return d ? '+' + d : undefined;
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-contact]');
  if (a) track('contact_click', { messenger: a.dataset.contact, page: location.pathname }, 'Contact', { content_name: a.dataset.contact });
});

/* ---------- пошук ---------- */
function matcher(q){
  const n = norm(q);
  if (!n) return () => true;
  const group = ALIASES.find(g => g.some(a => n.includes(a) || (n.length >= 4 && a.startsWith(n))));
  const words = n.split(' ').filter(w => !NOISE.test(w));
  if (group) {
    /* ім'я з різними написаннями + решта слів запиту (напр. назва гурту) */
    const rest = words.filter(w => !group.some(a => a.includes(w) || w.includes(a.split(' ')[0])));
    return hay => group.some(a => hay.includes(a)) && rest.every(w => hay.includes(w));
  }
  if (!words.length) return () => true;
  return hay => words.every(w => hay.includes(w) || (w.length > 5 && hay.includes(w.slice(0, -1))));
}
function currentList(){
  const m = matcher(state.q);
  return ITEMS.filter(it => (state.col >= 0 ? it.c === state.col : state.sec < 0 || COLS[it.c].s === state.sec)
    && (state.sub === -1 || state.col < 0 || (state.sub === -2 ? it.k < 0 : it.k === state.sub)) && m(it.hay));
}

/* ---------- шапка: заголовок під запит, розміри ---------- */
function renderHead(){
  const sub = state.col >= 0 && state.sub >= 0 ? state.sub : -1;
  $('h1').textContent = S.h1(D, state.sec, state.col, sub);
  $('lead').textContent = S.lead(D, state.sec, state.col, sub);
  document.title = S.title(D, state.sec, state.col, sub);
  const cr = S.crumbs(D, state.sec, state.col, sub);
  $('crumbs').innerHTML = cr.length > 1 ? cr.map((c, i) => i === cr.length - 1
    ? `<span aria-current="page">${esc(c.t)}</span>` : `<a href="${c.href}">${esc(c.t)}</a>`).join('<span class="sep">/</span>') : '';
}
function renderSizes(){
  const el = $('sizes');
  el.querySelectorAll('.size').forEach(n => n.remove());
  SIZES.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'size';
    b.setAttribute('aria-pressed', s === state.size);
    b.innerHTML = `<span class="w" style="display:block;width:${Math.round(58 + (s.len - 100) / 80 * 42)}%"><span class="bar"><span>${s.label} см</span><span class="p">${fmt(s.price)}</span></span></span>`;
    b.onclick = () => setSize(s, 'ruler');
    el.appendChild(b);
  });
}
function setSize(s, from){
  if (s === state.size) return;
  state.size = s;
  track('select_size', { size: s.v, value: s.price, currency: 'UAH', from });
  renderSizes(); syncUrl();
  document.querySelectorAll('.card:not(.own) .price').forEach(p => { p.firstChild.textContent = fmt(s.price); p.querySelector('small').textContent = s.label + ' см'; });
}

/* ---------- колекції та швидкі фільтри ---------- */
/* кнопки фільтрів це справжні посилання на статичні сторінки: їх бачить пошуковик,
   а звичайний клік перемикає фільтр на місці, без перезавантаження */
function plainClick(e){ return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button); }
function renderChips(){
  const nCol = COLS.map(() => 0), uCol = COLS.map(() => 0), nSec = SECS.map(() => 0);
  ITEMS.forEach(it => { nCol[it.c]++; uCol[it.c] += it.sold; nSec[COLS[it.c].s]++; });
  const se = $('secs');
  se.innerHTML = [`<a class="chip" href="${S.BASE}" data-i="-1" ${state.sec < 0 ? 'aria-current="true"' : ''}>Усі<span class="n">${ITEMS.length}</span></a>`]
    .concat(SECS.map((s, i) => nSec[i] ? `<a class="chip" href="${S.pathFor(D, i, -1, -1)}" data-i="${i}" ${state.sec === i ? 'aria-current="true"' : ''}>${esc(s.t)}<span class="n">${nSec[i]}</span></a>` : '')).join('');
  se.querySelectorAll('.chip').forEach(b => b.onclick = e => {
    if (!plainClick(e)) return;
    e.preventDefault();
    state.sec = +b.dataset.i; state.col = -1; state.sub = -1; state.subsOpen = false; state.q = ''; state.shown = PAGE; $('search').value = '';
    renderAll();
  });
  /* 2-й ряд: колекції розділу, а на «Усі» десять найпопулярніших за продажами */
  let ids = COLS.map((_, i) => i).filter(i => nCol[i]);
  ids = state.sec >= 0 ? ids.filter(i => COLS[i].s === state.sec).sort((a, b) => uCol[b] - uCol[a])
                       : ids.filter(i => !/^(anime2|games2|movies2|misc)$/.test(COLS[i].k)).sort((a, b) => uCol[b] - uCol[a]).slice(0, 10);
  if (state.col >= 0 && !ids.includes(state.col)) ids.unshift(state.col);
  const el = $('chips');
  el.innerHTML = (state.sec < 0 ? '<span class="lbl">Популярне:</span>' : '') +
    ids.map(i => `<a class="chip" href="${S.pathFor(D, -1, i, -1)}" data-i="${i}" ${state.col === i ? 'aria-current="true"' : ''}>${esc(COLS[i].t)}<span class="n">${nCol[i]}</span></a>`).join('');
  el.querySelectorAll('.chip').forEach(b => b.onclick = e => {
    if (!plainClick(e)) return;
    e.preventDefault();
    const i = +b.dataset.i;
    state.col = state.col === i ? -1 : i; state.sub = -1; state.subsOpen = false;
    if (state.col >= 0) state.sec = COLS[i].s;
    state.q = ''; state.shown = PAGE; $('search').value = '';
    renderAll();
  });
  [se, el].forEach(row => { const on = row.querySelector('[aria-current]'); if (on) row.scrollLeft = Math.max(0, on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2); });
}
function renderTops(){
  const el = $('tops'), col = COLS[state.col];
  /* велика колекція: підкатегорії (персонажі, бренди або тайтли) з кількістю дизайнів */
  if (col && col.subs && col.subs.length) {
    const n = col.subs.map(() => 0); let rest = 0;
    ITEMS.forEach(it => { if (it.c === state.col) it.k >= 0 ? n[it.k]++ : rest++; });
    const LIMIT = isPhone() ? 8 : 14;
    let ids = col.subs.map((_, i) => i);
    const hidden = state.subsOpen ? 0 : Math.max(0, ids.length - LIMIT);
    if (hidden) { ids = ids.slice(0, LIMIT); if (state.sub >= LIMIT) ids.push(state.sub); }
    const href = i => S.hasPage(D, state.col, i) ? S.pathFor(D, -1, state.col, i) : S.pathFor(D, -1, state.col, -1) + '?sub=' + encodeURIComponent(col.subs[i]);
    el.innerHTML = `<span>${esc(col.sl || 'Підкатегорія')}:</span>` +
      ids.map(i => `<a href="${href(i)}" data-k="${i}" ${state.sub === i ? 'aria-current="true"' : ''}>${esc(col.subs[i])} <span class="n">${n[i]}</span></a>`).join('') +
      (rest && !hidden ? `<button type="button" data-k="-2" aria-pressed="${state.sub === -2}">Інші <span class="n">${rest}</span></button>` : '') +
      (hidden ? `<button type="button" data-more="1">Ще ${hidden}</button>` : '');
    el.querySelectorAll('a, button').forEach(b => b.onclick = e => {
      if (b.dataset.more) { state.subsOpen = true; renderTops(); return; }
      if (!plainClick(e)) return;
      e.preventDefault();
      const k = +b.dataset.k;
      state.sub = state.sub === k ? -1 : k; state.q = ''; $('search').value = ''; state.shown = PAGE;
      renderHead(); renderTops(); renderGrid(); syncUrl();
      if (state.sub >= 0) track('select_subcategory', { collection: col.k, subcategory: col.subs[state.sub] });
    });
    return;
  }
  const tops = col ? col.top : [];
  if (!tops.length) { el.innerHTML = ''; return; }
  const nq = norm(state.q);
  el.innerHTML = '<span>Часто шукають:</span>' + tops.map(t => `<button type="button" aria-pressed="${norm(t) === nq}">${esc(t)}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => {
    const on = b.getAttribute('aria-pressed') === 'true';
    state.q = on ? '' : b.textContent; state.shown = PAGE; $('search').value = state.q;
    renderTops(); renderGrid(); syncUrl();
  });
}

/* ---------- сітка ---------- */
let listToken = '';
function renderGrid(){
  const list = currentList(), el = $('grid'), s = state.size;
  $('count').textContent = list.length
    ? (state.q ? `За запитом «${state.q}»: ${list.length}` : `Дизайнів: ${list.length}`)
    : '';
  if (!list.length) {
    el.innerHTML = `<div class="empty"><p>За запитом «${esc(state.q)}» готового дизайну поки немає. Надрукуємо цього персонажа з твого зображення або підберемо арт самі, якщо напишеш нам.</p>
      <div class="row"><a class="btn" href="/dakimakura">Зробити зі своїм зображенням</a><a class="btn ghost" href="https://t.me/Masterform_ua" data-contact="telegram">Написати в Telegram</a>${state.col >= 0 || state.sec >= 0 ? '<button class="btn ghost" id="allCols" type="button">Шукати в усьому каталозі</button>' : ''}</div></div>`;
    const all = $('allCols'); if (all) all.onclick = () => { state.col = -1; state.sec = -1; state.sub = -1; state.shown = PAGE; renderAll(); };
    $('more').innerHTML = '';
    track('search_empty', { search_term: state.q, collection: state.col >= 0 ? COLS[state.col].k : 'all' });
    return;
  }
  const part = list.slice(0, state.shown);
  /* свій принт купують частіше за будь-який готовий дизайн, тому він стоїть першим */
  const own = !state.q && state.col < 0 && state.sub === -1 ? `<a class="card own" href="/dakimakura" id="ownCard">
      <div class="pic">Твій арт або фото на подушці</div>
      <div class="meta"><span class="name">Свій принт</span><span class="sub">Макет з'явиться одразу після завантаження</span></div>
      <div class="buyrow"><span class="price">від ${fmt(SIZES[1].price)}<small></small></span><span class="btn ghost">Створити макет</span></div>
    </a>` : '';
  el.innerHTML = own + part.map((it, idx) => {
    const n = it.pics.length;
    return `<article class="card" data-id="${it.id}">
      <div class="pic">
        ${it.sold >= 3 ? `<span class="hit">Купили ${times(it.sold)}</span>` : ''}
        ${it.orig.length ? '<button class="b3d" type="button" aria-label="Покрутити в 3D">3D</button>' : ''}
        <span class="ph">${esc(it.name.replace(/[^\p{L} ]/gu, '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join(''))}</span>
        <div class="track" aria-label="${esc(it.name)}: фото, гортай">
          ${it.pics.map((p, i) => i === 0
            ? `<img src="${sized(p, 640, 640)}" data-full="${p}" alt="Дакімакура ${esc(it.name)}" loading="${idx < 4 ? 'eager' : 'lazy'}" fetchpriority="${idx < 2 ? 'high' : 'auto'}" decoding="async" referrerpolicy="no-referrer" onerror="imgFallback(this)">`
            : `<img ${i >= it.nProm ? 'class="orig" ' : ''}data-src="${sized(p, 640, 640)}" data-full="${p}" alt="Дакімакура ${esc(it.name)}, ${i >= it.nProm ? 'принт' : 'фото ' + (i + 1)}" decoding="async" referrerpolicy="no-referrer" onerror="imgFallback(this)">`).join('')}
        </div>
        ${n > 1 ? `<button class="arrow prev" type="button" aria-label="Попереднє фото" disabled>‹</button><button class="arrow next" type="button" aria-label="Наступне фото">›</button>
        <div class="dots">${it.pics.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
      </div>
      <div class="meta"><span class="name">${esc(it.name)}</span><span class="sub">${esc(it.sub)}</span></div>
      <div class="buyrow"><span class="price">${fmt(s.price)}<small>${s.label} см</small></span><button class="btn" type="button">Замовити</button></div>
    </article>`;
  }).join('');
  el.querySelectorAll('.card:not(.own)').forEach(setupCard);
  const oc = $('ownCard'); if (oc) oc.onclick = () => track('select_promotion', { promotion_name: 'own_print', creative_slot: 'grid_first' });
  const left = list.length - part.length;
  $('more').innerHTML = left > 0 ? `<button class="btn ghost" type="button" id="moreBtn">Показати ще ${Math.min(PAGE, left)} із ${left}</button>` : '';
  if (left > 0) $('moreBtn').onclick = () => {
    const y = scrollY; state.shown += PAGE; renderGrid(); scrollTo(0, y);
  };
  /* список товарів у GA4: один раз на кожну комбінацію колекції та пошуку */
  const token = state.col + '|' + state.sub + '|' + norm(state.q);
  if (token !== listToken) {
    listToken = token;
    track('view_item_list', { ecommerce: { item_list_id: state.col >= 0 ? COLS[state.col].k : 'all', item_list_name: state.col >= 0 ? COLS[state.col].t : 'Усі',
      items: part.slice(0, 12).map((it, i) => ({ ...gaItem(it), index: i })) } });
    if (state.q) track('search', { search_term: state.q, results: list.length });
  }
}
/* фото, крім першого, вантажаться лише коли людина до них гортає */
function loadSlide(img){ if (img && img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); } }
function setupCard(card){
  const id = card.dataset.id, tr = card.querySelector('.track'), imgs = [...tr.querySelectorAll('img')];
  const dots = [...card.querySelectorAll('.dots i')], prev = card.querySelector('.prev'), next = card.querySelector('.next');
  let cur = 0, moved = false;
  const go = i => tr.scrollTo({ left: i * tr.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  tr.addEventListener('scroll', () => {
    moved = true;
    const i = Math.round(tr.scrollLeft / tr.clientWidth);
    loadSlide(imgs[i]); loadSlide(imgs[i + 1]);
    if (i !== cur) { cur = i; dots.forEach((d, k) => d.classList.toggle('on', k === i)); if (prev) { prev.disabled = i === 0; next.disabled = i === imgs.length - 1; } }
  }, { passive: true });
  tr.addEventListener('pointerdown', () => { moved = false; });
  tr.addEventListener('click', () => { if (!moved) openItem(id, cur); });
  card.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') loadSlide(imgs[1]); });
  if (prev) { prev.onclick = () => { loadSlide(imgs[cur - 1]); go(cur - 1); }; next.onclick = () => { loadSlide(imgs[cur + 1]); go(cur + 1); }; }
  card.querySelector('.meta').onclick = () => openItem(id, cur);
  const b3 = card.querySelector('.b3d'); if (b3) b3.onclick = () => open3D(id);
  card.querySelector('.btn').onclick = () => openItem(id, cur, true);
}

/* ---------- вікно товару: фото, розмір, форма ---------- */
const orderId = () => {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.floor(1000 + Math.random() * 9000)}`;
};
/* Один POST у Apps Script. mode:'no-cors' обов'язковий, інакше браузер зробить preflight,
   якого Apps Script не вміє. Відповідь прочитати не можна, тому успіх перевіряємо окремим GET. */
async function postGAS(payload){
  await fetch(ORDER_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
}
/* те, що людина вже ввела, не губиться, якщо вона закрила вікно й відкрила інший дизайн */
const draft = { fname: '', lname: '', phone: '', city: '', np: '' };

function openItem(id, start = 0, toForm = false){
  const it = ITEMS.find(i => i.id === id), d = $('dlg');
  if (!it) return;
  const ship = (window.SHIP_DATE || '').trim();
  d.innerHTML = `<div class="dlg">
    <div class="shots">${it.pics.map((p, i) => `<img src="${isPhone() ? sized(p, 640, 640) : p}" data-full="${p}" alt="Дакімакура ${esc(it.name)}, ${i >= it.nProm ? 'принт' : 'фото ' + (i + 1)}" referrerpolicy="no-referrer" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async" onerror="imgFallback(this)">`).join('')}</div>
    <div class="info">
      <button class="close" type="button">Закрити ✕</button>
      <div><h2>${esc(it.name)}</h2><p class="spec">${esc(it.sub)}. Габардин, сублімаційний друк, прихована блискавка, холофайбер.</p></div>
      <fieldset class="pick" id="pick"><legend>Розмір</legend>
        ${SIZES.map(s => `<button type="button" data-l="${s.len}" aria-pressed="${s === state.size}"><b>${s.label} см</b><span>${fmt(s.price)}</span></button>`).join('')}
      </fieldset>
      <form class="form" id="order" novalidate>
        <label for="fname">Куди доставити</label>
        <div class="pair">
          <input id="fname" placeholder="Ім'я" autocomplete="given-name" required value="${esc(draft.fname)}">
          <input id="lname" placeholder="Прізвище" autocomplete="family-name" required value="${esc(draft.lname)}">
        </div>
        <input id="phone" type="tel" inputmode="tel" placeholder="Телефон, +380" autocomplete="tel" required value="${esc(draft.phone)}">
        <div class="pair">
          <input id="city" placeholder="Місто" autocomplete="address-level2" required value="${esc(draft.city)}">
          <input id="np" placeholder="Відділення НП" required value="${esc(draft.np)}">
        </div>
        <button class="btn wide" id="submit" type="submit">Замовити за ${fmt(state.size.price)}</button>
        <p class="note" id="orderNote" role="status"></p>
      </form>
      <p class="terms"><b>Оплата при отриманні.</b> Передзвонимо, щоб підтвердити дизайн і відділення.${ship ? ` При замовленні сьогодні відправимо <b>${esc(ship)}</b>.` : ''}</p>
      ${it.orig.length ? `<button class="open3d" type="button" id="dlg3d"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>Покрутити в 3D</button>` : ''}
    </div></div>`;

  const q = sel => d.querySelector(sel);
  q('.close').onclick = () => d.close();
  if (q('#dlg3d')) q('#dlg3d').onclick = () => { d.close(); open3D(id); };
  d.onclick = e => { if (e.target === d) d.close(); };

  q('#pick').querySelectorAll('button').forEach(b => b.onclick = () => {
    setSize(sizeBy(+b.dataset.l), 'dialog');
    q('#pick').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    const sb = q('#submit'); if (sb && !sb.disabled) sb.textContent = `Замовити за ${fmt(state.size.price)}`;
  });

  const form = q('#order'), note = q('#orderNote');
  ['fname', 'lname', 'phone', 'city', 'np'].forEach(k => q('#' + k).addEventListener('input', e => { draft[k] = e.target.value; }));
  form.addEventListener('focusin', () => {
    trackOnce('checkout-' + it.id, 'begin_checkout',
      { ecommerce: { currency: 'UAH', value: state.size.price, items: [gaItem(it)] } },
      'InitiateCheckout', { value: state.size.price, currency: 'UAH', content_ids: [it.id], content_type: 'product' });
  });
  form.onsubmit = async e => {
    e.preventDefault();
    const need = ['fname', 'lname', 'phone', 'city', 'np'].find(k => !q('#' + k).value.trim());
    const digits = q('#phone').value.replace(/\D/g, '');
    if (need) { note.className = 'note err'; note.textContent = 'Заповни всі поля, щоб ми знали, куди відправити.'; q('#' + need).focus(); return; }
    if (digits.length < 10) { note.className = 'note err'; note.textContent = 'Перевір номер телефону: у ньому має бути щонайменше 10 цифр.'; q('#phone').focus(); return; }
    const btn = q('#submit'), s = state.size, oid = orderId();
    btn.disabled = true; btn.textContent = 'Надсилаємо…'; note.className = 'note'; note.textContent = '';
    try {
      await postGAS({
        kind: 'order', order_id: oid,
        size_value: s.v,
        /* назва дизайну продубльована в size_label: цю колонку таблиця замовлень уже має */
        size_label: `${s.label} | ${it.name} (${COLS[it.c].t}) | Prom ${it.id}`,
        price_uah: s.price, sides: 'catalog', same_both: true,
        first_name: q('#fname').value.trim(), last_name: q('#lname').value.trim(),
        phone: q('#phone').value.trim(), city: q('#city').value.trim(), np_branch: q('#np').value.trim(),
        source: 'catalog', ts: new Date().toISOString(),
        /* додаткові поля: потраплять у таблицю, щойно в Apps Script для них з'являться колонки */
        design_id: it.id, design_name: it.name, design_collection: COLS[it.c].k, design_photo: it.pics[0],
        page_url: location.href,
      });
      let ok = false;
      try {
        const r = await fetch(`${ORDER_URL}?check=${oid}&t=${Date.now()}`, { cache: 'no-store' });
        ok = r.ok && (await r.json()).found;
      } catch { /* перевірка не критична */ }

      trackOnce('order-' + oid, 'purchase', {
        ecommerce: { transaction_id: oid, currency: 'UAH', value: s.price, items: [gaItem(it, s)] },
        user_data: {
          phone_number: phoneE164(q('#phone').value),
          address: { first_name: q('#fname').value.trim(), last_name: q('#lname').value.trim(), city: q('#city').value.trim(), country: 'UA' },
        },
      }, 'Purchase', { value: s.price, currency: 'UAH', content_ids: [it.id], content_type: 'product' }, { eventID: oid });

      form.outerHTML = `<div class="done" role="status"><b>Замовлення прийнято</b>
        <span>${esc(it.name)}, ${s.label} см, ${fmt(s.price)}. Номер ${oid}.</span>
        <span>${ok ? 'Зателефонуємо найближчим часом, щоб підтвердити дизайн і відділення.' : 'Якщо ми не зателефонуємо протягом дня, напиши нам цей номер у Telegram.'}</span></div>`;
      q('#pick').querySelectorAll('button').forEach(b => { b.disabled = true; });
    } catch (err) {
      console.error(err);
      note.className = 'note err';
      note.textContent = 'Не вдалося надіслати замовлення. Перевір інтернет і спробуй ще раз або напиши нам у Telegram.';
      btn.disabled = false; btn.textContent = `Замовити за ${fmt(state.size.price)}`;
    }
  };

  d.showModal();
  track('view_item', { ecommerce: { currency: 'UAH', value: state.size.price, items: [gaItem(it)] } },
    'ViewContent', { content_ids: [it.id], content_type: 'product', value: state.size.price, currency: 'UAH' });
  const shots = d.querySelector('.shots'), target = shots.children[start];
  if (target) shots.scrollLeft = target.offsetLeft - shots.offsetLeft;
  if (toForm) {
    if (isPhone()) q('#pick').scrollIntoView({ block: 'start' });
    else q('#fname').focus({ preventScroll: true });
  }
}

/* ---------- 3D-перегляд ----------
   Ті самі модулі, що й на /dakimakura: pillow-mockup.js (PhotoSide) і dakimakura-3d.js з кореня сайту.
   three.js і модулі вантажаться лише після першого натиску «3D».
   Принт береться з оригіналів на i.ibb.co (поле orig у товару):
    - два файли: перший це сторона A, другий сторона B;
    - один файл, на якому обидві сторони поруч (ширина більша за TWO_SIDED висоти): ріжемо навпіл, ліва A, права B;
    - один файл з однією стороною: сторона B повторює A.
   Щоб це працювало, хостинг картинок має дозволяти читати їх з іншого сайту (CORS). */
const TWO_SIDED = 0.5;   // панель дакімакури має пропорцію 1:3 (0.33), дві панелі поруч 2:3 (0.67)
let MM = null, D3 = null, v3d = null, v3dToken = 0, v3dSize = null;
const printCache = new Map();

async function fileBlob(url){
  const r = await fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.blob();
}
function cropBlob(bmp, sx, sw){
  const cv = document.createElement('canvas');
  cv.width = sw; cv.height = bmp.height;
  cv.getContext('2d').drawImage(bmp, sx, 0, sw, bmp.height, 0, 0, sw, bmp.height);
  return new Promise(res => cv.toBlob(res, 'image/png'));
}
/* повертає { a, b, twoSided }: Blob для кожної сторони (b може бути null) */
async function printBlobs(it){
  const first = await fileBlob(it.orig[0]);
  const bmp = await createImageBitmap(first);
  const ratio = bmp.width / bmp.height;
  if (ratio > TWO_SIDED) {
    const half = Math.floor(bmp.width / 2);
    const [a, b] = await Promise.all([cropBlob(bmp, 0, half), cropBlob(bmp, bmp.width - half, half)]);
    bmp.close?.();
    return { a, b, twoSided: true };
  }
  bmp.close?.();
  let b = null;
  if (it.orig[1]) { try { b = await fileBlob(it.orig[1]); } catch { /* друга сторона не обов'язкова */ } }
  return { a: first, b, twoSided: !!b };
}
async function sidesFor(it){
  if (printCache.has(it.id)) return printCache.get(it.id);
  const { a, b, twoSided } = await printBlobs(it);
  const fill = side => { if (side.photoFit === 'cover' && side.transform) { side.transform.margin = 0; side._changed?.(); } };
  const A = new MM.PhotoSide('A'); await A.setPhoto(a); fill(A);
  const B = new MM.PhotoSide('B');
  if (b) { await B.setPhoto(b); fill(B); } else B.copyFrom(A);
  const r = { A, B, twoSided };
  printCache.set(it.id, r);
  return r;
}
const markSide = id => [...$('v3dSides').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.side === id));
function renderSizes3d(){
  v3dSize = state.size;
  $('v3dSizes').innerHTML = SIZES.map(s => `<button type="button" data-l="${s.len}" aria-pressed="${s === v3dSize}">${s.label} см</button>`).join('');
  $('v3dSizes').querySelectorAll('button').forEach(b => b.onclick = () => {
    setSize(sizeBy(+b.dataset.l), '3d'); renderSizes3d(); v3d?.setSize(v3dSize);
  });
}
async function open3D(id){
  const it = ITEMS.find(i => i.id === id), d = $('v3d'), token = ++v3dToken;
  $('v3dTitle').textContent = it.name;
  $('v3dSub').textContent = it.sub;
  renderSizes3d(); markSide('A');
  const load = $('v3dLoad');
  load.hidden = false; load.textContent = 'Готуємо модель…';
  if (v3d) v3d.renderer.domElement.style.visibility = 'hidden';
  d.showModal();
  track('open_3d', { item_id: it.id, size: state.size.v });
  try {
    if (!MM) {
      const [m, d3] = await Promise.all([import('/pillow-mockup.js'), import('/dakimakura-3d.js')]);
      MM = m; D3 = d3.Dakimakura3D;
    }
    const s = await sidesFor(it);
    if (token !== v3dToken) return;
    $('v3dSub').textContent = it.sub + (s.twoSided ? ' · двосторонній принт' : ' · принт однаковий з обох боків');
    if (!v3d) {
      v3d = new D3({ host: $('v3dStage'), sides: { A: s.A, B: s.B }, size: v3dSize, mobile: MM.isMobile() });
      v3d.onTurn = markSide;
      await v3d.init();
    } else {
      v3d.sides = { A: s.A, B: s.B };
      v3d.setSize(v3dSize);
    }
    v3d.renderer.domElement.style.visibility = '';
    load.hidden = true;
    v3d.refresh(); v3d.show('A'); v3d.start();
  } catch (err) {
    if (token !== v3dToken) return;
    load.hidden = false;
    load.textContent = 'Не вдалося завантажити принт для 3D. Гортай фото в картці, щоб роздивитися дизайн.';
    console.error('3D:', err);
  }
}
[...$('v3dSides').children].forEach(b => b.onclick = () => { markSide(b.dataset.side); v3d?.show(b.dataset.side); });
$('v3dClose').onclick = () => $('v3d').close();
$('v3d').addEventListener('click', e => { if (e.target === $('v3d')) $('v3d').close(); });
$('v3d').addEventListener('close', () => v3d?.stop());

/* ---------- старт ---------- */
function renderLinks(){
  const l = S.links(D, state.sec, state.col), el = $('links');
  if (!el) return;
  el.hidden = !l.list.length;
  el.innerHTML = l.list.length ? `<h2>${esc(l.title)}</h2><ul>${l.list.map(x => `<li><a href="${x.href}">${esc(x.t)}</a></li>`).join('')}</ul>` : '';
}
function renderAll(){ renderHead(); renderChips(); renderTops(); renderGrid(); renderLinks(); syncUrl(); }
let typing;
$('search').value = state.q;
$('search').addEventListener('input', e => {
  clearTimeout(typing);
  typing = setTimeout(() => { state.q = e.target.value.trim(); state.shown = PAGE; renderTops(); renderGrid(); syncUrl(); }, 180);
});
(function(){
  const d = (window.SHIP_DATE || '').trim();
  if (d) { $('shipDate').textContent = d; $('shipLi').hidden = false; }
  $('yr').textContent = new Date().getFullYear();
})();
renderSizes(); renderAll();
if (!ITEMS.length) $('grid').innerHTML = '<div class="empty"><p>Каталог не завантажився. Онови сторінку або напиши нам у Telegram, і ми надішлемо дизайни.</p><div class="row"><a class="btn" href="https://t.me/Masterform_ua" data-contact="telegram">Написати в Telegram</a></div></div>';
