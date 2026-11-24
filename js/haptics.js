/*
 * Resposta hàptica centralitzada · Benvinguts al 2084
 * ---------------------------------------------------
 * Tota la intensitat i el comportament s'ajusten aquí (CONFIG).
 *
 * - Android (Chrome, Samsung Internet…): Vibration API. La intensitat és la durada del pols.
 * - iPhone (Safari / app a la pantalla d'inici, iOS 18+): no hi ha Vibration API. Fer clic
 *   a un <input type="checkbox" switch> amagat genera el "toc" del sistema. iOS en fixa la
 *   intensitat (lleuger i curt) i respecta l'ajust de l'usuari "Sons i vibracions del sistema".
 * - Sense suport: no fa res i el joc continua amb el feedback visual habitual.
 */
(function () {
  var CONFIG = {
    enabled: true,
    androidMs: 12,  // durada del pols a Android, en ms. 8 = molt suau · 12 = net · 20 = marcat
    minGapMs: 80    // finestra antiduplicats: una sola vibració per acció encara que arribin diversos esdeveniments
  };

  var last = 0, iosLabel = null;
  var canVibrate = typeof navigator.vibrate === 'function';
  var isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function iosSwitch() {
    if (iosLabel || !document.body) return iosLabel;
    var label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosLabel = label;
    return label;
  }

  // Un pols curt. Cal cridar-lo dins del gest de l'usuari (pointerup/click), si no iOS l'ignora.
  function tap() {
    if (!CONFIG.enabled) return;
    var now = performance.now();
    if (now - last < CONFIG.minGapMs) return;
    last = now;
    try {
      if (isIOS) { var l = iosSwitch(); if (l) l.click(); }
      else if (canVibrate) navigator.vibrate(CONFIG.androidMs);
    } catch (e) { /* sense hàptica: res a fer */ }
  }

  window.NexusHaptics = { tap: tap, config: CONFIG };
})();
