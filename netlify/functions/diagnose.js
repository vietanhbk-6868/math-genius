import { getAuth } from "../lib/auth.js";
import { diagnose } from "../lib/ai.js";

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Chỉ hỗ trợ POST" }, { status: 405 });
  }
  const auth = await getAuth(req);
  if (!auth) {
    return Response.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }
  try {
    const { stats, scope, meta } = await req.json();
    if (!Array.isArray(stats) || stats.length === 0 || stats.length > 30) {
      return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const isClass = scope === "class";
    if (isClass && !["teacher", "admin"].includes(auth.role)) {
      return Response.json({ error: "Chỉ giáo viên mới được dùng chức năng này" }, { status: 403 });
    }

    // Với phân tích cả lớp: chỉ nhận số liệu tổng hợp, làm sạch dữ liệu đầu vào
    const cleanStats = isClass
      ? stats.map((s) => ({
          skill_tag: String(s.skill_tag || "Khác").slice(0, 120),
          correct: Number(s.correct) || 0,
          total: Number(s.total) || 0,
          students: Number(s.students) || 0,
        }))
      : stats;
    const cleanMeta = isClass
      ? {
          class: String(meta?.class || "tất cả các lớp").slice(0, 20),
          students: Number(meta?.students) || 0,
          active: Number(meta?.active) || 0,
          attempts: Number(meta?.attempts) || 0,
          accuracy: Number(meta?.accuracy) || 0,
          need_support: Number(meta?.needSupport) || 0,
        }
      : null;

    const result = await diagnose(cleanStats, isClass ? "class" : "student", cleanMeta);
    return Response.json(result, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const config = { path: "/api/diagnose" };