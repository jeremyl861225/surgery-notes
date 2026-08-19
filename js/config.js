/* Supabase 連線設定。
 * 兩個值都填好之後，「＋ 新增草稿」才會存到雲端；留空的話草稿只存在這台裝置。
 * 取得方式見 SETUP.md。anon（publishable）金鑰本來就是公開的，可以放進版控。
 */
window.CONFIG = {
  SUPABASE_URL: "",   // 例如 https://abcdefgh.supabase.co
  SUPABASE_KEY: ""    // 例如 sb_publishable_xxxxxxxxxxxxxxxx
};
