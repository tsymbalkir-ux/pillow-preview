/* Каталог ростових фігур /rostovi-figury/.
   Сторінка приходить уже зі статичними картками (перші 48). Цей скрипт:
   - відкриває вікно фігури з фото й формою замовлення (дані беруться з картки, data.js не потрібен);
   - «Показати ще» і пошук: довантажує data.js (усі фігури) і домальовує картки;
   - бічне меню каталогу на телефоні, аналітика (ті самі назви подій, що в каталозі дакімакур). */
(() => {
'use strict';
const ORDER_URL = 'https://script.google.com/macros/s/AKfycbzRgonaetNukZ1PA-RU6eBPyIxy2CkMQfJ5QGggDyob2uF1cV0gxoKAg5nhRn0ZrTdv/exec';
const PHOTO = (id, v) => `https://pub-a68eca237e8e4425b76226cdb7c2ca73.r2.dev/brand/${id}_cardboard_${v}.jpg`;
const VIEWS = [['front', 'спереду'], ['combo', 'спереду і ззаду'], ['back', 'ззаду, підставка']];
const PAGE_N = 48;
const PAGE = window.RF_PAGE || { s: -1, c: -1, n: 0 };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => n.toLocaleString('uk-UA').replace(/\s/g, ' ') + ' ₴';
const isPhone = () => matchMedia('(max-width: 860px)').matches;
const yr = $('yr'); if (yr) yr.textContent = new Date().getFullYear();

/* ---------- аналітика ---------- */
window.dataLayer = window.dataLayer || [];
const sent = new Set();
function track(event, data = {}, fb, fbData, fbOpts){
  try {
    if (data.ecommerce) dataLayer.push({ ecommerce: null });
    dataLayer.push({ event, ...data });
    if (fb && window.fbq) fbq('track', fb, fbData || {}, fbOpts || {});
  } catch (err) { console.warn('tracking', err); }
}
const trackOnce = (key, ...a) => { if (sent.has(key)) return; sent.add(key); track(...a); };
const gaItem = it => ({ item_id: it.id, item_name: 'Ростова фігура ' + it.name, item_category: it.col, item_variant: `${it.h}x${it.w}`, price: it.p, quantity: 1 });
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

/* ---------- дані фігури з картки ---------- */
const fromCard = card => {
  const name = card.querySelector('.name').textContent, col = card.querySelector('.sub').textContent;
  const m = /(\d+)\s*×\s*(\d+)/.exec(card.querySelector('.price small').textContent);
  return { id: card.dataset.id, name, col, h: +m[1], w: +m[2], p: +card.querySelector('.price').firstChild.textContent.replace(/\D/g, '') };
};

/* ---------- усі фігури (data.js) ---------- */
let DATA = null, loading = null;
function loadAll(){
  if (DATA) return Promise.resolve(DATA);
  if (loading) return loading;
  loading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/rostovi-figury/data.js?v=' + encodeURIComponent(PAGE.v || '');
    s.onload = () => {
      const D = window.RF_DATA;
      D.list = D.items.map(([id, s, c, n, h, w, p]) => {
        const col = c >= 0 ? D.cols[c].t : D.secs[s].t;
        return { id: String(id), s, c, name: n, col, h, w, p, key: norm(n + ' ' + col + ' ' + D.secs[s].t) };
      });
      DATA = D; res(D);
    };
    s.onerror = () => { loading = null; rej(new Error('data.js')); };
    document.head.appendChild(s);
  });
  return loading;
}
const norm = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[ʼ’'`]/g, '').replace(/[^0-9a-zа-яіїєґ]+/g, ' ').trim();
const showName = it => it.name;
function cardHtml(it, i){
  const full = it.c >= 0 && !/^Інше|^K-pop$/.test(it.col) ? `${it.name}, ${it.col}` : it.name;
  return `<article class="card" data-id="${it.id}"><button class="pic" type="button" aria-label="Відкрити: ростова фігура ${esc(full)}">` +
    `<img src="/img/rf/${it.id}.webp" width="360" height="480" alt="Ростова фігура ${esc(full)} з картону" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async"></button>` +
    `<div class="meta"><span class="name">${esc(showName(it))}</span><span class="sub">${esc(it.col)}</span>` +
    `<span class="price">${fmt(it.p)}<small> · ${it.h}×${it.w} см</small></span></div></article>`;
}
const pageList = D => D.list.filter(it => PAGE.c >= 0 ? it.c === PAGE.c : PAGE.s >= 0 ? it.s === PAGE.s : true);
/* на сторінці «Усі» статичні картки йдуть по черзі з розділів; data.js відтворює той самий порядок */
function mixed(list){
  const by = []; list.forEach(it => { (by[it.s] = by[it.s] || []).push(it); });
  const out = []; let left = true;
  while (left) { left = false; by.forEach(b => { if (b && b.length) { out.push(b.shift()); left = true; } }); }
  return out;
}

const grid = $('grid'), more = $('more'), count = $('count');
let shownList = null, shown = grid.querySelectorAll('.card').length, q = '';
function moreBtn(total){
  more.innerHTML = shown < total ? '<button class="btn ghost" id="moreBtn" type="button">Показати ще</button>' : '';
}
more.addEventListener('click', async e => {
  if (!e.target.closest('#moreBtn')) return;
  const b = e.target.closest('#moreBtn'); b.disabled = true; b.textContent = 'Завантажуємо…';
  try {
    const D = await loadAll();
    if (!shownList) shownList = PAGE.s < 0 && PAGE.c < 0 ? mixed(pageList(D)) : pageList(D);
    const next = shownList.slice(shown, shown + PAGE_N);
    grid.insertAdjacentHTML('beforeend', next.map((it, i) => cardHtml(it, 99 + i)).join(''));
    shown += next.length; moreBtn(shownList.length);
  } catch (err) {
    b.disabled = false; b.textContent = 'Не вдалося. Спробувати ще раз';
  }
});

/* ---------- пошук: по всьому каталогу, збіги поточного розділу першими ---------- */
const initialGrid = grid.innerHTML, initialMore = more.innerHTML, initialCount = count.textContent;
let searchTimer = null;
$('search').addEventListener('focus', () => { loadAll().catch(() => {}); }, { once: true });
$('search').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(e.target.value), 220);
});
async function runSearch(raw){
  q = norm(raw);
  if (!q) { grid.innerHTML = initialGrid; more.innerHTML = initialMore; count.textContent = initialCount; shownList = null; shown = grid.querySelectorAll('.card').length; return; }
  let D;
  try { D = await loadAll(); } catch { return; }
  const words = q.split(' ');
  const hits = D.list.filter(it => words.every(w => it.key.includes(w)));
  const mine = it => (PAGE.c >= 0 ? it.c === PAGE.c : PAGE.s >= 0 ? it.s === PAGE.s : false);
  hits.sort((a, b) => mine(b) - mine(a));
  shownList = hits; shown = Math.min(PAGE_N, hits.length);
  count.textContent = hits.length ? `Знайдено: ${hits.length}` : 'Нічого не знайшли';
  if (!hits.length) {
    grid.innerHTML = `<div class="empty"><p>Такої фігури в каталозі немає. Але її можна зробити з будь-якого фото.</p><div class="row"><a class="btn" href="/rostova-figura-na-zakaz.html">Зробити зі свого фото</a><a class="btn ghost" href="https://t.me/Masterform_ua" data-contact="telegram">Написати в Telegram</a></div></div>`;
    more.innerHTML = '';
    track('search_empty', { search_term: raw, catalog: 'rostovi' });
    return;
  }
  grid.innerHTML = hits.slice(0, PAGE_N).map(cardHtml).join('');
  moreBtn(hits.length);
  track('search', { search_term: raw, results: hits.length, catalog: 'rostovi' });
}

/* ---------- бічне меню на телефоні ---------- */
const drawerOpen = () => document.documentElement.classList.contains('side-on');
function drawer(on){
  if (on === drawerOpen()) return;
  document.documentElement.classList.toggle('side-on', on);
  $('sideOpen').setAttribute('aria-expanded', on);
  if (on) $('sideClose').focus({ preventScroll: true });
  else if (isPhone()) $('sideOpen').focus({ preventScroll: true });
}
$('sideOpen').onclick = () => drawer(true);
$('sideClose').onclick = () => drawer(false);
$('sideShow').onclick = () => drawer(false);
$('shade').onclick = () => drawer(false);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawerOpen()) drawer(false); });

/* ---------- вікно фігури ---------- */
let lockedAt = null;
function lockPage(on){
  const b = document.body;
  if (on && lockedAt === null) {
    lockedAt = scrollY;
    b.style.position = 'fixed'; b.style.top = -lockedAt + 'px'; b.style.left = '0'; b.style.right = '0';
  } else if (!on && lockedAt !== null) {
    b.style.position = ''; b.style.top = ''; b.style.left = ''; b.style.right = '';
    const y = lockedAt; lockedAt = null; scrollTo(0, y);
  }
}
/* «Назад» у браузері закриває вікно, а не йде зі сторінки */
let overlayEntry = false;
const dlg = $('dlg');
dlg.addEventListener('close', () => {
  lockPage(false);
  if (overlayEntry) { overlayEntry = false; if (history.state && history.state.overlay) history.back(); }
});
addEventListener('popstate', () => { if (overlayEntry) { overlayEntry = false; if (dlg.open) dlg.close(); } });

const orderId = () => {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.floor(1000 + Math.random() * 9000)}`;
};
async function postGAS(payload){
  await fetch(ORDER_URL, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
}
const wait = ms => new Promise(res => setTimeout(res, ms));
const draft = { fname: '', lname: '', phone: '', city: '', np: '' };

grid.addEventListener('click', e => {
  const card = e.target.closest('.card[data-id]');
  if (card) openItem(fromCard(card));
});

function openItem(it){
  const ship = (window.SHIP_DATE || '').trim();
  const full = it.col && !/^Інше|^K-pop$|^Актори$|^Музиканти$|^Кіно/.test(it.col) ? `${it.name}, ${it.col}` : it.name;
  dlg.innerHTML = `<div class="dlg rf-dlg">
    <div class="gal"><div class="shots">${VIEWS.map(([v, t], i) => `<img src="${PHOTO(it.id, v)}" alt="Ростова фігура ${esc(full)}: ${t}" loading="${i ? 'lazy' : 'eager'}" decoding="async">`).join('')}</div><button class="g-arrow prev" type="button" aria-label="Попереднє фото" disabled>‹</button><button class="g-arrow next" type="button" aria-label="Наступне фото">›</button><span class="g-count" aria-hidden="true">1 / ${VIEWS.length}</span></div>
    <div class="info">
      <div class="info-top"><span></span><button class="close" type="button">Закрити ✕</button></div>
      <div><h2>Ростова фігура ${esc(full)}</h2><p class="spec">Щільний 5-шаровий картон, повнокольоровий друк, вирізана по контуру, складана підставка ззаду.</p></div>
      <dl class="rf-size"><div><dt>Висота</dt><dd>${it.h} см</dd></div><div><dt>Ширина</dt><dd>≈${it.w} см</dd></div><div class="pr"><dt>Ціна</dt><dd>${fmt(it.p)}</dd></div></dl>
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
        <button class="btn wide" id="submit" type="submit">Замовити за ${fmt(it.p)}</button>
        <p class="note" id="orderNote" role="status"></p>
      </form>
      <p class="terms"><b>Оплата при отриманні.</b> Передзвонимо, щоб підтвердити фігуру й відділення.${ship ? ` При замовленні сьогодні відправимо <b>${esc(ship)}</b>.` : ''}</p>
    </div></div>`;
  const q = sel => dlg.querySelector(sel);
  q('.close').onclick = () => dlg.close();
  dlg.onclick = e => { if (e.target === dlg) dlg.close(); };

  /* галерея: стрілки й лічильник */
  const shots = q('.shots'), pics = [...shots.children], gPrev = q('.g-arrow.prev'), gNext = q('.g-arrow.next'), gCount = q('.g-count');
  const gState = () => {
    const at = Math.round(shots.scrollLeft / Math.max(1, pics[0].offsetWidth));
    gCount.textContent = `${Math.min(pics.length, at + 1)} / ${pics.length}`;
    gPrev.disabled = shots.scrollLeft < 8;
    gNext.disabled = shots.scrollLeft + shots.clientWidth > shots.scrollWidth - 8;
  };
  const gGo = dir => {
    const at = Math.round(shots.scrollLeft / Math.max(1, pics[0].offsetWidth));
    const to = pics[Math.max(0, Math.min(pics.length - 1, at + dir))];
    shots.scrollTo({ left: to.offsetLeft - pics[0].offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  gPrev.onclick = () => gGo(-1); gNext.onclick = () => gGo(1);
  shots.addEventListener('scroll', gState, { passive: true });
  pics.forEach(p => p.addEventListener('load', gState));
  /* фото не завантажилось: прибираємо слайд */
  pics.forEach(p => p.addEventListener('error', () => { p.remove(); pics.splice(pics.indexOf(p), 1); if (pics.length) gState(); }));

  const form = q('#order'), note = q('#orderNote');
  ['fname', 'lname', 'phone', 'city', 'np'].forEach(k => q('#' + k).addEventListener('input', e => { draft[k] = e.target.value; }));
  form.addEventListener('focusin', () => {
    trackOnce('checkout-' + it.id, 'begin_checkout', { ecommerce: { currency: 'UAH', value: it.p, items: [gaItem(it)] } },
      'InitiateCheckout', { value: it.p, currency: 'UAH', content_ids: [it.id], content_type: 'product' });
  });
  form.onsubmit = async e => {
    e.preventDefault();
    const need = ['fname', 'lname', 'phone', 'city', 'np'].find(k => !q('#' + k).value.trim());
    const digits = q('#phone').value.replace(/\D/g, '');
    if (need) { note.className = 'note err'; note.textContent = 'Заповни всі поля, щоб ми знали, куди відправити.'; q('#' + need).focus(); return; }
    if (digits.length < 10) { note.className = 'note err'; note.textContent = 'Перевір номер телефону: у ньому має бути щонайменше 10 цифр.'; q('#phone').focus(); return; }
    const btn = q('#submit'), oid = orderId();
    btn.disabled = true; btn.textContent = 'Надсилаємо…'; note.className = 'note'; note.textContent = '';
    const payload = {
      kind: 'order', order_id: oid,
      size_value: `${it.h}x${it.w}`,
      /* назва фігури продубльована в size_label: цю колонку таблиця замовлень уже має */
      size_label: `Ростова фігура ${it.h}×${it.w} см | ${it.name} (${it.col}) | Prom ${it.id}`,
      price_uah: it.p, sides: 'catalog', same_both: true,
      first_name: q('#fname').value.trim(), last_name: q('#lname').value.trim(),
      phone: q('#phone').value.trim(), city: q('#city').value.trim(), np_branch: q('#np').value.trim(),
      source: 'rostovi-catalog', ts: new Date().toISOString(),
      design_id: it.id, design_name: 'Ростова фігура ' + it.name, design_collection: it.col, design_photo: PHOTO(it.id, 'front'),
      page_url: location.href,
    };
    let failed = null;
    const sending = postGAS(payload).then(() => true, err => { failed = err; return false; });
    await Promise.race([sending, wait(1200)]);
    if (failed) {
      note.className = 'note err';
      note.textContent = 'Не вдалося надіслати замовлення. Перевір інтернет і спробуй ще раз або напиши нам у Telegram.';
      btn.disabled = false; btn.textContent = `Замовити за ${fmt(it.p)}`;
      return;
    }
    trackOnce('order-' + oid, 'purchase', {
      ecommerce: { transaction_id: oid, currency: 'UAH', value: it.p, items: [gaItem(it)] },
      user_data: { phone_number: phoneE164(payload.phone), address: { first_name: payload.first_name, last_name: payload.last_name, city: payload.city, country: 'UA' } },
    }, 'Purchase', { value: it.p, currency: 'UAH', content_ids: [it.id], content_type: 'product' }, { eventID: oid });
    form.outerHTML = `<div class="done" role="status"><b>Замовлення прийнято</b>
      <span>Ростова фігура ${esc(it.name)}, ${it.h} см, ${fmt(it.p)}. Номер ${oid}.</span>
      <span class="done-st">Зателефонуємо найближчим часом, щоб підтвердити фігуру й відділення.</span></div>`;
    const doneBox = q('.done'), st = q('.done-st');
    const finish = async ok => {
      if (!ok) {
        if (!doneBox.isConnected) return;
        doneBox.querySelector('b').textContent = 'Замовлення не надіслано';
        st.innerHTML = 'Схоже, зник інтернет. <button class="btn" type="button" id="resend">Надіслати ще раз</button> або напиши нам номер замовлення в <a href="https://t.me/Masterform_ua" data-contact="telegram">Telegram</a>.';
        q('#resend').onclick = async () => { st.textContent = 'Надсилаємо…'; finish(await postGAS(payload).then(() => true, () => false)); };
        return;
      }
      let found = false;
      try {
        const r = await fetch(`${ORDER_URL}?check=${oid}&t=${Date.now()}`, { cache: 'no-store' });
        found = r.ok && (await r.json()).found;
      } catch { /* перевірка не критична */ }
      if (!found && st.isConnected) st.textContent = 'Якщо ми не зателефонуємо протягом дня, напиши нам цей номер у Telegram.';
    };
    sending.then(finish);
  };

  lockPage(true);
  dlg.showModal();
  if (!overlayEntry && location.protocol.startsWith('http')) { history.pushState({ overlay: true }, '', location.href); overlayEntry = true; }
  shots.scrollLeft = 0; gState();
  track('view_item', { ecommerce: { currency: 'UAH', value: it.p, items: [gaItem(it)] } },
    'ViewContent', { content_ids: [it.id], content_type: 'product', value: it.p, currency: 'UAH' });
}

/* ---------- перегляд списку ---------- */
{
  const cards = [...grid.querySelectorAll('.card')].slice(0, 12).map(fromCard);
  const name = document.getElementById('h1').textContent;
  track('view_item_list', { ecommerce: { item_list_id: location.pathname, item_list_name: name, items: cards.map(gaItem) } });
}
})();
