import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import MathText from "../components/MathText";
import { sortClassNames } from "../sortClasses.js";

const CONF = {
  high: ["high", "AI khá chắc"],
  medium: ["mid", "AI tạm chắc"],
  low: ["low", "AI không chắc, hãy xem kỹ"],
};

function EssayCard({ ea, q, who, title, onDone, onError }) {
  const [score, setScore] = useState(ea.final_score ?? ea.ai_score ?? "");
  const [fb, setFb] = useState(ea.teacher_feedback ?? ea.ai_feedback ?? "");
  const [urls, setUrls] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [note, setNote] = useState("");
  const graded = ea.status === "graded";
  const hasAI = ea.ai_score !== null && ea.ai_score !== undefined;

  useEffect(() => {
    let alive = true;
    (async () => {
      const out = [];
      for (const p of ea.image_paths || []) {
        const { data } = await supabase.storage.from("essays").createSignedUrl(p, 3600);
        if (data?.signedUrl) out.push(data.signedUrl);
      }
      if (alive) setUrls(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ea.id]);

  async function finalize() {
    const s = Number(score);
    if (score === "" || Number.isNaN(s) || s < 0 || s > q.weight) {
      return onError(`Điểm phải từ 0 đến ${q.weight}.`);
    }
    setBusy(true);
    const { error } = await supabase.rpc("finalize_essay", { p_id: ea.id, p_score: s, p_feedback: fb });
    setBusy(false);
    if (error) return onError(error.message);
    onDone();
  }

  async function regrade() {
    setNote("Đã yêu cầu AI chấm lại. Hãy bấm Tải lại danh sách sau khoảng 1 phút.");
    const { data: sess } = await supabase.auth.getSession();
    fetch("/.netlify/functions/grade-essays-background", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session.access_token}` },
      body: JSON.stringify({ attemptId: ea.attempt_id, force: true }),
    }).catch(() => setNote("Không gọi được AI, hãy thử lại."));
  }

  return (
    <div className="card qedit">
      <div className="row between">
        <div>
          <b>{who.full_name}</b>{" "}
          <span className="muted">· {who.class_name} · {title}</span>
        </div>
        <div className="row">
          {graded && <span className="badge high">Đã chốt: {ea.final_score}/{q.weight}</span>}
          {!graded && hasAI && (
            <span className={`badge ${CONF[ea.ai_confidence]?.[0] || "none"}`}>
              {CONF[ea.ai_confidence]?.[1] || "AI đã chấm"}
            </span>
          )}
          {!graded && !hasAI && (
            <span className="badge none">{ea.ai_error ? "AI chấm lỗi, hãy chấm tay" : "Chưa có gợi ý AI"}</span>
          )}
        </div>
      </div>

      <p className="q" style={{ marginTop: 10 }}>
        Đề ({q.weight} điểm): <MathText text={q.question} />
      </p>
      <button type="button" className="ghost" onClick={() => setShowKey((v) => !v)}>
        {showKey ? "Ẩn đáp án mẫu" : "Xem đáp án mẫu và biểu điểm"}
      </button>
      {showKey && (
        <div className="preview" style={{ marginTop: 8 }}>
          <b>Đáp án mẫu:</b> <MathText text={q.model_answer || "(trống)"} />
          {q.rubric && (
            <>
              <br />
              <b>Biểu điểm:</b> <MathText text={q.rubric} />
            </>
          )}
        </div>
      )}

      <p className="muted small" style={{ marginTop: 12 }}>Bài làm của học sinh:</p>
      <div className="studentans">
        {ea.answer_text ? <MathText text={ea.answer_text} /> : <span className="muted">(không có chữ gõ)</span>}
      </div>
      {urls.length > 0 && (
        <div className="bigimgs">
          {urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt="Bài viết tay của học sinh" />
            </a>
          ))}
        </div>
      )}

      {hasAI && !graded && (
        <div className="aibox good">
          <b>Gợi ý của AI: {ea.ai_score}/{q.weight} điểm</b>
          <p>{ea.ai_feedback}</p>
        </div>
      )}

      <div className="form" style={{ marginTop: 10 }}>
        <label>
          Điểm (0 đến {q.weight})
          <input
            type="number" min="0" max={q.weight} step="0.25" value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </label>
        <label className="grow">
          Nhận xét gửi học sinh
          <textarea value={fb} onChange={(e) => setFb(e.target.value)} />
        </label>
      </div>
      <div className="row">
        {hasAI && !graded && (
          <button type="button" className="ghost" onClick={() => { setScore(ea.ai_score); setFb(ea.ai_feedback || ""); }}>
            Dùng điểm và nhận xét của AI
          </button>
        )}
        {!graded && (
          <button type="button" className="ghost" onClick={regrade}>Nhờ AI chấm lại</button>
        )}
        <button type="button" onClick={finalize} disabled={busy}>
          {busy ? "Đang lưu..." : graded ? "Cập nhật điểm" : "Chốt điểm"}
        </button>
      </div>
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}

export default function TeacherGrading() {
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState(null);
  const [qs, setQs] = useState({});
  const [people, setPeople] = useState({});
  const [titles, setTitles] = useState({});
  const [clsF, setClsF] = useState("");
  const [asgF, setAsgF] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setItems(null);
    setError("");
    const statuses = tab === "pending" ? ["submitted", "ai_graded"] : ["graded"];
    const { data: eas, error } = await supabase
      .from("essay_answers")
      .select("*")
      .in("status", statuses)
      .order("created_at", { ascending: tab === "pending" })
      .limit(100);
    if (error) return setError(error.message);
    if (eas.length === 0) {
      setQs({});
      setPeople({});
      setTitles({});
      return setItems([]);
    }
    const qids = [...new Set(eas.map((x) => x.exam_question_id))];
    const sids = [...new Set(eas.map((x) => x.student_id))];
    const [q, p] = await Promise.all([
      supabase.from("exam_questions").select("id, assignment_id, question, model_answer, rubric, weight").in("id", qids),
      supabase.from("profiles").select("id, full_name, class_name").in("id", sids),
    ]);
    const aids = [...new Set((q.data || []).map((x) => x.assignment_id))];
    const a = await supabase.from("assignments").select("id, title").in("id", aids);
    const err = q.error || p.error || a.error;
    if (err) return setError(err.message);
    setQs(Object.fromEntries(q.data.map((x) => [x.id, x])));
    setPeople(Object.fromEntries(p.data.map((x) => [x.id, x])));
    setTitles(Object.fromEntries(a.data.map((x) => [x.id, x.title])));
    setItems(eas);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const classOptions = useMemo(
    () => sortClassNames([...new Set(Object.values(people).map((p) => p.class_name).filter(Boolean))]),
    [people]
  );
  const asgOptions = useMemo(() => Object.entries(titles), [titles]);

  const shown = (items || []).filter(
    (ea) =>
      qs[ea.exam_question_id] &&
      (!clsF || people[ea.student_id]?.class_name === clsF) &&
      (!asgF || qs[ea.exam_question_id].assignment_id === asgF)
  );

  return (
    <div className="page wide">
      <div className="row between">
        <h1>Chấm tự luận</h1>
        <div className="row">
          <button className={tab === "pending" ? "" : "ghost"} onClick={() => setTab("pending")}>Chờ chấm</button>
          <button className={tab === "graded" ? "" : "ghost"} onClick={() => setTab("graded")}>Đã chấm</button>
          <button className="ghost" onClick={load}>Tải lại danh sách</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="card form">
        <label>
          Lớp
          <select value={clsF} onChange={(e) => setClsF(e.target.value)}>
            <option value="">Tất cả</option>
            {classOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="grow">
          Bài tập
          <select value={asgF} onChange={(e) => setAsgF(e.target.value)}>
            <option value="">Tất cả</option>
            {asgOptions.map(([id, t]) => (
              <option key={id} value={id}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">
        Gợi ý của AI chỉ để tham khảo và học sinh không nhìn thấy. Điểm chỉ chính thức sau khi bạn bấm Chốt điểm.
      </p>

      {!items && !error && <p className="muted">Đang tải...</p>}
      {items && shown.length === 0 && (
        <p className="notice">{tab === "pending" ? "Không có bài tự luận nào đang chờ chấm." : "Chưa có bài nào được chấm."}</p>
      )}
      {shown.map((ea) => (
        <EssayCard
          key={ea.id + ea.status + (ea.final_score ?? "")}
          ea={ea}
          q={qs[ea.exam_question_id]}
          who={people[ea.student_id] || { full_name: "(không rõ)", class_name: "" }}
          title={titles[qs[ea.exam_question_id].assignment_id] || ""}
          onError={setError}
          onDone={() => {
            setMsg("Đã chốt điểm.");
            setTimeout(() => setMsg(""), 2500);
            load();
          }}
        />
      ))}
    </div>
  );
}