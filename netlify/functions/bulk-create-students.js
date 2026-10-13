import { getAuth } from "../lib/auth.js";
import { adminClient } from "../lib/admin.js";
import { toEmail } from "../../src/authName.js";
import { baseUsername } from "../../src/accountNames.js";

const MAX_NAMES = 25;

const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Chỉ hỗ trợ POST" }, 405);

  const auth = await getAuth(req);
  if (!auth || !["teacher", "admin"].includes(auth.role)) {
    return json({ error: "Bạn không có quyền thực hiện việc này." }, 403);
  }

  try {
    const b = await req.json();
    const className = String(b.className || "").trim();
    const password = String(b.defaultPassword || "");
    const names = (Array.isArray(b.names) ? b.names : [])
      .map((n) => String(n || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (!className) return json({ error: "Hãy chọn lớp." }, 400);
    if (password.length < 6 || password.length > 72) {
      return json({ error: "Mật khẩu mặc định cần từ 6 đến 72 ký tự." }, 400);
    }
    if (names.length === 0 || names.length > MAX_NAMES) {
      return json({ error: `Mỗi lần tạo từ 1 đến ${MAX_NAMES} học sinh.` }, 400);
    }
    if (names.some((n) => n.length > 60)) return json({ error: "Có tên quá dài." }, 400);

    if (auth.role === "teacher") {
      const { data: ok } = await auth.sb.rpc("teaches_class", { p_class: className });
      if (!ok) return json({ error: "Bạn không được phân công lớp này." }, 403);
    }

    const admin = adminClient();
    const { data: cls } = await admin.from("classes").select("id").eq("name", className).maybeSingle();
    if (!cls) return json({ error: "Lớp không tồn tại." }, 400);

    const tag = baseUsername(className);
    const candidates = (base) => {
      const out = [base];
      out.push(base.slice(0, 30 - tag.length) + tag);
      for (let i = 2; i <= 8; i++) {
        out.push(base.slice(0, 30 - tag.length - String(i).length) + tag + i);
      }
      return out;
    };

    async function createOne(fullName) {
      const base = baseUsername(fullName);
      if (base.length < 2) return { fullName, ok: false, error: "Tên không hợp lệ" };
      for (const username of candidates(base)) {
        const { data, error } = await admin.auth.admin.createUser({
          email: toEmail(username),
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, username, class_name: className },
        });
        if (!error) {
          await admin.from("profiles").update({ must_change_password: true }).eq("id", data.user.id);
          return { fullName, username, ok: true };
        }
        if (!/already|registered|exists/i.test(error.message)) {
          return { fullName, ok: false, error: error.message };
        }
      }
      return { fullName, ok: false, error: "Không tìm được tên tài khoản chưa dùng." };
    }

    const results = [];
    for (let i = 0; i < names.length; i += 5) {
      results.push(...(await Promise.all(names.slice(i, i + 5).map(createOne))));
    }
    return json({ results });
  } catch (e) {
    console.error(e);
    return json({ error: e.message }, 500);
  }
};

export const config = { path: "/api/teacher/create-students" };