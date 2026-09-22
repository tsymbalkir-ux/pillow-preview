/*
 * pillow-mockup.js — макети подушки в браузері.
 *
 * Дві сутності:
 *   PhotoSide  — одне фото (сторона А або B): вирізання фону, масштаб, зсув.
 *   MockupView — один знімок-мокап із однією або кількома принт-зонами,
 *                кожна прив'язана до сторони.
 * Одне фото може малюватися одразу на кількох мокапах.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Мобільні браузери жорстко обмежують і пам'ять вкладки, і сумарну площу полотен. */
export const isMobile = () =>
  matchMedia('(max-width: 820px)').matches ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ============================ PhotoSide ================================= */

export class PhotoSide {
  constructor(id) {
    this.id = id;
    this.photo = null;        // оригінал (ImageBitmap)
    this.cutout = null;       // без фону
    this.subject = null;      // що саме малюємо
    this.box = null;          // корисна частина subject
    this.fitMode = 'cover';
    this.photoBox = null;
    this.photoFit = 'cover';
    this.file = null;
    this.bg = '#ffffff';      // колір подушки під фото
    this.cutOn = false;       // чи показана зараз вирізана версія (у кожної сторони своя)
    this.transform = { margin: 0.045, scale: 1, dx: 0, dy: 0 };
    this.onChange = null;
  }

  get filled() { return !!this.subject; }
  _changed() { this.onChange?.(); return this; }

  async setPhoto(source) {
    const blob = source instanceof Blob ? source : await fetch(source).then(r => r.blob());
    // createImageBitmap сам застосовує EXIF-поворот — інакше фото з телефона лягає боком
    let bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    // 12-мегапіксельне фото з телефона — це ~48 МБ у пам'яті. Тримати його
    // цілим немає сенсу: друк усе одно йде з панелі, а бюджет вкладки скінченний.
    const cap = isMobile() ? 2200 : 3200;
    const side0 = Math.max(bmp.width, bmp.height);
    if (side0 > cap) {
      const k = cap / side0;
      const cv = makeCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      const small = await createImageBitmap(cv);
      bmp.close?.();
      bmp = small;
    }
    this.photo = bmp;
    this.file = source instanceof Blob ? source : null;

    // прозорий PNG — це вже вирізана фігура, її вписуємо, а не розтягуємо
    const info = probeAlpha(this.photo);
    this.photoBox = info.box;
    this.photoFit = info.transparent ? 'contain' : 'cover';
    this.cutout = null;
    this.cutOn = false;
    this.subject = this.photo;
    this.box = info.box;
    this.fitMode = this.photoFit;
    this.transform.scale = 1;
    this.transform.dx = this.transform.dy = 0;
    return this._changed();
  }

  /** Копіює стан іншої сторони — для «те саме з обох боків». */
  copyFrom(o) {
    if (!o.filled) return this;
    this.photo = o.photo; this.file = o.file;
    this.cutout = o.cutout; this.cutoutBox = o.cutoutBox;
    this.photoBox = o.photoBox; this.photoFit = o.photoFit; this.bg = o.bg;
    this.cutOn = o.cutOn;
    this.subject = o.subject; this.box = o.box; this.fitMode = o.fitMode;
    this.transform = { ...o.transform };
    return this._changed();
  }

  /**
   * Вирізання фону. opts дозволяє відкотитись на легший режим:
   *   { maxSide, model, worker }
   * Мобільні браузери жорстко обмежують пам'ять вкладки, тому повна isnet
   * (~40 МБ ваг плюс стільки ж під час обробки) там часто вбиває процес.
   */
  async removeBackground(onProgress, opts = {}) {
    if (!this.photo) throw new Error('Спочатку setPhoto()');
    const mobile = matchMedia('(max-width: 820px)').matches ||
                   (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
                   /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const maxSide = opts.maxSide ?? (mobile ? 1024 : 1600);
    const model   = opts.model   ?? (mobile ? 'isnet_quint8' : 'isnet');

    const { removeBackground } = await import(
      'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');

    const src = await bitmapToBlob(this.photo, maxSide);
    const cfg = { model, output: { format: 'image/png' },
                  progress: (k, c, t) => onProgress?.(c / t, k) };
    if (opts.worker === false) cfg.proxyToWorker = false;

    const cut = await removeBackground(src, cfg);
    const trimmed = trimAndDeFringe(await createImageBitmap(cut));
    this.cutOn = true;
    this.cutout = trimmed.bitmap;
    this.cutoutBox = trimmed.box;
    this.subject = this.cutout;
    this.box = trimmed.box;
    this.fitMode = 'contain';
    return this._changed();
  }

  /**
   * Вирізання фону на сервері (/api/cutout → fal.ai BiRefNet).
   * Браузер нічого важкого не вантажить, тому працює однаково і на iPhone, і на ПК.
   */
  async removeBackgroundServer(onProgress, opts = {}) {
    if (!this.photo) throw new Error('Спочатку setPhoto()');
    // JPEG, щоб влізти в ліміт Vercel (сервер приймає до 4 000 000 символів).
    // Safari на iPhone кодує JPEG помітно «важче» за Chrome, і те саме фото 2000 px
    // могло не влізти → 413 → тихий перехід на грубу модель у браузері.
    // Тому поступово знижуємо якість, а далі розмір, доки не влізе.
    const LIMIT = 3_600_000;
    let side = opts.maxSide ?? 2000, q = 0.9, dataUrl = '';
    for (let i = 0; i < 8; i++) {
      const k = Math.min(1, side / Math.max(this.photo.width, this.photo.height));
      const cv = domCanvas(Math.round(this.photo.width * k), Math.round(this.photo.height * k));
      cv.getContext('2d').drawImage(this.photo, 0, 0, cv.width, cv.height);
      dataUrl = cv.toDataURL('image/jpeg', q);
      cv.width = cv.height = 1;
      if (dataUrl.length <= LIMIT) break;
      console.info('cutout: фото завелике', Math.round(dataUrl.length / 1e6 * 10) / 10, 'млн символів, стискаємо');
      if (q > 0.76) q -= 0.07; else side = Math.round(side * 0.85);
    }
    onProgress?.(0.2);

    // плавний «фейковий» прогрес, поки сервер думає (зазвичай 2–6 с)
    let p = 0.2;
    const tick = setInterval(() => { p = Math.min(0.95, p + 0.05); onProgress?.(p); }, 400);
    let r;
    try {
      r = await fetch('/api/cutout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, model: opts.model, engine: opts.engine }),
      });
    } finally { clearInterval(tick); }
    if (!r.ok) throw new Error('сервер: ' + r.status + ' ' + (await r.text()).slice(0, 200));

    console.info('cutout:', r.headers.get('x-cutout-model'), r.headers.get('x-cutout-ms') + ' мс');
    let blob;
    if ((r.headers.get('content-type') || '').includes('json')) {
      const { url } = await r.json();               // великий PNG — беремо напряму з CDN fal
      blob = await (await fetch(url)).blob();
    } else blob = await r.blob();
    const cut = await createImageBitmap(blob);
    onProgress?.(1);
    // серверні моделі вже дають чисті краї — не підрізаємо і не розмиваємо їх
    const trimmed = trimOnly(cut);
    this.cutOn = true;
    this.cutout = trimmed.bitmap;
    this.cutoutBox = trimmed.box;
    this.subject = this.cutout;
    this.box = trimmed.box;
    this.fitMode = 'contain';
    return this._changed();
  }

  /**
   * Легке вирізання через MediaPipe Selfie Segmenter.
   * Модель ~250 КБ проти десятків мегабайт в isnet, тому на iOS, де
   * onnxruntime падає з Out of memory ще на створенні сесії, працює саме вона.
   */
  async removeBackgroundLite(onProgress) {
    if (!this.photo) throw new Error('Спочатку setPhoto()');
    const BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    onProgress?.(0.1);
    const vision = await import(BASE + '/vision_bundle.mjs');
    onProgress?.(0.35);
    const files = await vision.FilesetResolver.forVisionTasks(BASE + '/wasm');
    onProgress?.(0.6);
    const seg = await vision.ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite' },
      runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false,
    });
    onProgress?.(0.8);

    const cap = 720;
    const k = Math.min(1, cap / Math.max(this.photo.width, this.photo.height));
    const w = Math.round(this.photo.width * k), h = Math.round(this.photo.height * k);
    const work = domCanvas(w, h);                 // MediaPipe не приймає OffscreenCanvas
    work.getContext('2d').drawImage(this.photo, 0, 0, w, h);

    let alphaCv;
    try {
      const res = seg.segment(work);
      const cm = res.categoryMask;
      const mw = cm.width, mh = cm.height, arr = cm.getAsUint8Array();

      // індекси категорій бувають 0/1 або 0/255 — визначаємо поріг за даними
      let maxv = 0;
      for (let i = 0; i < arr.length; i++) if (arr[i] > maxv) maxv = arr[i];
      const thr = maxv > 1 ? maxv / 2 : 0;

      // і перевіряємо, чи не переплутані передній план із тлом
      let all = 0, mid = 0, midN = 0;
      const x0 = mw >> 2, x1 = mw - x0, y0 = mh >> 2, y1 = mh - y0;
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
        const on = arr[y * mw + x] > thr ? 1 : 0;
        all += on;
        if (x >= x0 && x < x1 && y >= y0 && y < y1) { mid += on; midN++; }
      }
      const invert = (mid / midN) < (all / (mw * mh));

      const mc = domCanvas(mw, mh);
      const mctx = mc.getContext('2d');
      const img = mctx.createImageData(mw, mh);
      for (let i = 0; i < mw * mh; i++) {
        let on = arr[i] > thr;
        if (invert) on = !on;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
        img.data[i * 4 + 3] = on ? 255 : 0;
      }
      mctx.putImageData(img, 0, 0);
      cm.close?.(); res.close?.();

      alphaCv = domCanvas(w, h);
      const oc = alphaCv.getContext('2d');
      oc.drawImage(work, 0, 0);
      oc.imageSmoothingQuality = 'high';
      oc.globalCompositeOperation = 'destination-in';
      oc.drawImage(mc, 0, 0, w, h);
      oc.globalCompositeOperation = 'source-over';
    } finally {
      seg.close?.();
    }

    const trimmed = trimAndDeFringe(alphaCv);
    this.cutOn = true;
    this.cutout = trimmed.bitmap;
    this.cutoutBox = trimmed.box;
    this.subject = this.cutout;
    this.box = trimmed.box;
    this.fitMode = 'contain';
    return this._changed();
  }

  useCutout(on = true) {
    if (on && !this.cutout) return this;
    this.cutOn = on;
    this.subject = on ? this.cutout : this.photo;
    this.box = on ? this.cutoutBox : this.photoBox;
    this.fitMode = on ? 'contain' : this.photoFit;
    return this._changed();
  }

  nudge(dx, dy) {
    this.transform.dx = clamp(this.transform.dx + dx, -0.7, 0.7);
    this.transform.dy = clamp(this.transform.dy + dy, -0.7, 0.7);
    return this._changed();
  }
  setBg(color) { this.bg = color; return this._changed(); }
  setScale(v) { this.transform.scale = clamp(v, 0.5, 2.6); return this._changed(); }
  zoom(f) { return this.setScale(this.transform.scale * f); }
  resetFit() {
    this.transform.scale = 1; this.transform.dx = this.transform.dy = 0;
    return this._changed();
  }

  /** Панель принта заданого розміру: біла основа + фото. Без маски й складок. */
  drawPanel(pw, ph, reuse) {
    // reuse — полотно, яке можна перемалювати замість того, щоб плодити нові:
    // на мобільних сумарна площа полотен обмежена, і кожен зайвий кадр коштує пам'яті
    const cv = (reuse && reuse.width === pw && reuse.height === ph) ? reuse : makeCanvas(pw, ph);
    const c = cv.getContext('2d');
    c.clearRect(0, 0, pw, ph);
    c.fillStyle = this.bg;          // інакше крізь прозорий PNG світить мокап
    c.fillRect(0, 0, pw, ph);
    if (!this.subject) return cv;

    const contain = this.fitMode === 'contain';
    const b = this.box, t = this.transform;
    let dw, dh;
    if (contain) {
      dh = ph * (1 - 2 * t.margin) * t.scale;
      dw = dh * (b.w / b.h);
    } else {
      const k = Math.max(pw / b.w, ph / b.h) * t.scale;
      dw = b.w * k; dh = b.h * k;
    }
    const dx = (pw - dw) / 2 + t.dx * pw;
    const dy = (contain ? ph * t.margin : (ph - dh) / 2) + t.dy * ph;
    c.drawImage(this.subject, b.x, b.y, b.w, b.h, dx, dy, dw, dh);
    return cv;
  }

  /** Файл під друк. 1772 px ≈ 50 см при 90 dpi. */
  async exportPanel(widthPx = 1772, ratio = 3, type = 'image/jpeg', q = 0.94) {
    return canvasToBlob(this.drawPanel(widthPx, Math.round(widthPx * ratio)), type, q);
  }
}

/* ============================ MockupView ================================ */

/** Коротка довідка про браузер — щоб зрозуміти, чому впало вирізання фону. */
export function envInfo() {
  const ua = navigator.userAgent;
  const bits = [];
  bits.push(/iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : 'desktop');
  if (navigator.deviceMemory) bits.push(navigator.deviceMemory + 'GB');
  bits.push('OffscreenCanvas:' + (typeof OffscreenCanvas !== 'undefined' ? '+' : '−'));
  bits.push('WASM:' + (typeof WebAssembly !== 'undefined' ? '+' : '−'));
  bits.push('SAB:' + (typeof SharedArrayBuffer !== 'undefined' ? '+' : '−'));
  bits.push('isolated:' + (self.crossOriginIsolated ? '+' : '−'));
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.filter = 'blur(1px)';
    bits.push('ctx.filter:' + (c.filter === 'blur(1px)' ? '+' : '−'));
  } catch { bits.push('ctx.filter:?'); }
  return bits.join(' · ');
}

export class MockupView {
  constructor({ canvas, cfg, dir = '', sides, quality = 2, printRatio = 3 }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = cfg;
    this.dir = dir;
    this.sides = sides;             // { A: PhotoSide, B: PhotoSide }
    this.quality = quality ?? (isMobile() ? 1 : 2);
    this.printRatio = printRatio;   // висота/ширина друкованої панелі — однакова для A і B
    this._panels = [];              // кеш полотен по зонах
    this._prints = [];              // кеш панелей принта по зонах
  }

  /** Звільняє полотно й кеш — щоб віддати пам'ять перед важкою операцією. */
  release() {
    this._panels = []; this._prints = [];
    this._w = this.canvas.width; this._h = this.canvas.height;
    this.canvas.width = 1; this.canvas.height = 1;
  }
  restore() {
    if (!this._w) return this;
    this.canvas.width = this._w; this.canvas.height = this._h;
    return this.render();
  }

  async load(tag = '') {
    const rel = p => loadImage(this.dir + p + tag);
    this.image = await rel(this.cfg.image);
    this.zones = await Promise.all(this.cfg.zones.map(async z => ({
      ...z,
      maskImg: await rel(z.mask),
      shadeImg: z.shade ? await rel(z.shade) : null,
    })));
    // Де в зоні справді лежить подушка (без тіні й порожніх полів).
    // Фото треба вписувати сюди, а не в box: у зон A і B box різного розміру
    // і подушка стоїть у ньому не по центру, тому однаковий transform
    // давав на B більше й правіше фото.
    this.zones.forEach(z => { z.body = z.body || maskBody(z.maskImg, z.box); });
    this.canvas.width = this.cfg.size[0];
    this.canvas.height = this.cfg.size[1];
    this.render();
    return this;
  }

  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // під розмір полотна, а не в натуральну величину: так розбіжність версій
    // файлів не з'їжджає всю картинку
    ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);

    this.zones.forEach((z, i) => {
      const side = this.sides[z.side];
      if (!side?.filled) return;
      const q = this.quality, { x, y, w, h } = z.box, bd = z.body;
      const W = Math.round(w * q), H = Math.round(h * q);

      // 1) панель принта в пропорції друку — та сама картинка, що піде у файл
      const pw = Math.max(1, Math.round(bd.w * q));
      const ph = Math.max(1, Math.round(pw * this.printRatio));
      const print = side.drawPanel(pw, ph, this._prints[i]);
      this._prints[i] = print;

      // 2) кладемо її рівно на тіло подушки всередині зони
      let panel = this._panels[i];
      if (!panel || panel.width !== W || panel.height !== H) panel = makeCanvas(W, H);
      this._panels[i] = panel;
      const pc = panel.getContext('2d');
      pc.globalCompositeOperation = 'source-over';
      pc.clearRect(0, 0, W, H);
      pc.fillStyle = side.bg;
      pc.fillRect(0, 0, W, H);
      pc.drawImage(print, bd.x * q, bd.y * q, bd.w * q, bd.h * q);

      if (z.shadeImg) {             // складки справжньої тканини
        pc.globalCompositeOperation = 'multiply';
        pc.drawImage(z.shadeImg, 0, 0, W, H);
      }
      pc.globalCompositeOperation = 'destination-in';
      pc.drawImage(z.maskImg, 0, 0, W, H);
      pc.globalCompositeOperation = 'source-over';
      ctx.drawImage(panel, x, y, w, h);
    });
    return this;
  }

  async exportPreview(type = 'image/jpeg', q = 0.9) {
    return canvasToBlob(this.canvas, type, q);
  }
}

/* ============================ MiniPillow =============================== */

/** Маленька подушка для схем розміру: власна маска й складки, пропорція 1:3. */
export class MiniPillow {
  constructor({ cfg, dir = '' }) { this.cfg = cfg; this.dir = dir; }
  async load(tag = '') {
    const rel = p => loadImage(this.dir + p + tag);
    const [e, m, s] = await Promise.all(
      [rel(this.cfg.empty), rel(this.cfg.mask), rel(this.cfg.shade)]);
    this.empty = e; this.mask = m; this.shade = s;
    this.w = this.cfg.size[0]; this.h = this.cfg.size[1];
    return this;
  }
  draw(side) {
    if (!side?.filled) return this.empty;
    const { w, h } = this;
    const panel = side.drawPanel(w, h, this._panel);
    this._panel = panel;
    const c = panel.getContext('2d');
    c.globalCompositeOperation = 'multiply'; c.drawImage(this.shade, 0, 0, w, h);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(this.mask, 0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    return panel;
  }
}

/* ============================== helpers ================================ */

/** Полотно саме в DOM: деякі бібліотеки не приймають OffscreenCanvas. */
function domCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function canvasToBlob(cv, type, q) {
  if (cv.convertToBlob) return cv.convertToBlob({ type, quality: q });
  return new Promise(res => cv.toBlob(res, type, q));
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Не завантажився файл: ' + src));
    i.src = src;
  });
}
async function bitmapToBlob(bmp, maxSide) {
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const cv = makeCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return canvasToBlob(cv, 'image/png', 1);
}

/** Прямокутник непрозорої частини маски, у координатах box зони. */
function maskBody(img, box) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const full = { x: 0, y: 0, w: box.w, h: box.h };
  const k = Math.min(1, 400 / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
  const cv = makeCanvas(w, h);
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0, w, h);
  let d;
  try { d = c.getImageData(0, 0, w, h).data; } catch { return full; }
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    if (d[(yy * w + xx) * 4 + 3] < 128) continue;
    if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
    if (yy < minY) minY = yy; if (yy > maxY) maxY = yy;
  }
  if (maxX < 0) return full;
  const sx = box.w / w, sy = box.h / h;   // маска розтягується на весь box
  return { x: minX * sx, y: minY * sy,
           w: (maxX - minX + 1) * sx, h: (maxY - minY + 1) * sy };
}

/** Чи є прозорість і де лежить непорожня частина. */
function probeAlpha(bmp) {
  const full = { x: 0, y: 0, w: bmp.width, h: bmp.height };
  const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = makeCanvas(w, h);
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(bmp, 0, 0, w, h);
  let d;
  try { d = c.getImageData(0, 0, w, h).data; } catch { return { transparent: false, box: full }; }
  let clear = 0, minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] < 24) { clear++; continue; }
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0 || clear / (w * h) < 0.02) return { transparent: false, box: full };
  return { transparent: true, box: {
    x: Math.floor(minX / k), y: Math.floor(minY / k),
    w: Math.ceil((maxX - minX + 1) / k), h: Math.ceil((maxY - minY + 1) / k) } };
}

/**
 * Звужує альфу на 1 px і трохи розмиває назад: інакше по краю вирізаної
 * фігури лишається світла кайма з кольорів старого фону.
 */
/** Лише обрізає прозорі поля, не чіпаючи ні альфу, ні кольори. */
function trimOnly(bmp) {
  const cv = makeCanvas(bmp.width, bmp.height);
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(bmp, 0, 0);
  const d = c.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 20) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) { minX = minY = 0; maxX = W - 1; maxY = H - 1; }
  return { bitmap: cv, box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}

function trimAndDeFringe(bmp) {
  const cv = makeCanvas(bmp.width, bmp.height);
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(bmp, 0, 0);
  const img = c.getImageData(0, 0, cv.width, cv.height);
  const d = img.data, W = cv.width, H = cv.height;
  const a = new Uint8ClampedArray(W * H);
  for (let i = 0, p = 3; i < W * H; i++, p += 4) a[i] = d[p];
  const tmp = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++)
      tmp[o + x] = Math.min(a[o + Math.max(0, x - 1)], a[o + x], a[o + Math.min(W - 1, x + 1)]);
  }
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = Math.min(tmp[Math.max(0, y - 1) * W + x], tmp[y * W + x],
                       tmp[Math.min(H - 1, y + 1) * W + x]);
    d[(y * W + x) * 4 + 3] = v;
    if (v > 20) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  c.putImageData(img, 0, 0);
  const soft = makeCanvas(W, H);
  const sc = soft.getContext('2d');
  sc.filter = 'blur(0.6px)';
  sc.drawImage(cv, 0, 0);
  if (maxX < 0) { minX = minY = 0; maxX = W - 1; maxY = H - 1; }
  return { bitmap: soft, box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}
