/* Yue Sai · Maison des Heures — moteur du site */
(() => {
  'use strict';
  const { MOMENTS, ORDER, SHICHEN, TERMS, P, LIEUX, MAISON, MATIERES, STATUTS } = window.YS;
  const IMGS = window.YS_IMGS ? new Set(window.YS_IMGS) : null;
  const has = (n) => !!n && (!IMGS || IMGS.has(n));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const BY = Object.fromEntries(P.map((p) => [p.slug, p]));
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(pointer: fine)').matches;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const ANIM = !!(G && ST) && !RM;
  if (G && ST) G.registerPlugin(ST);

  const PAL = {
    chen: { paper: '#F2ECE1', ink: '#1F1A15', ink2: '#6A5F54', line: 'rgba(31,26,21,.14)', acc: '#B98A2E' },
    wu: { paper: '#ECEFEA', ink: '#17201C', ink2: '#5A6761', line: 'rgba(23,32,28,.14)', acc: '#4F8474' },
    mu: { paper: '#EFE2D2', ink: '#26170F', ink2: '#735846', line: 'rgba(38,23,15,.15)', acc: '#A3582A' },
    ye: { paper: '#10141C', ink: '#ECE5D8', ink2: '#9BA3B1', line: 'rgba(236,229,216,.14)', acc: '#C9A462' },
  };

  /* ---------- utilitaires ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => n.toLocaleString('fr-FR') + ' €';
  const src = (n) => `img/${n}.jpg`;
  const im = (n, alt = '', extra = '') => has(n) ? `<img src="${src(n)}" alt="${esc(alt)}" loading="${/fetchpriority/.test(extra) ? 'eager' : 'lazy'}" decoding="async" ${extra}>` : '';
  const first = (list) => list.find(has);
  const imgsOf = (p) => p.imgs.filter(has);
  const mOf = (p) => MOMENTS[p.m];
  const mark = (p) => p.mark || mOf(p).zh;
  const pad2 = (n) => String(n).padStart(2, '0');
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
  };

  /* ---------- l'heure chinoise ---------- */
  // en local seulement : ?h=8 pour prévisualiser une autre heure
  const FORCE_H = (() => { try { const v = new URLSearchParams(location.search).get('h'); return v == null ? null : +v; } catch (e) { return null; } })();
  function now(d = new Date()) {
    if (FORCE_H != null && !isNaN(FORCE_H)) { d = new Date(d); d.setHours(FORCE_H, 20); }
    const h = d.getHours();
    const idx = Math.floor(((h + 1) % 24) / 2);
    const sc = SHICHEN[idx];
    return { h, mi: d.getMinutes(), hh: pad2(h) + ':' + pad2(d.getMinutes()), idx, sc, m: sc.m };
  }
  const heureDu = (animal) => (animal === 'Chèvre' ? "l'heure de la Chèvre" : `l'heure du ${animal}`);
  function term(d = new Date()) {
    const md = (d.getMonth() + 1) * 100 + d.getDate();
    let i = TERMS.length - 1;
    TERMS.forEach((t, k) => { if (t[2] * 100 + t[3] <= md) i = k; });
    return { i, cur: TERMS[i], next: TERMS[(i + 1) % 24] };
  }
  const moisFr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const quand = { chen: 'ce matin', wu: 'midi', mu: 'ce soir', ye: 'cette nuit' };

  /* ---------- panier ---------- */
  let bag = store.get('ys-bag', []);
  const bagCount = () => bag.reduce((s, it) => s + it.q, 0);
  const lineOf = (it) => { const p = BY[it.s]; const o = p.options[it.o] || p.options[0]; return { p, o, price: o[1] * it.q }; };
  function addToBag(slug, o, shade, q) {
    const key = `${slug}|${o}|${shade ?? ''}`;
    const ex = bag.find((it) => it.k === key);
    if (ex) ex.q += q; else bag.push({ k: key, s: slug, o, sh: shade, q });
    store.set('ys-bag', bag);
    syncBag();
    toast(`Ajouté au panier · ${BY[slug].name}`);
  }
  function syncBag() {
    $$('[data-bag-count]').forEach((el) => { el.textContent = bagCount(); });
    if (!$('#bag').hidden) renderBag();
  }
  function renderBag(done) {
    const list = $('#bag .b-list');
    const foot = $('#bag .b-foot');
    if (done) {
      list.innerHTML = `<div class="b-empty"><span class="seal big">羽西</span><p class="h3">Commande de démonstration enregistrée.</p><p class="muted">Ce site est un concept étudiant : aucun paiement n'a été demandé et rien ne sera expédié. Dans la vraie maison, votre commande partirait sous 48 h dans l'enveloppe scellée au cinabre.</p></div>`;
      foot.innerHTML = `<a class="btn" href="#collection" data-close-bag>Retour à la collection<span class="arr"></span></a>`;
      return;
    }
    if (!bag.length) {
      list.innerHTML = `<div class="b-empty"><p class="h3">Votre panier est vide.</p><p class="muted">Commencez par le rituel de l'heure qu'il est, ou par le Coffret 7 Jours : il est remboursé sur la première routine.</p><a class="btn" href="#p-coffret-7" data-close-bag>Le Coffret 7 Jours<span class="arr"></span></a></div>`;
      foot.innerHTML = '';
      return;
    }
    list.innerHTML = bag.map((it, i) => {
      const { p, o, price } = lineOf(it);
      const sh = p.shades && it.sh != null ? ` · ${p.shades[it.sh][1]}` : '';
      return `<div class="b-item">
        <a class="ph" href="#p-${p.slug}" data-close-bag>${im(first(p.imgs), p.name)}</a>
        <div><p class="h3" style="font-size:1.15rem">${p.name}</p><p class="muted" style="font-size:13px">${esc(o[0])}${sh}</p>
          <div class="qty" role="group" aria-label="Quantité"><button type="button" data-q="${i}" data-d="-1" aria-label="Retirer un">−</button><output>${it.q}</output><button type="button" data-q="${i}" data-d="1" aria-label="Ajouter un">+</button></div></div>
        <p class="mono">${eur(price)}</p></div>`;
    }).join('');
    const sub = bag.reduce((s, it) => s + lineOf(it).price, 0);
    const port = sub >= 60 ? 'offerte' : '6 €';
    foot.innerHTML = `<div class="b-sum"><span>Sous-total</span><span class="num">${eur(sub)}</span></div>
      <p class="muted" style="font-size:13px">Livraison ${port} (offerte dès 60 €) · échantillons de l'heure glissés dans l'enveloppe · retours sous 30 jours.</p>
      <button class="btn solid" type="button" data-checkout style="justify-content:center">Commander · démonstration<span class="arr"></span></button>
      <p class="muted" style="font-size:11.5px">Boutique de démonstration d'un concept étudiant : aucune donnée de paiement n'est demandée.</p>`;
  }
  function openBag() { const b = $('#bag'); b.hidden = false; renderBag(); lockScroll(true); if (G && !RM) { G.fromTo('#bag .b-panel', { xPercent: 100 }, { xPercent: 0, duration: .7, ease: 'expo.out' }); G.fromTo('#bag .b-shade', { opacity: 0 }, { opacity: 1, duration: .5 }); } $('#bag .b-close').focus(); }
  function closeBag() {
    const b = $('#bag'); if (b.hidden) return;
    const end = () => { b.hidden = true; lockScroll(false); };
    if (G && !RM) { G.to('#bag .b-panel', { xPercent: 100, duration: .5, ease: 'expo.in' }); G.to('#bag .b-shade', { opacity: 0, duration: .5, onComplete: end }); } else end();
  }
  let toastT;
  function toast(msg) { const t = $('.toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }

  /* ---------- défilement ---------- */
  let lenis = null;
  function lockScroll(on) { document.body.classList.toggle('locked', on); if (lenis) (on ? lenis.stop() : lenis.start()); }
  function scrollTop() { if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); window.scrollTo(0, 0); }
  function scrollToEl(el) { if (!el) return; if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 }); else el.scrollIntoView(); }
  function initScroll() {
    if (RM || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    if (ANIM) { lenis.on('scroll', ST.update); G.ticker.add((t) => lenis.raf(t * 1000)); G.ticker.lagSmoothing(0); }
    else { const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
  }

  /* ---------- composants ---------- */
  function ruler(active, ink) {
    return `<nav class="ruler${ink ? ' ink' : ''}" aria-label="Les douze heures chinoises">${SHICHEN.map((s, i) =>
      `<a href="#heure-${s.m}" class="${i === active ? 'now' : ''}" title="${s.zh}时 · ${pad2(s.start)} h – ${pad2((s.start + 2) % 24)} h · ${heureDu(s.animal)}"><span class="zh">${s.zh}</span><span class="mono">${pad2(s.start)}h</span></a>`).join('')}</nav>`;
  }
  const cols = (n) => (n <= 4 ? n : n % 3 === 0 ? 3 : 4);
  function card(p, i) {
    const imgs = imgsOf(p);
    const alt = imgs[1] || null;
    return `<a class="card" href="#p-${p.slug}" data-cursor="Voir">
      <figure class="ph">${p.badge ? `<span class="c-badge">${p.badge}</span>` : ''}${im(imgs[0], p.name, 'class="main"')}${alt ? im(alt, '', 'class="alt" aria-hidden="true"') : ''}</figure>
      <div class="c-meta"><span class="c-name"><span class="c-m">${mark(p)}</span>${p.name}</span><span class="c-price">${eur(p.price)}</span><span class="c-tag">${esc(p.tag)} · ${p.vol}</span></div></a>`;
  }
  function indexRows(list) {
    return list.map((p, i) => `<a class="i-row" href="#p-${p.slug}" data-peek="${esc(first(p.imgs) || '')}" data-cursor="Voir">
      <span class="i-n">${pad2(i + 1)}</span><span class="i-name">${p.name}<small>${p.zh}</small></span><span class="i-m">${mark(p)}</span><span class="i-p">${eur(p.price)}</span></a>`).join('');
  }
  function dial(win, size = 150) {
    const c = size / 2, R = size * 0.37, Rt = size * 0.47;
    const pt = (h, r) => { const a = (h / 24) * Math.PI * 2 - Math.PI / 2; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
    const n = now();
    let arc;
    const span = win[1] - win[0];
    if (span >= 24) arc = `<circle class="w-arc" cx="${c}" cy="${c}" r="${R}" stroke-width="7"/>`;
    else {
      const [x0, y0] = pt(win[0], R), [x1, y1] = pt(win[1], R);
      arc = `<path class="w-arc" d="M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${span > 12 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" stroke-width="7"/>`;
    }
    let ticks = '';
    for (let h = 0; h < 24; h++) { const [a, b] = pt(h, R - 5), [x, y] = pt(h, R - (h % 2 ? 8 : 11)); ticks += `<line class="w-tick" x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke-width=".6"/>`; }
    const labels = SHICHEN.map((s) => { const [x, y] = pt(s.start + 1, Rt); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${s.zh}</text>`; }).join('');
    const [nx, ny] = pt(n.h + n.mi / 60, R);
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Cadran des vingt-quatre heures : moment d'usage de ${pad2(win[0] % 24)} h à ${pad2(win[1] % 24)} h"><circle class="w-ring" cx="${c}" cy="${c}" r="${R}" stroke-width="7"/>${arc}${ticks}${labels}<circle class="w-now" cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="3.2"/></svg>`;
  }
  function jClock() {
    const S = 132, c = S / 2, R = 50;
    const pt = (h, r) => { const a = (h / 24) * Math.PI * 2 - Math.PI / 2; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
    let t = '';
    for (let h = 0; h < 24; h++) { const [a, b] = pt(h, R), [x, y] = pt(h, R - (h % 2 ? 4 : 8)); t += `<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-width="${h % 2 ? .6 : 1}" opacity=".6"/>`; }
    const lab = SHICHEN.map((s) => { const [x, y] = pt(s.start + 1, R + 11); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="8.5" fill="currentColor" opacity=".7" style="font-family:var(--f-zh)">${s.zh}</text>`; }).join('');
    const [hx, hy] = pt(0, R - 12);
    return `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="currentColor" stroke-width=".8" opacity=".5"/>${t}${lab}<g class="jc-hand" style="transform-origin:${c}px ${c}px;transform:rotate(${(5 / 24) * 360}deg)"><line x1="${c}" y1="${c}" x2="${hx}" y2="${hy}" stroke="var(--cinabre)" stroke-width="1.6"/><circle cx="${c}" cy="${c}" r="2.6" fill="var(--cinabre)"/></g><text class="jc-zh" x="${c}" y="${c + 22}" text-anchor="middle" font-size="15" fill="currentColor" style="font-family:var(--f-zh)">卯</text></svg>`;
  }

  function termRing() {
    const t = term();
    const S = 520, c = S / 2, R1 = 200, R2 = 236;
    const d = new Date();
    let out = '';
    TERMS.forEach((tm, i) => {
      const a = ((i + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
      const a0 = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const on = i === t.i;
      const x = c + R2 * Math.cos(a), y = c + R2 * Math.sin(a);
      const mx0 = c + (R1 - 10) * Math.cos(a0), my0 = c + (R1 - 10) * Math.sin(a0), mx1 = c + (R1 + (on ? 18 : 8)) * Math.cos(a0), my1 = c + (R1 + (on ? 18 : 8)) * Math.sin(a0);
      out += `<g class="${on ? 't-now' : ''}"><line class="t-mark" x1="${mx0.toFixed(1)}" y1="${my0.toFixed(1)}" x2="${mx1.toFixed(1)}" y2="${my1.toFixed(1)}" stroke-width="${on ? 2 : 1}"/><text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${on ? 17 : 13}">${tm[0]}</text></g>`;
    });
    const a0 = (t.i / 24) * 360, a1 = ((t.i + 1) / 24) * 360;
    return `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="Les vingt-quatre termes solaires ; aujourd'hui ${t.cur[0]}, ${t.cur[1]}">
      <circle cx="${c}" cy="${c}" r="${R1}" fill="none" stroke="var(--line)"/>
      <path d="${arcPath(c, R1, a0, a1)}" fill="none" stroke="var(--cinabre)" stroke-width="3"/>
      ${out}
      <text x="${c}" y="${c - 34}" text-anchor="middle" font-size="64" style="fill:var(--ink);font-family:var(--f-brush)">${t.cur[0]}</text>
      <text x="${c}" y="${c + 24}" text-anchor="middle" font-size="17" style="fill:var(--ink);font-family:var(--f-display);font-style:italic">${t.cur[1]}</text>
      <text x="${c}" y="${c + 54}" text-anchor="middle" font-size="12" style="fill:var(--ink-2);font-family:var(--f-mono)">depuis le ${t.cur[3]} ${moisFr[t.cur[2] - 1]} · puis ${t.next[0]} le ${t.next[3]} ${moisFr[t.next[2] - 1]}</text>
    </svg>`;
  }
  function arcPath(c, r, d0, d1) {
    const p = (d) => { const a = (d - 90) * Math.PI / 180; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
    const [x0, y0] = p(d0), [x1, y1] = p(d1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }

  /* ---------- pages ---------- */
  function home() {
    const n = now();
    const M = MOMENTS[n.m];
    const hero = first([M.hero, ...M.gallery, ...ORDER.map((k) => MOMENTS[k].hero), ...P.flatMap((p) => p.imgs)]);
    const panels = ORDER.map((k) => {
      const m = MOMENTS[k];
      const img = first([m.hero, ...m.gallery].filter((g) => g !== hero)) || first([m.hero, ...m.gallery]);
      return `<article class="j-panel" data-k="${k}">
        <span class="brush j-brush" aria-hidden="true">${m.zh}</span>
        <div class="j-text">
          <p class="eyebrow">${m.zh} ${m.fr} · ${m.hours} · <span class="zh">${m.shichen.join(' ')}</span></p>
          <p class="j-line">${m.line}</p>
          <p class="body-t">${m.text}</p>
          <dl class="j-meta"><b>Le geste</b><span>${m.gesture}</span><b>Durée</b><span>${m.duree}</span><b>Le lieu</b><span>${m.lieu}</span></dl>
          <div class="j-prods">${m.products.map((s) => `<a class="ul" href="#p-${s}">${BY[s].name} <span class="mono">${eur(BY[s].price)}</span></a>`).join('')}</div>
          <p><a class="btn" href="#heure-${k}">Entrer dans l'heure ${m.zh}<span class="arr"></span></a></p>
        </div>
        <figure class="ph j-img">${im(img, `${m.fr}, ${m.hours}`)}</figure>
      </article>`;
    }).join('');
    const lt = LIEUX.filter((l) => has(l.img));
    const ltA = lt.find((l) => l.lieu === 'La chambre') || lt[0];
    const ltB = lt.find((l) => l.lieu === 'Le restaurant');
    const ltC = lt.find((l) => l.lieu === 'La couverture');
    return `
    <section class="hero" data-over>
      <div class="h-img">${im(hero, `${M.fr} : ${M.line}`, 'data-hero fetchpriority="high"')}${M.gallery.filter((g) => has(g) && g !== hero && !/_/.test(g.replace(/^amb_/, ''))).slice(0, 2).map((g) => im(g, '', 'class="h-alt" aria-hidden="true"')).join('')}</div>
      <div class="h-brush brush" aria-hidden="true">${M.zh}</div>
      <div class="h-in">
        <div class="h-top"><span class="seal">羽西</span><p class="eyebrow">${M.zh} ${M.fr} · ${M.hours} · <span class="zh">${n.sc.zh}时</span>, ${heureDu(n.sc.animal)}</p></div>
        <h1 class="display xl h-title" data-split>Il est l'heure de <em>${M.verb}</em>.</h1>
        <div class="h-foot">
          <p class="lede">${M.line} Le rituel de ${quand[M.key]} tient en ${M.duree}.</p>
          <div class="h-ctas"><a class="btn light" href="#heure-${M.key}">Le rituel de ${quand[M.key]}<span class="arr"></span></a><a class="btn light" href="#collection">La collection</a></div>
        </div>
        ${ruler(n.idx)}
      </div>
    </section>

    <section class="sec wrap">
      <div class="manifest">
        <p class="m-zh zh" aria-hidden="true">顺时而美</p>
        <div class="m-text">
          <p class="eyebrow">Maison de beauté chinoise · Shanghai, depuis 1992</p>
          <h2 class="display" data-split>La beauté suit l'heure. Chaque soin Yue Sai appartient à un moment de la journée et porte <em>son caractère</em>.</h2>
          <p class="body-t muted">La tradition chinoise découpe le jour en douze heures doubles, 十二时辰. Nous les réunissons en quatre rituels. On ne cherche pas à paraître plus jeune : on reprend la main sur son temps.</p>
          <div class="m-four">${ORDER.map((k) => { const m = MOMENTS[k]; return `<a href="#heure-${k}" data-cursor="Entrer"><span class="brush">${m.zh}</span><span class="eyebrow">${m.fr}</span><span class="mono muted">${m.hours}</span></a>`; }).join('')}</div>
        </div>
      </div>
    </section>

    <div class="marquee" aria-hidden="true"><div class="mq">${Array(2).fill(`<span>Belle à l'heure qu'il est</span><span class="zh">顺时而美</span><span>Douze heures doubles</span><span class="zh">十二时辰</span><span>Vingt-quatre termes solaires</span><span class="zh">二十四节气</span>`).join('')}</div></div>

    <section class="journee" aria-label="Une journée en quatre rituels">
      <div class="j-stage">${panels}<div class="j-clock" aria-hidden="true">${jClock()}</div><div class="j-prog" aria-hidden="true">${ORDER.map((k, i) => `<span class="${i ? '' : 'on'}">${MOMENTS[k].zh}</span>`).join('')}</div></div>
    </section>

    <section class="sec-s wrap"><div class="carnet-cta"><p class="eyebrow">Le Carnet des Heures</p><p class="h2">Quatre questions, <em>votre rituel heure par heure</em>.</p><a class="btn" href="#carnet">Composer mon Carnet<span class="arr"></span></a></div></section>

    <section class="sec wrap">
      <div class="page-head" style="padding:0 0 clamp(30px,4vw,50px)">
        <div class="ph-row"><div class="stack" style="gap:14px"><p class="eyebrow">La collection · ${P.length} objets</p><h2 class="h2" data-split>Quinze objets, <em>quatre heures</em>.</h2></div><a class="btn" href="#collection">Toute la collection<span class="arr"></span></a></div>
      </div>
      <div class="index" data-peek-list>${indexRows(P)}</div>
    </section>

    <section class="sec-s">
      <div class="wrap page-head" style="padding-top:0"><div class="ph-row"><div class="stack" style="gap:14px"><p class="eyebrow">Les matières</p><h2 class="h2" data-split>D'où viennent <em>nos ingrédients</em>.</h2></div><a class="ul" href="#matieres">Toutes les matières →</a></div></div>
      <div class="rail" data-drag>${MATIERES.filter((m) => has(m.img)).map((m) => `<a href="#p-${m.p}" class="stack" style="gap:12px" data-cursor="Voir"><figure class="ph r45">${im(m.img, m.fr)}</figure><div class="row" style="justify-content:space-between"><span class="h3">${m.fr}</span><span class="zh" style="font-size:1.4rem">${m.zh}</span></div><span class="mono muted">${m.lieu}</span></a>`).join('')}</div>
    </section>

    <section class="sec wrap">
      <div class="lieux-teaser">
        ${ltA ? `<figure class="ph r45 lt-a" data-clip>${im(ltA.img, 'Une chambre d’hôtel partenaire, le soir', 'class="par" data-par="6"')}</figure>` : ''}
        <div class="lt-text">
          <p class="eyebrow">Les Lieux du Temps</p>
          <h2 class="h2" data-split>On nous reconnaît <em>avant de nous lire</em>.</h2>
          <p class="body-t">Dans nos hôtels, nos restaurants et nos bars partenaires, aucun logo : la même odeur d'armoise et de santal, la même porcelaine céladon, la même cuvette du pouce que sur nos flacons. Un soir, la cliente dit « ça sent comme là-bas ». L'achat a déjà eu lieu dans sa mémoire.</p>
          <p><a class="btn" href="#lieux">Les Lieux du Temps<span class="arr"></span></a></p>
        </div>
        ${ltB ? `<div class="lt-b"><figure class="ph r34" data-clip>${im(ltB.img, ltB.lieu)}</figure><div class="stamp"><span>${ltB.lieu}</span><span class="mono">${ltB.t}</span></div></div>` : ''}
        ${ltC ? `<div class="lt-c"><figure class="ph r34" data-clip>${im(ltC.img, ltC.lieu)}</figure><div class="stamp"><span>${ltC.lieu}</span><span class="mono">${ltC.t}</span></div></div>` : ''}
      </div>
    </section>

    ${has('amb_6') ? `<section class="facade" data-over>
      <div class="f-img">${im('amb_6', 'La façade laquée de la Maison des Heures, Shanghai', 'class="par" data-par="5"')}</div>
      <div class="f-in"><p class="eyebrow" style="color:rgba(246,240,230,.8)">La Maison · Shanghai, Anfu Lu · 2027</p><h2 class="display l" data-split>Deux arches de laque. <em>Aucune enseigne.</em></h2><p class="lede" style="color:rgba(246,240,230,.9)">On entre parce que la lumière appelle, et l'on ressort avec un rituel écrit à la main.</p><p class="row"><a class="btn light" href="#ouverture">Entrer dans la Maison<span class="arr"></span></a></p></div>
    </section>` : ''}

    <section class="sec wrap">
      <div class="ring-wrap">
        <div class="ring">${termRing()}</div>
        <div class="stack" style="gap:24px">
          <p class="eyebrow">Le Cercle des 24 Souffles</p>
          <h2 class="h2" data-split>Une fidélité qui se gagne <em>à l'assiduité</em>.</h2>
          <p class="body-t">Trois statuts inspirés de la porcelaine, de l'ébauche à l'émail. Et vingt-quatre Passeurs Céladon par an, un par terme solaire, choisis sur l'engagement et jamais sur la dépense.</p>
          <p><a class="btn" href="#cercle">Rejoindre le Cercle<span class="arr"></span></a></p>
        </div>
      </div>
    </section>`;
  }

  function heure(k) {
    const m = MOMENTS[k] || MOMENTS.chen;
    const i = ORDER.indexOf(m.key);
    const nx = MOMENTS[ORDER[(i + 1) % 4]];
    const sc = SHICHEN.filter((s) => s.m === m.key);
    const prods = m.products.map((s) => BY[s]);
    const gal = m.gallery.filter(has);
    return `
    <section class="mh">
      <span class="mh-brush brush" aria-hidden="true">${m.zh}</span>
      <figure class="ph mh-img" data-clip>${im(first([m.hero, ...m.gallery]), `${m.fr}, ${m.hours}`, 'class="par" data-par="5"')}</figure>
      <div class="mh-text">
        <p class="eyebrow">${m.zh} · ${m.pinyin} · ${m.hours}</p>
        <h1 class="display xl" data-split>${m.fr}</h1>
        <p class="lede">${m.line}</p>
      </div>
    </section>
    <section class="sec-s wrap"><div class="grid12" style="row-gap:30px">
      <div style="grid-column:1/span 5" class="stack"><p class="eyebrow">Ce qui se passe dans la peau</p><p class="h3">${m.chrono}</p></div>
      <p class="body-t" style="grid-column:7/span 6">${m.text}</p>
    </div></section>
    <section class="wrap"><div class="shichen">${sc.map((s) => `<div><span class="zh">${s.zh}时</span><span class="mono">${pad2(s.start)} h – ${pad2((s.start + 2) % 24)} h</span><span>${heureDu(s.animal).replace(/^l/, 'L')}</span><span class="muted" style="font-size:13px">Dans la tradition, le méridien ${/^[aeiouéè]/i.test(s.organe) ? "de l'" : 'du '}${s.organe}.</span></div>`).join('')}</div></section>
    <section class="sec wrap">
      <div class="ph-row" style="display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:34px"><div class="stack" style="gap:12px"><p class="eyebrow">Le rituel · ${m.duree}</p><h2 class="h2" data-split>${m.gesture}</h2></div><p class="mono muted">${prods.length} soins · ${eur(prods.reduce((s, p) => s + p.price, 0))} le rituel complet</p></div>
      <div class="steps">${prods.map((p, j) => `<a class="st" href="#p-${p.slug}" data-cursor="Voir"><span class="s-n">${pad2(j + 1)}</span><span class="row" style="flex-wrap:nowrap"><figure class="ph">${im(first(p.imgs), p.name)}</figure><span class="h3">${p.name}</span></span><span class="s-d muted">${esc(p.ritual[0])}</span><span class="mono">${eur(p.price)}</span></a>`).join('')}</div>
    </section>
    ${gal.length ? `<section class="sec-s wrap"><div class="gal">${gal.slice(0, 4).map((g, j) => `<figure class="ph ${['r45', 'r34', 'r34', 'r169'][j]} g${j + 1}" data-clip>${im(g, `${m.fr}, ambiance`, 'class="par" data-par="6"')}</figure>`).join('')}</div></section>` : ''}
    <section class="sec wrap"><div class="stack" style="gap:28px"><p class="eyebrow">Les soins de l'heure</p><div class="cards" style="--cols:${cols(prods.length)}">${prods.map(card).join('')}</div></div></section>
    <a class="next-m" href="#heure-${nx.key}" data-cursor="Suivant"><div class="stack" style="gap:10px"><p class="eyebrow">Heure suivante · ${nx.hours}</p><p class="display l">${nx.fr}</p></div><span class="brush" aria-hidden="true">${nx.zh}</span></a>`;
  }

  let colFilter = 'tous', colView = 'grille';
  function collection() {
    const f = [['tous', 'Tous', ''], ...ORDER.map((k) => [k, MOMENTS[k].fr, MOMENTS[k].zh]), ['coffrets', 'Coffrets', '礼']];
    return `
    <section class="page-head">
      <p class="eyebrow">La collection · ${P.length} objets · quatre moments</p>
      <h1 class="display xl" data-split>La collection</h1>
      <div class="ph-row">
        <div class="filters" role="group" aria-label="Filtrer par moment">${f.map(([k, l, z]) => `<button type="button" data-f="${k}" aria-pressed="${colFilter === k}">${z ? `<span class="zh">${z}</span>` : ''}${l}</button>`).join('')}</div>
        <div class="toggle" role="group" aria-label="Affichage"><button type="button" data-v="grille" aria-pressed="${colView === 'grille'}">Grille</button><button type="button" data-v="index" aria-pressed="${colView === 'index'}">Index</button><button type="button" data-v="journee" aria-pressed="${colView === 'journee'}">Journée</button></div>
      </div>
    </section>
    <section class="wrap" style="padding-bottom:clamp(80px,10vw,160px)"><div id="col-list">${colList()}</div></section>`;
  }
  function colList() {
    const list = P.filter((p) => colFilter === 'tous' || (colFilter === 'coffrets' ? /^coffret/.test(p.slug) : p.m === colFilter && !/^coffret/.test(p.slug)));
    if (colView === 'index') return `<div class="index" data-peek-list>${indexRows(list)}</div>`;
    if (colView === 'journee') return dayline(list);
    return `<div class="cards" style="--cols:${cols(list.length)}">${list.map(card).join('')}</div>`;
  }

  function dayline(list) {
    const H0 = 5;
    const pct = (h) => ((((h - H0) % 24) + 24) % 24) / 24 * 100;
    const n = now();
    const nowP = pct(n.h + n.mi / 60);
    const hours = Array.from({ length: 12 }, (_, i) => (H0 + i * 2) % 24);
    const rows = list.map((p) => {
      const [a, b] = p.freq.win;
      const full = b - a >= 24;
      const left = full ? 0 : pct(a), width = full ? 100 : ((b - a) / 24) * 100;
      return `<a class="dl-row" href="#p-${p.slug}" data-peek="${esc(first(p.imgs) || '')}" data-cursor="Voir">
        <span class="dl-name"><span class="zh">${mark(p)}</span>${p.name}</span>
        <span class="dl-track"><i class="c-${p.m}${full ? ' full' : ''}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></i></span>
        <span class="dl-freq">${p.freq.how} · ${p.freq.dose.toLowerCase()}</span></a>`;
    }).join('');
    return `<div class="dayline" data-peek-list>
      <div class="dl-head"><span></span><div class="dl-scale">
        ${ORDER.map((k, i) => `<span class="dl-band c-${k}" style="left:${i * 25}%"><span class="zh">${MOMENTS[k].zh}</span> ${MOMENTS[k].fr}</span>`).join('')}
        ${hours.map((h, i) => `<span class="dl-h" style="left:${(i / 12) * 100}%">${pad2(h)}h</span>`).join('')}
      </div><span></span></div>
      <div class="dl-body"><div class="dl-overlay" aria-hidden="true"><span></span><span class="dl-ov"><i class="dl-now" style="left:${nowP.toFixed(2)}%"><span>${n.hh}</span></i></span><span></span></div>${rows}</div>
      <p class="muted" style="font-size:13px;margin-top:18px">Chaque barre montre le moment où le soin sert le mieux ; la ligne rouge, l'heure qu'il est.</p>
    </div>`;
  }

  function produit(slug) {
    const p = BY[slug];
    if (!p) return collection();
    const m = mOf(p);
    const imgs = imgsOf(p);
    const n = now();
    const pairs = p.pair.map((s) => BY[s]).filter(Boolean);
    const idx = P.indexOf(p);
    const nxt = P[(idx + 1) % P.length];
    const gal = [
      imgs[0] ? `<figure class="ph" data-zoom="${imgs[0]}">${im(imgs[0], p.name, 'fetchpriority="high"')}</figure>` : '',
      imgs.length > 2 ? `<div class="duo"><figure class="ph">${im(imgs[1], p.name)}</figure><figure class="ph">${im(imgs[2], p.name)}</figure></div>` : (imgs[1] ? `<figure class="ph">${im(imgs[1], p.name)}</figure>` : ''),
      ...imgs.slice(3).map((g) => `<figure class="ph">${im(g, p.name)}</figure>`),
    ].join('');
    const inWin = (() => { const h = n.h + n.mi / 60; const [a, b] = p.freq.win; if (b - a >= 24) return true; return b > 24 ? (h >= a || h < b - 24) : (h >= a && h < b); })();
    const band = first([m.hero, ...m.gallery].filter((g) => !imgs.includes(g))) || first([m.hero, ...m.gallery]);
    return `
    <section class="pdp">
      <div class="pdp-gal">${gal}</div>
      <aside class="pdp-info">
        <nav class="crumbs" aria-label="Fil d'Ariane"><a href="#collection">Collection</a><span>/</span><a href="#heure-${m.key}">${m.zh} ${m.fr}</a><span>/</span><span>${p.name}</span></nav>
        <div class="stack" style="gap:12px">
          <div class="row"><span class="chip"><span class="zh">${mark(p)}</span>${p.mark === '初' ? "L'essai" : p.mark === '全' ? 'La journée' : m.fr} · ${m.hours}</span>${p.badge ? `<span class="chip">${p.badge}</span>` : ''}</div>
          <h1 class="p-name" data-split>${p.name}</h1>
          <p class="p-zh">${p.zh}</p>
        </div>
        <p class="body-t">${p.desc}</p>
        <p class="p-price" id="p-price">${eur(p.options[0][1])}<small>${p.vol}</small></p>
        ${p.shades ? `<div class="stack" style="gap:10px"><p class="eyebrow">Teinte · <span id="shade-n">${p.shades[0][1]}</span></p><div class="shades" role="group" aria-label="Teintes">${p.shades.map((s, j) => `<button type="button" data-shade="${j}" aria-pressed="${j === 0}" aria-label="${s[1]}"><i style="background:${s[2]}"></i><span class="zh">${s[0]}</span></button>`).join('')}</div></div>` : ''}
        <fieldset class="opts" style="border:0;padding:0;margin:0"><legend class="eyebrow" style="padding:0 0 10px">Format</legend>${p.options.map((o, j) => `<label><input type="radio" name="opt" id="opt-${j}" value="${j}" ${j ? '' : 'checked'}><span><span class="o-n">${esc(o[0])}</span><span class="o-d">${esc(o[2])}</span></span><span class="o-p">${eur(o[1])}</span></label>`).join('')}</fieldset>
        <div class="buy" id="buy"><div class="qty" role="group" aria-label="Quantité"><button type="button" data-qty="-1" aria-label="Moins">−</button><output id="qty">1</output><button type="button" data-qty="1" aria-label="Plus">+</button></div><button class="btn solid" type="button" data-add="${p.slug}">Ajouter au panier<span class="arr"></span></button></div>
        <div class="assur"><div>Livré en 48 h dans l'enveloppe Yue Sai, scellée au cinabre</div><div>Recharges à −30 % : le flacon se garde</div><div>Diagnostic de 15 minutes offert en Maison</div></div>
        <div class="when">${dial(p.freq.win)}<dl><dt>Quand</dt><dd>${p.freq.how}${inWin ? ` · <span style="color:var(--cinabre)">c'est le moment</span>` : ''}</dd><dt>Dose</dt><dd>${p.freq.dose}</dd><dt>Durée</dt><dd>${p.freq.dure}</dd><dt>Sensation</dt><dd>${p.sens.join(' · ')}</dd></dl></div>
        <div class="acc">
          <details open><summary>${/^coffret/.test(p.slug) ? 'Ce que contient le coffret' : 'Le rituel'}</summary><div class="a-body"><ol>${p.ritual.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></div></details>
          <details><summary>La formule</summary><div class="a-body">${esc(p.formula)}</div></details>
          <details><summary>La matière</summary><div class="a-body">${esc(p.matiere)}</div></details>
          <details><summary>Livraison et retours</summary><div class="a-body">Expédition sous 24 h, livraison en 48 h en Chine continentale et en 4 jours en Europe. Échantillons de l'heure glissés dans chaque enveloppe. Retours gratuits sous 30 jours, en Maison ou par coursier.</div></details>
        </div>
        <div class="stats">${p.stats.map((s) => `<div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`).join('')}</div>
        ${p.stats.some((s) => /\*/.test(s[1])) ? '<p class="muted" style="font-size:11.5px">* Résultats illustratifs d’un concept étudiant, non issus d’études réelles.</p>' : ''}
      </aside>
    </section>
    ${band ? `<section class="moment-band" data-over>
      <div class="mb-img">${im(band, `${m.fr}, ${m.hours}`, 'class="par" data-par="6"')}</div>
      <div class="mb-in"><span class="brush mb-brush" aria-hidden="true">${m.zh}</span><div class="mb-text"><p class="eyebrow" style="color:rgba(246,240,230,.8)">Le moment · ${m.hours}</p><p class="display l" data-split>${m.line}</p><p class="row"><a class="btn light" href="#heure-${m.key}">Tout le rituel ${m.zh}<span class="arr"></span></a></p></div></div>
    </section>` : ''}
    <section class="sec wrap"><div class="stack" style="gap:30px"><div class="ph-row" style="display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap"><h2 class="h2" data-split>Compléter <em>le rituel</em></h2><a class="ul" href="#p-${nxt.slug}">Objet suivant : ${nxt.name} →</a></div><div class="cards" style="--cols:${cols(pairs.length)}">${pairs.map(card).join('')}</div></div></section>
    <div class="buybar" id="buybar"><div class="bb-n">${p.name}<br><span class="mono muted" id="bb-price">${eur(p.options[0][1])}</span></div><button class="btn solid" type="button" data-add="${p.slug}">Ajouter<span class="arr"></span></button></div>`;
  }

  function lieux() {
    const list = LIEUX.filter((l) => has(l.img));
    return `
    <section class="page-head">
      <p class="eyebrow">Les Lieux du Temps · hôtels, restaurants, bars, spas</p>
      <h1 class="display xl" data-split>Là où elle vit <em>ses heures</em>.</h1>
      <p class="lede">Nous ne mettons pas notre nom dans les lieux que nous aimons. Nous y mettons notre odeur, notre porcelaine et nos gestes. La cliente passe quelques minutes par mois dans nos Maisons, et des heures ailleurs.</p>
    </section>
    <section class="sec-s wrap"><div class="principes">
      <div><span class="mono muted">Même odeur</span><p class="h3">Armoise et santal</p><p class="muted">Dans le hall, la chambre, le bar : l'odeur de la Bougie des Lieux et de l'Huile Dénouer.</p></div>
      <div><span class="mono muted">Même matière</span><p class="h3">Céladon et cuvette du pouce</p><p class="muted">Tasses, bols, porte-savons en céladon de Jingdezhen, avec le même creux pour le pouce que nos flacons.</p></div>
      <div><span class="mono muted">Même geste</span><p class="h3">Le rituel de l'heure</p><p class="muted">Au room service, à la couverture, au bain : nos soins, à l'heure où ils servent.</p></div>
    </div></section>
    <section class="sec wrap"><div class="tl">${list.map((l, i) => `
      <article class="tl-row ${i % 2 ? 'rev' : ''}">
        <p class="tl-t">${l.t}</p>
        <figure class="ph r45 tl-img" data-clip>${im(l.img, l.lieu, 'class="par" data-par="5"')}</figure>
        <div class="tl-txt"><span class="chip"><span class="zh">${MOMENTS[l.m].zh}</span>${l.lieu}</span><p class="body-t">${l.text}</p></div>
      </article>`).join('')}</div></section>
    <section class="sec-s wrap"><div class="stack" style="gap:18px;max-width:780px"><p class="eyebrow">Pourquoi sans logo</p><p class="h2">La marque entre par la mémoire sensorielle. Le jour où elle dit « ça sent comme là-bas », <em>l'achat est déjà gagné</em>.</p><p class="row"><a class="btn" href="#p-bougie-lieux">La Bougie des Lieux<span class="arr"></span></a><a class="btn" href="#p-encens-heures">L'Encens des Quatre Heures<span class="arr"></span></a></p></div></section>`;
  }

  function maison() {
    const frames = MAISON.filter((f) => has(f.img));
    return `
    <section class="page-head">
      <p class="eyebrow">La Maison des Heures · Shanghai, Anfu Lu · ouverture 2027</p>
      <h1 class="display xl" data-split>On y entre <em>pour une heure</em>.</h1>
      <p class="lede">Une boutique organisée comme une journée : l'Éveil à l'est, la Recharge au sud, le Dénouer à l'ouest, la Réparation au nord, autour d'un cadran solaire. La lumière suit l'heure réelle.</p>
    </section>
    <section class="ouv" id="ouverture" aria-label="L'ouverture de la Maison">
      <div class="o-stage">
        ${frames.map((f, i) => `<figure class="o-frame" data-i="${i}">${im(f.img, f.t)}</figure>`).join('')}
        ${frames.map((f, i) => `<div class="o-cap" data-i="${i}"><p class="mono">${pad2(i + 1)} / ${pad2(frames.length)}</p><p class="display l">${f.t}</p><p class="lede" style="color:rgba(246,240,230,.9)">${f.text}</p></div>`).join('')}
      </div>
    </section>
    <section class="sec wrap"><div class="stack" style="gap:34px">
      <div class="stack" style="gap:14px"><p class="eyebrow">En Maison</p><h2 class="h2" data-split>Quatre services, <em>à l'heure</em>.</h2></div>
      <div class="services">
        <div><span class="mono">15 min · offert</span><p class="h3">Le diagnostic</p><p class="muted">Un thé, des questions sur le sommeil et la saison, une lecture de peau. Le Carnet des Heures est scellé au cinabre devant vous.</p></div>
        <div><span class="mono">10 min · offert</span><p class="h3">La gravure</p><p class="muted">Votre prénom en caractères latins ou chinois sur le bouchon de l'Essence Or ou la laque d'un coffret.</p></div>
        <div><span class="mono">−30 %</span><p class="h3">La recharge</p><p class="muted">On rapporte le flacon, on repart avec la recharge. Les flacons abîmés sont refondus à Jingdezhen.</p></div>
        <div><span class="mono">40 min · 68 €</span><p class="h3">Le soin de saison</p><p class="muted">Un soin en cabine qui change à chaque terme solaire, avec les produits du moment.</p></div>
      </div>
    </div></section>
    <section class="sec-s wrap"><div class="stack" style="gap:22px"><p class="eyebrow">Les adresses</p><div class="addr">
      <div><span class="h3">Shanghai</span><span class="mono muted">Anfu Lu · 2027</span></div>
      <div><span class="h3">Hangzhou</span><span class="mono muted">Hubin · 2028</span></div>
      <div><span class="h3">Chengdu</span><span class="mono muted">Taikoo Li · 2028</span></div>
      <div><span class="h3">Paris</span><span class="mono muted">Saint-Germain-des-Prés · 2030</span></div>
    </div><p class="muted" style="font-size:13px">Adresses et dates projetées dans le plan de développement ; puis soixante Comptoirs du Temps dans les grands magasins.</p></div></section>`;
  }

  function cercle() {
    const t = term();
    return `
    <section class="page-head">
      <p class="eyebrow">Le Cercle des 24 Souffles · 二十四节气</p>
      <h1 class="display xl" data-split>Vingt-quatre <em>souffles</em> par an.</h1>
      <p class="lede">L'année chinoise compte vingt-quatre termes solaires, un tous les quinze jours. À chacun, le Cercle reçoit un rituel, une lettre et une raison de revenir. On y progresse par l'assiduité autant que par les achats.</p>
    </section>
    <section class="sec-s wrap"><div class="ring-wrap">
      <div class="ring">${termRing()}</div>
      <div class="stack" style="gap:20px">
        <p class="eyebrow">Aujourd'hui</p>
        <p class="display l"><span class="zh" style="letter-spacing:0">${t.cur[0]}</span> ${t.cur[1]}</p>
        <p class="body-t">Le rituel de la quinzaine est dans votre Carnet des Heures. La niche de ${t.cur[0]} est allumée dans chaque Maison jusqu'au ${t.next[3]} ${moisFr[t.next[2] - 1]}, jour de ${t.next[0]}, ${t.next[1].toLowerCase()}.</p>
        <p class="muted">Une lettre tous les quinze jours, jamais envoyée après 22 h : le respect de l'heure est aussi un argument.</p>
      </div>
    </div></section>
    <section class="sec wrap"><div class="stack" style="gap:34px">
      <div class="stack" style="gap:14px"><p class="eyebrow">Trois statuts, trois états de la porcelaine</p><h2 class="h2" data-split>De l'ébauche <em>à la porcelaine</em>.</h2></div>
      <div class="statuts">${STATUTS.map((s) => `<div><span class="zh">${s.zh}</span><p class="h3">${s.fr}</p><p class="mono muted">${s.cond}</p><p class="muted">${s.text}</p></div>`).join('')}</div>
    </div></section>
    <section class="sec-s wrap"><div class="grid12" style="row-gap:28px;align-items:center">
      <div style="grid-column:1/span 6" class="stack"><p class="eyebrow">天青 · Les Passeurs Céladon</p><h2 class="h2" data-split>Vingt-quatre personnes par an, <em>une par terme</em>.</h2><p class="body-t">Chaque quinzaine, une cliente du Cercle devient Passeuse Céladon : elle co-crée l'édition du terme suivant, la présente en Maison et la transmet à son tour. On est choisie sur l'engagement, jamais sur la dépense. Ce n'est pas un statut, c'est un rôle.</p></div>
      <figure class="ph r45" style="grid-column:8/span 5" data-clip>${im(first(['essence-or_duo', 'coffret-rituels_kraft', 'amb_33']), 'Passeurs Céladon')}</figure>
    </div></section>
    <section class="sec wrap"><div class="stack" style="gap:22px;max-width:640px">
      <p class="eyebrow">Rejoindre le Cercle</p><h2 class="h2">Votre première lettre arrive au prochain terme, ${t.next[0]}.</h2>
      <form class="join" id="join" novalidate><label for="join-mail" class="eyebrow" style="grid-column:1/-1">Adresse e-mail</label><input id="join-mail" type="email" required placeholder="prenom@exemple.com" autocomplete="email"><button class="btn" type="submit">Rejoindre<span class="arr"></span></button></form>
      <p class="join-ok muted" id="join-ok" hidden></p>
    </div></section>`;
  }

  function matieres() {
    return `
    <section class="page-head">
      <p class="eyebrow">Les matières · 材</p>
      <h1 class="display xl" data-split>Dix matières, <em>dix provinces</em>.</h1>
      <p class="lede">Chaque ingrédient vient d'un lieu précis de Chine. Nous le cultivons, le fermentons ou l'achetons là-bas, et nous le disons.</p>
    </section>
    <section class="wrap" style="padding-bottom:clamp(80px,10vw,160px)"><div class="mat">${MATIERES.filter((m) => has(m.img)).map((m) => `
      <a href="#p-${m.p}" data-cursor="Voir"><figure class="ph">${im(m.img, m.fr)}</figure><div class="m-head"><span class="h3">${m.fr}</span><span class="m-zh">${m.zh}</span></div><span class="mono muted">${m.lieu}</span><p class="muted" style="font-size:14px">${m.text}</p></a>`).join('')}</div></section>`;
  }

  const QUIZ = [
    { k: 'coucher', q: 'À quelle heure vous couchez-vous, le plus souvent ?', a: [['tot', 'Avant 23 h'], ['minuit', 'Entre 23 h et 1 h'], ['tard', 'Après 1 h']] },
    { k: 'peau', q: 'Le matin, que vous dit votre peau ?', a: [['seche', 'Elle tire'], ['brille', 'Elle brille'], ['terne', 'Elle est terne'], ['rouge', 'Elle rougit vite']] },
    { k: 'temps', q: 'À quel moment manquez-vous le plus de temps ?', a: [['matin', 'Le matin'], ['jour', 'Dans la journée'], ['soir', 'Le soir']] },
    { k: 'envie', q: 'Ce que vous cherchez d’abord', a: [['sommeil', 'Mieux dormir'], ['eclat', 'De l’éclat'], ['ville', 'Me protéger de la ville'], ['detente', 'Un geste qui détend']] },
  ];
  let quiz = {};
  function routine(r) {
    const R = { chen: ['mousse-matin'], wu: [], mu: ['huile-denouer'], ye: ['essence-nuit'] };
    if (r.temps !== 'matin' || r.envie === 'eclat' || r.peau === 'terne') R.chen.push('essence-eveil');
    R.chen.push('ecran-urbain');
    if (r.envie === 'eclat' || r.peau === 'terne') R.chen.push('gua-sha');
    R.wu.push('brume-heures');
    if (r.temps === 'jour' || r.envie === 'ville') R.wu.push('baume-mains');
    if (r.envie === 'detente' || r.envie === 'sommeil') R.mu.push('bougie-lieux');
    if (r.peau === 'seche' || r.peau === 'rouge' || r.coucher === 'tard') R.ye.push('creme-porcelaine');
    const heures = { tot: ['7 h 00', '13 h 00', '20 h 30', '22 h 30'], minuit: ['7 h 30', '13 h 30', '21 h 30', '23 h 30'], tard: ['8 h 30', '14 h 00', '22 h 30', '0 h 45'] }[r.coucher || 'minuit'];
    return { R, heures, extra: r.coucher === 'tard' || r.envie === 'sommeil' ? 'essence-or' : 'coffret-7' };
  }
  function carnet() {
    const done = QUIZ.every((q) => quiz[q.k]);
    return `
    <section class="page-head">
      <p class="eyebrow">Le Carnet des Heures · 时间手册</p>
      <h1 class="display xl" data-split>Votre journée, <em>en quatre gestes</em>.</h1>
      <p class="lede">En Maison, le diagnostic dure quinze minutes autour d'un thé. Ici, quatre questions suffisent pour composer votre rituel heure par heure.</p>
    </section>
    <section class="wrap" style="padding-bottom:clamp(60px,8vw,120px)"><div class="quiz">
      ${QUIZ.map((q, i) => `<fieldset class="q"><legend><span class="mono muted">${pad2(i + 1)} / ${pad2(QUIZ.length)}</span><span class="h3">${q.q}</span></legend><div class="q-a">${q.a.map(([v, l]) => `<button type="button" data-quiz="${q.k}" data-val="${v}" aria-pressed="${quiz[q.k] === v}">${l}</button>`).join('')}</div></fieldset>`).join('')}
    </div></section>
    <section class="wrap" id="carnet-res" style="padding-bottom:clamp(80px,10vw,160px)">${done ? carnetRes() : `<p class="muted">Répondez aux quatre questions : votre Carnet s'écrit ici.</p>`}</section>`;
  }
  function carnetRes() {
    const { R, heures, extra } = routine(quiz);
    const all = ORDER.flatMap((k) => R[k]);
    const tot = all.reduce((s, x) => s + BY[x].price, 0);
    const ex = BY[extra];
    return `<div class="carnet">
      <div class="c-head"><span class="seal big">羽西</span><div class="stack" style="gap:8px"><p class="eyebrow">Votre Carnet des Heures</p><p class="h2">${all.length} soins, quatre moments, <em>${eur(tot)}</em></p></div></div>
      <ol class="c-days">${ORDER.map((k, i) => { const m = MOMENTS[k]; return `<li class="c-day"><span class="brush">${m.zh}</span><div class="stack" style="gap:10px"><p class="mono">${heures[i]} · ${m.fr}</p>${R[k].map((s) => `<a class="c-p" href="#p-${s}"><span class="c-img">${im(first(BY[s].imgs), BY[s].name)}</span><span><span class="h3" style="font-size:1.15rem">${BY[s].name}</span><span class="muted" style="font-size:13px;display:block">${esc(BY[s].freq.dose)} · ${esc(BY[s].ritual[0])}</span></span><span class="mono">${eur(BY[s].price)}</span></a>`).join('')}</div></li>`; }).join('')}</ol>
      <div class="row" style="gap:12px"><button class="btn solid" type="button" data-add-all="${all.join(',')}">Ajouter le rituel au panier<span class="arr"></span></button><a class="btn" href="#p-${ex.slug}">${ex.slug === 'coffret-7' ? "Essayer d'abord : le Coffret 7 Jours, 12 €" : `Pour aller plus loin : ${ex.name}`}<span class="arr"></span></a></div>
      <p class="muted" style="font-size:12.5px">Démonstration : le Carnet reste sur cet appareil. En Maison, il est imprimé et scellé au cinabre.</p>
    </div>`;
  }

  function footer() {
    const n = now(), t = term();
    return `<footer class="foot">
      <div class="f-cols">
        <div class="stack" style="gap:16px"><span class="seal big">羽西</span><p class="lede">Maison de beauté chinoise depuis 1992. La beauté suit l'heure : 顺时而美.</p><p class="mono muted" data-clock-foot>Il est ${n.hh} · ${n.sc.zh}时 · ${t.cur[0]} ${t.cur[1]}</p></div>
        <nav aria-label="Les heures"><p class="eyebrow">Les heures</p>${ORDER.map((k) => `<a class="ul" href="#heure-${k}">${MOMENTS[k].zh} ${MOMENTS[k].fr}</a>`).join('')}</nav>
        <nav aria-label="La maison"><p class="eyebrow">La maison</p><a class="ul" href="#collection">La collection</a><a class="ul" href="#lieux">Les Lieux du Temps</a><a class="ul" href="#maison">La Maison</a><a class="ul" href="#cercle">Le Cercle</a><a class="ul" href="#matieres">Les matières</a></nav>
        <nav aria-label="Service"><p class="eyebrow">Service</p><a class="ul" href="#carnet">Le Carnet des Heures</a><span>Livraison en 48 h</span><span>Recharges à −30 %</span><span>Retours sous 30 jours</span><span>Diagnostic en Maison</span></nav>
      </div>
      <p class="f-word" aria-hidden="true">YUE SAI</p>
      <div class="f-legal"><p>Concept étudiant : projet marketing ESSEC d'après le cas INSEAD « L'Oréal in China: Yue Sai ». Site fictif, non affilié à Yue Sai ni au groupe L'Oréal. Boutique de démonstration, aucune vente. Photographies d'inspiration de tiers, retouchées pour l'exercice ; résultats marqués * fictifs.</p><p class="mono">羽西 · Shanghai · Paris</p></div>
    </footer>`;
  }

  /* ---------- routeur ---------- */
  function parse(h) {
    h = (h || '').replace(/^#/, '');
    if (h.startsWith('p-') && BY[h.slice(2)]) return { page: 'produit', arg: h.slice(2) };
    if (h.startsWith('heure-') && MOMENTS[h.slice(6)]) return { page: 'heure', arg: h.slice(6) };
    if (['collection', 'catalogue', 'produits'].includes(h)) return { page: 'collection' };
    if (h === 'ouverture') return { page: 'maison', arg: 'ouverture' };
    if (['lieux', 'maison', 'cercle', 'matieres', 'carnet'].includes(h)) return { page: h };
    return { page: 'home' };
  }
  const VEIL = { collection: '物', lieux: '地', maison: '门', cercle: '圈', matieres: '材', carnet: '册' };
  function momentFor(r) {
    if (r.page === 'produit') return BY[r.arg].m;
    if (r.page === 'heure') return r.arg;
    return now().m;
  }
  function titleFor(r) {
    const base = 'Yue Sai · La Maison';
    if (r.page === 'produit') return `${BY[r.arg].name} · Yue Sai`;
    if (r.page === 'heure') return `${MOMENTS[r.arg].zh} ${MOMENTS[r.arg].fr} · Yue Sai`;
    return ({ collection: 'La collection · Yue Sai', lieux: 'Les Lieux du Temps · Yue Sai', maison: 'La Maison des Heures · Yue Sai', cercle: 'Le Cercle · Yue Sai', matieres: 'Les matières · Yue Sai', carnet: 'Le Carnet des Heures · Yue Sai' })[r.page] || base;
  }
  let current = null;
  function render(r) {
    killAnims();
    const view = $('#view');
    const html = r.page === 'produit' ? produit(r.arg) : r.page === 'heure' ? heure(r.arg) : r.page === 'collection' ? collection() : r.page === 'lieux' ? lieux() : r.page === 'maison' ? maison() : r.page === 'cercle' ? cercle() : r.page === 'matieres' ? matieres() : r.page === 'carnet' ? carnet() : home();
    view.innerHTML = html + footer();
    document.body.dataset.m = momentFor(r);
    document.body.dataset.page = r.page;
    document.title = titleFor(r);
    $$('.nav [data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === r.page));
    current = r;
  }
  function killAnims() {
    if (ST) ST.getAll().forEach((t) => t.kill());
    if (G) G.globalTimeline.getChildren(false, true, true).forEach((t) => t.kill());
    $('.peek')?.classList.remove('on');
    $('.nav').classList.remove('in-j');
  }

  let busy = false, suppress = false, pending = null;
  async function go(hash, push = true) {
    const r = parse(hash);
    if (current && r.page === 'maison' && current.page === 'maison' && r.arg === 'ouverture') { scrollToEl($('#ouverture')); if (push) setHash(hash); return; }
    if (busy) { pending = [hash, push]; return; }
    busy = true;
    closeMenu();
    closeBag();
    const zh = r.page === 'produit' ? mark(BY[r.arg]) : r.page === 'heure' ? MOMENTS[r.arg].zh : VEIL[r.page] || MOMENTS[now().m].zh;
    await veilIn(zh);
    if (push) setHash(hash);
    render(r);
    scrollTop();
    await frame();
    mount(r);
    if (r.arg === 'ouverture') setTimeout(() => scrollToEl($('#ouverture')), 60);
    await veilOut();
    busy = false;
    if (pending) { const [h, p] = pending; pending = null; go(h, p); }
  }
  function setHash(h) { const want = '#' + (h || ''); if (location.hash !== want && !(want === '#' && !location.hash)) { suppress = true; location.hash = h; } }
  const frame = () => new Promise((r) => { let d = false; const f = () => { if (!d) { d = true; r(); } }; requestAnimationFrame(() => requestAnimationFrame(f)); setTimeout(f, 150); });
  function veilIn(zh) {
    return new Promise((res) => {
      const v = $$('.veils i');
      v[2].dataset.zh = zh || '';
      if (!G || RM) return res();
      G.set(v, { yPercent: 101 });
      const safe = setTimeout(() => { G.set(v, { yPercent: 0 }); res(); }, 1600);
      G.to(v, { yPercent: 0, duration: .8, ease: 'expo.inOut', stagger: .09, onComplete: () => { clearTimeout(safe); res(); } });
    });
  }
  function veilOut() {
    return new Promise((res) => {
      if (!G || RM) return res();
      const v = $$('.veils i').reverse();
      const end = () => { clearTimeout(safe); G.set(v, { yPercent: 101 }); res(); };
      const safe = setTimeout(() => { G.killTweensOf(v); end(); }, 1900);
      G.to(v, { yPercent: -101, duration: .95, ease: 'expo.inOut', stagger: .08, onComplete: end });
    });
  }

  /* ---------- montage d'une page (animations et événements) ---------- */
  function split(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const walk = (node) => {
      Array.from(node.childNodes).forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(tok)); return; }
            const w = document.createElement('span'); w.className = 'w';
            const i = document.createElement('span'); i.textContent = tok; w.appendChild(i); frag.appendChild(w);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && !ch.classList.contains('w')) walk(ch);
      });
    };
    walk(el);
  }
  function mount(r) {
    const root = $('#view');
    bindPage(r, root);
    $$('#view img').forEach((img) => { if (!img.complete) img.addEventListener('load', refreshSoon, { once: true }); });
    if (!ANIM) { $('.ouv', root)?.classList.add('static'); navState(); return; }
    // titres découpés
    $$('[data-split]', root).forEach((el) => {
      split(el);
      const ws = $$('.w > span', el);
      const inHero = !!el.closest('.hero, .mh, .page-head, .pdp');
      G.from(ws, { yPercent: 115, duration: 1.25, ease: 'expo.out', stagger: .04, delay: inHero ? .15 : 0, scrollTrigger: inHero ? undefined : { trigger: el, start: 'top 88%', once: true } });
    });
    // images qui se découvrent
    $$('[data-clip]', root).forEach((el) => {
      G.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
    // parallaxe
    $$('[data-par]', root).forEach((el) => {
      const a = parseFloat(el.dataset.par) || 6;
      const box = el.closest('.ph, .f-img, .mb-img') || el.parentElement;
      el.style.height = `${100 + a * 2}%`; el.style.position = 'absolute'; el.style.top = `-${a}%`; el.style.left = '0';
      G.fromTo(el, { yPercent: -a / 2 }, { yPercent: a / 2, ease: 'none', scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // ouverture de l'accueil
    const hero = $('.hero', root);
    if (hero) {
      G.fromTo($('.h-img img', hero), { scale: 1.18 }, { scale: 1, duration: 2.6, ease: 'expo.out' });
      const slides = $$('.h-img img', hero);
      if (slides.length > 1) {
        G.set(slides.slice(1), { opacity: 0 });
        const loop = G.timeline({ repeat: -1, delay: 5 });
        slides.forEach((s, i) => {
          const nx = slides[(i + 1) % slides.length];
          loop.to(nx, { opacity: 1, duration: 2.2, ease: 'sine.inOut' }, '+=0')
            .fromTo(nx, { scale: 1.08 }, { scale: 1, duration: 7.2, ease: 'none' }, '<')
            .set(s, { opacity: 0 }, '>')
            .to({}, { duration: 3.2 });
        });
      }
      G.fromTo($('.h-brush', hero), { yPercent: -40, opacity: 0 }, { yPercent: -50, opacity: 1, duration: 2.4, ease: 'expo.out', delay: .2 });
      G.from($$('.ruler a', hero), { opacity: 0, y: 12, duration: .9, stagger: .04, ease: 'expo.out', delay: .5 });
      G.to($('.h-img', hero), { yPercent: 18, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      G.to($('.h-brush', hero), { yPercent: -80, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    }
    const mh = $('.mh', root);
    if (mh) {
      G.from($('.mh-brush', mh), { opacity: 0, scale: .92, duration: 2, ease: 'expo.out' });
      G.to($('.mh-brush', mh), { yPercent: 16, ease: 'none', scrollTrigger: { trigger: mh, start: 'top top', end: 'bottom top', scrub: true } });
    }
    journee(root);
    ouverture(root);
    const nm = $('.next-m .brush', root);
    if (nm) G.from(nm, { yPercent: 30, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: nm, start: 'top 90%', once: true } });
    const fw = $('.f-word', root);
    if (fw) G.from(fw, { yPercent: 60, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: fw, start: 'top 95%', once: true } });
    ST.refresh();
    navState();
  }

  function journee(root) {
    const sec = $('.journee', root);
    if (!sec) return;
    if (!matchMedia('(min-width: 900px)').matches) return;
    const panels = $$('.j-panel', sec);
    const prog = $$('.j-prog span', sec);
    const hand = $('.jc-hand', sec), czh = $('.jc-zh', sec);
    sec.classList.add('pinned');
    const pal = (k) => ({ '--j-paper': PAL[k].paper, '--j-ink': PAL[k].ink, '--j-ink2': PAL[k].ink2, '--j-line': PAL[k].line, '--j-acc': PAL[k].acc });
    G.set(sec, pal(ORDER[0]));
    G.set(document.documentElement, { '--nav-j': PAL[ORDER[0]].ink });
    panels.forEach((p, i) => {
      if (!i) return;
      G.set(p, { autoAlpha: 0 });
      G.set($('.j-img', p), { clipPath: 'inset(100% 0% 0% 0%)' });
      G.set($('.j-text', p), { y: 60, autoAlpha: 0 });
      G.set($('.j-brush', p), { yPercent: 20, opacity: 0 });
    });
    const tl = G.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sec, start: 'top top', end: () => '+=' + window.innerHeight * (panels.length + .2), pin: $('.j-stage', sec), scrub: .9, anticipatePin: 1,
        onUpdate: (s) => {
          const i = Math.min(panels.length - 1, Math.round(s.progress * (panels.length - 1)));
          prog.forEach((el, j) => el.classList.toggle('on', j === i));
          const hr = (5 + s.progress * 24) % 24;
          if (hand) hand.style.transform = `rotate(${(hr / 24) * 360}deg)`;
          if (czh) czh.textContent = SHICHEN[Math.floor(((Math.floor(hr) + 1) % 24) / 2)].zh;
        },
        onToggle: (s) => $('.nav').classList.toggle('in-j', s.isActive),
      },
    });
    tl.to({}, { duration: .5 });
    panels.forEach((p, i) => {
      if (i === panels.length - 1) return;
      const q = panels[i + 1];
      const k = ORDER[i + 1];
      tl.addLabel('t' + i)
        .to($('.j-text', p), { y: -60, autoAlpha: 0, duration: .45 }, 't' + i)
        .to($('.j-brush', p), { yPercent: -20, opacity: 0, duration: .6 }, 't' + i)
        .to($('.j-img', p), { scale: .94, autoAlpha: 0, duration: .8 }, 't' + i)
        .to(sec, { ...pal(k), duration: 1 }, 't' + i)
        .to(document.documentElement, { '--nav-j': PAL[k].ink, duration: 1 }, 't' + i)
        .set(q, { autoAlpha: 1 }, 't' + i)
        .to($('.j-img', q), { clipPath: 'inset(0% 0% 0% 0%)', duration: 1 }, `t${i}+=.15`)
        .fromTo($('.j-img img', q), { scale: 1.2 }, { scale: 1, duration: 1.2 }, `t${i}+=.15`)
        .to($('.j-brush', q), { yPercent: 0, opacity: .12, duration: .9 }, `t${i}+=.3`)
        .to($('.j-text', q), { y: 0, autoAlpha: 1, duration: .6 }, `t${i}+=.55`)
        .to({}, { duration: .6 });
    });
  }

  function ouverture(root) {
    const sec = $('.ouv', root);
    if (!sec) return;
    const frames = $$('.o-frame', sec), caps = $$('.o-cap', sec);
    if (!frames.length) return;
    caps.forEach((c, i) => { if (i) G.set(c, { autoAlpha: 0, y: 30 }); });
    frames.forEach((f, i) => { if (i) G.set(f, { autoAlpha: 0 }); });
    const tl = G.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + window.innerHeight * frames.length, pin: $('.o-stage', sec), scrub: .9, anticipatePin: 1 } });
    tl.to({}, { duration: .4 });
    frames.forEach((f, i) => {
      if (i === frames.length - 1) return;
      const g = frames[i + 1];
      const push = i === 0 ? 2.1 : 1.35;
      tl.addLabel('o' + i)
        .to($('img', f), { scale: push, transformOrigin: i === 0 ? '50% 68%' : '50% 50%', duration: 1 }, 'o' + i)
        .to(f, { autoAlpha: 0, duration: .5 }, `o${i}+=.5`)
        .fromTo(g, { autoAlpha: 0 }, { autoAlpha: 1, duration: .5 }, `o${i}+=.45`)
        .fromTo($('img', g), { scale: 1.2 }, { scale: 1, duration: .9 }, `o${i}+=.45`)
        .to(caps[i], { autoAlpha: 0, y: -30, duration: .35 }, 'o' + i)
        .to(caps[i + 1], { autoAlpha: 1, y: 0, duration: .45 }, `o${i}+=.6`)
        .to({}, { duration: .5 });
    });
  }

  /* événements propres à chaque page */
  function bindPage(r, root) {
    // aperçu flottant de l'index
    $$('[data-peek-list]', root).forEach((list) => {
      if (!FINE) return;
      const peek = $('.peek');
      const img = $('img', peek);
      let x = 0, y = 0, px = 0, py = 0, raf;
      const loop = () => { px += (x - px) * .14; py += (y - py) * .14; peek.style.transform = `translate(${px + 28}px, ${py - 150}px)`; raf = requestAnimationFrame(loop); };
      list.addEventListener('mouseenter', () => { list.classList.add('dim'); raf = requestAnimationFrame(loop); });
      list.addEventListener('mouseleave', () => { list.classList.remove('dim'); peek.classList.remove('on'); cancelAnimationFrame(raf); });
      list.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; });
      $$('a[data-peek]', list).forEach((a) => a.addEventListener('mouseenter', () => { if (!a.dataset.peek) return; img.src = src(a.dataset.peek); peek.classList.add('on'); }));
    });
    // rail glissé à la souris
    $$('[data-drag]', root).forEach((rail) => {
      let down = false, sx = 0, sl = 0, moved = false;
      rail.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft; rail.classList.add('drag'); });
      const up = () => { down = false; rail.classList.remove('drag'); };
      rail.addEventListener('pointerup', up); rail.addEventListener('pointerleave', up);
      rail.addEventListener('pointermove', (e) => { if (!down) return; const d = e.clientX - sx; if (Math.abs(d) > 4) moved = true; rail.scrollLeft = sl - d; });
      rail.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    });
    if (r.page === 'produit') {
      const p = BY[r.arg];
      let opt = 0, shade = p.shades ? 0 : null, q = 1;
      const upd = () => { const pr = p.options[opt][1] * q; $('#p-price').innerHTML = `${eur(pr)}<small>${esc(p.options[opt][0])}</small>`; const bb = $('#bb-price'); if (bb) bb.textContent = eur(pr); };
      $$('input[name="opt"]', root).forEach((i) => i.addEventListener('change', () => { opt = +i.value; upd(); }));
      $$('[data-qty]', root).forEach((b) => b.addEventListener('click', () => { q = Math.max(1, Math.min(9, q + +b.dataset.qty)); $('#qty').textContent = q; upd(); }));
      $$('[data-shade]', root).forEach((b) => b.addEventListener('click', () => { shade = +b.dataset.shade; $$('[data-shade]', root).forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#shade-n').textContent = p.shades[shade][1]; }));
      $$('[data-add]', root).forEach((b) => b.addEventListener('click', () => { addToBag(p.slug, opt, shade, q); pulse($('.nav .n-bag')); }));
      const z = $('[data-zoom]', root);
      if (z) z.addEventListener('click', () => { const o = $('#zoom'); $('img', o).src = src(z.dataset.zoom); $('img', o).alt = p.name; o.hidden = false; lockScroll(true); });
      const bb = $('#buybar'), buy = $('#buy');
      if (bb && buy && 'IntersectionObserver' in window) new IntersectionObserver(([en]) => bb.classList.toggle('on', !en.isIntersecting && en.boundingClientRect.top < 0)).observe(buy);
    }
    if (r.page === 'cercle') {
      const f = $('#join');
      f?.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = $('#join-mail');
        const ok = $('#join-ok');
        if (!inp.value || !inp.checkValidity()) { ok.hidden = false; ok.textContent = "Cette adresse ne semble pas complète : vérifiez l'arobase et le domaine."; inp.focus(); return; }
        ok.hidden = false;
        ok.textContent = `Démonstration : inscription notée sur cet appareil uniquement. Dans la vraie maison, la première lettre partirait au prochain terme, ${term().next[0]}.`;
        store.set('ys-cercle', true);
        f.reset();
      });
    }
  }
  let refreshT;
  function refreshSoon() { if (!ST) return; clearTimeout(refreshT); refreshT = setTimeout(() => ST.refresh(), 200); }
  function pulse(el) { if (!el || !G || RM) return; G.fromTo(el, { scale: 1 }, { scale: 1.12, duration: .18, yoyo: true, repeat: 1, ease: 'power2.out' }); }

  /* ---------- navigation fixe ---------- */
  let lastY = 0;
  function navState() {
    const nav = $('.nav');
    const y = lenis ? lenis.scroll : window.scrollY;
    const over = $('#view > [data-over]:first-child');
    const overImg = over && y < over.offsetHeight - 70;
    nav.classList.toggle('over-img', !!overImg);
    nav.classList.toggle('solid', !overImg && y > 30 && !nav.classList.contains('in-j'));
    const menuOpen = !$('#menu').hidden;
    nav.classList.toggle('hide', !menuOpen && y > 240 && y > lastY + 2);
    if (y < lastY - 2 || y < 240) nav.classList.remove('hide');
    lastY = y;
  }

  /* ---------- menu ---------- */
  function openMenu() {
    const m = $('#menu'); m.hidden = false; lockScroll(true);
    $('.n-menu').setAttribute('aria-expanded', 'true'); $('.n-menu').textContent = 'Fermer';
    if (G && !RM) G.from($$('#menu nav a, #menu .m-hours a'), { y: 40, opacity: 0, duration: .8, stagger: .04, ease: 'expo.out' });
  }
  function closeMenu() { const m = $('#menu'); if (m.hidden) return; m.hidden = true; lockScroll(false); $('.n-menu').setAttribute('aria-expanded', 'false'); $('.n-menu').textContent = 'Menu'; }

  /* ---------- curseur ---------- */
  function initCursor() {
    if (!FINE || RM) return;
    const c = $('#cursor'), lab = $('span', c);
    let x = -100, y = -100, cx = x, cy = y;
    window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; c.classList.add('on'); });
    document.addEventListener('mouseleave', () => c.classList.remove('on'));
    document.addEventListener('pointerover', (e) => { const t = e.target.closest('[data-cursor]'); if (t) { lab.textContent = t.dataset.cursor; c.classList.add('big'); } });
    document.addEventListener('pointerout', (e) => { const t = e.target.closest('[data-cursor]'); if (t && !t.contains(e.relatedTarget)) c.classList.remove('big'); });
    const loop = () => { cx += (x - cx) * .2; cy += (y - cy) * .2; c.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(loop); };
    loop();
  }

  /* ---------- grain ---------- */
  function initGrain() {
    const g = $('#grain');
    const frames = [0, 1, 2].map(() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 200;
      const x = cv.getContext('2d'); const d = x.createImageData(200, 200);
      for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      x.putImageData(d, 0, 0); return cv.toDataURL('image/png');
    });
    g.style.backgroundImage = `url(${frames[0]})`;
    g.style.backgroundSize = '200px 200px';
    if (RM) return;
    let k = 0;
    setInterval(() => { k = (k + 1) % 3; g.style.backgroundImage = `url(${frames[k]})`; g.style.backgroundPosition = `${(Math.random() * 200) | 0}px ${(Math.random() * 200) | 0}px`; }, 110);
  }

  /* ---------- horloge ---------- */
  function tick() {
    const n = now();
    $$('[data-clock]').forEach((el) => { el.innerHTML = `<span class="zh">${n.sc.zh}时</span>${n.hh}`; });
    const t = term();
    $$('[data-clock-foot]').forEach((el) => { el.textContent = `Il est ${n.hh} · ${n.sc.zh}时 · ${t.cur[0]} ${t.cur[1]}`; });
  }

  /* ---------- porte d'entrée ---------- */
  function gate(first) {
    const g = $('#gate');
    const n = now(), M = MOMENTS[n.m];
    $('.g-hour', g).innerHTML = `<span class="mono">Il est ${n.hh} · <span class="zh">${n.sc.zh}时</span></span><span class="eyebrow">${heureDu(n.sc.animal)} · ${M.zh} ${M.fr}</span>`;
    const dest = { produit: BY[first.arg]?.name, heure: MOMENTS[first.arg]?.fr, collection: 'La collection', lieux: 'Les Lieux du Temps', maison: 'La Maison', cercle: 'Le Cercle', matieres: 'Les matières', carnet: 'Le Carnet des Heures' }[first.page];
    $('.g-enter', g).innerHTML = `Entrer${dest ? ` · ${esc(dest)}` : ''}<span class="arr"></span>`;
    const cnt = $('.g-count', g), bar = $('.g-bar', g);
    const crit = $$('#view img').slice(0, 6).map((i) => i.currentSrc || i.src);
    let loaded = 0;
    crit.forEach((u) => { const i = new Image(); i.onload = i.onerror = () => { loaded++; }; i.src = u; });
    const t0 = performance.now(), MIN = RM ? 200 : 1700, MAX = 6000;
    let shown = 0;
    return new Promise((res) => {
      const step = (t) => {
        const el = t - t0;
        const target = Math.min(100, Math.min(el / MIN, (loaded + 1) / (crit.length + 1) + el / MAX) * 100);
        shown += (target - shown) * .12 + .15;
        shown = Math.min(shown, target);
        const v = Math.floor(shown);
        cnt.textContent = String(v).padStart(3, '0');
        bar.style.width = v + '%';
        if (v >= 100 || el > MAX) { cnt.textContent = '100'; bar.style.width = '100%'; g.classList.add('ready'); $('.g-enter', g).focus({ preventScroll: true }); res(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(() => { if (!g.classList.contains('ready')) { cnt.textContent = '100'; bar.style.width = '100%'; g.classList.add('ready'); res(); } }, MAX + 200);
    });
  }
  function enter(first) {
    const g = $('#gate');
    const door = $('#door');
    if (G && !RM && door && has('amb_6')) {
      door.hidden = false;
      $('img', door).src = src('amb_6');
      $('.g-enter', g).disabled = true;
      let fin = false;
      const finish = () => { if (fin) return; fin = true; veilIn(MOMENTS[now().m].zh).then(() => { door.hidden = true; g.classList.add('gone'); lockScroll(false); mount(first); if (first.arg === 'ouverture') setTimeout(() => scrollToEl($('#ouverture')), 80); return veilOut(); }); };
      setTimeout(finish, 4200);
      const tl = G.timeline({ onComplete: finish });
      tl.to($$('.g-mid, .g-top, .g-bot', g), { opacity: 0, y: -20, duration: .6, ease: 'expo.in', stagger: .05 })
        .fromTo(door, { opacity: 0 }, { opacity: 1, duration: .9, ease: 'sine.out' }, '-=.2')
        .fromTo($('img', door), { scale: 1.05 }, { scale: 2.6, duration: 2.1, ease: 'expo.in', transformOrigin: '50% 68%' }, '<')
        .to($('img', door), { filter: 'blur(10px) brightness(1.3)', duration: .7, ease: 'sine.in' }, '-=.7');
      return;
    }
    const done = () => { g.classList.add('gone'); g.setAttribute('aria-hidden', 'true'); lockScroll(false); mount(first); if (first.arg === 'ouverture') setTimeout(() => scrollToEl($('#ouverture')), 80); };
    if (!G || RM) { done(); return; }
    veilIn(MOMENTS[now().m].zh).then(() => { g.classList.add('gone'); lockScroll(false); mount(first); if (first.arg === 'ouverture') setTimeout(() => scrollToEl($('#ouverture')), 80); return veilOut(); });
  }

  /* ---------- démarrage ---------- */
  function boot() {
    initScroll();
    const r = parse(location.hash);
    render(r);
    lockScroll(true);
    initGrain();
    initCursor();
    tick(); setInterval(tick, 20000);
    $('.n-heures').setAttribute('href', '#heure-' + now().m);
    $$('[data-bag-count]').forEach((el) => { el.textContent = bagCount(); });

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (a) {
        e.preventDefault();
        if (a.hasAttribute('data-close-bag')) closeBag();
        go(a.getAttribute('href').slice(1));
        return;
      }
      if (e.target.closest('[data-open-bag]')) { e.preventDefault(); openBag(); return; }
      const qz = e.target.closest('[data-quiz]');
      if (qz) {
        quiz[qz.dataset.quiz] = qz.dataset.val;
        $$(`[data-quiz="${qz.dataset.quiz}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b === qz)));
        if (QUIZ.every((q) => quiz[q.k])) {
          const box = $('#carnet-res');
          box.innerHTML = carnetRes();
          if (ANIM) { G.from($$('.c-day', box), { y: 40, opacity: 0, duration: 1, stagger: .1, ease: 'expo.out' }); refreshSoon(); }
          scrollToEl(box);
        }
        return;
      }
      const aa = e.target.closest('[data-add-all]');
      if (aa) { aa.dataset.addAll.split(',').forEach((s) => { const key = `${s}|0|`; const ex = bag.find((it) => it.k === key); if (ex) ex.q += 1; else bag.push({ k: key, s, o: 0, sh: BY[s].shades ? 0 : null, q: 1 }); }); store.set('ys-bag', bag); syncBag(); toast('Le rituel complet est dans votre panier'); pulse($('.nav .n-bag')); return; }
      const f = e.target.closest('[data-f]'), v = e.target.closest('[data-v]');
      if (f || v) {
        if (f) { colFilter = f.dataset.f; $$('[data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b === f))); }
        if (v) { colView = v.dataset.v; $$('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b === v))); }
        const box = $('#col-list');
        const swap = () => { box.innerHTML = colList(); bindPage({ page: '_list' }, box); if (ANIM) { G.fromTo(box, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .7, ease: 'expo.out' }); refreshSoon(); } };
        if (ANIM) G.to(box, { opacity: 0, duration: .25, onComplete: swap }); else swap();
        return;
      }
      if (e.target.closest('.b-close, .b-shade')) { closeBag(); return; }
      if (e.target.closest('.n-menu')) { $('#menu').hidden ? openMenu() : closeMenu(); return; }
      const qb = e.target.closest('[data-q]');
      if (qb) { const it = bag[+qb.dataset.q]; it.q += +qb.dataset.d; if (it.q <= 0) bag.splice(+qb.dataset.q, 1); store.set('ys-bag', bag); syncBag(); renderBag(); return; }
      if (e.target.closest('[data-checkout]')) { bag = []; store.set('ys-bag', bag); $$('[data-bag-count]').forEach((el) => { el.textContent = 0; }); renderBag(true); return; }
      if (e.target.closest('#zoom')) { $('#zoom').hidden = true; lockScroll(false); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeBag(); closeMenu(); if (!$('#zoom').hidden) { $('#zoom').hidden = true; lockScroll(false); } } });
    window.addEventListener('hashchange', () => { if (suppress) { suppress = false; return; } go(location.hash.slice(1), false); });
    const onScroll = () => navState();
    if (lenis) lenis.on('scroll', onScroll); else window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { if (ST) ST.refresh(); });

    $('.g-enter').addEventListener('click', () => enter(r));
    gate(r);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
