# 設定雲端（讓「＋ 新增草稿」存得起來）

沒設定也能用，草稿只是會存在你這台裝置裡、換手機就沒了。要跨裝置就照下面做，大約五分鐘。

## 1. 開一個 Supabase 專案

到 <https://supabase.com> 註冊並新建一個專案（免費方案就夠）。
**這個要獨立開一個**，不要跟 todo-app 或 patient-list 共用。

## 2. 建資料表

專案左邊選 **SQL Editor** → New query → 把 `schema.sql` 整份貼進去 → Run。

## 3. 把兩個值填進 `js/config.js`

專案左邊 **Project Settings → API**，抄兩個東西：

- **Project URL**（長得像 `https://abcdefgh.supabase.co`）→ 填 `SUPABASE_URL`
- **anon / publishable key**（`sb_publishable_…` 開頭）→ 填 `SUPABASE_KEY`

```js
window.CONFIG = {
  SUPABASE_URL: "https://abcdefgh.supabase.co",
  SUPABASE_KEY: "sb_publishable_xxxxxxxxxxxx"
};
```

這把 anon 金鑰本來就是設計成公開的，放進版控沒問題——真正的門禁是 `schema.sql` 裡的 RLS 政策。
**絕對不要**把 `service_role` 那把貼進來，那把可以繞過所有政策。

## 4. 推上去

```bash
git add js/config.js && git commit -m "設定 Supabase" && git push
```

## 這樣設定之後的行為

- 任何人打開網站都能寫草稿，不用登入、不用密碼。
- 草稿一存下去，所有人都看得到。
- **刪除鍵只會出現在寫的人自己的裝置上**——每則草稿有一把 `del_token`，只存在寫它的瀏覽器裡。
- 沒網路時照樣能寫，草稿先存本機，有網路自動補傳。

## 想清掉別人亂塞的東西

到 Supabase 的 **Table Editor → drafts**，直接刪那一列。
