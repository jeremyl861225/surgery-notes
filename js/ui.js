/* 共用的小工具：跳脫、圖示、內文渲染。app.js 與 edit.js 都會用到。 */
window.UI = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var ICONS = {
    doctors: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.2c.6-3.8 3.6-5.8 7.2-5.8s6.6 2 7.2 5.8"/>',
    // 手術刀：刀刃在右上、刀柄在左下，中間一道套環線。
    // 試過四個版本，只有這個在 22px 還看得出是刀不是筆。
    procs: '<path d="M14.6 9.4 21.4 2.6v3.2c0 2-.8 3.9-2.2 5.3l-2.8 2.8z"/>' +
           '<path d="M15.2 14.6 8 21.8a2.1 2.1 0 0 1-3-3l7.2-7.2z"/>' +
           '<path d="M12.2 11.6 15.2 14.6"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="M15.6 15.6 21 21"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v3M12 18.4v3M21.4 12h-3M5.6 12h-3M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1M18.6 18.6l-2.1-2.1M7.5 7.5 5.4 5.4"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    pencil: '<path d="M15.4 4.6 19.4 8.6 8.8 19.2 4 20l.8-4.8z"/><path d="M13.6 6.4l4 4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    image: '<rect x="3.2" y="5.2" width="17.6" height="13.6" rx="1.4"/><circle cx="8.6" cy="10.2" r="1.5"/><path d="m3.6 16.4 4.6-4.2 4.2 3.8 3-2.6 5.2 4.4"/>',
    trash: '<path d="M4.6 6.6h14.8M9.4 6.6V4.4h5.2v2.2M6.6 6.6l.9 13.2h9l.9-13.2"/>'
  };

  function icon(name, cls) {
    return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" ' +
      'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
      'stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }

  var figN = 0;
  function resetFig() { figN = 0; }

  /* 內文：處理 [[img:id]] 與 [[photo]]，其餘照原樣斷行。一個字都不改寫。 */
  function rich(text, label) {
    var lines = String(text || '').split('\n'), out = '', buf = [];
    function flush() {
      if (!buf.length) return;
      out += '<p>' + buf.map(esc).join('<br>') + '</p>';
      buf = [];
    }
    lines.forEach(function (ln) {
      var m = ln.match(/^\[\[img:(.+?)\]\]$/);
      if (m) {
        var url = Store.imageUrl(m[1]);
        if (!url) return;                    // 圖被刪掉了，安靜跳過
        flush(); figN++;
        out += '<figure class="fig">' +
          '<button class="fig-btn" type="button" data-img="' + esc(m[1]) +
          '" aria-label="放大圖 ' + figN + '">' +
          '<img src="' + url + '" alt="' + esc((label || '') + '示意圖 ' + figN) + '" loading="lazy">' +
          '</button><figcaption>圖 ' + figN + (label ? ' · ' + esc(label) : '') + '</figcaption></figure>';
        return;
      }
      if (ln.trim() === '[[photo]]') {
        flush();
        out += '<p class="withheld">原共筆此處有一張刀房實拍照片，含可辨識的病人影像，未收錄。</p>';
        return;
      }
      if (ln.trim() === '') { flush(); return; }
      buf.push(ln);
    });
    flush();
    return out;
  }

  function chip(t, cls, attrs) {
    return '<span class="chip ' + (cls || '') + '"' + (attrs || '') + '>' + esc(t) + '</span>';
  }
  function ward(w) { return chip(w, 'chip-ward', ' data-ward="' + esc(w) + '"'); }

  function uid(p) {
    return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  var toastT = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }

  return {
    esc: esc, icon: icon, rich: rich, resetFig: resetFig,
    chip: chip, ward: ward, uid: uid, toast: toast
  };
})();
