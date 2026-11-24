/*
 * Resposta hàptica centralitzada · Benvinguts al 2084
 * ---------------------------------------------------
 * Tota la intensitat i el comportament s'ajusten aquí (CONFIG).
 *
 * - Android (Chrome, Samsung Internet…): Vibration API. La intensitat és la durada del pols.
 *   El bundle crida NexusHaptics.tap() quan una pulsació és vàlida.
 * - iPhone: Safari no té Vibration API. El "toc" del sistema surt en tocar un
 *   <input type="checkbox" switch>. Des d'iOS 26.5 només funciona si el toc és real (no un
 *   clic per codi), així que cada control porta a sobre una <label> transparent lligada a un
 *   interruptor amagat: el dit toca la label i iOS fa el toc. La label és filla del botó, de
 *   manera que el botó continua rebent els esdeveniments com sempre. iOS en fixa la intensitat
 *   i respecta l'ajust "Sons i vibracions del sistema".
 * - Sense suport: no fa res i el joc continua amb el feedback visual habitual.
 */
(function () {
  var CONFIG = {
    enabled: true,
    androidMs: 12,             // durada del pols a Android, en ms. 8 = molt suau · 12 = net · 20 = marcat
    minGapMs: 80,              // finestra antiduplicats: una sola vibració per acció
    iosTargets: 'button, .intro-skip' // controls que porten la capa hàptica a l'iPhone
  };

  var last = 0;
  var isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var canVibrate = !isIOS && typeof navigator.vibrate === 'function';

  // Android: un pols curt. A l'iPhone el toc el fa la capa (no cal res aquí).
  function tap() {
    if (!CONFIG.enabled || !canVibrate) return;
    var now = performance.now();
    if (now - last < CONFIG.minGapMs) return;
    last = now;
    try { navigator.vibrate(CONFIG.androidMs); } catch (e) { /* sense hàptica */ }
  }

  window.NexusHaptics = { tap: tap, config: CONFIG };

  if (!isIOS) return;

  /* ---------- iPhone: capa transparent sobre cada control ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.hap-hit{position:absolute;top:0;right:0;bottom:0;left:0;border-radius:inherit;z-index:3;' +
    'background:transparent;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}' +
    '.hap-hit input{position:absolute;left:0;top:0;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}' +
    'html.hap-off .hap-hit{display:none}';
  document.head.appendChild(css);

  function arm(el) {
    if (el.querySelector(':scope > .hap-hit')) return;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    var label = document.createElement('label');
    label.className = 'hap-hit';
    label.setAttribute('aria-hidden', 'true');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    // El clic que la label reenvia a l'interruptor no ha d'arribar al botó (evita una segona acció)
    input.addEventListener('click', function (e) { e.stopPropagation(); });
    label.appendChild(input);
    el.appendChild(label);
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches(CONFIG.iosTargets)) arm(root);
    var list = root.querySelectorAll(CONFIG.iosTargets);
    for (var i = 0; i < list.length; i++) arm(list[i]);
  }

  function start() {
    if (!CONFIG.enabled) { document.documentElement.classList.add('hap-off'); return; }
    scan(document.body);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.target.nodeType === 1 && m.target.matches(CONFIG.iosTargets)) arm(m.target);
        for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
