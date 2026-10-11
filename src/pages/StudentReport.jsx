import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { diagnose } from "../api";

function suggestLevel(rate) {
  if (rate < 50) return "Nên ôn lại mức nhận biết / thông hiểu";
  if (rate < 80) return "Nên luyện thêm mức vận dụng";
  return "Có thể thử thách mức vận dụng cao";
}

function barClass(rate) {
  if (rate < 50) return "low";
  if (rate < 80) return "mid";
  return "high";
}
const ORDER = ["nhận biết", "thông hiểu", "vận dụng", "vận dụng cao"];
const QUOTA = 4; // số câu tối đa cho mỗi kỹ năng

function targetLevels(rate) {
  if (rate < 50) return ["nhận biết", "thông hiểu"];
  if (rate < 80) return ["vận dụng"];
  return ["vận dụng cao"];
}

function levelDistance(level, targets) {
  const idx = ORDER.indexOf(level);
  if (idx < 0) return 9;
  return Math.min(...targets.map((t) => Math.abs(idx - ORDER.indexOf(t))));
}
export default function StudentReport() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [ai, setAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const navigate = useNavigate();
const [plan, setPlan] = useState(null);
const [planLoading, setPlanLoading] = useState(false);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
  .from("answers")
  .select("skill_tag, level, correct, attempt_id, question_id, attempts!inner(source)")
  .eq("attempts.source", "class");
      if (error) setError(error.message);
      else setRows(data);
    })();
  }, []);

  const stats = useMemo(() => {
    if (!rows) return [];
    const map = {};
    rows.forEach((r) => {
      const k = r.skill_tag || "Khác";
      map[k] = map[k] || { skill_tag: k, correct: 0, total: 0, levels: {} };
      map[k].total += 1;
      if (r.correct) map[k].correct += 1;
      const lv = r.level || "không rõ";
      map[k].levels[lv] = map[k].levels[lv] || { correct: 0, total: 0 };
      map[k].levels[lv].total += 1;
      if (r.correct) map[k].levels[lv].correct += 1;
    });
    return Object.values(map)
      .map((s) => ({ ...s, rate: Math.round((s.correct / s.total) * 100) }))
      .sort((a, b) => a.rate - b.rate);
  }, [rows]);

  const attempts = rows ? new Set(rows.map((r) => r.attempt_id)).size : 0;
  const totalCorrect = rows ? rows.filter((r) => r.correct).length : 0;

  async function runAI() {
    setAiLoading(true);
    setError("");
    try {
      const payload = stats.map((s) => ({
        skill_tag: s.skill_tag,
        correct: s.correct,
        total: s.total,
        by_level: s.levels,
      }));
      setAi(await diagnose(payload));
    } catch (e) {
      setError(e.message);
    } finally {
      setAiLoading(false);
    }
  }
  async function buildPlan() {
  setPlanLoading(true);
  setError("");
  try {
    const picked = stats.filter((s) => s.skill_tag !== "Khác").slice(0, 3);
    if (picked.length === 0) throw new Error("Chưa có kỹ năng nào để tạo bài bổ trợ.");

    const correctIds = new Set(rows.filter((r) => r.correct && r.question_id).map((r) => r.question_id));
    const seenIds = new Set(rows.filter((r) => r.question_id).map((r) => r.question_id));

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("status", "approved")
      .in("skill_tag", picked.map((s) => s.skill_tag));
    if (error) throw new Error(error.message);

    const items = picked.map((s) => {
      const targets = targetLevels(s.rate);
      const pool = data
        .filter((q) => q.skill_tag === s.skill_tag && !correctIds.has(q.id))
        .map((q) => ({
          q,
          d: levelDistance(q.level, targets),
          seen: seenIds.has(q.id) ? 1 : 0,
          r: Math.random(),
        }))
        .sort((a, b) => a.d - b.d || a.seen - b.seen || a.r - b.r);
      return {
        skill_tag: s.skill_tag,
        rate: s.rate,
        targets,
        questions: pool.slice(0, QUOTA).map((x) => x.q),
      };
    });
    setPlan(items);
  } catch (e) {
    setError(e.message);
  } finally {
    setPlanLoading(false);
  }
}

function startRemedial() {
  const questions = plan.flatMap((p) => p.questions);
  navigate("/student", { state: { remedial: questions } });
}
  if (!rows && !error) return <p className="page muted">Đang tải...</p>;

  if (rows && rows.length === 0) {
    return (
      <div className="page">
        <h1>Báo cáo của tôi</h1>
        <div className="card">
          <p>Bạn chưa có bài làm nào để phân tích.</p>
          <Link className="btn" to="/student">Làm bài ngay</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Báo cáo của tôi</h1>
      {error && <p className="error">{error}</p>}

      <div className="card summary">
        <div><b>{attempts}</b><span>lượt làm bài</span></div>
        <div><b>{rows?.length ?? 0}</b><span>câu đã làm</span></div>
        <div>
          <b>{rows?.length ? Math.round((totalCorrect / rows.length) * 100) : 0}%</b>
          <span>tỉ lệ đúng</span>
        </div>
      </div>

      <h2>Theo từng kỹ năng (yếu nhất ở trên)</h2>
      <div className="card">
        {stats.map((s) => (
          <div className="skillrow" key={s.skill_tag}>
            <div className="skillhead">
              <span>{s.skill_tag}</span>
              <b>{s.correct}/{s.total} câu · {s.rate}%</b>
            </div>
            <div className="bar">
              <div className={`fill ${barClass(s.rate)}`} style={{ width: `${s.rate}%` }} />
            </div>
            <p className="muted small">
              {suggestLevel(s.rate)}
              {s.total < 3 ? " · Ít dữ liệu, chưa kết luận chắc chắn" : ""}
            </p>
          </div>
        ))}
      </div>
        <h2>Bài tập bổ trợ</h2>
{!plan && (
  <button onClick={buildPlan} disabled={planLoading}>
    {planLoading ? "Đang chọn bài..." : "Tạo bài bổ trợ cho tôi"}
  </button>
)}
{plan && (
  <div className="card">
    {plan.map((p) => (
      <div className="planitem" key={p.skill_tag}>
        <b>{p.skill_tag}</b>
        <p className="muted small">
          Tỉ lệ đúng hiện tại {p.rate}% · Mức độ gợi ý: {p.targets.join(" / ")} · {p.questions.length} câu
        </p>
        {p.questions.length < QUOTA && (
          <p className="muted small">
            Ngân hàng chưa đủ câu cho kỹ năng này, hãy nhờ giáo viên bổ sung thêm.
          </p>
        )}
      </div>
    ))}
    <div className="row">
      <button onClick={startRemedial} disabled={plan.every((p) => p.questions.length === 0)}>
        Bắt đầu làm bài bổ trợ ({plan.reduce((n, p) => n + p.questions.length, 0)} câu)
      </button>
      <button className="ghost" onClick={() => setPlan(null)}>Chọn lại</button>
    </div>
  </div>
)}
      <h2>Nhận xét của AI</h2>
      {!ai && (
        <button onClick={runAI} disabled={aiLoading}>
          {aiLoading ? "AI đang phân tích..." : "Phân tích bằng AI"}
        </button>
      )}

      {ai && (
        <div className="card">
          <p>{ai.summary}</p>

          {ai.weaknesses?.length > 0 && (
            <>
              <h3>Cần cải thiện</h3>
              {ai.weaknesses.map((w, i) => (
                <div className="aibox bad" key={i}>
                  <b>{w.skill_tag}</b>
                  <p className="muted">{w.possible_cause}</p>
                  <p>{w.advice}</p>
                </div>
              ))}
            </>
          )}

          {ai.strengths?.length > 0 && (
            <>
              <h3>Điểm mạnh</h3>
              {ai.strengths.map((s, i) => (
                <div className="aibox good" key={i}>
                  <b>{s.skill_tag}</b>
                  <p>{s.comment}</p>
                </div>
              ))}
            </>
          )}

          {ai.next_steps?.length > 0 && (
            <>
              <h3>Việc nên làm tiếp</h3>
              <ol>
                {ai.next_steps.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ol>
            </>
          )}
          <button className="ghost" onClick={runAI} disabled={aiLoading}>
            {aiLoading ? "Đang phân tích..." : "Phân tích lại"}
          </button>
        </div>
      )}
    </div>
  );
}