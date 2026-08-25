# 外科手術筆記

台大一般外科：**哪位醫師開哪台刀**，擺位、打洞、器械偏好、重要步驟、傷口怎麼關的習慣筆記。
離線可用的 PWA，<https://jeremyl861225.github.io/surgery-notes/>

> 這裡記的是各位主治醫師的**個人偏好**，不是診療指引，也不是台大醫院的正式文件。
> 臨床決策請依當台刀的實際情況與主治醫師指示。

## 內容都是可以自己改的

App 裡沒有寫死任何一筆資料。醫師、術式、筆記內容、圖片全部存在**這台裝置的 IndexedDB**，
沒有伺服器、沒有帳號、沒有任何東西會離開手機。搬運靠一個 JSON 檔：

- **設定 → 匯出檔案**：產生一個含全部內容與圖片的 `.json`，存進 Google Drive 就是備份。
- **設定 → 匯入檔案**：從「檔案」App 選那個檔（Drive 裡的也行）。匯入前會先列出
  **現在有幾筆／檔案有幾筆／合併後會怎樣**，再讓你選：
  - **取代** — 丟掉裝置上現有的全部，只留檔案裡的。
  - **合併** — 同一筆（以 id 比對）以檔案為準覆蓋，檔案沒有的保留下來，不刪任何東西。
- **設定 → 重設回預設內容**：回到 repo 裡的 `data/seed.json`。

第一次開啟（或重設後）會自動載入 `data/seed.json`。

## 匯入檔的格式

```jsonc
{
  "format": "surgery-notes", "version": 1,
  "fields":     [ { "key": "position", "zh": "擺位", "en": "Positioning" }, … ],  // 固定十欄
  "wards":      ["8A", "9A", "9B", "9C"],
  "approaches": ["Open", "Robotic", "SP", "Scope", "Transoral"],
  "doctors":    [ { "id": "d01", "name": "…", "empId": "017662",
                    "wards": ["9A"], "general": { "position": "…" } } ],
  "procedures": [ { "id": "p13", "key": "LC", "en": "…", "zh": "…",
                    "general": { "steps": "…" } } ],
  "cards":      [ { "id": "c29", "doctorIds": ["d29"], "procedureId": "p13",
                    "approach": ["Scope"], "updatedAt": "…",
                    "fields": { "position": "…", "steps": "…" } } ],
  "images":     [ { "id": "…", "mime": "image/webp", "data": "<base64>" } ]
}
```

- 內文用 `[[img:<圖片 id>]]` 單獨成一行來插圖，`[[photo]]` 是被移除的照片留下的位置說明。
- 空的欄位**不要寫空字串，直接不要那個 key**；畫面上會顯示「共筆沒寫」。
- `data/seed.lite.json` 是同一份內容但**不含圖片**（40 KB），要用文字編輯器改內容或看 diff 時用這份。

## 兩層通則

- **術式通則** — 不分哪位醫師都適用（例如 LC 的 ICG 怎麼打）。在術式頁排在醫師清單之上。
- **醫師通則** — 那位醫師開任何一台刀都這樣。會顯示在他每一張卡片上。

兩層都是手動維護的。

## 隱私

原共筆的附件裡有 **27 張刀房實拍照片含可辨識的病人影像**（臉、會陰、乳房、生殖器），
**沒有收進這個 repo，也不應該被加回來**。它們原本的位置在內文中以一行說明標示。

App 內新增的圖片會在瀏覽器裡縮到 1600 px 轉成 WebP，**這一步順便把 EXIF（GPS、拍攝時間）洗掉**，
但那張圖本身會原封不動被包進匯出檔。放上任何雲端之前先想一下裡面有什麼。

## 檔案

```
index.html            外殼
css/app.css           全部樣式（「圖版」設計：襯線標題、細規則線、圖有圖號圖說）
js/store.js           IndexedDB、匯入匯出、孤兒圖清理
js/ui.js              跳脫、SVG 圖示、內文渲染
js/app.js             路由與各頁畫面
js/edit.js            醫師／術式／卡片的編輯表單
data/seed.json        預設內容（含圖片 base64，1.4 MB）
data/seed.lite.json   同上但不含圖片，方便手改
fonts/                Newsreader（拉丁襯線，OFL）。中文襯線走系統內建的宋體，離線不缺字
img/                  手繪圖原檔。App 不讀它，是重建 seed.json 用的來源
sw.js                 離線快取。本機開發（localhost）不註冊，要測就加 ?sw=1
```

建置腳本 `make_seed.py` 在 repo 外的 `workspace/work/surgery-notes/`。

## 授權

程式碼 MIT（見 `LICENSE`）。`fonts/` 下的 Newsreader 為 SIL Open Font License 1.1（見 `fonts/OFL.txt`）。
筆記內容屬於原共筆的作者們。
