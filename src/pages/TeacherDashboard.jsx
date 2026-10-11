import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { diagnose } from "../api";
const QUOTA = 4;
const pct = (c, t) => (t ? Math.round((c / t) * 100) : null);

function barClass(rate) {
  if (rate < 50) return "low";
  if (rate < 80) return "mid";
  return "high";
}

function status(rate) {
  if (rate === null) return { label: "Chưa làm bài", cls: "none" };
  if (rate < 50) return { label: "Cần hỗ trợ", cls: "low" };
  if (rate < 80) return { label: "Đang tiến bộ", cls: "mid" };
  return { label: "Vững", cls: "high" };
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [overview, setOverview] = useState([]);
  const [skillRows, setSkillRows] = useState([]);
  const [bank, setBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [openId, setOpenId] = useState(null);
  const [ai, setAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, o, s, q] = await Promise.all([
        supabase.from("profiles").select("id, full_name, class_name").eq("role", "student"),
        supabase.from("student_overview").select("*"),
        supabase.from("student_skill_stats").select("*"),
        supabase.from("questions").select("skill_tag").eq("status", "approved"),
      ]);
      const err = p.error || o.error || s.error || q.error;
      if (err) setError(err.message);
      else {
        setStudents(p.data);
        setOverview(o.data);
        setSkillRows(s.data);
        setBank(q.data);
      }
      setLoading(false);
    })();
  }, []);

  const classes = useMemo(
    () => [...new Set(students.map((s) => s.class_name).filter(Boolean))].sort(),
    [students]
  );

  const view = useMemo(() => {
    const list = students.filter((s) => !classFilter || s.class_name === classFilter);
    const ids = new Set(list.map((s) => s.id));
    const ov = Object.fromEntries(overview.map((o) => [o.student_id, o]));
    const skills = skillRows.filter((r) => ids.has(r.student_id));

    const byStudent = {};
    skills.forEach((r) => {
      (byStudent[r.student_id] ||= []).push({
        skill_tag: r.skill_tag || "Khác",
        correct: Number(r.correct),
        total: Number(r.total),
      });
    });

    const rows = list.map((s) => {
      const o = ov[s.id];
      const total = o ? Number(o.total) : 0;
      const correct = o ? Number(o.correct) : 0;
      const sk = (byStudent[s.id] || [])
        .map((x) => ({ ...x, rate: pct(x.correct, x.total) }))
        .sort((a, b) => a.rate - b.rate);
      return {
        ...s,
        attempts: o ? Number(o.attempts) : 0,
        correct,
        total,
        rate: pct(correct, total),
        skills: sk,
        weakest: sk.find((x) => x.total >= 2) || sk[0] || null,
      };
    });
    rows.sort((a, b) => (a.rate === null) - (b.rate === null) || (a.rate ?? 0) - (b.rate ?? 0));

    const cs = {};
    skills.forEach((r) => {
      const k = r.skill_tag || "Khác";
      cs[k] ||= { skill_tag: k, correct: 0, total: 0, students: 0 };
      cs[k].correct += Number(r.correct);
      cs[k].total += Number(r.total);
      cs[k].students += 1;
    });
    const classSkills = Object.values(cs)
      .map((x) => ({ ...x, rate: pct(x.correct, x.total) }))
      .sort((a, b) => a.rate - b.rate);

    const totalCorrect = rows.reduce((n, r) => n + r.correct, 0);
    const totalAll = rows.reduce((n, r) => n + r.total, 0);
    return {
      rows,
      classSkills,
      attempts: rows.reduce((n, r) => n + r.attempts, 0),
      active: rows.filter((r) => r.attempts > 0).length,
      accuracy: pct(totalCorrect, totalAll),
    };
  }, [students, overview, skillRows, classFilter]);

  const lacking = useMemo(() => {
    const count = {};
    bank.forEach((q) => {
      const k = q.skill_tag || "Khác";
      count[k] = (count[k] || 0) + 1;
    });
    const all = new Set([...Object.keys(count), ...skillRows.map((r) => r.skill_tag || "Khác")]);
    return [...all]
      .filter((k) => k !== "Khác" && (count[k] || 0) < QUOTA)
      .map((k) => ({ skill_tag: k, count: count[k] || 0 }))
      .sort((a, b) => a.count - b.count);
  }, [bank, skillRows]);

  async function runAI() {
  if (view.classSkills.length === 0) {
    return setError("Chưa có dữ liệu bài làm để phân tích.");
  }
  setAiLoading(true);
  setError("");
  try {
    const stats = view.classSkills.slice(0, 12).map((s) => ({
      skill_tag: s.skill_tag,
      correct: s.correct,
      total: s.total,
      students: s.students,
    }));
    const res = await diagnose(stats, "class", {
      class: classFilter || "tất cả các lớp",
      students: view.rows.length,
      active: view.active,
      attempts: view.attempts,
      accuracy: view.accuracy ?? 0,
      needSupport: view.rows.filter((r) => r.rate !== null && r.rate < 50).length,
    });
    setAi(res);
  } catch (e) {
    setError(e.message);
  } finally {
    setAiLoading(false);
  }
}
  if (loading) return <p className="page muted">Đang tải...</p>;

  return (
    <div className="page wide">
      <div className="row between">
        <h1>Tổng quan lớp</h1>
        <label>
          Lớp
          <select value={classFilter} onChange={(e) => {
  setClassFilter(e.target.value);
  setAi(null);
}}>
            <option value="">Tất cả các lớp</option>
            {classes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="card summary">
        <div><b>{view.rows.length}</b><span>học sinh</span></div>
        <div><b>{view.active}</b><span>đã làm bài</span></div>
        <div><b>{view.attempts}</b><span>lượt làm bài</span></div>
        <div><b>{view.accuracy === null ? "—" : `${view.accuracy}%`}</b><span>tỉ lệ đúng TB</span></div>
      </div>

      <h2>Kỹ năng cả lớp đang yếu (thấp nhất ở trên)</h2>
      <div className="card">
        {view.classSkills.length === 0 && <p className="muted">Chưa có dữ liệu bài làm.</p>}
        {view.classSkills.slice(0, 6).map((s) => (
          <div className="skillrow" key={s.skill_tag}>
            <div className="skillhead">
              <span>{s.skill_tag}</span>
              <b>{s.correct}/{s.total} câu · {s.rate}% · {s.students} học sinh</b>
            </div>
            <div className="bar">
              <div className={`fill ${barClass(s.rate)}`} style={{ width: `${s.rate}%` }} />
            </div>
          </div>
        ))}
      </div>
        <h2>Nhận xét của AI cho lớp</h2>
{!ai && (
  <button onClick={runAI} disabled={aiLoading}>
    {aiLoading ? "AI đang phân tích..." : "Phân tích lớp bằng AI"}
  </button>
)}
{ai && (
  <div className="card">
    <p>{ai.summary}</p>

    {ai.weaknesses?.length > 0 && (
      <>
        <h3>Nên dạy lại / củng cố</h3>
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
        <h3>Điểm mạnh của lớp</h3>
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
        <h3>Gợi ý cho tiết học tới</h3>
        <ol>
          {ai.next_steps.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ol>
      </>
    )}
    <p className="muted small">
      Nhận xét do AI tạo từ số liệu tổng hợp ẩn danh (không gửi họ tên học sinh), chỉ mang tính tham khảo, giáo viên là người quyết định.
    </p>
    <button className="ghost" onClick={runAI} disabled={aiLoading}>
      {aiLoading ? "Đang phân tích..." : "Phân tích lại"}
    </button>
  </div>
)}
      <h2>Danh sách học sinh</h2>
      <div className="card tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Lớp</th>
              <th>Lượt làm</th>
              <th>Tỉ lệ đúng</th>
              <th>Kỹ năng yếu nhất</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.length === 0 && (
              <tr><td colSpan="6" className="muted">Chưa có học sinh nào.</td></tr>
            )}
            {view.rows.map((r) => {
              const st = status(r.rate);
              return [
                <tr key={r.id} className="clickable" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  <td>{r.full_name}</td>
                  <td>{r.class_name || "—"}</td>
                  <td>{r.attempts}</td>
                  <td>{r.rate === null ? "—" : `${r.rate}%`}</td>
                  <td>{r.weakest ? `${r.weakest.skill_tag} (${r.weakest.rate}%)` : "—"}</td>
                  <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                </tr>,
                openId === r.id && (
                  <tr key={r.id + "-detail"}>
                    <td colSpan="6">
                      {r.skills.length === 0 && <p className="muted">Chưa có dữ liệu.</p>}
                      {r.skills.map((s) => (
                        <div className="skillrow" key={s.skill_tag}>
                          <div className="skillhead">
                            <span>{s.skill_tag}</span>
                            <b>{s.correct}/{s.total} câu · {s.rate}%</b>
                          </div>
                          <div className="bar">
                            <div className={`fill ${barClass(s.rate)}`} style={{ width: `${s.rate}%` }} />
                          </div>
                        </div>
                      ))}
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Nhãn trạng thái: dưới 50% là "Cần hỗ trợ", từ 50 đến dưới 80% là "Đang tiến bộ", từ 80% là "Vững".
        Học sinh làm ít câu thì tỉ lệ chỉ mang tính tham khảo.
      </p>

      <h2>Kỹ năng đang thiếu câu hỏi (dưới {QUOTA} câu đã duyệt)</h2>
      <div className="card">
        {lacking.length === 0 ? (
          <p className="muted">Ngân hàng câu hỏi đã đủ cho mọi kỹ năng.</p>
        ) : (
          <div className="row">
            {lacking.map((l) => (
              <span className="tag" key={l.skill_tag}>
                {l.skill_tag}: {l.count} câu
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}