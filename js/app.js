/* 外科手術筆記 — 導覽與渲染。
 *
 * 導覽是「造句」：〔醫師〕的〔術式〕。兩個槽哪一個先填都可以，網址就是句子：
 *   #/                    兩槽都空 → 同時給醫師軌與術式軌
 *   #/d/李柏居            只填醫師 → 這位醫師開的刀 ＋ 醫師通則
 *   #/p/SASI              只填術式 → 開這台刀的醫師 ＋ 術式通則
 *   #/d/李柏居/p/SASI     兩槽都滿 → 筆記本體
 *   #/p/SASI/vs           比較所有醫師的這台刀
 * 點詞塊上的 × 就是退詞，等於返回上一層。
 */
(function () {
  var D = window.DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var main = $('#main'), sentEl = $('#sent'), homeEl = $('#home');

  var FIELDS = [
    ['position',    'Position',        '擺位'],
    ['incision',    'Incision / Port', '切口與打洞'],
    ['instrument',  'Instruments',     '器械偏好'],
    ['steps',       'Key steps',       '重要步驟'],
    ['anastomosis', 'Anastomosis',     '吻合方式'],
    ['drain',       'Drain',           '引流放置'],
    ['closure',     'Wound closure',   '傷口關法'],
    ['dressing',    'Dressing',        '傷口包紮'],
    ['billing',     'NHI code',        '健保申報碼'],
    ['note',        'Notes',           '備註']
  ];
  var FLABEL = {}; FIELDS.forEach(function (f) { FLABEL[f[0]] = f; });

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  /* 文字裡的 [[img:檔名]] 換成圖片；其餘一律逸出。 */
  function rich(t) {
    return esc(t).split(/(\[\[img:[^\]]+\]\]|\[\[photo\]\])/).map(function (p) {
      if (p === '[[photo]]') return '<span class="withheld">共筆這裡原本有一張刀房實拍照片。照片裡有可辨識的病人影像，沒有放上這個公開網站——請直接看備忘錄。</span>';
      var m = /^\[\[img:(.+)\]\]$/.exec(p);
      return m ? '<img loading="lazy" src="img/' + encodeURIComponent(m[1]) + '" alt="手繪示意圖">' : p;
    }).join('');
  }
  var procOf = function (k) { return D.procedures.filter(function (p) { return p.key === k; })[0]; };
  var docOf  = function (n) { return D.doctors.filter(function (d) { return d.name === n; })[0]; };
  var cardsOfDoc  = function (n) { return D.cards.filter(function (c) { return c.doctors.indexOf(n) >= 0; }); };
  var cardsOfProc = function (k) { return D.cards.filter(function (c) { return c.proc === k; }); };
  var procTitle = function (p) {
    return '<span class="t">' + esc(p.en) + (p.zh ? '<span class="zh">' + esc(p.zh) + '</span>' : '') + '</span>';
  };

  /* ---------- 路由 ---------- */
  var st = { doctor: null, proc: null, vs: false };
  function readHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean).map(decodeURIComponent);
    st = { doctor: null, proc: null, vs: false };
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === 'd') st.doctor = parts[++i];
      else if (parts[i] === 'p') st.proc = parts[++i];
      else if (parts[i] === 'vs') st.vs = true;
    }
    if (st.doctor && !docOf(st.doctor)) st.doctor = null;
    if (st.proc && !procOf(st.proc)) st.proc = null;
  }
  function href(o) {
    var d = 'doctor' in o ? o.doctor : st.doctor, p = 'proc' in o ? o.proc : st.proc, v = 'vs' in o ? o.vs : false;
    var s = '#/';
    if (d) s += 'd/' + encodeURIComponent(d) + '/';
    if (p) s += 'p/' + encodeURIComponent(p) + '/';
    if (v) s += 'vs';
    return s.replace(/\/$/, '/') ;
  }

  /* ---------- 句子條 ---------- */
  function renderSent() {
    var p = st.proc ? procOf(st.proc) : null;
    var h = '';
    h += st.doctor
      ? '<a class="chip f-d" href="' + href({ doctor: null }) + '">' + esc(st.doctor) + '<span class="x">×</span></a>'
      : '<a class="slot f-d" href="#/">〔哪位醫師〕</a>';
    h += '<span class="lx">的</span>';
    h += p
      ? '<a class="chip f-p" href="' + href({ proc: null }) + '">' + esc(p.en) + '<span class="x">×</span></a>'
      : '<a class="slot f-p" href="#/">〔哪台刀〕</a>';
    sentEl.innerHTML = h;
    // 「回主頁」＝把句子清空。它是 .rail 的同層元素，不在句子裡面——
    // 放在句子裡的話，句子換行時它會被擠到自己一整行去。
    homeEl.hidden = !(st.doctor || st.proc);
  }

  /* ---------- 首頁：兩軌 ---------- */
  function viewHome() {
    var h = '';
    // 醫師依病房分群、排成方磚——20 位排成一直行太長，手機要滑三四屏才看得完。
    var byWard = {}, order = [];
    D.doctors.forEach(function (d) {
      var w = (d.wards && d.wards[0]) || '未分';
      if (!byWard[w]) { byWard[w] = []; order.push(w); }
      byWard[w].push(d);
    });
    order.sort();
    h += '<div class="sec"><div class="sec-t"><span>先選醫師</span><span class="n">' + D.doctors.length + ' 位</span></div>';
    order.forEach(function (w) {
      h += '<div class="wardgrp"><div class="wardh">' + esc(w) + '<span class="wn">' + byWard[w].length + ' 位</span></div><div class="docgrid">';
      byWard[w].forEach(function (d) {
        var n = cardsOfDoc(d.name).length;
        var hasGen = d.general && Object.keys(d.general).length;
        // 「有通則」不用符號標——◦ 接在中文名字後面看起來像句號。
        // 改用左側雙線，跟句子條的面向記號同一套語言。
        h += '<a class="doc' + (hasGen ? ' hasgen' : '') + '" href="#/d/' + encodeURIComponent(d.name) + '/"'
          + (hasGen ? ' title="這位醫師有歸納出通則"' : '') + '>'
          + '<span class="dn">' + esc(d.name) + '</span>'
          + '<span class="dc">' + n + '</span></a>';
      });
      h += '</div></div>';
    });
    h += '<p class="note-line">數字是收錄的刀數；左邊有雙線的表示這位醫師有歸納出通則。</p></div>';
    h += '<div class="sec"><div class="sec-t"><span>或先選一台刀</span><span class="n">' + D.procedures.length + ' 種</span></div><div class="lst">';
    D.procedures.forEach(function (p) {
      var n = cardsOfProc(p.key).length;
      h += '<a class="li" href="#/p/' + encodeURIComponent(p.key) + '/"><span class="main">' + procTitle(p)
        + '<span class="s">' + (p.general ? '<span class="tag">術式通則</span>' : '')
        + (n > 1 ? '<span class="tag">可比較</span>' : '') + '</span></span>'
        + '<span class="cnt' + (n > 1 ? ' hi' : '') + '">' + (n ? n + ' 位' : '—') + '</span></a>';
    });
    h += '</div></div>';
    main.innerHTML = h;
  }

  /* ---------- 醫師頁 ---------- */
  function viewDoctor() {
    var d = docOf(st.doctor), list = cardsOfDoc(d.name);
    var h = '';
    h += genBox('這位醫師的通則', d.general, '從這位醫師的多則筆記裡逐字重複出現的行歸納，沒有推論。');
    h += '<div class="sec"><div class="sec-t"><span>' + esc(d.name) + ' 開的刀</span><span class="n">' + list.length + ' 台</span></div><div class="lst">';
    list.forEach(function (c) {
      var p = procOf(c.proc);
      h += '<a class="li" href="#/d/' + encodeURIComponent(d.name) + '/p/' + encodeURIComponent(c.proc) + '/"><span class="main">'
        + procTitle(p) + '<span class="s">'
        + (c.ward ? '<span class="tag w">' + esc(c.ward) + '</span>' : '')
        + c.approach.map(function (a) { return '<span class="tag">' + esc(a) + '</span>'; }).join('')
        + '</span></span><span class="cnt">→</span></a>';
    });
    h += '</div></div>';
    main.innerHTML = h;
  }

  /* ---------- 術式頁 ---------- */
  function viewProc() {
    var p = procOf(st.proc), list = cardsOfProc(p.key);
    var h = '';
    if (p.general) h += generalProcBox(p);
    h += '<div class="sec"><div class="sec-t"><span>誰開這台刀</span><span class="n">' + list.length + ' 位</span></div>';
    if (list.length > 1) {
      h += '<div class="btnrow"><a class="btn solid" href="#/p/' + encodeURIComponent(p.key) + '/vs">並排比較這 ' + list.length + ' 位</a></div>';
    }
    h += '<div class="lst">';
    list.forEach(function (c) {
      h += '<a class="li" href="#/d/' + encodeURIComponent(c.doctors[0]) + '/p/' + encodeURIComponent(p.key) + '/"><span class="main">'
        + '<span class="t">' + esc(c.doctors.join('・')) + '</span><span class="s">'
        + (c.ward ? '<span class="tag w">' + esc(c.ward) + '</span>' : '')
        + c.approach.map(function (a) { return '<span class="tag">' + esc(a) + '</span>'; }).join('')
        + '</span></span><span class="cnt">→</span></a>';
    });
    if (!list.length) h += '<div class="empty-hint">還沒有醫師的個人筆記。按下面的「＋」開一則草稿。</div>';
    h += '</div>';
    h += '<div class="btnrow"><button class="btn" data-add="1">＋ 新增草稿</button></div></div>';
    h += '<div id="drafts"></div>';
    main.innerHTML = h;
    loadDrafts({ proc: p.key });
  }

  /* ---------- 通則區塊 ---------- */
  function genBox(title, gen, hint) {
    if (!gen || !Object.keys(gen).length) return '';
    var h = '<div class="gen"><h3>' + esc(title) + '</h3>';
    Object.keys(gen).forEach(function (f) {
      h += '<div class="gl"><b style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--dim);font-weight:400">'
        + esc(FLABEL[f] ? FLABEL[f][2] : f) + '</b></div>';
      gen[f].forEach(function (x) {
        h += '<div class="gl">· ' + esc(x.t) + '<span class="ev">見於 ' + x.n + '/' + x.of + ' 則</span></div>';
      });
    });
    if (hint) h += '<div class="note-line" style="margin-top:8px">' + esc(hint) + '</div>';
    return h + '</div>';
  }
  function generalProcBox(p) {
    var g = p.general, any = FIELDS.some(function (f) { return g.fields[f[0]]; });
    if (!any) return '';
    var h = '<div class="gen"><h3>這台刀的通則（不分醫師）</h3>';
    FIELDS.forEach(function (f) {
      var v = g.fields[f[0]]; if (!v) return;
      h += '<div class="fld" style="margin-bottom:14px"><h3>' + esc(f[1]) + '<span class="zh">' + esc(f[2]) + '</span></h3>'
        + '<div class="body">' + rich(v) + '</div></div>';
    });
    h += '<div class="note-line">來源：共筆的「' + esc(g.title) + '」。這則沒有掛醫師名，所以當成整台刀的通則；內文若提到某位老師的做法，是原文就這麼寫的。</div>';
    return h + '</div>';
  }

  /* ---------- 卡片頁 ---------- */
  function viewCard() {
    var p = procOf(st.proc), d = docOf(st.doctor);
    var c = D.cards.filter(function (x) { return x.proc === st.proc && x.doctors.indexOf(st.doctor) >= 0; })[0];
    var h = '';
    if (p.general) h += generalProcBox(p);
    h += genBox(esc(d.name) + ' 的通則（不分哪台刀都一樣）', d.general, null);

    if (!c) {
      h += '<div class="empty-hint">共筆裡還沒有「' + esc(d.name) + ' 的 ' + esc(p.en) + '」這一則。按下面的「＋」開草稿。</div>';
    } else {
      h += '<div class="sec"><div class="sec-t"><span>'
        + (c.ward ? '<span class="tag w">' + esc(c.ward) + '</span>' : '')
        + c.approach.map(function (a) { return '<span class="tag">' + esc(a) + '</span>'; }).join('')
        + (c.doctors.length > 1 ? '<span class="tag">' + esc(c.doctors.join('・')) + '</span>' : '')
        + '</span><span class="n">改於 ' + esc(String(c.modified).replace(/ 星期./, '')) + '</span></div>';
      FIELDS.forEach(function (f) {
        var v = c.fields[f[0]];
        h += '<div class="fld' + (v ? '' : ' empty') + '"><h3>' + esc(f[1]) + '<span class="zh">' + esc(f[2]) + '</span></h3>'
          + (v ? '<div class="body">' + rich(v) + '</div>' : '<div class="none">共筆沒寫</div>') + '</div>';
      });
      h += '</div>';
    }
    var others = cardsOfProc(st.proc).length;
    h += '<div class="btnrow">';
    h += '<button class="btn solid" data-add="1">＋ 新增草稿</button>';
    if (others > 1) h += '<a class="btn" href="#/p/' + encodeURIComponent(st.proc) + '/vs">跟其他 ' + (others - 1) + ' 位比較</a>';
    h += '</div><div id="drafts"></div>';
    main.innerHTML = h;
    loadDrafts({ proc: st.proc, doctor: st.doctor });
  }

  /* ---------- 比較頁 ---------- */
  function viewCompare() {
    var p = procOf(st.proc), list = cardsOfProc(p.key);
    var h = '<div class="sec"><div class="sec-t"><span>' + esc(p.en) + ' · 並排比較</span><span class="n">' + list.length + ' 位</span></div>';
    h += '<div class="cmpwrap"><table class="cmp"><thead><tr><th></th>';
    list.forEach(function (c) {
      h += '<th>' + esc(c.doctors.join('・')) + '<br><span style="font-family:var(--mono);font-size:10px;color:var(--dim);letter-spacing:.06em">'
        + esc([c.ward].concat(c.approach).filter(Boolean).join(' · ')) + '</span></th>';
    });
    h += '</tr></thead><tbody>';
    FIELDS.forEach(function (f) {
      // 這位醫師的通則行是從個別卡片扣掉的，比較時必須加回來——
      // 否則會誤顯示成「這位醫師不做這件事」，而別人（只有一則筆記、沒歸納出通則的）
      // 那一格還留著同一句話，比較的結論就整個相反。
      var vals = list.map(function (c) {
        var own = c.fields[f[0]] || '';
        var pre = [];
        c.doctors.forEach(function (dn) {
          var g = (docOf(dn) || {}).general || {};
          (g[f[0]] || []).forEach(function (x) { if (pre.indexOf(x.t) < 0) pre.push(x.t); });
        });
        return pre.length ? pre.join('\n') + (own ? '\n' + own : '') : own;
      });
      if (!vals.some(Boolean)) return;
      // 逐行比對：出現在所有「有寫這欄」的醫師身上的行 → 視為一致，壓成灰字。
      var nonEmpty = vals.filter(Boolean);
      var count = {};
      nonEmpty.forEach(function (v) {
        var seen = {};
        v.split('\n').forEach(function (l) {
          var k = l.trim(); if (!k || seen[k]) return; seen[k] = 1; count[k] = (count[k] || 0) + 1;
        });
      });
      h += '<tr><th>' + esc(f[2]) + '<br><span style="text-transform:none;letter-spacing:0;font-size:9.5px">' + esc(f[1]) + '</span></th>';
      vals.forEach(function (v) {
        if (!v) { h += '<td class="same">—</td>'; return; }
        var uniq = false;
        var body = v.split('\n').map(function (l) {
          var k = l.trim();
          if (!k) return '';
          if (/^\[\[img:/.test(k)) return rich(k);
          if (count[k] === nonEmpty.length && nonEmpty.length > 1) return '<span style="color:var(--dim)">' + rich(k) + '</span>';
          uniq = true;
          return rich(k);
        }).join('\n');
        h += '<td class="' + (uniq ? 'diff' : 'same') + '">' + body + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    h += '<p class="cmp-key">灰字＝這一欄大家都一樣；左側粗線＋底紋的格子＝這位醫師跟別人不同。空格「—」是共筆沒寫，不代表這位醫師不做。</p>';
    h += '</div>';
    main.innerHTML = h;
  }

  /* ---------- 照片 ---------- */
  /* 重新編碼有兩個作用：把 3–4 MB 的手機照壓到幾百 KB，
     以及**洗掉 EXIF**（GPS 座標與拍攝時間都在裡面，那是院內位置與時間）。 */
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.width, h = img.height, M = 1600;
        if (Math.max(w, h) > M) { var r = M / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cv.toBlob(function (b) { b ? res(b) : rej(new Error('轉檔失敗')); }, 'image/webp', 0.8);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('這個檔案讀不出圖片')); };
      img.src = url;
    });
  }

  /* ---------- 草稿 ---------- */
  function loadDrafts(filter) {
    var box = $('#drafts'); if (!box) return;
    box.innerHTML = '<div class="empty-hint">讀取草稿…</div>';
    Cloud.list(filter).then(function (rows) {
      if (!rows.length) { box.innerHTML = ''; return; }
      var h = '<div class="sec"><div class="sec-t"><span>草稿</span><span class="n">' + rows.length + ' 則</span></div>';
      rows.forEach(function (r) {
        var mine = Cloud.isMine(r.id);
        h += '<div class="draft' + (mine ? ' mine' : '') + '"><div class="dh"><span class="dbadge">草稿</span>'
          + '<span class="dmeta">' + esc(r.doctor || '未指定醫師') + ' · ' + esc(procOf(r.procedure) ? procOf(r.procedure).en : (r.procedure || '')) + '</span>'
          + '<span class="dmeta">' + esc((r.created_at || '').slice(0, 10)) + (r.author ? ' · ' + esc(r.author) : '') + '</span>'
          + (mine ? '<button class="btn" style="min-height:32px;padding:0 8px;margin-left:auto" data-del="' + esc(r.id) + '">刪除</button>' : '')
          + '</div>';
        FIELDS.forEach(function (f) {
          var v = (r.fields || {})[f[0]]; if (!v) return;
          h += '<div class="dfield"><b>' + esc(f[2]) + '</b><div>' + esc(v) + '</div></div>';
        });
        (r.photos || []).forEach(function (u) {
          h += '<img class="dphoto" loading="lazy" src="' + esc(u) + '" alt="草稿附圖">';
        });
        h += '</div>';
      });
      box.innerHTML = h + '</div>';
    });
  }

  function openForm() {
    var p = st.proc ? procOf(st.proc) : null;
    var el = document.createElement('div');
    el.className = 'sheet';
    var h = '<div class="sheet-hd"><div class="wrap"><div class="row"><span class="ttl">＋ 新增草稿</span>'
      + '<span><button class="btn" data-cancel="1">取消</button> <button class="btn solid" data-save="1">存起來</button></span></div></div></div>';
    h += '<div class="wrap">';
    h += '<div class="warnbox">草稿會馬上公開顯示給所有開這個網站的人看。寫的時候不要放病人的姓名、病歷號或任何可以認出病人的細節。</div>';
    h += '<label class="f"><span>醫師 <span class="zh">哪位主治</span></span><input type="text" id="f-doctor" list="dl-doc" value="' + esc(st.doctor || '') + '" placeholder="例如 賴逸儒"></label>';
    h += '<datalist id="dl-doc">' + D.doctors.map(function (d) { return '<option value="' + esc(d.name) + '">'; }).join('') + '</datalist>';
    h += '<label class="f"><span>術式 <span class="zh">哪台刀</span></span><input type="text" id="f-proc" list="dl-proc" value="' + esc(st.proc || '') + '" placeholder="例如 LADG"></label>';
    h += '<datalist id="dl-proc">' + D.procedures.map(function (x) { return '<option value="' + esc(x.key) + '">' + esc(x.en) + '</option>'; }).join('') + '</datalist>';
    h += '<label class="f"><span>署名 <span class="zh">選填，讓別人知道是誰寫的</span></span><input type="text" id="f-author" placeholder="留空就是匿名"></label>';
    FIELDS.forEach(function (f) {
      h += '<label class="f"><span>' + esc(f[1]) + ' <span class="zh">' + esc(f[2]) + '</span></span><textarea id="f-' + f[0] + '"></textarea></label>';
    });
    h += '<label class="f"><span>照片 <span class="zh">選填，可多張</span></span>'
      + '<input type="file" id="f-photo" accept="image/*" multiple></label>';
    h += '<div id="photobox"></div>';
    h += '<label class="okline"><input type="checkbox" id="f-ok"> '
      + '<span>我確認要上傳的照片裡<b>沒有病人的臉、身體或任何認得出是誰的東西</b>，也沒有拍到螢幕上的病人資料。</span></label>';
    h += '<div class="btnrow"><button class="btn solid" data-save="1">存起來</button><button class="btn" data-cancel="1">取消</button></div>';
    if (!Cloud.enabled()) h += '<div class="warnbox">雲端還沒設定，草稿只會存在這台裝置。設定方式見 repo 的 SETUP.md。</div>';
    h += '</div>';
    el.innerHTML = h;
    document.body.appendChild(el);
    var pics = [];   // 已經壓好、等著送出的 Blob
    $('#f-photo', el).addEventListener('change', function (ev) {
      var box = $('#photobox', el);
      Array.prototype.forEach.call(ev.target.files, function (file) {
        shrink(file).then(function (b) {
          pics.push(b);
          var fig = document.createElement('figure');
          fig.className = 'pic';
          fig.innerHTML = '<img src="' + URL.createObjectURL(b) + '" alt="">'
            + '<figcaption>' + Math.round(b.size / 1024) + ' KB'
            + '<button type="button" class="rm">移除</button></figcaption>';
          fig.querySelector('.rm').addEventListener('click', function () {
            pics.splice(pics.indexOf(b), 1); fig.remove();
          });
          box.appendChild(fig);
        }).catch(function (err) { alert(file.name + '：' + err.message); });
      });
      ev.target.value = '';
    });

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-cancel]')) { el.remove(); return; }
      if (e.target.closest('[data-save]')) {
        var rec = {
          doctor: $('#f-doctor', el).value.trim() || null,
          procedure: $('#f-proc', el).value.trim() || null,
          author: $('#f-author', el).value.trim() || null,
          ward: null, approach: null, fields: {}
        };
        var any = false;
        FIELDS.forEach(function (f) {
          var v = $('#f-' + f[0], el).value.trim();
          if (v) { rec.fields[f[0]] = v; any = true; }
        });
        if (!any && !pics.length) { alert('至少寫一個欄位，或放一張照片。'); return; }
        if (pics.length && !$('#f-ok', el).checked) {
          alert('要上傳照片的話，請先勾下面那個確認。');
          $('#f-ok', el).scrollIntoView({ block: 'center' });
          return;
        }
        e.target.disabled = true;
        e.target.textContent = pics.length ? '上傳中…' : '存起來';
        Cloud.add(rec, pics).then(function () { el.remove(); render(); })
          .catch(function (err) {
            alert('存不起來：' + err.message);
            e.target.disabled = false; e.target.textContent = '存起來';
          });
      }
    });
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-add]')) { openForm(); return; }
    var del = e.target.closest('[data-del]');
    if (del) {
      if (!confirm('刪掉這則草稿？刪了救不回來。')) return;
      Cloud.remove(del.getAttribute('data-del')).then(render)
        .catch(function (err) { alert('刪不掉：' + err.message); });
      return;
    }
    var img = e.target.closest('.fld img, .cmp img, .draft .dphoto');
    if (img) {
      var lb = document.createElement('div');
      lb.className = 'lb';
      lb.innerHTML = '<button class="cl">關閉 ×</button><img src="' + img.getAttribute('src') + '" alt="">';
      lb.addEventListener('click', function () { lb.remove(); });
      document.body.appendChild(lb);
    }
  });

  /* ---------- 主渲染 ---------- */
  function render() {
    readHash();
    renderSent();
    if (st.proc && st.vs) viewCompare();
    else if (st.doctor && st.proc) viewCard();
    else if (st.doctor) viewDoctor();
    else if (st.proc) viewProc();
    else viewHome();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);

  $('#ft-count').textContent = D.cards.length + ' 則醫師筆記、'
    + D.procedures.filter(function (p) { return p.general; }).length + ' 則術式通則，'
    + D.doctors.length + ' 位主治。';
  $('#ft-cloud').textContent = Cloud.enabled() ? '' : '（雲端尚未設定：草稿目前只存在你這台裝置。）';
  Cloud.flush();
  render();
})();
