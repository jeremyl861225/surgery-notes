/* 下拉更新。
 *
 * 手勢部分沿用 Clinical-Tools/js/pull-to-refresh.js 的作法（阻尼、內層容器判斷、
 * preventDefault 擋 iOS 橡皮筋），但「更新」的意義不同：這個 App 要重抓的是
 * **別人新寫的草稿**，不是整頁重載。所以放手後做三件事——
 *   1. 把自己排隊中的草稿補傳上去
 *   2. 重畫當前頁（等於重新去 Supabase 拉一次草稿）
 *   3. 順便問 service worker 有沒有新版；真的換版了才重新載入
 * 這樣捲動位置與所在頁面都留著，比 location.reload() 好用。
 *
 * 只在 PWA 獨立視窗啟用——瀏覽器本身就有原生下拉更新，兩個搶手勢會很怪。
 * 測試時可以在網址加 ?ptr=1 強制開啟。
 */
(function () {
  'use strict';

  var forced = /[?&]ptr=1\b/.test(location.search);
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
  if (!forced && (!standalone || !('ontouchstart' in window))) return;

  var THRESHOLD = 70;    // 觸發所需的下拉距離
  var MAX_PULL = 110;    // 指示器最大下移距離
  var OFF = 52;          // 起始位置在畫面外多少 px

  var style = document.createElement('style');
  style.textContent =
    '#ptr{position:fixed;top:-' + OFF + 'px;left:50%;margin-left:-22px;' +
    /* 句子條是 sticky 且 z-index:30，指示器一定要壓在它上面，否則拉出來會被蓋住 */
    'z-index:60;width:44px;height:44px;' +
    'display:flex;align-items:center;justify-content:center;' +
    'background:var(--bg2);border:1px solid var(--line2);' +
    'font-family:var(--mono);font-size:15px;color:var(--fg2);' +
    'pointer-events:none;transition:none;}' +
    '#ptr .g{transition:transform .2s var(--ease);}' +
    '#ptr.rel .g{transform:rotate(180deg);}' +
    '#ptr.go .g{animation:ptrspin .8s linear infinite;}' +
    '@keyframes ptrspin{to{transform:rotate(360deg);}}';
  document.head.appendChild(style);

  var el = document.createElement('div');
  el.id = 'ptr';
  el.innerHTML = '<span class="g">↓</span>';
  document.body.appendChild(el);

  var startY = null, dist = 0, busy = false;

  function atTop() {
    var se = document.scrollingElement || document.documentElement;
    return se.scrollTop <= 0;
  }
  // 觸點在可往上捲的內層容器裡就不接手（比較表是自己橫向／縱向捲的）
  function innerScrolled(node) {
    while (node && node !== document.body) {
      if (node.scrollTop > 0) return true;
      node = node.parentNode;
    }
    return false;
  }
  function setPull(px) {
    el.style.transition = 'none';
    el.style.transform = 'translateY(' + px + 'px)';
    el.classList.toggle('rel', dist >= THRESHOLD);
  }
  function reset() {
    startY = null; dist = 0;
    el.style.transition = 'transform .25s var(--ease)';
    el.style.transform = 'translateY(0)';
    el.classList.remove('rel');
  }

  document.addEventListener('touchstart', function (e) {
    if (busy || !atTop() || e.touches.length !== 1 || innerScrolled(e.target)) { startY = null; return; }
    startY = e.touches[0].clientY; dist = 0;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (busy || startY === null) return;
    var dy = e.touches[0].clientY - startY;
    if (dy <= 0 || !atTop()) { if (dist > 0) reset(); return; }
    e.preventDefault();                    // 擋掉 iOS 橡皮筋，不然手勢會被搶走
    dist = Math.min(MAX_PULL, dy * 0.5);   // 阻尼：拉 2px 移 1px
    setPull(dist + OFF);
  }, { passive: false });

  /** 問 service worker 有沒有新版；有的話回 true（呼叫端才重新載入）。 */
  function checkUpdate() {
    if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistration) return Promise.resolve(false);
    return navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg) return false;
      return reg.update().then(function () {
        return !!(reg.installing || reg.waiting);
      }).catch(function () { return false; });
    }).catch(function () { return false; });
  }

  document.addEventListener('touchend', function () {
    if (busy || startY === null) return;
    if (dist < THRESHOLD) { reset(); return; }

    busy = true;
    el.classList.remove('rel');
    el.classList.add('go');
    el.style.transition = 'transform .2s var(--ease)';
    el.style.transform = 'translateY(' + (THRESHOLD + OFF) + 'px)';

    var t0 = Date.now();
    Promise.all([
      window.Cloud ? Cloud.flush().catch(function () {}) : null,
      checkUpdate()
    ]).then(function (r) {
      if (r[1]) { location.reload(); return; }
      if (window.SN && SN.refresh) SN.refresh();   // 重畫＝重新去雲端拉草稿
      // 至少轉滿 500ms，不然快到看不出有更新過，會以為沒反應
      return new Promise(function (res) { setTimeout(res, Math.max(0, 500 - (Date.now() - t0))); });
    }).then(function () {
      busy = false;
      el.classList.remove('go');
      reset();
    });
  }, { passive: true });
})();
