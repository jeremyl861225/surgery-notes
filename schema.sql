-- 外科手術筆記 · Supabase 資料表
-- 在 Supabase 專案的 SQL Editor 貼上整份執行一次。

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

-- 不允許改：草稿只有新增與刪除兩種動作。
revoke update on public.drafts from anon;

-- del_token 不可被讀出來，否則任何人都能拿去刪別人的草稿。
revoke select (del_token) on public.drafts from anon;
grant select (id, created_at, doctor, procedure, ward, approach, author, fields, photos)
  on public.drafts to anon;
grant insert, delete on public.drafts to anon;


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

-- 照片不給改、不給刪（刪草稿不會連帶刪圖，要清請到 Supabase 的 Storage 後台）。
