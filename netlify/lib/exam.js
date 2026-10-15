import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL_EXAM || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const THINK =
  ThinkingLevel[String(process.env.GEMINI_EXAM_THINKING || "low").toUpperCase()] ?? ThinkingLevel.LOW;
const LEVELS = ["nhận biết", "thông hiểu", "vận dụng", "vận dụng cao"];

async function askJSON(parts, system) {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: THINK },
    },
  });
  try {
    return JSON.parse(res.text);
  } catch {
    throw new Error("AI trả về dữ liệu không đọc được. Hãy thử file ngắn hơn hoặc rõ nét hơn.");
  }
}

function normalize(q, idx) {
  const issues = Array.isArray(q.issues) ? q.issues.map(String).filter(Boolean).slice(0, 6) : [];
  const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? "").trim()) : [];
  const a = Number(q.answer);
  const answerOk = q.answer !== null && q.answer !== undefined && Number.isInteger(a) && a >= 0 && a <= 3;
  const pts = Number(q.points);
  const points = Number.isFinite(pts) && pts > 0 && pts <= 100 ? pts : null;
  const hasFigure = !!q.has_figure;

  let qtype = q.type === "essay" ? "essay" : "mcq";
  if (qtype === "mcq" && (options.length !== 4 || options.some((o) => !o) || !answerOk)) {
    issues.push("Chưa lập được trắc nghiệm đầy đủ nên để ở dạng tự luận. Hãy điền đáp án mẫu hoặc tự soạn lại.");
    qtype = "essay";
  }

  let model = String(q.model_answer || "").trim();
  if (qtype === "essay" && !model) model = String(q.explanation || "").trim();
  if (qtype === "essay" && !model) {
    issues.push("Chưa có đáp án mẫu. Hãy tự điền để AI và bạn chấm được chính xác.");
  }

  let verified = null;
  const src = q.source_answer === null || q.source_answer === undefined ? null : Number(q.source_answer);
  if (qtype === "mcq" && src !== null && Number.isInteger(src) && src !== a) {
    issues.push("Đáp án ghi trong đề khác với kết quả AI giải. Hãy kiểm tra kỹ.");
    verified = false;
  }
  if (hasFigure) {
    issues.push("Câu có hình vẽ. Bản này chưa hiển thị được hình: hãy mô tả hình bằng chữ trong nội dung câu hoặc bỏ câu này.");
  }

  return {
    number: q.number ?? idx + 1,
    qtype,
    question: String(q.question || "").trim(),
    options: qtype === "mcq" ? options : ["", "", "", ""],
    answer: qtype === "mcq" ? a : 0,
    explanation: String(q.explanation || "").trim(),
    model_answer: model,
    rubric: String(q.rubric || "").trim(),
    points,
    skill_tag: String(q.skill_tag || "").trim(),
    level: LEVELS.includes(q.level) ? q.level : "thông hiểu",
    has_figure: hasFigure,
    issues,
    verified,
  };
}

export async function processExam(pdfBase64, { grade, convertOpen }) {
  const system =
    "Bạn là giáo viên Toán THCS Việt Nam, cẩn thận và chính xác khi đọc đề, giải bài, soạn đáp án và soát lỗi đề. Chỉ trả về JSON hợp lệ.";

  const shortRule = convertOpen
    ? 'chuyển thành trắc nghiệm (type "mcq") với 4 đáp án, đáp án đúng là kết quả bạn tính được, 3 đáp án sai là các lỗi sai phổ biến của học sinh'
    : 'giữ là tự luận (type "essay")';

  const prompt = `File PDF đính kèm là một đề kiểm tra môn Toán${grade ? ` lớp ${grade}` : " THCS"}. Hãy làm theo các bước:
1. Đọc và tách TỪNG câu hỏi trong đề, giữ nguyên nội dung. Công thức viết bằng LaTeX đặt trong dấu $...$.
2. Tự giải từng câu thật cẩn thận.
3. Xác định "type" cuối cùng của mỗi câu là "mcq" hoặc "essay":
   - Câu đề đã có các lựa chọn A, B, C, D: type "mcq", giữ nguyên đúng 4 lựa chọn (chỉ ghi nội dung, không kèm chữ "A.", "B.").
   - Câu điền đáp án hoặc tính ra một kết quả ngắn: ${shortRule}.
   - Câu chứng minh, giải thích, bài toán có lời văn nhiều bước hoặc nhiều ý: luôn là type "essay".
4. Với câu "mcq": "options" gồm đúng 4 phần tử, "answer" là chỉ số (0 đến 3) của đáp án đúng, "explanation" là lời giải ngắn gọn.
   Với câu "essay": "options" là mảng rỗng, "answer" là -1, "model_answer" là lời giải mẫu đầy đủ từng bước, "rubric" là biểu điểm chi tiết (ví dụ "Lập phương trình: 0,5đ; Giải đúng: 1đ; Kết luận: 0,5đ") sao cho tổng các ý bằng điểm của câu.
5. "points" là số điểm của câu nếu đề ghi rõ, nếu không ghi thì null.
6. Soát lỗi đề và ghi vào "issues" (mảng chuỗi tiếng Việt, ngắn gọn) khi gặp: thiếu dữ kiện, đề mâu thuẫn, có nhiều hơn một đáp án đúng, đáp án ghi trong đề khác kết quả bạn giải, câu cần hình vẽ nhưng văn bản không mô tả, ký hiệu hoặc chữ đọc không chắc chắn.
7. Nếu đề có sẵn bảng đáp án thì ghi chỉ số đáp án đó (0 đến 3) vào "source_answer", nếu không có thì để null.

Trả về JSON đúng dạng:
{"title":"","questions":[{"number":1,"type":"mcq","question":"","options":["","","",""],"answer":0,"explanation":"","model_answer":"","rubric":"","points":null,"skill_tag":"","level":"nhận biết","has_figure":false,"issues":[],"source_answer":null}]}

Yêu cầu:
- "skill_tag" là kỹ năng cụ thể, ngắn gọn (ví dụ: "giải phương trình bậc nhất một ẩn"). "level" là một trong: nhận biết, thông hiểu, vận dụng, vận dụng cao.
- "has_figure" là true nếu câu cần nhìn hình vẽ mới làm được.
- Không bịa thêm câu hỏi không có trong đề.`;

  const raw = await askJSON(
    [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }, { text: prompt }],
    system
  );
  const list = Array.isArray(raw?.questions) ? raw.questions : [];
  if (list.length === 0) {
    throw new Error("AI không tìm thấy câu hỏi nào trong file. Hãy kiểm tra file có đúng là đề kiểm tra và đọc được không.");
  }
  const questions = list.slice(0, 60).map(normalize);

  // Lượt 2: AI giải lại độc lập các câu trắc nghiệm (không thấy đáp án) để đối chiếu
  let verifyFailed = false;
  const solvable = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => q.qtype === "mcq" && !q.has_figure && q.question);
  if (solvable.length > 0) {
    try {
      const prompt2 = `Hãy tự giải từng câu trắc nghiệm Toán sau (không có đáp án cho sẵn) và chọn đáp án đúng. Tính toán cẩn thận từng bước trước khi chọn.
${JSON.stringify(solvable.map(({ q }, k) => ({ i: k, question: q.question, options: q.options })))}

Trả về mảng JSON dạng [{"i":0,"answer":2}], trong đó "answer" là chỉ số (0 đến 3) của đáp án đúng.
Nếu một câu không có đáp án đúng, có nhiều hơn một đáp án đúng, hoặc thiếu dữ kiện thì trả về "answer": -1.`;
      const solved = await askJSON([{ text: prompt2 }], system);
      const arr = Array.isArray(solved) ? solved : [];
      solvable.forEach(({ q }, k) => {
        const s = arr.find((x) => Number(x.i) === k);
        if (s && Number(s.answer) === q.answer) {
          if (q.verified !== false) q.verified = true;
        } else {
          q.verified = false;
          q.issues.push("Hai lần giải của AI cho kết quả khác nhau hoặc không chắc chắn. Hãy tự giải lại câu này.");
        }
      });
    } catch (e) {
      console.error("Lượt kiểm tra chéo bị lỗi:", e);
      verifyFailed = true;
    }
  }

  return { title: String(raw.title || "").slice(0, 120), questions, verifyFailed };
}