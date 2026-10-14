/* Foster Fore — Scroll-Choreografie. Vanilla JS, optional Lenis für sanftes Scrollen. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  var easeInOut = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var set = function (el, name, v) { if (el) el.style.setProperty(name, (+v).toFixed(4)); };

  window.addEventListener('load', function () { root.classList.add('is-loaded'); });
  setTimeout(function () { root.classList.add('is-loaded'); }, 1200);

  /* ---------- Sanftes Scrollen (nur Maus/Trackpad, nie bei reduzierter Bewegung) ---------- */
  var lenis = null;
  if (!reduced && finePointer && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.85, autoRaf: true, syncTouch: false });
  }

  /* ---------- Zitat in Wörter zerlegen (Text bleibt identisch) ---------- */
  var ink = document.querySelector('[data-ink] p');
  var words = [];
  if (ink && !reduced) {
    var parts = ink.textContent.split(/(\s+)/);
    ink.textContent = '';
    parts.forEach(function (part) {
      if (part === '' || /^\s+$/.test(part)) { ink.appendChild(document.createTextNode(part)); return; }
      var s = document.createElement('span');
      s.className = 'ink-w';
      s.textContent = part;
      ink.appendChild(s);
      words.push(s);
    });
  }

  /* ---------- Reveal beim Hineinscrollen (einmalig) ---------- */
  var reveals = document.querySelectorAll('.reveal');
  reveals.forEach(function (el) {
    var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.classList.contains('reveal'); });
    var i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty('--d', Math.min(i * 0.11, 0.45) + 's');
  });
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Elemente ---------- */
  var nav = document.querySelector('[data-nav]');
  var hero = document.querySelector('.hero');
  var unframe = document.querySelector('.unframe');
  var uWords = unframe ? Array.prototype.slice.call(unframe.querySelectorAll('.uw')) : [];
  var delivering = document.querySelector('.delivering');
  var team = document.querySelector('.team');
  var contact = document.querySelector('.contact');
  var quote = document.querySelector('[data-ink]');
  var drift = document.querySelector('[data-drift]');
  var circle = document.querySelector('.clients__circle');
  var darkZones = document.querySelectorAll('.room, .unframe');
  var offerLinks = document.querySelectorAll('[data-offer-link]');
  var offers = document.querySelectorAll('[data-offer]');
  var menuToggle = document.querySelector('[data-menu-toggle]');
  var menu = document.querySelector('[data-menu]');

  /* ---------- Signature: das komponierte Stillleben ----------
     Startlage relativ zur Endlage: dx/dy in Bühnenbreite/-höhe, s = Skalierung,
     r = Drehung in Grad, w = Zeitfenster im Scrollfortschritt der Bühne. */
  var assembly = document.querySelector('[data-assembly]');
  var stage = assembly && assembly.querySelector('.assembly__stage');
  var light = assembly && assembly.querySelector('.assembly__light');
  var frame = assembly && assembly.querySelector('.assembly__frame');
  var aTitle = assembly && assembly.querySelector('.assembly__title');
  var pieces = assembly ? [
    // fern = kleiner und dunkler (o = Start-Deckkraft über Schwarz), Drehung höchstens ±4°
    { k: 'tazza',    dx:  0,   dy: -.40, s: .66, r:  0, o: .55, w: [.10, .52] },
    { k: 'apricots', dx: -.13, dy:  .24, s: .8,  r: -3, o: .6,  w: [.18, .58] },
    { k: 'bowl',     dx:  .13, dy:  .26, s: .8,  r:  3, o: .6,  w: [.26, .64] }
  ].map(function (o) {
    o.el = assembly.querySelector('[data-obj="' + o.k + '"]');
    o.shade = assembly.querySelector('[data-patch="' + o.k + '"]');
    return o;
  }) : [];
  var lerpN = function (a, b, t) { return a + (b - a) * t; };

  /* ---------- Hero: das Prunkstillleben setzt sich zusammen ----------
     Teile kommen aus drei Tiefen: Hintergrund klein von oben (fern), Mittelgrund von den Seiten,
     Vordergrund groß von vorn (nah an der Kamera). Danach erscheinen Wand und Tisch,
     das Original blendet über, der Rahmen schließt sich. "FOCUS" rückt dabei über das Bild. */
  var heroSec = document.querySelector('[data-hero]');
  var hStage = heroSec && heroSec.querySelector('.hero__stage');
  var hPlate = heroSec && heroSec.querySelector('.hero__plate');
  var hMaster = heroSec && heroSec.querySelector('.hero__master');
  var hFrame = heroSec && heroSec.querySelector('.hero__frame');
  var hCluster = heroSec && heroSec.querySelector('.hero__cluster');
  var hSmall = heroSec && heroSec.querySelector('.hero__small');
  var hMono = heroSec && heroSec.querySelector('.hero__mono');
  var hTitle = heroSec && heroSec.querySelector('.hero__title');
  var hVeil = heroSec && heroSec.querySelector('.hero__veil');
  var enablesSec = document.querySelector('[data-enables]');
  var heroDark = false;              // Gemälde füllt den Bildschirm: Kopfzeile hell
  var ZOOM = { d: .8, m: .7 }, HOLD = .15, FADE = .45; // Wachsen, Halten, Verlauf über "Enables" (in Bildschirmhöhen)
  var DEPTH = {                      // Streuung um die Bildmitte, Startgröße, Höhenversatz, Zeitfenster
    back:  { spread: 1.35, s: .62, lift: -.55, w: [.03, .40] },
    mid:   { spread: 1.9,  s: 1.15, lift: -.05, w: [.07, .48] },
    front: { spread: 2.5,  s: 1.75, lift: .45, w: [.11, .56] }
  };
  var hPieces = heroSec ? Array.prototype.map.call(heroSec.querySelectorAll('.hero__piece'), function (el, i) {
    var g = el.getAttribute('data-g'), cx = +el.getAttribute('data-cx'), cy = +el.getAttribute('data-cy');
    var dist = Math.hypot(cx - .5, cy - .5);
    return { el: el, g: g, cx: cx, cy: cy, d: DEPTH[g], delay: Math.min(dist * .08, .05), rot: ((i % 2) ? 1 : -1) * (2 + (i % 3)) };
  }) : [];
  var hm = null;                     // gemessene Grundmaße (ohne Transformation)
  function heroMeasure() {
    if (!heroSec) return;
    hSmall.style.transform = ''; hMono.style.transform = '';
    var sr = hSmall.getBoundingClientRect(), mr = hMono.getBoundingClientRect();
    var mobile = window.innerWidth < 761;
    var sS = mobile ? .72 : .58, sM = mobile ? .42 : .2;         // Endgrößen der beiden Titelzeilen
    var top = mobile ? 92 : 96;
    var gutter = mobile ? 20 : Math.max(40, window.innerWidth * .05);
    if (mobile) {                    // Handy: Titel und Bild gemeinsam senkrecht mittig
      var blockH = sr.height * sS + 2 + mr.height * sM + 30 + (window.innerWidth - 2 * gutter) / 1.5;
      top = Math.max(top, (VH - blockH) / 2 - 8);
    }
    var smallTop = top, monoTop = top + sr.height * sS + (mobile ? 2 : 6);
    var stageTop = monoTop + mr.height * sM + (mobile ? 30 : 34);
    var stageW = Math.min(window.innerWidth - 2 * gutter, (VH - stageTop - (mobile ? 40 : 36)) * 1.5);
    // Endbild: Gemälde füllt den Bildschirm, Titel steht in der Bildmitte
    var cS = mobile ? .86 : .72, cM = mobile ? .5 : .32, cGap = mobile ? 4 : 10;
    var cBlock = sr.height * cS + cGap + mr.height * cM;
    var cSmallTop = VH / 2 - cBlock / 2, cMonoTop = cSmallTop + sr.height * cS + cGap;
    var stageH = stageW / 1.5;
    var cover = Math.max(window.innerWidth / stageW, VH / stageH) * 1.01;
    var dy = VH / 2 - (stageTop + stageH / 2);
    hm = { sr: sr, mr: mr, sS: sS, sM: sM, smallTop: smallTop, monoTop: monoTop, stageTop: stageTop, stageW: stageW, mobile: mobile,
           cS: cS, cM: cM, cSmallTop: cSmallTop, cMonoTop: cMonoTop, cover: cover, dy: dy };
    hStage.style.setProperty('--stage-top', stageTop.toFixed(1) + 'px');
    hStage.style.setProperty('--stage-w', stageW.toFixed(1) + 'px');
  }
  function heroUpdate(vh) {
    var r = heroSec.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) { heroDark = false; return; }
    if (!hm) heroMeasure();
    // Die Phasen hängen an der Lage des nächsten Raums: Zusammensetzen · Bild wächst · Halten · Vorhang
    var s = -r.top;
    var eTop = enablesSec ? enablesSec.getBoundingClientRect().top : r.bottom;
    var G = FADE * vh, zLen = (hm.mobile ? ZOOM.m : ZOOM.d) * vh;
    var zStartTop = vh + G + HOLD * vh + zLen;
    var sZoom = Math.max(1, eTop + s - zStartTop);           // Scrollweg bis das Bild zu wachsen beginnt
    var p = clamp(s / (sZoom / .82));                         // 0–1: Zusammensetzen
    var z = easeInOut(clamp((zStartTop - eTop) / zLen));      // 0–1: Bild wächst auf volle Größe
    var c = clamp((vh + G - eTop) / (vh + G));                // 0–1: dunkler Raum schiebt sich darüber

    // Titel: erst Überschrift über dem Bild, dann hell in der Bildmitte; beim Vorhang leicht nach oben
    var tp = easeInOut(clamp((p - .02) / .4)), lift = -c * .1 * vh;
    var sy = lerpN((hm.smallTop - hm.sr.top) * tp, hm.cSmallTop - hm.sr.top, z) + lift;
    var my = lerpN((hm.monoTop - hm.mr.top) * tp, hm.cMonoTop - hm.mr.top, z) + lift;
    hSmall.style.transform = 'translate3d(0,' + sy.toFixed(1) + 'px,0) scale(' + lerpN(lerpN(1, hm.sS, tp), hm.cS, z).toFixed(4) + ')';
    hMono.style.transform = 'translate3d(0,' + my.toFixed(1) + 'px,0) scale(' + lerpN(lerpN(1, hm.sM, tp), hm.cM, z).toFixed(4) + ')';
    // Schriftfarbe wechselt, sobald die Oberkante des wachsenden Bildes unter dem Titel durchläuft
    var sc = lerpN(1, hm.cover, z) * (1 + .05 * c), sH = hm.stageW / 1.5;
    var imgTop = hm.stageTop + hm.dy * z + sH / 2 * (1 - sc);
    var titleMid = (hm.sr.top + sy + hm.mr.top + my + hm.mr.height * lerpN(lerpN(1, hm.sM, tp), hm.cM, z)) / 2;
    var tc = z > 0 ? clamp((titleMid - imgTop) / (.12 * vh) + .25) : 0;
    hTitle.style.color = tc > 0 ? 'rgb(' + Math.round(231 * tc) + ',' + Math.round(229 * tc) + ',' + Math.round(228 * tc) + ')' : '';
    hCluster.style.opacity = (1 - clamp(p / .1)).toFixed(3);
    hCluster.style.transform = 'translate3d(0,' + (-p * 260).toFixed(1) + 'px,0)';

    // Teile fliegen aus ihren Tiefen an ihren Platz (danach ruhen sie unsichtbar unter dem Gemälde)
    var whole = p > .7;
    heroSec.classList.toggle('is-whole', whole);
    if (!whole) {
      var W = hm.stageW, H = W / 1.5, k = hm.mobile ? .55 : 1;
      hPieces.forEach(function (o) {
        var t = easeInOut(clamp((p - o.d.w[0] - o.delay) / (o.d.w[1] - o.d.w[0])));
        var sx = (o.cx - .5) * (o.d.spread - 1) * W * k, sy = ((o.cy - .5) * (o.d.spread - 1) + o.d.lift) * H;
        var x = lerpN(sx, 0, t), y = lerpN(sy, 0, t);
        o.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + lerpN(o.d.s, 1, t).toFixed(4) + ') rotate(' + lerpN(o.rot, 0, t).toFixed(2) + 'deg)';
        o.el.style.opacity = clamp((p - o.d.w[0] + .02) / .06).toFixed(3);
      });
    }
    // Wand und Tisch erscheinen, dann das Original, dann der Rahmen
    hPlate.style.setProperty('--plate', easeInOut(clamp((p - .44) / .18)).toFixed(4));
    hMaster.style.setProperty('--master', clamp((p - .6) / .08).toFixed(4));
    hFrame.style.setProperty('--fr', easeInOut(clamp((p - .64) / .12)).toFixed(4));
    hFrame.style.opacity = (1 - clamp(z * 3)).toFixed(3);

    // Gemälde wächst bildschirmfüllend, Schleier hinter dem Titel; unter dem Vorhang sinkt es ins Dunkel
    hStage.style.transform = z > 0 ? 'translate3d(-50%,' + (hm.dy * z).toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')' : '';
    hVeil.style.setProperty('--veil', clamp((z - .3) / .7).toFixed(3));
    hVeil.style.setProperty('--shade', (c * .7).toFixed(3));
    heroDark = z > .55;
  }
  function assemble(vh) {
    var r = assembly.getBoundingClientRect();
    var p = clamp(-r.top / (r.height - vh));
    var W = stage.offsetWidth, H = stage.offsetHeight;
    var k = W > window.innerWidth ? .5 : 1; // Handy: Bühne ist breiter als der Bildschirm, Wege kürzer
    pieces.forEach(function (o) {
      if (!o.el) return;
      var t = easeInOut(clamp((p - o.w[0]) / (o.w[1] - o.w[0])));
      var x = lerpN(o.dx * W * k, 0, t), y = lerpN(o.dy * H, 0, t);
      o.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + lerpN(o.s, 1, t).toFixed(4) + ') rotate(' + lerpN(o.r, 0, t).toFixed(3) + 'deg)';
      o.el.style.opacity = lerpN(o.o, 1, t).toFixed(3);
      // Schatten erst beim Aufsetzen (letzte 12 % des Laufs)
      if (o.shade) o.shade.style.setProperty('--so', clamp((t - .88) / .12).toFixed(3));
    });
    // Ein Licht erfasst die Nische, wenn alle angekommen sind · Rahmen schließt sich · danach Stille
    light.style.setProperty('--light', easeInOut(clamp((p - .42) / .4)).toFixed(4));
    frame.style.setProperty('--fr', easeInOut(clamp((p - .8) / .12)).toFixed(4));
    var tt = clamp((p - .1) / .22);
    aTitle.style.setProperty('--tt', (1 - tt).toFixed(4));
    aTitle.style.setProperty('--tg', easeInOut(tt).toFixed(4));
  }

  /* ---------- Finale: aus den drei Porträts entsteht das Logo ----------
     Die drei Kreise lösen sich aus ihren Plätzen, finden sich in der Mitte zur Dreiheit,
     drehen sich langsam, während der Kontakt aufgedeckt wird, und ziehen sich dann
     genau auf den Ring des Logos zusammen. Im Ring erscheinen F, / und gespiegeltes F
     nacheinander (eins je Person), zuletzt der Schriftzug. Am Seitenende steht das Logo. */
  var uniteEl = document.querySelector('[data-unite]');
  var uLogo = document.querySelector('[data-unite-logo]');
  var uPhotos = team ? Array.prototype.slice.call(team.querySelectorAll('.person__photo')) : [];
  var uClones = uniteEl ? Array.prototype.slice.call(uniteEl.querySelectorAll('.unite__c')) : [];
  var uPart = function (k) { return uLogo && uLogo.querySelector('.logo-part--' + k); };
  var uRing = uPart('ring'), uGlyphs = [uPart('f1'), uPart('slash'), uPart('f2')], uWord = uPart('word');
  var RING = { x: 599.5 / 1200, y: 291.5 / 850, d: 584.5 / 1200 }; // Ring im Logo (gemessen an der Originaldatei)
  var SEAT = [150, -90, 30];          // Plätze in der Dreiheit: René links unten, Barbara oben, Bruno rechts unten
  var um = null;
  function uniteMeasure() {
    var last = uPhotos[uPhotos.length - 1].getBoundingClientRect();
    var mobile = window.innerWidth < 761;
    um = { y0: window.scrollY + last.top + last.height / 2 - VH * (mobile ? .55 : .5), D0: last.width, mobile: mobile };
    uClones.forEach(function (c) { c.style.width = c.style.height = um.D0.toFixed(1) + 'px'; });
  }
  function unite(vh, y) {
    if (!um) uniteMeasure();
    var yMax = document.documentElement.scrollHeight - vh;
    var m = clamp((y - um.y0) / Math.max(1, yMax - um.y0));
    var on = y > um.y0;
    uniteEl.classList.toggle('is-on', on);
    team.classList.toggle('is-lifted', on);

    // Logo im Kontakt: Ring, dann die drei Zeichen nacheinander, dann der Schriftzug
    uRing.style.opacity = easeInOut(clamp((m - .8) / .12)).toFixed(3);
    uGlyphs.forEach(function (g, i) {
      var t = easeInOut(clamp((m - .86 - i * .035) / .06));
      g.style.opacity = t.toFixed(3);
      g.style.transform = 'translate3d(0,' + ((1 - t) * 6).toFixed(2) + 'px,0)';
    });
    var tw = easeInOut(clamp((m - .92) / .06));
    uWord.style.opacity = tw.toFixed(3);
    uWord.style.transform = 'translate3d(0,' + ((1 - tw) * 8).toFixed(2) + 'px,0)';
    if (!on) return;

    // Ziel: der Ring des Logos (bewegt sich mit dem Vorhang mit)
    var vw = window.innerWidth, lr = uLogo.getBoundingClientRect();
    var ex = lr.left + lr.width * RING.x, ey = lr.top + lr.height * RING.y, dEnd = lr.width * RING.d;
    var cx0 = vw / 2, cy0 = vh * .46, dV = Math.min(um.D0 * .95, vw * (um.mobile ? .44 : .24));
    var ga = easeInOut(clamp(m / .3));                 // lösen und sammeln
    var cv = easeInOut(clamp((m - .52) / .4));         // zur Ringgröße zusammenziehen
    var ov = easeInOut(clamp((m - .78) / .16));        // die drei rücken ineinander, erst während sie sich auflösen
    var spin = m * 100;                                // langsame Drehung der Dreiheit
    var fade = 1 - easeInOut(clamp((m - .78) / .14));  // Porträts lösen sich im Ring auf, noch bevor sie ganz übereinanderliegen
    uClones.forEach(function (c, i) {
      var r = uPhotos[i].getBoundingClientRect();
      var dT = lerpN(dV, dEnd, cv);
      var a = (SEAT[i] + spin) * Math.PI / 180, off = dT * .36 * (1 - ov);
      var tx = lerpN(cx0, ex, cv) + Math.cos(a) * off, ty = lerpN(cy0, ey, cv) + Math.sin(a) * off;
      var x = lerpN(r.left + r.width / 2, tx, ga), yy = lerpN(r.top + r.height / 2, ty, ga);
      var d = lerpN(r.width, dT, ga);
      c.style.transform = 'translate3d(' + (x - um.D0 / 2).toFixed(1) + 'px,' + (yy - um.D0 / 2).toFixed(1) + 'px,0) scale(' + (d / um.D0).toFixed(4) + ')';
      c.style.opacity = fade.toFixed(3);
    });
  }

  /* Viewport-Höhe zwischenspeichern: auf iOS springt sie beim Einklappen der Toolbar */
  var touch = 'ontouchstart' in window;
  var VH = window.innerHeight, VW = window.innerWidth;
  function measureViewport(force) {
    if (force || !touch || window.innerWidth !== VW) { VW = window.innerWidth; VH = window.innerHeight; }
  }

  /* Kontakt als "Vorhang": nur wenn er ganz in den Bildschirm passt */
  function setupCurtain() {
    root.classList.toggle('has-curtain', !reduced && contact.offsetHeight <= VH + 2);
  }
  setupCurtain();

  // Fortschritt eines Elements durch den Viewport: 0 = kommt unten herein, 1 = oben hinaus
  function through(el, vh) {
    var r = el.getBoundingClientRect();
    return clamp((vh - r.top) / (vh + r.height));
  }

  var lastY = window.scrollY;
  var ticking = false;

  function update() {
    ticking = false;
    var y = window.scrollY;
    var vh = VH;
    var docH = document.documentElement.scrollHeight - vh;
    var curtain = root.classList.contains('has-curtain');

    set(nav, '--read', docH > 0 ? clamp(y / docH) : 0);

    if (!reduced) {

      // Höhepunkt: Gemälde öffnet sich, danach schwebt die Karte ein
      var r = unframe.getBoundingClientRect();
      var p = clamp(-r.top / (r.height - vh));
      // 0–48 %: Gemälde öffnet sich · 46–58 %: Karte schwebt ein · 58–90 %: Wörter gewinnen Deckkraft · danach: Halten
      set(unframe, '--o', easeInOut(clamp(p / 0.48)));
      set(unframe, '--t', easeInOut(clamp((p - 0.46) / 0.12)));
      var wp = clamp((p - 0.58) / 0.32), wn = uWords.length, we = 1.6;
      uWords.forEach(function (el, i) {
        var w = easeInOut(clamp((wp * (wn + we) - i) / we));
        el.style.setProperty('--wo', (0.14 + w * 0.86).toFixed(3));
      });
      set(unframe, '--wl', clamp((wp - .85) / .15));

      // Delivering
      var d = delivering.getBoundingClientRect();
      set(delivering, '--p', clamp((vh - d.top) / (vh + d.height)));
      set(delivering, '--t', easeInOut(clamp((vh * 0.9 - d.top) / (vh * 0.35))));
      set(delivering, '--t2', easeInOut(clamp((vh * 0.8 - d.top) / (vh * 0.35))));

      // Zitat: Wort für Wort
      if (words.length) {
        var q = quote.getBoundingClientRect();
        var qp = clamp((vh * 0.88 - q.top) / (q.height + vh * 0.38));
        var n = words.length, edge = 2.5;
        for (var i = 0; i < n; i++) {
          var w = clamp((qp * (n + edge) - i) / edge);
          words[i].style.setProperty('--wo', (0.2 + w * 0.8).toFixed(3));
        }
      }

      // Hero und komponiertes Stillleben
      if (heroSec && !reduced) heroUpdate(vh);
      if (assembly) assemble(vh);

      // Fenster-Parallaxen und Schrift-Drift
      set(circle, '--sp', through(circle, vh));
      if (drift) set(drift, '--sp', through(drift, vh));

      // Kontakt-Vorhang
      if (curtain) set(contact, '--cp', clamp((vh - team.getBoundingClientRect().bottom) / contact.offsetHeight));
      if (uniteEl && uLogo && uPhotos.length === 3) unite(vh, y);
    } else {
      set(unframe, '--o', 1); set(unframe, '--t', 1); set(unframe, '--wl', 1);
    }

    // Kopfzeile: hell oder dunkel je nach Raum darunter
    var probe = 32, dark = false;
    darkZones.forEach(function (z) { var b = z.getBoundingClientRect(); if (b.top <= probe && b.bottom >= probe) dark = true; });
    if (heroDark) dark = true;
    if (curtain && team.getBoundingClientRect().bottom <= probe) dark = false;
    nav.classList.toggle('is-dark', dark);
    nav.classList.toggle('is-scrolled', y > 40);
    var menuOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    if (!menuOpen && y > vh * 0.9 && y > lastY + 2) nav.classList.add('is-hidden');
    if (y < lastY - 2 || y < vh * 0.9 || menuOpen) nav.classList.remove('is-hidden');
    lastY = y;

    // Aktives Kapitel (Hexagon gefüllt)
    var current = null;
    offers.forEach(function (o) { if (o.getBoundingClientRect().top <= vh * 0.45) current = o.id; });
    offerLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-offer-link') === (current || 'offer-1')); });
  }

  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measureViewport(false); setupCurtain(); hm = null; um = null; onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { hm = null; um = null; onScroll(); });
  window.addEventListener('orientationchange', function () { setTimeout(function () { measureViewport(true); setupCurtain(); onScroll(); }, 250); });
  if (lenis) lenis.on('scroll', onScroll);
  update();

  /* ---------- Menü (Vollbild, dunkler Raum) ---------- */
  function setMenu(open) {
    menuToggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    nav.classList.toggle('is-menu', open);
    if (lenis) { open ? lenis.stop() : lenis.start(); }
  }
  menuToggle.addEventListener('click', function () { setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Anker-Links: sanft und korrekt auch beim Kontakt-Vorhang ---------- */
  function docTop(el) { var t = 0; while (el) { t += el.offsetTop; el = el.offsetParent; } return t; }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    var target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    setMenu(false);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var top = (target === contact && root.classList.contains('has-curtain')) ? max : Math.min(docTop(target), max);
    if (lenis) lenis.scrollTo(top, { duration: 1.6, force: true });
    else window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    if (history.replaceState) history.replaceState(null, '', id);
  });
})();
