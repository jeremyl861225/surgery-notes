/* 資料層：全部住在這台裝置的 IndexedDB，唯一的搬運方式是匯出／匯入一個 JSON 檔。
   圖片跟內容分開存——內容一改就得整包重寫，圖片有 1.4 MB，混在一起每次存檔都會卡。 */
window.Store = (function () {
  'use strict';
  var NAME = 'surgery-notes', VER = 1;
  var db = null;
  var core = null;          // 除了 images 以外的全部內容
  var meta = {};            // { seedVersion, dirty } — 判斷要不要自動更新預設內容
  var urls = {};            // id -> object URL，畫面上用這個
  var imgIds = [];

  function req(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function store(name, mode) {
    return db.transaction(name, mode || 'readonly').objectStore(name);
  }
  function done(tx) {
    return new Promise(function (res, rej) {
      tx.oncomplete = function () { res(); };
      tx.onerror = function () { rej(tx.error); };
      tx.onabort = function () { rej(tx.error); };
    });
  }

  function openDb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('images')) d.createObjectStore('images', { keyPath: 'id' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  function b64ToBlob(b64, mime) {
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: mime || 'image/webp' });
  }

  function refreshUrls() {
    Object.keys(urls).forEach(function (k) { URL.revokeObjectURL(urls[k]); });
    urls = {}; imgIds = [];
    return req(store('images').getAll()).then(function (list) {
      list.forEach(function (im) {
        imgIds.push(im.id);
        urls[im.id] = URL.createObjectURL(b64ToBlob(im.data, im.mime));
      });
    });
  }

  function persist(dirty) {
    if (dirty) meta.dirty = true;
    var tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(core, 'data');
    tx.objectStore('kv').put(meta, 'meta');
    return done(tx);
  }

  // 一定要帶 cache-busting 的查詢字串：service worker 是 stale-while-revalidate，
  // 光靠 fetch 的 cache 選項擋不住它先回舊的那一份。
  function fetchSeed() {
    return fetch('data/seed.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('讀不到預設檔 data/seed.json（HTTP ' + r.status + '）');
        return r.json();
      })
      .then(function (j) {
        if (!valid(j)) throw new Error('data/seed.json 格式不對');
        return j;
      });
  }

  function valid(j) {
    return !!(j && j.format === 'surgery-notes' && Array.isArray(j.doctors) &&
      Array.isArray(j.procedures) && Array.isArray(j.cards) && Array.isArray(j.fields));
  }

  function byId(list) {
    var m = {}; list.forEach(function (x) { m[x.id] = x; }); return m;
  }

  function write(j, mode) {
    var imgs = j.images || [];
    var incoming = {};
    Object.keys(j).forEach(function (k) { if (k !== 'images') incoming[k] = j[k]; });

    var tx = db.transaction(['kv', 'images'], 'readwrite');
    var ks = tx.objectStore('kv'), is = tx.objectStore('images');

    if (mode === 'replace') {
      is.clear();
      core = incoming;
    } else {
      ['doctors', 'procedures', 'cards'].forEach(function (k) {
        var have = byId(core[k]);
        incoming[k].forEach(function (x) {
          if (have[x.id]) {
            var i = core[k].indexOf(have[x.id]);
            core[k][i] = x;                       // 同 id 以檔案為準
          } else core[k].push(x);
        });
      });
      ['wards', 'approaches'].forEach(function (k) {
        (incoming[k] || []).forEach(function (v) {
          if (core[k].indexOf(v) < 0) core[k].push(v);
        });
      });
      core.wards.sort();
      if (!core.fields || !core.fields.length) core.fields = incoming.fields;
    }
    imgs.forEach(function (im) { is.put(im); });
    ks.put(core, 'data');
    ks.put(meta, 'meta');
    return done(tx).then(refreshUrls);
  }

  return {
    ready: function () {
      return openDb().then(function (d) {
        db = d;
        return Promise.all([req(store('kv').get('data')), req(store('kv').get('meta'))]);
      }).then(function (r) {
        meta = r[1] || {};
        if (r[0]) { core = r[0]; return refreshUrls(); }
        return fetchSeed().then(function (j) {
          meta = { seedVersion: j.seedVersion || '', dirty: false };
          return write(j, 'replace');
        });
      });
    },

    // App 只在 IndexedDB 是空的時候才讀 seed，所以之後 repo 更新了內容，
    // 裝置上永遠看不到。開啟時比對指紋：沒改過就直接換掉，改過才問。
    checkSeedUpdate: function () {
      return fetch('data/version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (v) {
          if (!v || !v.seed || v.seed === meta.seedVersion) return null;
          return { version: v.seed, counts: v.counts || {}, dirty: !!meta.dirty };
        })
        .catch(function () { return null; });     // 離線就當作沒有更新
    },

    applySeedUpdate: function (mode) {
      return fetchSeed().then(function (j) {
        meta = { seedVersion: j.seedVersion || '', dirty: mode !== 'replace' };
        return write(j, mode);
      });
    },

    seedVersion: function () { return meta.seedVersion || '—'; },

    get data() { return core; },
    imageUrl: function (id) { return urls[id] || null; },
    imageCount: function () { return imgIds.length; },
    save: function () { return persist(true); },
    valid: valid,

    putImage: function (id, mime, b64) {
      var tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put({ id: id, mime: mime, data: b64 });
      meta.dirty = true;
      return done(tx).then(function () {
        imgIds.push(id);
        urls[id] = URL.createObjectURL(b64ToBlob(b64, mime));
      });
    },

    // 只有沒有任何一段文字還引用它的圖才真的刪掉
    sweepImages: function () {
      var used = {};
      var scan = function (o) {
        Object.keys(o || {}).forEach(function (k) {
          String(o[k]).replace(/\[\[img:([^\]]+)\]\]/g, function (_, id) { used[id] = 1; });
        });
      };
      core.cards.forEach(function (c) { scan(c.fields); });
      core.procedures.forEach(function (p) { scan(p.general); });
      core.doctors.forEach(function (d) { scan(d.general); });
      var dead = imgIds.filter(function (id) { return !used[id]; });
      if (!dead.length) return Promise.resolve(0);
      var tx = db.transaction('images', 'readwrite');
      dead.forEach(function (id) { tx.objectStore('images').delete(id); });
      return done(tx).then(refreshUrls).then(function () { return dead.length; });
    },

    exportObject: function () {
      return req(store('images').getAll()).then(function (imgs) {
        var out = { format: 'surgery-notes', version: 1 };
        out.exportedAt = new Date().toISOString().slice(0, 19);
        Object.keys(core).forEach(function (k) {
          if (k !== 'format' && k !== 'version' && k !== 'exportedAt') out[k] = core[k];
        });
        out.images = imgs;
        return out;
      });
    },

    // 匯入前先算清楚會發生什麼事，讓使用者自己選取代或合併
    summarize: function (j) {
      var cur = core, s = { file: {}, now: {}, add: {}, hit: {} };
      ['doctors', 'procedures', 'cards'].forEach(function (k) {
        var have = byId(cur[k]);
        s.file[k] = j[k].length;
        s.now[k] = cur[k].length;
        s.add[k] = j[k].filter(function (x) { return !have[x.id]; }).length;
        s.hit[k] = j[k].length - s.add[k];
      });
      s.file.images = (j.images || []).length;
      s.now.images = imgIds.length;
      return s;
    },

    importData: function (j, mode) {
      meta.dirty = true;                  // 使用者自己的檔，之後有新預設內容要問過再換
      if (j.seedVersion) meta.seedVersion = j.seedVersion;
      return write(j, mode);
    },

    reset: function () {
      return fetchSeed().then(function (j) {
        meta = { seedVersion: j.seedVersion || '', dirty: false };
        return write(j, 'replace');
      });
    }
  };
})();
