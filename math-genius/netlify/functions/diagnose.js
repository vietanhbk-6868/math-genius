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
    const { stats } = await req.json();
    if (!Array.isArray(stats) || stats.length === 0 || stats.length > 30) {
      return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }
    const result = await diagnose(stats);
    return Response.json(result, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const config = { path: "/api/diagnose" };