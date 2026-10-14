import { getAuth } from "../lib/auth.js";
import { adminClient } from "../lib/admin.js";
import { processExam } from "../lib/exam.js";

export default async (req) => {
  const auth = await getAuth(req);
  if (!auth || !["teacher", "admin"].includes(auth.role)) {
    return new Response("Không có quyền", { status: 403 });
  }

  let importId;
  try {
    importId = (await req.json()).importId;
  } catch {
    return new Response("Dữ liệu không hợp lệ", { status: 400 });
  }

  const admin = adminClient();
  const { data: imp } = await admin.from("exam_imports").select("*").eq("id", importId).maybeSingle();
  if (!imp || imp.teacher_id !== auth.user.id) return new Response("Không tìm thấy", { status: 404 });
  if (imp.status !== "pending") return new Response("Đã xử lý", { status: 200 });

  await admin.from("exam_imports").update({ status: "working" }).eq("id", importId);

  try {
    const { data: file, error } = await admin.storage.from("exams").download(imp.file_path);
    if (error) throw new Error("Không đọc được file đã tải lên: " + error.message);
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await processExam(b64, { grade: imp.grade, convertOpen: imp.convert_open });
    await admin.from("exam_imports").update({ status: "done", result }).eq("id", importId);
  } catch (e) {
    console.error(e);
    await admin
      .from("exam_imports")
      .update({ status: "error", error: String(e.message || e).slice(0, 500) })
      .eq("id", importId);
  } finally {
    // Xóa file PDF sau khi xử lý xong để tiết kiệm dung lượng và bảo mật
    await admin.storage.from("exams").remove([imp.file_path]);
  }
  return new Response("ok");
};