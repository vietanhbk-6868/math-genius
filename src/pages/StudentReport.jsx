import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

export default function StudentReport() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [ai, setAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("answers")
        .select("skill_tag, level, correct, attempt_id");
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