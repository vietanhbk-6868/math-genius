import { createClient } from "@supabase/supabase-js";

// HÀM TẠM THỜI: chỉ trả về thông tin loại khóa, không trả về chính khóa. Xóa sau khi dùng xong.
export default async () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const url = process.env.VITE_SUPABASE_URL || "";

  let jwtRole = null;
  try {
    jwtRole = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
  } catch {
    /* không phải dạng JWT */
  }

  let adminWorks = false;
  let adminError = null;
  let settingsRows = null;
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const a = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
    adminWorks = !a.error;
    adminError = a.error?.message || null;
    const s = await sb.from("app_settings").select("key");
    settingsRows = s.error ? s.error.message : s.data.length;
  } catch (e) {
    adminError = e.message;
  }

  return Response.json({
    hasKey: key.length > 0,
    length: key.length,
    prefix: key.slice(0, 8),
    jwtRole,
    sameAsPublicKey: key === process.env.VITE_SUPABASE_ANON_KEY,
    urlHost: url.replace(/^https?:\/\//, ""),
    adminWorks,
    adminError,
    settingsRows,
  });
};

export const config = { path: "/api/debug-key" };