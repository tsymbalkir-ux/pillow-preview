/*
 * standee-3d.js — редактор і обʼємне превʼю ростової фігури.
 *
 * Бере вирізаний обʼєкт (полотно з прозорістю), будує з нього контур для різки
 * (з обводкою, без дрібних дірок і острівців), видавлює пластину 5 мм,
 * натягує друк спереду, обраний зворот ззаду і ставить підпірку.
 * three.js вантажиться динамічно — як і в dakimakura-3d.js.
 */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
const BOARD_MM = 5;       // товщина пластику
const MASK_H = 760;       // роздільність маски для контуру (по висоті обʼєкта)
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const MATERIAL = {              // колір звороту, торців і ніжок
  plastic:   { back: '#F1F0EC', edge: 0xF1EFEA, noise: 5 },
  cardboard: { back: '#C49B6C', edge: 0xB78D5F, noise: 10, flutes: true },
};
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ================= маска → поле відстаней → контур ================= */

function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
}
/** Відстань кожного пікселя до найближчого, де on[i] = 1 (Felzenszwalb). */
function edt(on, W, H) {
  const g = new Float64Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = on[i] ? 0 : 1e20;
  const n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n),
        v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = g[y * W + x];
    edt1d(f, H, d, v, z);
    for (let y = 0; y < H; y++) g[y * W + x] = d[y];
  }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = g[y * W + x];
    edt1d(f, W, d, v, z);
    for (let x = 0; x < W; x++) out[y * W + x] = Math.sqrt(d[x]);
  }
  return out;
}

/** Проміжок між ногами не вирізаємо: від найнижчої точки кожного стовпця
    між крайніми «опорними» стовпцями заливаємо до підлоги — низ стає суцільним. */
function fillBetweenLegs(F, W, H) {
  let yF = -1, yT = H;
  for (let y = H - 1; y >= 0 && yF < 0; y--) for (let x = 0; x < W; x++) if (F[y * W + x] > 0) { yF = y; break; }
  for (let y = 0; y < H && yT === H; y++) for (let x = 0; x < W; x++) if (F[y * W + x] > 0) { yT = y; break; }
  if (yF < 0) return;
  const low = new Int32Array(W).fill(-1);
  for (let x = 0; x < W; x++) for (let y = yF; y >= 0; y--) if (F[y * W + x] > 0) { low[x] = y; break; }
  const near = yF - (yF - yT) * 0.03;
  let g0 = -1, g1 = -1;
  for (let x = 0; x < W; x++) if (low[x] >= near) { if (g0 < 0) g0 = x; g1 = x; }
  if (g0 < 0) return;
  for (let x = g0; x <= g1; x++) {
    if (low[x] < 0) continue;
    for (let y = low[x] + 1; y <= yF; y++) if (F[y * W + x] <= 0) F[y * W + x] = 1;
  }
}

/** Маленькі дірки (між рукою і тілом тощо) заливаємо — їх важко вирізати. */
function fillSmallHoles(F, W, H) {
  const N = W * H, outside = new Uint8Array(N), stack = new Int32Array(N);
  let sp = 0, inCount = 0;
  for (let i = 0; i < N; i++) if (F[i] > 0) inCount++;
  const push = i => { if (!outside[i] && F[i] <= 0) { outside[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (sp) {
    const i = stack[--sp], x = i % W;
    if (x > 0) push(i - 1); if (x < W - 1) push(i + 1);
    if (i >= W) push(i - W); if (i < N - W) push(i + W);
  }
  const seen = new Uint8Array(N), comp = [];
  for (let s = 0; s < N; s++) {
    if (F[s] > 0 || outside[s] || seen[s]) continue;
    comp.length = 0; seen[s] = 1; stack[0] = s; sp = 1;
    while (sp) {
      const i = stack[--sp]; comp.push(i); const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
        if (j >= 0 && j < N && !seen[j] && F[j] <= 0 && !outside[j]) { seen[j] = 1; stack[sp++] = j; }
    }
    if (comp.length < inCount * 0.02) for (const i of comp) F[i] = 0.5;
  }
}

/** Marching squares по полю F (F > 0 — всередині). Повертає замкнені контури. */
function contours(F, W, H) {
  const nb = new Int32Array(W * H * 4).fill(-1);
  const link = (a, b) => { nb[a * 2 + (nb[a * 2] < 0 ? 0 : 1)] = b; nb[b * 2 + (nb[b * 2] < 0 ? 0 : 1)] = a; };
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const i = y * W + x;
    const tl = F[i], tr = F[i + 1], br = F[i + W + 1], bl = F[i + W];
    const c = (tl > 0 ? 8 : 0) | (tr > 0 ? 4 : 0) | (br > 0 ? 2 : 0) | (bl > 0 ? 1 : 0);
    if (c === 0 || c === 15) continue;
    const T = i * 2, B = (i + W) * 2, L = i * 2 + 1, R = (i + 1) * 2 + 1;
    const mid = (tl + tr + br + bl) > 0;
    switch (c) {
      case 1: link(L, B); break;   case 2: link(B, R); break;  case 3: link(L, R); break;
      case 4: link(T, R); break;   case 6: link(T, B); break;  case 7: link(L, T); break;
      case 8: link(L, T); break;   case 9: link(T, B); break;  case 11: link(T, R); break;
      case 12: link(L, R); break;  case 13: link(B, R); break; case 14: link(L, B); break;
      case 5: if (mid) { link(L, T); link(B, R); } else { link(T, R); link(L, B); } break;
      case 10: if (mid) { link(T, R); link(L, B); } else { link(L, T); link(B, R); } break;
    }
  }
  const pos = e => {
    const cell = e >> 1, x = cell % W, y = (cell / W) | 0;
    if (e & 1) { const a = F[cell], b = F[cell + W]; return [x, y + a / (a - b)]; }
    const a = F[cell], b = F[cell + 1]; return [x + a / (a - b), y];
  };
  const seen = new Uint8Array(W * H * 2), loops = [];
  for (let e = 0; e < W * H * 2; e++) {
    if (seen[e] || nb[e * 2] < 0) continue;
    const loop = []; let prev = -1, cur = e;
    while (cur >= 0 && !seen[cur]) {
      seen[cur] = 1; loop.push(pos(cur));
      const a = nb[cur * 2], b = nb[cur * 2 + 1];
      const next = a !== prev ? a : b; prev = cur; cur = next;
    }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}

const area = p => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return s / 2; };
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function simplifyLoop(loop, eps) {
  let far = 0, fd = 0;
  for (let i = 1; i < loop.length; i++) { const d = (loop[i][0] - loop[0][0]) ** 2 + (loop[i][1] - loop[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const a = rdp(loop.slice(0, far + 1), eps), b = rdp(loop.slice(far).concat([loop[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

/** Обрізає прозорі поля навколо обʼєкта. Повертає полотно. */
export function trimAlpha(img, max = 2400) {
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = canvas(Math.round(img.width * k), Math.round(img.height * k));
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++)
    if (d[(y * c.width + xx) * 4 + 3] > 16) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('на зображенні немає обʼєкта');
  const o = canvas(x1 - x0 + 1, y1 - y0 + 1);
  o.getContext('2d').drawImage(c, -x0, -y0);
  return o;
}

/* ================= сам редактор ================= */

export class Standee3D {
  /**
   * host   — елемент, у який вставляємо полотно (розмір задає CSS)
   * mobile — true, щоб зменшити текстури й роздільність
   */
  constructor({ host, mobile = false, threeUrl = THREE_URL }) {
    this.host = host;
    this.mobile = mobile;
    this.threeUrl = threeUrl;
    // back: 'plastic' (білий ПВХ) | 'cardboard' (крафтовий картон)
    this.opts = { heightCm: 150, outlineCm: 2, back: 'plastic', strut: true };
    this.src = null;
    this.yaw = 0.45; this.pitch = 0.06; this.dist = 1; this.vYaw = 0; this.target = null;
    this.auto = !reduced();
    this.onUserTurn = null;        // () — людина сама крутнула модель
    this.onBuilt = null;           // ({ heightCm, widthCm }) — фігуру перебудовано
  }

  async init() {
    if (this.ready) return this;
    const T = this.T = await import(this.threeUrl);
    const r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.75 : 2));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.NoToneMapping;          // кольори друку мають лишитись як у файлі
    r.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab';
    r.domElement.setAttribute('role', 'img');
    r.domElement.setAttribute('aria-label', 'Обʼємна модель ростової фігури. Потягни, щоб покрутити.');
    this.host.prepend(r.domElement);

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(30, 1, 0.05, 60);
    this.scene.add(new T.HemisphereLight(0xffffff, 0xe6dfe2, 1.7));
    const key = new T.DirectionalLight(0xffffff, 1.9); key.position.set(-2, 2.5, 3); this.scene.add(key);
    const rim = new T.DirectionalLight(0xffffff, 2.1); rim.position.set(2.5, 2, -3); this.scene.add(rim);

    // мʼяка тінь на підлозі
    const sc = canvas(128, 128), sg = sc.getContext('2d'), grd = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(40,20,30,.38)'); grd.addColorStop(1, 'rgba(40,20,30,0)');
    sg.fillStyle = grd; sg.fillRect(0, 0, 128, 128);
    this.shadow = new T.Mesh(new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.001;
    this.scene.add(this.shadow);

    new ResizeObserver(() => this._resize()).observe(this.host);
    this._resize();
    this._bind(r.domElement);
    // не малюємо, коли блок за межами екрана
    this.visible = true;
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(this.host);
    const loop = () => { requestAnimationFrame(loop); if (this.visible) this._frame(); };
    requestAnimationFrame(loop);
    this.ready = true;
    if (this.src) this._rebuildNow();
    return this;
  }

  /** Новий обʼєкт: полотно чи bitmap з прозорістю (або без — тоді фігура прямокутна). */
  setSource(img) { this.src = trimAlpha(img); this._rebuild(); return this; }
  /** Змінити налаштування: heightCm, outlineCm, back, strut. */
  set(patch) { Object.assign(this.opts, patch); this._rebuild(); return this; }
  /** Повернути до ракурсу: 'front' | 'side' | 'back'. */
  show(which) {
    const tgt = { front: 0, side: Math.PI / 2, back: Math.PI }[which] ?? 0;
    this.auto = false; this.vYaw = 0;
    this.target = this.yaw + Math.atan2(Math.sin(tgt - this.yaw), Math.cos(tgt - this.yaw));
  }

  /** Лицьовий бік по контуру (для мініатюр і файлу друку). */
  front(maxSide = 400) { return this._cutTo(this.tex?.front, maxSide, false); }
  back(maxSide = 400) { return this._cutTo(this.tex?.back, maxSide, true); }
  /** Друк лицьового боку в повній роздільності текстури, PNG з прозорістю. */
  exportFront() { const c = this.front(4000); return new Promise(res => c.toBlob(res, 'image/png')); }
  /** Кадр 3D-сцени як JPEG. */
  snapshot() { return new Promise(res => this.renderer.domElement.toBlob(res, 'image/jpeg', 0.9)); }

  /* ---------- побудова ---------- */

  _rebuild() {
    if (!this.ready || !this.src) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => this._rebuildNow(), 50);
  }
  _rebuildNow() {
    const art = this.art = this._art();
    this.tex = this._textures(art);
    this._mesh(art, this.tex);
  }

  _art() {
    const src = this.src, o = this.opts;
    const k = MASK_H / src.height;
    const pxPerCm = MASK_H / Math.max(40, o.heightCm - 2 * o.outlineCm);
    const r = o.outlineCm * pxPerCm;
    const c = r > 0 ? Math.max(2, r * 0.8) : 0;       // «закриття» — округлює внутрішні кути
    const pad = Math.ceil(r + c) + 4;
    const sw = Math.round(src.width * k);
    const W = sw + pad * 2, H = MASK_H + pad * 2;

    const mc = canvas(W, H), mx = mc.getContext('2d', { willReadFrequently: true });
    mx.drawImage(src, pad, pad, sw, MASK_H);
    const data = mx.getImageData(0, 0, W, H).data;
    const N = W * H, A = new Float32Array(N), S = new Uint8Array(N);
    for (let i = 0; i < N; i++) { A[i] = data[i * 4 + 3] / 255; S[i] = A[i] > 0.5 ? 1 : 0; }

    const F = new Float32Array(N);
    if (r <= 0) {
      for (let i = 0; i < N; i++) F[i] = A[i] - 0.5;
    } else {
      const D1 = edt(S, W, H), R = r + c, notM = new Uint8Array(N);
      for (let i = 0; i < N; i++) notM[i] = D1[i] > R ? 1 : 0;
      const D2 = edt(notM, W, H);
      for (let i = 0; i < N; i++) F[i] = notM[i] ? -(D1[i] - R) : D2[i] - c;
    }
    fillBetweenLegs(F, W, H);
    fillSmallHoles(F, W, H);

    const loops = contours(F, W, H);
    if (!loops.length) throw new Error('не вдалося знайти контур обʼєкта');
    loops.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
    const outer = loops[0], sign = Math.sign(area(outer));
    const holes = loops.slice(1).filter(l => Math.sign(area(l)) !== sign && Math.abs(area(l)) > 40 && inside(l[0], outer));

    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const [x, y] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }

    // де кріпити підпірку: центр заповнених пікселів на ~55% висоти
    const rowY = Math.round(maxY - (maxY - minY) * 0.55);
    let sx = 0, cnt = 0;
    for (let x = 0; x < W; x++) if (F[rowY * W + x] > 0) { sx += x; cnt++; }

    // згладжена маска форми — для мініатюр і файлу друку
    const shape = canvas(W, H), sx2 = shape.getContext('2d'), sd = sx2.createImageData(W, H);
    for (let i = 0; i < N; i++) sd.data[i * 4 + 3] = Math.max(0, Math.min(1, F[i] + 0.5)) * 255;
    sx2.putImageData(sd, 0, 0);

    return { W, H, pad, sw, outer: simplifyLoop(outer, 0.45), holes: holes.map(h => simplifyLoop(h, 0.45)),
             minX, maxX, minY, maxY, strutX: cnt ? sx / cnt : (minX + maxX) / 2, shape };
  }

  _textures(art) {
    const o = this.opts, src = this.src;
    const texMax = this.mobile ? 1536 : 2048;
    const q = Math.min(texMax / art.W, texMax / art.H, 4);
    const tw = Math.round(art.W * q), th = Math.round(art.H * q);
    const px = art.pad * q, pw = art.sw * q, ph = MASK_H * q;

    const front = canvas(tw, th), f = front.getContext('2d');
    f.fillStyle = '#FFFFFF'; f.fillRect(0, 0, tw, th);   // обводка — білий фон друку
    f.imageSmoothingQuality = 'high';
    f.drawImage(src, px, px, pw, ph);

    const back = canvas(tw, th), b = back.getContext('2d');
    const mat = MATERIAL[o.back] || MATERIAL.plastic;
    b.fillStyle = mat.back; b.fillRect(0, 0, tw, th);
    const img = b.getImageData(0, 0, tw, th), d = img.data, step = Math.max(3, Math.round(tw / 260));
    for (let i = 0; i < d.length; i += 4) {
      let n = (Math.random() - 0.5) * mat.noise;
      if (mat.flutes && ((i / 4) % tw) % step === 0) n -= 5;     // ледь помітні хвилі гофрокартону
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    b.putImageData(img, 0, 0);
    return { front, back };
  }

  _cutTo(tex, maxSide, mirror) {
    const art = this.art; if (!tex || !art) return canvas(1, 1);
    const bw = art.maxX - art.minX, bh = art.maxY - art.minY, sc = tex.width / art.W;
    const k = Math.min(maxSide / Math.max(bw, bh), sc);
    const out = canvas(Math.ceil(bw * k), Math.ceil(bh * k)), t = out.getContext('2d');
    if (mirror) { t.translate(out.width, 0); t.scale(-1, 1); }
    t.drawImage(tex, art.minX * sc, art.minY * sc, bw * sc, bh * sc, 0, 0, out.width, out.height);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(art.shape, art.minX, art.minY, bw, bh, 0, 0, out.width, out.height);
    return out;
  }

  _mesh(art, tex) {
    const T = this.T, o = this.opts;
    if (this.figure) {
      this.scene.remove(this.figure);
      this.figure.traverse(m => { m.geometry?.dispose(); [].concat(m.material || []).forEach(x => { x.map?.dispose(); x.dispose(); }); });
    }
    const heightM = o.heightCm / 100, s = heightM / (art.maxY - art.minY);
    const cx = (art.minX + art.maxX) / 2, baseY = art.maxY, depth = BOARD_MM / 1000;
    const toW = ([x, y]) => new T.Vector2((x - cx) * s, (baseY - y) * s);

    const shape = new T.Shape(art.outer.map(toW));
    for (const h of art.holes) shape.holes.push(new T.Path(h.map(toW)));
    const geo = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });

    // ділимо «кришки» на задню (z = 0) і передню (z = depth), UV — під текстуру
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    const [caps, side] = geo.groups, half = caps.count / 2;
    const backFirst = pos.getZ(caps.start) < depth / 2;
    geo.clearGroups();
    geo.addGroup(caps.start, half, backFirst ? 0 : 2);
    geo.addGroup(caps.start + half, half, backFirst ? 2 : 0);
    geo.addGroup(side.start, side.count, 1);
    for (let i = caps.start; i < caps.start + caps.count; i++) {
      const px = pos.getX(i) / s + cx, py = baseY - pos.getY(i) / s;
      uv.setXY(i, px / art.W, 1 - py / art.H);
    }
    uv.needsUpdate = true;
    geo.translate(0, 0, -depth / 2);

    const texOf = cv => { const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
                          t.anisotropy = this.renderer.capabilities.getMaxAnisotropy(); return t; };
    const mats = [
      new T.MeshStandardMaterial({ map: texOf(tex.back), roughness: 0.85 }),
      new T.MeshStandardMaterial({ color: (MATERIAL[o.back] || MATERIAL.plastic).edge, roughness: 0.9 }),
      new T.MeshStandardMaterial({ map: texOf(tex.front), roughness: 0.6 }),
    ];
    this.figure = new T.Group();
    this.figure.add(new T.Mesh(geo, mats));

    const wM = (art.maxX - art.minX) * s;
    if (o.strut) this._legs(art, s, cx, heightM, depth, wM);
    this.scene.add(this.figure);

    this.shadow.scale.set(Math.max(0.5, wM * 1.3), Math.max(0.5, heightM * 0.55), 1);
    this.shadow.position.z = o.strut ? -heightM * 0.1 : 0;
    this.fitH = heightM; this.fitW = wM;
    this._fit();
    this.onBuilt?.({ heightCm: o.heightCm, widthCm: Math.round(wM * 100) });
  }

  /* Ніжки як у виробі: два вертикальні «плавники» перпендикулярно до фігури
     (вузькі вгорі, ширші внизу); у картону між ними ще дві поперечні планки. */
  _legs(art, s, cx, heightM, depth, wM) {
    const T = this.T, mat = MATERIAL[this.opts.back] || MATERIAL.plastic;
    // зсув глибини: коли ніжка стоїть до камери ребром, деякі GPU малюють її крізь фігуру
    const m = new T.MeshStandardMaterial({ color: mat.edge, roughness: 0.9,
      polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 });
    const top = heightM * 0.55;                        // до якої висоти доходять ніжки
    const gap = Math.min(0.12, wM * 0.25);             // відстань між плавниками
    const dTop = 0.05, dBot = Math.max(0.14, top * 0.24);
    const x0 = (art.strutX - cx) * s, bz = -depth / 2;

    const fin = new T.Shape([new T.Vector2(0, 0), new T.Vector2(dBot, 0),
                             new T.Vector2(dTop, top), new T.Vector2(0, top)]);
    const finGeo = new T.ExtrudeGeometry(fin, { depth, bevelEnabled: false });
    finGeo.rotateY(Math.PI / 2);                       // x форми → назад (−z), товщина → по x
    for (const sx of [-1, 1]) {
      const f = new T.Mesh(finGeo, m);
      f.position.set(x0 + sx * gap / 2 - depth / 2, 0, bz);
      this.figure.add(f);
    }
    // поперечні планки — лише в картонному варіанті; пластикові ніжки без них
    if (this.opts.back !== 'cardboard') return;
    const tab = (y, dz) => {
      const t = new T.Mesh(new T.BoxGeometry(gap + 0.05, depth, dz), m);
      t.position.set(x0, y, bz - dz / 2);
      this.figure.add(t);
    };
    tab(top - 0.12, Math.min(0.07, dTop + (dBot - dTop) * 0.12));
    tab(0.06, dBot * 0.7);
  }

  /* ---------- камера і керування ---------- */

  _resize() {
    if (!this.renderer) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this._fit();
  }
  _fit() {
    if (!this.fitH) return;
    const t = Math.tan(this.T.MathUtils.degToRad(this.camera.fov / 2));
    this.fitD = Math.max(this.fitH * 0.58 / t, this.fitW * 0.7 / (t * this.camera.aspect)) + 0.2;
    this.cy = this.fitH * 0.5;
    // ближня площина якомога далі: на телефонах буфер глибини буває 16-бітним,
    // і з near = 5 см ніжки за 5 мм пластику «просвічують» крізь лицьовий бік
    this.camera.near = this.fitD * 0.2;
    this.camera.far = this.fitD * 4;
    this.camera.updateProjectionMatrix();
  }
  _bind(el) {
    const pts = new Map(); let pinch0 = 0, dist0 = 1, lastX = 0, lastT = 0, horiz = null;
    const grab = () => { this.auto = false; this.target = null; this.vYaw = 0; this.onUserTurn?.(); };
    el.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, [e.clientX, e.clientY]); horiz = e.pointerType === 'mouse' ? true : null;
      lastX = e.clientX; lastT = performance.now();
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = this.dist; }
    });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const [px, py] = pts.get(e.pointerId);
      const dx = e.clientX - px, dy = e.clientY - py;
      // на телефоні вертикальний свайп лишаємо сторінці
      if (horiz === null) { if (Math.abs(dx) + Math.abs(dy) < 6) return; horiz = Math.abs(dx) > Math.abs(dy);
        if (horiz) { el.setPointerCapture(e.pointerId); grab(); } }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (!horiz) return;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        this.dist = Math.min(1.6, Math.max(0.45, dist0 * pinch0 / d)); return; }
      if (e.pointerType === 'mouse' && !this._grabbed) { grab(); this._grabbed = true; }
      this.yaw += dx * 0.01;
      this.pitch = Math.min(0.7, Math.max(-0.15, this.pitch + dy * 0.005));
      const now = performance.now(); this.vYaw = (e.clientX - lastX) * 0.01 / Math.max(16, now - lastT) * 16;
      lastX = e.clientX; lastT = now;
    });
    const up = e => { pts.delete(e.pointerId); this._grabbed = false; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { if (!e.ctrlKey && Math.abs(e.deltaY) < 1) return; e.preventDefault(); grab();
      this.dist = Math.min(1.6, Math.max(0.45, this.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
  }
  _frame() {
    if (!this.fitD) { this.renderer.render(this.scene, this.camera); return; }
    if (this.auto) this.yaw += 0.0045;
    else if (this.target != null) { this.yaw += (this.target - this.yaw) * 0.12; if (Math.abs(this.target - this.yaw) < 1e-3) this.target = null; }
    else if (Math.abs(this.vYaw) > 1e-4) { this.yaw += this.vYaw; this.vYaw *= 0.93; }
    const d = this.fitD * this.dist;
    this.camera.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * d, this.cy + Math.sin(this.pitch) * d,
                             Math.cos(this.yaw) * Math.cos(this.pitch) * d);
    this.camera.lookAt(0, this.cy * 0.97, 0);
    this.renderer.render(this.scene, this.camera);
  }
}

/** Проста демо-фігура, щоб до завантаження фото було що покрутити. */
export function demoFigure() {
  const c = canvas(560, 1500), x = c.getContext('2d');
  const skin = '#E9B99A', hair = '#3B2A22', top = '#2F7D6F', jeans = '#3A5A8C', shoe = '#F4F1EC';
  x.lineCap = x.lineJoin = 'round';
  x.fillStyle = jeans;
  x.beginPath(); x.moveTo(190, 760); x.lineTo(370, 760); x.lineTo(360, 1400); x.lineTo(295, 1400); x.lineTo(282, 900); x.lineTo(268, 1400); x.lineTo(200, 1400); x.closePath(); x.fill();
  x.fillStyle = shoe;
  x.beginPath(); x.ellipse(228, 1420, 58, 26, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(335, 1420, 58, 26, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = skin; x.lineWidth = 44;
  x.beginPath(); x.moveTo(175, 400); x.quadraticCurveTo(110, 560, 140, 760); x.stroke();
  x.beginPath(); x.moveTo(385, 400); x.quadraticCurveTo(470, 300, 470, 170); x.stroke();
  x.fillStyle = skin; x.beginPath(); x.arc(470, 150, 34, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(140, 775, 30, 0, Math.PI * 2); x.fill();
  x.fillStyle = top;
  x.beginPath(); x.moveTo(170, 360); x.quadraticCurveTo(280, 330, 390, 360); x.lineTo(410, 470); x.lineTo(372, 780); x.lineTo(188, 780); x.lineTo(150, 470); x.closePath(); x.fill();
  x.fillStyle = skin; x.fillRect(255, 300, 50, 60);
  x.beginPath(); x.ellipse(280, 230, 88, 104, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = hair;
  x.beginPath(); x.ellipse(280, 175, 100, 72, 0, Math.PI, 0); x.lineTo(380, 250); x.quadraticCurveTo(360, 180, 280, 170); x.quadraticCurveTo(200, 180, 180, 250); x.closePath(); x.fill();
  x.fillStyle = '#2A1B16';
  x.beginPath(); x.arc(248, 240, 9, 0, Math.PI * 2); x.arc(312, 240, 9, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#9B4A3A'; x.lineWidth = 6; x.beginPath(); x.arc(280, 272, 28, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
  return c;
}
