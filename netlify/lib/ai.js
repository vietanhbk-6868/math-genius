import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Gọi AI và bắt buộc trả về JSON
async function askJSON(system, prompt) {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      temperature: 0.7,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  return JSON.parse(res.text);
}

export async function generateQuestions({ topic, grade, level, count }) {
  const system =
    "Bạn là giáo viên Toán THCS Việt Nam, soạn câu hỏi bám sát chương trình GDPT 2018. Chỉ trả về JSON hợp lệ.";

  const prompt = `Tạo ${count} câu trắc nghiệm Toán lớp ${grade}, chủ đề "${topic}", mức độ "${level}" (nhận biết / thông hiểu / vận dụng / vận dụng cao).

Trả về mảng JSON, mỗi phần tử có dạng:
{"question":"","options":["","","",""],"answer":0,"explanation":"","skill_tag":"","level":""}

Yêu cầu:
- "answer" là chỉ số (0-3) của đáp án đúng.
- "skill_tag" là kỹ năng cụ thể, ngắn gọn (ví dụ: "giải phương trình bậc nhất một ẩn").
- Viết công thức bằng LaTeX trong dấu $...$.
- 3 đáp án sai phải là lỗi sai phổ biến của học sinh.
- Tự kiểm tra lại đáp án trước khi trả về.
- Nếu chủ đề không thuộc môn Toán THCS thì trả về mảng rỗng [].`;

  return askJSON(system, prompt);
}
export async function diagnose(stats, scope = "student", meta = null) {
  if (scope === "class") {
    const system =
      "Bạn là chuyên gia sư phạm Toán THCS Việt Nam, tư vấn ngắn gọn, thực tế cho giáo viên. Chỉ trả về JSON hợp lệ.";

    const prompt = `Dưới đây là dữ liệu tổng hợp ẩn danh của một lớp học (không có tên học sinh).
Thông tin chung: ${JSON.stringify(meta)}
Kết quả theo từng kỹ năng (mỗi kỹ năng: số câu đúng, tổng số câu đã làm, số học sinh đã làm): ${JSON.stringify(stats)}

Hãy phân tích và trả về JSON đúng dạng:
{"summary":"","strengths":[{"skill_tag":"","comment":""}],"weaknesses":[{"skill_tag":"","possible_cause":"","advice":""}],"next_steps":[""]}

Yêu cầu:
- Chỉ dựa trên dữ liệu được cung cấp, không bịa thêm. Nếu dữ liệu ít (dưới 3 học sinh hoặc dưới 10 câu cho một kỹ năng) thì nói rõ kết luận chỉ mang tính tham khảo.
- "possible_cause" viết dạng phỏng đoán ("có thể do..."), vì không biết chính xác học sinh sai ở bước nào.
- "advice" là gợi ý dạy học cụ thể cho giáo viên (ví dụ: dạng bài nên chữa lại, hoạt động 10 đến 15 phút trên lớp, ví dụ minh họa nên dùng).
- "next_steps" tối đa 3 việc cho tiết học tới, ưu tiên kỹ năng yếu nhất.
- Giọng văn chuyên nghiệp, ngắn gọn. Dùng $...$ cho công thức nếu cần.
- "strengths" hoặc "weaknesses" có thể là mảng rỗng nếu không có.`;

    return askJSON(system, prompt);
  }

  const system =
    "Bạn là gia sư Toán THCS Việt Nam, phân tích kết quả học tập ngắn gọn, tích cực và cụ thể. Chỉ trả về JSON hợp lệ.";

  const prompt = `Dưới đây là kết quả làm bài của một học sinh THCS theo từng kỹ năng (mỗi kỹ năng gồm: số câu đúng, tổng số câu, và chi tiết theo mức độ):
${JSON.stringify(stats)}

Hãy phân tích và trả về JSON đúng dạng:
{"summary":"","strengths":[{"skill_tag":"","comment":""}],"weaknesses":[{"skill_tag":"","possible_cause":"","advice":""}],"next_steps":[""]}

Yêu cầu:
- Chỉ dựa trên dữ liệu được cung cấp, không bịa thêm. Kỹ năng nào có ít hơn 3 câu thì nói rõ là chưa đủ dữ liệu để kết luận chắc chắn.
- "possible_cause" viết dạng phỏng đoán ("có thể do..."), vì không biết chính xác em sai ở bước nào.
- "advice" cụ thể, làm được trong 1 đến 2 buổi ôn tập.
- "next_steps" tối đa 3 việc, ưu tiên kỹ năng yếu nhất.
- Giọng văn động viên, dễ hiểu với học sinh. Dùng $...$ cho công thức nếu cần.
- "strengths" hoặc "weaknesses" có thể là mảng rỗng nếu không có.`;

  return askJSON(system, prompt);
}
function validQuestion(q) {
  if (!q || typeof q.question !== "string" || q.question.trim().length < 5) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (!q.options.every((o) => typeof o === "string" && o.trim())) return false;
  if (new Set(q.options.map((o) => o.trim())).size !== 4) return false;
  const a = Number(q.answer);
  return Number.isInteger(a) && a >= 0 && a <= 3;
}

// Sinh câu hỏi rồi cho AI tự giải lại, chỉ giữ câu có đáp án khớp
export async function generateVerifiedQuestions({ topic, grade, level, count }) {
  const raw = await generateQuestions({ topic, grade, level, count });
  const list = (Array.isArray(raw) ? raw : [])
    .filter(validQuestion)
    .slice(0, count)
    .map((q) => ({ ...q, answer: Number(q.answer) }));
  if (list.length === 0) return { questions: [], generated: 0 };

  const system =
    "Bạn là giáo viên Toán THCS Việt Nam. Giải cẩn thận từng câu trắc nghiệm. Chỉ trả về JSON hợp lệ.";
  const prompt = `Hãy tự giải từng câu trắc nghiệm Toán sau (không có đáp án cho sẵn) và chọn đáp án đúng. Tính toán cẩn thận từng bước trước khi chọn.
${JSON.stringify(list.map((q, i) => ({ i, question: q.question, options: q.options })))}

Trả về mảng JSON dạng [{"i":0,"answer":2}], trong đó "answer" là chỉ số (0 đến 3) của đáp án đúng.
Nếu một câu không có đáp án đúng, có nhiều hơn một đáp án đúng, hoặc thiếu dữ kiện, trả về "answer": -1.`;

  const solved = await askJSON(system, prompt);
  const kept = list.filter((q, i) =>
    (Array.isArray(solved) ? solved : []).some(
      (s) => Number(s.i) === i && Number(s.answer) === q.answer
    )
  );
  return { questions: kept, generated: list.length };
}