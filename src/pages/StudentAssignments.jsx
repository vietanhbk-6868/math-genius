import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { fmtPoints, pointsClass } from "../score";
import MathText from "../components/MathText";

const fmtDue = (d) =>
  new Date(d).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

export default function StudentAssignments() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [fb, setFb] = useState({}); // nhận xét tự luận theo bài tập

  async function load() {
    const [a, t] = await Promise.all([
      supabase.from("assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("attempts").select("assignment_id, points, status").not("assignment_id", "is", null),
    ]);
    const err = a.error || t.error;
    if (err) return setError(err.message);
    const byAsg = {};
    t.data.forEach((x) => {
      const p = Number(x.points);
      byAsg[x.assignment_id] ||= { n: 0, best: null, pending: false };
      byAsg[x.assignment_id].n += 1;
      if (x.status === "pending") byAsg[x.assignment_id].pending = true;
      if (byAsg[x.assignment_id].best === null || p > byAsg[x.assignment_id].best) {
        byAsg[x.assignment_id].best = p;
      }
    });
    setItems(
      a.data.map((x) => ({
        ...x,
        used: byAsg[x.id]?.n || 0,
        best: byAsg[x.id]?.best ?? null,
        pending: byAsg[x.id]?.pending || false,
      }))
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function start(a) {
    setBusyId(a.id);
    setError("");
    const { data, error } = await supabase.rpc("get_assignment_questions", { p_assignment: a.id });
    setBusyId(null);
    if (error) return setError(error.message);
    if (!data?.questions?.length) return setError("Bài tập này chưa có câu hỏi.");
    navigate("/student", {
      state: {
        assignment: { id: a.id, title: data.title, description: data.description, questions: data.questions },
      },
    });
  }

  async function toggleFeedback(a) {
    if (fb[a.id]) return setFb((m) => ({ ...m, [a.id]: null }));
    const { data, error } = await supabase.rpc("my_essay_feedback", { p_assignment: a.id });
    if (error) return setError(error.message);
    setFb((m) => ({ ...m, [a.id]: data }));
  }

  if (!items && !error) return <p className="page muted">Đang tải...</p>;

  return (
    <div className="page">
      <h1>Bài tập được giao</h1>
      {error && <p className="error">{error}</p>}
      {items?.length === 0 && <p className="muted">Hiện chưa có bài tập nào dành cho lớp của bạn.</p>}
      {items?.map((a) => {
        const expired = a.due_at && new Date(a.due_at) < new Date();
        const left = a.max_attempts - a.used;
        const canDo = !expired && left > 0;
        const f = fb[a.id];
        return (
          <div className="card" key={a.id}>
            <div className="row between">
              <div>
                <b>{a.title}</b>
                {a.description && <p className="muted small">{a.description}</p>}
              </div>
              <div className="row">
                {a.pending && <span className="badge mid">Chờ chấm tự luận</span>}
                {a.best !== null && (
                  <span className={`badge ${pointsClass(a.best)}`}>
                    {a.pending ? "Điểm tạm tính" : "Điểm cao nhất"}: {fmtPoints(a.best)}
                  </span>
                )}
              </div>
            </div>
            <div className="row" style={{ margin: "10px 0" }}>
              <span className="tag">{a.question_count} câu</span>
              {a.has_essay && <span className="tag">Có tự luận</span>}
              <span className="tag">Hạn nộp: {a.due_at ? fmtDue(a.due_at) : "không giới hạn"}</span>
              <span className="tag">Đã làm {a.used}/{a.max_attempts} lần</span>
              {expired && <span className="badge low">Đã hết hạn</span>}
            </div>
            <div className="row">
              <button onClick={() => start(a)} disabled={!canDo || busyId === a.id}>
                {busyId === a.id ? "Đang tải..." : a.used === 0 ? "Làm bài" : canDo ? "Làm lại" : "Hết lượt làm"}
              </button>
              {a.has_essay && a.used > 0 && (
                <button className="ghost" onClick={() => toggleFeedback(a)}>
                  {f ? "Đóng" : "Xem điểm và nhận xét tự luận"}
                </button>
              )}
            </div>

            {f && (
              <div style={{ marginTop: 14 }}>
                {f.status === "pending" && (
                  <p className="notice">Giáo viên đang chấm bài tự luận của bạn. Điểm hiện tại là điểm tạm tính.</p>
                )}
                {f.essays.map((e, i) => (
                  <div className="card" key={i}>
                    <p className="q">Câu tự luận ({e.weight} điểm): <MathText text={e.question} /></p>
                    <p className="muted small">Bài làm của bạn:</p>
                    <div className="studentans">
                      {e.answer_text ? <MathText text={e.answer_text} /> : <span className="muted">(bài viết tay trong ảnh)</span>}
                    </div>
                    {e.status === "graded" ? (
                      <>
                        <p className="ok">Điểm: {e.score}/{e.weight}</p>
                        {e.feedback && <p className="expl"><b>Nhận xét:</b> {e.feedback}</p>}
                        {e.model_answer && (
                          <p className="expl"><b>Đáp án mẫu:</b> <MathText text={e.model_answer} /></p>
                        )}
                      </>
                    ) : (
                      <p className="muted">Đang chờ giáo viên chấm.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}