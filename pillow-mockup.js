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
    this.transform = { margin: 0.045, scale: 1, dx: 0, dy: 0 };
    this.onChange = null;
  }

  get filled() { return !!this.subject; }
  _changed() { this.onChange?.(); return this; }

  async setPhoto(source) {
    const blob = source instanceof Blob ? source : await fetch(source).then(r => r.blob());
    // createImageBitmap сам застосовує EXIF-поворот — інакше фото з телефона лягає боком
    this.photo = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    this.file = source instanceof Blob ? source : null;

    // прозорий PNG — це вже вирізана фігура, її вписуємо, а не розтягуємо
    const info = probeAlpha(this.photo);
    this.photoBox = info.box;
    this.photoFit = info.transparent ? 'contain' : 'cover';
    this.cutout = null;
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
    this.cutout = trimmed.bitmap;
    this.cutoutBox = trimmed.box;
    this.subject = this.cutout;
    this.box = trimmed.box;
    this.fitMode = 'contain';
    return this._changed();
  }

  useCutout(on = true) {
    if (on && !this.cutout) return this;
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
  drawPanel(pw, ph) {
    const cv = makeCanvas(pw, ph);
    const c = cv.getContext('2d');
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
  constructor({ canvas, cfg, dir = '', sides, quality = 2 }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = cfg;
    this.dir = dir;
    this.sides = sides;             // { A: PhotoSide, B: PhotoSide }
    this.quality = quality;
  }

  async load(tag = '') {
    const rel = p => loadImage(this.dir + p + tag);
    this.image = await rel(this.cfg.image);
    this.zones = await Promise.all(this.cfg.zones.map(async z => ({
      ...z,
      maskImg: await rel(z.mask),
      shadeImg: z.shade ? await rel(z.shade) : null,
    })));
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

    for (const z of this.zones) {
      const side = this.sides[z.side];
      if (!side?.filled) continue;
      const q = this.quality, { x, y, w, h } = z.box;
      const panel = side.drawPanel(w * q, h * q);
      const pc = panel.getContext('2d');
      if (z.shadeImg) {             // складки справжньої тканини
        pc.globalCompositeOperation = 'multiply';
        pc.drawImage(z.shadeImg, 0, 0, w * q, h * q);
      }
      pc.globalCompositeOperation = 'destination-in';
      pc.drawImage(z.maskImg, 0, 0, w * q, h * q);
      pc.globalCompositeOperation = 'source-over';
      ctx.drawImage(panel, x, y, w, h);
    }
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
    const panel = side.drawPanel(w, h);
    const c = panel.getContext('2d');
    c.globalCompositeOperation = 'multiply'; c.drawImage(this.shade, 0, 0, w, h);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(this.mask, 0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    return panel;
  }
}

/* ============================== helpers ================================ */

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
