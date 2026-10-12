import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import MathText from "../components/MathText";

const LEVELS = ["nhận biết", "thông hiểu", "vận dụng", "vận dụng cao"];
const MAX_Q = 50;

const fmtDue = (d) =>
  d
    ? new Date(d).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "Không giới hạn";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TeacherAssignments() {
  const [classes, setClasses] = useState([]);
  const [bank, setBank] = useState([]);
  const [list, setList] = useState([]);
  const [students, setStudents] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", classNames: [], dueAt: "", maxAttempts: 1 });
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState({ grade: "", skill: "", level: "", q: "" });
  const [randomN, setRandomN] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const [c, q, a, p, t] = await Promise.all([
      supabase.from("classes").select("name").order("name"),
      supabase
        .from("questions")
        .select("id, grade, topic, question, skill_tag, level")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, class_name").eq("role", "student"),
      supabase.from("attempts").select("assignment_id, student_id").not("assignment_id", "is", null),
    ]);
    const err = c.error || q.error || a.error || p.error || t.error;
    if (err) return setError(err.message);
    setClasses(c.data.map((x) => x.name));
    setBank(q.data);
    setList(a.data);
    setStudents(p.data);
    setAttempts(t.data);
  }

  useEffect(() => {
    load();
  }, []);

  function flash(text) {
    setMsg(text);
    setError("");
    setTimeout(() => setMsg(""), 3000);
  }

  const skills = useMemo(() => [...new Set(bank.map((q) => q.skill_tag).filter(Boolean))].sort(), [bank]);
  const filtered = useMemo(
    () =>
      bank.filter(
        (q) =>
          (!filter.grade || q.grade === Number(filter.grade)) &&
          (!filter.skill || q.skill_tag === filter.skill) &&
          (!filter.level || q.level === filter.level) &&
          (!filter.q || q.question.toLowerCase().includes(filter.q.toLowerCase()))
      ),
    [bank, filter]
  );

  const stats = useMemo(() => {
    const out = {};
    list.forEach((a) => {
      const targets = students.filter((s) => a.class_names.includes(s.class_name)).map((s) => s.id);
      const done = new Set(attempts.filter((t) => t.assignment_id === a.id).map((t) => t.student_id));
      out[a.id] = { total: targets.length, done: targets.filter((id) => done.has(id)).length };
    });
    return out;
  }, [list, students, attempts]);

  function toggleClass(c) {
    setForm((f) => ({
      ...f,
      classNames: f.classNames.includes(c) ? f.classNames.filter((x) => x !== c) : [...f.classNames, c],
    }));
  }

  function toggleQuestion(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_Q ? s : [...s, id]));
  }

  function pickRandom() {
    const n = Math.min(Math.max(Number(randomN) || 0, 1), MAX_Q);
    setSelected(shuffle(filtered).slice(0, n).map((q) => q.id));
  }

  async function create(e) {
    e.preventDefault();
    if (form.classNames.length === 0) return setError("Hãy chọn ít nhất một lớp.");
    if (selected.length === 0) return setError("Hãy chọn ít nhất một câu hỏi.");
    setBusy(true);
    const { error } = await supabase.from("assignments").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      class_names: form.classNames,
      question_ids: selected,
      due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      max_attempts: Number(form.maxAttempts),
    });
    setBusy(false);
    if (error) return setError(error.message);
    setForm({ title: "", description: "", classNames: [], dueAt: "", maxAttempts: 1 });
    setSelected([]);
    flash("Đã giao bài tập.");
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

  return (
    <div className="page wide">
      <h1>Giao bài tập cho lớp</h1>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <form className="card stack" onSubmit={create}>
        <div className="form">
          <label className="grow">
            Tiêu đề bài tập
            <input
              required
              placeholder="Ví dụ: Kiểm tra 15 phút - Phương trình bậc nhất"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Hạn nộp (không bắt buộc)
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
            />
          </label>
          <label>
            Số lần được làm
            <input
              type="number"
              min="1"
              max="10"
              value={form.maxAttempts}
              onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })}
            />
          </label>
        </div>
        <label>
          Dặn dò (không bắt buộc)
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>

        <div>
          <p className="muted">Giao cho lớp:</p>
          <div className="row">
            {classes.length === 0 && <span className="muted">Chưa có lớp nào, hãy tạo lớp ở trang Quản trị.</span>}
            {classes.map((c) => (
              <label className="cls-check" key={c}>
                <input type="checkbox" checked={form.classNames.includes(c)} onChange={() => toggleClass(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="muted">
            Chọn câu hỏi từ ngân hàng đã duyệt: đã chọn <b>{selected.length}</b>/{MAX_Q} câu
          </p>
          <div className="form">
            <label>
              Lớp
              <select value={filter.grade} onChange={(e) => setFilter({ ...filter, grade: e.target.value })}>
                <option value="">Tất cả</option>
                {[6, 7, 8, 9].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="grow">
              Kỹ năng
              <select value={filter.skill} onChange={(e) => setFilter({ ...filter, skill: e.target.value })}>
                <option value="">Tất cả</option>
                {skills.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Mức độ
              <select value={filter.level} onChange={(e) => setFilter({ ...filter, level: e.target.value })}>
                <option value="">Tất cả</option>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="grow">
              Tìm trong nội dung
              <input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
            </label>
          </div>
          <div className="row" style={{ margin: "10px 0" }}>
            <label>
              Số câu ngẫu nhiên
              <input type="number" min="1" max={MAX_Q} value={randomN} onChange={(e) => setRandomN(e.target.value)} />
            </label>
            <button type="button" className="ghost" onClick={pickRandom}>
              Chọn ngẫu nhiên từ {filtered.length} câu đang lọc
            </button>
            <button type="button" className="ghost" onClick={() => setSelected([])}>
              Bỏ chọn hết
            </button>
          </div>
          <div className="picklist">
            {filtered.length === 0 && <p className="muted" style={{ padding: 10 }}>Không có câu hỏi nào khớp bộ lọc.</p>}
            {filtered.map((q) => (
              <label className="pick" key={q.id}>
                <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggleQuestion(q.id)} />
                <span>
                  <MathText text={q.question} />
                  <br />
                  <span className="muted small">
                    Lớp {q.grade} · {q.skill_tag} · {q.level}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={busy}>
          {busy ? "Đang giao bài..." : "Giao bài"}
        </button>
      </form>

      <h2>Các bài đã giao</h2>
      {list.length === 0 && <p className="muted">Chưa giao bài tập nào.</p>}
      {list.map((a) => {
        const st = stats[a.id] || { done: 0, total: 0 };
        return (
          <div className="card" key={a.id}>
            <div className="row between">
              <div>
                <b>{a.title}</b> {!a.published && <span className="tag">Đang ẩn</span>}
                {a.description && <p className="muted small">{a.description}</p>}
              </div>
              <div className="row">
                <button className="ghost" onClick={() => togglePublish(a)}>
                  {a.published ? "Ẩn" : "Hiện lại"}
                </button>
                <button className="ghost" onClick={() => remove(a)}>Xóa</button>
              </div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              {a.class_names.map((c) => (
                <span className="tag" key={c}>{c}</span>
              ))}
              <span className="tag">{a.question_ids.length} câu</span>
              <span className="tag">Hạn: {fmtDue(a.due_at)}</span>
              <span className="tag">Làm tối đa {a.max_attempts} lần</span>
              <span className="tag">Đã làm {st.done}/{st.total} học sinh</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}