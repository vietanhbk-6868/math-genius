import { getAuth } from "../lib/auth.js";
import { adminClient } from "../lib/admin.js";
import { gradeEssay } from "../lib/essay.js";

export default async (req) => {
  const auth = await getAuth(req);
  if (!auth) return new Response("Chưa đăng nhập", { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Dữ liệu không hợp lệ", { status: 400 });
  }
  const { attemptId, force } = body;

  const admin = adminClient();
  const { data: att } = await admin.from("attempts").select("id, student_id").eq("id", attemptId).maybeSingle();
  if (!att) return new Response("Không tìm thấy", { status: 404 });

  // Chỉ học sinh làm bài đó, hoặc giáo viên phụ trách lớp, mới được gọi
  const isOwner = att.student_id === auth.user.id;
  let allowed = isOwner;
  if (!allowed && ["teacher", "admin"].includes(auth.role)) {
    const { data: ok } = await auth.sb.rpc("can_see_student", { p_student: att.student_id });
    allowed = !!ok;
  }
  if (!allowed) return new Response("Không có quyền", { status: 403 });

  // Chỉ giáo viên mới được yêu cầu chấm lại
  const statuses = force && !isOwner ? ["submitted", "ai_graded"] : ["submitted"];
  const { data: list } = await admin
    .from("essay_answers")
    .select("*")
    .eq("attempt_id", attemptId)
    .in("status", statuses);

  for (const ea of list || []) {
    try {
      const { data: q } = await admin
        .from("exam_questions")
        .select("question, model_answer, rubric, weight")
        .eq("id", ea.exam_question_id)
        .single();

      const images = [];
      for (const p of ea.image_paths || []) {
        const { data: blob } = await admin.storage.from("essays").download(p);
        if (blob) {
          images.push({ mime: "image/jpeg", data: Buffer.from(await blob.arrayBuffer()).toString("base64") });
        }
      }

      const r = await gradeEssay({
        question: q.question,
        modelAnswer: q.model_answer,
        rubric: q.rubric,
        maxScore: Number(q.weight),
        studentText: ea.answer_text,
        images,
      });
      await admin
        .from("essay_answers")
        .update({
          ai_score: r.score,
          ai_feedback: r.feedback,
          ai_confidence: r.confidence,
          ai_error: null,
          status: "ai_graded",
        })
        .eq("id", ea.id);
    } catch (e) {
      console.error(e);
      await admin
        .from("essay_answers")
        .update({ ai_error: String(e.message || e).slice(0, 300) })
        .eq("id", ea.id);
    }
  }
  return new Response("ok");
}; 