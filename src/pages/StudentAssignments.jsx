import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { fmtPoints, pointsClass } from "../score";

const fmtDue = (d) =>
  new Date(d).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function StudentAssignments() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    (async () => {
      const [a, t] = await Promise.all([
        supabase
          .from("assignments")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("attempts")
          .select("assignment_id, points")
          .not("assignment_id", "is", null),
      ]);
      const err = a.error || t.error;
      if (err) return setError(err.message);
      const byAsg = {};
      t.data.forEach((x) => {
        const p = Number(x.points);
        byAsg[x.assignment_id] ||= { n: 0, best: null };
        byAsg[x.assignment_id].n += 1;
        if (
          byAsg[x.assignment_id].best === null ||
          p > byAsg[x.assignment_id].best
        ) {
          byAsg[x.assignment_id].best = p;
        }
      });
      setItems(
        a.data.map((x) => ({
          ...x,
          used: byAsg[x.id]?.n || 0,
          best: byAsg[x.id]?.best ?? null,
        })),
      );
    })();
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

  if (!items && !error) return <p className="page muted">Đang tải...</p>;

  return (
    <div className="page">
      <h1>Bài tập được giao</h1>
      {error && <p className="error">{error}</p>}
      {items?.length === 0 && (
        <p className="muted">Hiện chưa có bài tập nào dành cho lớp của bạn.</p>
      )}
      {items?.map((a) => {
        const expired = a.due_at && new Date(a.due_at) < new Date();
        const left = a.max_attempts - a.used;
        const canDo = !expired && left > 0;
        return (
          <div className="card" key={a.id}>
            <div className="row between">
              <div>
                <b>{a.title}</b>
                {a.description && (
                  <p className="muted small">{a.description}</p>
                )}
              </div>
              {a.best !== null && (
                <span className={`badge ${pointsClass(a.best)}`}>
                  Điểm cao nhất: {fmtPoints(a.best)}
                </span>
              )}
            </div>
            <div className="row" style={{ margin: "10px 0" }}>
              <span className="tag">{a.question_count} câu</span>
              <span className="tag">
                Hạn nộp: {a.due_at ? fmtDue(a.due_at) : "không giới hạn"}
              </span>
              <span className="tag">
                Đã làm {a.used}/{a.max_attempts} lần
              </span>
              {expired && <span className="badge low">Đã hết hạn</span>}
            </div>
            <button
              onClick={() => start(a)}
              disabled={!canDo || busyId === a.id}
            >
              {busyId === a.id
                ? "Đang tải..."
                : a.used === 0
                  ? "Làm bài"
                  : canDo
                    ? "Làm lại"
                    : "Hết lượt làm"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
