import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { generateQuestions } from "../api";
import MathText from "../components/MathText";

const LEVELS = ["nhận biết", "thông hiểu", "vận dụng", "vận dụng cao"];
const LETTERS = ["A", "B", "C", "D"];

export default function TeacherQuestionBank() {
  const [form, setForm] = useState({ grade: 8, topic: "", level: "thông hiểu", count: 3 });
  const [drafts, setDrafts] = useState([]);
  const [bank, setBank] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadBank() {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setError(error.message);
    else setBank(data);
  }

  useEffect(() => {
    loadBank();
  }, []);

  async function handleGenerate(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const list = await generateQuestions({
        ...form,
        grade: Number(form.grade),
        count: Number(form.count),
      });
      if (!Array.isArray(list)) throw new Error("AI trả về sai định dạng, hãy thử lại");
      const newDrafts = list.map((q) => ({
        ...q,
        answer: Number(q.answer),
        _id: crypto.randomUUID(),
        grade: Number(form.grade),
        topic: form.topic,
      }));
      setDrafts((prev) => [...newDrafts, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(id, patch) {
    setDrafts((ds) => ds.map((d) => (d._id === id ? { ...d, ...patch } : d)));
  }

  async function saveDraft(d) {
    const { error } = await supabase.from("questions").insert({
      grade: d.grade,
      topic: d.topic,
      question: d.question,
      options: d.options,
      answer: d.answer,
      explanation: d.explanation,
      skill_tag: d.skill_tag,
      level: d.level,
      status: "approved",
    });
    if (error) return setError(error.message);
    setDrafts((ds) => ds.filter((x) => x._id !== d._id));
    loadBank();
  }

  async function removeFromBank(id) {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return setError(error.message);
    loadBank();
  }

  return (
    <div className="page">
      <datalist id="skills">
  {[...new Set(bank.map((q) => q.skill_tag).filter(Boolean))].map((t) => (
    <option key={t} value={t} />
  ))}
</datalist>
      <h1>MathGenius · Ngân hàng câu hỏi</h1>

      <form className="card form" onSubmit={handleGenerate}>
        <label>
          Lớp
          <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
            {[6, 7, 8, 9].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="grow">
          Chủ đề
          <input
            required
            placeholder="Ví dụ: Phương trình bậc nhất một ẩn"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
          />
        </label>
        <label>
          Mức độ
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
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
          {loading ? "AI đang soạn..." : "Sinh câu hỏi"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {drafts.length > 0 && (
        <section>
          <h2>Câu hỏi nháp chờ duyệt ({drafts.length})</h2>
          {drafts.map((d) => (
            <div className="card" key={d._id}>
              <p className="q"><MathText text={d.question} /></p>
              <ul className="opts">
                {d.options.map((o, i) => (
                  <li key={i} className={i === d.answer ? "correct" : ""}>
                    <b>{LETTERS[i]}.</b> <MathText text={o} />
                  </li>
                ))}
              </ul>
              <p className="expl"><b>Lời giải:</b> <MathText text={d.explanation} /></p>
              <div className="row">
                <label className="grow">
  Kỹ năng
  <input
    list="skills"
    value={d.skill_tag || ""}
    onChange={(e) => updateDraft(d._id, { skill_tag: e.target.value })}
  />
</label>
                <label>
                  Đáp án đúng
                  <select
                    value={d.answer}
                    onChange={(e) => updateDraft(d._id, { answer: Number(e.target.value) })}
                  >
                    {LETTERS.map((l, i) => (
                      <option key={l} value={i}>{l}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Mức độ
                  <select value={d.level} onChange={(e) => updateDraft(d._id, { level: e.target.value })}>
                    {LEVELS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <button onClick={() => saveDraft(d)}>Duyệt và lưu</button>
                <button className="ghost" onClick={() => setDrafts((ds) => ds.filter((x) => x._id !== d._id))}>
                  Bỏ
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2>Ngân hàng câu hỏi ({bank.length})</h2>
        {bank.length === 0 && <p className="muted">Chưa có câu hỏi nào được duyệt.</p>}
        {bank.map((q) => (
          <div className="card" key={q.id}>
            <p className="q"><MathText text={q.question} /></p>
            <p className="muted">
              Đáp án: <MathText text={q.options?.[q.answer]} />
            </p>
            <div className="row">
              <span className="tag">Lớp {q.grade}</span>
              <span className="tag">{q.skill_tag}</span>
              <span className="tag">{q.level}</span>
              <button className="ghost" onClick={() => removeFromBank(q.id)}>Xóa</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}