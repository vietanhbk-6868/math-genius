import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../AuthContext";
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

// Nén ảnh về tối đa 1600px, định dạng JPEG, để tải nhanh trên điện thoại
async function compressImage(file, maxSide = 1600, quality = 0.8) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error("Không đọc được ảnh này. Hãy chụp lại hoặc chọn ảnh JPG hoặc PNG.");
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("Không nén được ảnh.");
  return blob;
}

export default function StudentTest() {
  const { session } = useAuth();
  const location = useLocation();
  const [stage, setStage] = useState("setup"); // setup | test | result
  const [mode, setMode] = useState("normal"); // normal | remedial | ai | assignment
  const [assignment, setAssignment] = useState(null);
  const [meta, setMeta] = useState([]);
  const [form, setForm] = useState({ grade: 8, topic: "", count: 10 });
  const [questions, setQuestions] = useState([]);
  const [chosen, setChosen] = useState({});
  const [essays, setEssays] = useState({}); // { [qid]: { text, imgs: [{ id, blob, url }] } }
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");

  const isEssay = (q) => q.qtype === "essay";
  const setEssay = (qid, patch) =>
    setEssays((m) => ({ ...m, [qid]: { text: "", imgs: [], ...m[qid], ...patch } }));

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
      const { data, error } = await supabase.from("questions").select("grade,topic").eq("status", "approved");
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
    setMode("normal");
    setStage("test");
  }

  async function addImages(qid, fileList) {
    const cur = essays[qid]?.imgs || [];
    const files = [...fileList].slice(0, 3 - cur.length);
    try {
      const added = [];
      for (const f of files) {
        const blob = await compressImage(f);
        added.push({ id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) });
      }
      setEssay(qid, { imgs: [...cur, ...added] });
    } catch (e) {
      setError(e.message);
    }
  }

  function removeImage(qid, id) {
    const cur = essays[qid]?.imgs || [];
    const gone = cur.find((x) => x.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setEssay(qid, { imgs: cur.filter((x) => x.id !== id) });
  }

  const answered = (q) =>
    isEssay(q)
      ? (essays[q.id]?.text || "").trim().length > 0 || (essays[q.id]?.imgs || []).length > 0
      : chosen[q.id] !== undefined;

  async function submit() {
    const unanswered = questions.filter((q) => !answered(q)).length;
    if (unanswered > 0 && !window.confirm(`Còn ${unanswered} câu chưa làm. Vẫn nộp bài?`)) return;

    setBusy(true);
    setError("");

    // Tải ảnh bài viết tay lên (nếu có) rồi gom đáp án
    const payload = [];
    for (const q of questions) {
      if (isEssay(q)) {
        const e = essays[q.id] || { text: "", imgs: [] };
        const paths = [];
        for (let i = 0; i < e.imgs.length; i++) {
          setBusyMsg(`Đang tải ảnh lên (${i + 1}/${e.imgs.length})...`);
          const path = `${session.user.id}/${crypto.randomUUID()}.jpg`;
          const up = await supabase.storage.from("essays").upload(path, e.imgs[i].blob, { contentType: "image/jpeg" });
          if (up.error) {
            setBusy(false);
            setBusyMsg("");
            return setError("Không tải được ảnh bài làm: " + up.error.message);
          }
          paths.push(path);
        }
        payload.push({ question_id: q.id, text: e.text || "", images: paths });
      } else {
        payload.push({ question_id: q.id, chosen: chosen[q.id] ?? null });
      }
    }

    setBusyMsg("Đang chấm...");
    const topic =
      mode === "assignment" ? assignment.title
      : mode === "remedial" ? "Bổ trợ"
      : mode === "ai" ? "Tự luyện AI"
      : form.topic || null;
    const grade = mode === "normal" ? Number(form.grade) : (questions[0]?.grade ?? null);

    const { data, error } = await supabase.rpc("submit_attempt", {
      p_source: mode === "ai" ? "ai_self" : "class",
      p_assignment: mode === "assignment" ? assignment.id : null,
      p_topic: topic,
      p_grade: grade,
      p_answers: payload,
    });
    setBusy(false);
    setBusyMsg("");
    if (error) return setError(error.message);

    // Nhờ AI gợi ý chấm các câu tự luận (chạy nền, không bắt học sinh chờ)
    if (data.pending_essays > 0) {
      supabase.auth.getSession().then(({ data: s }) => {
        fetch("/.netlify/functions/grade-essays-background", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session.access_token}` },
          body: JSON.stringify({ attemptId: data.attempt_id }),
        }).catch(() => {});
      });
    }

    // Đáp án đúng: ưu tiên dữ liệu máy chủ trả về, nếu không có thì dùng dữ liệu câu hỏi (bài luyện tập)
    const review = data.review || [];
    const rows = questions
      .map((q) => {
        const chosenIdx = chosen[q.id] ?? null;
        const rev = review.find((x) => x.id === q.id);
        if (rev) {
          return { question: q, chosen: chosenIdx, correct: rev.correct, correctAnswer: rev.correct_answer, explanation: rev.explanation };
        }
        if (q.answer !== undefined && q.answer !== null) {
          return { question: q, chosen: chosenIdx, correct: chosenIdx === q.answer, correctAnswer: q.answer, explanation: q.explanation };
        }
        return null;
      })
      .filter(Boolean);
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
              type="number" min="1" max={Math.max(available, 1)} value={form.count}
              onChange={(e) => setForm({ ...form, count: e.target.value })}
            />
          </label>
          <button type="submit" disabled={busy}>Bắt đầu</button>
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
          {mode === "assignment" ? assignment.title
            : mode === "remedial" ? "Bài bổ trợ"
            : mode === "ai" ? "Tự luyện với AI"
            : "Bài luyện tập"}
        </h1>
        {mode === "assignment" && assignment.description && <p className="muted">{assignment.description}</p>}
        {mode === "ai" && (
          <p className="notice">Câu hỏi do AI tạo, chưa qua giáo viên duyệt. Hãy đối chiếu với kiến thức đã học.</p>
        )}

        {questions.map((q, idx) => (
          <div className="card" key={q.id}>
            <p className="q">
              Câu {idx + 1}
              {q.points ? ` (${q.points} điểm)` : ""}
              {isEssay(q) ? " · Tự luận" : ""}. <MathText text={q.question} />
            </p>

            {isEssay(q) ? (
              <div className="essay-box">
                <label>
                  Bài làm của bạn (có thể gõ công thức trong $...$)
                  <textarea
                    value={essays[q.id]?.text || ""}
                    onChange={(e) => setEssay(q.id, { text: e.target.value })}
                    placeholder="Viết lời giải của bạn ở đây..."
                  />
                </label>
                {(essays[q.id]?.imgs || []).length > 0 && (
                  <div className="thumbs">
                    {essays[q.id].imgs.map((img) => (
                      <div className="thumb" key={img.id}>
                        <img src={img.url} alt="Ảnh bài làm" />
                        <button type="button" onClick={() => removeImage(q.id, img.id)} aria-label="Xóa ảnh">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="cls-check" style={{ width: "fit-content", marginTop: 8 }}>
                  📷 Thêm ảnh bài viết tay (tối đa 3 ảnh)
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={(essays[q.id]?.imgs || []).length >= 3}
                    onChange={(e) => {
                      addImages(q.id, e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="muted small">Chụp rõ nét, đủ sáng, chỉ chụp trang giấy (đừng chụp mặt hay thông tin cá nhân).</p>
              </div>
            ) : (
              (q.options || []).map((o, i) => (
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
              ))
            )}
          </div>
        ))}

        {error && <p className="error">{error}</p>}
        <button onClick={submit} disabled={busy}>
          {busy ? busyMsg || "Đang xử lý..." : "Nộp bài"}
        </button>
      </div>
    );
  }

  const hidden = mode === "assignment" && result.reveal === false;
  const hasPending = result.pending_essays > 0;

  return (
    <div className="page">
      <h1>Kết quả{mode === "assignment" ? `: ${assignment.title}` : ""}</h1>
      <div className="card score">
        <div className={`bigpoints ${pointsClass(result.points)}`}>
          {fmtPoints(result.points)}
          <small>/10</small>
        </div>
        <p className="muted">
          {hasPending ? "Điểm tạm tính (chưa gồm phần tự luận)" : `${result.score}/${result.total} câu đúng`}
        </p>
      </div>

      {hasPending && (
        <p className="notice">
          Bài có <b>{result.pending_essays}</b> câu tự luận đang chờ giáo viên chấm. Điểm chính thức sẽ cập nhật khi
          giáo viên chấm xong. Bạn xem điểm và nhận xét ở mục <b>Bài tập</b>.
        </p>
      )}
      {mode === "assignment" && !hidden && !hasPending && (
        <p className="notice">Điểm đã được ghi nhận cho bài tập. Nếu bài còn lượt làm, điểm cao nhất sẽ được tính.</p>
      )}
      {hidden && (
        <p className="notice">
          Bạn còn <b>{result.attempts_left}</b> lượt làm lại bài này. Để công bằng, đáp án và lời giải sẽ hiện sau lượt làm cuối cùng.
        </p>
      )}
      {mode === "ai" && <p className="muted">Bài tự luyện AI không được tính vào báo cáo và bảng điểm của lớp.</p>}

      {!hidden && result.rows.length > 0 && (
        <>
          <h2>Phần trắc nghiệm theo kỹ năng</h2>
          <div className="card">
            {skillSummary(result.rows).map(([skill, s]) => (
              <p key={skill} className="skill">
                <span>{skill}</span>
                <b>{s.correct}/{s.total} câu</b>
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
                  Đáp án đúng: <MathText text={r.question.options[r.correctAnswer]} />
                </p>
              )}
              {r.explanation && (
                <p className="expl">
                  <b>Lời giải:</b> <MathText text={r.explanation} />
                </p>
              )}
            </div>
          ))}
        </>
      )}

      <div className="row">
        {mode === "assignment" ? (
          <Link className="btn" to="/student/assignments">Về danh sách bài tập</Link>
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
        <Link className="btn ghost" to="/student/report">Xem báo cáo</Link>
      </div>
    </div>
  );
}