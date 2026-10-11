import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import MathText from "../components/MathText";
import { useAuth } from "../AuthContext";
import { useLocation, Link } from "react-router-dom";
const LETTERS = ["A", "B", "C", "D"];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StudentTest() {
  const { session, profile } = useAuth();
  const location = useLocation();
const [mode, setMode] = useState("normal");

useEffect(() => {
  const rq = location.state?.remedial;
  if (rq?.length) {
    setQuestions(rq);
    setChosen({});
    setMode("remedial");
    setStage("test");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
  const [stage, setStage] = useState("setup"); // setup | test | result
  const [meta, setMeta] = useState([]);
  const [form, setForm] = useState({ name: "", grade: 8, topic: "", count: 10 });
  const [questions, setQuestions] = useState([]);
  const [chosen, setChosen] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("grade,topic")
        .eq("status", "approved");
      if (error) setError(error.message);
      else setMeta(data);
    })();
  }, []);

  const topics = useMemo(
    () => [...new Set(meta.filter((m) => m.grade === Number(form.grade)).map((m) => m.topic).filter(Boolean))],
    [meta, form.grade]
  );
  const available = meta.filter(
    (m) => m.grade === Number(form.grade) && (!form.topic || m.topic === form.topic)
  ).length;

  async function start(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    let q = supabase.from("questions").select("*").eq("status", "approved").eq("grade", Number(form.grade));
    if (form.topic) q = q.eq("topic", form.topic);
    const { data, error } = await q;
    setBusy(false);
    if (error) return setError(error.message);
    if (!data.length) return setError("Chưa có câu hỏi phù hợp. Hãy nhờ giáo viên thêm câu hỏi.");
    setQuestions(shuffle(data).slice(0, Number(form.count)));
    setChosen({});
    setStage("test");
  }

  async function submit() {
    const unanswered = questions.filter((q) => chosen[q.id] === undefined).length;
    if (unanswered > 0 && !window.confirm(`Còn ${unanswered} câu chưa làm. Vẫn nộp bài?`)) return;

    setBusy(true);
    setError("");
    const rows = questions.map((q) => ({
      question: q,
      chosen: chosen[q.id] ?? null,
      correct: chosen[q.id] === q.answer,
    }));
    const score = rows.filter((r) => r.correct).length;

    const { data: attempt, error: e1 } = await supabase
      .from("attempts")
      .insert({
        student_name: profile.full_name,
        student_id: session.user.id,
        grade: mode === "remedial" ? (questions[0]?.grade ?? null) : Number(form.grade),
        topic: mode === "remedial" ? "Bổ trợ" : form.topic || null,
        score,
        total: rows.length,
      })
      .select()
      .single();
    if (e1) {
      setBusy(false);
      return setError(e1.message);
    }

    const { error: e2 } = await supabase.from("answers").insert(
      rows.map((r) => ({
        attempt_id: attempt.id,
        question_id: r.question.id,
        skill_tag: r.question.skill_tag,
        level: r.question.level,
        chosen: r.chosen,
        correct: r.correct,
      }))
    );
    setBusy(false);
    if (e2) return setError(e2.message);

    setResult({ score, total: rows.length, rows });
    setStage("result");
  }

  // Thống kê tỉ lệ đúng theo kỹ năng
  function skillSummary(rows) {
    const map = {};
    rows.forEach((r) => {
      const k = r.question.skill_tag || "Khác";
      map[k] = map[k] || { correct: 0, total: 0 };
      map[k].total += 1;
      if (r.correct) map[k].correct += 1;
    });
    return Object.entries(map);
  }

  if (stage === "setup") {
    return (
      <div className="page">
        <h1>Làm bài trắc nghiệm</h1>
        <form className="card form" onSubmit={start}>
          <label>
            Lớp
            <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, topic: "" })}>
              {[6, 7, 8, 9].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="grow">
            Chủ đề
            <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
              <option value="">Tất cả chủ đề</option>
              {topics.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Số câu
            <input
              type="number"
              min="1"
              max={Math.max(available, 1)}
              value={form.count}
              onChange={(e) => setForm({ ...form, count: e.target.value })}
            />
          </label>
          <button type="submit" disabled={busy}>
            Bắt đầu
          </button>
        </form>
        <p className="muted">Hiện có {available} câu hỏi phù hợp.</p>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (stage === "test") {
    return (
      <div className="page">
        <h1>{mode === "remedial" ? "Bài bổ trợ của " : "Bài làm của "}{profile.full_name}</h1>
        {questions.map((q, idx) => (
          <div className="card" key={q.id}>
            <p className="q">
              Câu {idx + 1}. <MathText text={q.question} />
            </p>
            {q.options.map((o, i) => (
              <label className={`choice ${chosen[q.id] === i ? "picked" : ""}`} key={i}>
                <input
                  type="radio"
                  name={q.id}
                  checked={chosen[q.id] === i}
                  onChange={() => setChosen({ ...chosen, [q.id]: i })}
                />
                <span>
                  <b>{LETTERS[i]}.</b> <MathText text={o} />
                </span>
              </label>
            ))}
          </div>
        ))}
        {error && <p className="error">{error}</p>}
        <button onClick={submit} disabled={busy}>
          {busy ? "Đang chấm..." : "Nộp bài"}
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Kết quả của {form.name}</h1>
      <div className="card score">
        {result.score} / {result.total} câu đúng
      </div>

      <h2>Theo từng kỹ năng</h2>
      <div className="card">
        {skillSummary(result.rows).map(([skill, s]) => (
          <p key={skill} className="skill">
            <span>{skill}</span>
            <b>{s.correct}/{s.total}</b>
          </p>
        ))}
      </div>

      <h2>Xem lại bài làm</h2>
      {result.rows.map((r, idx) => (
        <div className="card" key={r.question.id}>
          <p className="q">
            Câu {idx + 1}. <MathText text={r.question.question} />
          </p>
          <p className={r.correct ? "ok" : "bad"}>
            {r.correct ? "Đúng" : "Sai"} · Bạn chọn:{" "}
            {r.chosen === null ? "chưa chọn" : <MathText text={r.question.options[r.chosen]} />}
          </p>
          {!r.correct && (
            <p className="muted">
              Đáp án đúng: <MathText text={r.question.options[r.question.answer]} />
            </p>
          )}
          <p className="expl">
            <b>Lời giải:</b> <MathText text={r.question.explanation} />
          </p>
        </div>
      ))}
      <div className="row">
  <button onClick={() => { setMode("normal"); setStage("setup"); }}>Làm bài khác</button>
  <Link className="btn ghost" to="/student/report">Xem báo cáo</Link>
</div>
    </div>
  );
}