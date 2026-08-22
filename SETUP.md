# 設定雲端

**已經設好了，你只要做一件事**：把 `schema.sql` 貼進 Supabase 執行一次。

## 為什麼是寄住在 todo-app 的專案

Supabase 免費方案**一個帳號只給兩個專案**（官方原話：專案上限 "applies across all
organizations"，所以另開組織也沒用）。你的兩個額度已經給了 todo-app 與 patient-list。

所以草稿改成寄住在 **todo-app 那個專案**裡，多開一張 `drafts` 表。這樣做不會多曝露
任何東西——那組網址與金鑰**早就公開在 todo-app 的 repo 裡**，而 todo 自己的四張表都用
`auth.uid() = user_id` 鎖著，光有 anon 金鑰一列都讀不到（實測回空陣列）。

病人清單那個專案刻意不碰。裡面是病人資料，就算加密過也不該跟公開網站共用金鑰。

## 唯一要做的一步

1. 開 <https://supabase.com/dashboard> → 進 **todo-app** 那個專案（`dawcpdgonxmhojwonkut`）
2. 左邊選 **SQL Editor** → New query
3. 把 repo 裡 `schema.sql` **整份**貼進去 → 按 Run
4. 跑完回來重整網站，按「＋ 新增草稿」試存一則

跑完會多出：一張 `public.drafts` 表、一個叫 `draft-photos` 的公開圖片 bucket。
todo 的東西一樣都不會動到（`schema.sql` 開頭有寫為什麼）。

## 跑完之後的行為

- 任何人打開網站都能寫草稿，不用登入、不用密碼。
- 草稿一存下去，所有人都看得到。
- **刪除鍵只會出現在寫的人自己的裝置上**——每則草稿有一把 `del_token`，只存在寫它的瀏覽器裡。
- 沒網路時照樣能寫，草稿先存本機，有網路自動補傳。

## 草稿照片

照片在瀏覽器裡就會先縮到最長邊 1600 px、轉成 WebP 再上傳——
這一步順便**把 EXIF 洗掉**（GPS 座標與拍攝時間都在裡面）。

上傳前一定要勾「沒有病人的臉或身體」那個確認框，不勾存不下去。
這只是防手滑，擋不了存心亂傳的人。

## 額度是跟 todo-app 共用的

免費方案整個專案：**資料庫 500 MB、檔案 1 GB、流量 5 GB／月**。
草稿是純文字，照片壓過大約 100–200 KB 一張，這個用量吃不到零頭。

順帶一提，免費專案**一週沒有任何請求就會被暫停**。兩個 App 共用一個專案反而不容易被停。

## 想清掉別人亂塞的東西

在 App 裡刪自己的草稿時，照片會一起刪掉（照片的刪除政策跟草稿共用同一把 `del_token`）。

要從後台清別人的東西：

- **單筆文字**：Table Editor → `drafts`，刪那一列。
- **全部文字**：SQL Editor 跑 `delete from public.drafts;`（不可逆，沒有二次確認）。
- **照片**：只能從 **Storage → draft-photos** 點選刪除。
  Supabase 擋掉了直接對 storage 資料表下 SQL（會回
  `Direct deletion from storage tables is not allowed`）。
