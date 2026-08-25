/* 編輯表單。醫師、術式、卡片三種，新增與修改共用同一份。 */
window.Edit = (function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var D = function () { return Store.data; };

  var draft = null;   // 正在編的那一份（新增時是還沒進資料的物件）
  var isNew = false;

  function field(label, id, val, opts) {
    opts = opts || {};
    return '<label class="f"><span>' + esc(label) +
      (opts.hint ? ' <em>' + esc(opts.hint) + '</em>' : '') + '</span>' +
      '<input id="' + id + '" type="text" value="' + esc(val || '') + '"' +
      (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') +
      (opts.mode ? ' inputmode="' + opts.mode + '"' : '') + '></label>';
  }

  function checks(name, all, on, extraId, extraPh) {
    return '<div class="f"><span>' + esc(name) + '</span><div class="checks">' +
      all.map(function (v) {
        return '<label class="ck"><input type="checkbox" value="' + esc(v) + '"' +
          (on.indexOf(v) >= 0 ? ' checked' : '') + '><span>' + esc(v) + '</span></label>';
      }).join('') + '</div>' +
      (extraId ? '<input id="' + extraId + '" class="extra" type="text" placeholder="' +
        esc(extraPh) + '">' : '') + '</div>';
  }

  /* 一組十欄的文字區。gen=true 時是通則，不放插圖鍵以外的東西 */
  function fieldSet(vals, withImages) {
    return D().fields.map(function (f) {
      var v = vals[f.key] || '';
      return '<div class="f fset" data-key="' + f.key + '">' +
        '<span>' + esc(f.zh) + (f.en ? ' <em>' + esc(f.en) + '</em>' : '') + '</span>' +
        '<textarea data-t="' + f.key + '" rows="2">' + esc(v) + '</textarea>' +
        (withImages ? '<div class="imgrow" data-row="' + f.key + '"></div>' +
          '<button type="button" class="minib" data-addimg="' + f.key + '">' +
          icon('image') + '插入圖片</button>' : '') +
        '</div>';
    }).join('');
  }

  function readFieldSet(root) {
    var out = {};
    $$('textarea[data-t]', root).forEach(function (t) {
      var v = t.value.replace(/\s+$/, '');
      if (v) out[t.dataset.t] = v;
    });
    return out;
  }

  function head(title, sub) {
    return '<header class="detail-hd edit-hd"><p class="detail-kind">' + esc(sub) + '</p>' +
      '<h1 class="detail-name">' + esc(title) + '</h1></header>';
  }

  function footer(canDelete) {
    return '<div class="editbar">' +
      '<button type="button" class="btn btn-primary" id="save">儲存</button>' +
      '<button type="button" class="btn" id="cancel">取消</button>' +
      (canDelete ? '<button type="button" class="btn btn-danger" id="del">' +
        icon('trash') + '刪除</button>' : '') + '</div>';
  }

  /* ───────── 三種表單 ───────── */

  function viewDoctor(id) {
    var d = isNew ? { id: UI.uid('d'), name: '', empId: '', wards: [], general: {} }
      : idx().doc[id];
    if (!d) return null;
    draft = JSON.parse(JSON.stringify(d));
    return head(isNew ? '新增醫師' : d.name, '醫師') +
      '<form id="form" onsubmit="return false">' +
      field('姓名', 'f-name', d.name, { ph: '例如 黃約翰' }) +
      field('員編', 'f-emp', d.empId, { hint: '沒有就留空', ph: '例如 009025', mode: 'numeric' }) +
      checks('病房', D().wards, d.wards, 'f-ward2', '不在上面就打在這裡，例如 7B') +
      '<details class="gen-fold"' + (Object.keys(d.general || {}).length ? ' open' : '') + '>' +
      '<summary>醫師通則<em>他開任何一台刀都這樣</em></summary>' +
      fieldSet(d.general || {}, true) + '</details>' +
      footer(!isNew) + '</form>';
  }

  function viewProc(id) {
    var p = isNew ? { id: UI.uid('p'), key: '', en: '', zh: '', general: {} } : idx().proc[id];
    if (!p) return null;
    draft = JSON.parse(JSON.stringify(p));
    return head(isNew ? '新增術式' : p.key, '術式') +
      '<form id="form" onsubmit="return false">' +
      field('縮寫', 'f-key', p.key, { hint: '清單上顯示的名字', ph: '例如 LC' }) +
      field('英文全名', 'f-en', p.en, { ph: 'Laparoscopic cholecystectomy' }) +
      field('中文名', 'f-zh', p.zh, { ph: '腹腔鏡膽囊切除' }) +
      '<details class="gen-fold" open><summary>術式通則<em>不分哪位醫師都適用</em></summary>' +
      fieldSet(p.general || {}, true) + '</details>' +
      footer(!isNew) + '</form>';
  }

  function viewCard(r) {
    var c;
    if (isNew) {
      c = {
        id: UI.uid('c'),
        doctorIds: r.id && r.id !== '-' ? [r.id] : [],
        procedureId: r.id2 && r.id2 !== '-' ? r.id2 : (D().procedures[0] || {}).id,
        approach: [], fields: {}, updatedAt: null
      };
    } else {
      D().cards.forEach(function (x) { if (x.id === r.id) c = x; });
    }
    if (!c) return null;
    draft = JSON.parse(JSON.stringify(c));

    var docOpts = D().doctors.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    return head(isNew ? '新增筆記' : '編輯筆記', '一位醫師的一台刀') +
      '<form id="form" onsubmit="return false">' +
      '<div class="f"><span>醫師 <em>可以複選，一台刀兩個人開就都勾</em></span>' +
      '<div class="checks checks-doc">' + docOpts.map(function (d) {
        return '<label class="ck"><input type="checkbox" data-doc value="' + d.id + '"' +
          (c.doctorIds.indexOf(d.id) >= 0 ? ' checked' : '') + '><span>' + esc(d.name) +
          '</span></label>';
      }).join('') + '</div></div>' +
      '<label class="f"><span>術式</span><select id="f-proc">' +
      D().procedures.slice().sort(function (a, b) { return a.key.localeCompare(b.key); })
        .map(function (p) {
          return '<option value="' + p.id + '"' + (p.id === c.procedureId ? ' selected' : '') +
            '>' + esc(p.key) + '　' + esc(p.en) + '</option>';
        }).join('') + '</select></label>' +
      checks('取徑', D().approaches, c.approach || [], 'f-app2', '例如 Transoral') +
      fieldSet(c.fields || {}, true) +
      footer(!isNew) + '</form>';
  }

  function idx() { return window.SN.idx(); }

  function view(r) {
    isNew = r.mode === 'new';
    var h = r.kind === 'd' ? viewDoctor(r.id)
      : r.kind === 'p' ? viewProc(r.id)
      : r.kind === 'c' ? viewCard(r) : null;
    return h || '<header class="detail-hd"><h1 class="detail-name">找不到</h1></header>';
  }

  /* ───────── 圖片 ───────── */

  // 縮到 1600px 再轉 WebP。這一步順便把 EXIF（GPS、拍攝時間）洗掉。
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var s = Math.min(1, 1600 / Math.max(img.width, img.height));
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s);
        cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) {
          if (!b) return rej(new Error('轉檔失敗'));
          var fr = new FileReader();
          fr.onload = function () { res({ mime: b.type, b64: fr.result.split(',')[1] }); };
          fr.readAsDataURL(b);
        }, 'image/webp', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('讀不到這張圖')); };
      img.src = url;
    });
  }

  function refreshImgRows() {
    $$('.imgrow').forEach(function (row) {
      var ta = $('textarea[data-t="' + row.dataset.row + '"]');
      var ids = (ta.value.match(/\[\[img:([^\]]+)\]\]/g) || []).map(function (m) {
        return m.slice(6, -2);
      });
      row.innerHTML = ids.map(function (id) {
        var u = Store.imageUrl(id);
        if (!u) return '';
        return '<span class="thumb"><img src="' + u + '" alt=""><button type="button" ' +
          'class="thumb-x" data-rmimg="' + esc(id) + '" data-row="' + esc(row.dataset.row) +
          '" aria-label="移除這張圖">' + icon('close') + '</button></span>';
      }).join('');
    });
  }

  function addImage(key, file) {
    shrink(file).then(function (o) {
      var id = UI.uid('i');
      return Store.putImage(id, o.mime, o.b64).then(function () {
        var ta = $('textarea[data-t="' + key + '"]');
        ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + '\n' : '') + '[[img:' + id + ']]';
        refreshImgRows();
      });
    }).catch(function (e) { UI.toast(e.message); });
  }

  /* ───────── 存檔 ───────── */

  function today() { return new Date().toISOString().slice(0, 19); }

  function collectChecks(sel) {
    return $$(sel).filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
  }
  function extra(id, into) {
    var el = $(id);
    if (!el) return;
    el.value.split(/[,、\s]+/).forEach(function (v) {
      v = v.trim();
      if (v && into.indexOf(v) < 0) into.push(v);
    });
  }

  function save(r) {
    var d = D();
    if (r.kind === 'd') {
      var name = $('#f-name').value.trim();
      if (!name) return UI.toast('姓名不能空白。');
      draft.name = name;
      draft.empId = $('#f-emp').value.trim();
      draft.wards = collectChecks('.checks input[type=checkbox]');
      extra('#f-ward2', draft.wards);
      draft.wards.forEach(function (w) { if (d.wards.indexOf(w) < 0) d.wards.push(w); });
      d.wards.sort();
      draft.general = readFieldSet($('.gen-fold'));
      put(d.doctors, draft);
      return finish('#/d/' + draft.id);
    }
    if (r.kind === 'p') {
      var key = $('#f-key').value.trim();
      if (!key) return UI.toast('縮寫不能空白。');
      draft.key = key;
      draft.en = $('#f-en').value.trim();
      draft.zh = $('#f-zh').value.trim();
      draft.general = readFieldSet($('.gen-fold'));
      put(d.procedures, draft);
      return finish('#/p/' + draft.id);
    }
    var docs = collectChecks('[data-doc]');
    if (!docs.length) return UI.toast('至少要選一位醫師。');
    draft.doctorIds = docs;
    draft.procedureId = $('#f-proc').value;
    draft.approach = collectChecks('.checks input[type=checkbox]:not([data-doc])');
    extra('#f-app2', draft.approach);
    draft.approach.forEach(function (a) { if (d.approaches.indexOf(a) < 0) d.approaches.push(a); });
    draft.fields = readFieldSet($('#form'));
    draft.updatedAt = today();
    put(d.cards, draft);
    return finish('#/c/' + draft.id);
  }

  function put(list, item) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === item.id) { list[i] = item; return; }
    }
    list.push(item);
  }

  function finish(href) {
    Store.save()
      .then(function () { return Store.sweepImages(); })
      .then(function () {
        window.SN.reindex();
        if (location.hash === href) window.SN.render(); else location.hash = href;
        UI.toast('已儲存。');
      })
      .catch(function (e) { UI.toast('存不起來：' + e.message); });
  }

  function remove(r) {
    var d = D(), label, after;
    if (r.kind === 'd') {
      var used = d.cards.filter(function (c) { return c.doctorIds.indexOf(r.id) >= 0; });
      label = '刪掉這位醫師？';
      var warn = used.length
        ? '<p class="sheet-note">他名下有 ' + used.length + ' 張筆記。只掛他一個人的會一起刪掉；' +
          '跟別人共用的會留著，只把他拿掉。</p>'
        : '<p class="sheet-note">他名下沒有筆記。</p>';
      return confirmDel(label, warn, function () {
        d.cards = d.cards.filter(function (c) {
          if (c.doctorIds.indexOf(r.id) < 0) return true;
          c.doctorIds = c.doctorIds.filter(function (i) { return i !== r.id; });
          return c.doctorIds.length > 0;
        });
        d.doctors = d.doctors.filter(function (x) { return x.id !== r.id; });
        finish('#/doctors');
      });
    }
    if (r.kind === 'p') {
      var n = d.cards.filter(function (c) { return c.procedureId === r.id; }).length;
      return confirmDel('刪掉這個術式？',
        '<p class="sheet-note">' + (n ? '掛在它底下的 ' + n + ' 張筆記會一起刪掉。'
          : '底下沒有筆記。') + '</p>', function () {
          d.cards = d.cards.filter(function (c) { return c.procedureId !== r.id; });
          d.procedures = d.procedures.filter(function (x) { return x.id !== r.id; });
          finish('#/procs');
        });
    }
    after = '#/procs';
    d.cards.forEach(function (c) {
      if (c.id === r.id && c.doctorIds[0]) after = '#/d/' + c.doctorIds[0];
    });
    return confirmDel('刪掉這張筆記？',
      '<p class="sheet-note">內容不會留下備份。這個動作沒辦法復原。</p>', function () {
        d.cards = d.cards.filter(function (x) { return x.id !== r.id; });
        finish(after);
      });
  }

  function confirmDel(title, body, fn) {
    window.SN.openSheet(title, body, [{
      label: '刪除', cls: 'btn-danger',
      fn: function () { window.SN.closeSheet(); fn(); }
    }]);
  }

  /* ───────── 綁事件 ───────── */

  function grow(t) {
    t.style.height = 'auto';
    t.style.height = (t.scrollHeight + 2) + 'px';
  }

  function bind(r) {
    refreshImgRows();
    var form = $('#form');
    if (!form) return;
    $$('textarea', form).forEach(grow);
    // 已選的醫師捲進視野，不然勾了誰要自己找
    var on = $('.checks-doc input:checked');
    if (on) on.closest('.ck').scrollIntoView({ block: 'nearest' });

    form.addEventListener('click', function (e) {
      var add = e.target.closest('[data-addimg]');
      if (add) {
        var inp = $('#imgfile');
        inp.onchange = function () {
          var f = inp.files[0]; inp.value = '';
          if (f) addImage(add.dataset.addimg, f);
        };
        inp.click();
        return;
      }
      var rm = e.target.closest('[data-rmimg]');
      if (rm) {
        var ta = $('textarea[data-t="' + rm.dataset.row + '"]');
        ta.value = ta.value.split('\n').filter(function (l) {
          return l.trim() !== '[[img:' + rm.dataset.rmimg + ']]';
        }).join('\n');
        refreshImgRows();
        return;
      }
      if (e.target.closest('#save')) { save(r); return; }
      if (e.target.closest('#del')) { remove(r); return; }
      if (e.target.closest('#cancel')) {
        if (history.length > 1) history.back(); else location.hash = '#/doctors';
      }
    });

    // 打字時讓框自己長高，不然長步驟要在小框裡捲
    form.addEventListener('input', function (e) {
      if (e.target.tagName === 'TEXTAREA') grow(e.target);
    });
  }

  return { view: view, bind: bind };
})();
