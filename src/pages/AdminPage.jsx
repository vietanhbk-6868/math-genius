import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../AuthContext";
import { resetPassword } from "../api";
import { fmtPoints } from "../score";
import { sortClassRows } from "../sortClasses";
const ROLE_LABEL = {
  student: "Học sinh",
  teacher: "Giáo viên",
  admin: "Quản trị viên",
};
const NAV = [
  { id: "overview", icon: "📊", label: "Tổng quan" },
  { id: "progress", icon: "📈", label: "Tiến độ học sinh" },
  { id: "classes", icon: "🏫", label: "Lớp học" },
  { id: "assign", icon: "🧑‍🏫", label: "Phân công" },
  { id: "users", icon: "👥", label: "Người dùng" },
  { id: "settings", icon: "⚙️", label: "Cài đặt" },
];

const pct = (c, t) => (t ? Math.round((c / t) * 100) : 0);
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
const barClass = (r) => (r < 50 ? "low" : r < 80 ? "mid" : "high");

function weekStart(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

/* Biểu đồ đường: points = [{ label, value (0-100), tip }] */
function LineChart({ points }) {
  if (!points.length) return <p className="muted">Chưa có dữ liệu bài làm.</p>;
  const W = 640,
    H = 230,
    pl = 36,
    pr = 14,
    pt = 14,
    pb = 30;
  const n = points.length;
  const x = (i) =>
    n === 1 ? (pl + W - pr) / 2 : pl + (i * (W - pl - pr)) / (n - 1);
  const y = (v) => pt + (1 - v / 10) * (H - pt - pb);
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`)
    .join(" ");
  const area = `${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const step = Math.ceil(n / 8);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 2, 4, 6, 8, 10].map((v) => (
        <g key={v}>
          <line className="grid" x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} />
          <text x={pl - 6} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {n > 1 && <path d={area} fill="url(#areaFill)" />}
      {n > 1 && <path className="line" d={line} />}
      {points.map((p, i) => (
        <g key={i}>
          <circle className="dot" cx={x(i)} cy={y(p.value)} r="4.5">
            <title>{p.tip || `${p.label}: ${fmtPoints(p.value)} điểm`}</title>
          </circle>
          {i % step === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* Biểu đồ cột đứng: data = [{ label, value }] */
function VBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="vbars">
      {data.map((d, i) => (
        <div className="vbar" key={i}>
          <b>{d.value || ""}</b>
          <div className="colwrap">
            <div
              className="col"
              style={{ height: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { session } = useAuth();
  const [tcs, setTcs] = useState([]);
const [asgTeacher, setAsgTeacher] = useState("");
  const [tab, setTab] = useState("overview");
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [skillRows, setSkillRows] = useState([]);
  const [teacherCode, setTeacherCode] = useState("");
  const [newClass, setNewClass] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [progClass, setProgClass] = useState("");
  const [progStudent, setProgStudent] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
  const [c, u, s, a, k, t] = await Promise.all([
    supabase.from("classes").select("*").order("name"),
    supabase.from("profiles").select("id, full_name, role, class_name, username").order("full_name"),
    supabase.from("app_settings").select("value").eq("key", "teacher_code").maybeSingle(),
    supabase
      .from("attempts")
      .select("id, student_id, score, total, points, topic, created_at")
      .eq("source", "class")
      .order("created_at", { ascending: true }),
    supabase.from("student_skill_stats").select("*"),
    supabase.from("teacher_classes").select("teacher_id, class_name"),
  ]);
  const err = c.error || u.error || s.error || a.error || k.error || t.error;
  if (err) return setError(err.message);
  setClasses(sortClassRows(c.data ?? []));
  setUsers(u.data ?? []);
  setTeacherCode(s.data?.value ?? "");
  setAttempts(a.data ?? []);
  setSkillRows(k.data ?? []);
  setTcs(t.data ?? []);
}

  useEffect(() => {
    load();
  }, []);

  function flash(text) {
    setMsg(text);
    setError("");
    setTimeout(() => setMsg(""), 2500);
  }

  const students = useMemo(
    () => users.filter((u) => u.role === "student"),
    [users],
  );

  const studentCount = useMemo(() => {
    const m = {};
    students.forEach((u) => {
      m[u.class_name] = (m[u.class_name] || 0) + 1;
    });
    return m;
  }, [students]);

  /* ---- Số liệu tổng quan ---- */
  const overview = useMemo(() => {
    const classOf = Object.fromEntries(
      students.map((s) => [s.id, s.class_name]),
    );
    const valid = attempts.filter((a) => a.student_id);
    const avgPoints = valid.length
      ? valid.reduce((n, a) => n + Number(a.points), 0) / valid.length
      : null;

    const counts = {};
    valid.forEach((a) => {
      const k = new Date(a.created_at).toDateString();
      counts[k] = (counts[k] || 0) + 1;
    });
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ label: fmtDate(d), value: counts[d.toDateString()] || 0 });
    }

    const byClass = {};
    valid.forEach((a) => {
      const cn = classOf[a.student_id];
      if (!cn) return;
      byClass[cn] ||= { name: cn, sum: 0, attempts: 0 };
      byClass[cn].sum += Number(a.points);
      byClass[cn].attempts += 1;
    });
    const classAvg = Object.values(byClass)
      .map((c) => ({ ...c, avg: c.sum / c.attempts }))
      .sort((a, b) => a.avg - b.avg);

    return { attempts: valid.length, avgPoints, days, classAvg };
  }, [attempts, students]);

  /* ---- Số liệu tiến độ ---- */
  const progStudents = students.filter(
    (s) => !progClass || s.class_name === progClass,
  );
  const selected = students.find((s) => s.id === progStudent);

  const progress = useMemo(() => {
    if (selected) {
      const list = attempts.filter((a) => a.student_id === selected.id);
      const points = list.map((a, i) => {
        const v = Number(a.points);
        return {
          label: `#${i + 1}`,
          value: v,
          tip: `Lượt ${i + 1} (${fmtDate(a.created_at)}): ${a.score}/${a.total} câu, ${fmtPoints(v)} điểm`,
        };
      });
      const skills = skillRows
        .filter((r) => r.student_id === selected.id)
        .map((r) => ({
          skill_tag: r.skill_tag || "Khác",
          correct: Number(r.correct),
          total: Number(r.total),
          rate: pct(Number(r.correct), Number(r.total)),
        }))
        .sort((a, b) => a.rate - b.rate);
      return { mode: "student", list, points, skills };
    }
    const ids = new Set(progStudents.map((s) => s.id));
    const weeks = {};
    attempts
      .filter((a) => ids.has(a.student_id))
      .forEach((a) => {
        const ws = weekStart(a.created_at);
        const k = ws.getTime();
        weeks[k] ||= { date: ws, sum: 0, n: 0 };
        weeks[k].sum += Number(a.points);
        weeks[k].n += 1;
      });
    const points = Object.values(weeks)
      .sort((a, b) => a.date - b.date)
      .map((w) => {
        const v = Math.round((w.sum / w.n) * 10) / 10;
        return {
          label: fmtDate(w.date),
          value: v,
          tip: `Tuần ${fmtDate(w.date)}: ${w.n} lượt, điểm TB ${fmtPoints(v)}`,
        };
      });
    return { mode: "class", points };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts, skillRows, selected, progClass, users]);

  const trend =
    progress.mode === "student" && progress.points.length >= 2
      ? Math.round(
          (progress.points[progress.points.length - 1].value -
            progress.points[0].value) *
            10,
        ) / 10
      : null;

  /* ---- Thao tác quản trị ---- */
  async function addClass(e) {
    e.preventDefault();
    const name = newClass.trim().toUpperCase();
    if (!name) return;
    const { error } = await supabase.from("classes").insert({ name });
    if (error)
      return setError(
        error.code === "23505" ? "Lớp này đã tồn tại." : error.message,
      );
    setNewClass("");
    flash(`Đã thêm lớp ${name}`);
    load();
  }

  async function renameClass(c) {
    const name = window
      .prompt(`Đổi tên lớp ${c.name} thành:`, c.name)
      ?.trim()
      .toUpperCase();
    if (!name || name === c.name) return;
    const { error } = await supabase
      .from("classes")
      .update({ name })
      .eq("id", c.id);
    if (error)
      return setError(
        error.code === "23505" ? "Tên lớp này đã tồn tại." : error.message,
      );
    flash("Đã đổi tên lớp, học sinh trong lớp được cập nhật theo.");
    load();
  }

  async function deleteClass(c) {
    if ((studentCount[c.name] || 0) > 0) {
      return setError(
        "Lớp còn học sinh. Hãy chuyển các em sang lớp khác trước khi xóa.",
      );
    }
    if (!window.confirm(`Xóa lớp ${c.name}?`)) return;
    const { error } = await supabase.from("classes").delete().eq("id", c.id);
    if (error) return setError(error.message);
    flash("Đã xóa lớp.");
    load();
  }

  async function updateUser(id, patch) {
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id);
    if (error) return setError(error.message);
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    flash("Đã cập nhật.");
  }
  async function resetPw(u) {
    const pw = window.prompt(
      `Nhập mật khẩu mới cho ${u.full_name} (tối thiểu 6 ký tự):`,
    );
    if (!pw) return;
    if (pw.length < 6) return setError("Mật khẩu cần tối thiểu 6 ký tự.");
    try {
      await resetPassword(u.id, pw);
      flash(`Đã đặt lại mật khẩu cho ${u.full_name}.`);
    } catch (e) {
      setError(e.message);
    }
  }
  async function saveCode(e) {
    e.preventDefault();
    const value = teacherCode.trim();
    if (value.length < 6)
      return setError("Mã giáo viên nên có ít nhất 6 ký tự.");
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "teacher_code", value });
    if (error) return setError(error.message);
    flash("Đã lưu mã giáo viên mới.");
  }

  const teachers = users.filter((u) => u.role === "teacher");
const teachesClass = (tid, cn) => tcs.some((x) => x.teacher_id === tid && x.class_name === cn);

async function toggleTeaching(tid, cn) {
  const { error } = teachesClass(tid, cn)
    ? await supabase.from("teacher_classes").delete().eq("teacher_id", tid).eq("class_name", cn)
    : await supabase.from("teacher_classes").insert({ teacher_id: tid, class_name: cn });
  if (error) return setError(error.message);
  load();
}

async function setHomeroom(classId, tid) {
  const { error } = await supabase
    .from("classes")
    .update({ homeroom_teacher_id: tid || null })
    .eq("id", classId);
  if (error) return setError(error.message);
  flash("Đã cập nhật giáo viên chủ nhiệm.");
  load();
}
  const filteredUsers = users.filter(
    (u) =>
      (!roleFilter || u.role === roleFilter) &&
      (!search || u.full_name.toLowerCase().includes(search.toLowerCase())),
  );
  const classNames = classes.map((c) => c.name);
  const title = NAV.find((n) => n.id === tab).label;

  return (
    <div className="admin">
      <aside className="side">
        <h4>Quản trị</h4>
        {NAV.map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? "active" : ""}
            onClick={() => setTab(n.id)}
          >
            <span>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </aside>

      <main className="admin-main">
        <h1>{title}</h1>
        {error && <p className="error">{error}</p>}
        {msg && <p className="ok">{msg}</p>}

        {/* ===== TỔNG QUAN ===== */}
        {tab === "overview" && (
          <>
            <div className="card summary">
              <div>
                <b>{classes.length}</b>
                <span>lớp học</span>
              </div>
              <div>
                <b>{students.length}</b>
                <span>học sinh</span>
              </div>
              <div>
                <b>{users.filter((u) => u.role !== "student").length}</b>
                <span>giáo viên / quản trị</span>
              </div>
              <div>
                <b>{overview.attempts}</b>
                <span>lượt làm bài</span>
              </div>
              <div>
                <b>{fmtPoints(overview.avgPoints)}</b>
                <span>điểm TB</span>
              </div>
            </div>
            <div className="grid2">
              <div className="card">
                <h3>Lượt làm bài 14 ngày gần nhất</h3>
                <VBars data={overview.days} />
              </div>
              <div className="card">
                <h3>Tỉ lệ đúng trung bình theo lớp</h3>
                {overview.classAvg.length === 0 && (
                  <p className="muted">Chưa có dữ liệu.</p>
                )}
                {overview.classAvg.map((c) => (
                  <div className="skillrow" key={c.name}>
                    <div className="skillhead">
                      <span>{c.name}</span>
                      <b>
                        {fmtPoints(c.avg)} điểm · {c.attempts} lượt
                      </b>
                    </div>
                    <div className="bar">
                      <div
                        className={`fill ${barClass(c.avg * 10)}`}
                        style={{ width: `${c.avg * 10}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ===== TIẾN ĐỘ HỌC SINH ===== */}
        {tab === "progress" && (
          <>
            <div className="card form">
              <label>
                Lớp
                <select
                  value={progClass}
                  onChange={(e) => {
                    setProgClass(e.target.value);
                    setProgStudent("");
                  }}
                >
                  <option value="">Tất cả các lớp</option>
                  {classNames.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="grow">
                Học sinh
                <select
                  value={progStudent}
                  onChange={(e) => setProgStudent(e.target.value)}
                >
                  <option value="">Cả lớp (trung bình theo tuần)</option>
                  {progStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                      {s.class_name ? ` · ${s.class_name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="card">
              <h3>
                {progress.mode === "student"
                  ? `Tiến độ của ${selected.full_name}: điểm qua từng lượt làm bài`
                  : "Tiến độ điểm trung bình theo tuần"}
              </h3>
              <LineChart points={progress.points} />
              {trend !== null && (
                <p className={trend >= 0 ? "ok" : "bad"}>
                  {trend > 0 &&
                    `Tiến bộ ${fmtPoints(trend)} điểm so với lượt đầu tiên.`}
                  {trend === 0 && "Chưa thay đổi so với lượt đầu tiên."}
                  {trend < 0 &&
                    `Giảm ${fmtPoints(Math.abs(trend))} điểm so với lượt đầu tiên.`}
                </p>
              )}
              {progress.mode === "student" && progress.points.length === 1 && (
                <p className="muted small">
                  Mới có 1 lượt làm bài, cần thêm dữ liệu để thấy xu hướng.
                </p>
              )}
            </div>

            {progress.mode === "student" && (
              <div className="grid2">
                <div className="card">
                  <h3>Theo từng kỹ năng</h3>
                  {progress.skills.length === 0 && (
                    <p className="muted">Chưa có dữ liệu.</p>
                  )}
                  {progress.skills.map((s) => (
                    <div className="skillrow" key={s.skill_tag}>
                      <div className="skillhead">
                        <span>{s.skill_tag}</span>
                        <b>
                          {s.correct}/{s.total} câu · {s.rate}%
                        </b>
                      </div>
                      <div className="bar">
                        <div
                          className={`fill ${barClass(s.rate)}`}
                          style={{ width: `${s.rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="card tablewrap">
                  <h3>Lịch sử làm bài</h3>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Nội dung</th>
                        <th>Điểm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...progress.list].reverse().map((a) => (
                        <tr key={a.id}>
                          <td>{fmtDate(a.created_at)}</td>
                          <td>{a.topic || "Tất cả chủ đề"}</td>
                          <td>
                            {a.score}/{a.total} câu · {fmtPoints(a.points)} điểm
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== LỚP HỌC ===== */}
        {tab === "classes" && (
          <>
            <form className="card form" onSubmit={addClass}>
              <label className="grow">
                Thêm lớp mới
                <input
                  placeholder="Ví dụ: 7A3"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                />
              </label>
              <button type="submit">Thêm lớp</button>
            </form>
            <div className="card tablewrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Lớp</th>
                    <th>Số học sinh</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {classes.length === 0 && (
                    <tr>
                      <td colSpan="3" className="muted">
                        Chưa có lớp nào. Hãy thêm lớp để học sinh đăng ký được.
                      </td>
                    </tr>
                  )}
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <b>{c.name}</b>
                      </td>
                      <td>{studentCount[c.name] || 0}</td>
                      <td>
                        <div className="row">
                          <button
                            className="ghost"
                            onClick={() => renameClass(c)}
                          >
                            Đổi tên
                          </button>
                          <button
                            className="ghost"
                            onClick={() => deleteClass(c)}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {/* ===== PHÂN CÔNG ===== */}
{tab === "assign" && (
  <>
    <div className="card form">
      <label className="grow">
        Chọn giáo viên để phân lớp đang dạy
        <select value={asgTeacher} onChange={(e) => setAsgTeacher(e.target.value)}>
          <option value="">Chọn giáo viên</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      </label>
    </div>

    {asgTeacher && (
      <div className="card stack">
        <h3>Lớp đang dạy</h3>
        {classes.length === 0 && <p className="muted">Chưa có lớp nào.</p>}
        <div className="row">
          {classes.map((c) => {
            const isHome = c.homeroom_teacher_id === asgTeacher;
            return (
              <label className="cls-check" key={c.id}>
                <input
                  type="checkbox"
                  checked={isHome || teachesClass(asgTeacher, c.name)}
                  disabled={isHome}
                  onChange={() => toggleTeaching(asgTeacher, c.name)}
                />
                {c.name}{isHome ? " (chủ nhiệm)" : ""}
              </label>
            );
          })}
        </div>
        <p className="muted small">
          Thay đổi được lưu ngay. Giáo viên chỉ thấy học sinh, điểm và bài tập của những lớp được phân công.
        </p>
      </div>
    )}

    <div className="card tablewrap">
      <h3>Giáo viên chủ nhiệm từng lớp</h3>
      <table className="tbl">
        <thead>
          <tr><th>Lớp</th><th>Chủ nhiệm</th><th>Giáo viên đang dạy lớp</th></tr>
        </thead>
        <tbody>
          {classes.map((c) => (
            <tr key={c.id}>
              <td><b>{c.name}</b></td>
              <td>
                <select value={c.homeroom_teacher_id || ""} onChange={(e) => setHomeroom(c.id, e.target.value)}>
                  <option value="">Chưa có</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </td>
              <td className="muted">
                {teachers
                  .filter((t) => teachesClass(t.id, c.name) || c.homeroom_teacher_id === t.id)
                  .map((t) => t.full_name)
                  .join(", ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
)}
        {/* ===== NGƯỜI DÙNG ===== */}
        {tab === "users" && (
          <>
            <div className="card form">
              <label className="grow">
                Tìm theo tên
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                Vai trò
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  <option value="student">Học sinh</option>
                  <option value="teacher">Giáo viên</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </label>
            </div>
            <div className="card tablewrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Tên tài khoản</th>
                    <th>Vai trò</th>
                    <th>Lớp</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const isMe = u.id === session?.user?.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          {u.full_name}
                          {isMe ? " (bạn)" : ""}
                          <td>
                            {!isMe && u.role !== "admin" && (
                              <button
                                className="ghost"
                                onClick={() => resetPw(u)}
                              >
                                Đặt lại mật khẩu
                              </button>
                            )}
                          </td>
                        </td>
                        <td>{u.username || "—"}</td>
                        <td>
                          {u.role === "admin" || isMe ? (
                            ROLE_LABEL[u.role]
                          ) : (
                            <select
                              value={u.role}
                              onChange={(e) =>
                                updateUser(u.id, {
                                  role: e.target.value,
                                  class_name:
                                    e.target.value === "teacher"
                                      ? null
                                      : u.class_name,
                                })
                              }
                            >
                              <option value="student">Học sinh</option>
                              <option value="teacher">Giáo viên</option>
                            </select>
                          )}
                        </td>
                        <td>
                          {u.role === "student" ? (
                            <select
                              value={u.class_name || ""}
                              onChange={(e) =>
                                updateUser(u.id, {
                                  class_name: e.target.value || null,
                                })
                              }
                            >
                              <option value="">Chưa có lớp</option>
                              {u.class_name &&
                                !classNames.includes(u.class_name) && (
                                  <option value={u.class_name}>
                                    {u.class_name} (không có trong danh sách)
                                  </option>
                                )}
                              {classNames.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              Muốn xóa hẳn một tài khoản, vào Supabase, mở Authentication →
              Users và xóa ở đó. Quản trị viên mới chỉ cấp được bằng SQL để đảm
              bảo an toàn.
            </p>
          </>
        )}

        {/* ===== CÀI ĐẶT ===== */}
        {tab === "settings" && (
          <form className="card stack" onSubmit={saveCode}>
            <label>
              Mã đăng ký tài khoản giáo viên
              <input
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
              />
            </label>
            <p className="muted small">
              Người đăng ký với vai trò Giáo viên phải nhập đúng mã này. Chỉ đưa
              mã cho giáo viên thật, và đổi mã nếu bị lộ.
            </p>
            <button type="submit">Lưu mã</button>
          </form>
        )}
      </main>
    </div>
  );
}
