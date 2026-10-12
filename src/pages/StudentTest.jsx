import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { supabase } from "../supabase";
import MathText from "../components/MathText";
import { fmtPoints, pointsClass } from "../score";

const LETTERS = ["A", "B", "C", "D"];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

export default function StudentTest() {
  const location = useLocation();
  const [stage, setStage] = useState("setup"); // setup | test | result
  const [mode, setMode] = useState("normal"); // normal | remedial | ai | assignment
  const [assignment, setAssignment] = useState(null);
  const [meta, setMeta] = useState([]);
  const [form, setForm] = useState({ grade: 8, topic: "", count: 10 });
  const [questions, setQuestions] = useState([]);
  const [chosen, setChosen] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Nhận bài từ các trang khác (bài tập được giao, bài bổ trợ, luyện AI)
  useEffect(() => {
    const s = location.state;
    if (s?.assignment?.questions?.length) {
      setAssignment(s.assignment);
      setQuestions(s.assignment.questions);
      setMode("assignment");
    } else if (s?.remedial?.length) {
      setQuestions(s.remedial);
      setMode("remedial");
    } else if (s?.aiPractice?.length) {
      setQuestions(s.aiPractice);
      setMode("ai");
    } else {
      return;
    }
    setChosen({});
    setStage("test");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    () => [
      ...new Set(
        meta
          .filter((m) => m.grade === Number(form.grade))
          .map((m) => m.topic)
          .filter(Boolean),
      ),
    ],
    [meta, form.grade],
  );
  const available = meta.filter(
    (m) =>
      m.grade === Number(form.grade) && (!form.topic || m.topic === form.topic),
  ).length;

  async function start(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    let q = supabase
      .from("questions")
      .select("*")
      .eq("status", "approved")
      .eq("grade", Number(form.grade));
    if (form.topic) q = q.eq("topic", form.topic);
    const { data, error } = await q;
    setBusy(false);
    if (error) return setError(error.message);
    if (!data.length)
      return setError(
        "Chưa có câu hỏi phù hợp. Hãy nhờ giáo viên thêm câu hỏi.",
      );
    setQuestions(shuffle(data).slice(0, Number(form.count)));
    setChosen({});
    setMode("normal");
    setStage("test");
  }

  async function submit() {
    const unanswered = questions.filter(
      (q) => chosen[q.id] === undefined,
    ).length;
    if (
      unanswered > 0 &&
      !window.confirm(`Còn ${unanswered} câu chưa làm. Vẫn nộp bài?`)
    )
      return;

    setBusy(true);
    setError("");
    const topic =
      mode === "assignment"
        ? assignment.title
        : mode === "remedial"
          ? "Bổ trợ"
          : mode === "ai"
            ? "Tự luyện AI"
            : form.topic || null;
    const grade =
      mode === "normal" ? Number(form.grade) : (questions[0]?.grade ?? null);

    const { data, error } = await supabase.rpc("submit_attempt", {
      p_source: mode === "ai" ? "ai_self" : "class",
      p_assignment: mode === "assignment" ? assignment.id : null,
      p_topic: topic,
      p_grade: grade,
      p_answers: questions.map((q) => ({
        question_id: q.id,
        chosen: chosen[q.id] ?? null,
      })),
    });
    setBusy(false);
    if (error) return setError(error.message);

    const rows = questions.map((q) => ({
      question: q,
      chosen: chosen[q.id] ?? null,
      correct: chosen[q.id] === q.answer,
    }));
    setResult({ ...data, rows });
    setStage("result");
  }

  if (stage === "setup") {
    return (
      <div className="page">
        <h1>Luyện tập trắc nghiệm</h1>
        <form className="card form" onSubmit={start}>
          <label>
            Lớp
            <select
              value={form.grade}
              onChange={(e) =>
                setForm({ ...form, grade: e.target.value, topic: "" })
              }
            >
              {[6, 7, 8, 9].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="grow">
            Chủ đề
            <select
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            >
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
        <h1>
          {mode === "assignment"
            ? assignment.title
            : mode === "remedial"
              ? "Bài bổ trợ"
              : mode === "ai"
                ? "Tự luyện với AI"
                : "Bài luyện tập"}
        </h1>
        {mode === "assignment" && assignment.description && (
          <p className="muted">{assignment.description}</p>
        )}
        {mode === "ai" && (
          <p className="notice">
            Câu hỏi do AI tạo, chưa qua giáo viên duyệt. Hãy đối chiếu với kiến
            thức đã học.
          </p>
        )}
        {questions.map((q, idx) => (
          <div className="card" key={q.id}>
            <p className="q">
              Câu {idx + 1}. <MathText text={q.question} />
            </p>
            {q.options.map((o, i) => (
              <label
                className={`choice ${chosen[q.id] === i ? "picked" : ""}`}
                key={i}
              >
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
      <h1>Kết quả{mode === "assignment" ? `: ${assignment.title}` : ""}</h1>
      <div className="card score">
        <div className={`bigpoints ${pointsClass(result.points)}`}>
          {fmtPoints(result.points)}
          <small>/10</small>
        </div>
        <p className="muted">
          {result.score}/{result.total} câu đúng
        </p>
      </div>
      {mode === "assignment" && (
        <p className="notice">
          Điểm đã được ghi nhận cho bài tập. Nếu bài còn lượt làm, điểm cao nhất
          sẽ được tính.
        </p>
      )}
      {mode === "ai" && (
        <p className="muted">
          Bài tự luyện AI không được tính vào báo cáo và bảng điểm của lớp.
        </p>
      )}

      <h2>Theo từng kỹ năng</h2>
      <div className="card">
        {skillSummary(result.rows).map(([skill, s]) => (
          <p key={skill} className="skill">
            <span>{skill}</span>
            <b>
              {s.correct}/{s.total} câu
            </b>
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
            {r.chosen === null ? (
              "chưa chọn"
            ) : (
              <MathText text={r.question.options[r.chosen]} />
            )}
          </p>
          {!r.correct && (
            <p className="muted">
              Đáp án đúng:{" "}
              <MathText text={r.question.options[r.question.answer]} />
            </p>
          )}
          <p className="expl">
            <b>Lời giải:</b> <MathText text={r.question.explanation} />
          </p>
        </div>
      ))}
      <div className="row">
        {mode === "assignment" ? (
          <Link className="btn" to="/student/assignments">
            Về danh sách bài tập
          </Link>
        ) : (
          <button
            onClick={() => {
              setMode("normal");
              setAssignment(null);
              setStage("setup");
            }}
          >
            Làm bài khác
          </button>
        )}
        <Link className="btn ghost" to="/student/report">
          Xem báo cáo
        </Link>
      </div>
    </div>
  );
}
