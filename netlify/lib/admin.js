import { createClient } from "@supabase/supabase-js";

// Kết nối quyền cao nhất, chỉ dùng trong hàm máy chủ
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Máy chủ chưa được cấu hình khóa quản trị.");
  return createClient(process.env.VITE_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}