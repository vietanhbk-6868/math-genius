import { getAuth } from "../lib/auth.js";
import { generateQuestions } from "../lib/ai.js";

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Chỉ hỗ trợ POST" }, { status: 405 });
  }
  const auth = await getAuth(req);
  if (!["teacher", "admin"].includes(auth?.role)) {
    return Response.json({ error: "Chỉ giáo viên mới được dùng chức năng này" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const questions = await generateQuestions(body);
    return Response.json(questions, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const config = { path: "/api/questions/generate" };