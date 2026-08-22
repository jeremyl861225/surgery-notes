-- 外科手術筆記 · Supabase 資料表
--
-- 貼到**既有的 todo-app 專案**（dawcpdgonxmhojwonkut）的 SQL Editor 執行一次。
-- 免費方案一個帳號只有兩個專案，所以草稿寄住在這裡，不另開第三個。
--
-- 這份不會動到 todo 的任何東西：
--   · 只新增 public.drafts 一張表，todo 沒有同名的表
--   · 政策名稱都掛在 drafts 上，storage 政策也只認 bucket_id = 'draft-photos'
--   · todo 的 schema.sql 那個 RLS 迴圈寫死了四張表的名字，重跑也不會碰到 drafts
--   · revoke / grant 全部指名 public.drafts，不是整個 schema

create table if not exists public.drafts (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  doctor      text,
  procedure   text,
  ward        text,
  approach    text,
  author      text,
  fields      jsonb not null default '{}'::jsonb,
  photos      jsonb not null default '[]'::jsonb,
  del_token   text not null
);

-- 既有資料表要補這一欄的話（第一次建表可略）：
alter table public.drafts add column if not exists photos jsonb not null default '[]'::jsonb;

create index if not exists drafts_procedure_idx on public.drafts (procedure);
create index if not exists drafts_doctor_idx    on public.drafts (doctor);

alter table public.drafts enable row level security;

-- 讀：完全開放（使用者拍板：草稿人人看得到）
drop policy if exists "read all" on public.drafts;
create policy "read all" on public.drafts for select using (true);

-- 寫：完全開放，不用登入
drop policy if exists "insert all" on public.drafts;
create policy "insert all" on public.drafts for insert with check (true);

-- 刪：必須在 HTTP 標頭帶對 x-del-token。
-- 這把 token 只存在寫這則草稿的那台裝置的 localStorage，
-- 所以刪除鍵只會出現在寫的人自己畫面上，別人刪不掉你的東西。
drop policy if exists "delete with token" on public.drafts;
create policy "delete with token" on public.drafts for delete
  using (del_token = ((current_setting('request.headers', true))::json ->> 'x-del-token'));

-- ⚠ del_token 絕對不可以被讀出來，否則任何人都能撈走全部的刪除鑰匙，
-- 把別人的草稿刪光。
--
-- 這裡有一個 PostgreSQL 的陷阱，第一版寫錯過：
--   revoke select (del_token) ... 「擋不掉」表級的 SELECT 授權。
-- Supabase 建表時的預設權限給的是**整張表**的 SELECT，涵蓋所有欄位；
-- 針對單一欄位 revoke 不會在上面打洞，結果 del_token 照樣讀得到（實測確認）。
-- 正確做法是先把表級 SELECT 整個收回，再逐欄 grant 回去。
revoke select, update, insert, delete on public.drafts from anon, authenticated;

grant select (id, created_at, doctor, procedure, ward, approach, author, fields, photos)
  on public.drafts to anon;
grant insert, delete on public.drafts to anon;
-- 不給 update：草稿只有新增與刪除兩種動作。
-- authenticated 一個權限都不給——這個專案還住著 todo-app，它的登入使用者
-- 沒有理由讀得到這裡的東西。本站一律以 anon 身分連線。


-- ─────────────────────────────────────────────────────────────
-- 草稿照片：放 Storage，不放資料表（base64 塞進 jsonb 會讓每次讀草稿都下載整包）
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('draft-photos', 'draft-photos', true)
  on conflict (id) do update set public = true;

-- 讀：公開。寫：跟草稿一樣完全開放。
drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects for select
  using (bucket_id = 'draft-photos');

drop policy if exists "photos insert" on storage.objects;
create policy "photos insert" on storage.objects for insert
  with check (bucket_id = 'draft-photos');

-- 刪照片：跟草稿同一把鑰匙。照片路徑是 <草稿id>/<序號>.webp，
-- 所以拿路徑第一段去對 drafts 那一列的 del_token。
--
-- 為什麼要包成 security definer 的函式，不直接把子查詢寫進政策裡：
-- 政策裡的子查詢是用呼叫者（anon）的身分跑的，而 anon 對 drafts.del_token
-- 沒有 SELECT 權限（上面刻意收掉的），直接寫會 permission denied。
-- 函式只回傳 true/false，token 是 24 bytes 隨機值，猜不出來。
create or replace function public.draft_token_ok(p_name text, p_token text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.drafts d
    where d.id::text = split_part(p_name, '/', 1)
      and d.del_token = p_token
  );
$$;

revoke all on function public.draft_token_ok(text, text) from public;
grant execute on function public.draft_token_ok(text, text) to anon;

drop policy if exists "photos delete with token" on storage.objects;
create policy "photos delete with token" on storage.objects for delete
  using (
    bucket_id = 'draft-photos'
    and public.draft_token_ok(name, ((current_setting('request.headers', true))::json ->> 'x-del-token'))
  );

-- 照片一律不給改。
