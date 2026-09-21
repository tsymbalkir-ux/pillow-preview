/*
 * dakimakura-3d.js — обʼємне превʼю дакімакури.
 *
 * Бере ті самі PhotoSide (A — лицьовий бік, B — зворот), що й плоскі мокапи,
 * малює їх панелі в текстури і натягує на «надуту» подушку.
 * three.js вантажиться лише тоді, коли покупець уперше відкриває 3D —
 * на швидкість основної сторінки це не впливає.
 */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Dakimakura3D {
  /**
   * host   — елемент, у який вставляємо полотно (розмір задає CSS)
   * sides  — { A, B } з pillow-mockup.js
   * size   — { cm, len } — ширина й довжина в сантиметрах
   * mobile — true, щоб зменшити текстури й роздільність
   */
  constructor({ host, sides, size, mobile = false, threeUrl = THREE_URL }) {
    this.host = host;
    this.sides = sides;
    this.size = size;
    this.mobile = mobile;
    this.threeUrl = threeUrl;
    this.running = false;
    this.yaw = 0.5; this.pitch = 0.08; this.dist = 1;   // dist — множник відстані камери
    this.vYaw = 0; this.target = null;                   // інерція і плавний поворот до сторони
    this.auto = !reduced();                              // повільне обертання до першого дотику
    this.onTurn = null;                                  // (side: 'A'|'B') — яка сторона зараз до глядача
  }

  async init() {
    if (this.ready) return this;
    const T = this.T = await import(this.threeUrl);

    const r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.75 : 2));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.NoToneMapping;          // кольори принта мають лишитись як у файлі
    r.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    r.domElement.setAttribute('aria-label', 'Обʼємна модель дакімакури. Потягни, щоб покрутити.');
    r.domElement.setAttribute('role', 'img');
    this.host.appendChild(r.domElement);

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(28, 1, 0.05, 50);

    // світло: мʼяке загальне + ключ спереду зліва + контр ззаду, щоб зворот не був темним
    this.scene.add(new T.HemisphereLight(0xffffff, 0xcfc4ca, 1.25));
    const key = new T.DirectionalLight(0xffffff, 2.1);
    key.position.set(-2.2, 1.4, 1.6);   // збоку — тоді видно, що подушка опукла
    this.scene.add(key);
    const rim = new T.DirectionalLight(0xffffff, 1.5);
    rim.position.set(2.0, 0.9, -1.8);
    this.scene.add(rim);

    this.pillow = new T.Group();
    this.scene.add(this.pillow);

    // текстури сторін: полотна перемальовуємо на місці, щоб не плодити нові
    const tw = this.mobile ? 384 : 640;
    this.texW = tw;
    this.panels = { A: null, B: null };
    this.tex = {};
    this.mat = {};
    for (const id of ['A', 'B']) {
      const cv = document.createElement('canvas');
      this.panels[id] = cv;
      const tex = new T.CanvasTexture(cv);
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy());
      this.tex[id] = tex;
      this.mat[id] = new T.MeshPhysicalMaterial({
        map: tex, roughness: 0.82, metalness: 0,
        sheen: 0.45, sheenRoughness: 0.7, sheenColor: new T.Color(0xffffff),
      });
    }

    // мʼяка тінь під подушкою — одна радіальна пляма, без shadow map
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const g = sc.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(40,20,30,.28)');
    grd.addColorStop(1, 'rgba(40,20,30,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    this.shadow = new T.Mesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc), transparent: true, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    this._bindPointer(r.domElement);
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.host);

    this.ready = true;
    this.setSize(this.size);
    this.refresh();
    return this;
  }

  /* ---------------- геометрія ---------------- */

  /** Одна «щока» подушки: face = +1 спереду, −1 ззаду. */
  _half(W, H, face) {
    const T = this.T;
    const nx = 36, ny = 96;
    const D = W * 0.21;                 // половина товщини в найвищій точці
    const pos = [], uv = [], idx = [];
    const round = t => Math.sqrt(1 - (1 - clamp(t, 0, 1)) ** 2);   // чверть кола

    for (let j = 0; j <= ny; j++) {
      const v = j / ny;
      for (let i = 0; i <= nx; i++) {
        const u = i / nx;
        const eu = Math.abs(2 * u - 1), ev = Math.abs(2 * v - 1);
        // шов тягне краї всередину: довгі боки трохи «талією», торці — дугою
        const x = (u - 0.5) * W * (1 - 0.045 * Math.sin(Math.PI * v) * eu ** 6);
        const y = (v - 0.5) * H * (1 - 0.025 * Math.sin(Math.PI * u) * ev ** 6);

        // висота: кругле по ширині, пласке вздовж і закруглене лише біля торців
        const du = Math.min(u, 1 - u) * W, dv = Math.min(v, 1 - v) * H;
        const p = round(du / (W * 0.5)) ** 0.9 * round(dv / (W * 0.62)) ** 0.8;
        // дрібні зморшки тканини біля шва, де наповнювач тягне її сильніше
        const wr = (1 - p) * p * 4 * (0.05 * Math.sin(dv * 0.9 / W * 9 + u * 3) + 0.03 * Math.sin(du / W * 31));
        const z = face * D * (p + wr * 0.35);

        pos.push(x, y, z);
        // зворот дзеркалимо, щоб малюнок читався правильно, коли подушку повернули
        uv.push(face > 0 ? u : 1 - u, v);
      }
    }
    const row = nx + 1;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
        if (face > 0) idx.push(a, b, d, a, d, c);
        else idx.push(a, d, b, a, c, d);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /** Зміна розміру (120×40, 150×50, 180×60): перебудовуємо подушку й підганяємо камеру. */
  setSize(size) {
    this.size = size;
    if (!this.ready) return;
    const T = this.T;
    const W = size.cm / 100, H = size.len / 100;   // метри
    this.pillow.children.slice().forEach(m => { m.geometry.dispose(); this.pillow.remove(m); });
    this.pillow.add(new T.Mesh(this._half(W, H, +1), this.mat.A));
    this.pillow.add(new T.Mesh(this._half(W, H, -1), this.mat.B));

    this.H = H;
    this.shadow.position.y = -H / 2 - 0.03;
    this.shadow.scale.set(W * 2.4, W * 1.3, 1);
    this.refresh();
    this._resize();
  }

  /** Перемалювати текстури з поточного стану сторін. Викликати після кожної зміни фото. */
  refresh() {
    if (!this.ready) return;
    const w = this.texW, h = Math.round(w * (this.size.len / this.size.cm));
    for (const id of ['A', 'B']) {
      const cv = this.sides[id].drawPanel(w, h, this.panels[id]);
      if (cv !== this.panels[id]) {        // новий розмір — drawPanel дав нове полотно
        this.panels[id] = cv;
        this.tex[id].image = cv;
        this.tex[id].dispose();            // інакше WebGL лишить текстуру старого розміру
      }
      this.tex[id].needsUpdate = true;
    }
  }

  /* ---------------- керування ---------------- */

  _bindPointer(el) {
    const pts = new Map();
    let pinch0 = 0, dist0 = 1, last = 0;
    const stopAuto = () => { this.auto = false; this.target = null; };

    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.style.cursor = 'grabbing';
      stopAuto(); this.vYaw = 0;
      if (pts.size === 2) {
        const [p, q] = [...pts.values()];
        pinch0 = Math.hypot(p.x - q.x, p.y - q.y); dist0 = this.dist;
      }
      last = performance.now();
    });
    el.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0) this.dist = clamp(dist0 * pinch0 / d, 0.45, 1.6);
        return;
      }
      const now = performance.now(), dt = Math.max(1, now - last); last = now;
      const k = 5.5 / Math.max(300, el.clientWidth);
      this.yaw += dx * k;
      this.pitch = clamp(this.pitch + dy * k * 0.6, -0.55, 0.55);
      this.vYaw = dx * k / dt * 16;       // рад за кадр — для інерції
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch0 = 0;
      if (!pts.size) el.style.cursor = 'grab';
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => {
      e.preventDefault(); stopAuto();
      this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0012), 0.45, 1.6);
    }, { passive: false });
    el.addEventListener('dblclick', () => { stopAuto(); this.dist = this.dist < 0.9 ? 1 : 0.6; });
  }

  /** Плавно розвернути подушку до потрібної сторони. */
  show(side) {
    this.auto = false; this.vYaw = 0;
    const base = side === 'B' ? Math.PI : 0;
    // найкоротший шлях від поточного кута
    const turns = Math.round((this.yaw - base) / (2 * Math.PI));
    this.target = base + turns * 2 * Math.PI;
    this.pitchTarget = 0.06;
  }

  _facing() {
    const a = ((this.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return (a > Math.PI / 2 && a < Math.PI * 1.5) ? 'B' : 'A';
  }

  _resize() {
    if (!this.ready) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // відстань, з якої вся подушка вміщується з полями — і по висоті, і по ширині
    const vf = Math.tan(this.camera.fov * Math.PI / 360);
    const needH = (this.H * 0.66) / vf;
    const needW = (this.size.cm / 100 * 0.85) / (vf * this.camera.aspect);
    this.baseDist = Math.max(needH, needW);
  }

  /* ---------------- цикл ---------------- */

  start() {
    if (!this.ready || this.running) return;
    this.running = true;
    this._resize();
    let prev = performance.now();
    const tick = now => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;

      if (this.target != null) {
        this.yaw += (this.target - this.yaw) * Math.min(1, dt * 7);
        if (this.pitchTarget != null) this.pitch += (this.pitchTarget - this.pitch) * Math.min(1, dt * 7);
        if (Math.abs(this.target - this.yaw) < 0.002) { this.yaw = this.target; this.target = null; }
      } else if (this.auto) {
        this.yaw += dt * 0.45;
      } else if (Math.abs(this.vYaw) > 0.0005) {
        this.yaw += this.vYaw;
        this.vYaw *= Math.pow(0.9, dt * 60);
      }

      this.pillow.rotation.set(0, this.yaw, 0);
      this.shadow.rotation.z = this.yaw;        // пляма — еліпс, крутиться разом із подушкою

      const d = this.baseDist * this.dist;
      const c = this.camera;
      c.position.set(0, Math.sin(this.pitch) * d, Math.cos(this.pitch) * d);
      c.lookAt(0, 0, 0);

      const f = this._facing();
      if (f !== this._lastFacing) { this._lastFacing = f; this.onTurn?.(f); }

      this.renderer.render(this.scene, c);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  /** Знімок поточного ракурсу (напр., додати до замовлення). */
  snapshot(type = 'image/jpeg', q = 0.9) {
    this.renderer.render(this.scene, this.camera);
    return new Promise(res => this.renderer.domElement.toBlob(res, type, q));
  }
}
