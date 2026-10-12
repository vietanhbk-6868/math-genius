import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

console.log("Độ dài:", key.length, "| 8 ký tự đầu:", key.slice(0, 8));
console.log("Trùng khóa công khai (anon/publishable)?", key === process.env.VITE_SUPABASE_ANON_KEY);

const admin = createClient(url, key, { auth: { persistSession: false } });
const a = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
console.log(a.error ? "Khóa KHÔNG dùng được: " + a.error.message : "Khóa dùng được (quyền quản trị OK)");

const s = await admin.from("app_settings").select("key");
console.log("Đọc app_settings:", s.error ? s.error.message : JSON.stringify(s.data));