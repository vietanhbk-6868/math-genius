import { getAuth } from "../lib/auth.js";
import { generateVerifiedQuestions } from "../lib/ai.js";

const LEVELS = ["nhận biết", "thông hiểu", "vận dụng", "vận dụng cao"];
const DAILY_LIMIT = 20; // số câu tối đa mỗi học sinh trong 24 giờ

const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Chỉ hỗ trợ POST" }, 405);

  const auth = await getAuth(req);
  if (auth?.role !== "student") {
    return json({ error: "Chỉ học sinh mới dùng được chức năng này" }, 403);
  }

  try {
    const body = await req.json();
    const grade = Number(body.grade);
    const count = Math.min(5, Math.max(1, Number(body.count) || 3));
    const topic = String(body.topic || "").replace(/["\n\r{}]/g, " ").trim().slice(0, 100);
    const level = LEVELS.includes(body.level) ? body.level : "thông hiểu";

    if (![6, 7, 8, 9].includes(grade) || topic.length < 3) {
      return json({ error: "Hãy chọn lớp và nhập chủ đề (ít nhất 3 ký tự)." }, 400);
    }

    // Giới hạn số câu mỗi ngày
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: used, error: qErr } = await auth.sb
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("created_by", auth.user.id)
      .eq("source", "ai_student")
      .gte("created_at", since);
    if (qErr) throw new Error(qErr.message);
    const left = DAILY_LIMIT - (used || 0);
    if (left < count) {
      return json({ error: `Bạn chỉ còn ${Math.max(left, 0)} câu trong hôm nay. Hãy quay lại vào ngày mai.` }, 429);
    }

    const { questions, generated } = await generateVerifiedQuestions({ topic, grade, level, count });
    if (questions.length === 0) {
      return json({ error: "AI chưa tạo được câu hỏi đủ tin cậy cho chủ đề này. Hãy mô tả cụ thể hơn (ví dụ: Giải phương trình bậc nhất một ẩn)." }, 422);
    }

    const rows = questions.map((q) => ({
      grade,
      topic,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      skill_tag: q.skill_tag,
      level: LEVELS.includes(q.level) ? q.level : level,
      status: "unreviewed",
      source: "ai_student",
      created_by: auth.user.id,
    }));
    const { data, error } = await auth.sb.from("questions").insert(rows).select();
    if (error) throw new Error(error.message);

    return json({ questions: data, generated, kept: data.length, remaining: left - data.length });
  } catch (e) {
    console.error(e);
    return json({ error: e.message }, 500);
  }
};

export const config = { path: "/api/student/generate" };