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
- Tự kiểm tra lại đáp án trước khi trả về.`;

  return askJSON(system, prompt);
}
export async function diagnose(stats) {
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