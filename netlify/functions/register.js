import { adminClient } from "../lib/admin.js";
import { toEmail } from "../../src/authName.js";

const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
const RESERVED = ["admin", "administrator", "quantri", "root", "support"];

const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Chỉ hỗ trợ POST" }, 405);
  try {
    const b = await req.json();
    const username = String(b.username || "").trim().toLowerCase();
    const password = String(b.password || "");
    const fullName = String(b.fullName || "").trim().slice(0, 60);
    const role = b.role === "teacher" ? "teacher" : "student";
    const classroom = String(b.classroom || "").trim();
    const teacherCode = String(b.teacherCode || "").trim();

    if (!USERNAME_RE.test(username)) {
      return json({ error: "Tên tài khoản gồm 3 đến 20 ký tự: chữ thường không dấu, số, dấu chấm hoặc gạch dưới." }, 400);
    }
    if (RESERVED.includes(username)) return json({ error: "Tên tài khoản này không được dùng." }, 400);
    if (password.length < 6 || password.length > 72) {
      return json({ error: "Mật khẩu cần từ 6 đến 72 ký tự." }, 400);
    }
    if (fullName.length < 2) return json({ error: "Hãy nhập họ và tên." }, 400);

    const admin = adminClient();

    if (role === "teacher") {
      const { data: s } = await admin.from("app_settings").select("value").eq("key", "teacher_code").maybeSingle();
      if (!s || s.value !== teacherCode) return json({ error: "Mã giáo viên không đúng." }, 403);
    } else {
      const { data: c } = await admin.from("classes").select("id").eq("name", classroom).maybeSingle();
      if (!c) return json({ error: "Lớp không hợp lệ. Hãy chọn lớp trong danh sách." }, 400);
    }

    const { error } = await admin.auth.admin.createUser({
      email: toEmail(username),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username,
        teacher_code: role === "teacher" ? teacherCode : null,
        class_name: role === "student" ? classroom : null,
      },
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        return json({ error: "Tên tài khoản này đã có người dùng." }, 409);
      }
      console.error(error);
      return json({ error: "Không tạo được tài khoản: " + error.message }, 400);
    }
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: e.message }, 500);
  }
};

export const config = { path: "/api/auth/register" };