/*
 * pillow-mockup.js — макет подушки-дакімакури прямо в браузері.
 * Без бекенду, без CDN, без оплати за трафік.
 *
 *   const pm = new PillowMockup({ canvas, config: 'assets/pillow.json' });
 *   await pm.load();
 *   await pm.setPhoto(file);          // миттєвий макет
 *   await pm.removeBackground();      // за бажанням, 5–15 с
 *   const blob = await pm.exportPanel(1772);   // файл під друк
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class PillowMockup {
  constructor({ canvas, config = 'assets/pillow.json', quality = 2 }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.configUrl = config;
    this.quality = quality;       // панель рендериться у quality× від екранного розміру

    this.photo = null;            // оригінал (ImageBitmap)
    this.cutout = null;           // те саме без фону
    this.subject = null;          // що саме малюємо: cutout ?? photo
    this.subjectBox = null;       // {x,y,w,h} корисної частини в пікселях subject

    this.background = { type: 'blur', blur: 22 };
    this.transform = { margin: 0.045, scale: 1, dx: 0, dy: 0 };
  }

  /* ---------------------------------------------------------------- load */

  async load() {
    const cfg = await fetch(this.configUrl, { cache: 'force-cache' }).then(r => r.json());
    const dir = this.configUrl.replace(/[^/]*$/, '');
    const [mockup, mask] = await Promise.all([
      loadImage(dir + cfg.mockup.replace(/^assets\//, '')),
      loadImage(dir + cfg.mask.replace(/^assets\//, '')),
    ]);
    this.cfg = cfg;
    this.mockup = mockup;
    this.mask = mask;
    this.canvas.width = cfg.mockupSize[0];
    this.canvas.height = cfg.mockupSize[1];
    this.render();
    return this;
  }

  /* --------------------------------------------------------------- photo */

  async setPhoto(source) {
    // createImageBitmap сам застосовує EXIF-поворот — інакше фото з айфона лягає боком
    const blob = source instanceof Blob ? source : await fetch(source).then(r => r.blob());
    this.photo = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    this.cutout = null;
    this.subject = this.photo;
    this.subjectBox = { x: 0, y: 0, w: this.photo.width, h: this.photo.height };
    this.transform.scale = 1;
    this.transform.dx = this.transform.dy = 0;
    this.render();
    return this;
  }

  /**
   * Видалення фону. Модель (~40 МБ) тягнеться з CDN при першому виклику,
   * тому метод навмисно окремий — макет має бути видимим ще до нього.
   */
  async removeBackground(onProgress) {
    if (!this.photo) throw new Error('Спочатку setPhoto()');
    const { removeBackground } = await import(
      'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');

    const src = await bitmapToBlob(this.photo, 1600);
    const cut = await removeBackground(src, {
      model: 'isnet',
      output: { format: 'image/png' },
      progress: (key, cur, total) => onProgress?.(cur / total, key),
    });

    let bmp = await createImageBitmap(cut);
    bmp = trimAndDeFringe(bmp);            // прибираємо світлу облямівку по контуру
    this.cutout = bmp.bitmap;
    this.cutoutBox = bmp.box;
    this.subject = this.cutout;
    this.subjectBox = bmp.box;
    this.render();
    return this;
  }

  useCutout(on = true) {
    if (on && !this.cutout) return this;
    this.subject = on ? this.cutout : this.photo;
    this.subjectBox = on
      ? this.cutoutBox
      : { x: 0, y: 0, w: this.photo.width, h: this.photo.height };
    return this.render();
  }

  /* ---------------------------------------------------------- appearance */

  setBackground(bg) { this.background = bg; return this.render(); }
  nudge(dx, dy)     { this.transform.dx += dx; this.transform.dy += dy; return this.render(); }
  zoom(f)           { this.transform.scale = clamp(this.transform.scale * f, 0.4, 4); return this.render(); }

  /* -------------------------------------------------------------- render */

  /** Малює саму лише панель (те, що піде на друк) у вказаному розмірі. */
  drawPanel(pw, ph) {
    const cv = makeCanvas(pw, ph);
    const c = cv.getContext('2d');

    this._paintBackground(c, pw, ph);
    if (this.subject) {
      const hasCutout = this.subject === this.cutout;
      const m = hasCutout ? this.transform.margin : 0;
      const box = this.subjectBox;

      let dh, dw;
      if (hasCutout) {
        // вписуємо фігуру по висоті з полем
        dh = ph * (1 - 2 * m) * this.transform.scale;
        dw = dh * (box.w / box.h);
      } else {
        // без вирізання — заповнюємо панель повністю (cover)
        const k = Math.max(pw / box.w, ph / box.h) * this.transform.scale;
        dw = box.w * k; dh = box.h * k;
      }
      const dx = (pw - dw) / 2 + this.transform.dx * pw;
      const dy = (hasCutout ? ph * m : (ph - dh) / 2) + this.transform.dy * ph;
      c.drawImage(this.subject, box.x, box.y, box.w, box.h, dx, dy, dw, dh);
    }
    return cv;
  }

  _paintBackground(c, pw, ph) {
    const bg = this.background;
    if (bg.type === 'color') {
      c.fillStyle = bg.color; c.fillRect(0, 0, pw, ph); return;
    }
    if (bg.type === 'gradient') {
      const g = c.createLinearGradient(0, 0, 0, ph);
      g.addColorStop(0, bg.from); g.addColorStop(1, bg.to);
      c.fillStyle = g; c.fillRect(0, 0, pw, ph); return;
    }
    if (bg.type === 'blur' && this.photo) {
      const k = Math.max(pw / this.photo.width, ph / this.photo.height) * 1.1;
      const dw = this.photo.width * k, dh = this.photo.height * k;
      c.save();
      c.filter = `blur(${(bg.blur ?? 22) * (pw / 309)}px)`;
      c.drawImage(this.photo, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
      c.restore();
      return;
    }
    c.fillStyle = '#e8e2da'; c.fillRect(0, 0, pw, ph);
  }

  render() {
    const { ctx, cfg } = this;
    const { x, y, w, h } = cfg.box;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.mockup, 0, 0);
    if (!this.photo) return this;

    const q = this.quality;
    const panel = this.drawPanel(w * q, h * q);

    // обрізаємо панель за формою подушки
    const pc = panel.getContext('2d');
    pc.globalCompositeOperation = 'destination-in';
    pc.drawImage(this.mask, 0, 0, w * q, h * q);
    pc.globalCompositeOperation = 'source-over';

    ctx.drawImage(panel, x, y, w, h);
    return this;
  }

  /* -------------------------------------------------------------- export */

  /** Готовий до друку файл панелі. 1772 px ≈ 50 см при 90 dpi. */
  async exportPanel(widthPx = 1772, type = 'image/jpeg', q = 0.94) {
    const ph = Math.round(widthPx * this.cfg.ratio);
    return canvasToBlob(this.drawPanel(widthPx, ph), type, q);
  }

  /** Прев'ю з мокапом — те, що показуємо клієнту й шлемо в замовлення. */
  async exportPreview(type = 'image/jpeg', q = 0.9) {
    return canvasToBlob(this.canvas, type, q);
  }
}

/* ============================== helpers ================================= */

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
    i.onerror = () => rej(new Error('Не завантажився ' + src));
    i.src = src;
  });
}

async function bitmapToBlob(bmp, maxSide) {
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const cv = makeCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return canvasToBlob(cv, 'image/png', 1);
}

/**
 * Звужує альфу на 1 px і трохи розмиває назад. Без цього по краю вирізаної
 * фігури лишається світла кайма з кольорів старого фону — на темній подушці
 * вона дуже помітна. Заразом рахує bbox корисної частини.
 */
function trimAndDeFringe(bmp) {
  const cv = makeCanvas(bmp.width, bmp.height);
  const c = cv.getContext('2d');
  c.drawImage(bmp, 0, 0);
  const img = c.getImageData(0, 0, cv.width, cv.height);
  const d = img.data, W = cv.width, H = cv.height;

  // сепарабельний min-фільтр 3×3 по альфі
  const a = new Uint8ClampedArray(W * H);
  for (let i = 0, p = 3; i < W * H; i++, p += 4) a[i] = d[p];
  const tmp = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const l = a[o + Math.max(0, x - 1)], m = a[o + x], r = a[o + Math.min(W - 1, x + 1)];
      tmp[o + x] = Math.min(l, m, r);
    }
  }
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = tmp[Math.max(0, y - 1) * W + x];
      const m = tmp[y * W + x];
      const dn = tmp[Math.min(H - 1, y + 1) * W + x];
      const v = Math.min(u, m, dn);
      d[(y * W + x) * 4 + 3] = v;
      if (v > 20) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  c.putImageData(img, 0, 0);
  // легке розмиття краю, щоб не виглядало вирізаним ножицями
  const soft = makeCanvas(W, H);
  const sc = soft.getContext('2d');
  sc.filter = 'blur(0.6px)';
  sc.drawImage(cv, 0, 0);

  if (maxX < 0) { minX = minY = 0; maxX = W - 1; maxY = H - 1; }
  return {
    bitmap: soft,
    box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
}

export default PillowMockup;
