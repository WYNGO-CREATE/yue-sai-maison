/* Yue Sai · La Maison des Heures (Shanghai, Anfu Lu) — visite filmée en 3D.
   Plan : rue au sud (+z), façade à deux arches, seuil aux 24 niches, rotonde à oculus
   avec le cadran solaire au centre, quatre rituels orientés comme la journée :
   晨 Éveil à l'est (+x), 午 Recharge au sud, 暮 Dénouer à l'ouest (−x), 夜 Réparer au nord (−z).
   La caméra suit un chemin de drone ; le défilement règle la progression. */
window.YSMaison = (function () {
  'use strict';
  let T, renderer, scene, camera, host, raf = 0, alive = false;
  let prog = 0, target = 0, t0 = 0, still = 0, frames = 0, running = false, lastTs = 0, slow = 0, dpr = 1, vw = 0, vh = 0;
  let path, lookPath, stops = [], viaIdx = [];
  const lights = {}, mats = {}, fades = [];
  const Z0 = -5.9, R = 6;                // rotonde : centre (0, 0, Z0), rayon R
  const DPR = Math.min(window.devicePixelRatio || 1, 1.6);

  /* ---------------- chapitres (caméra) ---------------- */
  // pos, look : points de caméra ; via : points de passage sans arrêt
  const CH = [
    { id: 'rue', pos: [0, 1.7, 21], look: [0, 3.5, 6.3] },
    { via: [-1.2, 1.6, 12.5] },
    { id: 'vitrine', pos: [-2.1, 1.5, 9.1], look: [-2.4, 1.3, 5.3] },
    { via: [2.4, 1.6, 8.3] }, { via: [2.4, 1.62, 6.5] },
    { id: 'seuil', pos: [2.1, 1.62, 4.3], look: [4.2, 1.85, 2.7] },
    { id: 'rotonde', pos: [0.55, 1.72, -0.7], look: [0, 0.95, Z0] },
    { id: 'chen', pos: [3.3, 1.52, -5.5], look: [8.2, 1.25, -5.9] },
    { id: 'wu', pos: [-1.0, 1.5, -3.2], look: [-3.5, 1.1, -1.75] },
    { id: 'mu', pos: [-3.3, 1.52, -6.2], look: [-8.2, 1.3, -5.9] },
    { id: 'fontaine', pos: [-1.35, 1.6, -7.7], look: [-4.25, 1.15, -10.2] },
    { id: 'ye', pos: [0, 1.58, -9.4], look: [0, 1.32, -13.9] },
    { via: [0.85, 1.62, -12.3] },
    { id: 'cabines', pos: [0.28, 1.62, -15.3], look: [0, 1.4, -21.5] },
    { via: [0.3, 1.7, -11.2] },
    { id: 'diagnostic', pos: [-1.25, 2.35, -7.3], look: [2.75, 0.62, -8.95] },
    { via: [-1.95, 1.75, -5.6] }, { via: [-0.2, 1.7, -1.3] },
    { id: 'caisse', pos: [0.25, 1.58, 3.55], look: [-2.6, 1.02, 2.25] },
    { via: [0.1, 7.5, -0.5] },
    { id: 'plan', pos: [0, 29, -2.75], look: [0, 0, -3.05] },
  ];

  /* ---------------- préréglages de lumière par moment ---------------- */
  const HOURS = {
    chen: { stone: .92, env: .8, sky: ['#9fb1c9', '#f1dfc4'], fog: '#d9d3c8', exp: 1.02, hemi: 0.55, ocu: ['#fff1d8', 5.2], sun: ['#ffd9a8', .55], lamps: 0, glow: 0.45, alc: 0.9 },
    wu: { stone: 1, env: .95, sky: ['#9dbbd6', '#edf1ef'], fog: '#dfe3e0', exp: 1.0, hemi: 0.65, ocu: ['#ffffff', 4.6], sun: ['#ffffff', .65], lamps: 0, glow: 0.35, alc: 0.8 },
    mu: { stone: .34, env: .38, sky: ['#2b2236', '#d98a52'], fog: '#5a3f3a', exp: 1.08, hemi: 0.3, ocu: ['#ffc58f', 3.4], sun: ['#ff9a5a', .32], lamps: 1, glow: 1.0, alc: 1.15 },
    ye: { stone: .2, env: .2, sky: ['#05070d', '#18203a'], fog: '#0d1120', exp: 1.18, hemi: 0.16, ocu: ['#9fb2ff', 1.6], sun: ['#7d8fd6', .1], lamps: 1, glow: 1.25, alc: 1.35 },
  };

  /* ---------------- textures dessinées ---------------- */
  function cv(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function noise(x, w, h, base, amp, n, seed) {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    let s = seed || 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const a = rnd(); x.fillStyle = `rgba(${a > .5 ? '255,255,255' : '40,30,20'},${amp * rnd()})`;
      const r = rnd() * 2.2 + .3; x.fillRect(rnd() * w, rnd() * h, r, r);
    }
  }
  function texStone(rep) {
    const t = cv(512, 512, (x, w, h) => {
      noise(x, w, h, '#d8ccbb', .08, 9000, 3);
      x.strokeStyle = 'rgba(90,70,50,.18)'; x.lineWidth = 2;
      for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(0, i * h / 2); x.lineTo(w, i * h / 2); x.stroke(); }
      x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h / 2); x.moveTo(w / 4, h / 2); x.lineTo(w / 4, h); x.stroke();
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.05)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); return t;
  }
  function texPlain(base, amp, rep, seed) {
    const t = cv(256, 256, (x, w, h) => noise(x, w, h, base, amp, 4000, seed));
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); return t;
  }
  function texFacade() {
    const t = cv(512, 512, (x, w, h) => {
      noise(x, w, h, '#d9cbb5', .07, 8000, 11);
      x.strokeStyle = 'rgba(80,60,40,.16)'; x.lineWidth = 2;
      for (let r = 0; r < 8; r++) { const y = r * h / 8; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke();
        for (let c = 0; c < 4; c++) { const xx = (c + (r % 2) * .5) * w / 4; x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + h / 8); x.stroke(); } }
    });
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(4, 3); return t;
  }
  function texGlow(color) {
    return cv(128, 128, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, color); g.addColorStop(.35, color.replace(/[\d.]+\)$/, '0.35)')); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
  }
  function texShaft() {
    return cv(64, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const s = x.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(.25, 'rgba(0,0,0,0)'); s.addColorStop(.75, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = s; x.fillRect(0, 0, w, h);
    });
  }
  function texDial() {
    return cv(1024, 1024, (x, w, h) => {
      noise(x, w, h, '#cfc3b1', .09, 14000, 5);
      const cx = w / 2, cy = h / 2;
      x.strokeStyle = 'rgba(70,50,35,.55)'; x.lineWidth = 3;
      [470, 395, 150].forEach((r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); });
      const zh = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
      x.fillStyle = 'rgba(60,40,28,.85)'; x.font = '64px "Noto Serif SC", "Songti SC", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        x.save(); x.translate(cx + Math.cos(a) * 432, cy + Math.sin(a) * 432); x.rotate(a + Math.PI / 2); x.fillText(zh[i], 0, 0); x.restore();
        const b = a - Math.PI / 12; x.beginPath(); x.moveTo(cx + Math.cos(b) * 395, cy + Math.sin(b) * 395); x.lineTo(cx + Math.cos(b) * 470, cy + Math.sin(b) * 470); x.stroke();
      }
      for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * 380, cy + Math.sin(a) * 380); x.lineTo(cx + Math.cos(a) * (i % 4 ? 368 : 355), cy + Math.sin(a) * (i % 4 ? 368 : 355)); x.stroke(); }
      x.fillStyle = 'rgba(163,58,44,.9)'; x.font = '120px "Ma Shan Zheng", "Kaiti SC", serif'; x.fillText('顺时而美', cx, cy + 230);
    });
  }
  function texLabel(line1, line2, bg, ink, w = 256, h = 128) {
    return cv(w, h, (x) => {
      x.fillStyle = bg; x.fillRect(0, 0, w, h);
      x.fillStyle = ink; x.textAlign = 'center';
      x.font = `${h * .24}px "Bodoni Moda", Didot, serif`; x.fillText(line1, w / 2, h * .42);
      if (line2) { x.font = `${h * .13}px "Albert Sans", Avenir, sans-serif`; x.fillText(line2, w / 2, h * .7); }
    });
  }
  function texPlaque() {
    return cv(256, 360, (x, w, h) => {
      x.fillStyle = '#a33a2c'; x.fillRect(0, 0, w, h);
      noise(x, w, h, 'rgba(0,0,0,0)', .06, 1200, 9);
      x.fillStyle = '#e9c98f'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '130px "Noto Serif SC", "Songti SC", serif'; x.fillText('羽', w / 2, h * .3); x.fillText('西', w / 2, h * .7);
    });
  }
  function texNiche(txt) {
    return cv(256, 128, (x, w, h) => {
      x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h);
      x.fillStyle = '#f2d9a8'; x.font = '70px "Noto Serif SC", "Songti SC", serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2);
    });
  }
  function texCarnet() {
    return cv(512, 360, (x, w, h) => {
      noise(x, w, h, '#efe6d4', .05, 3000, 2);
      x.strokeStyle = 'rgba(80,60,40,.25)'; x.beginPath(); x.moveTo(w / 2, 10); x.lineTo(w / 2, h - 10); x.stroke();
      x.fillStyle = '#2b2622'; x.font = '26px "Bodoni Moda", Didot, serif'; x.textAlign = 'center'; x.fillText('Carnet des Heures', w * .25, 60);
      x.font = '17px "Albert Sans", sans-serif';
      ['晨  7 h 30 · Mousse, Essence Éveil', '午  13 h · Brume des Heures', '暮  21 h · Huile Dénouer', '夜  23 h 30 · Essence Nuit'].forEach((l, i) => x.fillText(l, w * .25, 120 + i * 44));
      x.fillStyle = '#a33a2c'; x.fillRect(w * .66, h * .38, 90, 90);
      x.fillStyle = '#f3e8d8'; x.font = '38px "Noto Serif SC", serif'; x.fillText('羽', w * .66 + 45, h * .38 + 40); x.fillText('西', w * .66 + 45, h * .38 + 80);
    });
  }
  function skyTex(a, b) {
    return cv(8, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(.62, b); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  }

  /* ---------------- matériaux ---------------- */
  function materials() {
    const env = { envMapIntensity: 1 };
    mats.lac = new T.MeshPhysicalMaterial({ color: 0x5b0c16, roughness: .2, clearcoat: 1, clearcoatRoughness: .05, ...env });
    mats.lacIn = new T.MeshPhysicalMaterial({ color: 0x4a0a12, roughness: .3, clearcoat: .8, clearcoatRoughness: .12, side: T.DoubleSide, ...env });
    mats.floor = new T.MeshStandardMaterial({ color: 0xb3a795, map: texStone(6), roughness: .3, metalness: 0, envMapIntensity: .7 });
    mats.stone = new T.MeshStandardMaterial({ color: 0xffffff, map: texPlain('#cdbfab', .1, 2, 4), roughness: .55, ...env });
    mats.plaster = new T.MeshStandardMaterial({ color: 0xffffff, map: texPlain('#e7ddcd', .06, 3, 8), roughness: .95, side: T.DoubleSide });
    mats.ceil = new T.MeshStandardMaterial({ color: 0xffffff, map: texPlain('#ece3d4', .05, 3, 12), roughness: .95, side: T.DoubleSide, transparent: true });
    mats.facade = new T.MeshStandardMaterial({ color: 0xffffff, map: texFacade(), roughness: .9 });
    mats.street = new T.MeshStandardMaterial({ color: 0x2a2826, roughness: .18, metalness: .1, ...env });
    mats.walk = new T.MeshStandardMaterial({ color: 0xffffff, map: texStone(10), roughness: .5 });
    mats.brass = new T.MeshStandardMaterial({ color: 0xb4894e, metalness: 1, roughness: .3, ...env });
    mats.gold = new T.MeshStandardMaterial({ color: 0xc9a462, metalness: 1, roughness: .22, ...env });
    mats.porcelain = new T.MeshPhysicalMaterial({ color: 0xf1ede5, roughness: .22, clearcoat: .8, ...env });
    mats.celadon = new T.MeshPhysicalMaterial({ color: 0x96b8a6, roughness: .26, clearcoat: .7, ...env });
    mats.glass = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: .04, metalness: 0, transparent: true, opacity: .16, clearcoat: 1, side: T.DoubleSide, depthWrite: false, ...env });
    mats.amber = new T.MeshPhysicalMaterial({ color: 0x8a3510, roughness: .08, clearcoat: 1, transparent: true, opacity: .92, ...env });
    mats.goldLiq = new T.MeshPhysicalMaterial({ color: 0xd8a64a, roughness: .1, clearcoat: 1, transparent: true, opacity: .9, emissive: 0x3a2008, emissiveIntensity: .4, ...env });
    mats.ambLiq = new T.MeshPhysicalMaterial({ color: 0xb4460f, roughness: .1, clearcoat: 1, emissive: 0x401004, emissiveIntensity: .5, ...env });
    mats.black = new T.MeshStandardMaterial({ color: 0x151313, roughness: .35, ...env });
    mats.white = new T.MeshStandardMaterial({ color: 0xf3f0ea, roughness: .5 });
    mats.alu = new T.MeshStandardMaterial({ color: 0xd9d9d6, metalness: .9, roughness: .35, ...env });
    mats.velvet = new T.MeshStandardMaterial({ color: 0x8c1a22, roughness: 1 });
    mats.wood = new T.MeshStandardMaterial({ color: 0x3d2518, roughness: .55, ...env });
    mats.cinabre = new T.MeshPhysicalMaterial({ color: 0xa3302a, roughness: .25, clearcoat: 1, ...env });
    mats.paper = new T.MeshStandardMaterial({ color: 0xf0e7d6, roughness: .9, emissive: 0xffd9a0, emissiveIntensity: .35, side: T.DoubleSide });
    mats.nicheBack = new T.MeshStandardMaterial({ color: 0x2a0b0e, roughness: .8, emissive: 0x6b2a1a, emissiveIntensity: .25 });
    mats.nicheOn = new T.MeshStandardMaterial({ color: 0xf3dcae, roughness: .8, emissive: 0xffc680, emissiveIntensity: 1.4 });
    mats.window = new T.MeshStandardMaterial({ color: 0x1a1512, emissive: 0xffc98a, emissiveIntensity: .5, roughness: .4 });
    mats.mirror = new T.MeshStandardMaterial({ color: 0xcfd3d6, metalness: 1, roughness: .05, ...env });
    mats.water = new T.MeshStandardMaterial({ color: 0x9fb2b0, metalness: .6, roughness: .05, transparent: true, opacity: .8, ...env });
    mats.flame = new T.MeshBasicMaterial({ color: 0xffd28a });
  }

  /* ---------------- géométries utiles ---------------- */
  function arch(w, h) {       // forme d'arche pleine : rectangle + demi-cercle, base centrée en (0, 0)
    const s = new T.Shape(), r = w / 2, sp = h - r;
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, sp); s.absarc(0, sp, r, 0, Math.PI, false); s.lineTo(-r, 0); return s;
  }
  function extrude(shape, depth, mat, bevel = .02) {
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 40 });
    const m = new T.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
  }
  function archFrame(w, h, t, depth, mat) {  // encadrement d'arche : contour en U, pas de trou
    const ri = w / 2, ro = ri + t, sp = h - ri, s = new T.Shape();
    s.moveTo(-ro, 0); s.lineTo(-ri, 0); s.lineTo(-ri, sp); s.absarc(0, sp, ri, Math.PI, 0, true); s.lineTo(ri, 0); s.lineTo(ro, 0);
    s.lineTo(ro, sp); s.absarc(0, sp, ro, 0, Math.PI, false); s.lineTo(-ro, 0);
    return extrude(s, depth, mat, .012);
  }
  function wallWithArches(W, H, depth, holes, mat) {  // mur percé d'arches qui touchent le sol : entailles dans le contour
    const s = new T.Shape(); s.moveTo(-W / 2, 0);
    holes.slice().sort((p, q) => p[0] - q[0]).forEach(([x, w, h]) => { const r = w / 2, sp = h - r; s.lineTo(x - r, 0); s.lineTo(x - r, sp); s.absarc(x, sp, r, Math.PI, 0, true); s.lineTo(x + r, 0); });
    s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.lineTo(-W / 2, 0);
    return extrude(s, depth, mat, 0);
  }
  function box(w, h, d, mat, x, y, z) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }
  function cyl(rt, rb, h, mat, x, y, z, seg = 48) { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }
  function lathe(pts, mat, seg = 48) { const g = new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg); const m = new T.Mesh(g, mat); m.castShadow = true; return m; }
  function sprite(tex, size, x, y, z, opacity = 1) {
    const m = new T.Sprite(new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
    m.scale.set(size, size, 1); m.position.set(x, y, z); return m;
  }
  function add(o, parent) { (parent || scene).add(o); return o; }

  /* ---------------- produits (échelle réelle x1,35) ---------------- */
  const K = 1.35;
  function labelBand(r, y, h, tex, arc = 1.4) {
    const g = new T.CylinderGeometry(r * 1.004, r * 1.004, h, 32, 1, true, -arc / 2, arc);
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ map: tex, roughness: .7, transparent: true, alphaTest: .05 })); m.position.y = y; return m;
  }
  const LBL = {};
  function prodDropper(liq, labelKey) {
    const g = new T.Group();
    g.add(lathe([[0, 0], [.024, 0], [.026, .004], [.026, .062], [.022, .07], [.01, .074], [.01, .08], [0, .08]], liq === 'gold' ? mats.goldLiq : mats.amber));
    const collar = cyl(.012, .012, .014, mats.gold, 0, .087, 0, 32); g.add(collar);
    g.add(lathe([[0, 0], [.009, 0], [.01, .01], [.009, .03], [.005, .036], [0, .037]], mats.white, 24)).position.y = .094;
    if (labelKey) g.add(labelBand(.0262, .032, .034, LBL[labelKey]));
    g.scale.setScalar(K); return g;
  }
  function prodPump(liq, labelKey, h = .16) {
    const g = new T.Group();
    g.add(lathe([[0, 0], [.036, 0], [.038, .006], [.038, h - .02], [.03, h - .006], [.012, h], [0, h]], liq === 'amb' ? mats.amber : mats.amber));
    g.add(cyl(.011, .011, .03, mats.black, 0, h + .015, 0, 24));
    const head = box(.018, .012, .05, mats.black, 0, h + .036, .012); g.add(head);
    if (labelKey) g.add(labelBand(.0382, h * .45, h * .34, LBL[labelKey]));
    g.scale.setScalar(K); return g;
  }
  function prodJar() {
    const g = new T.Group();
    g.add(lathe([[0, 0], [.044, 0], [.046, .004], [.046, .058], [0, .058]], mats.porcelain));
    g.add(lathe([[0, 0], [.047, 0], [.047, .01], [.02, .016], [.012, .026], [.024, .034], [.024, .04], [.006, .052], [0, .052]], mats.porcelain)).position.y = .058;
    g.add(labelBand(.0462, .032, .018, LBL.jar, 1.0));
    g.scale.setScalar(K); return g;
  }
  function prodGourd(liqMat) {
    const g = new T.Group();
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, y = t * .16; const r = .042 * Math.sin(Math.PI * Math.min(1, t / .6)) * (t < .6 ? 1 : 0) + (t >= .5 ? .028 * Math.sin(Math.PI * Math.min(1, (t - .5) / .42)) : 0); pts.push([Math.max(.004, r), y]); }
    g.add(lathe(pts, liqMat, 40)).position.y = .012;
    g.add(lathe([[0, 0], [.07, 0], [.07, .19], [.064, .205], [.03, .215], [.012, .22], [0, .22]], mats.glass, 48));
    g.add(cyl(.018, .026, .03, mats.black, 0, .235, 0, 32));
    const tab = box(.014, .08, .005, mats.alu, 0, .29, 0); g.add(tab);
    g.scale.setScalar(K); return g;
  }
  function prodTube(mat, labelKey) {
    const g = new T.Group();
    const b = cyl(.02, .02, .15, mat, 0, .075, 0, 24); b.scale.set(1.35, 1, .55); g.add(b);
    g.add(cyl(.011, .011, .02, mats.black, 0, -.005, 0, 20));
    if (labelKey) { const l = new T.Mesh(new T.PlaneGeometry(.04, .07), new T.MeshStandardMaterial({ map: LBL[labelKey], roughness: .6 })); l.position.set(0, .085, .0112); g.add(l); }
    g.scale.setScalar(K); return g;
  }
  function prodLipstick(color) {
    const g = new T.Group();
    g.add(cyl(.011, .011, .05, mats.lac, 0, .025, 0, 24));
    g.add(cyl(.0112, .0112, .006, mats.gold, 0, .053, 0, 24));
    const bul = cyl(.0085, .0085, .02, new T.MeshPhysicalMaterial({ color, roughness: .3, clearcoat: .6 }), 0, .066, 0, 20); g.add(bul);
    g.scale.setScalar(K); return g;
  }
  function prodBrume() {
    const g = new T.Group();
    g.add(lathe([[0, 0], [.021, 0], [.021, .1], [.014, .108], [0, .108]], mats.glass));
    g.add(cyl(.019, .019, .09, mats.goldLiq, 0, .047, 0, 24));
    g.add(cyl(.016, .016, .035, mats.alu, 0, .125, 0, 24));
    g.scale.setScalar(K); return g;
  }
  function prodCandle(lit) {
    const g = new T.Group();
    const pts = []; for (let i = 0; i <= 30; i++) { const y = i / 30 * .075; pts.push([.047 + .003 * Math.cos(y * 520), y]); } pts.push([0, .075]);
    g.add(lathe(pts, mats.stone, 48));
    if (lit) { const f = new T.Mesh(new T.SphereGeometry(.006, 12, 12), mats.flame); f.scale.set(1, 2.2, 1); f.position.y = .088; g.add(f); g.add(sprite(texGlow('rgba(255,190,110,1)'), .12, 0, .09, 0, .7)); }
    g.scale.setScalar(K); return g;
  }
  function prodGuaSha() {
    const s = new T.Shape(); s.moveTo(0, -.04); s.bezierCurveTo(.05, -.03, .06, .02, .03, .045); s.bezierCurveTo(.015, .055, .005, .05, 0, .035); s.bezierCurveTo(-.005, .05, -.015, .055, -.03, .045); s.bezierCurveTo(-.06, .02, -.05, -.03, 0, -.04);
    const m = extrude(s, .006, new T.MeshPhysicalMaterial({ color: 0xd9a24e, roughness: .15, clearcoat: 1, transparent: true, opacity: .88 }), .002);
    m.rotation.x = -Math.PI / 2; const g = new T.Group(); g.add(m); g.scale.setScalar(K); return g;
  }
  function row(items, x0, y, z, dx, rotY = 0, parent) {
    items.forEach((fn, i) => { const o = fn(); o.position.set(x0 + i * dx, y, z); o.rotation.y = rotY; add(o, parent); });
  }

  /* ---------------- construction de la Maison ---------------- */
  function build(imgBase) {
    LBL.eveil = texLabel('YUE SAI', '晨 ESSENCE ÉVEIL', '#efe5d2', '#2b2622');
    LBL.nuit = texLabel('YUE SAI', '夜 ESSENCE NUIT', '#d9a64a', '#2b2622');
    LBL.mousse = texLabel('YUE SAI', '晨 MOUSSE DU MATIN', '#f3efe6', '#2b2622');
    LBL.huile = texLabel('YUE SAI', '暮 HUILE DÉNOUER', 'rgba(0,0,0,0)', '#e9d9c4');
    LBL.ecran = texLabel('YUE SAI', '晨 ÉCRAN URBAIN', '#f5f3ee', '#2b2622');
    LBL.baume = texLabel('YUE SAI', '午 BAUME DES MAINS', '#d8d8d4', '#2b2622');
    LBL.jar = texLabel('YUE SAI', '', '#f1ede5', '#3a3632');

    /* rue */
    add(new T.Mesh(new T.PlaneGeometry(90, 90), mats.street)).rotation.x = -Math.PI / 2; scene.children.at(-1).position.set(0, -0.01, 8); scene.children.at(-1).receiveShadow = true;
    const walk = add(new T.Mesh(new T.PlaneGeometry(40, 6.2), mats.walk)); walk.rotation.x = -Math.PI / 2; walk.position.set(0, .12, 9.7); walk.receiveShadow = true;
    add(box(40, .12, .25, mats.stone, 0, .06, 12.8));
    [[-7, 11.8], [7, 11.8]].forEach(([x, z]) => {
      add(cyl(.05, .07, 4.2, mats.black, x, 2.2, z, 16));
      add(box(.5, .08, .2, mats.black, x, 4.25, z - .1));
      const g = add(sprite(texGlow('rgba(255,200,130,1)'), 2.2, x, 4.1, z - .2, .9)); fades.push({ o: g, key: 'lamps' });
    });

    /* façade : pierre claire, deux arches de laque, plaque de cinabre */
    // maison de deux niveaux, comme les villas de l'ancienne concession : le ciel reste visible au-dessus
    const fac = add(wallWithArches(22, 8.6, .45, [[-2.4, 3.0, 5.2], [2.4, 3.0, 5.2]], mats.facade)); fac.position.set(0, 0, 6.2);
    add(box(22.4, .3, .7, mats.facade, 0, 8.7, 6.5));
    add(box(22.4, .18, .55, mats.facade, 0, 6.1, 6.55));
    for (let i = -3; i <= 3; i++) {
      add(box(1.1, 1.75, .05, mats.window, i * 3, 7.35, 6.66));
      add(box(1.3, .08, .22, mats.facade, i * 3, 6.42, 6.72));
    }
    // voisins plus bas, en retrait, pour situer la rue
    [[-17.5, 6.4], [17.5, 7.2]].forEach(([x, h]) => { add(box(13, h, .4, mats.facade, x, h / 2, 5.4)); for (let i = -1; i <= 1; i++) add(box(1.0, 1.5, .05, mats.window, x + i * 3.4, h - 2.1, 5.63)); });
    // éclairage architectural du soir : lavis de lumière montant le long de la pierre
    const wash = cv(64, 256, (x, w, h) => { const g = x.createRadialGradient(w / 2, h, 0, w / 2, h, h); g.addColorStop(0, 'rgba(255,196,130,.9)'); g.addColorStop(.5, 'rgba(255,170,100,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    [-6.6, 0, 6.6].forEach((x) => { const m = add(new T.Mesh(new T.PlaneGeometry(x ? 2.6 : 1.5, 6.4), new T.MeshBasicMaterial({ map: wash, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 }))); m.position.set(x, 3.3, 6.72); fades.push({ o: m, key: 'wash' }); });
    [-2.4, 2.4].forEach((x) => { const fr = add(archFrame(3.0, 5.2, .32, .62, mats.lac)); fr.position.set(x, 0, 6.12); });
    const gl = add(new T.Mesh(new T.ShapeGeometry(arch(3.0, 5.2), 40), mats.glass)); gl.position.set(-2.4, 0, 6.5);
    // porte ouverte (deux vantaux vitrés, l'un ouvert vers l'intérieur)
    const leaf = (x, rot) => { const g = new T.Group(); const f = box(1.48, 3.6, .05, mats.glass, .74, 1.8, 0); g.add(f); g.add(box(.02, .6, .03, mats.brass, 1.36, 1.1, .05)); g.position.set(x, 0, 6.35); g.rotation.y = rot; add(g); };
    leaf(0.9, 1.35); leaf(3.9, Math.PI - 1.35);
    add(box(3.0, .02, .5, mats.brass, 2.4, .125, 6.4));
    const plq = add(new T.Mesh(new T.PlaneGeometry(.36, .5), new T.MeshStandardMaterial({ map: texPlaque(), roughness: .35, metalness: .1 }))); plq.position.set(0, 1.85, 6.68);

    /* vestibule */
    const vFloor = add(new T.Mesh(new T.PlaneGeometry(8.6, 6.2), mats.floor)); vFloor.rotation.x = -Math.PI / 2; vFloor.position.set(0, .12, 3.2); vFloor.receiveShadow = true;
    const vCeil = add(new T.Mesh(new T.PlaneGeometry(8.6, 6.2), mats.ceil)); vCeil.rotation.x = Math.PI / 2; vCeil.position.set(0, 4.4, 3.2); fades.push({ o: vCeil, key: 'roof' });
    add(box(.3, 4.3, 6.2, mats.lacIn, -4.35, 2.27, 3.2));
    add(box(.3, 4.3, 6.2, mats.lacIn, 4.35, 2.27, 3.2));
    const back = add(wallWithArches(8.9, 4.3, .3, [[0, 2.7, 3.7]], mats.lacIn)); back.position.set(0, .12, -.1);
    const bf = add(archFrame(2.7, 3.7, .12, .36, mats.brass)); bf.position.set(0, .12, -.13);
    // vitrine derrière l'arche gauche : la calebasse seule
    add(box(.9, 1.0, .9, mats.stone, -2.4, .62, 5.35));
    const vg = add(prodGourd(mats.goldLiq)); vg.position.set(-2.4, 1.12, 5.35); vg.scale.multiplyScalar(2.2);
    add(box(3.2, 4.2, .12, mats.lac, -2.4, 2.22, 4.55));
    // niches des 24 termes solaires (mur est du vestibule)
    const nicheWall = new T.Group();
    const nw = new T.Shape(); nw.moveTo(-2.35, 0); nw.lineTo(2.35, 0); nw.lineTo(2.35, 2.2); nw.lineTo(-2.35, 2.2); nw.lineTo(-2.35, 0);
    const holes = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) { const x = -2.09 + c * .38, y = .18 + r * .95; const p = new T.Path(); p.moveTo(x - .13, y); p.lineTo(x - .13, y + .5); p.absarc(x, y + .5, .13, Math.PI, 0, true); p.lineTo(x + .13, y); p.lineTo(x - .13, y); nw.holes.push(p); holes.push([x, y]); }
    const nwm = extrude(nw, .22, mats.lac, 0); nicheWall.add(nwm);
    const today = window.YSToday || 17;
    holes.forEach(([x, y], i) => {
      const on = i === today;
      const bk = new T.Mesh(new T.PlaneGeometry(.26, .64), on ? mats.nicheOn : mats.nicheBack); bk.position.set(x, y + .32, .01); nicheWall.add(bk);
      const o = on ? prodJar() : (i % 3 === 0 ? prodCandle(false) : prodJar()); o.position.set(x, y + .005, .11); o.scale.multiplyScalar(on ? 1.4 : 1); nicheWall.add(o);
      if (on) { const lb = new T.Mesh(new T.PlaneGeometry(.24, .12), new T.MeshBasicMaterial({ map: texNiche(window.YSTodayZh || '秋分'), transparent: true })); lb.position.set(x, y + .75, .012); nicheWall.add(lb); nicheWall.add(sprite(texGlow('rgba(255,205,140,1)'), .9, x, y + .35, .15, .8)); }
    });
    nicheWall.position.set(4.18, 1.05, 3.2); nicheWall.rotation.y = -Math.PI / 2; add(nicheWall);
    const nl = add(new T.PointLight(0xffc98a, 1.2, 3.5, 2)); nl.position.set(3.6, 1.05 + (today >= 12 ? 1.13 : .18) + .45, 3.2 - 2.09 + (today % 12) * .38);
    // la table du sceau (la caisse) derrière la vitrine
    add(box(2.6, .9, .85, mats.stone, -2.55, .57, 2.25));
    add(box(2.72, .06, .95, mats.cinabre, -2.55, 1.05, 2.25));
    const car = add(new T.Mesh(new T.PlaneGeometry(.52, .36), new T.MeshStandardMaterial({ map: texCarnet(), roughness: .8 }))); car.rotation.x = -Math.PI / 2; car.position.set(-2.35, 1.085, 2.35); car.rotation.z = .12;
    const seal = add(box(.05, .07, .05, mats.cinabre, -1.85, 1.12, 2.1));
    add(box(.28, .015, .2, new T.MeshStandardMaterial({ color: 0x3a2418, roughness: .5 }), -3.3, 1.088, 2.3));
    add(box(.1, .012, .16, mats.black, -3.55, 1.088, 2.05));
    const bowl = add(lathe([[0, 0], [.06, 0], [.09, .04], [.1, .05]], mats.celadon)); bowl.position.set(-1.6, 1.08, 2.45);
    add(box(2.8, 2.4, .3, mats.lac, -2.55, 1.3, .35));
    for (let i = 0; i < 4; i++) add(box(2.2, .03, .28, mats.brass, -2.55, .8 + i * .45, .55));
    for (let i = 0; i < 9; i++) add(box(.22, .015, .3, mats.paper, -3.4 + i * .22, .83 + (i % 3) * .45, .56));
    const pos = add(box(.1, .018, .17, mats.black, -1.72, 1.1, 2.55)); pos.rotation.x = -.35; pos.rotation.y = -.5;
    const scrn = new T.Mesh(new T.PlaneGeometry(.075, .1), new T.MeshBasicMaterial({ map: cv(96, 128, (x, w, h) => { x.fillStyle = '#16110f'; x.fillRect(0, 0, w, h); x.fillStyle = '#e9c98f'; x.font = '15px "Albert Sans", sans-serif'; x.textAlign = 'center'; x.fillText('¥ 1 280', w / 2, 52); x.fillStyle = '#a33a2c'; x.fillRect(w / 2 - 18, 70, 36, 36); x.fillStyle = '#f3e8d8'; x.font = '15px "Noto Serif SC", serif'; x.fillText('羽西', w / 2, 94); }) }));
    scrn.position.set(0, .0095, 0); scrn.rotation.x = -Math.PI / 2; pos.add(scrn);
    const bagTex = cv(256, 320, (x, w, h) => { x.fillStyle = '#9d2f28'; x.fillRect(0, 0, w, h); noise(x, w, h, 'rgba(0,0,0,0)', .05, 1500, 4); x.fillStyle = '#e9c98f'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '26px "Bodoni Moda", Didot, serif'; x.fillText('YUE SAI', w / 2, h * .62); x.font = '52px "Noto Serif SC", serif'; x.fillText('羽西', w / 2, h * .42); });
    const bag = (x, y, z, sc, rot) => { const g = new T.Group(); const bm = [mats.cinabre, mats.cinabre, mats.cinabre, mats.cinabre, new T.MeshStandardMaterial({ map: bagTex, roughness: .6 }), new T.MeshStandardMaterial({ map: bagTex, roughness: .6 })];
      const b = new T.Mesh(new T.BoxGeometry(.34, .42, .13), bm); b.castShadow = true; g.add(b);
      const hd = new T.Mesh(new T.TorusGeometry(.07, .005, 8, 24, Math.PI), mats.gold); hd.position.y = .21; g.add(hd);
      g.position.set(x, y, z); g.scale.setScalar(sc); g.rotation.y = rot; add(g); };
    bag(-3.62, 1.29, 2.2, 1, .25); bag(-3.85, .42, 3.35, 1.3, .35); bag(-3.35, .35, 3.7, 1.05, -.3);
    const gift = add(box(.24, .1, .18, mats.cinabre, -2.98, 1.13, 2.02)); gift.rotation.y = .2;
    add(box(.245, .104, .02, mats.gold, 0, 0, 0), gift); add(box(.02, .104, .185, mats.gold, 0, 0, 0), gift);
    const pend = add(new T.PointLight(0xffd7a0, 1.4, 4, 2)); pend.position.set(-2.55, 2.6, 2.25);
    add(cyl(.12, .16, .2, mats.brass, -2.55, 2.75, 2.25, 32));
    add(cyl(.004, .004, 1.6, mats.black, -2.55, 3.6, 2.25, 6));
    const vl1 = add(new T.PointLight(0xffe2bd, .9, 6, 2)); vl1.position.set(1.5, 3.8, 3.4);

    /* rotonde */
    const fl = add(new T.Mesh(new T.CircleGeometry(R + .1, 96), mats.floor)); fl.rotation.x = -Math.PI / 2; fl.position.set(0, .12, Z0); fl.receiveShadow = true;
    const open = [0, 90, 180, 270], half = 12;
    open.forEach((a, i) => {
      const start = (a + half) * Math.PI / 180, len = (90 - 2 * half) * Math.PI / 180;
      const w = new T.Mesh(new T.CylinderGeometry(R, R, 5.2, 72, 1, true, start, len), mats.lacIn); w.position.set(0, 2.72, Z0); w.receiveShadow = true; add(w);
      const ring = new T.Mesh(new T.CylinderGeometry(R - .03, R - .03, .035, 72, 1, true, start, len), mats.brass); ring.position.set(0, 3.2, Z0); add(ring);
    });
    open.forEach((a) => {   // encadrements des quatre ouvertures, sur la corde
      const r = a * Math.PI / 180, cx = Math.sin(r) * (R - .02), cz = Z0 + Math.cos(r) * (R - .02);
      const W = 2 * R * Math.sin(half * Math.PI / 180);
      const top = wallWithArches(W + .4, 5.2, .25, [[0, W - .3, 3.8]], mats.lacIn); top.position.set(0, .12, 0);
      const g = new T.Group(); g.add(top); const f = archFrame(W - .3, 3.8, .09, .3, mats.brass); f.position.z = -.03; g.add(f);
      g.position.set(cx, 0, cz); g.rotation.y = r; add(g);
    });
    const ceil = add(new T.Mesh(new T.RingGeometry(1.45, R + .2, 96, 1), mats.ceil)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.32, Z0); fades.push({ o: ceil, key: 'roof' });
    const well = add(new T.Mesh(new T.CylinderGeometry(1.45, 1.45, 1.8, 64, 1, true), mats.ceil)); well.position.set(0, 6.2, Z0); fades.push({ o: well, key: 'roof' });
    const skyDisc = add(new T.Mesh(new T.CircleGeometry(1.45, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true }))); skyDisc.rotation.x = Math.PI / 2; skyDisc.position.set(0, 7.05, Z0); mats.skyDisc = skyDisc.material; fades.push({ o: skyDisc, key: 'roof' });
    const shaft = add(new T.Mesh(new T.CylinderGeometry(1.3, 1.6, 6.9, 48, 1, true), new T.MeshBasicMaterial({ map: texShaft(), transparent: true, opacity: .16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })));
    shaft.position.set(0, 3.6, Z0); mats.shaft = shaft.material; fades.push({ o: shaft, key: 'shaft' });
    const pool = add(new T.Mesh(new T.CircleGeometry(1.8, 48), new T.MeshBasicMaterial({ map: texGlow('rgba(255,245,225,1)'), transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false })));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, .125, Z0); mats.pool = pool.material;
    // le cadran solaire
    add(cyl(1.18, 1.26, .84, mats.stone, 0, .54, Z0, 96));
    const top = add(new T.Mesh(new T.CircleGeometry(1.18, 96), new T.MeshStandardMaterial({ map: texDial(), roughness: .6 }))); top.rotation.x = -Math.PI / 2; top.position.set(0, .965, Z0); top.receiveShadow = true;
    const gs = new T.Shape(); gs.moveTo(0, 0); gs.lineTo(.62, 0); gs.lineTo(0, .46); gs.lineTo(0, 0);
    const gn = add(extrude(gs, .018, mats.brass, .003)); gn.position.set(-.009, .965, Z0 + .31); gn.rotation.y = Math.PI / 2;
    // salon du diagnostic (nord-est) : paravent de papier, deux fauteuils laqués, table et thé
    const sa = Math.PI * .75, sx = Math.sin(sa) * 3.9, sz = Z0 + Math.cos(sa) * 3.9;
    const scr = add(new T.Mesh(new T.CylinderGeometry(R - .5, R - .5, 2.3, 48, 1, true, sa - .38, .76), mats.paper)); scr.position.set(0, 1.27, Z0);
    const chair = (x, z, rot) => {
      const g = new T.Group();
      const seat = box(.62, .12, .56, mats.velvet, 0, .44, 0); g.add(seat);
      const tube = new T.TorusGeometry(.33, .075, 20, 48, Math.PI);
      const armL = new T.Mesh(tube, mats.lac); armL.rotation.y = Math.PI / 2; armL.position.set(-.33, .38, 0); armL.castShadow = true; g.add(armL);
      const armR = armL.clone(); armR.position.x = .33; g.add(armR);
      const backr = new T.Mesh(new T.TorusGeometry(.33, .075, 20, 48, Math.PI), mats.lac); backr.position.set(0, .38, -.3); backr.castShadow = true; g.add(backr);
      [[-.33, .33], [.33, .33], [-.33, -.33], [.33, -.33]].forEach(([a, b]) => g.add(cyl(.075, .075, .38, mats.lac, a, .19, b, 20)));
      g.position.set(x, .12, z); g.rotation.y = rot; add(g);
    };
    chair(sx - .75, sz + .15, -.2 + Math.PI * .25); chair(sx + .55, sz - .7, Math.PI * 1.15);
    add(cyl(.3, .3, .05, mats.lac, sx - .05, .55, sz - .2, 40)); add(cyl(.05, .09, .42, mats.lac, sx - .05, .33, sz - .2, 24));
    const pot = add(lathe([[0, 0], [.05, 0], [.07, .04], [.06, .08], [.02, .1], [.025, .11], [0, .11]], mats.celadon)); pot.position.set(sx, .58, sz - .15);
    [[.1, .05], [-.12, .08]].forEach(([a, b]) => { const c = add(lathe([[0, 0], [.02, 0], [.03, .03], [.032, .035]], mats.celadon)); c.position.set(sx - .05 + a, .58, sz - .2 + b); });
    const tab = add(new T.Mesh(new T.PlaneGeometry(.2, .14), new T.MeshBasicMaterial({ map: cv(256, 180, (x, w, h) => {
      x.fillStyle = '#1b1614'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(233,201,143,.8)'; x.lineWidth = 2;
      x.beginPath(); x.ellipse(70, 92, 34, 46, 0, 0, Math.PI * 2); x.stroke();
      [[62, 80, '#d98a52'], [84, 104, '#9fb1c9'], [70, 120, '#a33a2c']].forEach(([a, b, c]) => { x.fillStyle = c; x.beginPath(); x.arc(a, b, 6, 0, Math.PI * 2); x.fill(); });
      x.fillStyle = '#e9c98f'; x.font = '15px "Albert Sans", sans-serif'; x.fillText('Lecture de peau', 122, 50);
      x.fillStyle = 'rgba(243,232,216,.8)'; x.font = '12px "Albert Sans", sans-serif'; ['Éclat 午 · faible', 'Tension 暮 · haute', 'Hydratation · 62 %'].forEach((l, i) => x.fillText(l, 122, 82 + i * 24));
    }) })));
    tab.rotation.x = -Math.PI / 2; tab.rotation.z = .6; tab.position.set(sx - .2, .583, sz - .32);
    const sl = add(new T.PointLight(0xffd6a8, .9, 4, 2)); sl.position.set(sx, 2.2, sz);
    // fontaine à recharges (nord-ouest)
    const fa = Math.PI * 1.25, fx = Math.sin(fa) * (R - .35), fz = Z0 + Math.cos(fa) * (R - .35);
    const fg = new T.Group();
    fg.add(box(1.9, 1.8, .22, mats.stone, 0, 1.1, 0)); fg.add(box(1.7, .12, .45, mats.stone, 0, .8, .2));
    fg.add(box(1.6, .06, .36, mats.water, 0, .86, .2));
    [-.55, 0, .55].forEach((x) => { fg.add(cyl(.015, .015, .14, mats.brass, x, 1.28, .12, 16)); const sp = cyl(.012, .006, .08, mats.brass, x, 1.2, .2, 16); sp.rotation.x = Math.PI / 2; fg.add(sp); const b = prodPump('amb', 'huile', .14); b.position.set(x, .86, .25); fg.add(b); });
    const fl2 = new T.Mesh(new T.PlaneGeometry(1.2, .22), new T.MeshStandardMaterial({ map: texLabel('RECHARGES', '−30 % · le flacon se garde', '#cdbfab', '#3a2d22', 512, 96), roughness: .8 })); fl2.position.set(0, 1.75, .115); fg.add(fl2);
    fg.position.set(fx, 0, fz); fg.rotation.y = fa + Math.PI; add(fg);
    // bar à brume 午 (sud-ouest, près de l'entrée)
    const ba = Math.PI * 1.8, bx = Math.sin(ba) * (R - .7), bz = Z0 + Math.cos(ba) * (R - .7);
    const bar = new T.Group();
    bar.add(box(2.0, 1.02, .55, mats.lac, 0, .63, 0)); bar.add(box(2.1, .04, .62, mats.stone, 0, 1.16, 0));
    for (let i = 0; i < 6; i++) { const b = prodBrume(); b.position.set(-.75 + i * .3, 1.18, .05); bar.add(b); }
    for (let i = 0; i < 3; i++) { const b = prodTube(mats.alu, 'baume'); b.position.set(.55 + i * .14, 1.18, -.18); b.rotation.x = -.2; bar.add(b); }
    const mir = new T.Mesh(new T.CircleGeometry(.55, 48), mats.mirror); mir.position.set(0, 2.1, -.3); bar.add(mir);
    const mr = new T.Mesh(new T.TorusGeometry(.56, .025, 12, 64), mats.brass); mr.position.set(0, 2.1, -.29); bar.add(mr);
    bar.position.set(bx, 0, bz); bar.rotation.y = ba + Math.PI; add(bar);
    lights.wu = add(new T.PointLight(0xaed8c6, 1.1, 4.5, 2)); lights.wu.position.set(bx * .85, 2.4, Z0 + (bz - Z0) * .85);

    /* les quatre alcôves */
    const alcove = (dir, color, key, imgName) => {
      const g = new T.Group();
      const D = 2.6, Wd = dir === 'N' ? 4.4 : 3.2, H = 3.8;
      const fl3 = new T.Mesh(new T.PlaneGeometry(Wd, D), mats.floor); fl3.rotation.x = -Math.PI / 2; fl3.position.set(0, .12, -D / 2); fl3.receiveShadow = true; g.add(fl3);
      const cl = new T.Mesh(new T.PlaneGeometry(Wd, D), mats.ceil); cl.rotation.x = Math.PI / 2; cl.position.set(0, H, -D / 2); g.add(cl); fades.push({ o: cl, key: 'roof' });
      g.add(box(.15, H, D, mats.plaster, -Wd / 2, H / 2, -D / 2)); g.add(box(.15, H, D, mats.plaster, Wd / 2, H / 2, -D / 2));
      if (dir !== 'N') g.add(box(Wd, H, .15, mats.plaster, 0, H / 2, -D));
      if (imgName) {
        const tex = new T.TextureLoader().load(imgBase + imgName + '.jpg', (t) => { t.encoding = T.sRGBEncoding; });
        const ph = new T.Mesh(new T.PlaneGeometry(1.05, 1.32), new T.MeshStandardMaterial({ map: tex, roughness: .7 })); ph.position.set(dir === 'N' ? -1.45 : 0, 2.35, -D + .145); g.add(ph);
        const fr = box(1.13, 1.4, .03, mats.lac, ph.position.x, 2.35, -D + .12); g.add(fr);
      }
      // étagères laquées
      for (let i = 0; i < 2; i++) g.add(box(dir === 'N' ? 1.3 : 2.4, .04, .32, mats.lac, dir === 'N' ? 1.4 : 0, 1.05 + i * .42, -D + .24));
      const l = new T.PointLight(color, 1.2, 5, 2); l.position.set(0, 3.1, -D / 2); g.add(l); lights[key] = l;
      return g;
    };
    // 晨 à l'est : vasque de pierre pour tester la mousse
    const E = alcove('E', 0xffd89a, 'chen', 'amb_40'); E.position.set(R - .05, 0, Z0); E.rotation.y = -Math.PI / 2; add(E);
    const basin = cyl(.36, .3, .92, mats.stone, 0, .58, 0, 48); basin.position.set(R + 1.25, .58, Z0 + .95); add(basin);
    const bowlw = add(new T.Mesh(new T.CircleGeometry(.3, 40), mats.water)); bowlw.rotation.x = -Math.PI / 2; bowlw.position.set(R + 1.25, 1.03, Z0 + .95);
    const tap = add(new T.Mesh(new T.TorusGeometry(.12, .012, 10, 24, Math.PI), mats.brass)); tap.position.set(R + 1.25, 1.18, Z0 + .72); tap.rotation.y = Math.PI / 2;
    // sur les deux étagères du fond de l'alcôve est
    const eItems = [prodPump('amb', 'mousse'), prodDropper('amb', 'eveil'), prodDropper('amb', 'eveil'), prodTube(mats.white, 'ecran'), prodTube(mats.white, 'ecran'), prodGuaSha(), prodDropper('amb', 'eveil'), prodPump('amb', 'mousse')];
    eItems.forEach((o, i) => { const r2 = i < 5 ? 0 : 1; const k = i < 5 ? i : i - 5; o.position.set(R + 2.36, 1.09 + r2 * .42, Z0 - .8 + k * .38); o.rotation.y = -Math.PI / 2; add(o); });
    // 暮 à l'ouest : mur de rouges, bougies, encens, miroir de coiffeuse
    const W2 = alcove('W', 0xffa860, 'mu', 'amb_33'); W2.position.set(-R + .05, 0, Z0); W2.rotation.y = Math.PI / 2; add(W2);
    const reds = [0x8e1f24, 0xa0243f, 0xb3382a, 0x9a4650];
    for (let r2 = 0; r2 < 2; r2++) for (let i = 0; i < 8; i++) { const o = prodLipstick(reds[i % 4]); o.position.set(-R - 2.36, 1.09 + r2 * .42, Z0 + .9 - i * .2); add(o); }
    [[-R - 1.2, .5], [-R - 1.5, -.9]].forEach(([x, dz], i) => { const c = prodCandle(true); c.position.set(x, 1.0, Z0 + dz); add(c); });
    add(box(.9, .9, .5, mats.lac, -R - 1.3, .57, Z0 - .2));
    const inc = add(box(.26, .08, .2, mats.white, -R - 1.25, 1.06, Z0 - .25)); inc.rotation.y = .3;
    const vm = add(new T.Mesh(new T.CircleGeometry(.42, 48), mats.mirror)); vm.position.set(-R - 2.5, 1.95, Z0 + 1.0); vm.rotation.y = Math.PI / 2;
    // 夜 au nord : la calebasse sous cloche, pots de porcelaine ; porte des cabines au fond
    const N = alcove('N', 0x8ea6ff, 'ye', 'creme-porcelaine_modele'); N.position.set(0, 0, Z0 - R + .05); add(N);
    add(cyl(.42, .48, 1.05, mats.stone, 0, .64, Z0 - R - 1.15, 48));
    const ng = add(prodGourd(mats.ambLiq)); ng.position.set(0, 1.17, Z0 - R - 1.15); ng.scale.multiplyScalar(2);
    const nsp = add(new T.SpotLight(0xffe7c2, 2.2, 6, .28, .6, 2)); nsp.position.set(0, 3.7, Z0 - R - 1.1); nsp.target = ng; lights.yeSpot = nsp;
    for (let r2 = 0; r2 < 2; r2++) for (let i = 0; i < 4; i++) { const o = r2 ? prodDropper('gold', 'nuit') : prodJar(); o.position.set(1.0 + i * .28, 1.09 + r2 * .42, Z0 - R - 2.36); add(o); }
    // couloir des cabines (derrière l'alcôve nord)
    const cz0 = Z0 - R - 2.6;
    const door = add(wallWithArches(4.4, 3.8, .16, [[0, 1.5, 2.8]], mats.plaster)); door.position.set(0, .12, cz0 - .02);
    const cf = add(new T.Mesh(new T.PlaneGeometry(2.4, 7), mats.floor)); cf.rotation.x = -Math.PI / 2; cf.position.set(0, .12, cz0 - 3.5);
    add(box(.2, 3.4, 7, mats.plaster, -1.2, 1.8, cz0 - 3.5)); add(box(.2, 3.4, 7, mats.plaster, 1.2, 1.8, cz0 - 3.5));
    const cc = add(new T.Mesh(new T.PlaneGeometry(2.4, 7), mats.ceil)); cc.rotation.x = Math.PI / 2; cc.position.set(0, 3.4, cz0 - 3.5); fades.push({ o: cc, key: 'roof' });
    for (let i = 1; i <= 3; i++) { const a = add(archFrame(2.0, 3.0, .16, .2, mats.plaster)); a.position.set(0, .12, cz0 - i * 1.8); }
    [cz0 - 1.4, cz0 - 3.2].forEach((z) => { add(cyl(.28, .26, .85, mats.stone, -.78, .55, z, 40)); });
    add(box(2.4, 3.4, .2, mats.plaster, 0, 1.82, cz0 - 7.05));
    add(box(1.1, 2.6, .08, mats.wood, 0, 1.42, cz0 - 6.9)); add(box(.03, .5, .05, mats.brass, .4, 1.3, cz0 - 6.84));
    const cl2 = add(new T.PointLight(0xffd7a8, 1.0, 6, 2)); cl2.position.set(0, 2.8, cz0 - 3.5);
    lights.cab = cl2;

    /* lumières principales */
    lights.hemi = add(new T.HemisphereLight(0xffffff, 0x3a2a22, .5));
    lights.sun = add(new T.DirectionalLight(0xffffff, 1)); lights.sun.position.set(-8, 14, 22);
    const oc = new T.SpotLight(0xffffff, 5, 16, .36, .7, 1.2); oc.position.set(0, 12, Z0); oc.target.position.set(0, 0, Z0); oc.castShadow = true;
    oc.shadow.mapSize.set(1024, 1024); oc.shadow.bias = -.0004; oc.shadow.radius = 4; add(oc); add(oc.target); lights.ocu = oc;
    lights.vit = add(new T.SpotLight(0xffe8c8, 2.4, 7, .3, .7, 2)); lights.vit.position.set(-2.4, 4.2, 5.8); lights.vit.target = vg;
    lights.glowWin = add(sprite(texGlow('rgba(255,200,140,1)'), 5.5, 2.4, 2.4, 6.1, .35)); fades.push({ o: lights.glowWin, key: 'glowdoor' });
  }

  /* ---------------- étiquettes du plan (vue du ciel) ---------------- */
  let tagsEl = null; const TAGS = [];
  function buildTags() {
    const ba = Math.PI * 1.8, fa = Math.PI * 1.25, sa = Math.PI * .75;
    const list = [
      ['Entrée · rue Anfu', 2.4, 7.6], ['Vitrine', -2.4, 5.35], ['24 niches', 3.55, 3.2], ['Table du sceau · caisse', -2.55, 1.5],
      ['Cadran solaire', 0, Z0 + 1.7], ['晨 Éveil', R + 1.3, Z0], ['午 Bar à brume', Math.sin(ba) * 5.3, Z0 + Math.cos(ba) * 5.3],
      ['暮 Dénouer', -R - 1.3, Z0], ['夜 Réparer', 0, Z0 - R - 1.3], ['Salon diagnostic', Math.sin(sa) * 3.9, Z0 + Math.cos(sa) * 3.9],
      ['Fontaine à recharges', Math.sin(fa) * 5.2, Z0 + Math.cos(fa) * 5.2], ['Cabines de soin', 0, Z0 - R - 4.2],
    ];
    tagsEl = document.createElement('div'); tagsEl.className = 'm3d-tags';
    tagsEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    list.forEach(([txt, x, z]) => {
      const e = document.createElement('span'); e.textContent = txt;
      e.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;font:500 11px/1 "Albert Sans",sans-serif;letter-spacing:.06em;color:#f6efe4;background:rgba(24,14,12,.62);padding:6px 9px;border-radius:99px;opacity:0;will-change:transform';
      tagsEl.appendChild(e); TAGS.push({ e, v: new T.Vector3(x, .2, z) });
    });
    host.appendChild(tagsEl);
  }
  function drawTags(k) {
    if (!tagsEl) return;
    tagsEl.style.display = k > 0 ? '' : 'none'; if (k <= 0) return;
    const w = host.clientWidth, h = host.clientHeight, p = new T.Vector3();
    TAGS.forEach((t) => {
      p.copy(t.v).project(camera);
      const x = (p.x * .5 + .5) * w, y = (-p.y * .5 + .5) * h, inView = p.z < 1 && x > 30 && x < w - 30 && y > 20 && y < h - 20;
      t.e.style.opacity = inView ? k : 0; t.e.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
    });
  }

  /* ---------------- chemin de la caméra ---------------- */
  function buildPath() {
    const pts = [], looks = [];
    CH.forEach((c) => { pts.push(new T.Vector3(...(c.pos || c.via))); });
    path = new T.CatmullRomCurve3(pts, false, 'centripetal', .5);
    // cibles : pour un point de passage, on interpole entre les cibles voisines
    const L = CH.map((c, i) => c.look ? new T.Vector3(...c.look) : null);
    for (let i = 0; i < L.length; i++) if (!L[i]) {
      let a = i - 1; while (a >= 0 && !L[a]) a--; let b = i + 1; while (b < L.length && !L[b]) b++;
      const la = L[a] || L[b], lb = L[b] || L[a]; const f = (i - a) / (b - a);
      L[i] = new T.Vector3().lerpVectors(la, lb, f);
    }
    lookPath = new T.CatmullRomCurve3(L, false, 'centripetal', .5);
    stops = []; CH.forEach((c, i) => { if (c.id) stops.push({ id: c.id, u: i / (CH.length - 1) }); });
  }
  const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  // progression 0..1 -> position sur le chemin, avec un temps d'arrêt à chaque chapitre
  function uAt(p) {
    const n = stops.length, seg = p * (n - 1), i = Math.min(n - 2, Math.floor(seg)), f = seg - i;
    const hold = .38;                                 // part de chaque segment passée immobile
    const k = f < hold ? 0 : ease((f - hold) / (1 - hold));
    return stops[i].u + (stops[i + 1].u - stops[i].u) * k;
  }
  function chapterAt(p) { return Math.round(p * (stops.length - 1)); }

  /* ---------------- heure ---------------- */
  let hourNow = 'mu';
  function setHour(key) {
    const h = HOURS[key]; if (!h || !scene) return; hourNow = key;
    scene.background = skyTex(h.sky[0], h.sky[1]);
    scene.fog = new T.Fog(h.fog, 26, 70);
    renderer.toneMappingExposure = h.exp;
    scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach((m) => { if ('envMapIntensity' in m) { if (m.userData.env0 == null) m.userData.env0 = m.envMapIntensity; m.envMapIntensity = m.userData.env0 * h.env; } }); });
    lights.hemi.intensity = h.hemi;
    lights.ocu.color.set(h.ocu[0]); lights.ocu.intensity = h.ocu[1];
    lights.sun.color.set(h.sun[0]); lights.sun.intensity = h.sun[1];
    mats.skyDisc.color.set(h.sky[1]);
    mats.shaft.color.set(h.ocu[0]); mats.pool.color.set(h.ocu[0]);
    mats.window.emissiveIntensity = h.glow * .9;
    ['chen', 'wu', 'mu', 'ye'].forEach((k) => { if (lights[k]) lights[k].intensity = (k === key ? 1.7 : 1) * h.alc; });
    fades.forEach((f) => { if (f.key === 'lamps') f.o.material.opacity = h.lamps ? .9 : 0; if (f.key === 'glowdoor') f.o.material.opacity = .15 + .4 * h.glow; if (f.key === 'wash') f.o.material.opacity = h.lamps ? (key === 'ye' ? .75 : .5) : 0; });
    mats.facade.color.setScalar(h.stone); mats.walk.color.setScalar(h.stone);
    // soleil : direction selon l'heure (lever à l'est, coucher à l'ouest)
    const ang = { chen: -.9, wu: 0, mu: .95, ye: 0 }[key];
    lights.sun.position.set(Math.sin(ang) * 20, key === 'ye' ? 14 : 16 - Math.abs(ang) * 6, 18);
    lights.ocu.position.set(Math.sin(ang) * 1.6, 12, Z0 + (key === 'wu' ? .8 : .2));
  }

  /* ---------------- boucle ---------------- */
  function frame(ts) {
    if (!alive || !running) return;
    if (still && frames++ > still) return;
    raf = requestAnimationFrame(frame);
    // machine lente : on baisse la définition plutôt que la fluidité
    if (lastTs) { const dt = ts - lastTs; slow = slow * .95 + (dt > 26 ? 1 : 0) * .05; if (slow > .6 && dpr > .75) { dpr = Math.max(.75, dpr - .35); renderer.setPixelRatio(dpr); resize(); slow = 0; } }
    lastTs = ts;
    prog += (target - prog) * .075;
    const u = uAt(Math.max(0, Math.min(1, prog)));
    const pos = path.getPoint(Math.min(1, u)), look = lookPath.getPoint(Math.min(1, u));
    const t = (ts - t0) / 1000;
    pos.y += Math.sin(t * .6) * .012; look.x += Math.sin(t * .4) * .02;   // léger flottement de drone
    camera.position.copy(pos); camera.lookAt(look);
    // dernier chapitre : le plafond s'efface pour lire le plan
    const lastIn = Math.max(0, Math.min(1, (prog * (stops.length - 1) - (stops.length - 2) - .36) / .3));
    fades.forEach((f) => { if (f.key === 'roof' || f.key === 'shaft') { f.o.visible = lastIn < .98; if (f.o.material.transparent !== true) { f.o.material.transparent = true; } f.o.material.opacity = f.key === 'shaft' ? .16 * (1 - lastIn) : 1 - lastIn; } });
    // vue du ciel : le plan se décale pour laisser la place au texte (à droite sur écran large, en haut sur téléphone)
    if (lastIn > 0 && vw) { const wide = vw / vh > 1.05; camera.setViewOffset(vw, vh, wide ? -lastIn * .17 * vw : 0, wide ? 0 : lastIn * .2 * vh, vw, vh); }
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    renderer.render(scene, camera);
    drawTags(Math.max(0, (lastIn - .75) * 4));
  }

  function resize() {
    if (!renderer || !host) return;
    const w = host.clientWidth, h = host.clientHeight; vw = w; vh = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 58 : 42; camera.updateProjectionMatrix();
  }

  function init(el, opts = {}) {
    T = window.THREE; if (!T) return false;
    if (T.ColorManagement) T.ColorManagement.legacyMode = false;   // couleurs hexadécimales lues en sRGB
    host = el; still = opts.still || 0;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) { return false; }
    dpr = DPR; renderer.setPixelRatio(dpr);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.className = 'm3d-canvas';
    el.prepend(renderer.domElement);
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(42, 1, .05, 120);
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new T.RoomEnvironment(), .04).texture;
    materials();
    build(opts.imgBase || 'img/');
    buildPath();
    if (opts.tags !== false) buildTags();
    setHour(opts.hour || 'mu');
    resize();
    window.addEventListener('resize', resize);
    alive = true; running = true; t0 = performance.now(); raf = requestAnimationFrame(frame);
    return true;
  }
  function setActive(on) {
    if (!alive) return;
    if (on && !running) { running = true; lastTs = 0; raf = requestAnimationFrame(frame); }
    else if (!on && running) { running = false; cancelAnimationFrame(raf); }
  }
  function destroy() {
    alive = false; running = false; cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (tagsEl) { tagsEl.remove(); tagsEl = null; TAGS.length = 0; }
    if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); renderer.domElement.remove(); }
    scene && scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    renderer = scene = camera = null;
  }
  function setProgress(p, snap) { target = Math.max(0, Math.min(1, p)); if (snap) prog = target; }
  function chapters() { return stops.map((s) => s.id); }
  return { init, destroy, setActive, setProgress, setHour, chapterAt, chapters, get count() { return stops.length; } };
})();
