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
  let convertible = q.convertible !== false;
  const a = Number(q.answer);
  const answerOk = q.answer !== null && q.answer !== undefined && Number.isInteger(a) && a >= 0 && a <= 3;

  if (options.length !== 4 || options.some((o) => !o)) {
    if (convertible) issues.push("Chưa lập được đủ 4 đáp án, hãy tự nhập.");
    convertible = false;
  }
  if (convertible && !answerOk) {
    issues.push("AI chưa xác định được đáp án đúng.");
    convertible = false;
  }

  let verified = null;
  const src = q.source_answer === null || q.source_answer === undefined ? null : Number(q.source_answer);
  if (convertible && src !== null && Number.isInteger(src) && src !== a) {
    issues.push("Đáp án ghi trong đề khác với kết quả AI giải. Hãy kiểm tra kỹ.");
    verified = false;
  }

  const hasFigure = !!q.has_figure;
  if (hasFigure) {
    issues.push("Câu có hình vẽ. Bản này chưa hiển thị được hình: hãy mô tả hình bằng chữ trong nội dung câu hoặc bỏ câu này.");
  }

  return {
    number: q.number ?? idx + 1,
    question: String(q.question || "").trim(),
    options: options.length === 4 ? options : ["", "", "", ""],
    answer: convertible ? a : 0,
    explanation: String(q.explanation || "").trim(),
    skill_tag: String(q.skill_tag || "").trim(),
    level: LEVELS.includes(q.level) ? q.level : "thông hiểu",
    convertible,
    has_figure: hasFigure,
    issues,
    verified,
  };
}

export async function processExam(pdfBase64, { grade, convertOpen }) {
  const system =
    "Bạn là giáo viên Toán THCS Việt Nam, cẩn thận và chính xác khi đọc đề, giải bài và soát lỗi đề. Chỉ trả về JSON hợp lệ.";

  const prompt = `File PDF đính kèm là một đề kiểm tra môn Toán${grade ? ` lớp ${grade}` : " THCS"}. Hãy làm theo các bước:
1. Đọc và tách TỪNG câu hỏi trong đề, giữ nguyên nội dung. Viết công thức bằng LaTeX đặt trong dấu $...$.
2. Tự giải từng câu thật cẩn thận.
3. Chuyển mỗi câu thành câu trắc nghiệm 4 đáp án:
   - Nếu đề đã có các lựa chọn A, B, C, D thì giữ nguyên 4 lựa chọn đó (chỉ ghi nội dung, không kèm chữ "A.", "B.").
   - Nếu là câu điền đáp án hoặc tự luận: ${
     convertOpen
       ? 'nếu kết quả cuối cùng là một giá trị ngắn gọn thì chuyển thành trắc nghiệm, đáp án đúng là kết quả bạn tính được, 3 đáp án sai là các lỗi sai phổ biến của học sinh. Nếu là bài chứng minh, giải thích hoặc nhiều ý thì đặt "convertible": false.'
       : 'không chuyển, đặt "convertible": false.'
   }
4. Soát lỗi đề và ghi vào "issues" (mảng chuỗi tiếng Việt, ngắn gọn) khi gặp: thiếu dữ kiện, đề mâu thuẫn, có nhiều hơn một đáp án đúng, đáp án ghi trong đề khác kết quả bạn giải, câu cần hình vẽ nhưng văn bản không mô tả, ký hiệu hoặc chữ đọc không chắc chắn.
5. Nếu đề có sẵn bảng đáp án thì ghi chỉ số đáp án đó (0 đến 3) vào "source_answer", nếu không có thì để null.

Trả về JSON đúng dạng:
{"title":"","questions":[{"number":1,"question":"","options":["","","",""],"answer":0,"explanation":"","skill_tag":"","level":"nhận biết","convertible":true,"has_figure":false,"issues":[],"source_answer":null}]}

Yêu cầu:
- "answer" là chỉ số (0 đến 3) của đáp án đúng theo kết quả bạn tự giải. "explanation" là lời giải ngắn gọn.
- "skill_tag" là kỹ năng cụ thể, ngắn gọn (ví dụ: "giải phương trình bậc nhất một ẩn"). "level" là một trong: nhận biết, thông hiểu, vận dụng, vận dụng cao.
- "has_figure" là true nếu câu cần nhìn hình vẽ mới làm được.
- Câu không chuyển được thì "options" để mảng rỗng và vẫn ghi nội dung câu vào "question".
- Không bịa thêm câu hỏi không có trong đề.`;

  const raw = await askJSON([{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }, { text: prompt }], system);
  const list = Array.isArray(raw?.questions) ? raw.questions : [];
  if (list.length === 0) {
    throw new Error("AI không tìm thấy câu hỏi nào trong file. Hãy kiểm tra file có đúng là đề kiểm tra và đọc được không.");
  }
  const questions = list.slice(0, 60).map(normalize);

  // Lượt 2: AI giải lại độc lập (không thấy đáp án) để đối chiếu
  let verifyFailed = false;
  const solvable = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => q.convertible && !q.has_figure && q.question);
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