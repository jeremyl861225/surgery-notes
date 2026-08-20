/* 草稿的存取層。
 *
 * 設計前提（使用者拍板）：寫入完全開放，不用登入、不用密碼，任何人寫的草稿
 * 所有人都看得到。唯一的保護是刪除——每則草稿產生一把 del_token，只存在
 * 寫它的那台裝置的 localStorage，刪除時當作 HTTP 標頭送出，由資料庫的 RLS
 * 政策比對。所以刪除鍵只會出現在寫的人自己的裝置上，別人刪不掉你的東西。
 *
 * 離線：寫入先落地 localStorage 佇列，回到有網路時自動補傳。
 * 未設定 Supabase 時整個退化成純本機模式，並提供「匯出草稿」。
 */
(function () {
  var LS_QUEUE = 'sn.queue';
  var LS_LOCAL = 'sn.local';     // 尚未（或無法）上雲的草稿
  var LS_TOKENS = 'sn.tokens';   // {draftId: delToken}
  var BUCKET = 'draft-photos';

  function cfg() {
    var c = window.CONFIG || {};
    return (c.SUPABASE_URL && c.SUPABASE_KEY) ? c : null;
  }
  function ls(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function token() {
    var a = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(a, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function api(path, opts) {
    var c = cfg();
    if (!c) return Promise.reject(new Error('未設定雲端'));
    opts = opts || {};
    opts.headers = Object.assign({
      apikey: c.SUPABASE_KEY,
      Authorization: 'Bearer ' + c.SUPABASE_KEY,
      'Content-Type': 'application/json'
    }, opts.headers || {});
    return fetch(c.SUPABASE_URL + '/rest/v1/' + path, opts).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var e = new Error(r.status + ' ' + t);
          e.status = r.status;
          throw e;
        });
      }
      // 新增成功回的是 201 ＋**空白內容**（沒帶 Prefer: return=representation），
      // 刪除成功回 204。無條件 r.json() 會在空 body 上丟例外，
      // 結果明明存進去了卻被當成失敗、留在佇列裡每次開頁重送一次。
      return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }

  var Cloud = {
    enabled: function () { return !!cfg(); },

    /** 資料表建好了沒？（schema.sql 沒跑的話 PostgREST 回 404 PGRST205） */
    ping: function () {
      if (!cfg()) return Promise.resolve(false);
      return api('drafts?select=id&limit=1').then(function () { return true; })
        .catch(function () { return false; });
    },
    myTokens: function () { return ls(LS_TOKENS, {}); },
    isMine: function (id) { return !!this.myTokens()[id]; },

    /** 讀草稿：雲端 + 本機未上傳的，依時間新到舊。
     *  filter 交給資料庫做，不要整包抓回來再前端過濾——草稿帶照片以後會很重。 */
    list: function (filter) {
      filter = filter || {};
      var local = ls(LS_LOCAL, []).filter(function (d) {
        return (!filter.proc || d.procedure === filter.proc)
            && (!filter.doctor || d.doctor === filter.doctor);
      });
      if (!cfg()) return Promise.resolve(local.slice().reverse());
      var q = 'drafts?select=id,created_at,doctor,procedure,ward,approach,author,fields,photos&order=created_at.desc';
      if (filter.proc) q += '&procedure=eq.' + encodeURIComponent(filter.proc);
      if (filter.doctor) q += '&doctor=eq.' + encodeURIComponent(filter.doctor);
      return api(q).then(function (rows) {
        var ids = {};
        rows.forEach(function (r) { ids[r.id] = 1; });
        var pending = local.filter(function (d) { return !ids[d.id]; });
        return pending.reverse().concat(rows);
      }).catch(function () {
        return local.slice().reverse();   // 離線或連不上：只給本機的
      });
    },

    /** 把一張壓好的圖送上 Supabase Storage，回傳公開網址。
     *  沒設定雲端時退化成 data URL（只有本機看得到，這也是預期行為）。 */
    upload: function (blob, draftId, i) {
      var c = cfg();
      if (!c) return new Promise(function (res) {
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.readAsDataURL(blob);
      });
      var path = draftId + '/' + i + '.webp';
      return fetch(c.SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + path, {
        method: 'POST',
        headers: { apikey: c.SUPABASE_KEY, Authorization: 'Bearer ' + c.SUPABASE_KEY, 'Content-Type': 'image/webp' },
        body: blob
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error('照片上傳失敗 ' + r.status + ' ' + t); });
        return c.SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
      });
    },

    /** 新增一則草稿。無論如何都先落地本機，再嘗試上雲。 */
    add: function (rec, pics) {
      var self = this, t = token();
      rec.id = uid();
      rec.created_at = new Date().toISOString();
      rec.del_token = t;
      rec.photos = [];
      var tok = ls(LS_TOKENS, {}); tok[rec.id] = t; save(LS_TOKENS, tok);
      var ups = (pics || []).map(function (b, i) { return self.upload(b, rec.id, i); });
      return Promise.all(ups).then(function (urls) {
        rec.photos = urls;
      }).catch(function (err) {
        // 照片上傳失敗不能連文字一起丟掉——文字照存，照片下次再說。
        console.warn(err);
        rec.photos = [];
      }).then(function () {
        var local = ls(LS_LOCAL, []); local.push(rec); save(LS_LOCAL, local);
        var q = ls(LS_QUEUE, []); q.push(rec.id); save(LS_QUEUE, q);
        return self.flush().then(function () { return rec; });
      });
    },

    /** 把佇列裡的草稿送上雲端；送成功的從本機清單移除。 */
    flush: function () {
      if (!cfg() || !navigator.onLine) return Promise.resolve();
      var q = ls(LS_QUEUE, []); if (!q.length) return Promise.resolve();
      var local = ls(LS_LOCAL, []);
      var jobs = q.map(function (id) {
        var rec = local.filter(function (d) { return d.id === id; })[0];
        if (!rec) return Promise.resolve(id);
        return api('drafts', { method: 'POST', body: JSON.stringify(rec) })
          .then(function () { return id; })
          .catch(function (err) {
            // 409 ＝主鍵重複，代表這筆其實早就進去了（例如上一輪誤判成失敗）。
            // 這種也要當成功收掉，否則佇列永遠清不乾淨。
            return err && err.status === 409 ? id : null;
          });
      });
      return Promise.all(jobs).then(function (done) {
        var ok = done.filter(Boolean);
        save(LS_QUEUE, ls(LS_QUEUE, []).filter(function (id) { return ok.indexOf(id) < 0; }));
        save(LS_LOCAL, ls(LS_LOCAL, []).filter(function (d) { return ok.indexOf(d.id) < 0; }));
      });
    },

    /** 刪除自己寫的草稿（del_token 走標頭，由 RLS 比對）。 */
    remove: function (id) {
      var tok = ls(LS_TOKENS, {});
      var t = tok[id];
      if (!t) return Promise.reject(new Error('這不是這台裝置寫的草稿'));
      save(LS_LOCAL, ls(LS_LOCAL, []).filter(function (d) { return d.id !== id; }));
      save(LS_QUEUE, ls(LS_QUEUE, []).filter(function (x) { return x !== id; }));
      var p = cfg()
        ? api('drafts?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { 'x-del-token': t } })
        : Promise.resolve();
      return p.then(function () { delete tok[id]; save(LS_TOKENS, tok); });
    },

    /** 匯出這台裝置寫過、還沒上雲的草稿（雲端沒設定時的備援交付路徑）。 */
    exportLocal: function () {
      return JSON.stringify({ format: 'surgery-notes.drafts', version: 1, drafts: ls(LS_LOCAL, []) });
    }
  };

  window.addEventListener('online', function () { Cloud.flush(); });
  window.Cloud = Cloud;
})();
