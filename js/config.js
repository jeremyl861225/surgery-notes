/* Supabase 連線設定。
 *
 * 這裡用的是**既有 todo-app 專案**（dawcpdgonxmhojwonkut）——Supabase 免費方案
 * 一個帳號只給兩個專案，兩個都用掉了，所以草稿寄住在 todo 那個專案裡多開的一張
 * drafts 表。這不會多曝露任何東西：這組網址與金鑰早就公開在 todo-app 的 repo 裡，
 * 而 todo 自己的四張表都用 auth.uid() = user_id 鎖著，光有 anon 金鑰讀不到。
 * （病人清單那個專案刻意不碰。）
 *
 * anon / publishable 金鑰本來就設計成放在前端，可以進版控。
 * 真正的門禁是 schema.sql 裡的 RLS 政策。service_role 那把絕對不可以放這裡。
 */
window.CONFIG = {
  SUPABASE_URL: "https://dawcpdgonxmhojwonkut.supabase.co",
  SUPABASE_KEY: "sb_publishable_pjoI0uuRcCn16-GMC_g0xw_9nqoJU-V"
};
