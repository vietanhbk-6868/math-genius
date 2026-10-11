import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../AuthContext";

const ROLE_LABEL = { student: "Học sinh", teacher: "Giáo viên", admin: "Quản trị viên" };

export default function AdminPage() {
  const { session } = useAuth();
  const [tab, setTab] = useState("classes");
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [teacherCode, setTeacherCode] = useState("");
  const [newClass, setNewClass] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [c, u, s] = await Promise.all([
      supabase.from("classes").select("*").order("name"),
      supabase.from("profiles").select("id, full_name, role, class_name").order("full_name"),
      supabase.from("app_settings").select("value").eq("key", "teacher_code").maybeSingle(),
    ]);
    const err = c.error || u.error || s.error;
    if (err) return setError(err.message);
    setClasses(c.data);
    setUsers(u.data);
    setTeacherCode(s.data?.value ?? "");
  }

  useEffect(() => {
    load();
  }, []);

  function flash(text) {
    setMsg(text);
    setError("");
    setTimeout(() => setMsg(""), 2500);
  }

  const studentCount = useMemo(() => {
    const m = {};
    users.filter((u) => u.role === "student").forEach((u) => {
      m[u.class_name] = (m[u.class_name] || 0) + 1;
    });
    return m;
  }, [users]);

  async function addClass(e) {
    e.preventDefault();
    const name = newClass.trim().toUpperCase();
    if (!name) return;
    const { error } = await supabase.from("classes").insert({ name });
    if (error) return setError(error.code === "23505" ? "Lớp này đã tồn tại." : error.message);
    setNewClass("");
    flash(`Đã thêm lớp ${name}`);
    load();
  }

  async function renameClass(c) {
    const input = window.prompt(`Đổi tên lớp ${c.name} thành:`, c.name);
    const name = input?.trim().toUpperCase();
    if (!name || name === c.name) return;
    const { error } = await supabase.from("classes").update({ name }).eq("id", c.id);
    if (error) return setError(error.code === "23505" ? "Tên lớp này đã tồn tại." : error.message);
    flash("Đã đổi tên lớp, học sinh trong lớp được cập nhật theo.");
    load();
  }

  async function deleteClass(c) {
    if ((studentCount[c.name] || 0) > 0) {
      return setError("Lớp còn học sinh. Hãy chuyển các em sang lớp khác trước khi xóa.");
    }
    if (!window.confirm(`Xóa lớp ${c.name}?`)) return;
    const { error } = await supabase.from("classes").delete().eq("id", c.id);
    if (error) return setError(error.message);
    flash("Đã xóa lớp.");
    load();
  }

  async function updateUser(id, patch) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return setError(error.message);
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    flash("Đã cập nhật.");
  }

  async function saveCode(e) {
    e.preventDefault();
    const value = teacherCode.trim();
    if (value.length < 6) return setError("Mã giáo viên nên có ít nhất 6 ký tự.");
    const { error } = await supabase.from("app_settings").upsert({ key: "teacher_code", value });
    if (error) return setError(error.message);
    flash("Đã lưu mã giáo viên mới.");
  }

  const filtered = users.filter(
    (u) =>
      (!roleFilter || u.role === roleFilter) &&
      (!search || u.full_name.toLowerCase().includes(search.toLowerCase()))
  );
  const classNames = classes.map((c) => c.name);

  return (
    <div className="page wide">
      <h1>Quản trị</h1>

      <div className="card summary">
        <div><b>{classes.length}</b><span>lớp học</span></div>
        <div><b>{users.filter((u) => u.role === "student").length}</b><span>học sinh</span></div>
        <div><b>{users.filter((u) => u.role !== "student").length}</b><span>giáo viên / quản trị</span></div>
      </div>

      <div className="tabs">
        <button className={tab === "classes" ? "" : "ghost"} onClick={() => setTab("classes")}>Lớp học</button>
        <button className={tab === "users" ? "" : "ghost"} onClick={() => setTab("users")}>Người dùng</button>
        <button className={tab === "settings" ? "" : "ghost"} onClick={() => setTab("settings")}>Cài đặt</button>
      </div>

      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

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
                <tr><th>Lớp</th><th>Số học sinh</th><th></th></tr>
              </thead>
              <tbody>
                {classes.length === 0 && (
                  <tr><td colSpan="3" className="muted">Chưa có lớp nào. Hãy thêm lớp để học sinh đăng ký được.</td></tr>
                )}
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td>{studentCount[c.name] || 0}</td>
                    <td>
                      <div className="row">
                        <button className="ghost" onClick={() => renameClass(c)}>Đổi tên</button>
                        <button className="ghost" onClick={() => deleteClass(c)}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "users" && (
        <>
          <div className="card form">
            <label className="grow">
              Tìm theo tên
              <input value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <label>
              Vai trò
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
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
                <tr><th>Họ tên</th><th>Vai trò</th><th>Lớp</th></tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isMe = u.id === session?.user?.id;
                  return (
                    <tr key={u.id}>
                      <td>{u.full_name}{isMe ? " (bạn)" : ""}</td>
                      <td>
                        {u.role === "admin" || isMe ? (
                          ROLE_LABEL[u.role]
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) =>
                              updateUser(u.id, {
                                role: e.target.value,
                                class_name: e.target.value === "teacher" ? null : u.class_name,
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
                            onChange={(e) => updateUser(u.id, { class_name: e.target.value || null })}
                          >
                            <option value="">Chưa có lớp</option>
                            {u.class_name && !classNames.includes(u.class_name) && (
                              <option value={u.class_name}>{u.class_name} (không có trong danh sách)</option>
                            )}
                            {classNames.map((n) => (
                              <option key={n} value={n}>{n}</option>
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
            Muốn xóa hẳn một tài khoản, vào Supabase, mở Authentication → Users và xóa ở đó. Quản trị viên mới chỉ cấp được bằng SQL để đảm bảo an toàn.
          </p>
        </>
      )}

      {tab === "settings" && (
        <form className="card stack" onSubmit={saveCode}>
          <label>
            Mã đăng ký tài khoản giáo viên
            <input value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)} />
          </label>
          <p className="muted small">
            Người đăng ký với vai trò Giáo viên phải nhập đúng mã này. Chỉ đưa mã cho giáo viên thật, và đổi mã nếu bị lộ.
          </p>
          <button type="submit">Lưu mã</button>
        </form>
      )}
    </div>
  );
}