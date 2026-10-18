import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../AuthContext";
import { loadMyClasses } from "../myClasses";
import { generateQuestions } from "../api";
import MathText from "../components/MathText";

const LEVELS = ["nhận biết", "thông hiểu", "vận dụng", "vận dụng cao"];
const LETTERS = ["A", "B", "C", "D"];
const MAX_PDF_MB = 12;
const newKey = () => crypto.randomUUID();

const fmtDue = (d) =>
  d
    ? new Date(d).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "Không giới hạn";

const blank = () => ({
  key: newKey(), include: true, qtype: "mcq", question: "", options: ["", "", "", ""], answer: 0,
  explanation: "", model_answer: "", rubric: "", points: "", skill_tag: "", level: "thông hiểu",
  issues: [], has_figure: false, verified: null, origin: "manual",
});
const blankEssay = () => ({ ...blank(), qtype: "essay" });

function fromAI(q, origin) {
  const a = Number(q.answer);
  return {
    key: newKey(),
    include: !q.has_figure,
    qtype: q.qtype === "essay" ? "essay" : "mcq",
    question: q.question || "",
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options.map(String) : ["", "", "", ""],
    answer: Number.isInteger(a) && a >= 0 && a <= 3 ? a : 0,
    explanation: q.explanation || "",
    model_answer: q.model_answer || "",
    rubric: q.rubric || "",
    points: q.points ?? "",
    skill_tag: q.skill_tag || "",
    level: LEVELS.includes(q.level) ? q.level : "thông hiểu",
    issues: Array.isArray(q.issues) ? q.issues : [],
    has_figure: !!q.has_figure,
    verified: q.verified ?? null,
    origin,
  };
}

function DraftCard({ d, index, onChange, onRemove }) {
  const set = (patch) => onChange(d.key, patch);
  const setOpt = (i, v) => set({ options: d.options.map((o, j) => (j === i ? v : o)) });
  const isEssay = d.qtype === "essay";
  return (
    <div className={`card qedit ${d.include ? "" : "off"} ${d.issues.length ? "warn" : ""}`}>
      <div className="row between">
        <label className="cls-check">
          <input type="checkbox" checked={d.include} onChange={(e) => set({ include: e.target.checked })} />
          Câu {index + 1}: dùng trong bài
        </label>
        <div className="row">
          {d.origin === "pdf" && <span className="tag">Từ file PDF</span>}
          {d.origin === "ai" && <span className="tag">AI soạn, hãy tự giải lại</span>}
          {!isEssay && d.verified === true && <span className="badge high">AI tự kiểm tra: khớp</span>}
          {!isEssay && d.verified === false && <span className="badge low">AI tự kiểm tra: không khớp</span>}
          <select value={d.qtype} onChange={(e) => set({ qtype: e.target.value })} title="Loại câu hỏi">
            <option value="mcq">Trắc nghiệm</option>
            <option value="essay">Tự luận</option>
          </select>
          <button type="button" className="ghost" onClick={() => onRemove(d.key)}>Xóa</button>
        </div>
      </div>

      {d.issues.length > 0 && (
        <ul className="issues">
          {d.issues.map((x, i) => (
            <li key={i}>⚠️ {x}</li>
          ))}
        </ul>
      )}

      <label>
        Nội dung câu hỏi (công thức viết trong $...$)
        <textarea value={d.question} onChange={(e) => set({ question: e.target.value })} />
      </label>
      <div className="preview"><MathText text={d.question || "(chưa có nội dung)"} /></div>

      {isEssay ? (
        <>
          <label>
            Đáp án mẫu (lời giải đầy đủ, AI và bạn sẽ chấm dựa vào đây)
            <textarea value={d.model_answer} onChange={(e) => set({ model_answer: e.target.value })} />
          </label>
          <div className="preview"><MathText text={d.model_answer || "(chưa có đáp án mẫu)"} /></div>
          <label>
            Biểu điểm chi tiết (ví dụ: Lập phương trình 0,5đ; Giải đúng 1đ; Kết luận 0,5đ)
            <textarea value={d.rubric} onChange={(e) => set({ rubric: e.target.value })} />
          </label>
        </>
      ) : (
        <>
          {d.options.map((o, i) => (
            <div className="optrow" key={i}>
              <input
                type="radio"
                name={`ans-${d.key}`}
                checked={d.answer === i}
                onChange={() => set({ answer: i })}
                title="Chọn làm đáp án đúng"
              />
              <b>{LETTERS[i]}.</b>
              <input value={o} placeholder={`Đáp án ${LETTERS[i]}`} onChange={(e) => setOpt(i, e.target.value)} />
            </div>
          ))}
          <p className="muted small">
            Chọn nút tròn ở đáp án đúng. Đáp án đúng đang chọn: <MathText text={d.options[d.answer] || "(trống)"} />
          </p>
          <label>
            Lời giải (hiện cho học sinh sau khi nộp bài)
            <textarea value={d.explanation} onChange={(e) => set({ explanation: e.target.value })} />
          </label>
        </>
      )}

      <div className="form">
        <label className="grow">
          Kỹ năng
          <input list="exam-skills" value={d.skill_tag} onChange={(e) => set({ skill_tag: e.target.value })} />
        </label>
        <label>
          Mức độ
          <select value={d.level} onChange={(e) => set({ level: e.target.value })}>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          Điểm của câu
          <input
            type="number" min="0.25" max="100" step="0.25"
            placeholder={isEssay ? "2" : "1"}
            value={d.points}
            onChange={(e) => set({ points: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

export default function TeacherAssignments() {
  const { profile, session } = useAuth();
  const [classes, setClasses] = useState([]);
  const [bankSkills, setBankSkills] = useState([]);
  const [list, setList] = useState([]);
  const [students, setStudents] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", classNames: [], dueAt: "", maxAttempts: 1 });
  const [drafts, setDrafts] = useState([]);
  const [gen, setGen] = useState({ topic: "", grade: 8, level: "thông hiểu", count: 3 });
  const [pdf, setPdf] = useState({ grade: "", convertOpen: false});
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [openQs, setOpenQs] = useState([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  async function load() {
    try {
      const [a, p, t, s] = await Promise.all([
        supabase.from("assignments").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, class_name").eq("role", "student"),
        supabase.from("attempts").select("assignment_id, student_id").not("assignment_id", "is", null),
        supabase.from("questions").select("skill_tag").eq("status", "approved").limit(1000),
      ]);
      const err = a.error || p.error || t.error || s.error;
      if (err) return setError(err.message);
      setClasses(await loadMyClasses(profile?.role));
      setList(a.data);
      setStudents(p.data);
      setAttempts(t.data);
      setBankSkills([...new Set(s.data.map((x) => x.skill_tag).filter(Boolean))].sort());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role]);

  function flash(t) {
    setMsg(t);
    setError("");
    setTimeout(() => setMsg(""), 4000);
  }

  const updateDraft = (key, patch) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const removeDraft = (key) => setDrafts((ds) => ds.filter((d) => d.key !== key));
  const toggleClass = (c) =>
    setForm((f) => ({
      ...f,
      classNames: f.classNames.includes(c) ? f.classNames.filter((x) => x !== c) : [...f.classNames, c],
    }));

  async function genAI(e) {
    e.preventDefault();
    setGenerating(true);
    setError("");
    try {
      const res = await generateQuestions({
        topic: gen.topic, grade: Number(gen.grade), level: gen.level, count: Number(gen.count),
      });
      if (!Array.isArray(res) || res.length === 0) {
        throw new Error("AI chưa tạo được câu hỏi. Hãy mô tả chủ đề cụ thể hơn.");
      }
      setDrafts((d) => [...d, ...res.map((q) => fromAI(q, "ai"))]);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function importPdf(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setImporting(true);
    setImportMsg("Đang tải file lên...");
    let importId = null;
    try {
      if (!/\.pdf$/i.test(file.name)) throw new Error("Chỉ nhận file PDF.");
      if (file.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`File quá lớn (tối đa ${MAX_PDF_MB} MB).`);

      const path = `${session.user.id}/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from("exams").upload(path, file, { contentType: "application/pdf" });
      if (up.error) throw new Error("Không tải được file lên: " + up.error.message);

      const ins = await supabase
        .from("exam_imports")
        .insert({ file_path: path, grade: pdf.grade ? Number(pdf.grade) : null, convert_open: pdf.convertOpen })
        .select("id")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      importId = ins.data.id;

      setImportMsg("AI đang đọc và soát đề, thường mất 1 đến 3 phút. Bạn hãy giữ trang này mở...");
      const { data: sess } = await supabase.auth.getSession();
      const r = await fetch("/.netlify/functions/extract-exam-background", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session.access_token}` },
        body: JSON.stringify({ importId }),
      });
      if (r.status !== 202 && !r.ok) throw new Error(`Không khởi chạy được việc đọc đề (mã ${r.status}).`);

      const started = Date.now();
      for (;;) {
        await new Promise((res) => setTimeout(res, 3000));
        if (Date.now() - started > 8 * 60 * 1000) throw new Error("Quá thời gian chờ. Hãy thử file ngắn hơn.");
        const { data, error } = await supabase
          .from("exam_imports")
          .select("status, result, error")
          .eq("id", importId)
          .single();
        if (error) throw new Error(error.message);
        if (data.status === "error") throw new Error(data.error || "AI không đọc được file này.");
        if (data.status === "done") {
          const qs = (data.result?.questions || []).map((q) => fromAI(q, "pdf"));
          setDrafts((d) => [...d, ...qs]);
          setForm((f) => (f.title || !data.result?.title ? f : { ...f, title: data.result.title }));
          flash(
            `AI đã đọc ${qs.length} câu${data.result?.verifyFailed ? " (chưa kiểm tra chéo được)" : ""}. Hãy xem lại từng câu trước khi giao bài.`
          );
          break;
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      if (importId) supabase.from("exam_imports").delete().eq("id", importId).then(() => {});
      setImporting(false);
      setImportMsg("");
    }
  }

    async function create() {
    setError("");
    if (!form.title.trim()) return setError("Hãy nhập tiêu đề bài tập.");
    if (form.classNames.length === 0) return setError("Hãy chọn ít nhất một lớp.");
    const use = drafts.filter((d) => d.include);
    if (use.length === 0) return setError("Hãy có ít nhất một câu hỏi được chọn dùng.");
    for (const d of use) {
      const n = drafts.indexOf(d) + 1;
      if (!d.question.trim()) return setError(`Câu ${n} chưa có nội dung.`);
      if (d.qtype === "essay") {
        if (!d.model_answer.trim()) {
          return setError(`Câu ${n} (tự luận) cần có đáp án mẫu để AI và bạn chấm được.`);
        }
      } else if (d.options.some((o) => !o.trim())) {
        return setError(`Câu ${n} chưa đủ 4 đáp án.`);
      }
    }
    const hasEssay = use.some((d) => d.qtype === "essay");
    if (hasEssay && Number(form.maxAttempts) > 1) {
      if (!window.confirm("Bài có câu tự luận chỉ cho làm 1 lần (để bạn không phải chấm nhiều lượt). Tiếp tục?")) return;
    }
    const warn = use.filter((d) => d.issues.length > 0).length;
    if (warn > 0 && !window.confirm(`Còn ${warn} câu AI có cảnh báo. Bạn đã kiểm tra các câu này chưa? Vẫn giao bài?`)) return;

    setBusy(true);
    const { error } = await supabase.rpc("create_assignment", {
      p_title: form.title,
      p_description: form.description,
      p_classes: form.classNames,
      p_due: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      p_max: Number(form.maxAttempts),
      p_questions: use.map((d) => {
        const points = d.points ? Number(d.points) : null;
        const common = { question: d.question.trim(), skill_tag: d.skill_tag.trim(), level: d.level, points };
        return d.qtype === "essay"
          ? { ...common, qtype: "essay", model_answer: d.model_answer.trim(), rubric: d.rubric.trim() }
          : {
              ...common,
              qtype: "mcq",
              options: d.options.map((o) => o.trim()),
              answer: d.answer,
              explanation: d.explanation.trim(),
            };
      }),
    });
    setBusy(false);
    if (error) return setError(error.message);
    setForm({ title: "", description: "", classNames: [], dueAt: "", maxAttempts: 1 });
    setDrafts([]);
    flash(hasEssay ? "Đã giao bài tập có câu tự luận." : "Đã giao bài tập.");
    load();
  }

  async function togglePublish(a) {
    const { error } = await supabase.from("assignments").update({ published: !a.published }).eq("id", a.id);
    if (error) return setError(error.message);
    load();
  }

  async function remove(a) {
    if (!window.confirm(`Xóa bài tập "${a.title}"? Các lượt đã làm vẫn được giữ nhưng không còn gắn với bài tập này.`)) return;
    const { error } = await supabase.from("assignments").delete().eq("id", a.id);
    if (error) return setError(error.message);
    flash("Đã xóa bài tập.");
    load();
  }

  async function toggleOpen(a) {
    if (openId === a.id) return setOpenId(null);
    setOpenId(a.id);
    setOpenQs([]);
    let qs = [];
    const e = await supabase.from("exam_questions").select("*").eq("assignment_id", a.id).order("position");
    if (!e.error && e.data.length) qs = e.data;
    else if (a.question_ids?.length) {
      const q = await supabase.from("questions").select("*").in("id", a.question_ids);
      qs = a.question_ids.map((id) => q.data?.find((x) => x.id === id)).filter(Boolean);
    }
    setOpenQs(qs);
  }

  const stats = (a) => {
    const targets = students.filter((s) => a.class_names.includes(s.class_name)).map((s) => s.id);
    const done = new Set(attempts.filter((t) => t.assignment_id === a.id).map((t) => t.student_id));
    return { total: targets.length, done: targets.filter((id) => done.has(id)).length };
  };

  const used = drafts.filter((d) => d.include).length;

  return (
    <div className="page wide">
      <h1>Giao bài tập cho lớp</h1>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      <datalist id="exam-skills">
        {bankSkills.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="card stack">
        <h3>1. Thông tin bài tập</h3>
        <div className="form">
          <label className="grow">
            Tiêu đề bài tập
            <input
              placeholder="Ví dụ: Kiểm tra 15 phút - Phương trình bậc nhất"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Hạn nộp (không bắt buộc)
            <input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          </label>
          <label>
            Số lần được làm
            <input
              type="number" min="1" max="10" value={form.maxAttempts}
              onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })}
            />
          </label>
        </div>
        <label>
          Dặn dò (không bắt buộc)
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <div>
          <p className="muted">Giao cho lớp:</p>
          <div className="row">
            {classes.length === 0 && <span className="muted">Bạn chưa được phân công lớp nào.</span>}
            {classes.map((c) => (
              <label className="cls-check" key={c}>
                <input type="checkbox" checked={form.classNames.includes(c)} onChange={() => toggleClass(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>
        <p className="muted small">
          Nếu cho làm nhiều lần, học sinh chỉ thấy điểm ở các lượt đầu. Đáp án và lời giải chỉ hiện sau lượt cuối cùng.
        </p>
      </div>

      <div className="card stack">
        <h3>2. Soạn câu hỏi</h3>
        <p className="muted small">
          Các câu hỏi ở đây chỉ thuộc bài tập này, <b>không nằm trong ngân hàng luyện tập</b>, nên học sinh không xem được đáp án trước khi nộp bài.
        </p>

        <div className="drop">
          <b>Cách 1: Tải đề kiểm tra (PDF) lên cho AI đọc và soát</b>
          <div className="form" style={{ justifyContent: "center", margin: "12px 0" }}>
            <label>
              Lớp của đề (không bắt buộc)
              <select value={pdf.grade} onChange={(e) => setPdf({ ...pdf, grade: e.target.value })}>
                <option value="">Không rõ</option>
                {[6, 7, 8, 9].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="cls-check">
              <input
                type="checkbox" checked={pdf.convertOpen}
                onChange={(e) => setPdf({ ...pdf, convertOpen: e.target.checked })}
              />
              Chuyển câu điền đáp án ngắn thành trắc nghiệm (câu chứng minh vẫn giữ là tự luận)
            </label>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={importPdf} disabled={importing} />
          {importing && <p className="notice" style={{ marginTop: 12 }}>{importMsg}</p>}
          <p className="muted small">PDF tối đa {MAX_PDF_MB} MB. File Word hãy lưu thành PDF trước. Đừng đưa file có tên học sinh.</p>
        </div>

        <form className="form" onSubmit={genAI}>
          <b style={{ width: "100%" }}>Cách 2: Nhờ AI soạn câu hỏi theo chủ đề</b>
          <label className="grow">
            Chủ đề
            <input
              required placeholder="Ví dụ: Giải phương trình bậc nhất một ẩn"
              value={gen.topic} onChange={(e) => setGen({ ...gen, topic: e.target.value })}
            />
          </label>
          <label>
            Lớp
            <select value={gen.grade} onChange={(e) => setGen({ ...gen, grade: e.target.value })}>
              {[6, 7, 8, 9].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Mức độ
            <select value={gen.level} onChange={(e) => setGen({ ...gen, level: e.target.value })}>
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Số câu
            <input
              type="number" min="1" max="5" value={gen.count}
              onChange={(e) => setGen({ ...gen, count: e.target.value })}
            />
          </label>
          <button type="submit" disabled={generating}>{generating ? "AI đang soạn..." : "Soạn bằng AI"}</button>
        </form>

                <div className="row">
          <button type="button" className="ghost" onClick={() => setDrafts((d) => [...d, blank()])}>
            Cách 3: Thêm câu trắc nghiệm trống
          </button>
          <button type="button" className="ghost" onClick={() => setDrafts((d) => [...d, blankEssay()])}>
            Thêm câu tự luận trống
          </button>
        </div>
      </div>

      <h2>3. Duyệt và chỉnh sửa câu hỏi ({used}/{drafts.length} câu được dùng)</h2>
      {drafts.length === 0 && <p className="muted">Chưa có câu hỏi nào. Hãy tải đề PDF lên, nhờ AI soạn, hoặc thêm câu trống ở trên.</p>}
      {drafts.map((d, i) => (
        <DraftCard key={d.key} d={d} index={i} onChange={updateDraft} onRemove={removeDraft} />
      ))}

      {drafts.length > 0 && (
        <div className="card row between">
          <span>
            Sẽ giao <b>{used}</b> câu cho {form.classNames.length ? form.classNames.join(", ") : "(chưa chọn lớp)"}
          </span>
          <button onClick={create} disabled={busy}>{busy ? "Đang giao bài..." : "Giao bài"}</button>
        </div>
      )}

      <h2>Các bài đã giao</h2>
      {list.length === 0 && <p className="muted">Chưa giao bài tập nào.</p>}
      {list.map((a) => {
        const st = stats(a);
        return (
          <div className="card" key={a.id}>
            <div className="row between">
              <div>
                <b>{a.title}</b> {!a.published && <span className="tag">Đang ẩn</span>}
                {a.description && <p className="muted small">{a.description}</p>}
              </div>
              <div className="row">
                <button className="ghost" onClick={() => toggleOpen(a)}>{openId === a.id ? "Đóng đề" : "Xem đề và đáp án"}</button>
                <button className="ghost" onClick={() => togglePublish(a)}>{a.published ? "Ẩn" : "Hiện lại"}</button>
                <button className="ghost" onClick={() => remove(a)}>Xóa</button>
              </div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              {a.class_names.map((c) => (
                <span className="tag" key={c}>{c}</span>
              ))}
              <span className="tag">{a.question_count} câu</span>
              <span className="tag">Hạn: {fmtDue(a.due_at)}</span>
              <span className="tag">Làm tối đa {a.max_attempts} lần</span>
              <span className="tag">Đã làm {st.done}/{st.total} học sinh</span>
            </div>
            {openId === a.id && (
              <div style={{ marginTop: 12 }}>
                {openQs.length === 0 && <p className="muted">Đang tải...</p>}
                                {openQs.map((q, i) => (
                  <div key={q.id} style={{ marginBottom: 14 }}>
                    <p className="q">
                      Câu {i + 1}{q.weight ? ` (${q.weight} điểm)` : ""}{q.qtype === "essay" ? " · Tự luận" : ""}.{" "}
                      <MathText text={q.question} />
                    </p>
                    {q.qtype === "essay" ? (
                      <>
                        <p className="expl"><b>Đáp án mẫu:</b> <MathText text={q.model_answer || ""} /></p>
                        {q.rubric && <p className="expl"><b>Biểu điểm:</b> <MathText text={q.rubric} /></p>}
                      </>
                    ) : (
                      <>
                        <ul className="opts">
                          {(q.options || []).map((o, j) => (
                            <li key={j} className={j === q.answer ? "correct" : ""}>
                              <b>{LETTERS[j]}.</b> <MathText text={o} />
                            </li>
                          ))}
                        </ul>
                        {q.explanation && <p className="expl"><b>Lời giải:</b> <MathText text={q.explanation} /></p>}
                      </>
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