/*
 * NEXUS · Holograma de la ciutat (recreació en codi dels vídeos del Figma)
 * ------------------------------------------------------------------------
 * Font: Figma «Fase 2 → Prototipat i sistema de disseny» (Tv6zITNxr57800Gf7jWtrT),
 * 28 vídeos de holograma (7 per orbe) + làmines 13 «Hologramas» i 14 «Holograma · Aparición».
 *
 * Seqüència d'aparició (igual que als vídeos, en segons):
 *   0.0–0.6  punt de llum a l'emissor
 *   0.3–1.2  piràmide de llum i pla de reixeta
 *   1.1–2.6  partícules que pugen en remolí i s'escampen sobre la placa
 *   2.0–2.9  la placa s'encén amb soroll de píxels; apareix la cúpula
 *   2.5–3.3  la ciutat es construeix de baix a dalt amb una banda de píxels
 *   3.3      glitch (talls horitzontals + separació RGB)
 *   3.6      (versions A…BB) pols de canvi d'estat i efectes de la versió
 *   després  glitch periòdic cada ~5–7 s
 *
 * Versions (com als vídeos):
 *   ''  1_ciudad-sin-decisiones  ciutat en calma
 *   A   2_ciudad-decision-A      accés ampli a dades: arcs de dades + feixos des de la cúpula
 *   B   3_ciudad-decision-B      accés limitat: ciutat més apagada, cúpula petita
 *   AA  4_conclusion-1           «La ciutat que ho sap tot»: arcs + focus de vigilància
 *   AB  5_conclusion-2           «La línia vermella»: anells-escut al voltant de la cúpula
 *   BA  6_conclusion-3           «La ciutat automàtica»: edificis en filferro brillant + feixos
 *   BB  7_conclusion-4           «El control humà»: ciutat càlida, finestres enceses
 *
 * API (substitueix el reproductor de vídeo del bundle):
 *   NexusHolo.create({ versions:{base:'<nom vídeo>'}, orb:'sora'|'nima'|'luah'|'kylo', rect:{x,y,w,h} })
 *     → { el, play(), setChoice('A'|'B'|null), destroy() }
 */
(function () {
  'use strict';

  /* ---------- Dades del Figma ---------- */

  var VERSION_BY_VIDEO = {
    '1_ciudad-sin-decisiones': '',
    '2_ciudad-decision-A': 'A',
    '3_ciudad-decision-B': 'B',
    '4_conclusion-1': 'AA',
    '5_conclusion-2': 'AB',
    '6_conclusion-3': 'BA',
    '7_conclusion-4': 'BB'
  };

  // Colors per orbe (paletes del Sistema de disseny, làmina 6, i dels vídeos).
  // build: [principal, secundari, terciari, accent de torre]
  var ORBS = {
    sora: { build: ['#1BD8C6', '#6D4AFF', '#8E7BFF', '#E879F9'], roof: '#E879F9', cap: '#6D4AFF', plate: '#5C6BFF', beam: '#1BD8C6', dome: '#E879F9', light: '#D8FFFB' },
    nima: { build: ['#E879F9', '#B83AE0', '#F7C6FF', '#F7C6FF'], roof: '#F7C6FF', cap: '#B83AE0', plate: '#B83AE0', beam: '#E879F9', dome: '#F7C6FF', light: '#FFE8FF' },
    luah: { build: ['#1BD8C6', '#0E9F94', '#9DF5EA', '#9DF5EA'], roof: '#9DF5EA', cap: '#0E9F94', plate: '#0E9F94', beam: '#1BD8C6', dome: '#9DF5EA', light: '#E0FFFB' },
    kylo: { build: ['#6D4AFF', '#4A2EDB', '#B3A6FF', '#B3A6FF'], roof: '#B3A6FF', cap: '#4A2EDB', plate: '#4A2EDB', beam: '#6D4AFF', dome: '#B3A6FF', light: '#E6E0FF' }
  };

  // look: aspecte de la ciutat · dome: escala de la cúpula · fx: efectes superposats
  var VERSIONS = {
    '':  { look: 'base', dome: 1.0,  arcs: 0, fan: 0,  search: 0, rings: 0, glitch: [5.0, 7.5] },
    A:   { look: 'base', dome: 1.15, arcs: 5, fan: 10, search: 0, rings: 0, glitch: [4.5, 7.0] },
    B:   { look: 'dim',  dome: 0.82, arcs: 0, fan: 0,  search: 0, rings: 0, glitch: [6.0, 9.0] },
    AA:  { look: 'base', dome: 1.35, arcs: 7, fan: 14, search: 3, rings: 0, glitch: [2.6, 4.2] },
    AB:  { look: 'base', dome: 1.2,  arcs: 0, fan: 0,  search: 0, rings: 3, glitch: [5.5, 8.0] },
    BA:  { look: 'auto', dome: 1.4,  arcs: 6, fan: 16, search: 0, rings: 0, glitch: [3.5, 5.5] },
    BB:  { look: 'warm', dome: 0.85, arcs: 0, fan: 0,  search: 0, rings: 0, glitch: [6.5, 9.5] }
  };

  // Geometria del vídeo (quadrat normalitzat 0–1), mesurada sobre els fotogrames exportats.
  var G = { cx: 0.5, cy: 0.532, pw: 0.306, ph: 0.13, slab: 0.014, ex: 0.5, ey: 0.817, top: 0.14 };

  // Ciutat: [centre a, centre b, mig ample a, mig ample b, alçada, coberta, color]
  // a cap a la dreta-avall, b cap a l'esquerra-avall; placa de -1 a 1.
  var CITY = [
    [-0.66, -0.66, 0.17, 0.17, 0.20, 'dome', 1],
    [-0.22, -0.66, 0.16, 0.15, 0.33, 'antenna', 0],
    [-0.66, -0.22, 0.15, 0.16, 0.24, 'flat', 0],
    [0.22, -0.66, 0.16, 0.17, 0.22, 'step', 2],
    [-0.66, 0.22, 0.15, 0.15, 0.17, 'spire', 0],
    [0.66, -0.66, 0.15, 0.15, 0.18, 'antenna', 1],
    [-0.66, 0.66, 0.14, 0.14, 0.12, 'spire', 0],
    [-0.22, -0.22, 0.17, 0.17, 0.21, 'flat', 2],
    [0.0, 0.0, 0.045, 0.045, 0.2, 'spire', 3],
    [0.22, -0.22, 0.16, 0.15, 0.16, 'flat', 1],
    [-0.22, 0.22, 0.15, 0.16, 0.15, 'flat', 0],
    [0.66, -0.22, 0.15, 0.14, 0.12, 'flat', 0],
    [-0.22, 0.66, 0.14, 0.15, 0.10, 'flat', 1],
    [0.66, 0.22, 0.13, 0.13, 0.08, 'flat', 0],
    [0.22, 0.66, 0.13, 0.13, 0.07, 'flat', 2],
    [0.66, 0.66, 0.12, 0.12, 0.05, 'flat', 1]
  ];
  var DOME = { a: 0.22, b: 0.22, r: 0.05 };

  var T_BUILT = 3.3;
  var T_FX = 3.6;

  /* ---------- Utilitats ---------- */

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(hex, toHex, k) {
    var a = rgb(hex), b = rgb(toHex);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  function rgba(c, a) {
    if (typeof c === 'string') c = rgb(c);
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function bell(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return Math.sin(t * Math.PI); }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Projecció isomètrica de la placa: (a, b, alçada) → punt del quadrat del vídeo
  function iso(a, b, h) {
    return [G.cx + (a - b) * G.pw / 2, G.cy + (a + b) * G.ph / 2 - (h || 0)];
  }
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- Ciutat (es pinta un cop per aspecte en un canvas fora de pantalla) ---------- */

  function drawBuilding(ctx, B, P, look, px, r) {
    var ac = B[0], bc = B[1], ha = B[2], hb = B[3], h = B[4], roof = B[5], z = B[7] || 0;
    var base = P.build[B[6]];
    var a0 = ac - ha, a1 = ac + ha, b0 = bc - hb, b1 = bc + hb;
    var dim = look === 'dim' ? 0.55 : 1;
    var auto = look === 'auto';
    var litP = look === 'dim' ? 0.12 : look === 'warm' ? 0.62 : auto ? 0 : 0.36;

    var p10 = iso(a1, b0, z), p11 = iso(a1, b1, z), p01 = iso(a0, b1, z);
    var t00 = iso(a0, b0, z + h), t10 = iso(a1, b0, z + h), t11 = iso(a1, b1, z + h), t01 = iso(a0, b1, z + h);
    var edge = rgba(mix(base, '#FFFFFF', auto ? 0.75 : 0.35), (auto ? 0.95 : 0.8) * dim);
    var lite = mix(base, '#FFFFFF', look === 'warm' ? 0.65 : 0.5);

    // Cares: dreta (a = a1), esquerra (b = b1) i coberta
    var gR = ctx.createLinearGradient(0, t10[1], 0, p10[1]);
    gR.addColorStop(0, rgba(base, (auto ? 0.16 : 0.26) * dim));
    gR.addColorStop(1, rgba(base, (auto ? 0.06 : 0.12) * dim));
    ctx.fillStyle = gR; poly(ctx, [p10, p11, t11, t10]); ctx.fill();
    var gL = ctx.createLinearGradient(0, t01[1], 0, p01[1]);
    gL.addColorStop(0, rgba(base, (auto ? 0.22 : 0.36) * dim));
    gL.addColorStop(1, rgba(base, (auto ? 0.08 : 0.16) * dim));
    ctx.fillStyle = gL; poly(ctx, [p01, p11, t11, t01]); ctx.fill();
    ctx.fillStyle = rgba(mix(base, '#FFFFFF', 0.25), 0.42 * dim); poly(ctx, [t00, t10, t11, t01]); ctx.fill();

    // Finestres: guions curts per planta
    var floors = Math.max(2, Math.round(h / 0.0125));
    var faces = [[p10, p11], [p01, p11]];
    for (var f = 0; f < 2; f++) {
      var A = faces[f][0], C = faces[f][1];
      var cols = (f === 0 ? hb : ha) > 0.1 ? 3 : 1;
      for (var k = 1; k < floors; k++) {
        var y = h * (k / floors);
        for (var j = 0; j < cols; j++) {
          var s0 = (j + 0.22) / cols, s1 = (j + 0.78) / cols;
          var x0 = lerp(A[0], C[0], s0), y0 = lerp(A[1], C[1], s0) - y;
          var x1 = lerp(A[0], C[0], s1), y1 = lerp(A[1], C[1], s1) - y;
          if (auto) {
            ctx.strokeStyle = rgba('#FFFFFF', 0.5);
            ctx.lineWidth = px * 0.8;
          } else {
            var lit = r() < litP;
            ctx.strokeStyle = lit ? rgba(lite, 0.95 * dim) : rgba(base, 0.18 * dim);
            ctx.lineWidth = lit ? px * 1.3 : px;
          }
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
      }
    }

    // Arestes
    ctx.strokeStyle = edge; ctx.lineWidth = px;
    ctx.beginPath();
    ctx.moveTo(p01[0], p01[1]); ctx.lineTo(t01[0], t01[1]);
    ctx.moveTo(p11[0], p11[1]); ctx.lineTo(t11[0], t11[1]);
    ctx.moveTo(p10[0], p10[1]); ctx.lineTo(t10[0], t10[1]);
    ctx.moveTo(p01[0], p01[1]); ctx.lineTo(p11[0], p11[1]); ctx.lineTo(p10[0], p10[1]);
    ctx.stroke();
    poly(ctx, [t00, t10, t11, t01]); ctx.stroke();

    // Coberta
    var top = iso(ac, bc, z + h);
    if (roof === 'spire') {
      var apex = iso(ac, bc, z + h + Math.max(0.035, (ha + hb) * 0.35));
      ctx.fillStyle = rgba(P.roof, 0.5 * dim);
      poly(ctx, [t01, t11, apex]); ctx.fill();
      ctx.fillStyle = rgba(P.roof, 0.32 * dim);
      poly(ctx, [t11, t10, apex]); ctx.fill();
      ctx.strokeStyle = rgba(mix(P.roof, '#FFFFFF', 0.3), 0.85 * dim);
      ctx.beginPath();
      ctx.moveTo(t01[0], t01[1]); ctx.lineTo(apex[0], apex[1]); ctx.lineTo(t10[0], t10[1]);
      ctx.moveTo(t11[0], t11[1]); ctx.lineTo(apex[0], apex[1]);
      ctx.stroke();
      ctx.fillStyle = rgba(P.roof, dim);
      ctx.beginPath(); ctx.arc(apex[0], apex[1] - px * 3, px * 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (roof === 'dome') {
      var rx = (t10[0] - t01[0]) / 2 * 0.92, ry = rx * 0.95;
      ctx.fillStyle = rgba(P.cap, 0.45 * dim);
      ctx.beginPath(); ctx.ellipse(top[0], top[1], rx, ry, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(mix(P.cap, '#FFFFFF', 0.4), 0.8 * dim);
      ctx.stroke();
    } else if (roof === 'antenna') {
      ctx.strokeStyle = rgba(P.light, 0.8 * dim);
      ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(top[0], top[1] - 0.035); ctx.stroke();
      ctx.fillStyle = rgba(P.roof, dim);
      ctx.beginPath(); ctx.arc(top[0], top[1] - 0.035, px * 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (roof === 'step') {
      // Bloc superior retranquejat, apilat sobre la coberta
      drawBuilding(ctx, [ac, bc, ha * 0.6, hb * 0.6, 0.07, 'flat', B[6], z + h], P, look, px, r);
    }
  }

  function renderCity(P, look, W, H, U, ox, oy, px) {
    var c = canvas(W, H), ctx = c.getContext('2d');
    ctx.setTransform(U, 0, 0, U, ox, oy);
    ctx.lineJoin = 'round';
    var r = rng(2084);
    var order = CITY.slice().sort(function (p, q) { return (p[0] + p[1]) - (q[0] + q[1]); });
    for (var i = 0; i < order.length; i++) drawBuilding(ctx, order[i], P, look, px, r);
    return c;
  }

  // Blocs de píxels ocupats per la ciutat (per a la banda de construcció i els parpelleigs)
  function cityBlocks(city, bs) {
    var W = city.width, H = city.height;
    var data = city.getContext('2d').getImageData(0, 0, W, H).data;
    var rows = [], all = [];
    for (var y = 0; y < H; y += bs) {
      var row = [];
      for (var x = 0; x < W; x += bs) {
        var i = ((y + (bs >> 1)) * W + x + (bs >> 1)) * 4;
        if (i < data.length && data[i + 3] > 46) {
          // getImageData torna colors sense premultiplicar: només s'aclareixen
          var blk = [x, y, rgba([Math.min(255, data[i] * 1.25 + 40), Math.min(255, data[i + 1] * 1.25 + 40), Math.min(255, data[i + 2] * 1.25 + 40)], 1)];
          row.push(blk); all.push(blk);
        }
      }
      rows.push(row);
    }
    return { rows: rows, all: all, bs: bs };
  }

  /* ---------- Holograma ---------- */

  function create(opts) {
    var P = ORBS[opts.orb] || ORBS.sora;
    var rect = opts.rect;
    var baseV = VERSION_BY_VIDEO[(opts.versions && opts.versions.base) || ''] || '';

    var el = document.createElement('div');
    el.className = 'holo is-ready';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:absolute;left:' + rect.x + 'px;top:' + rect.y + 'px;width:' + rect.w + 'px;height:' + rect.h + 'px;';
    var view = canvas(1, 1);
    view.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    el.appendChild(view);
    var vctx = view.getContext('2d');

    var W, H, U, ox, oy, px, D, scene, sctx, rc, cc, pc, cities = {}, blocks;
    var particles = [], plateNoise = [], tops = [], fanPts = [];

    function setup() {
      var stageScale = 1;
      try {
        var bb = el.getBoundingClientRect();
        if (bb.width > 0) stageScale = bb.width / rect.w;
      } catch (e) { /* sense layout encara */ }
      D = clamp((window.devicePixelRatio || 1) * stageScale, 1, 2.5);
      var nW = Math.round(rect.w * D), nH = Math.round(rect.h * D);
      if (nW === W && nH === H) return;
      W = nW; H = nH;
      var S = Math.max(rect.w, rect.h);
      U = S * D; ox = (rect.w - S) / 2 * D; oy = (rect.h - S) / 2 * D; px = 1 / S;
      view.width = W; view.height = H;
      scene = canvas(W, H); sctx = scene.getContext('2d');
      rc = canvas(W, H); cc = canvas(W, H); pc = canvas(W, H);
      cities = {};
      blocks = cityBlocks(city('base'), Math.max(2, Math.round(3 * D)));
    }

    function city(look) {
      if (!cities[look]) cities[look] = renderCity(P, look, W, H, U, ox, oy, px);
      return cities[look];
    }

    // Partícules, soroll de la placa i punts de referència (llavor fixa: mateix holograma sempre)
    (function seed() {
      var r = rng(84);
      var cols = P.build.concat([P.light, P.beam]);
      for (var i = 0; i < 520; i++) {
        var a = r() * 2 - 1, b = r() * 2 - 1, h = Math.pow(r(), 1.7) * 0.27;
        particles.push({ s: 1.1 + r() * 1.3, a: a, b: b, h: h, sw: (r() - 0.5) * 0.16, ph: r() * 6.28, c: cols[(r() * cols.length) | 0], z: 0.6 + r() * 1.1 });
      }
      for (var j = 0; j < 320; j++) plateNoise.push([r() * 2 - 1, r() * 2 - 1, r()]);
      var byH = CITY.slice().sort(function (p, q) { return q[4] - p[4]; });
      for (var k = 0; k < byH.length; k++) {
        var B = byH[k];
        tops.push(iso(B[0], B[1], B[4] + (B[5] === 'spire' ? 0.04 : 0.01)));
        fanPts.push(iso(B[0] + B[2], B[1] + (r() - 0.5) * B[3], B[4] * (0.35 + r() * 0.5)));
        fanPts.push(iso(B[0] + (r() - 0.5) * B[2], B[1] + B[3], B[4] * (0.35 + r() * 0.5)));
      }
    })();

    /* --- estat --- */
    var raf = 0, t0 = 0, t = 0, alive = true, playing = false;
    var cur = baseV, prev = baseV, fxStart = T_FX, pulseAt = baseV ? T_FX : -1;
    var glitches = [], nextGlitch = 0, gr = rng(7);
    var lookPrev = VERSIONS[cur].look, lookAt = -1;

    function schedule(from) {
      var g = VERSIONS[cur].glitch;
      nextGlitch = from + g[0] + gr() * (g[1] - g[0]);
    }

    /* --- capes --- */

    function unit(ctx) { ctx.setTransform(U, 0, 0, U, ox, oy); }

    function drawEmitter(ctx, tt) {
      var on = smooth(0, 0.45, tt);
      var flash = 1 - smooth(1.2, 2.2, tt) * 0.55;
      var E = [G.ex, G.ey];
      var R = 0.045 * flash;
      var g = ctx.createRadialGradient(E[0], E[1], 0, E[0], E[1], R);
      g.addColorStop(0, rgba('#FFFFFF', on));
      g.addColorStop(0.12, rgba(P.light, on * 0.95));
      g.addColorStop(0.35, rgba(P.beam, on * 0.35));
      g.addColorStop(1, rgba(P.beam, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(E[0], E[1], R, 0, Math.PI * 2); ctx.fill();
      // Anells de la base (punts)
      var ring = smooth(0.8, 1.6, tt);
      if (ring > 0) {
        ctx.save();
        ctx.translate(E[0], E[1]); ctx.scale(1, 0.38);
        ctx.strokeStyle = rgba(P.beam, 0.55 * ring); ctx.lineWidth = px * 1.2;
        ctx.setLineDash([px * 2, px * 3]); ctx.lineDashOffset = -tt * 0.01;
        ctx.beginPath(); ctx.arc(0, 0, 0.032, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = rgba(P.beam, 0.35 * ring);
        ctx.beginPath(); ctx.arc(0, 0, 0.022, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    function plateCorners(scale, lift) {
      var E = [G.ex, G.ey];
      var C = [[G.cx - G.pw, G.cy + lift], [G.cx, G.cy + G.ph + lift], [G.cx + G.pw, G.cy + lift], [G.cx, G.cy - G.ph + lift]];
      return C.map(function (p) { return [lerp(E[0], p[0], scale), lerp(E[1], p[1], scale)]; });
    }

    function drawCone(ctx, tt) {
      var k = easeOut((tt - 0.25) / 0.85);
      if (k <= 0) return;
      var al = smooth(0.25, 0.9, tt);
      var C = plateCorners(k, G.slab);
      var E = [G.ex, G.ey];
      // Cares de la piràmide (degradat que s'intensifica cap a la placa)
      var g = ctx.createLinearGradient(0, E[1], 0, G.cy);
      g.addColorStop(0, rgba(P.beam, 0.02 * al));
      g.addColorStop(1, rgba(P.beam, 0.2 * al));
      ctx.fillStyle = g;
      poly(ctx, [E, C[0], C[1]]); ctx.fill();
      poly(ctx, [E, C[1], C[2]]); ctx.fill();
      ctx.fillStyle = rgba(P.beam, 0.05 * al);
      poly(ctx, [E, C[2], C[3], C[0]]); ctx.fill();
      // Arestes
      ctx.lineWidth = px;
      for (var i = 0; i < 4; i++) {
        ctx.strokeStyle = rgba(P.beam, (i === 3 ? 0.18 : 0.55) * al);
        ctx.beginPath(); ctx.moveTo(E[0], E[1]); ctx.lineTo(C[i][0], C[i][1]); ctx.stroke();
      }
      // Pla de reixeta abans que arribi la placa sòlida
      var grid = al * (1 - smooth(2.0, 2.6, tt));
      if (grid > 0) {
        var Q = plateCorners(k, 0);
        ctx.strokeStyle = rgba(P.beam, 0.22 * grid);
        for (var n = 0; n <= 8; n++) {
          var s = n / 8;
          ctx.beginPath();
          ctx.moveTo(lerp(Q[3][0], Q[2][0], s), lerp(Q[3][1], Q[2][1], s));
          ctx.lineTo(lerp(Q[0][0], Q[1][0], s), lerp(Q[0][1], Q[1][1], s));
          ctx.moveTo(lerp(Q[3][0], Q[0][0], s), lerp(Q[3][1], Q[0][1], s));
          ctx.lineTo(lerp(Q[2][0], Q[1][0], s), lerp(Q[2][1], Q[1][1], s));
          ctx.stroke();
        }
        ctx.strokeStyle = rgba(P.beam, 0.5 * grid);
        poly(ctx, Q); ctx.stroke();
      }
      // Feix vertical central
      var beam = bell(0.3, 2.6, tt);
      if (beam > 0) {
        var gb = ctx.createLinearGradient(0, E[1], 0, G.top + 0.1);
        gb.addColorStop(0, rgba(P.light, 0.7 * beam));
        gb.addColorStop(1, rgba(P.light, 0));
        ctx.strokeStyle = gb; ctx.lineWidth = px * 1.2;
        ctx.beginPath(); ctx.moveTo(E[0], E[1]); ctx.lineTo(E[0], G.top + 0.1); ctx.stroke();
      }
    }

    function drawPlate(ctx, tt) {
      var on = smooth(2.0, 2.5, tt);
      if (on <= 0) return;
      var Q = plateCorners(1, 0), Qb = plateCorners(1, G.slab);
      // Gruix de la llosa
      ctx.fillStyle = rgba(P.plate, 0.18 * on);
      poly(ctx, [Q[0], Q[1], Qb[1], Qb[0]]); ctx.fill();
      poly(ctx, [Q[1], Q[2], Qb[2], Qb[1]]); ctx.fill();
      // Cara superior
      var flash = bell(2.0, 2.9, tt);
      ctx.fillStyle = rgba(P.plate, (0.1 + 0.25 * flash) * on);
      poly(ctx, Q); ctx.fill();
      ctx.strokeStyle = rgba(P.plate, 0.18 * on); ctx.lineWidth = px * 0.8;
      for (var n = 1; n < 10; n++) {
        var s = n / 10;
        ctx.beginPath();
        ctx.moveTo(lerp(Q[3][0], Q[2][0], s), lerp(Q[3][1], Q[2][1], s));
        ctx.lineTo(lerp(Q[0][0], Q[1][0], s), lerp(Q[0][1], Q[1][1], s));
        ctx.moveTo(lerp(Q[3][0], Q[0][0], s), lerp(Q[3][1], Q[0][1], s));
        ctx.lineTo(lerp(Q[2][0], Q[1][0], s), lerp(Q[2][1], Q[1][1], s));
        ctx.stroke();
      }
      // Arestes brillants
      ctx.lineWidth = px * 1.4;
      ctx.strokeStyle = rgba(mix(P.plate, '#FFFFFF', 0.3), 0.9 * on);
      poly(ctx, Q); ctx.stroke();
      ctx.lineWidth = px;
      ctx.beginPath();
      ctx.moveTo(Qb[0][0], Qb[0][1]); ctx.lineTo(Qb[1][0], Qb[1][1]); ctx.lineTo(Qb[2][0], Qb[2][1]);
      ctx.moveTo(Q[0][0], Q[0][1]); ctx.lineTo(Qb[0][0], Qb[0][1]);
      ctx.moveTo(Q[1][0], Q[1][1]); ctx.lineTo(Qb[1][0], Qb[1][1]);
      ctx.moveTo(Q[2][0], Q[2][1]); ctx.lineTo(Qb[2][0], Qb[2][1]);
      ctx.stroke();
      // Soroll de píxels mentre s'encén
      var noise = bell(2.0, 3.0, tt);
      if (noise > 0) {
        var f = Math.floor(tt * 14);
        var sz = px * 3.2;
        for (var i = 0; i < plateNoise.length; i++) {
          var p = plateNoise[i];
          var hv = hash(i * 7.3 + f);
          if (hv > 0.62) continue;
          var q = iso(p[0], p[1], 0);
          ctx.fillStyle = rgba(hv < 0.15 ? P.light : P.build[i % 3], noise * (0.45 + 0.55 * p[2]));
          ctx.fillRect(q[0] - sz / 2, q[1] - sz / 2, sz, sz);
        }
      }
    }

    function drawParticles(ctx, tt, front) {
      if (tt < 1.1 || tt > 3.5) return;
      var fade = 1 - smooth(3.0, 3.5, tt);
      var E = [G.ex, G.ey];
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (tt < p.s) continue;
        var k = clamp((tt - p.s) / 0.95, 0, 1), e = easeOut(k);
        var T = iso(p.a, p.b, p.h);
        var swirl = Math.sin(k * Math.PI) * p.sw;
        var x = lerp(E[0], T[0], e) + swirl * Math.cos(p.ph + tt * 4);
        var y = lerp(E[1], T[1], e) - Math.sin(k * Math.PI) * 0.08;
        if (k >= 1) { x += Math.sin(tt * 3 + p.ph) * px * 1.5; y += Math.cos(tt * 2.3 + p.ph) * px; }
        var a = fade * smooth(0, 0.15, k);
        if (front !== null && y > front) a *= 0.25;
        if (a <= 0.01) continue;
        ctx.fillStyle = rgba(p.c, a * (0.6 + 0.4 * hash(i + Math.floor(tt * 10))));
        var s = px * p.z * 1.6;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }

    function domeGeom(scale) {
      var c = iso(DOME.a, DOME.b, 0), R = DOME.r * scale;
      return { x: c[0], y: c[1], R: R, ry: R * 0.42, h: R * 0.92 };
    }

    function drawDome(ctx, tt, scale) {
      var on = smooth(2.3, 2.8, tt);
      if (on <= 0) return;
      var g = domeGeom(scale * (0.4 + 0.6 * easeOut((tt - 2.3) / 0.6)));
      var pulse = 0.85 + 0.15 * Math.sin(tt * 2.2);
      // Halo a la placa
      ctx.save();
      ctx.translate(g.x, g.y); ctx.scale(1, 0.42);
      var gh = ctx.createRadialGradient(0, 0, 0, 0, 0, g.R * 2.2);
      gh.addColorStop(0, rgba(P.dome, 0.45 * on * pulse));
      gh.addColorStop(1, rgba(P.dome, 0));
      ctx.fillStyle = gh;
      ctx.beginPath(); ctx.arc(0, 0, g.R * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Cos de la cúpula
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, g.R, g.h, 0, Math.PI, 0);
      ctx.ellipse(g.x, g.y, g.R, g.ry, 0, 0, Math.PI);
      var gd = ctx.createRadialGradient(g.x, g.y - g.h * 0.3, 0, g.x, g.y, g.R * 1.1);
      gd.addColorStop(0, rgba(mix(P.dome, '#FFFFFF', 0.4), 0.55 * on));
      gd.addColorStop(1, rgba(P.dome, 0.22 * on));
      ctx.fillStyle = gd; ctx.fill();
      ctx.strokeStyle = rgba(mix(P.dome, '#FFFFFF', 0.35), 0.95 * on); ctx.lineWidth = px * 1.3;
      ctx.stroke();
      // Meridians i paral·lels
      ctx.lineWidth = px * 0.8;
      ctx.strokeStyle = rgba(P.dome, 0.55 * on);
      for (var m = 1; m <= 2; m++) {
        var rx = g.R * (1 - m * 0.33);
        ctx.beginPath(); ctx.ellipse(g.x, g.y, rx, g.h, 0, Math.PI, 0); ctx.stroke();
      }
      for (var l = 1; l <= 2; l++) {
        var yy = g.y - g.h * l * 0.33, rr = g.R * Math.sqrt(1 - Math.pow(l * 0.33, 2));
        ctx.beginPath(); ctx.ellipse(g.x, yy, rr, rr * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // Base el·líptica
      ctx.strokeStyle = rgba(P.dome, 0.8 * on);
      ctx.beginPath(); ctx.ellipse(g.x, g.y, g.R, g.ry, 0, 0, Math.PI * 2); ctx.stroke();
      // Energia interior
      for (var i = 0; i < 14; i++) {
        var ang = hash(i) * 6.28 + tt * (0.6 + hash(i + 9));
        var rad = g.R * 0.75 * hash(i + 3);
        var x = g.x + Math.cos(ang) * rad, y = g.y - g.h * 0.45 + Math.sin(ang) * rad * 0.4;
        ctx.fillStyle = rgba('#FFFFFF', 0.55 * on * hash(i + Math.floor(tt * 8)));
        ctx.fillRect(x - px, y - px, px * 2, px * 2);
      }
    }

    /* --- efectes per versió --- */

    function drawArcs(ctx, tt, n, w, g) {
      if (!n || w <= 0) return;
      var o = [g.x, g.y - g.h];
      ctx.lineWidth = px * 1.1;
      for (var i = 0; i < n && i < tops.length; i++) {
        var T = tops[(i * 2 + 1) % tops.length];
        var mx = (o[0] + T[0]) / 2, my = Math.min(o[1], T[1]) - 0.06 - 0.02 * hash(i);
        var grow = smooth(0, 0.6, tt - fxStart - i * 0.08);
        var a = w * grow * (0.55 + 0.25 * Math.sin(tt * 3 + i));
        ctx.strokeStyle = rgba(P.dome, a);
        ctx.setLineDash([px * 5, px * 4]); ctx.lineDashOffset = -tt * 0.06;
        ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.quadraticCurveTo(mx, my, T[0], T[1]); ctx.stroke();
        ctx.setLineDash([]);
        // Paquet de dades que viatja per l'arc
        var u = (tt * 0.6 + hash(i) ) % 1;
        var bx = (1 - u) * (1 - u) * o[0] + 2 * (1 - u) * u * mx + u * u * T[0];
        var by = (1 - u) * (1 - u) * o[1] + 2 * (1 - u) * u * my + u * u * T[1];
        ctx.fillStyle = rgba('#FFFFFF', a);
        ctx.beginPath(); ctx.arc(bx, by, px * 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(P.dome, a);
        ctx.beginPath(); ctx.arc(T[0], T[1], px * 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawFan(ctx, tt, n, w, g) {
      if (!n || w <= 0) return;
      var o = [g.x, g.y - g.h * 0.6];
      ctx.lineWidth = px * 0.8;
      for (var i = 0; i < n && i < fanPts.length; i++) {
        var T = fanPts[i];
        var a = w * smooth(0, 0.5, tt - fxStart - 0.2) * (0.25 + 0.3 * (0.5 + 0.5 * Math.sin(tt * 5 + i * 1.7)));
        var gl = ctx.createLinearGradient(o[0], o[1], T[0], T[1]);
        gl.addColorStop(0, rgba(mix(P.dome, '#FFFFFF', 0.4), a));
        gl.addColorStop(1, rgba(P.dome, a * 0.25));
        ctx.strokeStyle = gl;
        ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(T[0], T[1]); ctx.stroke();
      }
    }

    function drawSearch(ctx, tt, n, w, g) {
      if (!n || w <= 0) return;
      var o = [g.x, g.y - g.h];
      for (var i = 0; i < n; i++) {
        var ang = tt * (0.35 + i * 0.12) + i * 2.1;
        var tx = G.cx + Math.cos(ang) * G.pw * 0.75, ty = G.cy - 0.12 + Math.sin(ang) * 0.09;
        var dx = tx - o[0], dy = ty - o[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / len * 0.028, ny = dx / len * 0.028;
        var a = w * smooth(0, 0.8, tt - fxStart - 0.3 - i * 0.2);
        var gl = ctx.createLinearGradient(o[0], o[1], tx, ty);
        gl.addColorStop(0, rgba(mix(P.dome, '#FFFFFF', 0.5), 0.42 * a));
        gl.addColorStop(1, rgba(P.dome, 0.04 * a));
        ctx.fillStyle = gl;
        poly(ctx, [o, [tx + nx, ty + ny], [tx - nx, ty - ny]]); ctx.fill();
        ctx.strokeStyle = rgba(P.dome, 0.6 * a); ctx.lineWidth = px;
        ctx.beginPath(); ctx.ellipse(tx, ty, 0.03, 0.011, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    function drawRings(ctx, tt, n, w, g) {
      if (!n || w <= 0) return;
      var a0 = w * smooth(0, 0.6, tt - fxStart);
      ctx.lineWidth = px * 1.3;
      // Anell fix (la «línia»)
      ctx.strokeStyle = rgba(mix(P.dome, '#FFFFFF', 0.3), 0.9 * a0);
      ctx.beginPath(); ctx.ellipse(g.x, g.y, g.R * 1.55, g.R * 1.55 * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = rgba(P.dome, 0.5 * a0);
      ctx.beginPath(); ctx.ellipse(g.x, g.y, g.R * 1.75, g.R * 1.75 * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      // Ones que s'expandeixen
      for (var i = 0; i < n; i++) {
        var ph = ((tt - fxStart) * 0.45 + i / n) % 1;
        if (ph < 0) ph += 1;
        var R = g.R * (1.2 + ph * 2.6);
        ctx.strokeStyle = rgba(P.dome, a0 * (1 - ph) * 0.7);
        ctx.beginPath(); ctx.ellipse(g.x, g.y, R, R * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    function drawFx(ctx, tt, V, w, g) {
      drawSearch(ctx, tt, V.search, w, g);
      drawFan(ctx, tt, V.fan, w, g);
      drawArcs(ctx, tt, V.arcs, w, g);
      drawRings(ctx, tt, V.rings, w, g);
    }

    /* --- composició --- */

    function frame(tt) {
      var V = VERSIONS[cur], Vp = VERSIONS[prev];
      var m = smooth(0, 0.7, tt - fxStart);
      var built = tt >= T_BUILT;
      var ctx = sctx;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      unit(ctx);
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'lighter';
      drawCone(ctx, tt);
      drawPlate(ctx, tt);
      drawEmitter(ctx, tt);

      // Ciutat: es revela de baix a dalt (front en coordenades del quadrat)
      var front = null;
      if (tt >= 2.5) {
        var bottom = G.cy + G.ph + 0.01;
        front = built ? -1 : lerp(bottom, G.top - 0.05, smooth(2.5, T_BUILT, tt));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        var lk = V.look;
        var lm = lookAt < 0 ? 1 : smooth(0, 0.35, tt - lookAt);
        var cityAlpha = 1;
        var fy = oy + front * U;
        ctx.save();
        if (!built) { ctx.beginPath(); ctx.rect(0, fy, W, H - fy); ctx.clip(); }
        ctx.globalCompositeOperation = 'lighter';
        if (lm < 1 && lookPrev !== lk) {
          ctx.globalAlpha = cityAlpha * (1 - lm); ctx.drawImage(city(lookPrev), 0, 0);
        }
        ctx.globalAlpha = cityAlpha * (lookPrev !== lk ? lm : 1); ctx.drawImage(city(lk), 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;

        // Banda de píxels al front de construcció + «pluja» per sobre
        if (!built && blocks) {
          var bs = blocks.bs, f = Math.floor(tt * 16);
          var r0 = Math.max(0, Math.floor((fy - 64 * D) / bs)), r1 = Math.min(blocks.rows.length - 1, Math.floor((fy + 6 * D) / bs));
          for (var ri = r0; ri <= r1; ri++) {
            var row = blocks.rows[ri], dist = (fy - ri * bs) / D; // >0 per sobre del front
            var p = dist < -2 ? 0.25 : dist < 14 ? 0.85 : 0.22 * (1 - (dist - 14) / 50);
            var al = dist < 14 ? 0.95 : 0.6;
            for (var bi = 0; bi < row.length; bi++) {
              if (hash(ri * 131 + bi * 7 + f) > p) continue;
              ctx.fillStyle = row[bi][2];
              ctx.globalAlpha = al;
              ctx.fillRect(row[bi][0], row[bi][1], bs - 1, bs - 1);
            }
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = rgba(P.light, 0.35);
          ctx.fillRect(0, fy, W, Math.max(1, D));
        }

        // Finestres i punts de dades que parpellegen
        if (built && blocks && blocks.all.length) {
          var n = cur === 'B' ? 4 : cur === 'BB' ? 10 : cur === 'AA' || cur === 'BA' ? 14 : 8;
          var ft = Math.floor(tt * 6);
          for (var q = 0; q < n; q++) {
            var blk = blocks.all[Math.floor(hash(q * 17 + ft) * blocks.all.length)];
            ctx.fillStyle = blk[2];
            ctx.globalAlpha = 0.7 * (0.5 + 0.5 * Math.sin(tt * 9 + q));
            ctx.fillRect(blk[0], blk[1], blocks.bs - 1, blocks.bs - 1);
          }
          ctx.globalAlpha = 1;
        }

        // Pols de canvi d'estat: una banda de llum que recorre els edificis
        var pp = pulseAt >= 0 ? (tt - pulseAt) / 1.0 : -1;
        if (pp >= 0 && pp <= 1) {
          var py = oy + lerp(G.cy + G.ph * 0.4, G.top + 0.04, easeOut(pp)) * U;
          var bh = 0.03 * U;
          var pctx = pc.getContext('2d');
          pctx.setTransform(1, 0, 0, 1, 0, 0);
          pctx.globalCompositeOperation = 'copy';
          pctx.drawImage(city(lk), 0, 0);
          pctx.globalCompositeOperation = 'source-atop';
          var gp = pctx.createLinearGradient(0, py - bh, 0, py + bh);
          gp.addColorStop(0, rgba(P.light, 0));
          gp.addColorStop(0.5, rgba(P.light, 1));
          gp.addColorStop(1, rgba(P.light, 0));
          pctx.fillStyle = gp;
          pctx.fillRect(0, py - bh, W, bh * 2);
          ctx.globalAlpha = Math.sin(pp * Math.PI);
          ctx.drawImage(pc, 0, 0);
          ctx.drawImage(pc, 0, 0);
          ctx.globalAlpha = 1;
        }
      }

      unit(ctx);
      ctx.globalCompositeOperation = 'lighter';
      drawParticles(ctx, tt, front);
      var dScale = lerp(Vp.dome, V.dome, m);
      var g = domeGeom(dScale);
      if (tt >= T_FX - 0.2 || fxStart < T_FX) {
        if (prev !== cur && m < 1) drawFx(ctx, tt, Vp, 1 - m, g);
        drawFx(ctx, tt, V, m, g);
      }
      drawDome(ctx, tt, dScale);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      compose(tt);
    }

    // Glitch: talls horitzontals desplaçats + separació RGB (vermell / cian)
    function glitchAt(tt) {
      for (var i = 0; i < glitches.length; i++) {
        var gl = glitches[i];
        if (tt >= gl[0] && tt <= gl[0] + gl[1]) return Math.sin((tt - gl[0]) / gl[1] * Math.PI) * gl[2];
      }
      return 0;
    }

    function compose(tt) {
      var gI = reduceMotion ? 0 : glitchAt(tt);
      vctx.setTransform(1, 0, 0, 1, 0, 0);
      vctx.globalCompositeOperation = 'copy';
      vctx.globalAlpha = 1;
      if (gI <= 0.01) { vctx.drawImage(scene, 0, 0); return; }

      var r = rc.getContext('2d'), c = cc.getContext('2d');
      r.globalCompositeOperation = 'copy'; r.drawImage(scene, 0, 0);
      r.globalCompositeOperation = 'multiply'; r.fillStyle = '#FF0000'; r.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'copy'; c.drawImage(scene, 0, 0);
      c.globalCompositeOperation = 'multiply'; c.fillStyle = '#00FFFF'; c.fillRect(0, 0, W, H);

      vctx.fillStyle = '#000'; vctx.fillRect(0, 0, W, H);
      vctx.globalCompositeOperation = 'lighter';
      var seedF = Math.floor(tt * 24);
      var split = gI * 0.012 * W;
      var y = 0, k = 0;
      while (y < H) {
        var bh = Math.max(2, Math.round((0.01 + hash(seedF * 3.1 + k) * 0.07) * H));
        var shift = hash(seedF * 5.7 + k * 1.3) < 0.45 ? (hash(seedF + k * 9.1) - 0.5) * gI * 0.09 * W : 0;
        var drop = hash(seedF * 2.3 + k * 4.4) < 0.07 * gI;
        if (!drop) {
          var h2 = Math.min(bh, H - y);
          vctx.globalAlpha = 1 - 0.25 * gI * hash(k + seedF);
          vctx.drawImage(rc, 0, y, W, h2, shift - split, y, W, h2);
          vctx.drawImage(cc, 0, y, W, h2, shift + split, y, W, h2);
        }
        y += bh; k++;
      }
      vctx.globalAlpha = 1;
      vctx.globalCompositeOperation = 'source-over';
    }

    function loop(now) {
      if (!alive || !playing) return;
      t = (now - t0) / 1000;
      if (t >= T_BUILT && nextGlitch > 0 && t >= nextGlitch) {
        glitches.push([t, 0.18 + gr() * 0.14, 0.7 + gr() * 0.3]);
        if (glitches.length > 4) glitches.shift();
        schedule(t);
      }
      frame(t);
      raf = requestAnimationFrame(loop);
    }

    function renderStill() {
      // Moviment reduït: estat final, sense animació ni glitch
      t = 8; fxStart = T_FX; lookAt = -1; lookPrev = VERSIONS[cur].look; prev = cur; pulseAt = -1;
      frame(t);
    }

    return {
      el: el,
      play: function () {
        if (!alive) return;
        setup();
        cancelAnimationFrame(raf);
        prev = cur = baseV;
        fxStart = T_FX; pulseAt = baseV ? T_FX : -1;
        lookPrev = VERSIONS[cur].look; lookAt = -1;
        glitches = [[T_BUILT - 0.08, 0.26, 1]];
        schedule(T_BUILT);
        if (reduceMotion) { renderStill(); return; }
        playing = true;
        t0 = performance.now();
        raf = requestAnimationFrame(loop);
      },
      setChoice: function (choice) {
        var next = choice ? baseV + choice : baseV;
        if (!VERSIONS.hasOwnProperty(next) || next === cur || !alive) return;
        if (!W) setup();
        lookPrev = VERSIONS[cur].look;
        prev = cur; cur = next;
        if (reduceMotion || !playing) { renderStill(); return; }
        if (t < T_BUILT) {
          // Encara s'està construint: els efectes entraran al final de la construcció
          fxStart = T_FX; pulseAt = T_FX; lookAt = T_BUILT;
          return;
        }
        // Canvi en directe: glitch + pols i fosa creuada d'efectes
        fxStart = t + 0.12; pulseAt = t + 0.05; lookAt = t + 0.1;
        glitches.push([t, 0.3, 1]);
        if (glitches.length > 4) glitches.shift();
        schedule(t + 0.3);
      },
      destroy: function () {
        alive = false; playing = false;
        cancelAnimationFrame(raf);
        cities = {}; blocks = null;
        view.width = view.height = 1;
      }
    };
  }

  window.NexusHolo = { create: create, versions: VERSIONS, orbs: ORBS };
})();
;
/*
 * NEXUS · Holograma de la ciutat (WebGL)
 * ------------------------------------------------------------------------
 * Port de «nexus-ciudad-holograma.html» al joc. Cada versió del holograma fa
 * servir la seva escena del HTML, amb les mateixes animacions i glitches:
 *
 *   versió  vídeo del joc               escena del HTML
 *   ''      1_ciudad-sin-decisiones  →  Escena 1 · Activar NEXUS
 *   A       2_ciudad-decision-A      →  2A · Predir abans que passi
 *   B       3_ciudad-decision-B      →  2B · Qui pren les decisions?
 *   AA      4_conclusion-1           →  C1 · La ciutat que ho sap tot
 *   AB      5_conclusion-2           →  C2 · La línia vermella
 *   BA      6_conclusion-3           →  C3 · La ciutat automàtica
 *   BB      7_conclusion-4           →  C4 · El control humà
 *
 * Colors per orbe (paletes «Color» del HTML):
 *   sora → actual · nima → magenta · luah → turquesa · kylo → violeta
 *
 * Es fa servir el «mode net» del HTML (sense pols de dades ni interfície).
 * El fons és negre: el contenidor .holo es fon amb el joc (mix-blend-mode).
 *
 * API (substitueix el reproductor de vídeo del bundle):
 *   NexusHolo.create({ versions:{base:'<nom vídeo>'}, orb, rect:{x,y,w,h} })
 *     → { el, play(), setChoice('A'|'B'|null), destroy() }
 * Si no hi ha WebGL, es fa servir el holograma anterior (holo-v1.js).
 */
(function () {
  'use strict';

  var THREE = window.THREE;
  var FALLBACK = window.NexusHolo; // holo-v1.js (Canvas 2D)
  if (!THREE || !THREE.WebGLRenderer) return;

  /* =========================================================
     AJUSTOS
     ========================================================= */
  var C = { pink: '#fd8fff', violet: '#6d4aff', teal: '#1bd7c5' };
  var INTRO_DUR = 3.6;          // segons de la intro holograma
  var BLOOM = 0.4;              // resplendor
  var OCC_OPACITY = 0.8;        // opacitat del fons fosc dels edificis
  var BASE_YAW = Math.PI / 4;   // vista en diamant, com el boceto
  var BASE_ELEV = 0.42;         // inclinació de la càmera
  var CAM_DIST = 14.2;
  var P = 3.4;                  // costat de la plataforma
  var EMIT_Y = -2.75;           // alçada del projector

  var VERSION_BY_VIDEO = {
    '1_ciudad-sin-decisiones': '',
    '2_ciudad-decision-A': 'A',
    '3_ciudad-decision-B': 'B',
    '4_conclusion-1': 'AA',
    '5_conclusion-2': 'AB',
    '6_conclusion-3': 'BA',
    '7_conclusion-4': 'BB'
  };
  var SCENE_BY_VERSION = { '': 'e1', A: '2a', B: '2b', AA: 'c1', AB: 'c2', BA: 'c3', BB: 'c4' };
  var PRESET_BY_ORB = { sora: 'actual', nima: 'magenta', luah: 'turquesa', kylo: 'violeta' };

  // Variants de color de l'orbe i de la ciutat (les del HTML)
  var ORB_PRESETS = {
    actual:   { rim: '#fd8fff', top: '#6d4aff', mid: '#1bd7c5', low: '#fd8fff' },
    magenta:  { rim: '#e879f9', top: '#f3b3fc', mid: '#e879f9', low: '#b14fd6' },
    turquesa: { rim: '#1bd8c6', top: '#86eee3', mid: '#1bd8c6', low: '#0e9f92' },
    violeta:  { rim: '#6d4aff', top: '#a796ff', mid: '#6d4aff', low: '#4529d1' }
  };
  var CITY_PRESETS = {
    actual:   { pink: '#fd8fff', teal: '#1bd7c5', violet: '#6d4aff' },
    magenta:  { pink: '#e879f9', teal: '#f3b3fc', violet: '#b14fd6' },
    turquesa: { pink: '#86eee3', teal: '#1bd8c6', violet: '#0e9f92' },
    violeta:  { pink: '#a796ff', teal: '#6d4aff', violet: '#4529d1' }
  };

  var col = function (h) { return new THREE.Color(h); };
  var sstep = function (a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* =========================================================
     GLSL
     ========================================================= */
  /* ---------- Comú: aparició, pols i escaneig ---------- */
  var COMMON = /* glsl */`
  uniform float uTime, uReveal, uMaxH, uDpr, uGlow, uPulseY, uPulseI, uFlick, uHolo;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float blockN(){ return hash(floor(gl_FragCoord.xy / (6. * uDpr))); }
  float revealK(float h){ return (uReveal * (uMaxH + .7) - .35) - (h + blockN() * .35); }
  float lineAt(float v, float s, float w){ return 1. - smoothstep(0., w, abs(fract(v / s + .5) - .5) * s); }
  vec3 holoFinish(vec3 c, vec3 base, float h, float k){
    float edge = (1. - smoothstep(0., .14, k)) * uHolo;
    c += base * exp(-pow((h - uPulseY) / .07, 2.)) * uPulseI;
    float sl = fract((gl_FragCoord.y + uTime * 6.) / (3.5 * uDpr));
    c *= mix(.42, 1.08, smoothstep(.25, .55, sl) * (1. - smoothstep(.8, 1., sl)));
    c += base * edge * 1.4 + vec3(1.) * edge * blockN() * .5;
    return c * uFlick;
  }`;

  /* ---------- Façanes: 0 quadrícula · 1 franges · 2 punts · 3 bandes verticals · 4 teulada ---------- */
  var F = { GRID: 0, BANDS: 1, DOTS: 2, STRIPES: 3, ROOF: 4 };

  var boxVS = /* glsl */`
  uniform vec3 uSize; uniform float uY0;
  varying vec2 vUv; varying vec3 vN, vV, vNo; varying float vH;
  void main(){
    vUv = uv; vNo = normal; vH = position.y + uSize.y * .5 + uY0;
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    vV = mv.xyz; vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;
  var boxFS = /* glsl */`
  uniform vec3 uCol, uAcc, uThird, uSize, uTintCol, uPinkC, uTealC; uniform float uSeed, uHi, uStyle, uBH;
  uniform float uWin, uSync, uHuman, uPow, uTint, uCut, uSeen;
  varying vec2 vUv; varying vec3 vN, vV, vNo; varying float vH;
  ${COMMON}
  float rect(vec2 f, float x0, float x1, float y0, float y1){
    return smoothstep(x0 - .06, x0, f.x) * smoothstep(x1 + .06, x1, f.x) * smoothstep(y0 - .06, y0, f.y) * smoothstep(y1 + .06, y1, f.y);
  }
  void main(){
    float k = revealK(vH); if (k < 0.) discard;
    if (vH > uCut) discard;
    vec3 n = normalize(vN), v = normalize(-vV);
    float fres = 1. - abs(dot(n, v));
    float boost = 1. + uHi * .45 + uGlow * .3;
    vec3 acc = mix(uAcc, uTintCol, uTint);
    vec3 base = mix(mix(uCol, uTintCol, uTint), acc, smoothstep(0., uBH, vH) * .85);
    vec3 c = base * (.02 + .07 * pow(fres, 2.));
    float deadW = 0.;

    if (uStyle < 3.5 && abs(vNo.y) < .5) {
      float fw = abs(vNo.x) > .5 ? uSize.z : uSize.x;
      float hx = vUv.x * fw;
      vec2 cs = uStyle < .5 ? vec2(.075, .085) : uStyle < 1.5 ? vec2(.16, .09) : uStyle < 2.5 ? vec2(.042, .048) : vec2(.085, .22);
      vec2 g = vec2(hx, vH) / cs;
      vec2 cell = floor(g), f = fract(g);
      float win;
      if (uStyle < .5)       win = rect(f, .18, .82, .25, .8);
      else if (uStyle < 1.5) win = rect(f, .02, .98, .32, .74);
      else if (uStyle < 2.5) win = smoothstep(.34, .18, length(f - .5));
      else                   win = rect(f, .28, .72, .06, .94);
      float face = vNo.x * 3. + vNo.z * 7.;
      float phase = floor(uTime * .1 + hash(cell + uSeed + face) * 20.);
      float onR = step(1. - uWin, hash(cell * 1.37 + phase + uSeed + face));
      float syncP = .3 + .7 * smoothstep(.35, 1., sin(vH * 4. - uTime * 3.) * .5 + .5);
      float on = mix(onR, syncP, uSync);
      float pick = hash(cell + 7.1 + uSeed);
      vec3 wc = pick < .58 ? base : (pick < .82 ? acc : (pick < .95 ? uThird : vec3(1.)));
      wc = mix(wc, uPinkC, uSync);
      wc = mix(wc, mix(uTealC, vec3(1.), .12) * (.45 + .75 * hash(cell * 2.3 + uSeed)), uHuman);
      c += wc * win * on * .34 * boost * uPow;
      deadW = win * step(.72, hash(cell * 3.1 + uSeed + face));
      c += base * win * .025;
      c += base * (lineAt(hx, .045, .003) * .035 + lineAt(vH, .17, .004) * .05);
      c += base * (1. - smoothstep(0., .03, min(vUv.x, 1. - vUv.x))) * .08;
    } else {
      vec2 f = fract(vUv * 4.);
      c += base * (.03 + (1. - smoothstep(0., .07, min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)))) * .1);
    }
    float off = 1. - uPow;
    c = mix(c, vec3(dot(c, vec3(.3, .4, .3))) * .8, off * .6);
    c *= (1. + .3 * smoothstep(.6, 0., vH)) * boost * mix(.22, 1., uPow);
    c += mix(base, vec3(dot(base, vec3(.3, .4, .3))), .7) * deadW * .04 * off * boost;
    c += base * exp(-pow((vH - uCut) / .03, 2.)) * 1.2;
    c += uPinkC * uSeen * (.06 + exp(-pow((vH - fract(uTime * .6) * uBH) / .025, 2.)) * .9);
    gl_FragColor = vec4(holoFinish(c, base, vH, k), 1.);
  }`;

  var lineVS = /* glsl */`
  uniform vec3 uSize; uniform float uY0; varying float vH;
  void main(){ vH = position.y + uSize.y * .5 + uY0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
  var lineFS = /* glsl */`
  uniform vec3 uCol, uAcc, uTintCol; uniform float uHi, uBright, uBH, uPow, uTint, uCut; varying float vH;
  ${COMMON}
  void main(){
    float k = revealK(vH); if (k < 0.) discard;
    if (vH > uCut) discard;
    vec3 base = mix(mix(uCol, uTintCol, uTint), mix(uAcc, uTintCol, uTint), smoothstep(0., uBH, vH) * .85);
    vec3 c = base * uBright * (1. + uHi * .6 + uGlow * .3) * (1. + .3 * smoothstep(.5, 0., vH)) * mix(.3, 1., uPow);
    c = mix(c, vec3(dot(c, vec3(.3, .4, .3))) * .8, (1. - uPow) * .6);
    gl_FragColor = vec4(holoFinish(c, base, vH, k), 1.);
  }`;
  // Farciment opac fosc: tapa el que hi ha darrere (els edificis ja no es barregen)
  var occFS = /* glsl */`
  uniform vec3 uBg, uTintO; uniform float uOp, uCut; varying float vH;
  ${COMMON}
  void main(){ if (revealK(vH) < 0.) discard; if (vH > uCut) discard; gl_FragColor = vec4(mix(uBg, uTintO, .05), uOp); }`;

  /* ---------- Ones de seda interiors de l'orbe ---------- */
  var ribbonVS = /* glsl */`
  uniform float uRT, uAmp, uThick, uPhase, uOff, uW, uBump, uBumpC, uBumpS, uBaseY, uScaleY;
  varying vec2 vUv; varying float vEnv; varying float vShade; varying float vH;
  void main(){
    float u = uv.x; float vv = uv.y - .5;
    float env = pow(sin(3.14159265*u), .85);
    float t = uRT + uPhase;
    float x = (u*2. - 1.) * .96;
    float bump = uBump * exp(-pow((u - uBumpC)/uBumpS, 2.));
    float wave = (sin(u*7.54 + t)*.07 + sin(u*16.34 - t*1.35)*.035) * uAmp;
    float cy = env*(uOff + wave) + bump*env;
    float cz = env * sin(u*4.2 + t*.7) * .32 * uAmp;
    float tw = sin(u*3.4 + t*.55) * uAmp + .3;
    float w = vv * uW * uThick * env;
    vec3 p = vec3(x, cy + w*cos(tw), cz + w*sin(tw));
    vUv = uv; vEnv = env; vShade = cos(tw); vH = uBaseY + p.y * uScaleY;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  }`;
  var ribbonFS = /* glsl */`
  uniform vec3 uA, uB, uThreadCol; uniform float uOp, uThreads, uKick, uRT, uOrbI;
  varying vec2 vUv; varying float vEnv; varying float vShade; varying float vH;
  ${COMMON}
  void main(){
    if (vH < .01) discard;
    float k = revealK(vH); if (k < 0.) discard;
    float across = abs(vUv.y - .5) * 2.;
    float body = smoothstep(1., .2, across);
    float silk = .75 + .25*abs(vShade);
    float th = sin(vUv.y*46. + sin(vUv.x*7. + uRT*.8)*2.5) * .5 + .5;
    th = smoothstep(.965, 1., th) * uThreads;
    vec3 c = mix(uA, uB, smoothstep(.12, .55, vUv.x));
    c = c*silk + uThreadCol*th*.5;
    float ends = smoothstep(0., .32, vEnv);
    float a = (body*.82 + th*.35) * ends * uOp;
    c *= a * .8 * (1. + uGlow * .5 + uKick * 1.2) * uOrbI;
    gl_FragColor = vec4(holoFinish(c, uA, vH, k), 1.);
  }`;
  var RIBBONS = [
    { ca: 'top', cb: 'top', off: 0.17,  w: 0.34, bump: 0.13,  bc: 0.56, bs: 0.18, ph: 0.0, op: 0.85 },
    { ca: 'top', cb: 'top', off: 0.27,  w: 0.06, bump: 0.18,  bc: 0.50, bs: 0.20, ph: 1.2, op: 0.70 },
    { ca: 'low', cb: 'low', off: -0.06, w: 0.30, bump: -0.36, bc: 0.36, bs: 0.11, ph: 3.1, op: 0.85 },
    { ca: 'low', cb: 'low', off: -0.10, w: 0.22, bump: -0.12, bc: 0.64, bs: 0.15, ph: 4.0, op: 0.70 },
    { ca: 'top', cb: 'mid', off: 0.01,  w: 0.28, bump: 0.05,  bc: 0.60, bs: 0.20, ph: 2.0, op: 0.95 },
    { ca: 'mid', cb: 'mid', off: -0.03, w: 0.08, bump: 0,     bc: 0.50, bs: 0.20, ph: 5.0, op: 0.80 },
    { ca: 'top', cb: 'low', off: -0.19, w: 0.08, bump: -0.08, bc: 0.50, bs: 0.20, ph: 6.0, op: 0.50 }
  ];

  /* ---------- Cúpula de vidre amb aro i brillantors ---------- */
  var glassVS = /* glsl */`
    varying vec3 vN, vV; varying float vH; varying vec2 vUv;
    void main(){
      vUv = uv; vH = position.y;
      vec4 mv = modelViewMatrix * vec4(position, 1.);
      vV = mv.xyz; vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * mv;
    }`;
  var glassFS = /* glsl */`
    uniform vec3 uRim, uGlint; uniform float uHi, uKick, uOrbI;
    varying vec3 vN, vV; varying float vH; varying vec2 vUv;
    ${COMMON}
    float arc(float r, float ang, float rc, float w, float a0, float a1){
      return exp(-pow((r - rc)/w, 2.)) * smoothstep(a0, a0 + .3, ang) * (1. - smoothstep(a1 - .3, a1, ang));
    }
    void main(){
      if (vH < .002) discard;
      float k = revealK(vH); if (k < 0.) discard;
      vec3 n = normalize(vN); vec3 v = normalize(-vV);
      float fres = 1. - clamp(abs(dot(n, v)), 0., 1.);
      float lower = smoothstep(.5, -.9, n.y);
      vec3 c = uRim * (.006 + .02 * lower);
      float rimB = mix(.65, 1.35, lower) * (1. + uGlow + uHi * .4 + uKick);
      c += uRim * pow(smoothstep(.25, 1., fres), 1.9) * rimB * .5;
      c += uGlint * pow(fres, 9.) * .06 * rimB;
      float ang = atan(n.y, n.x); float r = length(n.xy);
      float hi = arc(r, ang, .83, .03, 1.55, 2.85) * .55 + arc(r, ang, .72, .025, 1.2, 2.2) * .6 + arc(r, ang, .88, .02, -1.35, -.35) * .5;
      vec3 L = normalize(vec3(-.55, .65, .6));
      float spec = pow(max(dot(reflect(-L, n), v), 0.), 40.);
      c += uGlint * (hi * .35 + spec * .15);
      vec2 f = fract(vec2(vUv.x * 110., vUv.y * 55.)) - .5;
      c += uRim * smoothstep(.4, .15, length(f)) * .025;
      gl_FragColor = vec4(holoFinish(c * uOrbI, uRim, vH, k), 1.);
    }`;

  var tipVS = /* glsl */`
    attribute float aSeed; uniform float uTime, uDpr; varying float vH, vB;
    void main(){
      vH = position.y; vB = step(.55, fract(uTime * .5 + aSeed));
      gl_PointSize = 6. * uDpr;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    }`;
  var tipFS = /* glsl */`
    uniform vec3 uCol; varying float vH, vB;
    ${COMMON}
    void main(){
      if (revealK(vH) < 0.) discard;
      float a = smoothstep(.5, 0., length(gl_PointCoord - .5));
      gl_FragColor = vec4(uCol * a * (.2 + vB * .7) * uFlick, 1.);
    }`;

  var arcVS = /* glsl */`
    attribute float aT, aSeed; attribute vec3 aOrig; varying float vT, vS, vH, vD;
    void main(){ vT = aT; vS = aSeed; vH = position.y; vD = length(position.xz - aOrig.xz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
  var arcFS = /* glsl */`
    uniform vec3 uCol; uniform float uNetA, uNetR3; varying float vT, vS, vH, vD;
    ${COMMON}
    void main(){
      if (uNetA < .002) discard;
      float k = revealK(vH); if (k < 0.) discard;
      float grow = smoothstep(vT - .04, vT, uNetA);
      float pulse = smoothstep(.88, 1., fract(vT * 2.2 - uTime * .55 + vS));
      float ends = smoothstep(0., .06, vT);
      float lim = 1. - smoothstep(uNetR3 - .03, uNetR3, vD);
      float land = exp(-pow((vT - 1.) / .03, 2.)) * 1.5;
      vec3 c = uCol * (.24 + pulse * 1.2 + land) * ends * grow * lim * .85;
      gl_FragColor = vec4(holoFinish(c, uCol, vH, k), 1.);
    }`;

  var scanVS = /* glsl */`
    varying float vAlong, vH; varying vec3 vN, vV;
    void main(){ vAlong = -position.y; vec4 w = modelMatrix * vec4(position, 1.); vH = w.y;
      vec4 mv = viewMatrix * w; vV = mv.xyz; vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * mv; }`;
  var scanFS = /* glsl */`
    uniform vec3 uCol; uniform float uScan; varying float vAlong, vH; varying vec3 vN, vV;
    ${COMMON}
    void main(){
      if (uScan < .002) discard;
      float edge = pow(1. - abs(dot(normalize(vN), normalize(-vV))), 2.);
      float rings = smoothstep(.8, 1., sin(vAlong * 40. - uTime * 6.) * .5 + .5);
      vec3 c = uCol * ((.05 + edge * .35) * (1. - vAlong * .55) + rings * .05) * uScan;
      gl_FragColor = vec4(c * uFlick, 1.);
    }`;

  var wallVS = 'varying vec2 vUv; varying float vH; void main(){ vUv = uv; vH = position.y + .14; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
  var wallFS = /* glsl */`
    uniform vec3 uCol; uniform float uPerim; varying vec2 vUv; varying float vH;
    ${COMMON}
    void main(){
      if (uPerim < .002) discard;
      float k = revealK(vH); if (k < 0.) discard;
      float y = vUv.y;
      float dash = step(.45, fract(vUv.x * 64. - uTime * .25));
      vec3 c = uCol * (pow(1. - y, 2.2) * .32 + exp(-pow((y - .98) / .02, 2.)) * .5 + dash * (1. - y) * .07) * uPerim;
      gl_FragColor = vec4(holoFinish(c, uCol, vH, k), 1.);
    }`;

  var uvVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
  var platFS = /* glsl */`
    uniform vec3 uCol, uEdge, uData; uniform float uP; uniform vec4 uFoot[16]; uniform vec3 uFootC[16]; uniform vec3 uDome;
    uniform float uNet, uNetR, uTraffic, uGridPink, uFloorData, uScan, uPerim; uniform vec2 uSpot[3]; uniform vec3 uOrbRim;
    varying vec2 vUv;
    ${COMMON}
    float grid(vec2 p, float s, float w){ vec2 f = abs(fract(p / s - .5) - .5) * s; return 1. - smoothstep(0., w, min(f.x, f.y)); }
    vec2 seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0., 1.); return vec2(length(pa - ba * h), h * length(ba)); }
    float lane(float across, float along, float row, float dir){
      float onL = 1. - smoothstep(0., .012, abs(fract(across / .425 + .5) - .5) * .425);
      float d = fract(along * 1.1 - uTime * .45 * dir + hash(vec2(row, dir)));
      return onL * smoothstep(.07, 0., abs(d - .5));
    }
    void main(){
      float k = revealK(0.); if (k < 0.) discard;
      vec2 p = (vUv - .5) * uP;
      float d = uP * .5 - max(abs(p.x), abs(p.y));
      float major = grid(p, .85, .01);
      vec3 gcol = mix(uCol, uData, uGridPink);
      vec3 c = gcol * (grid(p, .17, .006) * .07 + major * .16) + mix(uEdge, uCol, .35) * exp(-d * 26.) * .5 + uEdge * .014;
      c += uData * major * smoothstep(.97, 1., sin((p.x + p.y) * 4. - uTime * 3.) * .5 + .5) * .35 * uFloorData;

      if (uTraffic > .001) {
        float ry = floor(p.y / .425 + .5), rx = floor(p.x / .425 + .5);
        float tr = lane(p.y, p.x, ry, mod(ry, 2.) < .5 ? 1. : -1.) + lane(p.x, p.y, rx + 7., mod(rx, 2.) < .5 ? -1. : 1.);
        c += mix(uCol, vec3(1.), .35) * tr * .55 * uTraffic;
      }

      if (uPerim > .001) {
        float rr = length(p - uDome.xy);
        c += uData * (exp(-abs(rr - uNetR) * 70.) * 1.1 + (1. - smoothstep(uNetR - .01, uNetR, rr)) * .05) * uPerim;
      }

      if (uScan > .001) for (int i = 0; i < 3; i++) {
        float ds = length(p - uSpot[i]);
        c += uData * ((1. - smoothstep(.26, .3, ds)) * .1 + exp(-abs(ds - .3) * 90.) * .7 + exp(-abs(ds - fract(uTime * .8) * .3) * 120.) * .3) * uScan;
      }

      if (uNet > .001) {
        vec2 D = uDome.xy; float rD = length(p - D);
        float net = 0.;
        for (int i = 0; i < 16; i++) {
          vec4 f = uFoot[i];
          if (f.z <= 0.) continue;
          vec2 M = mod(float(i), 2.) < .5 ? vec2(f.x, D.y) : vec2(D.x, f.y);
          vec2 a = seg(p, D, M), b = seg(p, M, f.xy);
          float s1 = length(M - D);
          vec2 q = a.x < b.x ? a : vec2(b.x, s1 + b.y);
          float line = 1. - smoothstep(.006, .02, q.x);
          float pulse = smoothstep(.82, 1., fract(q.y * 1.3 - uTime * .7 + float(i) * .137));
          net = max(net, line * (.3 + pulse * 1.3) + exp(-q.x * 55.) * .12);
          vec2 qq = abs(p - f.xy) - f.zw * .5 - .03;
          net = max(net, (1. - smoothstep(0., .01, abs(max(qq.x, qq.y)))) * .6);
        }
        float mask = (1. - smoothstep(uNetR - .02, uNetR, rD)) * smoothstep(uDome.z * .92, uDome.z * 1.05, rD);
        c += uData * net * mask * (.9 + uPerim * .6) * uNet;
      }
      for (int i = 0; i < 16; i++) {
        vec4 f = uFoot[i];
        if (f.z <= 0.) continue;
        vec2 q = abs(p - f.xy) - f.zw * .5;
        c += uFootC[i] * exp(-length(max(q, 0.)) * 18.) * .1;
      }
      c += uOrbRim * exp(-max(length(p - uDome.xy) - uDome.z, 0.) * 16.) * .14;
      gl_FragColor = vec4(holoFinish(c, uCol, 0., k), 1.);
    }`;

  var emitFS = /* glsl */`
    uniform vec3 uCol, uCol2; uniform float uI, uTime; varying vec2 vUv;
    float ring(float r, float c, float w){ return exp(-pow((r - c) / w, 2.)); }
    void main(){
      vec2 p = vUv - .5; float r = length(p) * 2.; float a = atan(p.y, p.x) / 6.2832 + .5;
      float s1 = step(.35, fract(a * 18. + uTime * .04));
      vec3 c = uCol * ring(r, .35, .02) * .28
             + uCol2 * ring(r, .7, .04) * s1 * .25;
      c += mix(uCol, vec3(1.), .22) * (exp(-r * 10.) * 1.1 + exp(-r * 3.) * .12);
      c *= 1. - smoothstep(.92, 1., r);
      gl_FragColor = vec4(c * uI, 1.);
    }`;
  var beamFS = /* glsl */`
    uniform vec3 uCol, uCol2; uniform float uI, uTime; varying vec2 vUv;
    void main(){
      float up = vUv.y;
      float fade = pow(1. - up, 1.4) * .9 + .1;
      float data = smoothstep(.85, 1., sin(up * 30. - uTime * 5.) * .5 + .5);
      float streak = smoothstep(.7, 1., sin(vUv.x * 90.) * .5 + .5);
      vec3 base = mix(uCol, uCol2, up);
      vec3 c = base * (.04 + .05 * streak + .04 * data) * fade;
      gl_FragColor = vec4(c * uI, 1.);
    }`;
  var partVS = /* glsl */`
    attribute vec3 aStart, aTarget, aColor; attribute float aDelay;
    uniform float uProg, uFade, uSize, uDpr;
    varying vec3 vC; varying float vA;
    void main(){
      float e = clamp((uProg - aDelay * .45) / .55, 0., 1.);
      e = e * e * (3. - 2. * e);
      vec3 p = mix(aStart, aTarget, e);
      float ang = (1. - e) * 4.;
      p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
      vC = aColor; vA = (.35 + .65 * e) * uFade;
      gl_PointSize = uSize * uDpr;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }`;
  var partFS = 'varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC * .4 * vA, 1.); }';

  var GLITCH_SHADER = {
    uniforms: { tDiffuse: { value: null }, uG: { value: 0 }, uSeed: { value: 0 }, uL: { value: null }, uF: { value: null }, uR: { value: null } },
    vertexShader: uvVS,
    fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uG, uSeed; uniform vec2 uL, uF, uR; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      // només afecta el que es projecta: per sobre de la vora inferior de la plataforma
      float yb = vUv.x < uF.x
        ? mix(uL.y, uF.y, clamp((vUv.x - uL.x) / max(uF.x - uL.x, 1e-4), 0., 1.))
        : mix(uF.y, uR.y, clamp((vUv.x - uF.x) / max(uR.x - uF.x, 1e-4), 0., 1.));
      float gm = uG * smoothstep(yb - .004, yb + .012, vUv.y);
      gm *= smoothstep(uL.x - .03, uL.x + .01, vUv.x) * smoothstep(uR.x + .03, uR.x - .01, vUv.x);
      float band = floor(uv.y * 28.);
      float r = hash(vec2(band, uSeed));
      uv.x += (r - .5) * .08 * gm * step(.62, r);
      float fine = hash(vec2(floor(uv.y * 160.), uSeed + 3.));
      uv.x += (fine - .5) * .006 * gm;
      float sp = .007 * gm;
      vec3 c = vec3(texture2D(tDiffuse, uv + vec2(sp, 0.)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(sp, 0.)).b);
      c *= 1. - gm * .35 * step(.7, hash(vec2(band * .37, uSeed + 9.)));
      gl_FragColor = vec4(c, 1.);
    }`
  };

  /* =========================================================
     CIUTAT — estructures del boceto
     sx = esquerra/dreta en pantalla · sd = profunditat (+ davant)
     a = color de la base · b = color cap al remat
     ========================================================= */
  var BUILDINGS = [
    // fila del darrere (més violeta: dona profunditat)
    { sx: 0.00, sd: -0.75, w: 0.50, d: 0.50, a: 'violet', b: 'teal',   tiers: [{ h: 2.9, slant: 0.42, face: F.BANDS }] },
    { sx: 0.50, sd: -0.35, w: 0.30, d: 0.30, a: 'teal',   b: 'pink',   tiers: [{ h: 2.0, face: F.BANDS }, { h: 0.14, s: 0.72 }] },
    { sx: 1.00, sd: -0.65, w: 0.36, d: 0.36, a: 'violet', b: 'pink',   tiers: [{ h: 2.25, top: 1.18, face: F.DOTS }, { h: 0.1, s: 1.24 }] },
    { sx: 1.45, sd: -0.28, w: 0.50, d: 0.50, a: 'violet', b: 'pink',   tiers: [{ h: 1.0 }, { h: 0.45, s: 0.8 }, { h: 0.35, s: 0.62 }, { h: 0.25, s: 0.45 }], antennas: 0.3 },
    { sx: -0.75, sd: -0.55, w: 0.48, d: 0.48, a: 'teal',  b: 'violet', tiers: [{ h: 1.75 }, { h: 0.32, top: 0.45, face: F.ROOF }], spire: 0.15 },
    { sx: -0.25, sd: -0.30, w: 0.34, d: 0.34, a: 'violet', b: 'teal',  tiers: [{ h: 1.55, face: F.STRIPES }], roof: 0.35, spire: 0.2 },
    { sx: -1.35, sd: -0.25, w: 0.34, d: 0.34, a: 'teal',  b: 'violet', tiers: [{ h: 1.45 }], roof: 0.28, spire: 0.25 },
    // fila del mig
    { sx: -0.05, sd: 0.18, w: 0.26, d: 0.26, a: 'pink',   b: 'violet', tiers: [{ h: 1.45, face: F.BANDS }, { h: 0.14, s: 0.75 }] },
    { sx: 0.45, sd: 0.18, w: 0.40, d: 0.40, a: 'teal',    b: 'violet', tiers: [{ h: 1.35 }, { h: 0.1, s: 0.85 }] },
    // fila del davant (més turquesa: es llegeix primer)
    { sx: -0.65, sd: 0.45, w: 0.55, d: 0.50, a: 'teal',   b: 'pink',   tiers: [{ h: 1.3, face: F.STRIPES }] },
    { sx: -1.35, sd: 0.50, w: 0.45, d: 0.45, a: 'violet', b: 'teal',   tiers: [{ h: 0.55 }] },
    { sx: 1.02, sd: 0.52, w: 0.42, d: 0.42, a: 'teal',    b: 'violet', tiers: [{ h: 1.15 }] },
    { sx: 1.65, sd: 0.40, w: 0.32, d: 0.32, a: 'violet',  b: 'teal',   tiers: [{ h: 0.9 }] }
  ];
  var DOME = { sx: 0.15, sd: 1.05, r: 0.5 };   // orbe NEXUS partit pel terra
  var toP = function (sx, sd) { return [0.7071 * (sx - sd), 0.7071 * (sx + sd)]; };
  var SPHERE_ID = 100;

  /* =========================================================
     ESCENES DEL JOC
     Cada escena dona uns valors; la ciutat s'hi transforma suaument.
     ========================================================= */
  var BASE = {
    win: 0.2, sync: 0, human: 0, tintCol: C.teal,
    dome: 1, orbI: 1,
    net: 0, netR: 9, arcs: 0,
    traffic: 0, gridPink: 0, floorData: 1,
    perim: 0, scan: 0,
    beam: 1, unstable: 0,
    glitch: [5, 8],
    pow: function () { return 1; }, tint: function () { return 0; }, delay: function () { return 0; }, flick: function () { return false; }
  };
  var SCENES = {
    e1: {},
    // 2A · NEXUS té totes les dades: xarxa a cada edifici, més activitat i mobilitat
    '2a': { win: 0.38, dome: 1.15, orbI: 1.15, net: 1, arcs: 1, traffic: 1, floorData: 1.3 },
    // 2B · crisi energètica: mitja ciutat a les fosques, parpelleigs i holograma inestable
    '2b': { dome: 0.78, orbI: 0.5, floorData: 0.25, beam: 0.55, unstable: 1, glitch: [2.2, 3.5],
      pow: function (i, b) { return b.sx < -0.1 ? 0.04 : 0.6; },
      flick: function (i, b) { return b.sx >= -0.1; } },
    // C1 · vigilància total: feixos que escombren la ciutat, xarxa completa, tot encès i estable
    c1: { win: 0.55, dome: 1.35, orbI: 1.3, net: 1, arcs: 1, traffic: 0.6, gridPink: 0.65, floorData: 1.6, scan: 1, glitch: null },
    // C2 · límit: NEXUS queda dins d'un perímetre; fora, la ciutat és lliure i humana
    c2: { win: 0.32, net: 1, netR: 0.72, perim: 1, traffic: 0.6, human: 0.55, tintCol: C.teal,
      tint: function () { return 0.35; } },
    // C3 · NEXUS resol la crisi: la llum torna de cop, tot sincronitzat i la cúpula creix
    c3: { win: 1, sync: 1, tintCol: C.pink, tint: function () { return 0.3; }, dome: 1.45, orbI: 1.4, net: 1, arcs: 1, traffic: 1,
      gridPink: 0.45, floorData: 1.8, glitch: null,
      startPow: function (i, b) { return b.sx < -0.1 ? 0.04 : 0.5; } },
    // C4 · control humà: la llum torna a poc a poc, edifici a edifici; NEXUS en segon pla
    c4: { win: 0.3, human: 1, tintCol: C.teal, tint: function () { return 0.4; }, dome: 0.72, orbI: 0.55, traffic: 0.3, floorData: 0.5,
      startPow: function (i, b) { return b.sx < -0.1 ? 0.04 : 0.5; },
      pow: function (i) { return i === 1 || i === 10 ? 0.12 : 1; },
      delay: function (i) { return 0.6 + ((i * 7) % 13) * 0.55; } }
  };
  var NUMERIC = Object.keys(BASE).filter(function (k) { return typeof BASE[k] === 'number'; });
  function sceneState(id) { return Object.assign({}, BASE, SCENES[id] || {}); }

  /* =========================================================
     RENDERER COMPARTIT (un sol context WebGL per a tots els hologrames)
     ========================================================= */
  var GL = null, glFailed = false;
  function gl() {
    if (GL || glFailed) return GL;
    try {
      var r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      r.toneMapping = THREE.NoToneMapping;
      r.setPixelRatio(1);
      var composer = new THREE.EffectComposer(r);
      composer.setPixelRatio(1);
      var rp = new THREE.RenderPass(null, null);
      composer.addPass(rp);
      var bloom = new THREE.UnrealBloomPass(new THREE.Vector2(4, 4), BLOOM, 0.4, 0.22);
      composer.addPass(bloom);
      var glitchPass = new THREE.ShaderPass(GLITCH_SHADER);
      glitchPass.uniforms.uL.value = new THREE.Vector2();
      glitchPass.uniforms.uF.value = new THREE.Vector2();
      glitchPass.uniforms.uR.value = new THREE.Vector2();
      composer.addPass(glitchPass);
      composer.addPass(new THREE.OutputPass());
      GL = { r: r, composer: composer, rp: rp, bloom: bloom, glitchPass: glitchPass, w: 0, h: 0 };
    } catch (e) {
      glFailed = true;
      GL = null;
    }
    return GL;
  }
  function sizeGL(w, h) {
    if (GL.w === w && GL.h === h) return;
    GL.w = w; GL.h = h;
    GL.r.setSize(w, h, false);
    GL.composer.setSize(w, h);
  }

  /* =========================================================
     HOLOGRAMA
     ========================================================= */
  function create(opts) {
    if (!gl()) return FALLBACK ? FALLBACK.create(opts) : null;

    var rect = opts.rect;
    var baseV = VERSION_BY_VIDEO[(opts.versions && opts.versions.base) || ''] || '';
    var preset = PRESET_BY_ORB[opts.orb] || 'actual';

    var el = document.createElement('div');
    el.className = 'holo is-ready';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:absolute;left:' + rect.x + 'px;top:' + rect.y + 'px;width:' + rect.w + 'px;height:' + rect.h + 'px;';
    var view = document.createElement('canvas');
    view.width = view.height = 1;
    view.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    el.appendChild(view);
    var vctx = view.getContext('2d');

    /* ---------- Paleta de l'orbe triada ---------- */
    var cp = CITY_PRESETS[preset], op = ORB_PRESETS[preset];
    var PAL = { pink: col(cp.pink), violet: col(cp.violet), teal: col(cp.teal) };
    var third = function (a, b) { return Object.keys(PAL).filter(function (k) { return k !== a && k !== b; })[0] || 'pink'; };
    var orbPal = { rim: col(op.rim), top: col(op.top), mid: col(op.mid), low: col(op.low), glint: new THREE.Color('#ffffff') };
    var bgLin = new THREE.Color('#000000');

    /* ---------- Escena ---------- */
    var scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000');
    var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
    var camTarget = new THREE.Vector3(0, 0.25, 0);
    var elev = BASE_ELEV;

    var holo = new THREE.Group();
    var city = new THREE.Group();
    holo.add(city); scene.add(holo);
    holo.rotation.y = BASE_YAW;

    var shared = {
      uTime: { value: 0 }, uReveal: { value: 1 }, uMaxH: { value: 3 }, uDpr: { value: 1 },
      uGlow: { value: 0 }, uPulseY: { value: -9 }, uPulseI: { value: 0 }, uFlick: { value: 1 }, uHolo: { value: 0 },
      uWin: { value: 0.2 }, uSync: { value: 0 }, uHuman: { value: 0 },
      uTintCol: { value: PAL.teal.clone() }, uPinkC: { value: PAL.pink.clone() }, uTealC: { value: PAL.teal.clone() }
    };
    var ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    var withShared = function (u) { return Object.assign({}, shared, u); };

    var newBU = function () { return { uPow: { value: 1 }, uTint: { value: 0 }, uCut: { value: 99 }, uSeen: { value: 0 } }; };
    var BU = [];
    var boxMat = function (a, b, t, bh, size, y0, seed, style, bu) {
      return new THREE.ShaderMaterial(Object.assign({}, ADD, {
        vertexShader: boxVS, fragmentShader: boxFS,
        uniforms: withShared(Object.assign({}, bu || newBU(), { uCol: { value: a }, uAcc: { value: b }, uThird: { value: t }, uBH: { value: bh }, uSize: { value: size }, uY0: { value: y0 }, uSeed: { value: seed }, uStyle: { value: style }, uHi: { value: 0 } }))
      }));
    };
    var lineMat = function (a, b, bh, size, y0, bright, bu) {
      return new THREE.ShaderMaterial(Object.assign({}, ADD, {
        vertexShader: lineVS, fragmentShader: lineFS,
        uniforms: withShared(Object.assign({}, bu || newBU(), { uCol: { value: a }, uAcc: { value: b }, uBH: { value: bh }, uSize: { value: size }, uY0: { value: y0 }, uBright: { value: bright }, uHi: { value: 0 } }))
      }));
    };
    var occMat = function (tint, size, y0, bu) {
      return new THREE.ShaderMaterial({
        vertexShader: lineVS, fragmentShader: occFS, transparent: true, depthWrite: true,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
        uniforms: withShared(Object.assign({}, bu || newBU(), { uOp: { value: OCC_OPACITY }, uBg: { value: bgLin }, uTintO: { value: tint }, uSize: { value: size }, uY0: { value: y0 } }))
      });
    };

    /* ---------- Edificis ---------- */
    var hitList = [], hiMats = [], surf = [], tips = [], feet = [];
    var maxH = 0;

    function prismGeo(w, h, d, top, slant) {
      top = top || 1; slant = slant || 0;
      var g = new THREE.BoxGeometry(w, h, d);
      var a = g.attributes.position;
      for (var i = 0; i < a.count; i++) {
        if (a.getY(i) > 0) {
          var x = a.getX(i), z = a.getZ(i);
          a.setX(i, x * top); a.setZ(i, z * top); a.setY(i, a.getY(i) + slant * (x / w));
        }
      }
      g.computeVertexNormals();
      return g;
    }
    function addPiece(geo, x, z, size, y0, cA, cB, cT, bh, bid, seed, style, hit) {
      var bu = BU[bid] || (BU[bid] = newBU());
      var pos = new THREE.Vector3(x, y0 + size.y / 2, z);
      var o = new THREE.Mesh(geo, occMat(cA, size, y0, bu)); o.position.copy(pos); city.add(o);
      var m = new THREE.Mesh(geo, boxMat(cA, cB, cT, bh, size, y0, seed, style, bu));
      m.position.copy(pos); m.userData.bid = bid;
      city.add(m); if (hit !== false) hitList.push(m); hiMats.push({ bid: bid, mat: m.material });
      var e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(cA, cB, bh, size, y0, 0.6, bu));
      e.position.copy(pos); city.add(e); hiMats.push({ bid: bid, mat: e.material });
    }
    function addLine(x, z, y0, len, color, bid) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, len, 0], 3));
      var l = new THREE.LineSegments(g, lineMat(color, color, 1, new THREE.Vector3(), y0, 0.8, BU[bid] || (BU[bid] = newBU())));
      l.position.set(x, y0, z); city.add(l); hiMats.push({ bid: bid, mat: l.material });
      tips.push([x, y0 + len, z]);
    }

    BUILDINGS.forEach(function (b, bid) {
      var xz = toP(b.sx, b.sd), x = xz[0], z = xz[1];
      var cA = PAL[b.a], cB = PAL[b.b], cT = PAL[third(b.a, b.b)];
      var bh = b.tiers.reduce(function (s, t) { return s + t.h; }, 0) + (b.roof || 0);
      var y = 0, lw = b.w, ld = b.d, top = 0;
      b.tiers.forEach(function (t, i) {
        var tw = b.w * (t.s || 1), td = b.d * (t.s || 1);
        var face = t.face != null ? t.face : F.GRID;
        var geo = prismGeo(tw, t.h, td, t.top || 1, t.slant || 0);
        var isCap = face === F.ROOF;
        addPiece(geo, x, z, new THREE.Vector3(tw, t.h, td), y, isCap ? cB : cA, cB, cT, bh, bid, (bid * 7 + i) * 0.37, face);
        surf.push({ x: x, z: z, w: tw, d: td, h: t.h, y: y, color: i === 0 ? cA : cB });
        y += t.h; lw = tw * (t.top || 1); ld = td * (t.top || 1);
        top = y + (t.slant || 0) / 2;
      });
      if (b.roof) {
        var geo = new THREE.ConeGeometry(lw * 0.7071, b.roof, 4, 1, true).rotateY(Math.PI / 4);
        addPiece(geo, x, z, new THREE.Vector3(lw, b.roof, ld), y, PAL.pink, PAL.pink, cT, bh, bid, bid * 3.1, F.ROOF);
        y += b.roof; top = y;
      }
      if (b.spire) { addLine(x, z, top, b.spire, PAL.pink, bid); top += b.spire; }
      if (b.antennas) {
        [[-0.3, -0.3, 1], [0.3, 0.25, 0.7], [0.05, 0.35, 0.5]].forEach(function (q) { addLine(x + q[0] * lw, z + q[1] * ld, top, b.antennas * q[2], PAL.pink, bid); });
        top += b.antennas;
      }
      feet.push({ x: x, z: z, w: b.w, d: b.d, color: cA, top: top });
      maxH = Math.max(maxH, top);
    });
    shared.uMaxH.value = maxH;

    /* ---------- Orbe NEXUS partit pel terra ---------- */
    var SXZ = toP(DOME.sx, DOME.sd), SX = SXZ[0], SZ = SXZ[1], SR = DOME.r;
    var orb = new THREE.Group();
    orb.position.set(SX, 0, SZ);
    city.add(orb);
    orb.renderOrder = 2;
    var orbU = { uKick: { value: 0 }, uHi: { value: 0 }, uAmp: { value: 1 }, uOrbI: { value: 1 } };

    var RIB_Y = SR * 0.42, RIB_SX = SR * 0.86, RIB_SY = SR * 0.72;
    var ribbonGeo = new THREE.PlaneGeometry(1, 1, 220, 24);
    var ribGroup = new THREE.Group();
    ribGroup.position.y = RIB_Y; ribGroup.scale.set(RIB_SX, RIB_SY, RIB_SX);
    orb.add(ribGroup);
    RIBBONS.forEach(function (d) {
      var m = new THREE.Mesh(ribbonGeo, new THREE.ShaderMaterial(Object.assign({}, ADD, {
        side: THREE.DoubleSide, vertexShader: ribbonVS, fragmentShader: ribbonFS,
        uniforms: withShared({
          uRT: { value: 0 }, uAmp: orbU.uAmp, uKick: orbU.uKick, uOrbI: orbU.uOrbI,
          uThick: { value: 1.35 }, uThreads: { value: 0 }, uThreadCol: { value: orbPal.glint },
          uPhase: { value: d.ph }, uOff: { value: d.off }, uW: { value: d.w },
          uBump: { value: d.bump }, uBumpC: { value: d.bc }, uBumpS: { value: d.bs },
          uA: { value: orbPal[d.ca] }, uB: { value: orbPal[d.cb] }, uOp: { value: d.op },
          uBaseY: { value: RIB_Y }, uScaleY: { value: RIB_SY }
        })
      })));
      m.frustumCulled = false;
      ribGroup.add(m);
    });

    var glassMat = new THREE.ShaderMaterial(Object.assign({}, ADD, {
      uniforms: withShared({ uRim: { value: orbPal.rim }, uGlint: { value: orbPal.glint }, uHi: orbU.uHi, uKick: orbU.uKick, uOrbI: orbU.uOrbI }),
      vertexShader: glassVS, fragmentShader: glassFS
    }));
    var glass = new THREE.Mesh(new THREE.SphereGeometry(SR, 112, 84), glassMat);
    glass.userData.bid = SPHERE_ID;
    orb.add(glass); hitList.push(glass); hiMats.push({ bid: SPHERE_ID, mat: { uniforms: { uHi: { value: 0 } } } });
    var ringPts = [];
    for (var ri = 0; ri <= 96; ri++) { var ra = ri / 96 * Math.PI * 2; ringPts.push(Math.cos(ra) * SR, 0, Math.sin(ra) * SR); }
    var ringGeo = new THREE.BufferGeometry(); ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringPts, 3));
    var ring = new THREE.Line(ringGeo, lineMat(orbPal.rim, orbPal.rim, 1, new THREE.Vector3(), 0.005, 0.9));
    ring.position.y = 0.005; orb.add(ring);

    /* ---------- Llums d'antenes ---------- */
    var tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute('position', new THREE.Float32BufferAttribute([].concat.apply([], tips), 3));
    tipGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(tips.map(function () { return Math.random(); }), 1));
    var tipMat = new THREE.ShaderMaterial(Object.assign({}, ADD, { uniforms: withShared({ uCol: { value: PAL.pink } }), vertexShader: tipVS, fragmentShader: tipFS }));
    var tipPts = new THREE.Points(tipGeo, tipMat); tipPts.frustumCulled = false;
    city.add(tipPts);

    /* ---------- Arcs de dades NEXUS (cúpula → edificis) ---------- */
    var arcMat = new THREE.ShaderMaterial(Object.assign({}, ADD, {
      depthTest: false,
      uniforms: withShared({ uCol: { value: PAL.pink }, uNetA: { value: 0 }, uNetR3: { value: 9 } }),
      vertexShader: arcVS, fragmentShader: arcFS
    }));
    (function buildArcs() {
      var ARC_N = 48, geos = [];
      feet.forEach(function (f, i) {
        var b = BUILDINGS[i];
        var h0 = b.tiers.reduce(function (s2, t2) { return s2 + t2.h; }, 0) + (b.roof || 0);
        var A = new THREE.Vector3(SX, SR * 0.95, SZ);
        var Bp = new THREE.Vector3(f.x, h0 + 0.04, f.z);
        var M = A.clone().lerp(Bp, 0.5); M.y = Math.max(A.y, Bp.y) + 0.35 + A.distanceTo(Bp) * 0.3;
        var g = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A, M, Bp), ARC_N, 0.009, 5, false);
        var n = g.attributes.position.count, uv = g.attributes.uv;
        var aT = new Float32Array(n), aSeed = new Float32Array(n).fill(i * 0.173), aOrig = new Float32Array(n * 3);
        for (var j = 0; j < n; j++) { aT[j] = uv.getX(j); aOrig.set([SX, 0, SZ], j * 3); }
        g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
        g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
        g.setAttribute('aOrig', new THREE.BufferAttribute(aOrig, 3));
        g.deleteAttribute('normal'); g.deleteAttribute('uv');
        geos.push(g);
      });
      var arcGeo = THREE.mergeGeometries(geos);
      geos.forEach(function (g) { g.dispose(); });
      var arcs = new THREE.Mesh(arcGeo, arcMat); arcs.frustumCulled = false; arcs.renderOrder = 3;
      city.add(arcs);
    })();

    /* ---------- Feixos de vigilància (conclusió 1) ---------- */
    var scanMat = new THREE.ShaderMaterial(Object.assign({}, ADD, {
      side: THREE.DoubleSide,
      uniforms: withShared({ uCol: { value: PAL.pink }, uScan: { value: 0 } }),
      vertexShader: scanVS, fragmentShader: scanFS
    }));
    var SCANNERS = [0, 3, 4].map(function (bid, i) {
      var f = feet[bid];
      var m = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 40, 1, true).translate(0, -0.5, 0), scanMat);
      m.frustumCulled = false; m.renderOrder = 4; m.visible = false; city.add(m);
      return { m: m, apex: new THREE.Vector3(f.x, f.top + 0.02, f.z), ph: i * 2.1, sp: 0.32 + i * 0.07, target: new THREE.Vector3() };
    });
    var DOWN = new THREE.Vector3(0, -1, 0), tmpDir = new THREE.Vector3();
    function updateScanners(t, amount) {
      SCANNERS.forEach(function (sc) {
        sc.m.visible = amount > 0.01;
        sc.target.set(Math.sin(t * sc.sp + sc.ph) * 1.25, 0, Math.cos(t * sc.sp * 1.3 + sc.ph * 1.7) * 1.25);
        tmpDir.subVectors(sc.target, sc.apex);
        var len = tmpDir.length();
        sc.m.position.copy(sc.apex);
        sc.m.quaternion.setFromUnitVectors(DOWN, tmpDir.normalize());
        sc.m.scale.set(0.3, len, 0.3);
      });
      BUILDINGS.forEach(function (b, i) {
        var f = feet[i];
        var seen = 0;
        SCANNERS.forEach(function (sc) { var d = Math.hypot(f.x - sc.target.x, f.z - sc.target.z); seen = Math.max(seen, 1 - sstep(0.25, 0.55, d)); });
        BU[i].uSeen.value += (seen * amount - BU[i].uSeen.value) * 0.15;
      });
    }

    /* ---------- Línia vermella: perímetre que NEXUS no pot creuar (conclusió 2) ---------- */
    var wallMat = new THREE.ShaderMaterial(Object.assign({}, ADD, {
      side: THREE.DoubleSide,
      uniforms: withShared({ uCol: { value: PAL.pink }, uPerim: { value: 0 } }),
      vertexShader: wallVS, fragmentShader: wallFS
    }));
    var wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.28, 128, 1, true), wallMat);
    wall.position.set(SX, 0.14, SZ); wall.renderOrder = 4; wall.visible = false; city.add(wall);

    /* ---------- Plataforma amb reflex sota els edificis ---------- */
    var footV = [], footC = [];
    for (var fi = 0; fi < 16; fi++) {
      var ft = feet[fi];
      footV.push(ft ? new THREE.Vector4(ft.x, -ft.z, ft.w, ft.d) : new THREE.Vector4(0, 0, 0, 0));
      footC.push(ft ? ft.color : new THREE.Color(0, 0, 0));
    }
    var platMat = new THREE.ShaderMaterial(Object.assign({}, ADD, {
      uniforms: withShared({
        uCol: { value: PAL.teal }, uEdge: { value: PAL.violet }, uData: { value: PAL.pink }, uP: { value: P },
        uFoot: { value: footV }, uFootC: { value: footC }, uDome: { value: new THREE.Vector3(SX, -SZ, SR) },
        uNet: { value: 0 }, uNetR: { value: 9 }, uTraffic: { value: 0 }, uGridPink: { value: 0 }, uFloorData: { value: 1 },
        uOrbRim: { value: orbPal.rim }, uPerim: { value: 0 }, uScan: { value: 0 }, uSpot: { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] }
      }),
      vertexShader: uvVS, fragmentShader: platFS
    }));
    var platform = new THREE.Mesh(new THREE.PlaneGeometry(P, P).rotateX(-Math.PI / 2), platMat);
    platform.userData.bid = -1; platform.renderOrder = -1;
    city.add(platform); hitList.push(platform);
    var slab = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(P, 0.06, P)), lineMat(PAL.violet, PAL.teal, 0.06, new THREE.Vector3(P, 0.06, P), -0.06, 0.7));
    slab.position.y = -0.03; slab.renderOrder = -1; city.add(slab);

    /* ---------- Projector: base d'anells + feix piramidal ---------- */
    var emitMat = new THREE.ShaderMaterial(Object.assign({}, ADD, {
      uniforms: { uCol: { value: PAL.teal }, uCol2: { value: PAL.violet }, uI: { value: 1 }, uTime: shared.uTime },
      vertexShader: uvVS, fragmentShader: emitFS
    }));
    var emitter = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), emitMat);
    emitter.rotation.x = -Math.PI / 2; emitter.position.y = EMIT_Y;
    holo.add(emitter);

    var beamH = -EMIT_Y - 0.06;
    var beamGeo = new THREE.CylinderGeometry(P / Math.SQRT2, 0.05, beamH, 4, 1, true).rotateY(Math.PI / 4);
    var beamMat = new THREE.ShaderMaterial(Object.assign({}, ADD, {
      side: THREE.DoubleSide, uniforms: { uCol: { value: PAL.teal }, uCol2: { value: PAL.violet }, uI: { value: 1 }, uTime: shared.uTime },
      vertexShader: uvVS, fragmentShader: beamFS
    }));
    var beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = EMIT_Y + beamH / 2;
    holo.add(beam);

    var bl = [], bc = [];
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) {
      bl.push(0, EMIT_Y, 0, q[0] * P / 2, -0.06, q[1] * P / 2);
      bc.push(PAL.teal.r, PAL.teal.g, PAL.teal.b, PAL.violet.r * 0.35, PAL.violet.g * 0.35, PAL.violet.b * 0.35);
    });
    var beamLinesGeo = new THREE.BufferGeometry();
    beamLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(bl, 3));
    beamLinesGeo.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    var beamLinesMat = new THREE.LineBasicMaterial(Object.assign({}, ADD, { vertexColors: true, opacity: 0.4 }));
    holo.add(new THREE.LineSegments(beamLinesGeo, beamLinesMat));

    /* ---------- Partícules de la intro ---------- */
    var N = 5200;
    var pStart = new Float32Array(N * 3), pTarget = new Float32Array(N * 3), pDelay = new Float32Array(N), pColor = new Float32Array(N * 3);
    var orbCols = [PAL.pink, PAL.violet, PAL.teal];
    var areas = surf.map(function (s) { return (s.w + s.d) * s.h; });
    var totalA = areas.reduce(function (a, b) { return a + b; }, 0);
    var pickPart = function () { var r = Math.random() * totalA; for (var i = 0; i < surf.length; i++) { r -= areas[i]; if (r <= 0) return surf[i]; } return surf[0]; };
    var edgeSnap = function (v) { return Math.random() < 0.35 ? Math.sign(v) * 0.5 : v; };
    for (var pi = 0; pi < N; pi++) {
      var rnd = Math.random(), tp, pc;
      if (rnd < 0.66) {
        var s = pickPart(); pc = s.color;
        var u = Math.random() - 0.5, v = Math.random(), w = Math.random() - 0.5;
        if (Math.random() < 0.12) v = 1;
        else if (Math.random() < 0.5) { u = Math.sign(u) * 0.5; w = edgeSnap(w); }
        else { w = Math.sign(w) * 0.5; u = edgeSnap(u); }
        tp = [s.x + u * s.w, s.y + v * s.h, s.z + w * s.d];
      } else if (rnd < 0.8) {
        var zz = Math.random(), aa = Math.random() * Math.PI * 2, qq = Math.sqrt(1 - zz * zz);
        tp = [SX + Math.cos(aa) * qq * SR, zz * SR, SZ + Math.sin(aa) * qq * SR];
        pc = orbCols[Math.random() < 0.6 ? 0 : Math.random() < 0.5 ? 1 : 2];
      } else {
        var px = (Math.random() - 0.5) * P, pz = (Math.random() - 0.5) * P;
        if (Math.random() < 0.4) { if (Math.random() < 0.5) px = Math.sign(px) * P / 2; else pz = Math.sign(pz) * P / 2; }
        tp = [px, 0, pz]; pc = Math.random() < 0.7 ? PAL.teal : PAL.violet;
      }
      pTarget.set(tp, pi * 3);
      pColor.set([pc.r, pc.g, pc.b], pi * 3);
      var sa = Math.random() * Math.PI * 2, sr = Math.random() * 0.15;
      pStart.set([Math.cos(sa) * sr, EMIT_Y + Math.random() * 0.2, Math.sin(sa) * sr], pi * 3);
      pDelay[pi] = Math.min(1, (tp[1] / maxH) * 0.75 + Math.random() * 0.25);
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pTarget.slice(), 3));
    pGeo.setAttribute('aStart', new THREE.BufferAttribute(pStart, 3));
    pGeo.setAttribute('aTarget', new THREE.BufferAttribute(pTarget, 3));
    pGeo.setAttribute('aDelay', new THREE.BufferAttribute(pDelay, 1));
    pGeo.setAttribute('aColor', new THREE.BufferAttribute(pColor, 3));
    var pMat = new THREE.ShaderMaterial(Object.assign({}, ADD, {
      depthTest: false,
      uniforms: { uProg: { value: 0 }, uFade: { value: 0 }, uSize: { value: 2.2 }, uDpr: shared.uDpr },
      vertexShader: partVS, fragmentShader: partFS
    }));
    var particles = new THREE.Points(pGeo, pMat);
    particles.frustumCulled = false; particles.visible = false; particles.renderOrder = 20;
    city.add(particles);

    /* ---------- Mida i càmera ---------- */
    // El holograma es dibuixa en un quadrat (costat = el major del rect) centrat al rect,
    // com els vídeos anteriors.
    var W = 0, H = 0, D = 1, sizeCheck = 0;
    function updateCamera() {
      camera.position.set(0, camTarget.y + Math.sin(elev) * CAM_DIST, Math.cos(elev) * CAM_DIST);
      camera.lookAt(camTarget);
    }
    function setup() {
      var stageScale = 1;
      try {
        var bb = el.getBoundingClientRect();
        if (bb.width > 0) stageScale = bb.width / rect.w;
      } catch (e) { /* encara sense layout */ }
      var nD = clamp((window.devicePixelRatio || 1) * stageScale, 1, 2);
      var nW = Math.round(rect.w * nD), nH = Math.round(rect.h * nD);
      if (nW === W && nH === H) return;
      W = nW; H = nH; D = nD;
      view.width = W; view.height = H;
      shared.uDpr.value = D;
      var Sq = Math.max(rect.w, rect.h);
      camera.aspect = 1;
      camera.setViewOffset(Sq, Sq, (Sq - rect.w) / 2, (Sq - rect.h) / 2, rect.w, rect.h);
      camera.updateProjectionMatrix();
      updateCamera();
    }

    /* ---------- Interacció (sense gir: en arrossegar s'inclina i torna al seu lloc) ---------- */
    var ray = new THREE.Raycaster(), mouse = new THREE.Vector2(9, 9);
    var hoverBid = null, hoverK = 0, beat = 0, kick = 0, pulseT = 9;
    var dragging = false, dragId = null, down = null, last = null, yawOff = 0, pitchOff = 0;

    function inside(e) {
      var r = view.getBoundingClientRect();
      return r.width > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }
    function setMouse(e) {
      var r = view.getBoundingClientRect();
      if (!r.width || !inside(e)) { mouse.set(9, 9); return; }
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    }
    function pick() { if (mouse.x > 1.5) return null; ray.setFromCamera(mouse, camera); return ray.intersectObjects(hitList, false)[0]; }
    function onButton(e) { return !!(e.target && e.target.closest && e.target.closest('button, a, input, select, [role=button]')); }

    function onMove(e) {
      if (onButton(e) && !dragging) { mouse.set(9, 9); return; }
      setMouse(e);
      if (!dragging || e.pointerId !== dragId) return;
      yawOff = clamp(yawOff + (e.clientX - last.x) * 0.004, -0.6, 0.6);
      pitchOff = clamp(pitchOff + (e.clientY - last.y) * 0.002, -0.25, 0.3);
      last = { x: e.clientX, y: e.clientY };
    }
    function onDown(e) {
      if (dragging || onButton(e) || !inside(e)) return;
      dragging = true; dragId = e.pointerId; down = last = { x: e.clientX, y: e.clientY };
    }
    function onUp(e) {
      if (!dragging || e.pointerId !== dragId) return;
      dragging = false; dragId = null; setMouse(e);
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        var hit = pick();
        if (hit) { pulseT = 0; beat = 1; if (hit.object.userData.bid === SPHERE_ID) kick = 1; }
      }
      if (e.pointerType !== 'mouse') mouse.set(9, 9);
    }
    function onCancel() { dragging = false; dragId = null; }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onCancel, { passive: true });

    /* ---------- Estat de l'escena ---------- */
    var curV = baseV;
    var sceneId = SCENE_BY_VERSION[curV];
    var ST = sceneState(sceneId), sceneT = 0, sceneStarted = false;
    var cur = {};
    NUMERIC.forEach(function (k) { cur[k] = BASE[k]; });
    var curTint = PAL.teal.clone();
    var flickT = BUILDINGS.map(function () { return 0; });

    function resetToBase() {
      NUMERIC.forEach(function (key) { cur[key] = BASE[key]; });
      curTint.copy(PAL.teal);
      BUILDINGS.forEach(function (b, i) { BU[i].uPow.value = 1; BU[i].uTint.value = 0; BU[i].uSeen.value = 0; flickT[i] = 0; });
      sceneStarted = false; sceneT = 0;
    }

    var introT = 1;
    function updateScene(dt) {
      // mentre es reprodueix el holograma la ciutat és a l'estat base; en acabar comença l'escena
      var active = introT >= 1;
      if (active && !sceneStarted) {
        sceneStarted = true; sceneT = 0;
        if (ST.startPow) BUILDINGS.forEach(function (b, i) { BU[i].uPow.value = ST.startPow(i, b); });
        if (ST.perim) cur.netR = 3.5;
        if (sceneId !== 'e1') pulseT = 0;
      }
      var T = active ? ST : BASE;
      if (active) sceneT += dt;
      var k = 1 - Math.exp(-dt * 2.2);
      NUMERIC.forEach(function (key) { cur[key] += (T[key] - cur[key]) * k; });
      curTint.lerp(T.tintCol === C.pink ? PAL.pink : T.tintCol === C.violet ? PAL.violet : PAL.teal, k);
      shared.uWin.value = cur.win; shared.uSync.value = cur.sync; shared.uHuman.value = cur.human;
      shared.uTintCol.value.copy(curTint);
      BUILDINGS.forEach(function (b, i) {
        var u = BU[i];
        var ready = sceneT > T.delay(i, b);
        var pk = ready ? 1 - Math.exp(-dt * 2.5) : 0;
        u.uPow.value += (T.pow(i, b) - u.uPow.value) * pk;
        u.uTint.value += (T.tint(i, b) - u.uTint.value) * k;
        if (T.flick(i, b) && !reduceMotion) {
          if (flickT[i] <= 0 && Math.random() < 0.015) flickT[i] = 0.06 + Math.random() * 0.18;
        }
        if (flickT[i] > 0) { flickT[i] -= dt; u.uPow.value *= 0.25; }
      });
      orb.scale.setScalar(cur.dome);
      orbU.uOrbI.value = cur.orbI;
      platMat.uniforms.uDome.value.z = SR * cur.dome;
      var pu = platMat.uniforms;
      pu.uNet.value = cur.net; pu.uNetR.value = cur.netR; pu.uTraffic.value = cur.traffic;
      pu.uGridPink.value = cur.gridPink; pu.uFloorData.value = cur.floorData;
      arcMat.uniforms.uNetA.value = cur.arcs; arcMat.uniforms.uNetR3.value = cur.netR;
      scanMat.uniforms.uScan.value = cur.scan; pu.uScan.value = cur.scan;
      var perimIn = cur.perim * (1 - sstep(0.8, 0.88, cur.netR));
      pu.uPerim.value = cur.perim; wallMat.uniforms.uPerim.value = perimIn;
      wall.visible = perimIn > 0.01; wall.scale.set(Math.min(cur.netR, 0.88), 1, Math.min(cur.netR, 0.88));
      updateScanners(t, cur.scan);
      SCANNERS.forEach(function (sc, i) { pu.uSpot.value[i].set(sc.target.x, -sc.target.z); });
    }

    /* ---------- Glitch ---------- */
    var t = 0;
    var gi = 0, nextG = Infinity, gStart = -9;
    var cornerV = new THREE.Vector3();
    var corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(function (q) { return new THREE.Vector3(q[0] * P / 2, -0.08, q[1] * P / 2); });
    var maskL = new THREE.Vector2(), maskF = new THREE.Vector2(), maskR = new THREE.Vector2();
    function updateGlitchMask() {
      var pts = corners.map(function (c) { cornerV.copy(c); city.localToWorld(cornerV).project(camera); return new THREE.Vector2(cornerV.x * 0.5 + 0.5, cornerV.y * 0.5 + 0.5); });
      maskF.copy(pts.reduce(function (a, b) { return b.y < a.y ? b : a; }));
      maskL.copy(pts.reduce(function (a, b) { return b.x < a.x ? b : a; }));
      maskR.copy(pts.reduce(function (a, b) { return b.x > a.x ? b : a; }));
    }

    function playIntro() {
      introT = reduceMotion ? 1 : 0;
      yawOff = pitchOff = 0; pulseT = 9; resetToBase(); gi = 0;
      nextG = ST.glitch && !reduceMotion ? t + INTRO_DUR + ST.glitch[0] : Infinity;
    }

    /* ---------- Bucle ---------- */
    var raf = 0, alive = true, running = false, lastNow = 0, orbHover = 0;

    function tick(now) {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      var dt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0.016;
      lastNow = now;
      if (document.hidden) return;
      if (++sizeCheck % 30 === 0) setup();
      t += dt;

      var hit = pick();
      hoverBid = hit ? hit.object.userData.bid : null;
      hoverK += ((hit ? 1 : 0) - hoverK) * 0.08;
      beat = Math.max(0, beat - dt * 1.2);
      kick = Math.max(0, kick - dt * 0.9);
      pulseT += dt;
      var PD = 1.6;
      shared.uPulseY.value = -0.3 + (pulseT / PD) * (maxH + 0.8);
      shared.uPulseI.value = pulseT < PD ? 1 - pulseT / PD : 0;
      var bump = Math.sin(beat * Math.PI);

      updateScene(dt);

      if (!dragging) { yawOff *= 0.93; pitchOff *= 0.93; }
      holo.rotation.y = BASE_YAW + yawOff;
      elev = BASE_ELEV + pitchOff; updateCamera();

      shared.uTime.value += dt * (1 + hoverK * 0.4 + bump * 1.2);
      shared.uGlow.value = hoverK * 0.25 + bump * 0.5;
      hiMats.forEach(function (h) { var u = h.mat.uniforms.uHi; u.value += ((h.bid === hoverBid ? 1 : 0) - u.value) * 0.12; });

      // orbe: s'anima més en passar-hi per sobre i en fer-hi clic
      orbHover += ((hoverBid === SPHERE_ID ? 1 : 0) - orbHover) * 0.08;
      orbU.uHi.value = orbHover;
      orbU.uKick.value = Math.sin(kick * Math.PI) * 0.8 + kick * 0.3;
      orbU.uAmp.value = 1;
      ribGroup.rotation.y = -holo.rotation.y;   // ones sempre de cara a l'usuari

      city.position.y = Math.sin(t * 0.8) * 0.03;
      var bloomS = BLOOM * (1 + hoverK * 0.15 + bump * 0.4);

      // intro holograma
      if (introT < 1) introT = Math.min(1, introT + dt / INTRO_DUR);
      var p = introT, playing = p < 1;
      shared.uReveal.value = playing ? sstep(0.3, 0.95, p) : 1;
      shared.uHolo.value = 1 - sstep(0.8, 1, p);
      var surge = 1 - sstep(0.7, 1, p);
      var beamI = (playing ? sstep(0, 0.1, p) * (0.4 + surge * 0.9) : 0.4) * cur.beam;
      beamMat.uniforms.uI.value = beamI;
      beamLinesMat.opacity = beamI * 0.6;
      emitMat.uniforms.uI.value = (playing ? sstep(0, 0.08, p) * (0.7 + surge * 0.6) : 0.7) * (0.5 + 0.5 * cur.beam);
      particles.visible = playing;
      pMat.uniforms.uProg.value = clamp((p - 0.04) / 0.62, 0, 1);
      pMat.uniforms.uFade.value = 1 - sstep(0.75, 1, p);

      // glitch del holograma: alterna els dos intervals de l'escena
      if (t >= nextG) { gStart = t; gi ^= 1; nextG = ST.glitch ? t + ST.glitch[gi] : Infinity; }
      var gp = t - gStart, GD = 0.32;
      var g = !reduceMotion && gp < GD ? (Math.random() < 0.75 ? 1 : 0.3) * (1 - gp / GD * 0.5) : 0;
      city.position.x = g ? (Math.random() - 0.5) * 0.04 * g : 0;

      var fr = Math.random();
      shared.uFlick.value = reduceMotion ? 1
        : g ? 0.65 + Math.random() * 0.4
        : playing && fr < 0.1 ? 0.7 + Math.random() * 0.2
        : fr < 0.01 + cur.unstable * 0.06 ? 0.8 + Math.random() * 0.12 : 1;

      // render al context compartit i còpia al canvas propi
      if (!W) return;
      sizeGL(W, H);
      updateGlitchMask();
      var gu = GL.glitchPass.uniforms;
      gu.uG.value = g;
      gu.uSeed.value = Math.floor(t * 24) % 97;
      gu.uL.value.copy(maskL); gu.uF.value.copy(maskF); gu.uR.value.copy(maskR);
      GL.rp.scene = scene; GL.rp.camera = camera;
      GL.bloom.strength = bloomS;
      GL.composer.render();
      vctx.setTransform(1, 0, 0, 1, 0, 0);
      vctx.globalCompositeOperation = 'copy';
      vctx.drawImage(GL.r.domElement, 0, 0, W, H);
      vctx.globalCompositeOperation = 'source-over';
    }

    return {
      el: el,
      play: function () {
        if (!alive) return;
        setup();
        curV = baseV; sceneId = SCENE_BY_VERSION[curV]; ST = sceneState(sceneId);
        playIntro();
        if (!running) { running = true; lastNow = 0; raf = requestAnimationFrame(tick); }
      },
      setChoice: function (choice) {
        var next = choice ? baseV + choice : baseV;
        if (!SCENE_BY_VERSION.hasOwnProperty(next) || next === curV || !alive) return;
        curV = next; sceneId = SCENE_BY_VERSION[next]; ST = sceneState(sceneId);
        if (introT < 1) return; // encara s'està construint: l'escena entrarà en acabar la intro
        // Canvi en directe: glitch, ona d'escaneig i transició suau cap a la nova escena
        sceneStarted = false;
        if (!reduceMotion) gStart = t;
        gi = 0;
        nextG = ST.glitch && !reduceMotion ? t + ST.glitch[0] : Infinity;
      },
      destroy: function () {
        alive = false; running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        scene.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        view.width = view.height = 1;
      }
    };
  }

  window.NexusHolo = { create: create, scenes: SCENE_BY_VERSION, presets: PRESET_BY_ORB };
})();
;
/*
 * NEXUS · Orbe (nodo) en codi
 * ------------------------------------------------------------------------
 * Port de «nexus-nodo-lab.html» al joc: ones de seda interiors, bombolla de
 * vidre líquid que les refracta, halo, intro holograma (feix + píxels que
 * pugen) i interacció (arrossegar per girar, hover, clic amb ona).
 *
 * Cada orbe del joc fa servir el seu preset del Lab:
 *   sora → boceto · nima → magenta · luah → turquesa · kylo → violeta
 *
 * Totes les orbes visibles comparteixen UN renderer WebGL: cada instància
 * es pinta en aquest renderer i es copia al seu propi <canvas> 2D. La sortida
 * es converteix a alfa per lluminositat (llum additiva), així l'orbe brilla
 * sobre el fons del joc sense quadrat negre.
 *
 * API (la fa servir la classe d'orbe del bundle):
 *   NexusOrb.create({ canvas, orb, size, mode:'anim'|'static' })
 *     → { setOrb(id), draw(scale), destroy() }   ·   null si no hi ha WebGL
 */
(function () {
  'use strict';

  var THREE = window.THREE;
  if (!THREE || !THREE.WebGLRenderer) return;

  /* =========================================================
     AJUSTOS I PRESETS (els mateixos del Lab)
     ========================================================= */
  var PRESETS = {
    boceto:   { rim: '#e879f9', top: '#6d4aff', mid: '#1bd8c6', low: '#e879f9', glint: '#ffffff' },
    magenta:  { rim: '#e879f9', top: '#f3b3fc', mid: '#e879f9', low: '#b14fd6', glint: '#ffffff' },
    violeta:  { rim: '#6d4aff', top: '#a796ff', mid: '#6d4aff', low: '#4529d1', glint: '#ffffff' },
    turquesa: { rim: '#1bd8c6', top: '#86eee3', mid: '#1bd8c6', low: '#0e9f92', glint: '#ffffff' }
  };
  var PRESET_BY_ORB = { sora: 'boceto', nima: 'magenta', luah: 'turquesa', kylo: 'violeta' };
  var S = {
    speed: 1, amp: 1, count: 7, thick: 1, threads: 0,   // sense fils
    rimI: 1, bloom: 0.45, refr: 0.8, spin: 0.15, introDur: 3
  };
  var R = 1;
  var INNER = 1;
  var HALO = 3.6;
  var EMIT_Y = -1.42;
  // Portada: les partícules surten de sota el botó COMENÇAR (y≈798, darrere el botó).
  // L'orbe de 506 px té el centre a y=467 i 1 unitat = 124,8 px; el canvas s'allarga
  // 154 px cap avall (fins a la vora de la pantalla) perquè el raig no es talli.
  var PORTADA_EMIT_Y = -2.65;
  var PORTADA_EXTRA = 154;
  // L'orbe ocupa el 50 % del canvas, com les làmines anteriors: fov 38° a 5,89 unitats.
  var CAM_D = 5.89;
  var MAX_PX = 1024;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var sstep = function (a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* =========================================================
     RENDERER COMPARTIT
     ========================================================= */
  // Darrer pas: la imatge (llum sobre negre) passa a alfa premultiplicat.
  var LUMA_ALPHA = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv;' +
      'void main(){ vec3 c = clamp(texture2D(tDiffuse, vUv).rgb, 0., 1.); float a = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c, a); }'
  };

  var GL = null, glFailed = false;
  function gl() {
    if (GL || glFailed) return GL;
    try {
      var r = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
      r.toneMapping = THREE.NoToneMapping;
      r.setPixelRatio(1);
      var composer = new THREE.EffectComposer(r);
      composer.setPixelRatio(1);
      var rp = new THREE.RenderPass(null, null);
      composer.addPass(rp);
      var bloom = new THREE.UnrealBloomPass(new THREE.Vector2(4, 4), S.bloom, 0.5, 0.72);
      composer.addPass(bloom);
      composer.addPass(new THREE.OutputPass());
      composer.addPass(new THREE.ShaderPass(LUMA_ALPHA));
      GL = {
        r: r, composer: composer, rp: rp, bloom: bloom, size: 0,
        innerRT: new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType })
      };
    } catch (e) {
      glFailed = true;
      GL = null;
    }
    return GL;
  }
  function sizeGL(w, h) {
    if (GL.size === w + 'x' + h) return;
    GL.size = w + 'x' + h;
    GL.r.setSize(w, h, false);
    GL.composer.setSize(w, h);
    GL.innerRT.setSize(w, h);
  }

  /* =========================================================
     SHADERS (idèntics al Lab)
     ========================================================= */
  var ribbonVS = [
    'uniform float uTime, uAmp, uThick, uPhase, uOff, uW, uBump, uBumpC, uBumpS;',
    'varying vec2 vUv; varying float vEnv; varying float vShade;',
    'void main(){',
    '  float u = uv.x; float vv = uv.y - .5;',
    '  float env = pow(sin(3.14159265*u), .85);',
    '  float t = uTime + uPhase;',
    '  float x = (u*2. - 1.) * ' + R.toFixed(2) + ' * .96;',
    '  float bump = uBump * exp(-pow((u - uBumpC)/uBumpS, 2.));',
    '  float wave = (sin(u*7.54 + t)*.07 + sin(u*16.34 - t*1.35)*.035) * uAmp;',
    '  float cy = env*(uOff + wave) + bump*env;',
    '  float cz = env * sin(u*4.2 + t*.7) * .32 * uAmp;',
    '  float tw = sin(u*3.4 + t*.55) * uAmp + .3;',
    '  float w = vv * uW * uThick * env;',
    '  vec3 p = vec3(x, cy + w*cos(tw), cz + w*sin(tw));',
    '  vUv = uv; vEnv = env; vShade = cos(tw);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);',
    '}'
  ].join('\n');
  var ribbonFS = [
    'uniform vec3 uA, uB, uThreadCol; uniform float uOp, uThreads, uGlow, uTime;',
    'varying vec2 vUv; varying float vEnv; varying float vShade;',
    'void main(){',
    '  float across = abs(vUv.y - .5) * 2.;',
    '  float body = smoothstep(1., .2, across);',
    '  float silk = .75 + .25*abs(vShade);',
    '  float th = sin(vUv.y*46. + sin(vUv.x*7. + uTime*.8)*2.5) * .5 + .5;',
    '  th = smoothstep(.965, 1., th) * uThreads;',
    '  vec3 c = mix(uA, uB, smoothstep(.12, .55, vUv.x));',
    '  c = c*silk + uThreadCol*th*.5;',
    '  float ends = smoothstep(0., .32, vEnv);',
    '  float a = (body*.82 + th*.35) * ends * uOp;',
    '  gl_FragColor = vec4(c * (1. + uGlow), a);',
    '}'
  ].join('\n');
  // Composició del boceto: violeta a dalt, turquesa al centre, rínxol rosa a baix
  var RIBBONS = [
    { ca: 'top', cb: 'top', off: 0.17,  w: 0.34, bump: 0.13,  bc: 0.56, bs: 0.18, ph: 0.0, op: 0.85, ro: 1 },
    { ca: 'top', cb: 'top', off: 0.27,  w: 0.06, bump: 0.18,  bc: 0.50, bs: 0.20, ph: 1.2, op: 0.70, ro: 2 },
    { ca: 'low', cb: 'low', off: -0.06, w: 0.30, bump: -0.36, bc: 0.36, bs: 0.11, ph: 3.1, op: 0.85, ro: 3 },
    { ca: 'low', cb: 'low', off: -0.10, w: 0.22, bump: -0.12, bc: 0.64, bs: 0.15, ph: 4.0, op: 0.70, ro: 4 },
    { ca: 'top', cb: 'mid', off: 0.01,  w: 0.28, bump: 0.05,  bc: 0.60, bs: 0.20, ph: 2.0, op: 0.95, ro: 9 },
    { ca: 'mid', cb: 'mid', off: -0.03, w: 0.08, bump: 0,     bc: 0.50, bs: 0.20, ph: 5.0, op: 0.80, ro: 8 },
    { ca: 'top', cb: 'low', off: -0.19, w: 0.08, bump: -0.08, bc: 0.50, bs: 0.20, ph: 6.0, op: 0.50, ro: 0 }
  ];
  var haloVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }';
  var haloFS = [
    'varying vec2 vUv; uniform vec3 uRim; uniform float uI, uVis;',
    'void main(){',
    '  float r = length(vUv - .5) * ' + HALO.toFixed(1) + ';',
    '  float outer = exp(-max(r - 1., 0.) * 7.) * smoothstep(.95, 1.02, r) * .3 * uI;',
    '  float inner = (1. - smoothstep(0., 1., r)) * .012;',
    '  gl_FragColor = vec4(uRim * (outer + inner) * uVis, 1.);',
    '}'
  ].join('\n');
  var glassVS = [
    'varying vec3 vN; varying vec3 vV; varying vec3 vW;',
    'void main(){',
    '  vec4 wp = modelMatrix * vec4(position, 1.);',
    '  vec4 mv = viewMatrix * wp;',
    '  vW = wp.xyz; vV = mv.xyz; vN = normalize(normalMatrix * normal);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  var glassFS = [
    'uniform sampler2D tInner; uniform vec2 uRes; uniform float uDpr, uRefr, uRimI, uGlow, uTime, uReveal, uCenterY, uScale;',
    'uniform vec3 uRim, uGlint;',
    'varying vec3 vN; varying vec3 vV; varying vec3 vW;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float arc(float r, float ang, float rc, float w, float a0, float a1){',
    '  return exp(-pow((r - rc)/w, 2.)) * smoothstep(a0, a0 + .3, ang) * (1. - smoothstep(a1 - .3, a1, ang));',
    '}',
    'void main(){',
    '  vec3 n = normalize(vN); vec3 v = normalize(-vV);',
    '  float fres = 1. - clamp(dot(n, v), 0., 1.);',
    // Holograma: apareix de baix a dalt en blocs de píxels
    '  float h = (vW.y - uCenterY) / uScale * .5 + .5;',
    '  float block = hash(floor(gl_FragCoord.xy / (7. * uDpr)));',
    '  float k = (uReveal * 1.35 - .15) - (h + block * .15);',
    '  if (k < 0.) discard;',
    '  float edge = 1. - smoothstep(0., .08, k);',
    // Refracció (liquid glass) amb lleugera aberració cromàtica
    '  vec2 suv = gl_FragCoord.xy / uRes;',
    '  vec2 off = -n.xy * uRefr * (.03 + .22 * pow(fres, 2.2));',
    '  vec3 c;',
    '  c.r = texture2D(tInner, suv + off * 1.05).r;',
    '  c.g = texture2D(tInner, suv + off).g;',
    '  c.b = texture2D(tInner, suv + off * .95).b;',
    '  float lower = smoothstep(.5, -.9, n.y);',
    '  c += uRim * (.006 + .025 * lower);',
    // Aro gruixut i difuminat, més fort a baix
    '  float rimB = mix(.65, 1.35, lower) * uRimI * (1. + uGlow);',
    '  c += uRim * pow(smoothstep(.25, 1., fres), 1.9) * rimB * .85;',
    '  c += uGlint * pow(fres, 9.) * .1 * rimB;',
    '  c += mix(uRim, uGlint, .4) * exp(-pow((fres - .42)/.045, 2.)) * lower * .35 * uRimI;',
    // Brillantors blanques: arcs a dalt a l'esquerra i un a baix a la dreta
    '  float ang = atan(n.y, n.x); float r = length(n.xy);',
    '  float hi = arc(r, ang, .83, .03, 1.55, 2.85) * .55 + arc(r, ang, .72, .025, 1.2, 2.2) * .6 + arc(r, ang, .88, .02, -1.35, -.35) * .5;',
    '  vec3 L = normalize(vec3(-.55, .65, .6));',
    '  float spec = pow(max(dot(reflect(-L, n), v), 0.), 40.);',
    '  c += uGlint * (hi + spec * .22);',
    // Línies d'escaneig mentre es materialitza
    '  float holo = 1. - smoothstep(.8, 1., uReveal);',
    '  c *= 1. - holo * .25 * (.5 + .5 * sin(gl_FragCoord.y * 1.2 / uDpr + uTime * 30.));',
    '  c += uRim * edge * 2.5 + uGlint * edge * block * 1.2 * holo;',
    '  gl_FragColor = vec4(c, 1.);',
    '}'
  ].join('\n');
  var simpleVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }';
  var beamFS = [
    'varying vec2 vUv; uniform vec3 uCol, uGlint; uniform float uI, uTime;',
    'void main(){',
    '  float fade = pow(1. - vUv.y, 1.3);',
    '  float streak = smoothstep(.6, 1., sin(vUv.x * 60. + uTime * 2.) * .5 + .5);',
    '  vec3 c = mix(uCol, uGlint, .15) * (fade * .16 + streak * fade * .14);',
    '  gl_FragColor = vec4(c * uI, 1.);',
    '}'
  ].join('\n');
  var emitFS = [
    'varying vec2 vUv; uniform vec3 uCol; uniform float uI;',
    'void main(){',
    '  float r = length(vUv - .5) * 2.;',
    '  float g = exp(-r * 5.) + smoothstep(.04, 0., abs(r - .35)) * .8;',
    '  gl_FragColor = vec4((uCol + .15) * g * .6 * uI, 1.);',
    '}'
  ].join('\n');
  var partVS = [
    'attribute vec3 aStart, aTarget, aColor; attribute float aDelay;',
    'uniform float uProg, uFade, uSize, uDpr, uEmitY;',
    'varying vec3 vC; varying float vA;',
    'void main(){',
    '  float e = clamp((uProg - aDelay * .45) / .55, 0., 1.);',
    '  e = e * e * (3. - 2. * e);',
    '  vec3 p = mix(aStart, aTarget, e);',
    '  float ang = (1. - e) * 4.;',
    '  p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;',
    '  vC = aColor; vA = (.35 + .65 * e) * uFade;',
    '  gl_PointSize = uSize * uDpr;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);',
    '}'
  ].join('\n');
  var partFS = 'varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC * .5 * vA, 1.); }';

  function ribbonPoint(d, u, vv) {
    var env = Math.pow(Math.sin(Math.PI * u), 0.85), t = d.ph;
    var x = (u * 2 - 1) * R * 0.96;
    var bump = d.bump * Math.exp(-Math.pow((u - d.bc) / d.bs, 2));
    var wave = Math.sin(u * 7.54 + t) * 0.07 + Math.sin(u * 16.34 - t * 1.35) * 0.035;
    var cy = env * (d.off + wave) + bump * env;
    var cz = env * Math.sin(u * 4.2 + t * 0.7) * 0.32;
    var tw = Math.sin(u * 3.4 + t * 0.55) + 0.3, w = vv * d.w * env;
    return [x, cy + w * Math.cos(tw), cz + w * Math.sin(tw)];
  }

  /* =========================================================
     INTERACCIÓ GLOBAL (oients passius: no bloquegen el swipe del selector)
     ========================================================= */
  var insts = [];
  function forEachInst(fn) { for (var i = 0; i < insts.length; i++) fn(insts[i]); }
  window.addEventListener('pointermove', function (e) { forEachInst(function (o) { o.onMove(e); }); }, { passive: true });
  window.addEventListener('pointerdown', function (e) { forEachInst(function (o) { o.onDown(e); }); }, { passive: true });
  window.addEventListener('pointerup', function (e) { forEachInst(function (o) { o.onUp(e); }); }, { passive: true });
  window.addEventListener('pointercancel', function () { forEachInst(function (o) { o.onCancel(); }); }, { passive: true });

  /* =========================================================
     INSTÀNCIA
     ========================================================= */
  function create(opts) {
    if (!gl()) return null;
    var canvas = opts.canvas, cssSize = opts.size, mode = opts.mode || 'anim';
    var ctx2d = canvas.getContext('2d');
    if (!ctx2d) return null;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000');
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0, CAM_D);
    camera.lookAt(0, 0, 0);
    // L'animació d'aparició només es fa a la portada (l'única orbe de 506 px)
    var mainIntro = mode === 'anim' && !reduceMotion && cssSize === 506;
    var emitY = mainIntro ? PORTADA_EMIT_Y : EMIT_Y;
    var extraH = mainIntro ? PORTADA_EXTRA : 0;
    if (extraH) {
      canvas.style.height = (cssSize + extraH) + 'px';
      camera.setViewOffset(cssSize, cssSize, 0, 0, cssSize, cssSize + extraH);
      camera.updateProjectionMatrix();
    }

    var pal = { rim: new THREE.Color(), top: new THREE.Color(), mid: new THREE.Color(), low: new THREE.Color(), glint: new THREE.Color() };
    function setPalette(orbId) {
      var p = PRESETS[PRESET_BY_ORB[orbId] || 'boceto'];
      Object.keys(pal).forEach(function (k) { pal[k].set(p[k]); });
    }
    setPalette(opts.orb);

    var node = new THREE.Group();
    scene.add(node);

    /* ---------- Ones interiors (seda) ---------- */
    var shared = {
      uTime: { value: 0 }, uAmp: { value: 1 }, uThick: { value: 1 },
      uThreads: { value: S.threads }, uGlow: { value: 0 }, uThreadCol: { value: pal.glint }
    };
    var ribbonGeo = new THREE.PlaneGeometry(1, 1, 220, 24);
    RIBBONS.forEach(function (d) {
      var m = new THREE.Mesh(ribbonGeo, new THREE.ShaderMaterial({
        vertexShader: ribbonVS, fragmentShader: ribbonFS,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: {
          uTime: shared.uTime, uAmp: shared.uAmp, uThick: shared.uThick, uThreads: shared.uThreads,
          uGlow: shared.uGlow, uThreadCol: shared.uThreadCol,
          uPhase: { value: d.ph }, uOff: { value: d.off }, uW: { value: d.w },
          uBump: { value: d.bump }, uBumpC: { value: d.bc }, uBumpS: { value: d.bs },
          uA: { value: pal[d.ca] }, uB: { value: pal[d.cb] }, uOp: { value: d.op }
        }
      }));
      m.renderOrder = d.ro; m.frustumCulled = false; m.layers.set(INNER);
      node.add(m);
    });

    /* ---------- Halo exterior + boira interior ---------- */
    var haloMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: { uRim: { value: pal.rim }, uI: { value: 1 }, uVis: { value: 1 } },
      vertexShader: haloVS, fragmentShader: haloFS
    });
    var halo = new THREE.Mesh(new THREE.PlaneGeometry(HALO, HALO), haloMat);
    halo.renderOrder = -1; halo.layers.enable(INNER);
    scene.add(halo);

    /* ---------- Bombolla de vidre líquid ---------- */
    var glassGeo = new THREE.SphereGeometry(R, 112, 84);
    var glassBase = glassGeo.attributes.position.array.slice();
    var glassMat = new THREE.ShaderMaterial({
      uniforms: {
        tInner: { value: GL.innerRT.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 },
        uRefr: { value: S.refr }, uRim: { value: pal.rim }, uGlint: { value: pal.glint }, uRimI: { value: 1 },
        uGlow: { value: 0 }, uTime: { value: 0 }, uReveal: { value: 1 }, uCenterY: { value: 0 }, uScale: { value: 1 }
      },
      vertexShader: glassVS, fragmentShader: glassFS
    });
    var glass = new THREE.Mesh(glassGeo, glassMat);
    node.add(glass);

    /* ---------- Intro holograma: feix de llum + píxels ---------- */
    var beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: pal.rim }, uGlint: { value: pal.glint }, uI: { value: 0 }, uTime: { value: 0 } },
      vertexShader: simpleVS, fragmentShader: beamFS
    });
    var beamH = (EMIT_Y + 1.62) - emitY; // la part ampla del feix queda on era
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.06, beamH, 64, 1, true), beamMat);
    beam.position.y = emitY + beamH / 2;
    scene.add(beam);

    var emitMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uCol: { value: pal.rim }, uI: { value: 0 } },
      vertexShader: simpleVS, fragmentShader: emitFS
    });
    var emitter = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), emitMat);
    emitter.rotation.x = -Math.PI / 2 + 0.25; emitter.position.y = emitY;
    scene.add(emitter);

    // Partícules quadrades (píxels) que pugen i formen la bola
    var P_SPHERE = 3600, P_RIB = 2600, P_TOTAL = P_SPHERE + P_RIB;
    var pStart = new Float32Array(P_TOTAL * 3), pTarget = new Float32Array(P_TOTAL * 3);
    var pDelay = new Float32Array(P_TOTAL), pColor = new Float32Array(P_TOTAL * 3), pKind = [];
    for (var i = 0; i < P_TOTAL; i++) {
      var tp;
      if (i < P_SPHERE) {
        var z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
        tp = [Math.cos(a) * s * R, z * R, Math.sin(a) * s * R]; pKind.push('rim');
      } else {
        var di = Math.floor(Math.random() * RIBBONS.length);
        tp = ribbonPoint(RIBBONS[di], 0.04 + Math.random() * 0.92, Math.random() - 0.5);
        pKind.push(Math.random() < 0.5 ? RIBBONS[di].ca : RIBBONS[di].cb);
      }
      pTarget.set(tp, i * 3);
      var ra = Math.random() * Math.PI * 2, rr = Math.random() * 0.16;
      pStart.set([Math.cos(ra) * rr, emitY + Math.random() * 0.25, Math.sin(ra) * rr], i * 3);
      pDelay[i] = Math.min(1, (tp[1] / R * 0.5 + 0.5) * 0.75 + Math.random() * 0.25); // primer a baix
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pTarget.slice(), 3));
    pGeo.setAttribute('aStart', new THREE.BufferAttribute(pStart, 3));
    pGeo.setAttribute('aTarget', new THREE.BufferAttribute(pTarget, 3));
    pGeo.setAttribute('aDelay', new THREE.BufferAttribute(pDelay, 1));
    pGeo.setAttribute('aColor', new THREE.BufferAttribute(pColor, 3));
    var pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: { uProg: { value: 0 }, uFade: { value: 0 }, uSize: { value: 2.5 }, uDpr: { value: 1 }, uEmitY: { value: emitY } },
      vertexShader: partVS, fragmentShader: partFS
    });
    var particles = new THREE.Points(pGeo, pMat);
    particles.renderOrder = 20; particles.frustumCulled = false; particles.visible = false;
    node.add(particles);
    function paintParticles() {
      for (var j = 0; j < P_TOTAL; j++) { var c = pal[pKind[j]]; pColor.set([c.r, c.g, c.b], j * 3); }
      pGeo.attributes.aColor.needsUpdate = true;
    }
    paintParticles();

    /* ---------- Interacció ---------- */
    var ray = new THREE.Raycaster(), mouse = new THREE.Vector2(9, 9), hitSphere = new THREE.Sphere();
    var hitPoint = new THREE.Vector3();
    var hovered = false, hoverK = 0, pulse = 0;
    var dragging = false, dragId = null, down = null, last = null, vel = { x: 0, y: 0 };
    var ripples = [];
    var qTmp = new THREE.Quaternion(), AX_Y = new THREE.Vector3(0, 1, 0), AX_X = new THREE.Vector3(1, 0, 0);

    function setMouse(e) {
      var r = canvas.getBoundingClientRect();
      if (!r.width) { mouse.set(9, 9); return false; }
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      return true;
    }
    function hitTest() {
      ray.setFromCamera(mouse, camera);
      hitSphere.set(node.position, R * node.scale.x);
      return ray.ray.intersectSphere(hitSphere, hitPoint);
    }
    function rotateNode(dx, dy) {
      qTmp.setFromAxisAngle(AX_Y, dx); node.quaternion.premultiply(qTmp);
      qTmp.setFromAxisAngle(AX_X, dy); node.quaternion.premultiply(qTmp);
    }
    var inst = {
      onMove: function (e) {
        if (mode !== 'anim' || !canvas.isConnected) return;
        setMouse(e);
      },
      onDown: function (e) {
        if (mode !== 'anim' || !canvas.isConnected || dragging) return;
        if (e.target && e.target.closest && e.target.closest('button, a, input, select')) return;
        if (!setMouse(e) || !hitTest()) return;
        dragging = true; dragId = e.pointerId;
        down = last = { x: e.clientX, y: e.clientY }; vel = { x: 0, y: 0 };
      },
      onUp: function (e) {
        if (!dragging || e.pointerId !== dragId) return;
        dragging = false; dragId = null;
        var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        setMouse(e);
        if (moved < 6 && hitTest()) {
          pulse = 1;
          var dir = node.worldToLocal(hitPoint.clone()).normalize();
          ripples.push({ dir: dir, t: 0 });
        }
        if (e.pointerType !== 'mouse') mouse.set(9, 9);
      },
      onCancel: function () { dragging = false; dragId = null; }
    };

    // Vidre líquid: ondula i rep ones en fer clic
    var vtx = new THREE.Vector3();
    function deformGlass(t) {
      var pos = glassGeo.attributes.position, arr = pos.array;
      var wob = 0.008 + hoverK * 0.008 + pulse * 0.03;
      for (var j = 0; j < arr.length; j += 3) {
        var x = glassBase[j], y = glassBase[j + 1], z = glassBase[j + 2];
        var d = Math.sin(x * 3.1 + t * 1.3) * Math.sin(y * 2.7 + t * 1.1) * Math.sin(z * 3.3 - t * 0.9) * wob;
        for (var q = 0; q < ripples.length; q++) {
          var rp = ripples[q];
          vtx.set(x, y, z).divideScalar(R);
          var ang = Math.acos(Math.max(-1, Math.min(1, vtx.dot(rp.dir))));
          var front = rp.t * 2.2;
          if (ang < front) d += Math.sin(ang * 10 - rp.t * 12) * Math.exp(-rp.t * 2.2) * 0.03 * (1 - ang / Math.PI);
        }
        var k = 1 + d;
        arr[j] = x * k; arr[j + 1] = y * k; arr[j + 2] = z * k;
      }
      pos.needsUpdate = true;
      glassGeo.computeVertexNormals();
    }

    /* ---------- Intro ---------- */
    // Només a la portada; la resta d'orbes apareixen ja formades.
    var introDur = S.introDur;
    var introT = mainIntro ? 0 : 1;

    /* ---------- Bucle (el crida el bundle a cada fotograma) ---------- */
    var t = 0, lastNow = 0, dirty = true, alive = true;

    function step(rdt) {
      t += rdt;

      hovered = mode === 'anim' && !!hitTest();
      hoverK += ((hovered ? 1 : 0) - hoverK) * 0.08;
      pulse = Math.max(0, pulse - rdt * 1.3);
      for (var j = ripples.length - 1; j >= 0; j--) { ripples[j].t += rdt; if (ripples[j].t > 2.2) ripples.splice(j, 1); }
      var beat = Math.sin(pulse * Math.PI);

      // L'orbe no gira sobre el seu eix: només ones interiors i flotació

      // ones
      shared.uTime.value += rdt * S.speed * (1 + hoverK * 1.2 + pulse * 2.5);
      shared.uAmp.value = S.amp * (1 + hoverK * 0.2) + beat * 0.8 * S.amp;
      shared.uThick.value = S.thick;
      shared.uThreads.value = S.threads;
      shared.uGlow.value = hoverK * 0.35 + beat * 0.9;

      // bombolla
      var s = 1 + Math.sin(t * 1.2) * 0.012 + beat * 0.06 + hoverK * 0.02;
      node.scale.setScalar(s);
      node.position.y = Math.sin(t * 0.9) * 0.05;
      deformGlass(t);
      glassMat.uniforms.uTime.value = t;
      glassMat.uniforms.uRefr.value = S.refr;
      glassMat.uniforms.uRimI.value = S.rimI;
      glassMat.uniforms.uGlow.value = hoverK * 0.35 + beat * 1.2;
      glassMat.uniforms.uCenterY.value = node.position.y;
      glassMat.uniforms.uScale.value = R * s;
      halo.position.copy(node.position); halo.scale.setScalar(s);
      haloMat.uniforms.uI.value = S.rimI * (1 + hoverK * 0.5 + beat * 1.2);
      var bloomS = S.bloom * (1 + hoverK * 0.25 + beat * 0.6);

      // intro holograma
      if (introT < 1) introT = Math.min(1, introT + rdt / introDur);
      var p = introT, playing = p < 1;
      var reveal = playing ? sstep(0.55, 0.97, p) : 1;
      glassMat.uniforms.uReveal.value = reveal;
      haloMat.uniforms.uVis.value = reveal;
      beamMat.uniforms.uI.value = playing ? sstep(0, 0.12, p) * (1 - sstep(0.7, 0.95, p)) : 0;
      beamMat.uniforms.uTime.value = t;
      emitMat.uniforms.uI.value = beamMat.uniforms.uI.value;
      beam.visible = emitter.visible = playing;
      particles.visible = playing;
      pMat.uniforms.uProg.value = Math.min(1, Math.max(0, (p - 0.05) / 0.6));
      pMat.uniforms.uFade.value = 1 - sstep(0.75, 1, p);
      return bloomS;
    }

    function render(px, pxH, bloomS) {
      sizeGL(px, pxH);
      var dpr = px / cssSize;
      glassMat.uniforms.uRes.value.set(px, pxH);
      glassMat.uniforms.uDpr.value = dpr;
      pMat.uniforms.uDpr.value = dpr;
      // 1) interior en textura  2) escena amb el vidre que la refracta
      camera.layers.set(INNER);
      GL.r.setRenderTarget(GL.innerRT);
      GL.r.render(scene, camera);
      GL.r.setRenderTarget(null);
      camera.layers.set(0);
      GL.rp.scene = scene; GL.rp.camera = camera;
      GL.bloom.strength = bloomS;
      GL.composer.render();
      ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      ctx2d.globalCompositeOperation = 'copy';
      ctx2d.drawImage(GL.r.domElement, 0, 0, px, pxH);
      ctx2d.globalCompositeOperation = 'source-over';
    }

    insts.push(inst);

    inst.setOrb = function (orbId) {
      setPalette(orbId);
      paintParticles();
      dirty = true;
    };

    inst.draw = function (scale) {
      if (!alive) return;
      var px = Math.round(Math.min(MAX_PX, cssSize * (scale || 1) * Math.min(window.devicePixelRatio || 1, 2)));
      px = Math.max(16, px);
      var pxH = Math.round(px * (cssSize + extraH) / cssSize);
      if (canvas.width !== px || canvas.height !== pxH) { canvas.width = px; canvas.height = pxH; dirty = true; }
      var now = performance.now();
      var rdt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0.016;
      lastNow = now;
      if (mode === 'static') {
        if (!dirty) return;
        // Orbes laterals del selector: un sol fotograma, ja materialitzat
        introT = 1;
        render(px, pxH, step(0.016));
        dirty = false;
        return;
      }
      render(px, pxH, step(rdt));
    };

    inst.destroy = function () {
      alive = false;
      var idx = insts.indexOf(inst);
      if (idx >= 0) insts.splice(idx, 1);
      scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    };

    return inst;
  }

  window.NexusOrb = { create: create, presets: PRESETS, presetByOrb: PRESET_BY_ORB };
})();
;
(function(){var e=document.createElement(`style`);e.textContent=`@font-face{font-family:Sansation;font-style:normal;font-display:swap;font-weight:400;src:url(fonts/sansation-latin-400-normal-CGiwGiqV.woff2)format("woff2")}@font-face{font-family:Sansation;font-style:normal;font-display:swap;font-weight:700;src:url(fonts/sansation-latin-700-normal-Bfev4161.woff2)format("woff2")}@font-face{font-family:Unbounded;font-style:normal;font-display:swap;font-weight:600;src:url(fonts/unbounded-latin-600-normal-oRSANpZr.woff2)format("woff2")}:root{--bg:#0b0f2a;--fg:#fff;--fg-muted:#aaabb4;--portada-a:#143a73;--veil-dim:#0b0f2aa6;--tut-veil:#05071ab8;--tut-ink:#07091e;--c0:#6d4aff;--c1:#e879f9;--c2:#1bd8c6;--arrow-a:#30a9ab;--arrow-b:#e879f9;--f-sans:"Sansation", system-ui, sans-serif;--f-display:"Unbounded", "Sansation", system-ui, sans-serif;--ease-out:cubic-bezier(.23, 1, .32, 1);--ease-io:cubic-bezier(.77, 0, .175, 1);--device-bg:#05071a;--device-radius:55px;--device-frame-w:14px;--device-rim-w:4px;--device-grip-out:14px;--device-bezel:#050507;--device-rim:#b7b9c0;--device-rim-dark:#6d6f77}@property --ang{syntax:"<angle>";inherits:false;initial-value:0deg}@keyframes spin-ang{to{--ang:360deg}}*,:before,:after{box-sizing:border-box}html,body{background:var(--bg);overscroll-behavior:none;height:100%;margin:0;overflow:hidden}body{font-family:var(--f-sans);color:var(--fg);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:manipulation}button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation;background:0 0;border:0;margin:0;padding:0}button:focus{outline:none}button:focus-visible{outline-offset:3px;outline:2px solid #fff}p,h1{font-weight:inherit;margin:0}img{-webkit-user-drag:none;display:block}.viewport{background:var(--bg);position:fixed;top:0;bottom:0;left:0;right:0;overflow:hidden}.device{width:402px;height:874px;transform:translate(-50%, -50%) translate(var(--dx,0px), var(--dy,0px)) scale(var(--s,1));position:absolute;top:50%;left:50%}.stage{contain:layout style;z-index:2;width:402px;height:874px;position:absolute;top:0;left:0;overflow:hidden}.device-body,.device-grip,.device-island{display:none}html.is-device .viewport{background:radial-gradient(60% 70% at 50% 40%, #143a7359, transparent 70%), var(--device-bg)}html.is-device .device{width:calc(402px + 2 * var(--device-frame-w));height:calc(874px + 2 * var(--device-frame-w))}html.is-device .stage{left:var(--device-frame-w);top:var(--device-frame-w);border-radius:var(--device-radius)}html.is-device .device-body{border-radius:calc(var(--device-radius) + var(--device-frame-w));background:var(--device-bezel);box-shadow:inset 0 0 0 var(--device-rim-w) var(--device-rim), inset 0 0 0 calc(var(--device-rim-w) + 1px) var(--device-rim-dark), 0 0 0 1px var(--device-rim-dark), 0 40px 90px #0000008c;pointer-events:none;z-index:0;display:block;position:absolute;top:0;bottom:0;left:0;right:0}html.is-device .device-grip{inset:calc(-1 * var(--device-grip-out));border-radius:calc(var(--device-radius) + var(--device-frame-w) + var(--device-grip-out));cursor:grab;touch-action:none;z-index:1;display:block;position:absolute}html.is-dragging,html.is-dragging *{cursor:grabbing!important}html.is-dragging .stage{pointer-events:none}html.is-device .device-island{left:calc(var(--device-frame-w) + 138px);top:calc(var(--device-frame-w) + 11px);pointer-events:none;z-index:3;background:#000;border-radius:18.5px;width:126px;height:37px;display:block;position:absolute}.screen{background:var(--bg);isolation:isolate;position:absolute;top:0;bottom:0;left:0;right:0;overflow:hidden}.screen>*{position:absolute}.glass{-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);box-shadow:inset 0 1px 2px #ffffff40, 0 10px 28px -6px color-mix(in srgb, var(--c0) 35%, transparent);background:linear-gradient(#ffffff29,#ffffff0d);border-radius:20px}.glass:before{content:"";border-radius:inherit;background:linear-gradient(90deg, #fff9, #ffffff1f 50%, color-mix(in srgb, var(--c2) 60%, transparent));-webkit-mask-composite:xor;pointer-events:none;padding:1px;transition:opacity .7s;position:absolute;top:0;bottom:0;left:0;right:0;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor,source-over;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}.glass-btn{text-transform:uppercase;width:354px;height:60px;transition:transform .16s var(--ease-out);font-weight:700}.glass-btn.fs-17{letter-spacing:.14em;font-size:17px}.glass-btn.fs-20{letter-spacing:.1em;font-size:20px}.glass-label{padding-left:.14em;line-height:60px;display:block;position:relative}.fs-20 .glass-label{padding-left:.1em}.glass-btn.is-pressed{transform:scale(.97)}.glass-btn.is-hidden{opacity:0}.btn-orb,.opt{background:linear-gradient(180deg, #ffffff1f, #ffffff05 60%), var(--btn-rest-tint);-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);box-shadow:inset 0 1.33px 2.66px #ffffff40, 0 10.6px 29.3px -5.3px color-mix(in srgb, var(--btn-rest-glow) 35%, transparent);transition:transform .16s var(--ease-out), box-shadow .25s var(--ease-out)}.btn-orb:before,.opt:before{background:linear-gradient(90deg, #fff9, #ffffff1f 50%, color-mix(in srgb, var(--btn-rest-stroke) 60%, transparent));padding:1.33px}.btn-fill,.btn-orb:after{border-radius:inherit;opacity:0;pointer-events:none;transition:opacity .25s var(--ease-out);position:absolute;top:0;bottom:0;left:0;right:0}.btn-fill{background:var(--btn-active-fill)}.btn-orb:after{content:"";background:var(--btn-active-stroke);-webkit-mask-composite:xor;padding:1.33px;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor,source-over;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}.btn-orb.is-pressed .btn-fill,.btn-orb.is-spinning .btn-fill,.btn-orb.is-pressed:after,.btn-orb.is-spinning:after{opacity:1}.btn-orb.is-pressed:before,.btn-orb.is-spinning:before{opacity:0}.btn-orb.is-pressed,.btn-orb.is-spinning{box-shadow:inset 0 1.33px 2.66px #ffffff40, 0 10.6px 39.9px -5.3px color-mix(in srgb, var(--btn-active-glow) 60%, transparent), 0 0 18.6px color-mix(in srgb, var(--btn-active-glow2) 30%, transparent)}.glass-btn.is-pressed.is-spinning{transform:scale(.97)}.spin-comet{display:none}.btn-orb.is-spinning .spin-comet{border-radius:inherit;pointer-events:none;z-index:1;filter:drop-shadow(0 0 4.5px #fff) drop-shadow(0 0 12px var(--btn-accent));display:block;position:absolute;top:0;bottom:0;left:0;right:0}.spin-comet-ring{border-radius:inherit;background:conic-gradient(from var(--ang), transparent 0 40%, color-mix(in srgb, var(--btn-accent) 60%, transparent) 62%, #fff 75%, #fff 88%, color-mix(in srgb, var(--btn-accent) 50%, transparent) 95%, transparent);-webkit-mask-composite:xor;padding:2px;animation:1s linear infinite spin-ang;position:absolute;top:0;bottom:0;left:0;right:0;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor,source-over;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}.glass-label{z-index:2}.tw{white-space:pre-wrap;margin:0}.tw-off{color:#0000}.decision{pointer-events:none;position:absolute;top:0;bottom:0;left:0;right:0}.opt{text-align:left;pointer-events:auto;width:354px;height:68px;position:absolute;left:24px}.opt-text{width:328px;font-size:16px;line-height:1.45;position:absolute;top:11px;left:13px}.opt-sel,.opt-ring,.opt-veil{border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .7s;position:absolute;top:0;bottom:0;left:0;right:0}.opt-sel{background:linear-gradient(90deg, color-mix(in srgb, var(--c0) 22%, transparent), color-mix(in srgb, var(--c1) 22%, transparent) 50%, color-mix(in srgb, var(--c2) 22%, transparent));box-shadow:0 0 24px color-mix(in srgb, var(--c1) 45%, transparent)}.opt-B .opt-sel{background:linear-gradient(90deg, color-mix(in srgb, var(--c2) 22%, transparent), color-mix(in srgb, var(--c0) 22%, transparent) 50%, color-mix(in srgb, var(--c1) 22%, transparent));box-shadow:0 0 24px color-mix(in srgb, var(--c2) 40%, transparent)}.opt-ring{background:conic-gradient(from var(--ang), color-mix(in srgb, var(--c0) 95%, transparent), color-mix(in srgb, var(--c1) 95%, transparent) 33%, color-mix(in srgb, var(--c2) 95%, transparent) 66%, color-mix(in srgb, var(--c0) 95%, transparent));-webkit-mask-composite:xor;padding:1.5px;animation:1.8s ease-in-out infinite paused spin-ang;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor,source-over;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}.opt-B .opt-ring{background:conic-gradient(from var(--ang), color-mix(in srgb, var(--c2) 95%, transparent), color-mix(in srgb, var(--c0) 95%, transparent) 33%, color-mix(in srgb, var(--c1) 95%, transparent) 66%, color-mix(in srgb, var(--c2) 95%, transparent))}.opt-veil{background:var(--veil-dim)}.opt.is-sel:before{opacity:0}.opt.is-sel .opt-sel,.opt.is-sel .opt-ring{opacity:1}.opt.is-sel .opt-ring{animation-play-state:running}.opt.is-dim .opt-veil{opacity:1}.holo{pointer-events:none;mix-blend-mode:lighten}.holo-video{object-fit:cover;opacity:0;width:100%;height:100%;transition:opacity .3s;position:absolute;top:0;bottom:0;left:0;right:0}.holo.is-ready .holo-video{opacity:1}.holo-fallback{background:radial-gradient(closest-side, color-mix(in srgb, var(--c1) 22%, transparent), color-mix(in srgb, var(--c0) 10%, transparent) 55%, transparent);opacity:0;border-radius:50%;transition:opacity .4s;position:absolute;top:12%;bottom:12%;left:12%;right:12%}.holo.is-missing .holo-fallback{opacity:1}.holo-still{opacity:0;max-width:none;transition:opacity .4s;position:absolute}.holo.has-still.is-missing .holo-still{opacity:1}.holo.has-still.is-missing .holo-fallback{opacity:0}.edge-glow{pointer-events:none;opacity:0;transition:opacity .35s var(--ease-out);border-radius:55px;top:0;bottom:0;left:0;right:0;overflow:hidden}.edge-glow-canvas{width:100%;height:100%;position:absolute;top:0;bottom:0;left:0;right:0}.edge-glow.is-fallback{box-shadow:inset 0 0 22px 2px color-mix(in srgb, var(--c1) 80%, transparent), inset 0 0 60px 6px color-mix(in srgb, var(--c0) 50%, transparent);animation:4s ease-in-out infinite edge-pulse}@keyframes edge-pulse{50%{filter:hue-rotate(40deg)brightness(1.2)}}.tutorial{z-index:10;top:0;bottom:0;left:0;right:0}.tut-veil{background:var(--tut-veil);position:absolute}.tut-frame{background:linear-gradient(90deg, color-mix(in srgb, var(--c0) 95%, transparent), color-mix(in srgb, var(--c1) 95%, transparent) 50%, color-mix(in srgb, var(--c2) 95%, transparent));-webkit-mask-composite:xor;padding:1.5px;position:absolute;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor,source-over;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}.tut-card{box-shadow:0 8px 28px color-mix(in srgb, var(--c1) 35%, transparent);background:#fff;border-radius:16px;position:absolute}.tut-count{color:#07091e80;font-size:12px;font-weight:700;position:absolute;top:16px;left:16px}.tut-text{width:322px;color:var(--tut-ink);font-size:15px;line-height:1.4;position:absolute;top:39px;left:16px}.tut-tri{clip-path:polygon(50% 0,100% 100%,0 100%);background:#fff;position:absolute}.tut-tri.is-down{clip-path:polygon(0 0,100% 0,50% 100%)}.tut-pill{background:radial-gradient(closest-side, color-mix(in srgb, var(--c0) 50%, transparent) 3%, color-mix(in srgb, var(--c0) 1%, transparent));letter-spacing:.04em;height:30px;color:var(--bg);transition:transform .16s var(--ease-out);border-radius:10px;font-size:13px;font-weight:700;position:absolute}.tut-pill:before{content:"";border-radius:inherit;background:linear-gradient(90deg, var(--c2), var(--c1));opacity:.7;-webkit-mask-composite:xor;padding:1px;position:absolute;top:0;bottom:0;left:0;right:0;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor,source-over;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}.tut-pill.is-pressed{transform:scale(.95)}.tut-pill-label{padding-left:.04em;position:relative}@media (prefers-reduced-motion:reduce){.spin-comet-ring,.opt-ring{animation:none}}.scr-portada-bg{background:radial-gradient(126px 486px at 50% 50%, var(--portada-a), var(--bg))}.intro-video{object-fit:cover;width:402px;height:512px;top:261px;left:0}.intro-skip{width:100%;height:100%;top:0;bottom:0;left:0;right:0}.portada-logo,.portada-mark,.portada-beams{object-fit:contain;pointer-events:none}.portada-logo.is-missing,.portada-mark.is-missing,.portada-beams.is-missing{visibility:hidden}.portada-orb{pointer-events:none}.orb-canvas{display:block}.scr-portada .glass-btn{left:24px}.sel-title{font-size:28px;font-weight:700;line-height:1.15}.sel-sub{color:#ffffffb3;font-size:16px;line-height:1.35}.sel-orb,.sel-side{pointer-events:none}.sel-side{opacity:.45;filter:blur(1.4px);transition:opacity .35s var(--ease-out)}.sel-name{text-align:center;letter-spacing:.06em;transform-origin:50% 0;width:402px;transition:transform .35s var(--ease-out);padding-left:.06em;font-size:44px;font-weight:700;line-height:1.12;top:533px;left:0;transform:translateY(-1px)scale(.7727)}.sel-tag{text-align:center;width:402px;color:var(--fg-muted);transition:opacity .35s var(--ease-out);font-size:14px;top:578px;left:2px}.sel-dots{transition:opacity .35s var(--ease-out);gap:8px;display:flex;top:663px;left:171px}.sel-dot{width:6px;height:6px;transition:width .35s var(--ease-out), background-color .35s var(--ease-out);background:#ffffff59;border-radius:3px}.sel-dot.is-on{background:#fff;width:18px}.sel-arrow{background:color-mix(in srgb, var(--c0) 28%, transparent);box-shadow:0 0 18px color-mix(in srgb, var(--c1) 35%, transparent);transition:opacity .35s var(--ease-out), transform .16s var(--ease-out);border-radius:50%;place-items:center;display:grid}.sel-arrow:before{content:"";border-radius:inherit;background:linear-gradient(90deg, var(--arrow-a), var(--arrow-b));opacity:.9;-webkit-mask-composite:xor;padding:1.5px;position:absolute;top:0;bottom:0;left:0;right:0;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor,source-over;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}.sel-arrow-r:before{background:linear-gradient(90deg, var(--arrow-b), var(--arrow-a))}.sel-arrow svg{position:relative}.sel-arrow.is-pressed{transform:scale(.94)}.act-glow{background:radial-gradient(closest-side, color-mix(in srgb, var(--c1) 95%, transparent), color-mix(in srgb, var(--c0) 70%, transparent) 35%, color-mix(in srgb, var(--c2) 35%, transparent) 65%, transparent);mix-blend-mode:screen;filter:blur(36px);opacity:0;pointer-events:none;border-radius:50%}.act-back{opacity:0;height:22px;transition:opacity .35s var(--ease-out);align-items:center;gap:11px;font-size:15px;display:flex}.scr-selector .glass-btn{left:24px}.scr-selector[data-mode=activa] .sel-name{transform:none}.scr-selector[data-mode=activa] .sel-side,.scr-selector[data-mode=activa] .sel-tag,.scr-selector[data-mode=activa] .sel-dots,.scr-selector[data-mode=activa] .sel-arrow{opacity:0;pointer-events:none}.scr-selector[data-mode=activa] .act-back{opacity:.8}.scr-selector[data-mode=activa] .edge-glow{opacity:.55}.ctx-text{font-size:21px;line-height:1.2}.scene-title{font-family:var(--f-display);font-size:24px;font-weight:600;line-height:1.2}.scene-body{font-size:17px;line-height:1.45}.scene-help{text-align:center;color:#fffc;font-size:12px}
/*$vite$:1*/`,document.head.appendChild(e);var t=768,n=120,r=1,i=()=>r;function a(e){let i=document.getElementById(`device`),a=document.getElementById(`device-grip`),o=document.documentElement,s=!1,c=0,l=0,u=0,d=0,f=null,p=()=>{i.style.setProperty(`--dx`,`${u}px`),i.style.setProperty(`--dy`,`${d}px`)},m=(e=!1)=>{if(!s){u=d=0;return}let t=430*r,i=902*r,a=e?t:Math.min(n,t),o=e?i:Math.min(n,i),f=Math.max(0,c/2+t/2-a),p=Math.max(0,l/2+i/2-o);u=Math.max(-f,Math.min(f,u)),d=Math.max(-p,Math.min(p,d))},h=()=>{c=document.getElementById(`viewport`)?.clientWidth||window.innerWidth,l=document.getElementById(`viewport`)?.clientHeight||window.innerHeight,s=c>=t,r=s?Math.min(1,(c-104)/402,(l-104)/874):Math.min(c/402,l/874),e.style.setProperty(`--s`,String(r)),(()=>{let W=s?402:c/r,H=s?874:l/r;e.style.setProperty(`--sw`,`${W}px`),e.style.setProperty(`--sh`,`${H}px`),e.style.setProperty(`--ox`,`${(W-402)/2}px`),e.style.setProperty(`--oy`,`${(H-874)/2}px`)})(),o.classList.toggle(`is-device`,s),f||m(!0),p()};a.addEventListener(`pointerdown`,e=>{!s||e.pointerType===`mouse`&&e.button!==0||(e.preventDefault(),f={id:e.pointerId,x:e.clientX,y:e.clientY,dx:u,dy:d},a.setPointerCapture(e.pointerId),o.classList.add(`is-dragging`))}),a.addEventListener(`pointermove`,e=>{f&&e.pointerId===f.id&&(u=f.dx+(e.clientX-f.x),d=f.dy+(e.clientY-f.y),m(),p())});let g=e=>{f&&e.pointerId===f.id&&(f=null,o.classList.remove(`is-dragging`),a.hasPointerCapture(e.pointerId)&&a.releasePointerCapture(e.pointerId))};a.addEventListener(`pointerup`,g),a.addEventListener(`pointercancel`,g),a.addEventListener(`lostpointercapture`,e=>g(e)),h(),window.addEventListener(`resize`,h),window.visualViewport?.addEventListener(`resize`,h)}var o=e=>{let t=parseInt(e.slice(1),16),n=`${t>>16&255}, ${t>>8&255}, ${t&255}`;return`linear-gradient(180deg, rgba(${n}, 0.26), rgba(${n}, 0.1))`},s=`#A35BF0`,c=e=>{let t=parseInt(e.slice(1),16),n=`${t>>16&255}, ${t>>8&255}, ${t&255}`;return`linear-gradient(180deg, rgba(${n}, 0.34), rgba(${n}, 0.16))`},l=`linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.1))`,u=(e,t,n,r,i)=>`linear-gradient(90deg, ${e}, #fff ${t}%, ${n} 50%, #fff ${r}%, ${i})`,d=[{id:`sora`,name:`Sora`,tagline:`Fusió de energíes`,palette:[`#6D4AFF`,`#E879F9`,`#1BD8C6`],arrowStroke:[`#30A9AB`,`#E879F9`],edge4:`#1E96E0`,figmaSet:`311:4184`,btn:{restTint:o(s),restStroke:`#1BD8C6`,restGlow:`#6D4AFF`,activeFill:c(s),activeStroke:u(`#633FC5`,25,`#37ADB3`,76,`#C462D0`),activeGlow:`#6D4AFF`,activeGlow2:`#5454B8`,accent:`#1BD8C6`}},{id:`nima`,name:`Nima`,tagline:`Càlida i propera`,palette:[`#B83AE0`,`#E879F9`,`#F7C6FF`],arrowStroke:[`#F7C6FF`,`#E879F9`],edge4:`#B83AE0`,figmaSet:`366:971`,btn:{restTint:o(`#E879F9`),restStroke:`#E879F9`,restGlow:`#E879F9`,activeFill:l,activeStroke:u(`#D6A4DA`,24,`#D883E0`,74,`#A649C2`),activeGlow:`#E879F9`,activeGlow2:`#E879F9`,accent:`#E879F9`}},{id:`luah`,name:`Luah`,tagline:`Serena i pacífica`,palette:[`#0E9F94`,`#1BD8C6`,`#9DF5EA`],arrowStroke:[`#9DF5EA`,`#1BD8C6`],edge4:`#0E9F94`,figmaSet:`369:57198`,btn:{restTint:o(`#1BD8C6`),restStroke:`#1BD8C6`,restGlow:`#1BD8C6`,activeFill:l,activeStroke:u(`#76D4CF`,24,`#47E3D7`,73,`#2CBCB1`),activeGlow:`#1BD8C6`,activeGlow2:`#1BD8C6`,accent:`#1BD8C6`}},{id:`kylo`,name:`Kylo`,tagline:`Freda i misteriosa`,palette:[`#4A2EDB`,`#6D4AFF`,`#B3A6FF`],arrowStroke:[`#B3A6FF`,`#6D4AFF`],edge4:`#4A2EDB`,figmaSet:`369:75799`,btn:{restTint:o(`#6D4AFF`),restStroke:`#6D4AFF`,restGlow:`#6D4AFF`,activeFill:l,activeStroke:u(`#9485DD`,26,`#7054E7`,76,`#553DC3`),activeGlow:`#6D4AFF`,activeGlow2:`#6D4AFF`,accent:`#6D4AFF`}}],f=e=>d.find(t=>t.id===e);function p(e,t=document.documentElement){let n=f(e);t.style.setProperty(`--c0`,n.palette[0]),t.style.setProperty(`--c1`,n.palette[1]),t.style.setProperty(`--c2`,n.palette[2]),t.style.setProperty(`--arrow-a`,n.arrowStroke[0]),t.style.setProperty(`--arrow-b`,n.arrowStroke[1]),t.style.setProperty(`--btn-rest-tint`,n.btn.restTint),t.style.setProperty(`--btn-rest-stroke`,n.btn.restStroke),t.style.setProperty(`--btn-rest-glow`,n.btn.restGlow),t.style.setProperty(`--btn-active-fill`,n.btn.activeFill),t.style.setProperty(`--btn-active-stroke`,n.btn.activeStroke),t.style.setProperty(`--btn-active-glow`,n.btn.activeGlow),t.style.setProperty(`--btn-active-glow2`,n.btn.activeGlow2),t.style.setProperty(`--btn-accent`,n.btn.accent),t.dataset.orb=e}var m=()=>({orbe:`sora`,e1:null,e2:null}),h=m();function g(){Object.assign(h,m())}function _(e,t={},n=[]){let r=document.createElement(e);for(let[e,n]of Object.entries(t))if(n!=null&&n!==!1){if(e===`class`)r.className=String(n);else if(e===`text`)r.textContent=String(n);else if(e===`style`)for(let[e,t]of Object.entries(n)){let n=typeof t==`number`&&!e.startsWith(`--`)&&e!==`opacity`&&e!==`zIndex`?`${t}px`:String(t);e.startsWith(`--`)?r.style.setProperty(e,n):r.style[e]=n}else e.startsWith(`on`)&&typeof n==`function`?r.addEventListener(e.slice(2).toLowerCase(),n):n===!0?r.setAttribute(e,``):r.setAttribute(e,String(n))}for(let e of n)e!=null&&e!==!1&&r.append(e);return r}var v=(e,t,n,r)=>({left:e,top:t,...n==null?{}:{width:n},...r==null?{}:{height:r}}),y=()=>window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;function b(e,t){let n=!1;e.addEventListener(`pointerdown`,t=>{t.button===0&&(n=!0,e.classList.add(`is-pressed`))});let r=()=>{n=!1,e.classList.remove(`is-pressed`)};e.addEventListener(`pointerup`,e=>{let i=n;r(),i&&t(e)}),e.addEventListener(`pointercancel`,r),e.addEventListener(`pointerleave`,r),e.addEventListener(`click`,e=>{e.detail===0&&t(e)})}var x=`cubic-bezier(0.23, 1, 0.32, 1)`,S=`cubic-bezier(0.77, 0, 0.175, 1)`,C=[`intro`,`portada`,`elegir`,`activa`,`context`,`tutorial`,`escena1`,`escena2A`,`escena2B`,`conclusio1`,`conclusio2`,`conclusio3`,`conclusio4`],w={intro:[`portada`],portada:[`elegir`],elegir:[`activa`],activa:[`elegir`,`context`],context:[`tutorial`,`escena1`],tutorial:[`escena1`],escena1:[`escena2A`,`escena2B`],escena2A:[`conclusio1`,`conclusio2`],escena2B:[`conclusio3`,`conclusio4`],conclusio1:[`elegir`],conclusio2:[`elegir`],conclusio3:[`elegir`],conclusio4:[`elegir`]},T=e=>e===`elegir`||e===`activa`?`selector`:e,E,D,O=null,k=null,A=null,j={},M=null,N=()=>{let e=location.hash.match(/^#\/(\w+)/);return e&&C.includes(e[1])?e[1]:null};function P(e,t,n,r){E=e,D=t,M=r??null,window.addEventListener(`hashchange`,()=>{let e=N();e&&e===A?(A=null,I(e,j)):O&&history.replaceState(null,``,`#/${O}`)}),history.replaceState(null,``,`#/${n}`),I(n,{duration:0})}function F(e,t={}){O&&w[O].includes(e)&&(A=e,j=t,location.hash=`#/${e}`)}function I(e,t){let n=k;if(O=e,M?.(e),n&&n.update&&T(e)===n.key){n.update(e);return}let r=D(e);if(r.el.classList.add(`screen`),r.el.dataset.route=e,E.append(r.el),r.enter?.(),k=r,!n)return;n.el.inert=!0;let i=y()?Math.min(t.duration??400,150):t.duration??400,a=t.easing??`cubic-bezier(0.23, 1, 0.32, 1)`;i===0?(n.leave?.(),n.el.remove()):(r.el.animate([{opacity:0},{opacity:1}],{duration:i,easing:a}),n.el.animate([{opacity:1},{opacity:0}],{duration:i,easing:a,fill:`forwards`}).finished.finally(()=>{n.leave?.(),n.el.remove()}))}var L=(e,t=[])=>_(`section`,{class:e},t),R=`./`,z=1500,B=6e3;function ee(){let e=_(`video`,{class:`intro-video`,muted:!0,playsinline:!0,autoplay:!0,preload:`auto`,"aria-hidden":`true`},[_(`source`,{src:`${R}intro/orbe-intro.webm`,type:`video/webm`}),_(`source`,{src:`${R}intro/orbe-intro.mp4`,type:`video/mp4`})]);e.muted=!0;let t=_(`button`,{type:`button`,class:`intro-skip`,"aria-label":`Saltar la introducció`}),n=L(`scr scr-portada-bg scr-intro`,[e,t]),r=!1,i=[],a=(e=300)=>{r||(r=!0,i.forEach(clearTimeout),F(`portada`,{duration:e}))};return{key:`intro`,el:n,enter(){t.addEventListener(`pointerup`,()=>a()),t.addEventListener(`click`,()=>a()),e.addEventListener(`ended`,()=>a()),e.lastElementChild?.addEventListener(`error`,()=>a(0)),e.play().catch(()=>a(0)),i.push(window.setTimeout(()=>{e.currentTime===0&&a(0)},z)),i.push(window.setTimeout(()=>a(),B))},leave(){e.pause()}}}function V(e){let t=_(`button`,{class:`glass glass-btn fs-${e.size??17}${e.orbVariant?` btn-orb`:``}`,type:`button`,"aria-label":e.ariaLabel??e.label,style:{left:e.x??24,top:e.y}},[e.orbVariant?_(`span`,{class:`btn-fill`,"aria-hidden":`true`}):null,_(`span`,{class:`spin-comet`,"aria-hidden":`true`},[_(`span`,{class:`spin-comet-ring`})]),_(`span`,{class:`glass-label`,text:e.label})]);return b(t,e.onTap),t}function H(e){"@babel/helpers - typeof";return H=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},H(e)}function te(e,t){if(H(e)!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||`default`);if(H(r)!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}function ne(e){var t=te(e,`string`);return H(t)==`symbol`?t:t+``}function U(e,t,n){return(t=ne(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}var re=`./`,ie=performance.now(),ae=150,oe=30,se=new Map,W=e=>{let t=se.get(e);return t||(t={manifest:null,sheets:[],staticImg:null,started:!1,staticStarted:!1},se.set(e,t)),t};async function ce(e){try{let t=new Image;return t.decoding=`async`,t.src=e,await t.decode(),await createImageBitmap(t)}catch{return null}}var le={frames:150,frameMs:30,size:480,cols:5,rows:5,sheets:[`sheet-0.webp`,`sheet-1.webp`,`sheet-2.webp`,`sheet-3.webp`,`sheet-4.webp`,`sheet-5.webp`]};async function G(e){let t=W(e);if(!t.started){t.started=!0;try{let n=le;t.sheets=n.sheets.map(()=>null);let r=n.cols*n.rows,i=Math.floor(de(n.frames,n.frameMs)/r),a=[...n.sheets.keys()].sort((e,t)=>(e-i+n.sheets.length)%n.sheets.length-(t-i+n.sheets.length)%n.sheets.length);for(let r of a)t.sheets[r]=await ce(`${re}orbs/${e}/${n.sheets[r]}`),t.sheets[r]&&(t.manifest=n)}catch{}}}async function K(e){let t=W(e);t.staticStarted||(t.staticStarted=!0,t.staticImg=await ce(`${re}orbs/${e}/static.webp`))}function ue(e){if(window.NexusOrb)return;let t=d.findIndex(t=>t.id===e),n=d.length;for(let e of[t-1,t+1]){let t=d[(e+n)%n];K(t.id)}G(e).then(()=>{for(let e of[t+1,t-1])G(d[(e+n)%n].id)})}function de(e,t){return y()?0:Math.floor((performance.now()-ie)/t)%e}function fe(e,t,n,r){let[i,a,o]=f(n).palette,s=t/2,c=t*.25;e.clearRect(0,0,t,t);let l=e.createRadialGradient(s,s,c*.4,s,s,c*1.6);l.addColorStop(0,q(a,.35)),l.addColorStop(.6,q(i,.12)),l.addColorStop(1,q(i,0)),e.fillStyle=l,e.fillRect(0,0,t,t);let u=r*Math.PI*2,d=s+Math.cos(u)*c*.35,p=s+Math.sin(u)*c*.35,m=e.createRadialGradient(d,p,c*.05,s,s,c);m.addColorStop(0,`#ffffff`),m.addColorStop(.25,o),m.addColorStop(.65,i),m.addColorStop(1,q(a,.85)),e.fillStyle=m,e.beginPath(),e.arc(s,s,c,0,Math.PI*2),e.fill()}function q(e,t){let n=parseInt(e.slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${t})`}var J=class{constructor(e,t,n=`anim`){U(this,`orb`,void 0),U(this,`cssSize`,void 0),U(this,`mode`,void 0),U(this,`canvas`,void 0),U(this,`ctx`,void 0),U(this,`lastKey`,``),this.orb=e,this.cssSize=t,this.mode=n,this.canvas=document.createElement(`canvas`),this.canvas.className=`orb-canvas`,this.canvas.setAttribute(`aria-hidden`,`true`),this.canvas.style.width=`${t}px`,this.canvas.style.height=`${t}px`,this.ctx=this.canvas.getContext(`2d`),this.nx=window.NexusOrb?window.NexusOrb.create({canvas:this.canvas,orb:e,size:t,mode:n}):null,this.nx||(n===`anim`?G(e):K(e)),Y.add(this),me()}setOrb(e){if(this.orb=e,this.lastKey=``,this.nx){this.nx.setOrb(e);return}this.mode===`anim`?G(e):K(e)}destroy(){Y.delete(this),this.nx&&this.nx.destroy(),this.canvas.remove()}draw(){if(!this.canvas.isConnected)return;if(this.nx){this.nx.draw(i());return}let e=W(this.orb),t=e.manifest,n=t?.size??this.cssSize*2,r=Math.round(Math.min(n,this.cssSize*i()*Math.min(devicePixelRatio||1,3)));this.canvas.width!==r&&(this.canvas.width=this.canvas.height=r,this.lastKey=``);let a=this.canvas.width;if(this.mode===`static`){let t=`s${this.orb}${+!!e.staticImg}${a}`;if(t===this.lastKey)return;this.lastKey=t,this.ctx.clearRect(0,0,a,a),e.staticImg?this.ctx.drawImage(e.staticImg,0,0,a,a):fe(this.ctx,a,this.orb,0);return}let o=t?.frames??ae,s=de(o,t?.frameMs??oe);if(t){let n=t.cols*t.rows,r=e.sheets[Math.floor(s/n)];if(r){let e=`a${this.orb}${s}${a}`;if(e===this.lastKey)return;this.lastKey=e;let i=s%n,o=r.width/t.cols;this.ctx.clearRect(0,0,a,a),this.ctx.drawImage(r,i%t.cols*o,Math.floor(i/t.cols)*o,o,o,0,0,a,a);return}if(this.lastKey.startsWith(`a${this.orb}`))return}let c=`f${this.orb}${s}${a}`;c!==this.lastKey&&(this.lastKey=c,fe(this.ctx,a,this.orb,s/o))}},Y=new Set,pe=!1;function me(){if(pe)return;pe=!0;let e=()=>{if(!document.hidden)for(let e of Y)e.draw();requestAnimationFrame(e)};requestAnimationFrame(e)}var X=`./`;function he(){let e=new J(`sora`,506,`anim`),t=_(`div`,{class:`portada-orb`,style:v(-51,214,506,506)},[e.canvas]),n=_(`img`,{class:`portada-logo`,src:`${X}img/logo.svg`,alt:`Benvinguts al 2084`,draggable:`false`,style:v(22,118,358,126)}),r=_(`img`,{class:`portada-mark`,src:`${X}img/mark.svg`,alt:``,draggable:`false`,style:v(157,65,88,18)}),i=_(`img`,{class:`portada-beams`,src:`${X}img/beams.png`,alt:``,draggable:`false`,style:v(109,582,183,188)});for(let e of[n,r,i])e.addEventListener(`error`,()=>e.classList.add(`is-missing`));return{key:`portada`,el:L(`scr scr-portada-bg scr-portada`,[i,t,r,n,V({label:`COMENÇAR`,y:760,size:17,orbVariant:!0,onTap:()=>F(`elegir`)})]),enter(){ue(`sora`)},leave(){e.destroy()}}}var ge=`
precision highp float;
uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 c4;
uniform vec4 prm;   // thickness, intensity, loop, radius
uniform vec3 dims;  // w, h, cycle
uniform vec2 res;
const float TAU = 6.2831853;

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
vec3 pick(float i) {
  if (i < 0.5) return c1;
  if (i < 1.5) return c2;
  if (i < 2.5) return c3;
  return c4;
}
vec3 palette(float x) {
  float f = fract(x) * 4.0;
  float fi = floor(f);
  float j = mod(fi + 1.0, 4.0);
  float t = smoothstep(0.0, 1.0, f - fi);
  return mix(pick(fi), pick(j), t);
}
void main() {
  vec2 uv = vec2(gl_FragCoord.x / res.x, 1.0 - gl_FragCoord.y / res.y);
  vec2 size = dims.xy;
  float ph = dims.z * TAU;
  vec2 px = uv * size;
  vec2 c = size * 0.5;
  float radius = min(prm.w, min(c.x, c.y));
  float d = sdRoundRect(px - c, c, radius);
  float e = max(-d, 0.0);
  vec2 rel = px - c;
  float ang = atan(rel.y / size.y, rel.x / size.x);
  float a = ang / TAU + 0.5;
  float w1 = sin(TAU * (a * 3.0) + 2.0 * ph);
  float w2 = cos(TAU * (a * 2.0) - 1.0 * ph);
  float w3 = sin(TAU * (a * 5.0) - 3.0 * ph);
  float wob = clamp(0.5 + 0.35 * w1 * w2 + 0.15 * w3, 0.0, 1.0);
  float th = max(prm.x * (0.5 + 1.0 * wob), 1.0);
  float glow = exp(-e / th);
  float haze = exp(-e / (th * 2.2)) * 0.18;
  float rim = exp(-e / max(prm.x * 0.08, 0.5));
  float blobA = 0.5 + 0.5 * sin(TAU * a * 2.0 + 2.0 * ph);
  float blobB = 0.7 + 0.3 * sin(TAU * a * 5.0 - 1.0 * ph);
  float pulse = (0.4 + 0.6 * blobA) * blobB;
  float shift = a + ph / TAU + 0.06 * sin(ph + a * TAU * 2.0);
  vec3 col = palette(shift);
  vec3 col2 = palette(shift + 0.37);
  vec3 base = mix(col, col2, 0.5 + 0.5 * sin(2.0 * ph + a * TAU * 3.0));
  float lum = dot(base, vec3(0.299, 0.587, 0.114));
  base = clamp(mix(vec3(lum), base, 1.3), 0.0, 1.0);
  float energy = (glow + haze) * pulse;
  float alpha = clamp((energy * 1.15 + rim * 0.5) * prm.y, 0.0, 1.0);
  float whiteMix = clamp(rim * 0.35 / (energy + rim * 0.35 + 0.001), 0.0, 1.0);
  vec3 rgb = clamp(mix(base, vec3(1.0), whiteMix), 0.0, 1.0);
  gl_FragColor = vec4(rgb * alpha, alpha);
}`,_e=`attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`,ve=e=>{let t=parseInt(e.slice(1),16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]};function ye(e){let t=_(`canvas`,{class:`edge-glow-canvas`,"aria-hidden":`true`}),n=_(`div`,{class:`edge-glow`,"aria-hidden":`true`},[t]),r=t.getContext(`webgl`,{premultipliedAlpha:!0,alpha:!0,antialias:!1}),a=e.colors,o=0,s=performance.now();if(!r)return n.classList.add(`is-fallback`),{el:n,start(){},stop(){},setColors(e){a=e}};let c=(e,t)=>{let n=r.createShader(e);return r.shaderSource(n,t),r.compileShader(n),n},l=r.createProgram();if(r.attachShader(l,c(r.VERTEX_SHADER,_e)),r.attachShader(l,c(r.FRAGMENT_SHADER,ge)),r.linkProgram(l),!r.getProgramParameter(l,r.LINK_STATUS))return n.classList.add(`is-fallback`),{el:n,start(){},stop(){},setColors(e){a=e}};r.useProgram(l);let u=r.createBuffer();r.bindBuffer(r.ARRAY_BUFFER,u),r.bufferData(r.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),r.STATIC_DRAW);let d=r.getAttribLocation(l,`p`);r.enableVertexAttribArray(d),r.vertexAttribPointer(d,2,r.FLOAT,!1,0,0);let f=e=>r.getUniformLocation(l,e),p=[f(`c1`),f(`c2`),f(`c3`),f(`c4`)],m=f(`prm`),h=f(`dims`),g=f(`res`),v=Math.max(e.loop??4,.5),b=n=>{let c=i()*Math.min(devicePixelRatio||1,2),l=Math.round(402*c),u=Math.round(874*c);(t.width!==l||t.height!==u)&&(t.width=l,t.height=u),r.viewport(0,0,l,u),a.forEach((e,t)=>r.uniform3fv(p[t],ve(e))),r.uniform4f(m,e.thickness??22,e.intensity??1.1,v,e.radius??55);let d=y()?0:(n-s)/1e3;r.uniform3f(h,402,874,d%v/v),r.uniform2f(g,l,u),r.clearColor(0,0,0,0),r.clear(r.COLOR_BUFFER_BIT),r.drawArrays(r.TRIANGLES,0,6),o=requestAnimationFrame(b)};return{el:n,start(){cancelAnimationFrame(o),o=requestAnimationFrame(b)},stop(){cancelAnimationFrame(o)},setColors(e){a=e}}}var be=350,xe=40,Se=e=>`<svg viewBox="0 0 7 14" width="7" height="14" aria-hidden="true"><path d="${e===`l`?`M6 1 1 7l5 6`:`M1 1l5 6-5 6`}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;function Ce(e){let t=d.findIndex(e=>e.id===h.orbe),n=d.length,r=e=>d[(e+n)%n],i=new J(r(t).id,400,`anim`),a=_(`div`,{class:`sel-orb`,style:v(1,170,400,400)},[i.canvas]),o=new J(r(t-1).id,220,`static`),s=new J(r(t+1).id,220,`static`),c=_(`div`,{class:`sel-side`,style:v(-60,260,220,220)},[o.canvas]),l=_(`div`,{class:`sel-side`,style:v(242,260,220,220)},[s.canvas]),u=_(`h1`,{class:`sel-title`,style:v(24,88,354),text:`Tria la teva orbe`}),f=_(`p`,{class:`sel-sub`,style:v(24,126,320),text:`El color que triïs t’acompanyarà durant tota la partida.`}),m=_(`p`,{class:`sel-name`,"aria-live":`polite`}),g=_(`p`,{class:`sel-tag`}),S=_(`div`,{class:`sel-dots`,"aria-hidden":`true`},d.map(()=>_(`span`,{class:`sel-dot`}))),C=e=>{let t=_(`button`,{type:`button`,class:`sel-arrow sel-arrow-${e}`,"aria-label":e===`l`?`Orbe anterior`:`Orbe següent`,style:v(e===`l`?79:271,640,52,52)});return t.innerHTML=Se(e),b(t,()=>P(e===`l`?-1:1)),t},w=C(`l`),T=C(`r`),E=_(`div`,{class:`act-glow`,style:v(-179,-250,760,1260),"aria-hidden":`true`}),D=ye({colors:[r(t).palette[0],r(t).palette[1],r(t).palette[2],r(t).edge4]}),O=_(`button`,{type:`button`,class:`act-back`,style:v(31,723)});O.innerHTML=`<svg viewBox="0 0 13 10" width="13" height="10" aria-hidden="true"><path d="M5.5 1 1.5 5l4 4M1.5 5H12" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Tornar enrere</span>`,b(O,()=>F(`elegir`));let k=V({label:`ACTIVAR NEXUS`,y:760,size:17,orbVariant:!0,onTap:()=>{A.dataset.mode===`elegir`?(h.orbe=r(t).id,p(h.orbe),F(`activa`,{duration:be})):F(`context`)}}),A=L(`scr scr-selector`,[u,f,c,l,a,m,g,S,E,D.el,w,T,O,k]),j=(e=r(t))=>{m.textContent=e.name,g.textContent=e.tagline,[...S.children].forEach((x,r)=>{let k=r===(t+n)%n;x.classList.toggle(`is-on`,k);x.style.background=k?({sora:`#FFFFFF`,nima:`#E879F9`,luah:`#1BD8C6`,kylo:`#6D4AFF`})[e.id]||``:``}),a.setAttribute(`aria-label`,`Orbe ${e.name}: ${e.tagline}`)},M=e=>{p(e);let t=d.find(t=>t.id===e);D.setColors([t.palette[0],t.palette[1],t.palette[2],t.edge4]),ue(e)},N=!1;function P(e){if(A.dataset.mode!==`elegir`||N)return;N=!0,t=(t+e+n)%n;let u=r(t);M(u.id);let d=y()?0:be,f=new J(r(t-e).id,400,`anim`),p=_(`div`,{class:`sel-orb is-ghost`,style:v(1,170,400,400)},[f.canvas]);a.before(p),i.setOrb(u.id);let h=60*e;p.animate([{transform:`translateX(0)`,opacity:1},{transform:`translateX(${-h}px)`,opacity:0}],{duration:d,easing:x,fill:`forwards`}).finished.finally(()=>{f.destroy(),p.remove(),N=!1}),a.animate([{transform:`translateX(${h}px)`,opacity:0},{transform:`translateX(0)`,opacity:1}],{duration:d,easing:x});for(let[e,n,i]of[[c,o,-1],[l,s,1]])e.animate([{opacity:0},{opacity:.45}],{duration:d,easing:x}),n.setOrb(r(t+i).id);for(let e of[m,g])e.animate([{opacity:0,transform:`translateX(${h/3}px)`},{opacity:1,transform:`none`}],{duration:d,easing:x});j(u)}let I=0,R=0,z=!1;A.addEventListener(`pointerdown`,e=>{e.target.closest(`button`)||(z=!0,I=e.clientX,R=e.clientY)}),A.addEventListener(`pointerup`,e=>{if(!z)return;z=!1;let t=e.clientX-I;Math.abs(t)>xe&&Math.abs(t)>Math.abs(e.clientY-R)&&P(t<0?1:-1)}),A.addEventListener(`pointercancel`,()=>z=!1);let B=(e,t)=>{let n=e===`activa`?`activa`:`elegir`;A.dataset.mode=n,k.classList.toggle(`is-spinning`,n===`activa`),O.inert=n!==`activa`;for(let e of[w,T])e.inert=n===`activa`;n===`activa`?(D.start(),t&&!y()&&E.animate([{opacity:0},{opacity:.6,offset:.35},{opacity:0}],{duration:1400,easing:`ease-in-out`})):D.stop()};return j(),M(r(t).id),{key:`selector`,el:A,enter(){B(e,!1)},update(e){B(e,!0)},leave(){D.stop();for(let e of[i,o,s])e.destroy()}}}function Z(e,t=``){let n=Array.from(e),r=_(`span`,{"aria-hidden":`true`}),i=_(`span`,{class:`tw-off`,"aria-hidden":`true`,text:e}),a=_(`p`,{class:`tw ${t}`,"aria-label":e},[r,i]),o=0,s=0,c=null,l=e=>{r.textContent=n.slice(0,e).join(``),i.textContent=n.slice(e).join(``)};l(0);let u=()=>{cancelAnimationFrame(o),clearTimeout(s),l(n.length),c?.(),c=null};return{el:a,length:n.length,finish:u,cancel(){cancelAnimationFrame(o),clearTimeout(s),c=null},start(e=0){return y()?(u(),Promise.resolve()):new Promise(t=>{c=t,s=window.setTimeout(()=>{let e=performance.now(),t=r=>{let i=Math.min(n.length,Math.floor((r-e)/17)+1);l(i),i<n.length?o=requestAnimationFrame(t):u()};o=requestAnimationFrame(t)},e)})}}}async function we(e,t){let n=e.start(0),r=t.start(e.length*17+100);await Promise.all([n,r])}var Q=`./`,Te=(e,t)=>[`${Q}holo/${e}/${t}.webm`,`${Q}holo/${e}/${t}.mp4`,`${Q}holo/${t}.webm`,`${Q}holo/${t}.mp4`],Ee=e=>e.endsWith(`.webm`)?`video/webm`:`video/mp4`,De={src:`${Q}img/ciutat.webp`,rect:{x:27.5,y:214,w:347,h:430}};function Oe(e,t,n,r){return window.NexusHolo.create({versions:e,orb:t,rect:n})}function ke(e,t){}var Ae=`Som a l’any 2084. Una intel·ligència artificial anomenada NEXUS pot gestionar gran part dels serveis de la ciutat. La teva missió és decidir fins on pot arribar el seu poder.`,je=`Torna a tocar l’opció marcada per confirmar-la`,$={escena1:{id:`escena1`,title:`Activar NEXUS`,body:`NEXUS pot gestionar la ciutat de manera més eficient si té accés a les dades dels seus habitants. Decideix quanta informació pot utilitzar.`,titleY:76,options:{A:{text:`Donar a NEXUS accés ampli a les dades per augmentar la seva capacitat de predicció.`,next:`escena2A`},B:{text:`Limitar l’accés de NEXUS per protegir la privacitat, encara que sigui menys eficient.`,next:`escena2B`}},video:{base:`1_ciudad-sin-decisiones`}},escena2A:{id:`escena2A`,title:`Predir abans que passi`,body:`NEXUS ha millorat la mobilitat, la seguretat i els serveis. Ara afirma que també pot predir qui té més probabilitats de cometre un delicte.`,titleY:72,options:{A:{text:`Permetre que la policia utilitzi les prediccions de NEXUS per intervenir preventivament.`,next:`conclusio1`},B:{text:`Prohibir-ne l’ús mentre una persona no hagi comès cap delicte.`,next:`conclusio2`}},video:{base:`2_ciudad-decision-A`}},escena2B:{id:`escena2B`,title:`Qui pren les decisions?`,body:`Una crisi energètica afecta la ciutat. NEXUS podria reaccionar més ràpid si pogués prendre decisions importants sense autorització humana.`,titleY:76,options:{A:{text:`Donar més autonomia a NEXUS per gestionar la crisi amb rapidesa.`,next:`conclusio3`},B:{text:`Mantenir les decisions importants sota control humà, encara que la resposta sigui més lenta.`,next:`conclusio4`}},video:{base:`3_ciudad-decision-B`}}},Me={conclusio1:{id:`conclusio1`,title:`La ciutat que ho sap tot`,body:`La criminalitat disminueix, però NEXUS observa i analitza permanentment els habitants. La ciutat és més segura, però també està més vigilada.`,video:{base:`4_conclusion-1`}},conclusio2:{id:`conclusio2`,title:`La línia vermella`,body:`La ciutat limita l’ús de les prediccions de NEXUS. Renuncia a part de la seva eficàcia per protegir els drets i la llibertat dels ciutadans.`,video:{base:`5_conclusion-2`}},conclusio3:{id:`conclusio3`,title:`La ciutat automàtica`,body:`NEXUS resol la crisi amb èxit i cada vegada rep més autonomia. La ciutat és molt eficient, però les persones tenen cada cop menys control sobre les decisions.`,video:{base:`6_conclusion-3`}},conclusio4:{id:`conclusio4`,title:`El control humà`,body:`La resposta a la crisi és més lenta, però les decisions continuen en mans de les persones. La ciutat accepta ser menys eficient per mantenir el control humà.`,video:{base:`7_conclusion-4`}}},Ne=[{win:{x:16,y:62,w:370,h:166,r:16},card:{x:24,y:246,w:354,h:158},tri:{x:192,y:236,dir:`up`},text:`Aquí tens el context de cada escena: què està passant a la ciutat i quina decisió has de prendre.`,btn:{x:294,y:360,w:68,label:`Entès`}},{win:{x:18,y:224,w:366,h:428,r:20},card:{x:24,y:670,w:354,h:179},tri:{x:192,y:660,dir:`up`},text:`Aquí apareixerà l’holograma de la ciutat. Canvia segons l’opció que preselecciones, perquè en vegis les conseqüències abans de decidir.`,btn:{x:294,y:805,w:68,label:`Entès`}},{win:{x:16,y:644,w:370,h:206,r:16},card:{x:24,y:447,w:354,h:179},tri:{x:192,y:625,dir:`down`},text:`Tria una de les dues opcions. Amb un toc en previsualitzes l’holograma i pots canviar d’opció. Torna a tocar l’opció marcada per confirmar-la.`,btn:{x:266,y:582,w:96,label:`Començar`}}];function Pe(){let e=Z(Ae,`ctx-text`);Object.assign(e.el.style,{left:`24px`,top:`88px`,width:`354px`});let t=V({label:`CONTINUAR`,y:760,size:20,orbVariant:!0,onTap:()=>{let tV=window.__b2084Tut;window.__b2084Tut=!0,F(tV?`escena1`:`tutorial`)}});return{key:`context`,el:L(`scr scr-context`,[e.el,t]),enter(){e.start(0),ke(h.orbe,[$.escena1.video.base])},leave(){e.cancel()}}}var Fe={A:654,B:742},Ie=13,Le=328,Re=2,ze=23.2,Be=[-.005,-.01,-.015,-.02],Ve=10,He=334,Ue=e=>Math.round(e.offsetHeight/ze);function We(e){if(e.style.letterSpacing=``,e.style.left=`${Ie}px`,e.style.width=`${Le}px`,!(Ue(e)<=Re)){for(let t of Be)if(e.style.letterSpacing=`${t}em`,Ue(e)<=Re)return;e.style.left=`${Ve}px`,e.style.width=`${He}px`;for(let t of[0,...Be])if(e.style.letterSpacing=t?`${t}em`:``,Ue(e)<=Re)return}}function Ge(e){let t=null,n=!1,r=_(`div`,{class:`decision`,role:`group`,"aria-label":`Decisió`}),i=t=>{let n=_(`button`,{type:`button`,class:`glass opt opt-${t}`,style:{top:Fe[t]},"aria-pressed":`false`},[_(`span`,{class:`opt-sel`,"aria-hidden":`true`}),_(`span`,{class:`opt-ring`,"aria-hidden":`true`}),_(`span`,{class:`opt-text`,text:e[t]}),_(`span`,{class:`opt-veil`,"aria-hidden":`true`})]);return b(n,()=>s(t)),n},a={A:i(`A`),B:i(`B`)};r.append(a.A,a.B);let o=()=>{r.dataset.sel=t??`none`;for(let n of[`A`,`B`])a[n].classList.toggle(`is-sel`,t===n),a[n].classList.toggle(`is-dim`,t!==null&&t!==n),a[n].setAttribute(`aria-pressed`,String(t===n)),a[n].setAttribute(`aria-label`,t===n?`${e[n]} (marcada: torna a tocar per confirmar)`:e[n])},s=i=>{n||(t===i?(n=!0,r.classList.add(`is-confirmed`),e.onConfirm(i)):(t=i,o(),e.onPreview(i)))};o();let c=()=>{r.isConnected?r.querySelectorAll(`.opt-text`).forEach(We):requestAnimationFrame(c)};return document.fonts.ready.then(()=>requestAnimationFrame(c)),{el:r,setInert(e){r.inert=e}}}var Ke=4,qe=500;function Je(e){let t=Array.from({length:Ke},()=>_(`div`,{class:`tut-veil`})),n=_(`div`,{class:`tut-frame`,"aria-hidden":`true`}),r=_(`span`,{class:`tut-count`}),i=_(`p`,{class:`tut-text`}),a=_(`span`,{class:`tut-pill-label`}),o=_(`button`,{type:`button`,class:`tut-pill`},[a]),s=_(`div`,{class:`tut-card`,role:`dialog`,"aria-modal":`true`},[r,i]),c=_(`div`,{class:`tut-tri`,"aria-hidden":`true`}),l=_(`div`,{class:`tutorial`},[...t,n,s,c,o]);l.addEventListener(`pointerdown`,e=>{e.target.closest(`.tut-pill`)||e.preventDefault()});let u=0,d=e=>{let{x:t,y:n,w:r,h:i}=e.win;return[{left:0,top:0,width:402,height:n},{left:0,top:n+i,width:402,height:874-(n+i)},{left:0,top:n,width:t,height:i},{left:t+r,top:n,width:402-(t+r),height:i}]},f=e=>Object.fromEntries(Object.entries(e).map(([e,t])=>[e,`${t}px`])),p=(e,r)=>{let i=r&&!y()?qe:0,a=(e,t)=>{let n=f({left:e.offsetLeft,top:e.offsetTop,width:e.offsetWidth,height:e.offsetHeight});Object.assign(e.style,f(t)),i&&e.animate([n,f(t)],{duration:i,easing:S})};d(e).forEach((e,n)=>a(t[n],e)),a(n,{left:e.win.x,top:e.win.y,width:e.win.w,height:e.win.h}),n.style.borderRadius=`${e.win.r}px`,a(s,{left:e.card.x,top:e.card.y,width:e.card.w,height:e.card.h}),a(c,{left:e.tri.x,top:e.tri.y,width:18,height:11}),c.classList.toggle(`is-down`,e.tri.dir===`down`),a(o,{left:e.btn.x,top:e.btn.y,width:e.btn.w,height:30})},m=e=>{let t=Ne[u];if(r.textContent=`${u+1} / ${Ne.length}`,i.textContent=t.text,a.textContent=t.btn.label,o.setAttribute(`aria-label`,t.btn.label),p(t,e),e&&!y())for(let e of[r,i,a])e.animate([{opacity:0},{opacity:1}],{duration:300,delay:200,easing:`ease-out`,fill:`backwards`})};return b(o,()=>{u<Ne.length-1?(u++,m(!0)):(o.disabled=!0,e())}),requestAnimationFrame(()=>m(!1)),l}var Ye=400;function Xe(e,t=!1){let n=$[e],r=Z(n.title,`scene-title`);Object.assign(r.el.style,{left:`24px`,top:`${n.titleY}px`,width:`354px`}),r.el.setAttribute(`role`,`heading`),r.el.setAttribute(`aria-level`,`1`);let i=Z(n.body,`scene-body`);Object.assign(i.el.style,{left:`24px`,top:`119px`,width:`354px`});let a=Oe(n.video,h.orbe,{x:-55,y:220,w:512,h:433},e===`escena1`?De:void 0),o=Ge({A:n.options.A.text,B:n.options.B.text,onPreview:e=>a.setChoice(e),onConfirm:t=>{e===`escena1`?h.e1=t:h.e2=t,F(n.options[t].next,{duration:Ye})}}),s=_(`p`,{class:`scene-help`,style:v(24,826,354),text:je}),c=L(`scr scr-scene`,[a.el,r.el,i.el,o.el,s]);t&&(r.finish(),i.finish(),o.setInert(!0),c.append(Je(()=>F(`escena1`,{duration:Ye}))));let l=[`A`,`B`].map(e=>{let t=n.options[e].next;return t in $?$[t].video.base:Me[t].video.base});return{key:t?`tutorial`:e,el:c,enter(){a.play(),t||we(r,i),ke(h.orbe,l)},leave(){r.cancel(),i.cancel(),a.destroy()}}}function Ze(e){let t=Me[e],n=Z(t.title,`scene-title`);Object.assign(n.el.style,{left:`24px`,top:`76px`,width:`392px`}),n.el.setAttribute(`role`,`heading`),n.el.setAttribute(`aria-level`,`1`);let r=Z(t.body,`scene-body`);Object.assign(r.el.style,{left:`24px`,top:`688px`,width:`354px`});let i=Oe(t.video,h.orbe,{x:-76,y:133,w:555,h:555}),a=V({label:`TORNAR A JUGAR`,y:760,size:17,orbVariant:!0,onTap:()=>{g(),p(h.orbe),F(`elegir`,{duration:400})}});a.classList.add(`is-hidden`),a.inert=!0;let cN=_(`button`,{type:`button`,class:`conc-next`,style:v(24,654)});cN.innerHTML=`<span>Endavant</span><svg viewBox="0 0 13 10" width="13" height="10" aria-hidden="true"><path d="M7.5 1l4 4-4 4M11.5 5H1" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;Object.assign(cN.style,{position:`absolute`,height:`22px`,display:`flex`,alignItems:`center`,gap:`6px`,padding:`0`,margin:`0`,border:`0`,background:`none`,color:`#ffffffd9`,fontFamily:`inherit`,fontSize:`15px`,cursor:`pointer`});let cF=!1,cU=()=>{if(cF)return;cF=!0,n.finish(),r.cancel(),cN.inert=!0;let cD=y()?0:400,cE=`cubic-bezier(0.23, 1, 0.32, 1)`;for(let cX of[r.el,cN])cX.animate([{opacity:1},{opacity:0}],{duration:cD,easing:cE,fill:`forwards`});i.el.animate([{transform:`none`},{transform:`translate(-1px, 26px) scale(1.0685)`}],{duration:cD,easing:cE,fill:`forwards`});a.inert=!1,a.classList.remove(`is-hidden`),cD&&a.animate([{opacity:0,filter:`blur(6px)`},{opacity:1,filter:`blur(0px)`}],{duration:cD,easing:cE})};b(cN,cU);let o=L(`scr scr-conclusion`,[i.el,n.el,r.el,cN,a]);return{key:e,el:o,enter(){i.play(),we(n,r)},leave(){n.cancel(),r.cancel(),i.destroy()}}}var Qe=document.getElementById(`viewport`),$e=document.getElementById(`stage`);a(Qe),p(h.orbe);function et(e){switch(e){case`intro`:return ee();case`portada`:return he();case`elegir`:case`activa`:return Ce(e);case`context`:return Pe();case`tutorial`:return Xe(`escena1`,!0);case`escena1`:case`escena2A`:case`escena2B`:return Xe(e);default:return Ze(e)}}P($e,et,`intro`,e=>{document.documentElement.dataset.route=e}),`serviceWorker`in navigator&&location.protocol.startsWith(`http`)&&window.addEventListener(`load`,()=>{navigator.serviceWorker.register(`./sw.js`)})})();
