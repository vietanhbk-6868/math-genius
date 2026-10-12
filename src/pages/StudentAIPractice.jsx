import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { generateStudentQuestions } from "../api";

const LEVELS = ["nhận biết", "thông hiểu", "vận dụng", "vận dụng cao"];

export default function StudentAIPractice() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const g = parseInt(profile?.class_name);
  const [form, setForm] = useState({
    grade: [6, 7, 8, 9].includes(g) ? g : 8,
    topic: "",
    level: "thông hiểu",
    count: 3,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function generate(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await generateStudentQuestions({
          ...form,
          grade: Number(form.grade),
          count: Number(form.count),
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function start() {
    navigate("/student", { state: { aiPractice: result.questions } });
  }

  return (
    <div className="page">
      <h1>Luyện tập với AI</h1>
      <p className="notice">
        Câu hỏi ở đây do AI soạn và <b>chưa qua giáo viên duyệt</b>. Hệ thống đã
        cho AI tự giải lại để loại câu đáp án không khớp, nhưng vẫn có thể có
        sai sót. Nếu thấy lời giải lạ, hãy hỏi giáo viên. Bài tự luyện không
        được tính vào báo cáo của lớp. Mỗi ngày bạn tạo được tối đa 20 câu.
      </p>

      <form className="card form" onSubmit={generate}>
        <label>
          Lớp
          <select
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
          >
            {[6, 7, 8, 9].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          Chủ đề muốn luyện
          <input
            required
            minLength={3}
            placeholder="Ví dụ: Giải phương trình bậc nhất một ẩn"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
          />
        </label>
        <label>
          Mức độ
          <select
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
          >
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          Số câu
          <input
            type="number"
            min="1"
            max="5"
            value={form.count}
            onChange={(e) => setForm({ ...form, count: e.target.value })}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "AI đang soạn và kiểm tra..." : "Tạo câu hỏi"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card">
          <h3>Đã sẵn sàng: {result.kept} câu</h3>
          <p className="muted">
            AI soạn {result.generated} câu, giữ lại {result.kept} câu sau khi tự
            kiểm tra chéo
            {result.generated > result.kept
              ? ` (đã loại ${result.generated - result.kept} câu không chắc chắn)`
              : ""}
            . Hôm nay bạn còn tạo được {result.remaining} câu.
          </p>
          <button onClick={start}>Bắt đầu làm bài</button>
        </div>
      )}
    </div>
  );
}
