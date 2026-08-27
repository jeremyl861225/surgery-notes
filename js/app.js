/* 畫面與路由。所有內容都從 Store 來，這支檔案裡沒有任何一筆資料。 */
(function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon, rich = UI.rich, ward = UI.ward, chip = UI.chip;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var TABS = [
    { id: 'doctors', label: '醫師', icon: 'doctors' },
    { id: 'procs', label: '術式', icon: 'procs' },
    { id: 'search', label: '搜尋', icon: 'search' },
    { id: 'settings', label: '設定', icon: 'settings' }
  ];

  var D = null, lastTab = 'doctors', theme = 'auto';
  var idx = {};

  function reindex() {
    D = Store.data;
    idx = { doc: {}, proc: {}, byDoc: {}, byProc: {} };
    D.doctors.forEach(function (d) { idx.doc[d.id] = d; });
    D.procedures.forEach(function (p) { idx.proc[p.id] = p; });
    D.cards.forEach(function (c) {
      c.doctorIds.forEach(function (i) { (idx.byDoc[i] = idx.byDoc[i] || []).push(c); });
      (idx.byProc[c.procedureId] = idx.byProc[c.procedureId] || []).push(c);
    });
    HAY = null;
  }
  window.SN = { reindex: reindex, render: render, idx: function () { return idx; } };

  function fLabel(k) {
    var f = null;
    D.fields.forEach(function (x) { if (x.key === k) f = x; });
    return f || { key: k, zh: k, en: '' };
  }
  // 依字母排序，大小寫不計（共筆有 scope gastrectomy 這種小寫開頭的）
  function byKey(a, b) {
    return a.key.localeCompare(b.key, 'en', { sensitivity: 'base' });
  }
  function procFull(p) { return p.en + (p.zh && p.zh !== p.en ? ' · ' + p.zh : ''); }
  function docName(d) {
    return esc(d.name) + (d.empId ? '<span class="emp">' + esc(d.empId) + '</span>' : '');
  }

  /* ───────── 分頁 ───────── */

  function viewDoctors(w) {
    var all = !w || w === 'all';
    var h = '<h1 class="pane-title">醫師</h1>' +
      '<p class="pane-sub">' + D.doctors.length + ' 位主治醫師，' + D.cards.length + ' 張筆記</p>' +
      '<div class="filters" role="group" aria-label="依病房篩選">' +
      '<a class="fchip' + (all ? ' is-on' : '') + '" href="#/doctors">全部</a>' +
      D.wards.map(function (x) {
        return '<a class="fchip' + (x === w ? ' is-on' : '') + '" href="#/doctors/' + esc(x) + '">' +
          esc(x) + '</a>';
      }).join('') + '</div>';

    function rows(list) {
      if (!list.length) return '<p class="empty-row">這個病房還沒有醫師。</p>';
      return '<ul class="rows">' + list.map(function (d) {
        var n = (idx.byDoc[d.id] || []).length;
        return '<li><a class="row" href="#/d/' + d.id + '">' +
          '<span class="row-main"><span class="row-name">' + docName(d) + '</span></span>' +
          '<span class="row-meta"><span class="num">' + n + '</span> 台</span></a></li>';
      }).join('') + '</ul>';
    }

    if (all) {
      D.wards.forEach(function (x) {
        var list = D.doctors.filter(function (d) { return d.wards.indexOf(x) >= 0; });
        if (!list.length) return;
        h += '<section class="group"><h2 class="group-hd">' + ward(x) +
          '<span class="group-n">' + list.length + ' 位</span></h2>' + rows(list) + '</section>';
      });
      var none = D.doctors.filter(function (d) { return !d.wards.length; });
      if (none.length) {
        h += '<section class="group"><h2 class="group-hd">' + chip('未指定病房') +
          '<span class="group-n">' + none.length + ' 位</span></h2>' + rows(none) + '</section>';
      }
    } else {
      h += rows(D.doctors.filter(function (d) { return d.wards.indexOf(w) >= 0; }));
    }
    return h + '<a class="addbtn" href="#/new/d">' + icon('plus') + '新增醫師</a>';
  }

  function viewProcs() {
    var list = D.procedures.slice().sort(byKey);
    var h = '<h1 class="pane-title">術式</h1>' +
      '<p class="pane-sub">' + D.procedures.length + ' 個術式，依字母排序</p>' +
      '<ul class="rows rows-proc">';
    list.forEach(function (p) {
      var docs = [];
      (idx.byProc[p.id] || []).forEach(function (c) {
        c.doctorIds.forEach(function (i) { if (docs.indexOf(i) < 0) docs.push(i); });
      });
      h += '<li><a class="row" href="#/p/' + p.id + '">' +
        '<span class="row-main"><span class="row-name">' + esc(p.key) + '</span>' +
        '<span class="row-sub">' + esc(procFull(p)) + '</span></span>' +
        '<span class="row-meta"><span class="num">' + docs.length + '</span> 位</span></a></li>';
    });
    return h + '</ul><a class="addbtn" href="#/new/p">' + icon('plus') + '新增術式</a>';
  }

  /* ───────── 搜尋 ───────── */

  var HAY = null;
  function haystack() {
    if (HAY) return HAY;
    HAY = [];
    var join = function (o) {
      return D.fields.map(function (f) { return o[f.key] || ''; }).join('\n').trim();
    };
    D.cards.forEach(function (c) {
      var p = idx.proc[c.procedureId] || { key: '？', en: '', zh: '' };
      var names = c.doctorIds.map(function (i) { return (idx.doc[i] || {}).name || '？'; }).join('、');
      var body = join(c.fields);
      HAY.push({
        href: '#/c/' + c.id, title: names, sub: p.key, gen: false, body: body,
        t: (names + ' ' + p.key + ' ' + p.en + ' ' + p.zh + ' ' + (c.approach || []).join(' ') +
          ' ' + body).toLowerCase()
      });
    });
    // 通則也要搜得到：只搜卡片的話，LC 的 ICG 怎麼打這種只寫在通則裡的事永遠找不到
    D.procedures.forEach(function (p) {
      var body = join(p.general || {});
      if (!body) return;
      HAY.push({
        href: '#/p/' + p.id, title: p.key, sub: '術式通則', gen: true, body: body,
        t: (p.key + ' ' + p.en + ' ' + p.zh + ' ' + body).toLowerCase()
      });
    });
    D.doctors.forEach(function (d) {
      var body = join(d.general || {});
      if (!body) return;
      HAY.push({
        href: '#/d/' + d.id, title: d.name, sub: '醫師通則', gen: true, body: body,
        t: (d.name + ' ' + (d.empId || '') + ' ' + body).toLowerCase()
      });
    });
    return HAY;
  }

  function snippet(body, q) {
    var i = body.toLowerCase().indexOf(q);
    if (i < 0) return '';
    var s = Math.max(0, i - 22), t = body.slice(s, i + q.length + 48).replace(/\n/g, ' ');
    return (s ? '…' : '') + esc(t.slice(0, i - s)) + '<mark>' + esc(t.substr(i - s, q.length)) +
      '</mark>' + esc(t.slice(i - s + q.length)) + '…';
  }

  var HINT = '<p class="hint">醫師、術式、員編，連步驟裡的字都會一起搜。' +
    '試試「賴逸儒」、「LC」、「ICG」、「monocryl」、「腳控電刀」。</p>';

  function viewSearch() {
    return '<h1 class="pane-title">搜尋</h1>' +
      '<div class="searchbar"><label class="sr" for="q">搜尋醫師、術式或筆記內文</label>' +
      icon('search') + '<input id="q" type="search" placeholder="醫師、術式，或內文裡的字" ' +
      'autocomplete="off" autocapitalize="off" spellcheck="false"></div>' +
      '<div id="results">' + HINT + '</div>';
  }

  function runSearch(q) {
    q = q.trim().toLowerCase();
    var box = $('#results');
    if (!box) return;
    if (!q) { box.innerHTML = HINT; return; }
    var hits = haystack().filter(function (r) { return r.t.indexOf(q) >= 0; });
    if (!hits.length) { box.innerHTML = '<p class="hint">找不到「' + esc(q) + '」。</p>'; return; }
    var h = '<p class="pane-sub">' + hits.length + ' 筆</p><ul class="rows">';
    hits.slice(0, 50).forEach(function (r) {
      h += '<li><a class="row" href="' + r.href + '">' +
        '<span class="row-main"><span class="row-name">' + esc(r.title) +
        '<span class="row-x' + (r.gen ? ' row-x-gen' : '') + '">' + esc(r.sub) + '</span></span>' +
        (snippet(r.body, q) ? '<span class="row-snip">' + snippet(r.body, q) + '</span>' : '') +
        '</span></a></li>';
    });
    box.innerHTML = h + '</ul>';
  }

  /* ───────── 詳細頁 ───────── */

  function genBlock(title, hint, gen, editHref) {
    var keys = D.fields.filter(function (f) { return (gen || {})[f.key]; });
    var h = '<section class="gen"><h2 class="gen-hd">' + esc(title) +
      '<span class="gen-hint">' + esc(hint) + '</span></h2>';
    if (!keys.length) {
      h += '<p class="gen-empty">還沒有寫通則。' +
        (editHref ? '<a href="' + editHref + '">現在寫一則</a>' : '') + '</p>';
    } else {
      keys.forEach(function (f) {
        h += '<div class="gen-f"><h3>' + esc(f.zh) + '</h3>' + rich(gen[f.key], f.zh) + '</div>';
      });
    }
    return h + '</section>';
  }

  function editBtn(href) {
    return '<a class="edit-b" href="' + href + '">' + icon('pencil') + '編輯</a>';
  }

  function viewDoctor(id) {
    var d = idx.doc[id];
    if (!d) return notFound();
    var cs = (idx.byDoc[id] || []).slice().sort(function (a, b) {
      return (idx.proc[a.procedureId] || {}).key.localeCompare((idx.proc[b.procedureId] || {}).key);
    });
    var h = '<header class="detail-hd">' + editBtn('#/edit/d/' + d.id) +
      '<p class="detail-kind">醫師</p>' +
      '<h1 class="detail-name">' + esc(d.name) + '</h1>' +
      (d.empId ? '<p class="detail-emp">員編 ' + esc(d.empId) + '</p>' : '') +
      '<div class="chips">' + d.wards.map(ward).join('') + chip(cs.length + ' 台刀') + '</div>' +
      '</header>';
    if (Object.keys(d.general || {}).length) {
      h += genBlock(d.name + ' 的通則', '他開任何一台刀都這樣', d.general, '#/edit/d/' + d.id);
    }
    h += '<section class="sect"><h2 class="sect-hd">這位醫師的筆記</h2>';
    if (!cs.length) h += '<p class="empty-row">還沒有筆記。</p>';
    else {
      h += '<ul class="rows">';
      cs.forEach(function (c) {
        var p = idx.proc[c.procedureId] || { key: '？', en: '', zh: '' };
        var co = c.doctorIds.filter(function (i) { return i !== id; })
          .map(function (i) { return (idx.doc[i] || {}).name; }).filter(Boolean);
        h += '<li><a class="row" href="#/c/' + c.id + '">' +
          '<span class="row-main"><span class="row-name">' + esc(p.key) + '</span>' +
          '<span class="row-sub">' + esc(procFull(p)) +
          (co.length ? ' · 與 ' + esc(co.join('、')) + ' 共用' : '') + '</span></span>' +
          '<span class="row-tags">' + (c.approach || []).map(function (a) {
            return '<i>' + esc(a) + '</i>';
          }).join('') + '</span></a></li>';
      });
      h += '</ul>';
    }
    return h + '</section><a class="addbtn" href="#/new/c/' + d.id + '/-">' +
      icon('plus') + '幫這位醫師新增筆記</a>';
  }

  function viewProc(id) {
    var p = idx.proc[id];
    if (!p) return notFound();
    var cs = idx.byProc[id] || [];
    var h = '<header class="detail-hd">' + editBtn('#/edit/p/' + p.id) +
      '<p class="detail-kind">術式</p>' +
      '<h1 class="detail-name">' + esc(p.key) + '</h1>' +
      '<p class="detail-full">' + esc(procFull(p)) + '</p></header>';
    // 通則永遠顯示，而且排在醫師清單之上——沒寫的時候它就是「去寫一則」的入口
    h += genBlock('術式通則', '不分哪位醫師都適用', p.general, '#/edit/p/' + p.id);
    h += '<section class="sect"><h2 class="sect-hd">誰開這台刀</h2>';
    if (!cs.length) h += '<p class="empty-row">還沒有人寫這台刀的筆記。</p>';
    else {
      h += '<ul class="rows">';
      cs.forEach(function (c) {
        h += '<li><a class="row" href="#/c/' + c.id + '">' +
          '<span class="row-main"><span class="row-name">' +
          esc(c.doctorIds.map(function (i) { return (idx.doc[i] || {}).name || '？'; }).join('、')) +
          '</span></span><span class="row-tags">' +
          (c.approach || []).map(function (a) { return '<i>' + esc(a) + '</i>'; }).join('') +
          '</span></a></li>';
      });
      h += '</ul>';
    }
    return h + '</section><a class="addbtn" href="#/new/c/-/' + p.id + '">' +
      icon('plus') + '新增這台刀的筆記</a>';
  }

  function viewCard(id) {
    var c = null;
    D.cards.forEach(function (x) { if (x.id === id) c = x; });
    if (!c) return notFound();
    var p = idx.proc[c.procedureId] || { key: '？', en: '', zh: '' };
    var docs = c.doctorIds.map(function (i) { return idx.doc[i]; }).filter(Boolean);

    var h = '<header class="detail-hd">' + editBtn('#/edit/c/' + c.id) +
      '<p class="detail-kind">' +
      docs.map(function (d) {
        return '<a class="up" href="#/d/' + d.id + '">' + esc(d.name) + '</a>';
      }).join('、') + ' 的</p>' +
      '<h1 class="detail-name">' + esc(p.key) + '</h1>' +
      '<p class="detail-full"><a class="up" href="#/p/' + p.id + '">' + esc(procFull(p)) + '</a></p>' +
      '<div class="chips">' +
      docs.map(function (d) { return d.wards.map(ward).join(''); }).join('') +
      (c.approach || []).map(function (a) { return chip(a, 'chip-app'); }).join('') +
      '</div></header>';

    // 通則不再獨立成兩大段，而是拆進各個欄位裡，用淡框跟這位醫師自己寫的分開。
    // 這樣「擺位」底下就一次看得到：這台刀大家都怎麼擺、他自己怎麼擺。
    function genFrames(key, label) {
      var out = '';
      if ((p.general || {})[key]) {
        out += frame('#/p/' + p.id, esc(p.key) + ' 術式通則', '不分哪位醫師都適用',
          rich(p.general[key], label));
      }
      docs.forEach(function (d) {
        if ((d.general || {})[key]) {
          out += frame('#/d/' + d.id, esc(d.name) + ' 通則', '他開任何一台刀都這樣',
            rich(d.general[key], label));
        }
      });
      return out;
    }
    function frame(href, label, hint, body) {
      return '<div class="genbox"><a class="genbox-tag" href="' + href + '">' + label +
        '<em>' + esc(hint) + '</em></a>' + body + '</div>';
    }

    h += '<dl class="fields">';
    D.fields.forEach(function (f, i) {
      var v = c.fields[f.key];
      var g = genFrames(f.key, f.zh);
      h += '<div class="field' + (v || g ? '' : ' is-empty') + '" style="--i:' + i + '">' +
        '<dt><span class="f-zh">' + esc(f.zh) + '</span>' +
        (f.en ? '<span class="f-en">' + esc(f.en) + '</span>' : '') + '</dt>' +
        '<dd>' + g + (v ? rich(v, f.zh) : '<p class="empty">共筆沒寫</p>') + '</dd></div>';
    });
    h += '</dl>';
    if (c.updatedAt) {
      h += '<p class="stamp">最後更新 ' + esc(String(c.updatedAt).slice(0, 10).replace(/-/g, '/')) + '</p>';
    }
    return h;
  }

  function notFound() {
    return '<header class="detail-hd"><h1 class="detail-name">找不到</h1>' +
      '<p class="detail-full">這個連結指向的東西不在了。</p></header>';
  }

  /* ───────── 設定 ───────── */

  function viewSettings() {
    var d = D;
    return '<h1 class="pane-title">設定</h1>' +
      '<section class="set-block"><h2>資料</h2>' +
      '<p class="set-note">全部內容存在這台裝置上，沒有伺服器。要備份或換裝置，' +
      '就匯出一個檔案放進 Google Drive；要還原，從「檔案」App 選那個檔匯入。</p>' +
      '<div class="btns"><button class="btn btn-primary" type="button" id="do-export">匯出檔案</button>' +
      '<button class="btn" type="button" id="do-import">匯入檔案</button></div>' +
      '<p class="set-meta">目前：' + d.doctors.length + ' 位醫師 · ' + d.procedures.length +
      ' 個術式 · ' + d.cards.length + ' 張筆記 · ' + Store.imageCount() + ' 張圖</p>' +
      '<p class="set-warn">匯出檔把圖片一起包在裡面。如果卡片裡放過病人的照片，' +
      '那個檔案就帶著它——放上任何雲端之前先想一下。</p>' +
      '<div class="btns"><button class="btn btn-danger" type="button" id="do-reset">' +
      '重設回預設內容</button></div></section>' +

      '<section class="set-block"><h2>外觀</h2>' +
      '<div class="seg" role="group" aria-label="配色">' +
      ['auto', 'light', 'dark'].map(function (m) {
        return '<button type="button" class="seg-b" data-theme="' + m + '">' +
          { auto: '自動', light: '淺色', dark: '深色' }[m] + '</button>';
      }).join('') + '</div></section>' +

      '<section class="set-block"><h2>關於</h2>' +
      '<p class="set-note">資料來源：一般外科住院醫師共享備忘錄「擺位共筆」。</p>' +
      '<p class="set-note">這裡記的是各位主治醫師的個人偏好，不是診療指引，也不是台大醫院的正式文件。' +
      '臨床決策請依當台刀的實際情況與主治醫師指示。</p>' +
      '<p class="set-note">原共筆中 27 張刀房實拍照片含可辨識的病人影像，未收錄，' +
      '在內文中以一行說明標示。</p>' +
      '<p class="set-meta" id="ver"></p></section>';
  }

  /* 匯入：先把會發生什麼事講清楚，再讓使用者選 */
  function askImport(j) {
    var s = Store.summarize(j);
    var L = { doctors: '醫師', procedures: '術式', cards: '筆記' };
    var rows = Object.keys(L).map(function (k) {
      return '<tr><th>' + L[k] + '</th><td>' + s.now[k] + '</td><td>' + s.file[k] +
        '</td><td>＋' + s.add[k] + '　覆蓋 ' + s.hit[k] + '</td></tr>';
    }).join('');
    openSheet('要怎麼匯入？',
      '<table class="difftab"><thead><tr><th></th><th>現在</th><th>檔案</th>' +
      '<th>合併後</th></tr></thead><tbody>' + rows +
      '<tr><th>圖片</th><td>' + s.now.images + '</td><td>' + s.file.images + '</td><td>—</td></tr>' +
      '</tbody></table>' +
      '<p class="sheet-note"><b>取代</b>＝丟掉裝置上現有的全部，只留檔案裡的。<br>' +
      '<b>合併</b>＝同一筆以檔案為準覆蓋，檔案沒有的保留下來，不會刪東西。</p>',
      [{ label: '合併', cls: 'btn-primary', fn: function () { doImport(j, 'merge'); } },
       { label: '取代全部', cls: 'btn-danger', fn: function () { doImport(j, 'replace'); } }]);
  }

  function doImport(j, mode) {
    closeSheet();
    Store.importData(j, mode).then(function () {
      reindex(); render();
      UI.toast(mode === 'replace' ? '已取代全部內容。' : '已合併匯入。');
    }).catch(function (e) { UI.toast('匯入失敗：' + e.message); });
  }

  function exportFile() {
    Store.exportObject().then(function (o) {
      var blob = new Blob([JSON.stringify(o)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '外科手術筆記-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      UI.toast('已匯出，把它存進 Google Drive 就好。');
    });
  }

  /* ───────── 底部彈出面板 ───────── */

  var sheetActions = [];
  function openSheet(title, body, actions) {
    sheetActions = actions || [];
    $('#sheet').innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-label="' +
      esc(title) + '"><h2 class="sheet-hd">' + esc(title) + '</h2>' + body +
      '<div class="btns sheet-btns">' +
      sheetActions.map(function (a, i) {
        return '<button type="button" class="btn ' + (a.cls || '') + '" data-act="' + i + '">' +
          esc(a.label) + '</button>';
      }).join('') +
      '<button type="button" class="btn" data-act="x">取消</button></div></div>';
    $('#sheet').hidden = false;
    document.body.classList.add('locked');
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    $('#sheet').innerHTML = '';
    document.body.classList.remove('locked');
  }
  window.SN.openSheet = openSheet;
  window.SN.closeSheet = closeSheet;

  /* ───────── 燈箱 ───────── */

  function openLightbox(id) {
    var url = Store.imageUrl(id);
    if (!url) return;
    $('#lb-slot').innerHTML = '<img id="lb-img" src="' + url + '" alt="放大的手繪示意圖">';
    $('#lb').hidden = false;
    document.body.classList.add('locked');
    $('#lb-close').focus();
  }
  function closeLightbox() {
    $('#lb').hidden = true;
    $('#lb-slot').innerHTML = '';
    document.body.classList.remove('locked');
  }

  /* ───────── 配色 ───────── */

  function applyTheme(m) {
    theme = m;
    if (m === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', m);
    try { localStorage.setItem('sn-theme', m); } catch (e) { }
    syncTheme();
  }
  function syncTheme() {
    Array.prototype.forEach.call(document.querySelectorAll('.seg-b'), function (b) {
      var on = b.dataset.theme === theme;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ───────── 路由 ───────── */

  function parse() {
    var raw = location.hash.replace(/^#\/?/, '');
    try { raw = decodeURIComponent(raw); } catch (e) { }
    var h = raw.split('/').filter(Boolean);
    if (!h.length) return { tab: 'doctors' };
    if (h[0] === 'edit' || h[0] === 'new') return { mode: h[0], kind: h[1], id: h[2], id2: h[3] };
    if (h[0] === 'd') return { tab: 'doctors', kind: 'd', id: h[1] };
    if (h[0] === 'p') return { tab: 'procs', kind: 'p', id: h[1] };
    if (h[0] === 'c') return { tab: 'card', kind: 'c', id: h[1] };
    if (h[0] === 'doctors') return { tab: 'doctors', w: h[1] };
    return { tab: TABS.map(function (t) { return t.id; }).indexOf(h[0]) >= 0 ? h[0] : 'doctors' };
  }

  function render() {
    var r = parse();
    UI.resetFig();
    var main = $('#main'), body = '', deep = !!r.kind || !!r.mode;

    try {
      if (r.mode) body = Edit.view(r);
      else if (r.kind === 'd') body = viewDoctor(r.id);
      else if (r.kind === 'p') body = viewProc(r.id);
      else if (r.kind === 'c') body = viewCard(r.id);
      else if (r.tab === 'procs') body = viewProcs();
      else if (r.tab === 'search') body = viewSearch();
      else if (r.tab === 'settings') body = viewSettings();
      else body = viewDoctors(r.w);
    } catch (e) {
      body = '<header class="detail-hd"><h1 class="detail-name">出了點問題</h1>' +
        '<p class="detail-full">' + esc(e.message) + '</p></header>';
    }

    main.className = 'main' + (deep ? ' is-deep' : '') + ' view-' + (r.mode || r.kind || r.tab);
    main.innerHTML = body;
    $('#backbtn').hidden = !deep;

    var active = r.mode ? '' : (r.kind === 'c' ? lastTab : r.tab);
    if (!r.kind && !r.mode) lastTab = r.tab;
    if (r.kind === 'd') { lastTab = 'doctors'; active = 'doctors'; }
    if (r.kind === 'p') { lastTab = 'procs'; active = 'procs'; }
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      var on = b.dataset.tab === active;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });

    syncTheme();
    if (r.mode) Edit.bind(r);
    var v = $('#ver');
    if (v) v.textContent = '版本 ' + (window.SN_VERSION || '—');
    window.scrollTo(0, 0);
    if (r.tab === 'search' && !r.kind) { var q = $('#q'); if (q) q.focus(); }
  }

  /* ───────── 啟動 ───────── */

  function boot() {
    $('#tabbar').innerHTML = TABS.map(function (t) {
      return '<a class="tab" href="#/' + t.id + '" data-tab="' + t.id + '">' +
        icon(t.icon) + '<span>' + t.label + '</span></a>';
    }).join('');
    $('#backbtn').innerHTML = icon('back') + '<span>返回</span>';
    $('#lb-close').innerHTML = icon('close');

    document.addEventListener('click', function (e) {
      var f = e.target.closest('.fig-btn');
      if (f) { openLightbox(f.dataset.img); return; }
      if (e.target.closest('#lb-close') || e.target.id === 'lb') { closeLightbox(); return; }

      var a = e.target.closest('#sheet [data-act]');
      if (a) {
        if (a.dataset.act === 'x') closeSheet();
        else sheetActions[+a.dataset.act].fn();
        return;
      }
      if (e.target.id === 'sheet') { closeSheet(); return; }

      var s = e.target.closest('.seg-b');
      if (s) { applyTheme(s.dataset.theme); return; }
      if (e.target.closest('#do-export')) { exportFile(); return; }
      if (e.target.closest('#do-import')) { $('#file').click(); return; }
      if (e.target.closest('#do-reset')) {
        openSheet('重設回預設內容？',
          '<p class="sheet-note">裝置上所有的修改與新增都會消失，回到 repo 裡的 ' +
          '<code>data/seed.json</code>。這個動作沒辦法復原——先匯出一份再做。</p>',
          [{ label: '重設', cls: 'btn-danger', fn: function () {
            closeSheet();
            Store.reset().then(function () {
              reindex(); render(); UI.toast('已重設回預設內容。');
            });
          } }]);
        return;
      }
    });

    $('#file').addEventListener('change', function (e) {
      var f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      f.text().then(function (t) {
        var j;
        try { j = JSON.parse(t); } catch (err) { throw new Error('這不是一個 JSON 檔。'); }
        if (!Store.valid(j)) throw new Error('這個檔不是外科手術筆記的匯出檔。');
        askImport(j);
      }).catch(function (err) { UI.toast('讀不到：' + err.message); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('#lb').hidden) closeLightbox();
      else if (!$('#sheet').hidden) closeSheet();
    });
    document.addEventListener('input', function (e) {
      if (e.target.id === 'q') runSearch(e.target.value);
    });
    $('#backbtn').addEventListener('click', function (e) {
      e.preventDefault();
      if (history.length > 1) history.back(); else location.hash = '#/' + lastTab;
    });

    try { applyTheme(localStorage.getItem('sn-theme') || 'auto'); } catch (e) { applyTheme('auto'); }

    Store.ready().then(function () {
      reindex();
      window.addEventListener('hashchange', render);
      render();
      document.body.classList.remove('booting');
    }).catch(function (e) {
      document.body.classList.remove('booting');
      $('#main').innerHTML = '<header class="detail-hd"><h1 class="detail-name">打不開資料</h1>' +
        '<p class="detail-full">' + esc(e.message) + '</p></header>';
    });
  }

  boot();
})();
