import { createClient } from "@supabase/supabase-js";

// Trả về { user, role } nếu đã đăng nhập hợp lệ, ngược lại trả về null
export async function getAuth(req) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return null;
  const { data: p } = await sb.from("profiles").select("role").eq("id", data.user.id).single();
  return { user: data.user, role: p?.role ?? null, sb };
}