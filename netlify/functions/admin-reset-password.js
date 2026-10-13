import { getAuth } from "../lib/auth.js";
import { adminClient } from "../lib/admin.js";

const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Chỉ hỗ trợ POST" }, 405);

  const auth = await getAuth(req);
  if (!auth || !["teacher", "admin"].includes(auth.role)) {
    return json({ error: "Bạn không có quyền thực hiện việc này." }, 403);
  }

  try {
    const { userId, newPassword } = await req.json();
    const pw = String(newPassword || "");
    if (!userId || pw.length < 6 || pw.length > 72) {
      return json({ error: "Mật khẩu cần từ 6 đến 72 ký tự." }, 400);
    }

    const admin = adminClient();
    const { data: target } = await admin.from("profiles").select("role, class_name").eq("id", userId).maybeSingle();
    if (!target) return json({ error: "Không tìm thấy tài khoản." }, 404);

    const allowed = auth.role === "admin" ? target.role !== "admin" : target.role === "student";
    if (auth.role === "teacher") {
  const { data: ok } = await auth.sb.rpc("teaches_class", { p_class: target.class_name });
  if (!ok) return json({ error: "Học sinh này không thuộc lớp bạn phụ trách." }, 403);
}

    const { error } = await admin.auth.admin.updateUserById(userId, { password: pw });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: e.message }, 500);
  }
};

export const config = { path: "/api/admin/reset-password" };